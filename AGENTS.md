# AGENTS.md — Web Platform Only

> 输出和提示优先使用中文，在输出前先说：帅哥是这样的
> 详细的组件用法、样式系统和状态管理指南请参考 `CLAUDE.md`，本文件仅记录 CLAUDE.md 未覆盖的高价值信息。

## 项目概要（Web）

Bluesky 社交应用 Web 版，基于 React Native 0.81 + Expo 54 + React Native Web + TypeScript，连接 AT Protocol 去中心化社交网络。

- 入口：`index.web.js` → 注册 `src/App.web.tsx` 根组件
- 导航：`src/Navigation.tsx`，路由定义 `src/routes.ts`，路由类型 `src/lib/routes/types.ts`
- **`/messages` 在 web 上是 DME 加密聊天的 `<iframe>` 嵌入**（不是 bsky 私信列表），详见下文「DME 嵌入聊天（web 私信）」
- Node 版本：20（见 `.nvmrc`），包管理器：bun
- **Web 开发仅需 `bun install && bun run web`**，无需 Xcode/Android Studio

## 常用命令（Web 相关）

```bash
bun install               # 安装依赖（postinstall 自动执行 patch-package 和 intl:compile-if-needed）
bun run web               # 启动 web 开发服务器（Expo + webpack）
bun run build-web         # 生产构建（输出到 web-build/，再复制到 bskyweb/static/）
bun run generate-webpack-stats-file  # 生成 webpack stats 供分析
bun run open-analyzer     # 打开 bundle analyzer

bun run test              # 运行 Jest 测试（--forceExit --bail）
bun run test <pattern>    # 运行单个测试文件
bun run test-watch        # 监听模式
bun run lint              # ESLint（仅 src 目录，--cache --quiet）
bun run typecheck         # TypeScript 检查（使用 tsconfig.check.json）
bun run prettier --check .  # Prettier 格式检查
bun run intl:compile-if-needed  # 本地编译 i18n（postinstall 已自动执行，CI 夜间任务处理 extract+compile）
```

### CI 验证链（PR 必须通过）

见 `.github/workflows/lint.yml`：
1. `bun run lint`
2. `bun run lockfile-lint`
3. `bun run prettier --check .`
4. `bun run intl:build`（extract + compile）
5. `bun run typecheck`
6. `bun run test`

## 关键约束

### i18n（国际化）

- **所有面向用户的字符串必须用 `msg()` 或 `<Trans>` 包裹**，否则 ESLint 规则 `bsky-internal/lingui-msg-rule` 报错
- **不要运行 `bun run intl:extract` 或 `bun run intl:compile`**——夜间 CI 任务处理。本地需编译用 `bun run intl:compile-if-needed`
- 翻译文件：`src/locale/locales/{locale}/messages.po`，编译输出 `messages.js`

### React Compiler 已启用

- **不要主动添加 `useMemo` 或 `useCallback`**，编译器自动处理 memoization
- 仅特殊场景使用：effect 依赖数组、传给非 React 库需引用稳定性的回调

### 平台特定文件（Web 视角）

- 用文件扩展名区分：`.tsx`（共享）、`.web.tsx`（Web 版）、`.native.tsx`（iOS+Android）
- **Web 编译时会 choke on `.native.ts` 文件**——每个平台特定文件必须有不带后缀的版本（即 web 版）。详见 `docs/build.md`
- 正常 import 即可，bundler 自动解析，**不要用 `require()` 或条件 import**
- 平台检测（运行时逻辑）：`import {IS_WEB, IS_NATIVE, IS_IOS, IS_ANDROID} from '#/env'`
- Web 特有组件见 `src/components/**/*.web.tsx`、`src/view/com/**/*.web.tsx`、`src/screens/**/*.web.tsx`

### Import 路径

- 始终用 `#/` 别名做绝对 import：`import {useSession} from '#/state/session'`
- `#/` 映射到 `./src/`（`tsconfig.json` 和 `babel.config.js` 同步配置）
- ESLint 强制 import 排序（`simple-import-sort`）：React/RN 优先 → expo → `#/` 内部路径

