// Generates web-build/sw.js using Workbox's generateSW.
//
// Runs as the last step of `bun run build-web` (after post-web-build.js has
// copied public/ into web-build/). The service worker adds:
//   - Precaching of the app shell (index.html + hashed static JS/CSS + media).
//   - Runtime caching strategies for navigation, atproto API, CDN media, etc.
//   - An offline app-shell fallback (navigateFallback -> index.html).
//
// This is intentionally decoupled from webpack so the build stays predictable:
// a single sw.js is emitted into web-build/ and served from the site root.

import { generateSW } from 'workbox-build'

const ROOT = new URL('..', import.meta.url).pathname

await generateSW({
  globDirectory: ROOT + 'web-build',
  // App shell only: hashed JS/CSS, HTML, and the media (fonts/svg) the shell
  // references. Large root PNG icons are excluded — they're manifest-only and
  // never fetched at runtime.
  globPatterns: ['**/*.{js,css,html}', 'static/media/**/*'],
  globIgnores: [
    '**/asset-manifest.json',
    '**/serve.json',
    '**/postMock.html',
    '**/register-sw.js',
    '**/sw.js',
    '**/workbox-*.js',
    '**/*.map',
    '**/1024.png',
    '**/512.png',
    '**/192.png',
    '**/144.png',
  ],
  swDest: ROOT + 'web-build/sw.js',
  mode: 'production',
  sourcemap: false,

  // Activate the new SW as soon as it's installed and take over open clients
  // so users get the latest bundle on next navigation/reload.
  clientsClaim: true,
  skipWaiting: true,
  cleanupOutdatedCaches: true,

  // SPA offline fallback: any navigation without a cached match falls back to
  // the precached app shell, which boots the SPA client-side router.
  navigateFallback: '/index.html',
  navigateFallbackDenylist: [/^\/static\//, /\/xrpc\//, /\.[a-z0-9]+$/i],

  runtimeCaching: [
    // atproto API + any xrpc endpoint: never cache, always hit the network.
    {
      urlPattern: /\/xrpc\//,
      handler: 'NetworkOnly',
    },
    {
      urlPattern: /^https?:\/\/[^/]*hukoubook\.com\/xrpc\//,
      handler: 'NetworkOnly',
    },
    // Hashed static assets: immutable + content-addressed -> stale-while-revalidate.
    {
      urlPattern: ({ url }) => url.pathname.startsWith('/static/'),
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-assets',
        cacheableResponse: { statuses: [0, 200] },
        expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 365 },
      },
    },
    // Same-origin media (profile imgs, post media, fonts): cache-first.
    {
      urlPattern: ({ url }) =>
        url.origin === self.location.origin &&
        /\.(?:png|jpe?g|gif|svg|webp|avif|woff2?|ttf|otf)$/i.test(url.pathname),
      handler: 'CacheFirst',
      options: {
        cacheName: 'same-origin-media',
        cacheableResponse: { statuses: [0, 200] },
        expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 30 },
      },
    },
    // Cross-origin CDN media (bsky CDN, hukoubook CDN): cache-first.
    {
      urlPattern: ({ url }) =>
        /bsky\.app|hukoubook\.com|stitch\.com|cdn\./.test(url.hostname),
      handler: 'CacheFirst',
      options: {
        cacheName: 'cdn-media',
        cacheableResponse: { statuses: [0, 200] },
        expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 7 },
      },
    },
  ],
})

console.log('✓ workbox sw.js generated at web-build/sw.js')
