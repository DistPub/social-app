import {keepPreviousData, useInfiniteQuery} from '@tanstack/react-query'

import {GIF_SEARCH, GIF_TRENDING} from '#/lib/constants'

export const RQKEY_ROOT = 'gif-service'
export const RQKEY_TRENDING = [RQKEY_ROOT, 'trending']
export const RQKEY_SEARCH = (query: string) => [RQKEY_ROOT, 'search', query]

/**
 * A GIF result from the Giphy API.
 *
 * We only surface the low-resolution `preview_webp` rendition here: it is shown
 * in the picker grid and uploaded as the external embed's `thumb`. The full
 * animation is never stored locally — the post keeps the Giphy *page* URI, and
 * the renderer derives the high-quality animated WebP (`i.giphy.com/{id}.webp`)
 * from the `id` at display time. This sidesteps Bluesky's blob CDN, which
 * strips WebP animation when a GIF is uploaded as an image blob.
 */
export type GiphyGif = {
  id: string
  title: string
  /** Low-res animated WebP. Used for the grid and as the upload thumbnail. */
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
 * key; it does not rewrite renditions). `images.original.webp` is the
 * full-quality animated WebP, and `images.preview_webp` is a small (~200px)
 * animated WebP. We expose only `preview_webp` here — it is what we upload as
 * the external embed thumbnail. The renderer derives the HD WebP from `id`.
 */
function normalizeGif(gif: GiphyApiGif): GiphyGif | undefined {
  const images = gif.images
  if (!images) return undefined

  const original = images.original
  const previewWebp = images.preview_webp

  if (!original?.url || !previewWebp?.url) return undefined

  const width = Number(original.width) || 0
  const height = Number(original.height) || 0

  return {
    id: gif.id,
    title: gif.title || '',
    previewUrl: previewWebp.url,
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