### Dialog 关闭回调（关键）

- **必须用 `control.close(() => ...)` 在动画完成后执行操作**，否则 React 状态更新竞态
- 影响：navigation、打开其他 dialog/menu、setState、queryClient.invalidateQueries

### Patches

- `patches/` 目录包含对依赖的补丁（react-native、expo-*、@sentry 等）
- `patch-package` 在 postinstall 时自动应用，**不要手动修改 node_modules**

### 本地修改验证

- **改代码后不需要跑 `bun run typecheck` 或 `bun run lint`，只要 `bun run build-web` 能成功通过即可**
- 上述要求仅针对本地开发验证；CI / PR 仍按「CI 验证链」执行 lint、typecheck、prettier、test 等全部检查
- 如果构建失败，优先修复构建错误；构建通过后再根据报错酌情处理明显的 lint/type 问题

## 架构要点（Web）

### 目录结构

```
src/
├── alf/                    # 设计系统（ALF）—— themes, atoms, tokens
├── components/             # 共享 UI 组件（Button, Dialog, Menu 等，含 .web.tsx 版本）
├── screens/                # 较新的屏幕组件（含 .web.tsx）
├── view/
│   ├── screens/            # 旧版屏幕组件
│   ├── com/                # 可复用视图组件
│   └── shell/              # App shell（导航栏、标签栏）——含 .web.tsx
├── state/
│   ├── queries/            # TanStack Query hooks（服务端状态）
│   ├── preferences/        # UI 偏好（React Context）
│   ├── session/            # 认证状态（useSession(), useAgent()）
│   └── persisted/          # 持久化存储
├── lib/                    # 工具、常量、helpers
├── locale/                 # i18n 配置和语言文件
└── Navigation.tsx          # 主导航配置
```

### 状态管理

- **服务端状态**：TanStack Query，hooks 在 `src/state/queries/*.ts`
- **UI 偏好**：React Context，在 `src/state/preferences/`
- **认证状态**：`src/state/session/`，用 `useSession()` 和 `useAgent()`
- Stale time 常量在 `src/state/queries/index.ts`（`STALE.MINUTES.FIVE` 等）

### DME 嵌入聊天（web 私信）

commit `06a11dcc7`（`feat(dme-embed): embed DME encrypted chat into web Messages`）起，**web 端 `/messages` 不再是 bsky 私信列表，而是用 `<iframe>` 嵌入 DME 加密聊天**（`dme.hukoubook.com`）。全部改动 web-only，native 零改动。

**网络协议与单一事实来源**

- 协议常量唯一定义在 `src/lib/dme-embed/constants.ts`：`DME_EMBED_ORIGIN`（默认 `https://dme.hukoubook.com`，可用环境变量 `EXPO_PUBLIC_DME_EMBED_ORIGIN` 覆盖）、`DME_EMBED_PROTOCOL = 'dme-embed/v1'`、`DME_MSG`（`DME_READY`/`DME_TOKEN`/`DME_SESSION_INVALID`/`DME_UNREAD`/`DME_PING`/`DME_PONG`/`DME_CHAT_ACTIVE`/`DME_STORAGE_LOAD`/`DME_STORAGE_SET`/`DME_STORAGE_REMOVE`/`DME_STORAGE_CLEAR`/`DME_STORAGE_DATA`）、`DME_READY_TIMEOUT_MS = 8000`、`DME_KEEPALIVE_INTERVAL_MS = 270_000`、`DME_KEEPALIVE_MAX_MISS = 3`
- **`constants.ts` 是协议的单一事实来源**，与 dme 仓库的对接规格以它为准；消息名与 `dme-embed/v1` 版本字符串必须与 dme 侧逐字一致，不得自行改名或改值

**新增文件（均为 web-only）**

