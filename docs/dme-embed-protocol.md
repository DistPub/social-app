# DME 嵌入协议（fatesky ⇄ dme）

> **给 dme 仓库实施者**：本文档自包含、可执行。fatesky 侧（本文档所在仓库）已经按此协议发起，dme 侧必须配套实现应答端。文中所有常量、消息名、协议版本字符串都必须与 fatesky 源码 `src/lib/dme-embed/constants.ts` **逐字一致**，不允许自行改名或改值。
>
> fatesky 侧常量定义（权威来源）：
>
> ```ts
> export const DME_EMBED_ORIGIN: string =
>   process.env.EXPO_PUBLIC_DME_EMBED_ORIGIN || 'https://dme.hukoubook.com'
> export const DME_EMBED_PROTOCOL = 'dme-embed/v1'
> export const DME_MSG = {
>   READY: 'DME_READY',
>   TOKEN: 'DME_TOKEN',
>   SESSION_INVALID: 'DME_SESSION_INVALID',
>   UNREAD: 'DME_UNREAD',
>   PING: 'DME_PING',
>   PONG: 'DME_PONG',
> } as const
> export const DME_READY_TIMEOUT_MS = 8000
> export const DME_KEEPALIVE_INTERVAL_MS = 270_000
> export const DME_KEEPALIVE_MAX_MISS = 3
> ```

协议常量速查：

| 名称 | 值 | 含义 |
| --- | --- | --- |
| `protocol` | `dme-embed/v1` | 协议版本，每条消息都必须携带 |
| `DME_READY` | `'DME_READY'` | dme → fatesky：应用就绪，请发 token |
| `DME_TOKEN` | `'DME_TOKEN'` | fatesky → dme：会话凭证 |
| `DME_SESSION_INVALID` | `'DME_SESSION_INVALID'` | dme → fatesky：当前会话失效，请重新发 |
| `DME_UNREAD` | `'DME_UNREAD'` | dme → fatesky：未读总数变化 |
| `DME_PING` | `'DME_PING'` | fatesky → dme：保活探测 |
| `DME_PONG` | `'DME_PONG'` | dme → fatesky：保活应答 |
| `DME_READY_TIMEOUT_MS` | `8000` | fatesky 等待 READY 的超时，超时后显示降级面板 |
| `DME_KEEPALIVE_INTERVAL_MS` | `270_000` | fatesky 发 PING 的间隔（4.5 分钟） |
| `DME_KEEPALIVE_MAX_MISS` | `3` | 连续 3 次未收到 PONG → fatesky 标记 `degraded` |

父 origin 白名单（**dme 必须严格校验**，只有以下 origin 的消息可被接受）：

| origin | 用途 |
| --- | --- |
| `https://app.hukoubook.com` | fatesky 生产域 |
| `http://localhost:8081` | fatesky 本地开发（Expo web dev server 默认端口；本机实测未能确认，请按你实际启动的端口核对） |

> dme 实现者本地自测时，可选地额外把 dme 自我 origin `http://localhost:8123` 加进你自己的调试允许集，但这**不属于** fatesky 白名单，不要写进生产校验逻辑。

---

## (1) 背景与目标

fatesky web 端在 `/messages` 路由用 `<iframe>` 嵌入 dme，使 dme 成为 fatesky 的私信界面：

- iframe `src` = `${DME_EMBED_ORIGIN}/?goto=ChatList`
- `DME_EMBED_ORIGIN` 默认 `https://dme.hukoubook.com`（可用环境变量 `EXPO_PUBLIC_DME_EMBED_ORIGIN` 覆盖，本地开发时指向自建的 dme）

fatesky 把**现有的 AT Protocol 登录凭证**（accessJwt / refreshJwt / did / handle）通过 `postMessage` 交给 dme，让 dme 免登录直达 `ChatList`。dme 侧身份密钥已声明时，`?goto=ChatList` 会让 dme 跳过 Setup，直接进入会话列表（dme 现有 `App.tsx` 的 `init()` 已读取 `goto` 查询参数决定初始路由：`ChatList` / `QrDisplay` / `QrScan`，否则回落 `Setup`）。

**角色划分**：

