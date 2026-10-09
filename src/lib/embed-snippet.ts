import {type AppBskyActorDefs, type AppBskyFeedPost, AtUri} from '@atproto/api'

import {EMBED_SCRIPT} from '#/lib/constants'
import {toShareUrl} from '#/lib/strings/url-helpers'

/**
 * Builds the `<blockquote class="bluesky-embed">…</blockquote><script>` HTML
 * snippet that embeds a post on a third-party website.
 *
 * Single source of truth shared by the "Embed post" dialog and the web
 * "send via direct message" flow (which hands this snippet to the DME embed
 * so it can attach a rich embed to the shared message).
 *
 * NOTE: keep the output byte-compatible with the bskyembed implementation in
 * `bskyembed/src/screens/landing.tsx`.
 *
 * `colorMode` is the `data-bluesky-embed-color-mode` attribute
 * (`'system' | 'light' | 'dark'`).
 */
export function buildEmbedSnippet({
  postAuthor,
  postCid,
  postUri,
  record,
  timestamp,
  colorMode = 'system',
  formattedTimestamp,
}: {
  postAuthor: AppBskyActorDefs.ProfileViewBasic
  postCid: string
  postUri: string
  record: AppBskyFeedPost.Record
  /** ISO timestamp of the post (used only when `formattedTimestamp` is absent). */
  timestamp: string
  colorMode?: 'system' | 'light' | 'dark'
  /**
   * Pre-formatted, localized date label for the post. Callers that have an
   * i18n instance SHOULD pass `niceDate(i18n, timestamp)` here; when omitted we
   * fall back to the raw timestamp.
   */
  formattedTimestamp?: string
}): string {
  function toEmbedUrl(href: string) {
    return toShareUrl(href) + '?ref_src=embed'
  }

  const lang = record.langs && record.langs.length > 0 ? record.langs[0] : ''
  const profileHref = toEmbedUrl(['/profile', postAuthor.did].join('/'))
  const urip = new AtUri(postUri)
  const href = toEmbedUrl(
    ['/profile', postAuthor.did, 'post', urip.rkey].join('/'),
  )
  const dateLabel = formattedTimestamp ?? timestamp

  // x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x
  // DO NOT ADD ANY NEW INTERPOLATIONS BELOW WITHOUT ESCAPING THEM!
  // Also, keep this code synced with the bskyembed code in landing.tsx.
  // x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x
  return `<blockquote class="bluesky-embed" data-bluesky-uri="${escapeHtml(
    postUri,
  )}" data-bluesky-cid="${escapeHtml(
    postCid,
  )}" data-bluesky-embed-color-mode="${escapeHtml(
    colorMode,
  )}"><p lang="${escapeHtml(lang)}">${escapeHtml(record.text)}${
    record.embed
      ? `<br><br><a href="${escapeHtml(href)}">[image or embed]</a>`
      : ''
  }</p>&mdash; ${escapeHtml(
    postAuthor.displayName || postAuthor.handle,
  )} (<a href="${escapeHtml(profileHref)}">@${escapeHtml(
    postAuthor.handle,
  )}</a>) <a href="${escapeHtml(href)}">${escapeHtml(
    dateLabel,
  )}</a></blockquote><script async src="${EMBED_SCRIPT}" charset="utf-8"></script>`
}

/**
 * Based on a snippet of code from React, which itself was based on the escape-html library.
 * Copyright (c) Meta Platforms, Inc. and affiliates
 * Copyright (c) 2012-2013 TJ Holowaychuk
 * Copyright (c) 2015 Andreas Lubbe
 * Copyright (c) 2015 Tiancheng "Timothy" Gu
 * Licensed as MIT.
 */
const matchHtmlRegExp = /["'&<>]/
function escapeHtml(string: string) {
  const str = String(string)
  const match = matchHtmlRegExp.exec(str)
  if (!match) {
    return str
  }
  let escape
  let html = ''
  let index
  let lastIndex = 0
  for (index = match.index; index < str.length; index++) {
    switch (str.charCodeAt(index)) {
      case 34: // "
        escape = '&quot;'
        break
      case 38: // &
        escape = '&amp;'
        break
      case 39: // '
        escape = '&#x27;'
        break
      case 60: // <
        escape = '&lt;'
        break
      case 62: // >
        escape = '&gt;'
        break
      default:
        continue
    }
    if (lastIndex !== index) {
      html += str.slice(lastIndex, index)
    }
    lastIndex = index + 1
    html += escape
  }
  return lastIndex !== index ? html + str.slice(lastIndex, index) : html
}
