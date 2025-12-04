import {type Insets, Platform} from 'react-native'
import {type AppBskyActorDefs} from '@atproto/api'

import {type ProxyHeaderValue} from '#/state/session/agent'
import {BLUESKY_PROXY_DID, CHAT_PROXY_DID} from '#/env'

export const LOCAL_DEV_SERVICE =
  Platform.OS === 'android' ? 'http://10.0.2.2:2583' : 'http://localhost:2583'
export const STAGING_SERVICE = 'https://staging.bsky.dev'
export const BSKY_SERVICE = 'https://bsky.social'
export const BSKY_SERVICE_DID = 'did:web:bsky.social'
export const PUBLIC_BSKY_SERVICE = 'https://fatesky.hukoubook.com'
export const DEFAULT_SERVICE = 'https://network.hukoubook.com'
const HELP_DESK_LANG = 'en-us'
export const HELP_DESK_URL = `https://blueskyweb.zendesk.com/hc/${HELP_DESK_LANG}`
export const EMBED_SERVICE = 'https://embed.bsky.app'
export const EMBED_SCRIPT = `${EMBED_SERVICE}/static/embed.js`
export const BSKY_DOWNLOAD_URL = 'https://bsky.app/download'
export const STARTER_PACK_MAX_SIZE = 150

// HACK
// Yes, this is exactly what it looks like. It's a hard-coded constant
// reflecting the number of new users in the last week. We don't have
// time to add a route to the servers for this so we're just going to hard
// code and update this number with each release until we can get the
// server route done.
// -prf
export const JOINED_THIS_WEEK = 560000 // estimate as of 12/18/24

export const DISCOVER_DEBUG_DIDS: Record<string, true> = {
  'did:plc:oisofpd7lj26yvgiivf3lxsi': true, // hailey.at
  'did:plc:p2cp5gopk7mgjegy6wadk3ep': true, // samuel.bsky.team
  'did:plc:ragtjsm2j2vknwkz3zp4oxrd': true, // pfrazee.com
  'did:plc:vpkhqolt662uhesyj6nxm7ys': true, // why.bsky.team
  'did:plc:3jpt2mvvsumj2r7eqk4gzzjz': true, // esb.lol
  'did:plc:vjug55kidv6sye7ykr5faxxn': true, // emilyliu.me
  'did:plc:tgqseeot47ymot4zro244fj3': true, // iwsmith.bsky.social
  'did:plc:2dzyut5lxna5ljiaasgeuffz': true, // darrin.bsky.team
}

const BASE_FEEDBACK_FORM_URL = `${HELP_DESK_URL}/requests/new`
export function FEEDBACK_FORM_URL({
  email,
  handle,
}: {
  email?: string
  handle?: string
}): string {
  let str = BASE_FEEDBACK_FORM_URL
  if (email) {
    str += `?tf_anonymous_requester_email=${encodeURIComponent(email)}`
    if (handle) {
      str += `&tf_17205412673421=${encodeURIComponent(handle)}`
    }
  }
  return str
}

export const MAX_DISPLAY_NAME = 64
export const MAX_DESCRIPTION = 256

export const MAX_GRAPHEME_LENGTH = 300

export const MAX_DM_GRAPHEME_LENGTH = 1000

// Recommended is 100 per: https://www.w3.org/WAI/GL/WCAG20/tests/test3.html
// but increasing limit per user feedback
export const MAX_ALT_TEXT = 2000

export const MAX_REPORT_REASON_GRAPHEME_LENGTH = 2000

export function IS_TEST_USER(handle?: string) {
  return handle && handle?.endsWith('.test')
}

export function IS_PROD_SERVICE(url?: string) {
  return url && url !== STAGING_SERVICE && !url.startsWith(LOCAL_DEV_SERVICE)
}

export const PROD_DEFAULT_FEED = (rkey: string) =>
  `at://did:web:board.hukoubook.com/app.bsky.feed.generator/china-good-voice`

export const STAGING_DEFAULT_FEED = (rkey: string) =>
  `at://did:plc:yofh3kx63drvfljkibw5zuxo/app.bsky.feed.generator/${rkey}`