- **fatesky = 发起方**。它决定何时发 token、何时刷新、何时发 PING、何时显示降级面板。fatesky 是**唯一**持有刷新权的一方。
- **dme = 应答方**。它发 READY、收 token、上报 SESSION_INVALID、上报 UNREAD、回 PONG。

**独立运行兼容（强制）**：dme 必须保持脱离 iframe 时的一切旧行为不变。所有嵌入相关逻辑都要先判断 `window.parent !== window`（即"当前处于 iframe 中"）。不在 iframe 中时：不发 READY、不监听嵌入消息、不依赖任何来自父窗口的东西，走原有登录 / Setup 流程。

---

## (2) COEP 放宽

dme 当前 `public/_headers` 声明：

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

**要做的改动**：

- 第 3 行 `Cross-Origin-Embedder-Policy: require-corp` → 改为 `Cross-Origin-Embedder-Policy: credentialless`（**首选**）；若你的托管理解不了 `credentialless`，可**删除**该行作为备选。
- 第 2 行 `Cross-Origin-Opener-Policy: same-origin` **保留不动**。
- fatesky 侧同样已放宽其 COEP，两端必须一致，否则 iframe 里的跨源资源会被拦。

**依据**：dme 的 `public/` 目录没有任何 SharedArrayBuffer / Atomics 引用（已 grep 证实零命中），因此不需要 `require-corp` 提供的高精度计时隔离。而 `require-corp` 会阻断 `cdn.bsky.app` 等**没有返回 CORP 响应头**的跨源头像 / 媒体资源，导致 dme 里的图片全裂。`credentialless` 在保留 COOP 隔离的同时允许这些无 CORP 头的跨源请求通过。

**验证**：

```bash
curl -sI https://dme.hukoubook.com/ | grep -i "cross-origin-embedder"
```

期望输出 `credentialless`，或该行不存在（被删除）。若仍是 `require-corp`，说明 dme 侧尚未升级——此时 fatesky 会显示降级面板，这是既定过渡态，不是故障。

---

## (3) 会话注入（DME_READY / DME_TOKEN / DME_SESSION_INVALID）

### 3.1 启动握手：发 DME_READY

dme 应用挂载后，若处于 iframe 中，向 `window.parent` 发送一条**不携带 payload** 的 READY：

```ts
import { DME_MSG, DME_EMBED_PROTOCOL } from './dme-embed-constants' // 与 fatesky 逐字一致

function signalReady() {
  if (window.parent === window) return // 独立运行，不发
  window.parent.postMessage({ protocol: DME_EMBED_PROTOCOL, type: DME_MSG.READY }, '*')
}
```

- **不携带 payload**。
- `window.parent === window` 时**不发**，保持独立运行兼容。
- fatesky 收到 READY 后才会下发 `DME_TOKEN`。若 fatesky 在 `8000` ms（`DME_READY_TIMEOUT_MS`）内没收到 READY，会显示降级面板——所以 READY 应尽早发出，别等会话恢复完成。

### 3.2 接收 token：监听 message（三重校验）

只接受同时满足以下**全部三个条件**的消息，缺一不可：

1. `event.origin` 在白名单内（`https://app.hukoubook.com`，或本地开发的 fatesky origin）
2. `event.source === window.parent`
3. `event.data?.protocol === 'dme-embed/v1'`

```ts
const PARENT_ORIGIN_ALLOWLIST = new Set<string>([
  'https://app.hukoubook.com',
  'http://localhost:8081', // fatesky 本地 dev（按实际端口核对）
])

function onMessage(event: MessageEvent) {
  if (window.parent === window) return
  if (!PARENT_ORIGIN_ALLOWLIST.has(event.origin)) return
  if (event.source !== window.parent) return
  const data = event.data
  if (data?.protocol !== DME_EMBED_PROTOCOL) return

  switch (data.type) {
    case DME_MSG.TOKEN:
      void applyToken(data.payload)
      break
    case DME_MSG.PING:
      // 见第 5 节：立即回 PONG
      window.parent.postMessage({ protocol: DME_EMBED_PROTOCOL, type: DME_MSG.PONG }, '*')
      break
  }
}

window.addEventListener('message', onMessage)
```

`DME_TOKEN` 的 payload 形状：

```ts
type DmeTokenPayload = {
  did: string
  handle: string
  accessJwt: string
  refreshJwt: string
  service?: string // PDS service URL，可选
}
```