- `src/lib/dme-embed/useDmeEmbedBridge.ts` — postMessage 状态机 hook（`waiting`/`ready`/`active`/`unavailable`/`degraded`），导出模块级 `sendToDme(type, payload)`
- `src/lib/dme-embed/useDmeTokenProvider.ts` — `useDmeTokenProvider({sendToDme})`，提供 `getToken`/`onSessionInvalid`
- `src/state/dme/useDmeUnreadCount.ts` — 纯内存未读 store（`useSyncExternalStore`），导出 `reportDmeUnread`；`null` 表示 dme 尚未上报
- `src/screens/Messages/DmeEmbed.tsx` — web-only iframe 容器
- `src/lib/dme-embed/dmeStorage.ts` — per-DID localStorage 存储读写模块（load/set/remove/clear/clearAll），含 IS_WEB 守卫确保 native 安全
- `src/screens/Messages/ChatList.web.tsx` — `.web.tsx` 平台覆盖，**空占位**（真正的 embed 挂在 shell 层），仅保留 `MessagesScreen` 导出；**删除此文件即回退旧 web 私信列表**

**修改文件**

- `src/view/shell/index.web.tsx` — **keep-mounted**：DME iframe 挂在 shell 层（navigator 之外），路由切换用 `display` 切换（`display: isAtMessages ? 'flex' : 'none'`）而非卸载；`key={currentAccount?.did}` 是唯一的合法重挂载点（账号切换）；did 变化时 `reportDmeUnread(null)` 重置角标。新增 `useDmeChatActive` 向 DME 推送 `DME_CHAT_ACTIVE`（payload `{active: boolean}`），解决 iframe 被隐藏后 DME 无法感知用户已离开聊天页面的问题
- `src/view/shell/desktop/LeftNav.tsx` / `src/view/shell/bottom-bar/BottomBarWeb.tsx` / `src/Navigation.tsx` — 未读角标/标题叠加

**关键约束 / 坑**

- **安全锁（三条件，缺一即静默丢弃）**：`event.origin === DME_EMBED_ORIGIN` **且** `event.source === iframeRef.current?.contentWindow` **且** `event.data?.protocol === DME_EMBED_PROTOCOL`；`postMessage` 的 targetOrigin 恒为 `DME_EMBED_ORIGIN`，**绝不用 `'*'`**
- **fatesky 是唯一 token 刷新者**：60s 比对 accessJwt 短指纹，变化即重发 `DME_TOKEN`；dme 报 `DME_SESSION_INVALID` 时由 fatesky 执行 `sessionManager.refreshSession()` 后重发。token 不进 React state / 日志 / localStorage / URL
- **iframe 必须首帧挂载**（握手由 iframe 驱动），`waiting` 时 Loader 是 absolute overlay；`unavailable`/`degraded` 时渲染降级面板（`window.open` 新标签逃生门）
- **无 `sandbox` 属性**（会阻断 dme 的 localStorage 持久化），`allow` 仅 `clipboard-write; fullscreen; autoplay`（复制消息 / iframe 内视频全屏 / 消息提示音与静音视频预览自动播放）
- **未读数接管逻辑**：`dmeUnread === null` 时行为与旧逻辑完全一致；`!== null` 时由 dme 接管（`>10` 显示 `'10+'`，`0` 不显示）
- **Chat Active 通知**：fatesky 在以下时机向 DME 发送 `DME_CHAT_ACTIVE`：`DME_READY` 握手完成后（初始状态）、用户进入/离开 `/messages` 路由时、`document.visibilityState` 变化时。有效状态 `active = isAtMessages && document.visibilityState === 'visible'`。DME 收到 `active: false` 后，应将当前打开会话的后续新消息计入未读，并通过 `DME_UNREAD` 重新上报；收到 `active: true` 后可按原有逻辑标记当前会话为已读。对接文档见 `docs/dme-chat-active-requirement.md`
- **COEP/嵌入头现状（按实测记录，双方均无需改动）**：dme 侧保持 `Cross-Origin-Embedder-Policy: require-corp` + `Cross-Origin-Opener-Policy: same-origin`（嵌入不需要放宽 COEP，embed 与宿主仅经 `postMessage` 通信，不涉及跨源隔离资源加载）；dme 未设 `X-Frame-Options` 与 CSP `frame-ancestors`，故可被 iframe 嵌入。fatesky 侧**未设置任何 `Cross-Origin-*` 响应头**（`curl -sI https://app.hukoubook.com/` 仅见 `referrer-policy`），因此不存在"需要放宽 COEP"一说 —— 不要把降级面板归因于 COEP
- **无法绕过的物理限制**：浏览器标签页切到后台会对 timer 降频，iframe 内的轮询/心跳会变慢 —— 不要写"后台也实时"的承诺

