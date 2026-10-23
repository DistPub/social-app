/**
 * Web-only override for the MessagesProvider tree.
 *
 * Expo/Metro platform resolution picks this `.web.tsx` file INSTEAD of the
 * suffix-less `index.tsx` on web builds, so `App.web.tsx`'s
 * `import {MessagesProvider} from '#/state/messages'` resolves here on web.
 *
 * The full bsky DM stack (see `index.tsx`) mounts two providers that issue
 * xrpc `chat.bsky.convo.*` requests:
 *
 * - `MessagesEventBusProvider` — starts a `MessagesEventBus` that immediately
 *   calls `chat.bsky.convo.getLog` and keeps polling it on an interval
 * - `ListConvosProvider` — runs `chat.bsky.convo.listConvos` (readState:
 *   'unread') via `useListConvosQuery`
 *
 * DME is the sole chat system on web, so nothing consumes that data here.
 * Mounting the old polling providers would keep issuing chat xrpc requests
 * for data nobody reads, so the web variant only keeps the purely in-memory
 * providers (no network) that some shared hooks still import.
 *
 * Rollback: delete this file to restore the full bsky DM provider stack on
 * web (and revert the pure-DME unread badges in LeftNav/BottomBarWeb).
 */

import type React from 'react'

import {CurrentConvoIdProvider} from '#/state/messages/current-convo-id'
import {MessageDraftsProvider} from './message-drafts'

export function MessagesProvider({children}: {children: React.ReactNode}) {
  return (
    <CurrentConvoIdProvider>
      <MessageDraftsProvider>{children}</MessageDraftsProvider>
    </CurrentConvoIdProvider>
  )
}
