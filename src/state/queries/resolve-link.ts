import {type BskyAgent} from '@atproto/api'
import {type QueryClient, useQuery} from '@tanstack/react-query'

import {type ResolvedLink, resolveLink} from '#/lib/api/resolve'
import {STALE} from '#/state/queries/index'
import {useAgent} from '#/state/session'

export const RQKEY_LINK_ROOT = 'resolve-link'
export const RQKEY_LINK = (url: string) => [RQKEY_LINK_ROOT, url]

export function useResolveLinkQuery(url: string) {
  const agent = useAgent()

  return useQuery({
    staleTime: STALE.HOURS.ONE,
    queryKey: RQKEY_LINK(url),
    queryFn: async () => {
      return await resolveLink(agent, url)
    },
  })
}
export function fetchResolveLinkQuery(
  queryClient: QueryClient,
  agent: BskyAgent,
  url: string,
) {
  return queryClient.fetchQuery({
    staleTime: STALE.HOURS.ONE,
    queryKey: RQKEY_LINK(url),
    queryFn: async () => {
      return await resolveLink(agent, url)
    },
  })
}
export function precacheResolveLinkQuery(
  queryClient: QueryClient,
  url: string,
  resolvedLink: ResolvedLink,
) {
  queryClient.setQueryData(RQKEY_LINK(url), resolvedLink)
}
