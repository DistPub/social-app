# DME Embed 需求：存储代管（Storage Delegation）

> 状态：fatesky 侧已实现，等待 DME 侧对接
> 协议版本：`dme-embed/v1`

## 背景

DME 聊天以 `<iframe>` 形式嵌入在 fatesky web 端 `/messages` 路由。DME 在 iframe 内部使用 `localStorage` 持久化聊天状态（会话列表、草稿、设置等）。

iOS Safari 的 ITP（Intelligent Tracking Prevention）对第三方 iframe 的 `localStorage` 做了双重限制：

- **Partitioned storage**：iframe 内的 `localStorage` 被分区到 `(embedder-origin, iframe-origin)` 命名空间下，与 DME 在自家域名下的存储完全隔离。
- **7 天过期清除**：第三方 iframe 的 `localStorage` 数据在 7 天不使用后会被 Safari 自动清除。

结果是：用户在 iOS Safari 上使用 fatesky 的 DME 聊天时，聊天数据可能在 7 天后丢失，或在跨浏览器/跨设备时无法同步。其他浏览器（Chrome、Firefox）虽然暂未做 7 天清除，但也有逐步收紧第三方存储的趋势。

## 目标

DME 把 `localStorage` 的读写委托给 fatesky，fatesky 在第一方 `localStorage` 按 DID 分区存储。fatesky 的 `localStorage` 是第一方存储，不受 ITP 第三方限制，不会过期清除。

具体做法：

- DME 不再直接调用 `localStorage`，改为通过 `postMessage` 向 fatesky 发送存储请求。
- fatesky 在 `localStorage` 中以 `dme-storage:{did}` 为 key 存储当前账号的全部 DME 数据（JSON blob）。
- fatesky 在握手完成后主动把存储数据推送给 DME，DME 用它恢复聊天状态。

## 协议变更

### 新增消息类型

在 `dme-embed/v1` 协议中新增 5 条消息：

```ts
DME_STORAGE_LOAD  = 'DME_STORAGE_LOAD'   // DME → fatesky：请求加载当前账号全部存储
DME_STORAGE_SET   = 'DME_STORAGE_SET'     // DME → fatesky：写入一个 key-value
DME_STORAGE_REMOVE = 'DME_STORAGE_REMOVE' // DME → fatesky：删除一个 key
DME_STORAGE_CLEAR = 'DME_STORAGE_CLEAR'   // DME → fatesky：清空当前账号存储
DME_STORAGE_DATA  = 'DME_STORAGE_DATA'    // fatesky → DME：返回存储数据（响应 LOAD + 主动推送）
```

fatesky 已在 `src/lib/dme-embed/constants.ts` 中加入全部 5 个消息名。

### 消息格式

**DME_STORAGE_LOAD**（DME → fatesky）：

```json
{"protocol": "dme-embed/v1", "type": "DME_STORAGE_LOAD"}
```

无 payload。fatesky 从当前 session 取 DID，读取该 DID 的全部存储后以 `DME_STORAGE_DATA` 响应。

**DME_STORAGE_SET**（DME → fatesky）：

```json
{
  "protocol": "dme-embed/v1",
  "type": "DME_STORAGE_SET",
  "payload": {
    "key": "string",
    "value": "string"
  }
}
```

- `key`：存储键名（string），与 `localStorage.setItem` 的 key 一致。
- `value`：存储值（string），与 `localStorage.setItem` 的 value 一致。如果 DME 需要存储对象，自行 JSON 序列化后传入。

**DME_STORAGE_REMOVE**（DME → fatesky）：

```json
{
  "protocol": "dme-embed/v1",
  "type": "DME_STORAGE_REMOVE",
  "payload": {
    "key": "string"
  }
}
```

- `key`：要删除的存储键名（string）。

**DME_STORAGE_CLEAR**（DME → fatesky）：

```json
{"protocol": "dme-embed/v1", "type": "DME_STORAGE_CLEAR"}
```

