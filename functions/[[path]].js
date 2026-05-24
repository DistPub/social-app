export async function onRequest(context) {
  const { request } = context
  const isBot = request.cf?.verifiedBotCategory

  if (isBot) {
    const ssrUrl = new URL(request.url)
    ssrUrl.host = 'fatesky-ssr.hukoubook.com'

    try {
      const response = await fetch(ssrUrl, {
        method: request.method,
        redirect: 'follow',
      })

      const cacheResponse = new Response(response.body, response)
      cacheResponse.headers.set('Cache-Control', 'public, max-age=3600') // 边缘缓存 1 小时

      return cacheResponse
    } catch (err) {
      return context.next()
    }
  }

  return context.next()
}
