import * as React from 'react'

import {
  DME_EMBED_ORIGIN,
  DME_EMBED_PROTOCOL,
  DME_KEEPALIVE_INTERVAL_MS,
  DME_KEEPALIVE_MAX_MISS,
  DME_MSG,
  DME_READY_TIMEOUT_MS,
} from '#/lib/dme-embed/constants'
import {
  consumeDmeShare,
  registerDmeShareFlushHandler,
  setDmeShareBridgeReady,
} from '#/lib/dme-embed/dmeShare'
import {
  clearDmeStorage,
  loadDmeStorage,
  removeDmeStorageItem,
  setDmeStorageItem,
} from '#/lib/dme-embed/dmeStorage'
import {reportDmeUnread} from '#/state/dme/useDmeUnreadCount'

/**
 * postMessage bridge between this app and the embedded DME chat iframe.
 *
 * Wire format (both directions):
 *   {protocol: 'dme-embed/v1', type: string, payload?: unknown}
 *
 * State machine:
 *   waiting ──(DME_READY + token delivered)──▶ ready ──(first DME_PONG)──▶ active
 *   waiting ──(load + 8s without DME_READY)──▶ unavailable
 *   ready|active ──(4th consecutive unanswered keepalive ping)──▶ degraded
 *
 * Security: every inbound message must pass a THREE-condition lock — exact
 * origin equality, matching `event.source`, and a matching protocol tag — or
 * it is silently dropped. Message payloads may carry session tokens, so they
 * are NEVER logged.
 */

export type DmeEmbedStatus =
  'waiting' | 'ready' | 'active' | 'unavailable' | 'degraded'

export type DmeTokenPayload = {
  did: string
  handle: string
  accessJwt: string
  refreshJwt: string
  service?: string
}

export type UseDmeEmbedBridgeOptions = {
  iframeRef: React.RefObject<HTMLIFrameElement | null>
  getToken: () => DmeTokenPayload | null
  onSessionInvalid: () => void
  /**
   * Invoked when the embed asks fatesky to route its OWN SPA to a site-relative
   * `path` (a fatesky-internal link clicked inside chat). The caller is
   * responsible for the actual navigation (e.g. react-navigation). The `path`
   * is pre-validated by `isValidNavigatePath` and is guaranteed safe to route.
   */
  onNavigate: (path: string) => void
  /**
   * Invoked when the embed asks fatesky to present an EXTERNAL `url` in a web
   * view (e.g. iOS WKWebView where `window.open` cannot spawn a context). The
   * `url` is pre-validated by `isValidExternalUrl` and is guaranteed to be an
   * `http(s)` absolute URL.
   */
  onOpenExternalUrl: (url: string) => void
}

export type UseDmeEmbedBridgeResult = {
  status: DmeEmbedStatus
  onIframeLoad: () => void
}

/**
 * Module-level postMessage target for `sendToDme`.
 *
 * Some callers (e.g. the token provider) live OUTSIDE any React tree that has
 * access to the iframe ref, so the hook registers whichever iframe instance is
 * currently mounted here, and `sendToDme` posts to it. The hook owns the
 * lifecycle: set on mount, cleared on unmount, so a stale frame can never be
 * messaged after the embed goes away. While no iframe is mounted, sends are
 * no-ops.
 */
let currentTarget: HTMLIFrameElement | null = null

/**
 * Send a message to the embedded DME iframe. Module-level on purpose: usable
 * from anywhere (no hook access required). Silently does nothing when no
 * embed is mounted. The `targetOrigin` MUST stay the exact DME origin — never
 * a wildcard — so the browser itself refuses delivery if the frame has been
 * navigated elsewhere.
 *
 * Returns whether the postMessage call was actually made. Callers that need
 * to know a token was delivered (not just that one existed) can use this to
 * avoid marking the bridge as authenticated when the frame is not reachable.
 */