export const PROD_FEEDS = [
  `feedgen|${PROD_DEFAULT_FEED('whats-hot')}`,
  `feedgen|${PROD_DEFAULT_FEED('thevids')}`,
]

export const STAGING_FEEDS = [
  `feedgen|${STAGING_DEFAULT_FEED('whats-hot')}`,
  `feedgen|${STAGING_DEFAULT_FEED('thevids')}`,
]

export const POST_IMG_MAX = {
  width: 2000,
  height: 2000,
  size: 1000000,
}

export const STAGING_LINK_META_PROXY =
  'https://cardyb.staging.bsky.dev/v1/extract?url='

export const PROD_LINK_META_PROXY = 'https://fatesky-cdn.hukoubook.com/v1/extract?url='

export function LINK_META_PROXY(serviceUrl: string) {
  if (IS_PROD_SERVICE(serviceUrl)) {
    return PROD_LINK_META_PROXY
  }

  return STAGING_LINK_META_PROXY
}

export const STATUS_PAGE_URL = 'https://status.bsky.app/'

// Hitslop constants
export const createHitslop = (size: number): Insets => ({
  top: size,
  left: size,
  bottom: size,
  right: size,
})
export const HITSLOP_10 = createHitslop(10)
export const HITSLOP_20 = createHitslop(20)
export const HITSLOP_30 = createHitslop(30)
export const LANG_DROPDOWN_HITSLOP = {top: 10, bottom: 10, left: 4, right: 4}
export const BACK_HITSLOP = HITSLOP_30
export const MAX_POST_LINES = 25

export const BSKY_APP_ACCOUNT_DID = 'did:plc:z72i7hdynmk6r22z27h6tvur'

export const BSKY_FEED_OWNER_DIDS = [
  BSKY_APP_ACCOUNT_DID,
  'did:plc:vpkhqolt662uhesyj6nxm7ys',
  'did:plc:q6gjnaw2blty4crticxkmujt',
]

export const DISCOVER_FEED_URI =
  'at://did:web:board.hukoubook.com/app.bsky.feed.generator/china-good-voice'
export const VIDEO_FEED_URI =
  'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/thevids'
export const STAGING_VIDEO_FEED_URI =
  'at://did:plc:yofh3kx63drvfljkibw5zuxo/app.bsky.feed.generator/thevids'
export const VIDEO_FEED_URIS = [VIDEO_FEED_URI, STAGING_VIDEO_FEED_URI]
export const DISCOVER_SAVED_FEED = {
  type: 'feed',
  value: DISCOVER_FEED_URI,
  pinned: true,
}
export const TIMELINE_SAVED_FEED = {
  type: 'timeline',
  value: 'following',
  pinned: true,
}
export const VIDEO_SAVED_FEED = {
  type: 'feed',
  value: VIDEO_FEED_URI,
  pinned: true,
}

export const RECOMMENDED_SAVED_FEEDS: Pick<
  AppBskyActorDefs.SavedFeed,
  'type' | 'value' | 'pinned'
>[] = [DISCOVER_SAVED_FEED, TIMELINE_SAVED_FEED]

export const KNOWN_SHUTDOWN_FEEDS = [
  'at://did:plc:wqowuobffl66jv3kpsvo7ak4/app.bsky.feed.generator/the-algorithm', // for you by skygaze
]

export const GIF_SERVICE = 'https://fatesky-cdn.hukoubook.com'

export const GIF_SEARCH = (params: string) =>
  `${GIF_SERVICE}/tenor/v2/search?${params}`
export const GIF_FEATURED = (params: string) =>
  `${GIF_SERVICE}/tenor/v2/featured?${params}`

export const MAX_LABELERS = 20

export const VIDEO_SERVICE = 'https://fatesky.hukoubook.com'
export const VIDEO_SERVICE_DID = 'did:web:fatesky.hukoubook.com'

export const VIDEO_MAX_DURATION_MS = 3 * 60 * 1000 // 3 minutes in milliseconds
/**
 * Maximum size of a video in megabytes, _not_ mebibytes. Backend uses
 * ISO megabytes.
 */
export const VIDEO_MAX_SIZE = 1000 * 1000 * 100 // 100mb