### 3.3 用 token 恢复会话（复用 dme 现有 restore 逻辑）

收到 `DME_TOKEN` 后，构造 `CredentialSession`（`@atproto/api`）并调用 `resumeSession(...)`，然后持久化。dme 现有的 `src/atproto/session.ts` 的 `restore()` 就是同构实现，**直接复用 / 对齐它**即可：

- `restore()`（`src/atproto/session.ts:69-94`）读取存储 → `createCredentialSession()` → `await session.resumeSession({ did, handle, accessJwt, refreshJwt, active })` → `new Agent(session)`。
- `createCredentialSession()`（`src/atproto/session.ts:165-172`）注册了 `persistSession` 回调，会在会话变化时自动写存储。

```ts
import { Agent, CredentialSession } from '@atproto/api'

async function applyToken(p: DmeTokenPayload) {
  const session = new CredentialSession(
    new URL(p.service ?? PDS_URL), // 无 service 时用 dme 默认 PDS_URL
    undefined,
    (evt, data) => handlePersistSession(evt, data), // 沿用现有 persistSession 回调路径
  )
  await session.resumeSession({
    did: p.did,
    handle: p.handle,
    accessJwt: p.accessJwt,
    refreshJwt: p.refreshJwt,
    active: true,
  })
  const agent = new Agent(session)
  // 切换为当前会话，持久化到 key：dme:<did>:session
  // 然后跳 / 停在 ChatList
}
```

**持久化位置**：统一写入 key **`dme:<did>:session`**（dme `src/storage/db.ts` 的所有 key 都以 `dme:<did>:` 为前缀，`src/storage/db.ts:76`），沿用现有 `persistSession` 回调路径，不要另起一套存储。

### 3.4 禁止自刷新（关键契约）

**dme 不得自行调用 `refreshSession()`。**

- `refreshJwt` 是**单次使用**的。
- fatesky 是**唯一刷新者**：它会在自己这一侧用 refreshJwt 刷新，然后把新的 accessJwt / refreshJwt 通过 `DME_TOKEN` 重新下发给 dme。
- 如果 dme 也去刷新，会和 fatesky 形成竞态，双双拿到失效 token，把对方踢下线。atproto PDS 的刷新宽限期只能容忍"单一刷新者"这一种收敛方式。
- dme 只负责**被动接收新 token** 并在收到时替换会话。

### 3.5 会话失效上报 DME_SESSION_INVALID

dme 遇到 401 / `ExpiredToken` 时：

```ts
if (window.parent !== window) {
  window.parent.postMessage(
    { protocol: DME_EMBED_PROTOCOL, type: DME_MSG.SESSION_INVALID },
    '*',
  )
}
// 然后静候新的 DME_TOKEN：不要自行重试登录，不要清空本地会话
```

收到新的 `DME_TOKEN` 时替换会话并恢复。**不要**自行重试登录、**不要**清空本地会话、**不要**回退到 dme 的登录页。

### 3.6 token 卫生要求（强制）

- token **不得**出现在 URL 查询参数里。
- token **不得**写进 `console` 日志。
- token **不得**挂到 DOM 属性上。
- 唯一允许的持久化位置是 dme 自己的标准会话存储（AsyncStorage / web localStorage 的 `dme:<did>:session`）。这个位置是**预期且唯一允许**的。

---

## (4) 未读上报（DME_UNREAD）

dme 在 `ChatListScreen` 的 `loadConversations`（`src/ui/ChatListScreen.tsx:272`）里算出会话列表 `rows` 后，聚合 per-row 未读：

```ts
const count = rows.reduce((sum, r) => sum + r.unreadCount, 0)
```

（`rows` 的 `unreadCount` 在 `src/ui/ChatListScreen.tsx:294-324` 逐行计算，语义是"非本人发送、未读、且未被屏蔽"的消息条数。）

计数**变化时**（含首次上报）向 `window.parent` 发送：

```ts
if (window.parent !== window) {
  window.parent.postMessage(
    {
      protocol: DME_EMBED_PROTOCOL,
      type: DME_MSG.UNREAD,
      payload: { count, hasNew: count > 0 },
    },
    '*',
  )
}
```

语义：

