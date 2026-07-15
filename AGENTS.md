# AGENTS.md

> 输出和提示优先使用中文，在输出前先说：帅哥是这样的
> 详细的组件用法、样式系统和状态管理指南请参考 `CLAUDE.md`，本文件仅记录 CLAUDE.md 未覆盖的高价值信息。

## 项目概要

Bluesky 社交应用，基于 React Native 0.81 + Expo 54 + TypeScript，连接 AT Protocol 去中心化社交网络。跨平台：iOS、Android、Web。

- 入口：`index.js`（native）、`index.web.js`（web），根组件 `src/App.native.tsx` / `src/App.web.tsx`
- 导航：`src/Navigation.tsx`，路由定义 `src/routes.ts`，路由类型 `src/lib/routes/types.ts`
- Node 版本：20（见 `.nvmrc`），包管理器：yarn 1.x

## 常用命令

```bash
yarn install              # 安装依赖（postinstall 自动执行 patch-package 和 intl:compile-if-needed）
yarn web                  # 启动 web 开发服务器
yarn ios                  # 启动 iOS（需 Xcode + 模拟器）
yarn android              # 启动 Android（需 Android Studio + 模拟器）
yarn start                # 启动 Expo dev client

yarn test                 # 运行 Jest 测试（--forceExit --bail）
yarn test <pattern>       # 运行单个测试文件，例如 yarn test src/path/to/file.test.ts
yarn test-watch           # 监听模式
yarn lint                 # ESLint（仅 src 目录，--cache --quiet）
yarn typecheck            # TypeScript 检查（使用 tsconfig.check.json）
yarn prettier --check .   # Prettier 格式检查
yarn lint-native          # SwiftLint + KTLint（原生模块 modules/ 目录）
```

### CI 验证链

PR 必须通过的检查（见 `.github/workflows/lint.yml`）：
1. `yarn lint`
2. `yarn lockfile-lint`
3. `yarn prettier --check .`
4. `yarn intl:build`（extract + compile）
5. `yarn typecheck`
6. `yarn test`

## 关键约束

### i18n（国际化）

- **所有面向用户的字符串必须用 `msg()` 或 `<Trans>` 包裹**，否则 ESLint 规则 `bsky-internal/lingui-msg-rule` 会报错
- **不要运行 `yarn intl:extract` 或 `yarn intl:compile`**——这些由夜间 CI 任务处理。本地如需编译可运行 `yarn intl:compile-if-needed`（postinstall 已自动执行）
- 翻译文件位于 `src/locale/locales/{locale}/messages.po`，编译输出为 `messages.js`

### React Compiler 已启用

- **不要主动添加 `useMemo` 或 `useCallback`**，编译器自动处理 memoization
- 仅在特殊场景使用：effect 依赖数组中的值、传给非 React 库需要引用稳定性的回调

### 平台特定文件

- 用文件扩展名区分平台：`.tsx`（共享）、`.web.tsx`、`.native.tsx`、`.ios.tsx`、`.android.tsx`
- Bundler 自动解析平台文件，正常 import 即可，**不要用 `require()` 或条件 import**
- **TypeScript 编译器在 web 编译时会 choke on `.native.ts` 文件**——因此每个平台特定文件都需要一个不带平台后缀的版本（即 web 版本）。详见 `docs/build.md`
- 平台检测（运行时逻辑）：`import {IS_WEB, IS_NATIVE, IS_IOS, IS_ANDROID} from '#/env'`

### Import 路径

- 始终用 `#/` 别名做绝对 import：`import {useSession} from '#/state/session'`
- `#/` 映射到 `./src/`（在 `tsconfig.json` 和 `babel.config.js` 中同步配置）
- ESLint 强制 import 排序（`simple-import-sort`），有特定分组规则——React/RN 优先，然后 expo，然后 `#/` 内部路径

### Dialog 关闭回调（关键）

- **必须用 `control.close(() => ...)` 在动画完成后执行操作**，否则会导致 React 状态更新竞态
- 影响：navigation、打开其他 dialog/menu、setState、queryClient.invalidateQueries

### 原生模块（modules/）

- `modules/` 包含自定义 Expo 模块（BlueskyClip、BlueskyNSE、Share-with-Bluesky、expo-bluesky-swiss-army 等）
- 修改原生模块后需运行 `yarn lint-native` 检查 Swift/Kotlin 代码
- `npx expo prebuild` 在 `app.json` 或原生依赖变更后需要重新执行

### Patches

- `patches/` 目录包含对依赖的补丁（react-native、expo-*、@sentry 等）
- `patch-package` 在 postinstall 时自动应用，**不要手动修改 node_modules**

## 架构要点

### 双屏幕目录模式

- `src/screens/` — 较新的屏幕组件
- `src/view/screens/` — 旧版屏幕组件
- `src/view/com/` — 可复用视图组件
- `src/view/shell/` — App shell（导航栏、标签栏）

### 状态管理

- **服务端状态**：TanStack Query，hooks 在 `src/state/queries/*.ts`
- **UI 偏好**：React Context，在 `src/state/preferences/`
- **认证状态**：`src/state/session/`，用 `useSession()` 和 `useAgent()`
- Stale time 常量在 `src/state/queries/index.ts`（`STALE.MINUTES.FIVE` 等）

### 样式系统（ALF）

- 自定义设计系统，Tailwind 风格命名但用 `_` 代替 `-`
- 静态 atoms：`import {atoms as a} from '#/alf'`（`a.flex_row`、`a.p_md` 等）
- 主题 atoms：`const t = useTheme()`（`t.atoms.bg`、`t.atoms.text` 等）
- 间距/文字大小用 t-shirt 尺寸：`xs`、`sm`、`md`、`lg`、`xl`
- 详见 `CLAUDE.md` 的样式系统章节

### 子项目

| 目录 | 说明 |
|------|------|
| `bskyweb/` | Go 服务，生产环境提供 web 应用（本地开发不需要） |
| `bskyembed/` | 嵌入式小组件 |
| `bskylink/` | 链接卡片服务 |
| `bskyogcard/` | OG 图片生成 |

#### bskyweb Go 服务

- 使用 Echo v4 Web 框架，路由定义在 `bskyweb/cmd/bskyweb/server.go`
- RSS 渲染逻辑在 `bskyweb/cmd/bskyweb/rss.go`
- 路由支持 handle 和 DID 两种格式：`/profile/:handleOrDID/feed/:rkey/rss`、`/profile/:handleOrDID/rss`
- 本地运行：`cd bskyweb && go run ./cmd/bskyweb serve --appview-host=https://public.api.bsky.app`
- 编译：`cd bskyweb && go build -o bskyweb ./cmd/bskyweb`

## 测试

- Jest preset: `jest-expo/ios`，setup 文件 `jest/jestSetup.js`
- 测试文件在 `__tests__/`，mock 文件在 `__mocks__/`
- E2E 测试用 Maestro（`__e2e__/flows/*.yml`），需先启动 mock server
- 性能测试用 Flashlight

### 运行 E2E

```bash
yarn e2e:mock-server    # 终端 1
yarn e2e:build          # 终端 2（首次）
yarn e2e:start          # 终端 2
yarn e2e:run            # 终端 3
```

## 开发环境设置

- Web 开发：只需 `yarn && yarn web`
- Native 开发：需要 Xcode（iOS）或 Android Studio（Android），详见 `docs/build.md`
- 复制 `.env.example` 到 `.env`（Sentry token 非必需）
- `JAVA_HOME` 必须指向 zulu-17（Android 构建）
- `google-services.json.example` 复制为 `google-services.json`（不需要真实 Firebase 项目）