无 payload。清空当前账号的全部存储。

**DME_STORAGE_DATA**（fatesky → DME）：

```json
{
  "protocol": "dme-embed/v1",
  "type": "DME_STORAGE_DATA",
  "payload": {
    "entries": {
      "key1": "value1",
      "key2": "value2"
    }
  }
}
```

- `entries`：当前账号的全部存储数据（`Record<string, string>`）。
- 空对象 `{"entries": {}}` 表示该账号无存储数据（首次使用）。

### fatesky 发送时机

fatesky 在 DME 完成 READY 握手并交付 TOKEN 后，立即推送一次 `DME_STORAGE_DATA`。发送顺序：

```
DME_READY → DME_TOKEN → DME_STORAGE_DATA → DME_PING
```

`DME_STORAGE_DATA` 在 `DME_TOKEN` 之后、`DME_PING` 之前。这一推送发生在 `deliverToken()` 函数中，该函数同时被 DME_READY 握手路径和 late-token 恢复路径调用，两条路径行为一致。

token 轮换时（60 秒 watcher 检测 `accessJwt` 变化），fatesky 只重发 `DME_TOKEN`，不重发 `DME_STORAGE_DATA`。原因：同一账号的存储数据不会因 token 刷新而变化，DME 无需重新加载。

## DME 侧需要实现的行为

### 1. 接收 DME_STORAGE_DATA

收到 `DME_STORAGE_DATA` 后，用 `entries` 恢复等效的 localStorage 数据，初始化聊天状态。这是 iframe 首帧挂载时获取初始数据的唯一途径，包括账号切换 remount 后的场景。

`entries` 是完整快照，不是增量更新。DME 收到后应完全替换本地状态，不要做 merge。

### 2. 发送 DME_STORAGE_LOAD

当 DME 需要重新加载存储时（如会话失效后重新初始化），发送 `DME_STORAGE_LOAD`。fatesky 会读取当前 DID 的存储并以 `DME_STORAGE_DATA` 响应。

### 3. 发送 DME_STORAGE_SET

所有原来调用 `localStorage.setItem(key, value)` 的地方，替换为发送 `DME_STORAGE_SET` 消息。

写操作是 fire-and-forget：fatesky 不回复 ACK。DME 可以假设写入成功（fatesky 侧的 `localStorage.setItem` 是同步操作）。

### 4. 发送 DME_STORAGE_REMOVE

所有原来调用 `localStorage.removeItem(key)` 的地方，替换为发送 `DME_STORAGE_REMOVE` 消息。同样是 fire-and-forget。

### 5. 发送 DME_STORAGE_CLEAR

所有原来调用 `localStorage.clear()` 的地方，替换为发送 `DME_STORAGE_CLEAR` 消息。清空当前账号的全部存储。fire-and-forget。

### 6. 不再直接使用 localStorage

DME 侧所有的 `localStorage.getItem` / `setItem` / `removeItem` / `clear` 调用必须替换为对应的 postMessage 请求。DME 自身不再直接读写 `localStorage`。

接收 `DME_STORAGE_DATA` 后，DME 在内存中维护一份存储镜像，所有读取操作从内存镜像取值，写入操作通过 postMessage 委托给 fatesky 并同步更新内存镜像。

## 边界场景

| 场景 | fatesky 行为 | DME 应如何处理 |
|------|-------------|----------------|
| 账号切换 | iframe remount（`key={did}`），重新握手，推送新 DID 的 STORAGE_DATA | DME 从头初始化，用新数据恢复状态 |
| logout 当前账号 | 不清理 DME 存储；重新登录后握手时仍推送原数据 | DME 恢复原有聊天状态 |
| 删除账号 | fatesky 清理该 DID 的 DME 存储（`localStorage.removeItem('dme-storage:{did}')`） | DME 无感知（该账号不会再登录） |
| DME 重新握手 | fatesky 重新推送 STORAGE_DATA | DME 重新初始化 |
| token 轮换 | fatesky 只重发 DME_TOKEN，不重发 STORAGE_DATA | DME 无需重新加载存储（同一账号数据不变） |
| DME_SESSION_INVALID 后恢复 | fatesky 刷新 session 后重发 DME_TOKEN（经 `onSessionInvalid` 路径），不重发 STORAGE_DATA | DME 用现有内存镜像继续，无需重新加载 |

