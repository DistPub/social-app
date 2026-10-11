import {keepPreviousData, useInfiniteQuery} from '@tanstack/react-query'

import {GIF_SEARCH, GIF_TRENDING} from '#/lib/constants'

export const RQKEY_ROOT = 'gif-service'
export const RQKEY_TRENDING = [RQKEY_ROOT, 'trending']
export const RQKEY_SEARCH = (query: string) => [RQKEY_ROOT, 'search', query]

/**
 * A GIF result from the Giphy API. Only the animated WebP rendition is exposed
 * because WebP is what we upload as a post image.
 */
export type GiphyGif = {
  id: string
  title: string
  /** URL of the animated WebP rendition. */
  webpUrl: string
  /** Same rendition, smaller. Used for the picker grid thumbnails. */
  previewUrl: string
  width: number
  height: number
}

type GiphyImageRendition = {
  url: string
  width: string
  height: string
  size?: string
}

type GiphyApiGif = {
  id: string
  title?: string
  images?: Record<string, GiphyImageRendition>
}

type GiphyApiResponse = {
  data?: GiphyApiGif[]
  meta?: {status: number; msg: string}
  pagination?: {total_count: number; count: number; offset: number}
}

const PAGE_SIZE = 30

/**
 * The proxy returns Giphy's raw API payload (the proxy only injects the API
 * key; it does not rewrite renditions). Giphy's `original`/`fixed_*`
 * renditions are `.gif`, and the only WebP rendition it advertises is
 * `preview_webp` (a tiny 200px still-ish thumbnail).
 *
 * Giphy also serves the full-quality animated WebP by convention: taking the
 * `original` GIF URL and swapping `giphy.gif` -> `giphy.webp` yields an
 * animated WebP at the source dimensions (typically well under the 1MB blob
 * limit). That's what we upload. `preview_webp` is used for the grid.
 */
function deriveAnimatedWebpUrl(gifUrl: string): string {
  return gifUrl.replace(/\.gif(\?.*)?$/i, '.webp')
}

function normalizeGif(gif: GiphyApiGif): GiphyGif | undefined {
  const images = gif.images
  if (!images) return undefined

  const original = images.original
  const previewWebp = images.preview_webp

  if (!original?.url) return undefined

  const width = Number(original.width) || 0
  const height = Number(original.height) || 0
  const animatedWebpUrl = deriveAnimatedWebpUrl(original.url)

  return {
    id: gif.id,
    title: gif.title || '',
    webpUrl: animatedWebpUrl,
    // Grid thumbnail: Giphy's dedicated webp preview, else the animated webp.
    previewUrl: previewWebp?.url || animatedWebpUrl,
    width,
    height,
  }
}

async function fetchGiphy(
  url: string,
  {q, offset}: {q?: string; offset?: number},
): Promise<{results: GiphyGif[]; next?: number}> {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  params.set('limit', String(PAGE_SIZE))
  params.set('offset', String(offset ?? 0))
  params.set('rating', 'pg-13')

  const res = await fetch(`${url}?${params.toString()}`, {
    method: 'GET',
    headers: {'Content-Type': 'application/json'},
  })
  if (!res.ok) {
    throw new Error('Failed to fetch Giphy API')
  }

  const json: GiphyApiResponse = await res.json()
  const results = (json.data ?? [])
    .map(normalizeGif)
    .filter((gif): gif is GiphyGif => gif !== undefined)

  const count = json.pagination?.count ?? results.length
  const nextOffset = (offset ?? 0) + count
  const total = json.pagination?.total_count ?? 0
  const hasMore = count > 0 && nextOffset < total

  return {results, next: hasMore ? nextOffset : undefined}
}

export function useTrendingGifsQuery() {
  return useInfiniteQuery({
    queryKey: RQKEY_TRENDING,
    queryFn: ({pageParam}) => fetchGiphy(GIF_TRENDING, {offset: pageParam}),
    initialPageParam: 0,
    getNextPageParam: lastPage => lastPage.next,
  })
}

export function useGifSearchQuery(query: string) {
  return useInfiniteQuery({
    queryKey: RQKEY_SEARCH(query),
    queryFn: ({pageParam}) =>
      fetchGiphy(GIF_SEARCH, {q: query, offset: pageParam}),
    initialPageParam: 0,
    getNextPageParam: lastPage => lastPage.next,
    enabled: !!query,
    placeholderData: keepPreviousData,
  })
}