export function sendToDme(type: string, payload?: unknown): boolean {
  const target = currentTarget
  if (!target) {
    if (__DEV__) {
      console.log(`[dme-bridge] sendToDme(${type}) skipped: no current target`)
    }
    return false
  }
  const cw = target.contentWindow
  if (!cw) {
    if (__DEV__) {
      console.log(
        `[dme-bridge] sendToDme(${type}) skipped: contentWindow missing`,
      )
    }
    return false
  }
  cw.postMessage(
    {protocol: DME_EMBED_PROTOCOL, type, payload},
    DME_EMBED_ORIGIN,
  )
  if (__DEV__) {
    console.log(`[dme-bridge] sendToDme(${type}) delivered`)
  }
  return true
}

/**
 * Flush any buffered "share post via DM" intent to the embed. Owned by the
 * bridge (it has `sendToDme`); registered with the dmeShare store on mount and
 * invoked (a) when the embed becomes ready and (b) immediately when a share is
 * requested while already ready. Sending is a no-op if no intent is buffered
 * or the frame is not reachable.
 */
function flushDmeShare() {
  const pending = consumeDmeShare()
  if (!pending) return
  sendToDme(DME_MSG.SHARE, pending)
}

/**
 * Validate a `DME_NAVIGATE` `path` before routing fatesky's own SPA to it.
 *
 * The path MUST be a site-relative route — never a protocol-relative
 * redirection (`//evil.com`), never a full URL that smuggles a foreign host,
 * never containing backslashes. We resolve against a fixed base origin and
 * reject anything that pulls a non-base `host` or a non-https `scheme` out of
 * the string. (`app.hukoubook.com` is fatesky's canonical host per the dme
 * link requirement; a legit site-relative path resolves back to exactly this
 * base, so a differing host means the path tried to escape it.)
 */
function isValidNavigatePath(path: unknown): path is string {
  if (typeof path !== 'string') return false
  if (!path.startsWith('/')) return false
  if (path.startsWith('//')) return false // protocol-relative escape
  if (path.includes('\\')) return false
  try {
    const resolved = new URL(path, 'https://app.hukoubook.com')
    if (resolved.protocol !== 'https:') return false
    if (resolved.host !== 'app.hukoubook.com') return false
    return true
  } catch {
    return false
  }
}

/**
 * Validate a `DME_OPEN_URL` `url` before presenting it in an external web
 * view. Only real `http(s)` absolute URLs are allowed; `javascript:`,
 * `data:`, `file:`, etc. are rejected (defense-in-depth on top of the dme-side
 * filter).
 */
function isValidExternalUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Deliver the session token to the embed. Shared by the DME_READY path and
 * the late-token recovery path so both behave identically. Returns whether a
 * token was actually available AND successfully posted to the iframe.
 */
function deliverToken(
  getToken: () => DmeTokenPayload | null,
  setStatus: (status: DmeEmbedStatus) => void,
  tokenDeliveredRef: {current: boolean},
): boolean {
  const token = getToken()
  if (!token) {
    if (__DEV__) {
      console.log('[dme-bridge] deliverToken: no token available yet')
    }
    return false
  }
  if (__DEV__) {
    console.log('[dme-bridge] deliverToken: sending DME_TOKEN', {
      did: token.did,
      handle: token.handle,
    })
  }
  const posted = sendToDme(DME_MSG.TOKEN, token)
  if (!posted) {
    // The frame is not reachable right now; leave the state machine unchanged
    // so the next render / late-token recovery effect can retry.
    return false
  }
  // Push the current account's DME storage data immediately after the token.
  // The embed needs this to initialize its chat state — without it, a fresh
  // iframe mount (account switch) would start with empty storage.
  // NOTE: token rotation (useDmeTokenProvider 60s watcher) re-sends DME_TOKEN
  // directly via sendToDme, bypassing deliverToken. That is CORRECT: same DID
  // = same storage, no need to re-push STORAGE_DATA on rotation. Only a fresh
  // handshake (iframe remount on account switch) triggers deliverToken, which
  // is the only time storage needs to be re-pushed.
  const entries = loadDmeStorage(token.did)
  sendToDme(DME_MSG.STORAGE_DATA, {entries})
  tokenDeliveredRef.current = true
  // 'ready' means: the embed is alive AND we have handed it a session.
  // Immediately follow the token with a PING liveness probe so the transition
  // to 'active' does not have to wait a full 4.5-minute keepalive interval.
  setStatus('ready')
  // The embed is now authenticated and listening: mark the share bridge ready
  // so any pending DME_SHARE intent (buffered before the handshake completed)
  // is flushed. This runs on BOTH the DME_READY path and the late-token
  // recovery path, so a share requested before auth is never lost.
  setDmeShareBridgeReady(true)
  sendToDme(DME_MSG.PING)
  return true
}