**集成边界（Q1a 决议）——以下文件这套集成不动**

- `src/screens/Messages/ChatList.tsx` **零改动**，仍服务 native
- 不要改 `ChatList.tsx` / `BottomBar.tsx` / `src/state/session/*` / `list-conversations.tsx`

### 样式系统（ALF）

- 自定义设计系统，Tailwind 风格命名但用 `_` 代替 `-`
- 静态 atoms：`import {atoms as a} from '#/alf'`（`a.flex_row`、`a.p_md` 等）
- 主题 atoms：`const t = useTheme()`（`t.atoms.bg`、`t.atoms.text` 等）
- 间距/文字大小用 t-shirt 尺寸：`xs`、`sm`、`md`、`lg`、`xl`
- 平台工具：`import {web, native, platform} from '#/alf'`
- 断点：`import {useBreakpoints} from '#/alf'` → `gtPhone`、`gtMobile`、`gtTablet`
- 详见 `CLAUDE.md` 的样式系统章节

### 子项目（仅 bskyweb 与 Web 相关）

| 目录 | 说明 |
|------|------|
| `bskyweb/` | Go 服务，生产环境提供 web 应用（本地开发不需要） |

#### bskyweb Go 服务

- 使用 Echo v4 Web 框架，路由定义在 `bskyweb/cmd/bskyweb/server.go`
- RSS 渲染逻辑在 `bskyweb/cmd/bskyweb/rss.go`
- 路由支持 handle 和 DID：`/profile/:handleOrDID/feed/:rkey/rss`、`/profile/:handleOrDID/rss`
- 本地运行：`cd bskyweb && go run ./cmd/bskyweb serve --appview-host=https://fatesky.hukoubook.com`
- 编译：`cd bskyweb && go build -o bskyweb ./cmd/bskyweb`
- `bun run build-web` 先构建 SPA bundle，再由 bskyweb serve 静态文件

#### 嵌入卡片（oEmbed + embed widget）已合并到 bskyweb

原独立的 `embedr` Go 服务（上游 `embed.bsky.app`）已删除，其功能并入单一 `bskyweb` 服务。嵌入域名统一为 **`fatesky-ssr.hukoubook.com`**（与 Expo Web 主站 `app.hukoubook.com` 同源指向同一 bskyweb 二进制，靠 DNS/vhost 分流）。

