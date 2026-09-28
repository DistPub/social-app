import {useEffect, useRef} from 'react'

import {DME_MSG} from '#/lib/dme-embed/constants'
import {useAgent, useSession} from '#/state/session'

/**
 * How often to check whether the app's own session refresher (~30s cycle) has
 * rotated `accessJwt`, so a fresh token can be pushed to the embed. 60s gives
 * every rotation at least one check window.
 */
const TOKEN_CHECK_INTERVAL_MS = 60_000

export type DmeTokenPayload = {
  did: string
  handle: string
  accessJwt: string
  refreshJwt: string
  service?: string
}

export type UseDmeTokenProviderOptions = {
  /**
   * Injected, not imported: keeps this hook decoupled from the iframe layer
   * (and testable without one). The bridge module owns the real sender.
   */
  sendToDme: (type: string, payload?: unknown) => void
}

export type UseDmeTokenProviderResult = {
  /**
   * Reads the CURRENT session at call time. Returns null when logged out or
   * the session has not been initialized yet. Pure accessor — never sends
   * anything itself; the consumer decides when to hand the token over.
   */
  getToken: () => DmeTokenPayload | null
  /**
   * Called by the bridge when the embed reports DME_SESSION_INVALID. Forces a
   * token refresh and re-sends the fresh token on success.
   */
  onSessionInvalid: () => void
}

/**
 * Short fingerprint of an access token: first 4 chars + last 4 chars + length.
 * Enough to catch any real rotation, while carrying zero leak risk — it lives
 * only in an interval closure variable, never in state, logs, or DevTools.
 */
function fingerprintToken(accessJwt: string | undefined): string {
  if (!accessJwt) return ''
  return `${accessJwt.slice(0, 4)}:${accessJwt.slice(-4)}:${accessJwt.length}`
}

/**
 * Supplies session tokens to the DME embed and manages their lifecycle.
 * Fatesky is the ONLY session refresher (the embed never refreshes on its
 * own). Two lifecycle duties live here:
 *
 * (a) A 60s watcher compares a compact `accessJwt` fingerprint; when the
 *     app's periodic refresh cycle has rotated the token, the fresh payload
 *     is re-sent as DME_TOKEN.
 * (b) `onSessionInvalid` (invoked when the embed rejects our credentials)
 *     forces a refresh and re-sends the fresh token on success.
 *
 * The full JWTs never enter React state, storage, or logs — `getToken` reads
 * them from the live agent on demand.
 */
export function useDmeTokenProvider(
  options: UseDmeTokenProviderOptions,
): UseDmeTokenProviderResult {
  const agent = useAgent()
  const {currentAccount} = useSession()
  const {sendToDme} = options

  // Frozen-closure mirrors, refreshed after every render (same pattern as
  // useDmeEmbedBridge): the interval callback and the public accessors must
  // always see the CURRENT agent/account/sender without re-registering.
  const agentRef = useRef(agent)
  const currentAccountRef = useRef(currentAccount)
  const sendToDmeRef = useRef(sendToDme)

  useEffect(() => {
    agentRef.current = agent
    currentAccountRef.current = currentAccount
    sendToDmeRef.current = sendToDme
  })

  const getToken = (): DmeTokenPayload | null => {
    const session = agentRef.current.session
    if (!session) return null
    return {
      did: session.did,
      handle: session.handle,
      accessJwt: session.accessJwt,
      refreshJwt: session.refreshJwt,
      service: currentAccountRef.current?.service,
    }
  }

  const onSessionInvalid = () => {
    const currentAgent = agentRef.current
    // No active session → nothing to refresh. The embed stays degraded and
    // may send another SESSION_INVALID later.
    if (!currentAgent.session) return
    // Fire-and-forget: the callback itself stays synchronous so the bridge's
    // message handler never awaits. NOTE: refreshSession() lives on
    // CredentialSession (the agent's sessionManager), not on BskyAgent —
    // same call shape as SignupQueued.tsx.
    currentAgent.sessionManager
      .refreshSession()
      .then(() => {
        sendToDmeRef.current(DME_MSG.TOKEN, getToken())
      })
      .catch(() => {
        // Refresh failed. No further action: the embed is already showing a
        // degraded/offline experience, or it will report SESSION_INVALID
        // again later.
      })
  }

  // Token rotation watcher. Runs only while this hook is mounted — i.e. only
  // in the web shell context where the DME embed (and its bridge target)
  // exists — and is cleared on unmount. The baseline fingerprint is taken at
  // mount, so a tick sends only when the token actually CHANGED; first
  // delivery is the bridge's READY / late-token-recovery path's job.
  useEffect(() => {
    let lastFingerprint = fingerprintToken(getToken()?.accessJwt)
    const interval = window.setInterval(() => {
      const token = getToken()
      const fingerprint = fingerprintToken(token?.accessJwt)
      if (fingerprint && fingerprint !== lastFingerprint) {
        lastFingerprint = fingerprint
        sendToDmeRef.current(DME_MSG.TOKEN, token)
      }
    }, TOKEN_CHECK_INTERVAL_MS)
    return () => {
      window.clearInterval(interval)
    }
  }, [])

  return {getToken, onSessionInvalid}
}
