/**
 * Module-level "pending start chat" buffer for the DME (embedded encrypted
 * chat) "start a chat from a profile page" feature.
 *
 * When the user taps the chat button on someone's profile (web), fatesky
 * switches to the /messages route and tells the embed to open (or create) a
 * conversation with that user via `DME_START_CHAT`. The embed is keep-mounted
 * but may not yet be authenticated (no `DME_READY` handshake yet, e.g. the
 * user never visited /messages). To avoid silently dropping the intent, we
 * buffer the LATEST requested start-chat here and let the bridge flush it
 * once the embed is ready. Mirrors the module-level store pattern used by
 * `dmeShare` (`requestDmeShare`).
 *
 * Single-slot by design: if the user taps the chat button on several profiles
 * in a row, only the most recent intent survives — we never queue up multiple
 * start-chat requests.
 */

export type DmeStartChatPayload = {
  /** DID of the user to open (or create) a conversation with. */
  did: string
  /**
   * Current handle of the user, for display purposes on the DME side.
   * Optional — DME must not rely on it being present.
   */
  handle?: string
}

let pendingStartChat: DmeStartChatPayload | null = null

/**
 * Whether the embed has completed its READY handshake (token delivered) and
 * is therefore listening for `DME_START_CHAT`. Set by the bridge via
 * `setDmeStartChatBridgeReady`; read by `requestDmeStartChat` to decide
 * whether to flush immediately or buffer.
 */
let bridgeReady = false

/**
 * The flush routine, supplied by the bridge (it owns `sendToDme`). Registered
 * on mount, nulled on unmount so a stale frame can never be messaged.
 */
let flushHandler: (() => void) | null = null

/**
 * Request that the embed open (or create) a conversation with `payload.did`.
 *
 * If the embed is already ready, flush immediately. Otherwise the intent is
 * buffered and flushed automatically once the bridge reports ready — so an
 * intent requested before the handshake completes is never lost.
 */
export function requestDmeStartChat(payload: DmeStartChatPayload): void {
  pendingStartChat = payload
  if (bridgeReady) {
    flushHandler?.()
  }
}

/**
 * Take and clear the buffered start-chat intent (if any). Called by the
 * bridge's flush routine; returns `null` when there is nothing pending.
 */
export function consumeDmeStartChat(): DmeStartChatPayload | null {
  const pending = pendingStartChat
  pendingStartChat = null
  return pending
}

/**
 * Called by the bridge when the embed transitions into/out of the ready
 * (authenticated) state. On becoming ready, any buffered intent is flushed.
 */
export function setDmeStartChatBridgeReady(ready: boolean): void {
  bridgeReady = ready
  if (ready) {
    flushHandler?.()
  }
}

/**
 * Register (or clear, with `null`) the flush routine owned by the bridge.
 */
export function registerDmeStartChatFlushHandler(
  handler: (() => void) | null,
): void {
  flushHandler = handler
}