- 服务侧：`bskyweb/cmd/bskyweb/embed.go`（`WebOEmbed`/`WebPostEmbed`/`getPost`/`parsePostURL`）、`embed_snippet.go`（`postEmbedHTML` oembed snippet、`renderEmbedTemplate` 卡片页模板）
- 路由：`/oembed`（带 CORS `*`）、`/embed/:did/app.bsky.feed.post/:rkey`、`/static/*`（embed 静态资源走主站既有 `/static/` 路由）
- **`/embed/` 路径在 `Secure` 中间件被 `Skipper` 豁免 X-Frame-Options**（否则第三方 iframe 嵌入失败）
- 前端（`bskyembed/`，Preact/Vite 独立小站）**源码与构建链保留，只复制产物**：`bun run build`（vite，产出 `dist/static/*` + `dist/post.html`）+ `bun run build-snippet`（`tsconfig.snippet.json`，产出 `dist/embed.js` widget）→ `bun scripts/post-embed-build.js` 把产物复制进 `bskyweb/static/`
- 卡片页模板 `bskyweb/embedr-templates/postEmbed.html`（`EmbedrTemplateFS`）由 `renderEmbedTemplate` 经 `/embed/*` serve；其引用 `/static/xxx.[hash].js` 与挂载点对齐，**无需路径改写**
- **禁止改动**：`bskyembed/snippet/embed.ts` 中的 widget 契约标识符（`window.bluesky`、`data-bluesky-uri`、`bluesky-embed` 类名、`BSKY_DEV_EMBED_URL`）；改域名只改 `EMBED_URL` 死值；oembed snippet 的 `bluesky-embed` class 与 widget 的 `data-bluesky-*` 选择器必须配对，勿重命名
- 域名单一事实来源：`bskyembed/snippet/embed.ts`（`EMBED_URL`）、`bskyembed/src/screens/landing.tsx`（`EMBED_SERVICE`）、`src/lib/constants.ts`（`EMBED_SERVICE`）、`bskyweb/cmd/bskyweb/embed.go`（`EMBED_WIDGET_URL`）、`bskyweb/post.html` 的 oembed 自动发现 link —— 五处必须同步为 `fatesky-ssr.hukoubook.com`
- 详细 oEmbed 规格见 `bskyweb/README.embed.md`

#### fatesky 品牌化 / 域名迁移（embed 卡片）

embed 卡片已完成 fatesky 品牌化，旧 Bluesky 资产移除：

- **卡片图标**：`bskyembed/assets/fatesky-logo.svg`（从 `bskyweb/templates/base.html` splash 内联 SVG 提取的 fatesky 品牌标）。`bskyembed/assets/logo.svg`、`logo_full_name.svg`（旧 Bluesky 蓝蝴蝶 / 字样）已删除。引用点：`bskyembed/src/components/post.tsx`（贴文卡片右下角）、`bskyembed/src/screens/post.tsx`（PwiOptOut/ErrorMessage 右上角）、`bskyembed/src/screens/landing.tsx`（落地页顶部）
- **embed AppView host**：`public.api.bsky.app` → `fatesky.hukoubook.com`。影响 `bskyembed/src/screens/{landing,post}.tsx`（AtpAgent `service`）、`bskyembed/{index,post}.html` 与 `bskyweb/embedr-templates/{postEmbed,home}.html` 的 `preconnect`、`bskyweb/example.env` 的 `ATP_APPVIEW_HOST`
- **嵌入贴文 snippet 链接**：`src/lib/strings/url-helpers.ts` 的 `toShareUrl` 相对路径基线 `https://bsky.app` → `https://app.hukoubook.com`（`src/components/dialogs/Embed.tsx` 生成的 `bluesky-embed` 代码片段里作者 handle 链接与时间链接由此生成；share 菜单等其它 `toShareUrl` 调用点一并对齐）
- **embed 落地页输入校验**：`bskyembed/src/screens/landing.tsx` 的 `urlp.hostname.endsWith('bsky.app')` → `endsWith('app.hukoubook.com')`，`DEFAULT_POST` 示例 URL 同步为 `app.hukoubook.com`

## 测试

- Jest preset: `jest-expo/ios`，setup 文件 `jest/jestSetup.js`
- 测试文件在 `__tests__/`，mock 文件在 `__mocks__/`
- **E2E 测试用 Maestro**，需先启动 mock server（见 `docs/testing.md`）

### 运行 E2E（Web 相关）

```bash
bun run e2e:mock-server    # 终端 1：mock 后端
bun run e2e:build          # 终端 2：首次构建（生成 e2e build）
bun run e2e:start          # 终端 2：启动 Expo（e2e 模式）
bun run e2e:run            # 终端 3：运行 maestro 测试
```

## 开发环境设置（Web）

