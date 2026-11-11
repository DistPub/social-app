import {useSyncExternalStore} from 'react'

/**
 * Module-level in-memory store for DME (embedded encrypted chat)
 * "action needed" reports. DME sends `DME_ACTION_NEEDED` when at least one
 * conversation carries an anomaly banner (sibling-rotated / forked /
 * desynced) that needs a recovery action performed INSIDE the embed — fatesky
 * only surfaces a marker on the /messages entry points to bring the user in;
 * it does not distinguish anomaly kinds and never replies.
 *
 * Pure in-memory by design — no TanStack Query, no persisted storage, no
 * network. DME re-reports the authoritative state on every iframe load, so
 * nothing needs to survive a refresh. Logout / account-switch reset is the
 * CALLER's job (call `resetDmeActionNeeded()`).
 */

type DmeActionNeededState = {
  /** true = at least one conversation needs a recovery action inside DME */
  actionNeeded: boolean
  /** how many conversations need action (0 when `actionNeeded` is false) */
  count: number
}

const subscribers = new Set<() => void>()

// Reference-stable snapshot. Only reassigned inside `reportDmeActionNeeded`
// when the value actually changes. `useSyncExternalStore` requires that
// repeated calls to the snapshot function return the same reference when
// nothing changed — otherwise React loops forever.
let snapshot: DmeActionNeededState = {actionNeeded: false, count: 0}

export function reportDmeActionNeeded(needed: boolean, count: number): void {
  // `needed=false` implies count=0 per protocol; defensively clamp whatever
  // arrives so the store can never hold a negative or fractional count.
  const safeCount = needed && count > 0 ? Math.floor(count) : 0
  if (snapshot.actionNeeded === needed && snapshot.count === safeCount) {
    return
  }
  snapshot = {actionNeeded: needed, count: safeCount}
  subscribers.forEach(fn => fn())
}

/**
 * Clear the marker. Used on account switch / logout — same lifecycle as
 * `reportDmeUnread(null)`.
 */
export function resetDmeActionNeeded(): void {
  reportDmeActionNeeded(false, 0)
}

export function subscribeDmeActionNeeded(fn: () => void): () => void {
  subscribers.add(fn)
  return () => {
    subscribers.delete(fn)
  }
}

export function getDmeActionNeededSnapshot(): DmeActionNeededState {
  return snapshot
}

export function useDmeActionNeeded(): DmeActionNeededState {
  return useSyncExternalStore(
    subscribeDmeActionNeeded,
    getDmeActionNeededSnapshot,
    getDmeActionNeededSnapshot,
  )
}