## 注意事项

- **安全检查**：与现有消息一致，DME 收到 postMessage 时必须校验三重条件：`event.origin === 'https://dme.hukoubook.com'`（或对应环境域名）、`event.data.protocol === 'dme-embed/v1'`、`event.source === iframe.contentWindow`。三者缺一即静默丢弃。
- **fire-and-forget**：写操作（SET / REMOVE / CLEAR）不回复 ACK，fatesky 不发确认。DME 可以假设写入成功，因为 fatesky 侧的 `localStorage` 操作是同步的。
- **value 类型为 string**：所有 key 和 value 都是 string 类型，与 `localStorage` 语义一致。如果 DME 需要存储对象，自行 `JSON.stringify` / `JSON.parse`。
- **entries 是快照**：`DME_STORAGE_DATA` 中的 `entries` 是发送时刻的完整快照。DME 收到后应完全替换本地状态，不要做增量合并。
- **fatesky 侧存储格式**：fatesky 把每个 DID 的全部 DME 数据存为一个 JSON blob，key 为 `dme-storage:{did}`。DME 不需要关心 fatesky 侧的存储格式，只需通过 postMessage 交互。
- **无日志**：fatesky 不会在日志中输出存储数据内容。存储可能包含 DME 的敏感聊天状态，遵循与 token 同样的隐私原则。DME 侧也建议避免在日志中输出完整 entries。
- **隐私模式兼容**：fatesky 侧所有 `localStorage` 操作都在 try-catch 中执行。如果浏览器处于隐私模式或 quota 超限，写入会静默失败，不会抛错。DME 可以假设写入成功，但极端情况下数据可能没有真正持久化。

## 验证建议

DME 对接完成后，可以通过以下步骤验证：

1. 打开 fatesky web，进入 `/messages`。
2. 打开 DevTools Console，观察 postMessage 流量（或用 fatesky 的 `__DEV__` 日志）。
3. 确认握手后收到 `DME_STORAGE_DATA`，且发送顺序为 `DME_TOKEN` → `DME_STORAGE_DATA` → `DME_PING`。
4. 在 DME 中触发一次写操作（如修改设置），检查 `localStorage.getItem('dme-storage:{当前did}')` 包含对应 key-value。
5. DME 发送 `DME_STORAGE_LOAD`，确认收到 `DME_STORAGE_DATA` 响应，`entries` 与步骤 4 写入的数据一致。
6. 切换账号，确认 iframe remount 后推送的是新 DID 的存储数据（内容不同）。
7. 删除一个账号，确认 `localStorage.getItem('dme-storage:{被删除did}')` 返回 `null`。
8. 在 iOS Safari 上验证：之前会被 7 天清除的聊天数据，现在存储在 fatesky 的第一方 `localStorage` 中，不受 ITP 限制。

## 相关文件（fatesky 侧）

- `src/lib/dme-embed/constants.ts` — 协议常量，新增 5 个消息类型（`STORAGE_LOAD` / `STORAGE_SET` / `STORAGE_REMOVE` / `STORAGE_CLEAR` / `STORAGE_DATA`）
- `src/lib/dme-embed/dmeStorage.ts` — per-DID localStorage 存储读写模块（load / set / remove / clear / clearAll）
- `src/lib/dme-embed/useDmeEmbedBridge.ts` — 处理存储请求（LOAD / SET / REMOVE / CLEAR）+ 握手后主动推送 STORAGE_DATA
- `src/view/shell/index.web.tsx` — shell 层清理被删除账号的 DME 存储（`removeAccount` 触发，logout 不触发）
