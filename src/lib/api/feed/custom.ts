import {
  type AppBskyFeedDefs,
  type AppBskyFeedGetFeed as GetCustomFeed,
  BskyAgent,
  jsonStringToLex,
} from '@atproto/api'

import {
  getAppLanguageAsContentLanguage,
  getContentLanguages,
} from '#/state/preferences/languages'
import {type FeedAPI, type FeedAPIResponse} from './types'
import {createFateskyTopicsHeader} from './utils'

export const feedDidCache: any = {}
const didTokenCache: any = {}
export class CustomFeedAPI implements FeedAPI {
  agent: BskyAgent
  params: GetCustomFeed.QueryParams
  userInterests?: string

  constructor({
    agent,
    feedParams,
    userInterests,
  }: {
    agent: BskyAgent
    feedParams: GetCustomFeed.QueryParams
    userInterests?: string
  }) {
    this.agent = agent
    this.params = feedParams
    this.userInterests = userInterests
  }

  async peekLatest(): Promise<AppBskyFeedDefs.FeedViewPost> {
    if (this.agent.did) {
      const res = await this.getFeedWithFakeTopics(undefined, 1)
      return res.data.feed[0]
    }
    const contentLangs = getContentLanguages().join(',')
    const res = await this.agent.app.bsky.feed.getFeed(
      {
        ...this.params,
        limit: 1,
      },
      {headers: {'Accept-Language': contentLangs}},
    )
    return res.data.feed[0]
  }

  async getFeedWithFakeTopics(cursor: string|undefined, limit: number) {
    const contentLangs = getContentLanguages().join(',')
    const agent = this.agent

    // get feed service did
    if (!feedDidCache.hasOwnProperty(this.params.feed)) {
      const generatorRes = await agent.app.bsky.feed.getFeedGenerators({
        feeds: [this.params.feed]
      })
      if (!generatorRes.success || generatorRes.data.feeds.length === 0) {
        throw Error('get feed generator failed')
      }
      feedDidCache[this.params.feed] = generatorRes.data.feeds[0].did
    }
    const feedServiceDid = feedDidCache[this.params.feed]

    // get token
    const unixTimeInSeconds = Math.floor(Date.now() / 1000);
    if (((didTokenCache[feedServiceDid]?.exp ?? 0) - 120) < unixTimeInSeconds) {
      const exp = unixTimeInSeconds + 3600
      const authRes = await agent.com.atproto.server.getServiceAuth({
        aud: feedServiceDid,
        lxm: 'app.bsky.feed.getFeedSkeleton',
        exp
      })
      if (!authRes.success) {
        throw Error('get service auth failed')
      }
      didTokenCache[feedServiceDid] = { token: authRes.data.token, exp }
    }
    const token = didTokenCache[feedServiceDid].token

    // fetch feed
    const params = {
      ...this.params,
      cursor,
      limit,
    }
    const headers = {
      ...createFateskyTopicsHeader(token, this.userInterests),
      'Accept-Language': contentLangs,
    }
    return this.agent.app.bsky.feed.getFeed(params, { headers })
  }

  async fetch({
    cursor,
    limit,
  }: {
    cursor: string | undefined
    limit: number
  }): Promise<FeedAPIResponse> {
    const agent = this.agent
    let res;

    if (agent.did) {
      try {
        res = await this.getFeedWithFakeTopics(cursor, limit)
      } catch(error) {
        return {
          feed: [],
        }
      }
    } else {
      res = await loggedOutFetch({ ...this.params, cursor, limit })
    }
    if (res.success) {
      // NOTE
      // some custom feeds fail to enforce the pagination limit
      // so we manually truncate here
      // -prf
      if (res.data.feed.length > limit) {
        res.data.feed = res.data.feed.slice(0, limit)
      }
      return {
        cursor: res.data.feed.length ? res.data.cursor : undefined,
        feed: res.data.feed,
      }
    }
    return {
      feed: [],
    }
  }
}

// HACK
// we want feeds to give language-specific results immediately when a
// logged-out user changes their language. this comes with two problems:
// 1. not all languages have content, and
// 2. our public caching layer isnt correctly busting against the accept-language header
// for now we handle both of these with a manual workaround
// -prf
async function loggedOutFetch({
  feed,
  limit,
  cursor,
}: {
  feed: string
  limit: number
  cursor?: string
}) {
  let contentLangs = getAppLanguageAsContentLanguage()

  /**
   * Copied from our root `Agent` class
   * @see https://github.com/bluesky-social/atproto/blob/60df3fc652b00cdff71dd9235d98a7a4bb828f05/packages/api/src/agent.ts#L120
   */
  const labelersHeader = {
    'atproto-accept-labelers': BskyAgent.appLabelers
      .map(l => `${l};redact`)
      .join(', '),
  }

  // manually construct fetch call so we can add the `lang` cache-busting param
  let res = await fetch(
    `https://fatesky.hukoubook.com/xrpc/app.bsky.feed.getFeed?feed=${feed}${
      cursor ? `&cursor=${cursor}` : ''
    }&limit=${limit}&lang=${contentLangs}`,
    {
      method: 'GET',
      headers: {'Accept-Language': contentLangs, ...labelersHeader},
    },
  )
  let data = res.ok
    ? (jsonStringToLex(await res.text()) as GetCustomFeed.OutputSchema)
    : null
  if (data?.feed?.length) {
    return {
      success: true,
      data,
    }
  }

  // no data, try again with language headers removed
  res = await fetch(
    `https://fatesky.hukoubook.com/xrpc/app.bsky.feed.getFeed?feed=${feed}${
      cursor ? `&cursor=${cursor}` : ''
    }&limit=${limit}`,
    {method: 'GET', headers: {'Accept-Language': '', ...labelersHeader}},
  )
  data = res.ok
    ? (jsonStringToLex(await res.text()) as GetCustomFeed.OutputSchema)
    : null
  if (data?.feed?.length) {
    return {
      success: true,
      data,
    }
  }

  return {
    success: false,
    data: {feed: []},
  }
}
