/**
 * Module-level "pending share" buffer for the DME (embedded encrypted chat)
 * "share post via direct message" feature.
 *
 * When the user clicks "Send via direct message" on web, fatesky switches to
 * the /messages route and hands the post link to the embed via `DME_SHARE`.
 * The embed is keep-mounted but may not yet be authenticated (no `DME_READY`
 * handshake yet, e.g. the user never visited /messages). To avoid silently
 * dropping the share, we buffer the LATEST requested share here and let the
 * bridge flush it once the embed is ready. Mirrors the module-level store
 * pattern used by `useDmeUnreadCount` (`reportDmeUnread`).
 *
 * Single-slot by design: if the user clicks "Send via direct message" on
 * several posts in a row, only the most recent intent survives — we never
 * queue up multiple shares.
 */

export type DmeSharePayload = {
  /** AT URI of the post, e.g. `at://did:plc:xxx/app.bsky.feed.post/yyy`. */
  uri: string
  /** Shareable web URL of the post, e.g. `https://app.hukoubook.com/...`. */
  url: string
  /**
   * HTML embed snippet for the post (the same `<blockquote
   * class="bluesky-embed">…</blockquote><script …>` markup offered by the
   * "Embed post" dialog), so the embed can render a rich post card when the
   * message is forwarded. See `#/lib/embed-snippet`.
   */
  html: string
}

let pendingShare: DmeSharePayload | null = null

/**
 * Whether the embed has completed its READY handshake (token delivered) and
 * is therefore listening for `DME_SHARE`. Set by the bridge via
 * `setDmeShareBridgeReady`; read by `requestDmeShare` to decide whether to
 * flush immediately or buffer.
 */
let bridgeReady = false

/**
 * The flush routine, supplied by the bridge (it owns `sendToDme`). Registered
 * on mount, nulled on unmount so a stale frame can never be messaged.
 */
let flushHandler: (() => void) | null = null

/**
 * Request that the embed receive a share intent for `payload`.
 *
 * If the embed is already ready, flush immediately. Otherwise the intent is
 * buffered and flushed automatically once the bridge reports ready — so a
 * share requested before the handshake completes is never lost.
 */
export function requestDmeShare(payload: DmeSharePayload): void {
  pendingShare = payload
  if (bridgeReady) {
    flushHandler?.()
  }
}

/**
 * Take and clear the buffered share (if any). Called by the bridge's flush
 * routine; returns `null` when there is nothing pending.
 */
export function consumeDmeShare(): DmeSharePayload | null {
  const pending = pendingShare
  pendingShare = null
  return pending
}

/**
 * Called by the bridge when the embed transitions into/out of the ready
 * (authenticated) state. On becoming ready, any buffered share is flushed.
 */
export function setDmeShareBridgeReady(ready: boolean): void {
  bridgeReady = ready
  if (ready) {
    flushHandler?.()
  }
}

/**
 * Register (or clear, with `null`) the flush routine owned by the bridge.
 */
export function registerDmeShareFlushHandler(
  handler: (() => void) | null,
): void {
  flushHandler = handler
}