export const SUPPORTED_MIME_TYPES = [
  'video/mp4',
  'video/mpeg',
  'video/webm',
  'video/quicktime',
  'image/gif',
] as const

export type SupportedMimeTypes = (typeof SUPPORTED_MIME_TYPES)[number]

export const EMOJI_REACTION_LIMIT = 5

export const urls = {
  website: {
    blog: {
      initialVerificationAnnouncement: `https://bsky.social/about/blog/04-21-2025-verification`,
    },
  },
}

export const PUBLIC_APPVIEW = 'https://api.bsky.app'
export const PUBLIC_APPVIEW_DID = 'did:web:api.bsky.app'
export const PUBLIC_STAGING_APPVIEW_DID = 'did:web:api.staging.bsky.dev'

export const DEV_ENV_APPVIEW = `http://localhost:2584` // always the same

// temp hack for e2e - esb
export let BLUESKY_PROXY_HEADER: ProxyHeaderValue = `${BLUESKY_PROXY_DID}#bsky_appview`
export function setBlueskyProxyHeader(header: ProxyHeaderValue) {
  BLUESKY_PROXY_HEADER = header
}

export const FATESKY_SUPPORT_XRPC_LXM = [
  'com.atproto.identity.resolveDid',
  'app.bsky.actor.getProfile',
  'com.atproto.identity.resolveHandle',
  'com.atproto.label.queryLabels',
  'com.atproto.repo.getRecord',
  'com.atproto.repo.listRecords',
  'app.bsky.unspecced.getPostThreadV2',
  'app.bsky.feed.getFeed',
  'app.bsky.feed.getTimeline',
  'app.bsky.graph.getLists',
  "app.bsky.graph.getList",
  "app.bsky.feed.getListFeed",
  "app.bsky.actor.getProfiles",
  "app.bsky.feed.getPostThread",
  'app.bsky.feed.getLikes',
  'app.bsky.feed.getRepostedBy',
  'app.bsky.feed.getQuotes',
  'app.bsky.graph.getFollowers',
  'app.bsky.graph.getFollows',
  'app.bsky.feed.getActorLikes',
  'app.bsky.graph.getActorStarterPacks',
  'app.bsky.graph.getStarterPack',
  'app.bsky.feed.getActorFeeds',
  'app.bsky.feed.getAuthorFeed',
  'app.bsky.video.getUploadLimits',
  'app.bsky.video.getJobStatus',
  'app.bsky.feed.getFeedGenerators',
  '_health',
  'app.bsky.labeler.getServices',
  'app.bsky.unspecced.getConfig',
  'app.bsky.actor.searchActorsTypeahead',
  'app.bsky.actor.searchActors',
  'app.bsky.unspecced.getPopularFeedGenerators',
]
export function useFateskyAppview(...args) {
  let req = new globalThis.Request(...args)
  const url = new globalThis.URL(req.url)
  if (url.pathname.startsWith('/xrpc/')) {
    const lxm = url.pathname.slice('/xrpc/'.length)
    if (FATESKY_SUPPORT_XRPC_LXM.includes(lxm)) {
      req.headers.set('atproto-proxy', 'did:web:fatesky.hukoubook.com#fatesky_appview')

      // use fake(discover) feed param for logined user
      // because PDS will leak feed param to bsky appView
      if (lxm === 'app.bsky.feed.getFeed' && req.headers.get('authorization')) {
        url.searchParams.set('xfeed', url.searchParams.get('feed') as string)
        url.searchParams.set('feed', 'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot')
        req = new globalThis.Request(url, req)
      }
    }
  }
  return req
}

export const BLUESKY_SERVICE_HEADERS = {
  'atproto-proxy': BLUESKY_PROXY_HEADER,
}

export const DM_SERVICE_HEADERS = {
  'atproto-proxy': `${CHAT_PROXY_DID}#bsky_chat`,
}

export const webLinks = {
  tos: `https://bsky.social/about/support/tos`,
  privacy: `https://bsky.social/about/support/privacy-policy`,
  community: `https://bsky.social/about/support/community-guidelines`,
  communityDeprecated: `https://bsky.social/about/support/community-guidelines-deprecated`,
}
