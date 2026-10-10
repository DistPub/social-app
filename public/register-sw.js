// Registers the Workbox-generated service worker (web-build/sw.js).
// Copied to the site root by post-web-build.js. Skipped on localhost so the
// dev server (expo's noop SW) is never disturbed.
if ('serviceWorker' in navigator) {
  var isLocal =
    location.hostname === 'localhost' || location.hostname === '127.0.0.1'
  if (!isLocal) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function (err) {
        console.error('[sw] registration failed:', err)
      })
    })
  }
}
