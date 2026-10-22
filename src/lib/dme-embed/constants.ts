/**
 * Single source of truth for the DME embed protocol constants shared with the
 * dme side. Message names and the protocol version string MUST stay
 * byte-for-byte in sync across both repos.
 */

/**
 * Origin of the embedded DME chat app. Overridable via env for local/dev hosts.
 */
export const DME_EMBED_ORIGIN: string =
  process.env.EXPO_PUBLIC_DME_EMBED_ORIGIN || 'https://dme.hukoubook.com'

/**
 * Version of the postMessage protocol spoken between the app and the embed.
 */
export const DME_EMBED_PROTOCOL = 'dme-embed/v1'

/**
 * Message type names exchanged over the embed bridge.
 */
export const DME_MSG = {
  READY: 'DME_READY',
  TOKEN: 'DME_TOKEN',
  SESSION_INVALID: 'DME_SESSION_INVALID',
  UNREAD: 'DME_UNREAD',
  PING: 'DME_PING',
  PONG: 'DME_PONG',
  CHAT_ACTIVE: 'DME_CHAT_ACTIVE',
  STORAGE_LOAD: 'DME_STORAGE_LOAD', // DME → fatesky: 请求加载当前账号全部存储
  STORAGE_SET: 'DME_STORAGE_SET', // DME → fatesky: 写入一个 key-value
  STORAGE_REMOVE: 'DME_STORAGE_REMOVE', // DME → fatesky: 删除一个 key
  STORAGE_CLEAR: 'DME_STORAGE_CLEAR', // DME → fatesky: 清空当前账号存储
  STORAGE_DATA: 'DME_STORAGE_DATA', // fatesky → DME: 返回存储数据（响应 LOAD + 主动推送）
  NAVIGATE: 'DME_NAVIGATE', // DME → fatesky: 请求 fatesky SPA 跳转到 path（站内链接）
  OPEN_URL: 'DME_OPEN_URL', // DME → fatesky: 请求拉起网页视图打开外部 url（iOS 外链）
  SHARE: 'DME_SHARE', // fatesky → DME: 把帖子链接交给 DME，由 DME 决定如何转发
  START_CHAT: 'DME_START_CHAT', // fatesky → DME: 请求打开/创建与某人的聊天 {did, handle?}
  // 二进制文件字节托管（KV 的 STORAGE_* 通道装不下，且 localStorage ~5MB 会反噬消息）
  // 走 fatesky 第一方 IndexedDB（per-DID 隔离），躲过 Safari ITP 对第三方 iframe IndexedDB 的清理
  BLOB_SET: 'DME_BLOB_SET', // DME → fatesky：持久化一个文件的字节 {fileId, value(base64), mimeType}
  BLOB_GET: 'DME_BLOB_GET', // DME → fatesky：请求一个文件的字节 {requestId, fileId}
  BLOB_DATA: 'DME_BLOB_DATA', // fatesky → DME：BLOB_GET 的响应 {requestId, value(base64)|null, mimeType}
  BLOB_REMOVE: 'DME_BLOB_REMOVE', // DME → fatesky：删除一个文件的字节 {fileId}
} as const

/**
 * How long to wait for the embed to send `DME_READY` before giving up.
 */
export const DME_READY_TIMEOUT_MS = 8000

/**
 * Interval between keepalive pings to the embed (4.5 minutes).
 */
export const DME_KEEPALIVE_INTERVAL_MS = 270_000

/**
 * Number of consecutive missed pongs before considering the embed dead.
 */
export const DME_KEEPALIVE_MAX_MISS = 3
