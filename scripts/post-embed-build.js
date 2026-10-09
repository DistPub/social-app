const path = require('node:path')
const fs = require('node:fs')

const projectRoot = path.join(__dirname, '..')

// copy embed assets into bskyweb/static (served under /static by the main binary)

const embedAssetSource = path.join(projectRoot, 'bskyembed', 'dist', 'static')

const embedAssetDest = path.join(projectRoot, 'bskyweb', 'static')

fs.cpSync(embedAssetSource, embedAssetDest, {recursive: true})

const embedEmbedJSSource = path.join(
  projectRoot,
  'bskyembed',
  'dist',
  'embed.js',
)

const embedEmbedJSDest = path.join(
  projectRoot,
  'bskyweb',
  'static',
  'embed.js',
)

fs.cpSync(embedEmbedJSSource, embedEmbedJSDest)

// copy entrypoint(s) to bskyweb/static

// additional entrypoints will need more work, but this'll do for now
const embedHomeHtmlSource = path.join(
  projectRoot,
  'bskyembed',
  'dist',
  'index.html',
)

const embedHomeHtmlDest = path.join(
  projectRoot,
  'bskyweb',
  'embedr-templates',
  'home.html',
)

fs.copyFileSync(embedHomeHtmlSource, embedHomeHtmlDest)

const embedPostHtmlSource = path.join(
  projectRoot,
  'bskyembed',
  'dist',
  'post.html',
)

const embedPostHtmlDest = path.join(
  projectRoot,
  'bskyweb',
  'embedr-templates',
  'postEmbed.html',
)

  fs.copyFileSync(embedPostHtmlSource, embedPostHtmlDest)

  console.log(`Copied embed assets to bskyweb/static`)