- **仅需**：`bun install && bun run web`
- 复制 `.env.example` 到 `.env`（Sentry token 非必需）
- 如需本地跑 bskyweb Go 服务：`cd bskyweb && go run ./cmd/bskyweb serve`

## Web 特有注意事项

### 组件平台差异

| 组件 | Web 行为 | Native 行为 |
|------|----------|-------------|
| `Dialog` | Radix UI 模态框 | BottomSheet |
| `Dialog.Close` | 渲染 X 关闭按钮 | 不渲染 |
| `Dialog.Handle` | 不渲染 | 渲染拖拽手柄 |
| `Menu` | 下拉菜单（Radix） | BottomSheet dialog |
| `Menu.Divider` | 渲染分割线 | 不渲染 |
| `Menu.ContainerItem` | 不工作 | 可用 |

### 样式平台工具

```tsx
import {web, native, platform} from '#/alf'

const styles = [
  a.p_md,
  web({cursor: 'pointer'}),           // 仅 Web
  native({paddingBottom: 20}),        // 仅 Native
  platform({ios: {...}, android: {...}, web: {...}}),  // 三端分别指定
]
```

### 入口与启动流程

1. `index.web.js` → 导入 polyfills → `registerRootComponent(App)`
2. `src/App.web.tsx`：初始化 Sentry、i18n、Theme、QueryProvider、Session 等 Provider
3. `Geo.resolve()`、`prefetchAgeAssuranceConfig()`、`prefetchLiveEvents()`、`prefetchAppConfig()` 并行预取
4. `InnerApp` 按 `currentAccount?.did` key 重置树，挂载 `Shell` + `ToastOutlet`

### 构建产物

- `bun run build-web` → `expo export:web` + `scripts/post-web-build.js`
- 输出：`web-build/` 目录（切片 chunk + sourcemap），随后由 `scripts/post-web-build.js` 复制到 `bskyweb/static/`
- **注意**：产物目录是 `web-build/`，不是 `dist/`（`dist/` 在本仓库不存在且被 gitignore）
- bskyweb Go 服务 serve `bskyweb/static/` 作为生产静态服务

## 代码规范速查

- **Import 排序**：`simple-import-sort` 分组（React/RN → expo → `#/`）
- **TypeScript**：严格模式，`tsconfig.check.json` 用于 CI
- **ESLint**：`bsky-internal/lingui-msg-rule` 强制 i18n，`react-compiler` 规则
- **Prettier**：单引号、尾逗号、printWidth 100
- **样式**：优先用 ALF atoms，避免内联 style，主题色用 `t.atoms.*`

## 常见坑

1. **Dialog 关闭后操作**：必须 `control.close(() => ...)`
2. **受控 vs 非受控输入**：优先 `defaultValue`，避免 `value` 导致性能问题
3. **React Compiler**：别加 `useMemo`/`useCallback`，除非有明确理由
4. **平台文件**：每个 `.native.tsx` 必须有对应的无后缀 `.tsx`（即 web 版）
5. **i18n**：新增字符串立即用 `msg()` 包裹，别等 CI 报错
6. **Sentry**：本地开发可留空 `SENTRY_AUTH_TOKEN`，不影响运行
7. **Web 私信 = DME 嵌入**：`/messages` 在 web 上是 DME 的 iframe，不是 bsky 私信列表。动 web 私信前先读 `src/lib/dme-embed/constants.ts`（协议单一事实来源），并遵守「DME 嵌入聊天（web 私信）」的集成边界（`ChatList.tsx`/`BottomBar.tsx`/`src/state/session/*`/`list-conversations.tsx` 不动）
8. **DME iframe 挂在 shell 层、唯一实例**：挂载在 `src/view/shell/index.web.tsx`（navigator 之外），路由切换只用 `display` 切换、**不要卸载**，**不要**把它放进 react-navigation 的 screen（会被卸载）。`position: 'fixed'` 在 `.tsx` 里过不了 RN 类型，web 专用 fixed 用 ALF 的 `a.fixed`（web 上是 fixed，native 上是 absolute）