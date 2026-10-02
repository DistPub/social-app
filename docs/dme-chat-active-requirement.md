# DME Embed 需求：Chat Active 状态通知

> 状态：fatesky 侧已实现，等待 DME 侧对接
> 协议版本：`dme-embed/v1`

## 背景

fatesky web 端把 DME 聊天以 `<iframe>` 形式嵌入在 `/messages` 路由。为了提升切换性能，iframe 是 **keep-mounted** 的：用户离开 /messages 时，iframe 只是被 `display:none` 隐藏，并不会被卸载或销毁。

这带来一个未读提醒的边缘问题：

- 用户在聊天页面时，DME 认为用户「正在看聊天」，收到的新消息会计入已读。
- 用户通过底部导航/左侧导航切到主页/搜索/通知等页面后，DME 无法感知自己被隐藏了（`document.visibilityState` 仍为 `visible`，因为浏览器标签页并未切换）。
- 后续消息仍被 DME 视为已读，用户回到 /messages 时看不到未读红点。

## 目标

让 fatesky 主动把「用户是否正在看聊天页面」的状态同步给 DME，DME 据此决定新消息是否应计入未读。

## 协议变更

### 新增消息类型

在 `dme-embed/v1` 协议中新增消息：

```ts
DME_CHAT_ACTIVE = 'DME_CHAT_ACTIVE'
```

fatesky 已在 `src/lib/dme-embed/constants.ts` 中加入该消息名。

### 消息格式

fatesky → DME：

```json
{
  "protocol": "dme-embed/v1",
  "type": "DME_CHAT_ACTIVE",
  "payload": {
    "active": true | false
  }
}
```

- `active: true` — 用户当前正在看 /messages 页面，且浏览器标签页可见。
- `active: false` — 用户离开了 /messages 页面，或浏览器标签页处于后台/隐藏状态。

### 发送时机

fatesky 会在以下时机发送 `DME_CHAT_ACTIVE`：

1. **DME 完成 READY 握手并拿到 token 后**，立即发送一次当前状态（用于初始化）。
2. **用户进入或离开 /messages 路由时**（应用内导航切换）。
3. **`document.visibilityState` 变化时**（浏览器标签页切换前台/后台、最小化等）。

最终有效状态是两者的 `AND`：

```
active = isAtMessages && document.visibilityState === 'visible'
```

## DME 侧需要实现的行为

### 1. 接收 `DME_CHAT_ACTIVE`

与现有 `DME_READY` / `DME_TOKEN` 等消息一样，DME 在 `window.addEventListener('message')` 中接收，并按现有安全检查处理：

- 校验 `event.origin === 'https://dme.hukoubook.com'`（或对应环境域名）
- 校验 `event.data.protocol === 'dme-embed/v1'`
- 校验 `event.data.type === 'DME_CHAT_ACTIVE'`

### 2. 维护一个本地 "chat active" 状态

建议在 DME 内部维护一个布尔值，例如：

```ts
let isChatActive = false
```

收到 `DME_CHAT_ACTIVE` 时更新它。

### 3. 未读计数逻辑调整

当收到新消息时，判断当前会话是否是「用户正在看的聊天」：

```
当前会话视为已读的条件：
  isChatActive === true
  AND 当前打开的会话就是这条消息所属的会话
  AND 浏览器标签页可见（document.visibilityState === 'visible'）
```

如果任一条件不满足，消息应计入未读，并更新未读数后通过 `DME_UNREAD` 上报给 fatesky。

### 4. 用户回到聊天页面时

当 `DME_CHAT_ACTIVE` 从 `false` 变为 `true` 时：

- DME 可以认为用户重新回到了聊天页面。
- 如果当前打开的会话有未读消息，可以按现有逻辑标记为已读（是否立即清零由 DME 决定，建议与原有行为一致）。
- 更新未读数后，通过 `DME_UNREAD` 上报新的计数。

### 5. 浏览器标签页隐藏时

DME 自己也能监听 `document.visibilitychange`。如果 DME 想更严格一些，可以在标签页隐藏时自行把 `isChatActive` 视为 `false`，但这不是必须的——fatesky 同样会发送 `active: false`。

建议 DME 在收到 `DME_CHAT_ACTIVE` 时以它为准，同时用自身的 `visibilitychange` 作为兜底。

## 边界场景

| 场景 | fatesky 发送的 active | DME 应如何处理 |
|------|----------------------|----------------|
| 用户在 /messages，标签页可见 | `true` | 当前会话新消息计入已读 |
| 用户切到主页/搜索/通知等 | `false` | 当前会话新消息计入未读 |
| 用户在 /messages，但标签页切到后台 | `false` | 当前会话新消息计入未读 |
| iframe 刚 ready，用户已在 /messages | `true` | 初始化状态为 active |
| iframe 刚 ready，用户不在 /messages | `false` | 初始化状态为 inactive |
| 用户账号切换 | fatesky 会 remount iframe，重新从 ready 开始 | DME 按新会话处理 |

## 注意事项

- fatesky 不会发送 token 以外的敏感数据，`DME_CHAT_ACTIVE` 仅包含布尔值 `active`。
- fatesky 发送此消息不依赖 DME 回复，DME 按需消费即可。
- 如果 DME 侧暂时不处理 `DME_CHAT_ACTIVE`，现有行为保持不变（即不处理也不会报错），但未读提醒的边缘问题仍会存在。

## 验证建议

DME 对接完成后，可以通过以下步骤验证：

1. 打开 fatesky web，进入 /messages。
2. 让另一个账号给当前账号发一条消息。
3. 确认当前在 /messages 时，fatesky 底部消息图标没有未读红点。
4. 点击底部「主页」离开 /messages。
5. 让另一个账号再发一条消息。
6. 确认 fatesky 底部消息图标出现未读红点/未读数。
7. 点击「消息」回到 /messages。
8. 确认未读红点消失或更新为正确数量。

## 相关文件（fatesky 侧）

- `src/lib/dme-embed/constants.ts` — 协议常量，新增 `DME_CHAT_ACTIVE`
- `src/lib/dme-embed/useDmeEmbedBridge.ts` — 通用 `sendToDme` 发送能力
- `src/screens/Messages/DmeEmbed.tsx` — 新增 `onReady` 回调
- `src/view/shell/index.web.tsx` — 路由变化与标签页可见性监听，发送 `DME_CHAT_ACTIVE`