- `count` = 当前总未读数；无会话时为 `0`。
- `hasNew = count > 0`。
- fatesky 侧用 `null` 表示"从未上报"（见 `src/state/dme/useDmeUnreadCount.ts`）。因此 dme **首帧就应上报真实值**（0 或真实数），**不要等用户交互**再发。

fatesky 侧后续行为（供 dme 理解，不必实现）：`count > 0` 时在左侧导航 / 移动端底栏 / 浏览器标签标题显示未读角标（`>10` 显示 `'10+'`）；dme 内置读后 `count` 归零，角标消失。

**无 fatesky 侧轮询**：dme 的上报是唯一数据源。dme 不上报，fatesky 就不知道未读。

---

## (5) 保活与心跳（DME_PING / DME_PONG）

- fatesky 每 `270_000` ms（4.5 分钟，`DME_KEEPALIVE_INTERVAL_MS`）向 iframe 发一条 `DME_PING`。
- dme 收到 `DME_PING` 时**立即**回 `DME_PONG`：

```ts
case DME_MSG.PING:
  // 无状态：不要做任何副作用，不要 await 任何网络请求
  window.parent.postMessage({ protocol: DME_EMBED_PROTOCOL, type: DME_MSG.PONG }, '*')
  break
```

- 应答必须**无状态**：不写存储、不改 UI、不发网络请求、不 await。就是收到即回。
- fatesky 连续 `3` 次（`DME_KEEPALIVE_MAX_MISS`）未收到 PONG，就把嵌入标记为 `degraded` 并显示降级面板。

**浏览器后台节流（如实声明）**：当浏览器标签页被切到后台时，浏览器会对 `setTimeout` / `setInterval` 降频（通常间隔被拉长到 ≥1 分钟）。dme 的轮询与心跳会随之间隔拉长，PONG 可能因此延迟送达。这是平台物理限制，代码无法绕过。dme 侧**不要**承诺后台实时性，fatesky 侧也据此容忍延迟。

---

## 手动验证清单

> 本计画不写自动化测试。以下清单是替代物，请逐条照做。

1. **COEP 检查**
   ```bash
   curl -sI https://dme.hukoubook.com/ | grep -i "cross-origin-embedder"
   ```
   期望 `credentialless` 或该行不存在。若仍是 `require-corp`，说明 dme 侧尚未升级，fatesky 会显示降级面板——这是既定过渡态，不是故障。

2. **iframe 嵌入冒烟**：在 fatesky web 登录后访问 `/messages`，DevTools → Network 应看到 iframe 请求 `https://dme.hukoubook.com/?goto=ChatList`；Console 无跨域错误；页面显示 dme 的 ChatList 而非 fatesky 旧列表。

3. **token 注入检查**：DevTools → Application → Local Storage → `https://dme.hukoubook.com` → 应存在 key `dme:<did>:session`；且**不得**在 iframe 的 URL 里看到任何 token。

4. **未读联动**：在 dme 内新收一条消息（或手动构造一条 `DME_UNREAD`）→ fatesky 左侧导航「Chat」出现数字角标 / 浏览器标签标题出现未读数。

---

## 附：dme 侧实现落点速查

以下行号为参考位置（读取时可能漂移，以实际为准）：

| 落点 | dme 文件 | 说明 |
| --- | --- | --- |
| 发 READY / 挂载时判断 iframe | `App.tsx`（`init()` 约 `App.tsx:90-117` 已读取 `goto` 决定初始路由） | 在 `window.parent !== window` 时发 READY |
| 收 token / 建会话 | `src/atproto/session.ts` 的 `restore()`（约 `:69-94`）与 `createCredentialSession()`（约 `:165-172`） | 同构复用，`resumeSession(...)` 调用见 `:78-84` |
| 持久化 key | `src/storage/db.ts`（前缀 `dme:<did>:` 见 `:76`） | 写 `dme:<did>:session` |
| 未读聚合 | `src/ui/ChatListScreen.tsx` 的 `loadConversations`（约 `:272`），`rows` / `unreadCount` 计算约 `:294-324` | `rows.reduce(...)` 后上报 |
| 默认 PDS | `src/config.ts` 的 `PDS_URL` | `DME_TOKEN.payload.service` 缺省时使用 |