export function useDmeEmbedBridge(
  options: UseDmeEmbedBridgeOptions,
): UseDmeEmbedBridgeResult {
  const {iframeRef} = options

  const [status, setStatusState] = React.useState<DmeEmbedStatus>('waiting')

  // The message listener is registered ONCE, so its closure is frozen from
  // the first render. Everything it reads asynchronously must therefore live
  // in refs that are refreshed on every render.
  const optionsRef = React.useRef(options)
  const statusRef = React.useRef(status)
  const tokenDeliveredRef = React.useRef(false)
  const readySeenRef = React.useRef(false)
  const missesRef = React.useRef(0)
  const readyTimeoutRef = React.useRef<number | undefined>(undefined)

  // Refresh the frozen-closure mirrors after every render.
  React.useEffect(() => {
    optionsRef.current = options
    statusRef.current = status
  })

  const setStatus = (next: DmeEmbedStatus) => {
    statusRef.current = next
    setStatusState(next)
  }

  const handleDmeReady = () => {
    if (__DEV__) {
      console.log('[dme-bridge] DME_READY received')
    }
    // First DME_READY from the embed: cancel the watchdog that `onIframeLoad`
    // started — the embed came up in time.
    if (readyTimeoutRef.current !== undefined) {
      window.clearTimeout(readyTimeoutRef.current)
      readyTimeoutRef.current = undefined
    }
    readySeenRef.current = true

    // If getToken() returns null there is no session to hand over yet. Do NOT
    // send a token and do NOT leave 'waiting': the embed stays unauthenticated
    // and the late-token recovery effect (below) delivers the token as soon as
    // one exists. Reporting 'ready' here would be a lie — the embed cannot
    // chat without a token.
    deliverToken(optionsRef.current.getToken, setStatus, tokenDeliveredRef)
  }

  const handleDmePong = () => {
    // Any PONG proves liveness: reset the unanswered-ping counter.
    missesRef.current = 0
    // Promote 'ready' → 'active' only after a PONG to a token we actually
    // delivered — i.e. the embed has the session and is responding to us.
    if (tokenDeliveredRef.current && statusRef.current === 'ready') {
      setStatus('active')
    }
  }

  // Message listener. Registered exactly once; remove on unmount.
  React.useEffect(() => {
    const handler = (event: MessageEvent) => {
      // THREE-CONDITION LOCK — all three must hold or the message is dropped
      // silently. This is what makes it safe to receive tokens-adjacent
      // traffic at all:
      //   1. origin: the sender is the exact DME origin (positive equality —
      //      no allowlists, no suffix matches, no wildcard);
      //   2. source: the message came from OUR iframe's content window, not
      //      some other DME-origin tab/frame on the page;
      //   3. protocol: the envelope carries the version tag we speak.
      // Malformed or spoofed messages simply never reach the switch below.
      // NEVER log message contents here — they may carry tokens.
      const originLocked = event.origin === DME_EMBED_ORIGIN
      const sourceLocked = event.source === iframeRef.current?.contentWindow
      const protocolLocked =
        (event.data as {protocol?: unknown} | null)?.protocol ===
        DME_EMBED_PROTOCOL
      if (!originLocked || !sourceLocked || !protocolLocked) {
        return
      }

      switch (event.data.type) {
        case DME_MSG.READY: {
          handleDmeReady()
          break
        }
        case DME_MSG.SESSION_INVALID: {
          // The embed rejected our credentials; let the app react (e.g. force
          // a re-login) via the callback.
          optionsRef.current.onSessionInvalid()
          break
        }
        case DME_MSG.UNREAD: {
          const payload = event.data.payload as {count?: unknown} | null
          const count =
            typeof payload?.count === 'number' ? payload.count : null
          // A missing or non-numeric count means "dme never reported", NOT 0
          // — 0 would wipe a legacy badge for a report the embed never made.
          // Normalize NaN (typeof 'number' but not a real count) to null too.
          const safeCount = count !== null && Number.isNaN(count) ? null : count
          reportDmeUnread(safeCount)
          break
        }
        case DME_MSG.PONG: {
          handleDmePong()
          break
        }
        case DME_MSG.STORAGE_LOAD: {
          const token = optionsRef.current.getToken()
          if (token?.did) {
            const entries = loadDmeStorage(token.did)
            sendToDme(DME_MSG.STORAGE_DATA, {entries})
          }
          break
        }
        case DME_MSG.STORAGE_SET: {
          const token = optionsRef.current.getToken()
          if (!token?.did) break
          const payload = event.data.payload as {
            key?: unknown
            value?: unknown
          } | null
          if (
            typeof payload?.key === 'string' &&
            typeof payload?.value === 'string'
          ) {
            setDmeStorageItem(token.did, payload.key, payload.value)
          }
          break
        }
        case DME_MSG.STORAGE_REMOVE: {
          const token = optionsRef.current.getToken()
          if (!token?.did) break
          const payload = event.data.payload as {key?: unknown} | null
          if (typeof payload?.key === 'string') {
            removeDmeStorageItem(token.did, payload.key)
          }
          break
        }
        case DME_MSG.STORAGE_CLEAR: {
          const token = optionsRef.current.getToken()
          if (token?.did) {
            clearDmeStorage(token.did)
          }
          break
        }
        case DME_MSG.NAVIGATE: {
          // The embed clicked a fatesky-internal link and wants the host app's
          // SPA to route there. MUST keep working while the iframe is
          // display:none — the listener runs unconditionally, so no gating.
          const payload = event.data.payload as {path?: unknown} | null
          if (!isValidNavigatePath(payload?.path)) {
            if (__DEV__) {
              console.log('[dme-bridge] DME_NAVIGATE rejected: invalid path')
            }
            break
          }
          const path = payload.path
          if (__DEV__) {
            console.log('[dme-bridge] DME_NAVIGATE received', {path})
          }
          optionsRef.current.onNavigate(path)
          break
        }
        case DME_MSG.OPEN_URL: {
          // The embed clicked an external link in an environment (iOS
          // WKWebView) where it cannot spawn a browsing context itself; the
          // host app presents the URL. Desktop just opens it like any link.
          const payload = event.data.payload as {url?: unknown} | null
          if (!isValidExternalUrl(payload?.url)) {
            if (__DEV__) {
              console.log('[dme-bridge] DME_OPEN_URL rejected: invalid url')
            }
            break
          }
          const url = payload.url
          if (__DEV__) {
            console.log('[dme-bridge] DME_OPEN_URL received', {url})
          }
          optionsRef.current.onOpenExternalUrl(url)
          break
        }
      }
    }

    window.addEventListener('message', handler)
    return () => {
      window.removeEventListener('message', handler)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep the module-level send target in sync with whichever iframe instance
  // is currently rendered. Runs after every render so a ref swap (e.g. React
  // reconciler replacing the iframe node) is reflected immediately. Cleared on
  // unmount.
  React.useEffect(() => {
    currentTarget = iframeRef.current
    if (__DEV__) {
      console.log(
        '[dme-bridge] target synced',
        currentTarget ? 'frame present' : 'no frame',
      )
    }
    return () => {
      currentTarget = null
    }
  })

  // READY watchdog. `onIframeLoad` (wired by the consumer into
  // `<iframe onLoad={...}>`) starts an 8s timer; if no DME_READY arrives while
  // we are still 'waiting', the embed is 'unavailable'. Clear any previous
  // watchdog first — an iframe can fire `load` more than once (navigations,
  // bfcache restores), and stacking timers would mark a healthy embed
  // unavailable when an old timer from a previous load fires.
  const onIframeLoad = () => {
    if (__DEV__) {
      console.log('[dme-bridge] iframe onLoad fired')
    }
    // Re-sync the module-level send target: the iframe may have (re)mounted
    // after the bridge's mount effect ran, and `sendToDme` must have a live
    // target as soon as the frame loads.
    currentTarget = iframeRef.current
    if (readyTimeoutRef.current !== undefined) {
      window.clearTimeout(readyTimeoutRef.current)
    }
    readyTimeoutRef.current = window.setTimeout(() => {
      readyTimeoutRef.current = undefined
      if (statusRef.current === 'waiting') {
        if (__DEV__) {
          console.log('[dme-bridge] READY timeout, marking unavailable')
        }
        setStatus('unavailable')
      }
    }, DME_READY_TIMEOUT_MS)
  }

  // Late-token recovery. Runs after EVERY render (no dependency array): the
  // parent re-renders once a session exists, which is what re-runs this
  // effect. If the embed already announced READY but we had no token at that
  // moment, deliver it now — exactly like the READY path would have (TOKEN +
  // 'ready' + immediate PING liveness probe). React Compiler also requires
  // effects to be resumable, which a dependency-free effect is.
  React.useEffect(() => {
    if (readySeenRef.current && !tokenDeliveredRef.current) {
      deliverToken(optionsRef.current.getToken, setStatus, tokenDeliveredRef)
    }
  })

  // Keepalive. Only while the embed is authenticated ('ready'/'active'):
  // ping on an interval, count consecutive unanswered pings, and degrade to
  // 'degraded' on the (MAX_MISS + 1)th tick. Rule: 3 consecutive pings
  // unanswered → degraded — each PONG resets `missesRef` to 0, each tick with
  // no PONG increments it; when the counter has already reached MAX_MISS, the
  // 4th unanswered ping tips it over and the status drops. Degrading also
  // tears this interval down via the effect cleanup below (status leaves the
  // gated set), so a dead embed stops being pinged.
  React.useEffect(() => {
    if (status !== 'ready' && status !== 'active') {
      return
    }
    const interval = window.setInterval(() => {
      if (missesRef.current >= DME_KEEPALIVE_MAX_MISS) {
        // DME_KEEPALIVE_MAX_MISS consecutive PINGs went unanswered (a PONG
        // resets the counter) — the embed is considered dead.
        setStatus('degraded')
        return
      }
      missesRef.current += 1
      sendToDme(DME_MSG.PING)
    }, DME_KEEPALIVE_INTERVAL_MS)
    return () => {
      window.clearInterval(interval)
    }
  }, [status])

  // Full teardown on unmount: the watchdog outlives the component if load
  // never fired or READY never came.
  React.useEffect(() => {
    return () => {
      if (readyTimeoutRef.current !== undefined) {
        window.clearTimeout(readyTimeoutRef.current)
        readyTimeoutRef.current = undefined
      }
    }
  }, [])

  // Register the share-flush routine with the dmeShare store while mounted, so
  // a `requestDmeShare` from anywhere (e.g. the post share menu) can reach the
  // embed. On unmount, both detach the handler and drop the ready flag so a
  // remounted/late frame can never be messaged through a stale closure.
  React.useEffect(() => {
    registerDmeShareFlushHandler(flushDmeShare)
    return () => {
      registerDmeShareFlushHandler(null)
      setDmeShareBridgeReady(false)
    }
  }, [])

  return {status, onIframeLoad}
}
