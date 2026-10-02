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
