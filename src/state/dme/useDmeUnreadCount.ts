import {useSyncExternalStore} from 'react'

/**
 * Module-level in-memory store for DME (embedded encrypted chat) unread
 * counts. Pure in-memory by design — no TanStack Query, no persisted storage,
 * no network. Logout / account-switch reset is the CALLER's job (call
 * `reportDmeUnread(null)`).
 */

type DmeUnreadState = {
  dmeUnread: number | null
  hasNew: boolean
}

const subscribers = new Set<() => void>()

// Reference-stable snapshot. Only reassigned inside `reportDmeUnread` when the
// value actually changes. `useSyncExternalStore` requires that repeated calls
// to the snapshot function return the same reference when nothing changed —
// otherwise React loops forever.
let snapshot: DmeUnreadState = {dmeUnread: null, hasNew: false}

export function reportDmeUnread(count: number | null): void {
  const hasNew = count !== null && count > 0
  const prev = snapshot
  if (prev.dmeUnread === count && prev.hasNew === hasNew) {
    return
  }
  snapshot = {dmeUnread: count, hasNew}
  subscribers.forEach(fn => fn())
}

export function subscribeDmeUnread(fn: () => void): () => void {
  subscribers.add(fn)
  return () => {
    subscribers.delete(fn)
  }
}

export function getDmeUnreadSnapshot(): DmeUnreadState {
  return snapshot
}

export function useDmeUnreadCount(): DmeUnreadState {
  return useSyncExternalStore(
    subscribeDmeUnread,
    getDmeUnreadSnapshot,
    getDmeUnreadSnapshot,
  )
}
