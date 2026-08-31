const assert = require('assert/strict')
const fs = require('fs')
const path = require('path')

const publicDir = path.join(__dirname, 'public')
const MAX_PUBLIC_BYTES = 8 * 1024 * 1024
const MAX_NON_EMOJI_FILES = 250
const MAX_EMOJI_FILES = 1000
const allowedExtensions = new Set([
  '.css',
  '.gitignore',
  '.html',
  '.js',
  '.json',
  '.md',
  '.png',
  '.svg',
])

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const fullPath = path.join(directory, entry.name)
    if (entry.isSymbolicLink())
      throw new Error(`Runtime payload contains a symlink: ${fullPath}`)
    return entry.isDirectory() ? walk(fullPath) : [fullPath]
  })
}

const files = walk(publicDir)
const bytes = files.reduce((total, file) => total + fs.statSync(file).size, 0)
const emojiPrefix = `${path.join(publicDir, 'static', 'emoji')}${path.sep}`
const emojiFiles = files.filter(file => file.startsWith(emojiPrefix))
const nonEmojiFiles = files.length - emojiFiles.length
assert.ok(
  bytes <= MAX_PUBLIC_BYTES,
  `Web payload is ${bytes} bytes; budget is ${MAX_PUBLIC_BYTES}`
)
assert.ok(
  nonEmojiFiles <= MAX_NON_EMOJI_FILES,
  `Web payload has ${nonEmojiFiles} non-emoji files; budget is ${MAX_NON_EMOJI_FILES}`
)
assert.ok(
  emojiFiles.length <= MAX_EMOJI_FILES,
  `Web payload has ${emojiFiles.length} emoji files; budget is ${MAX_EMOJI_FILES}`
)

for (const file of files) {
  const extension = path.extname(file).toLowerCase()
  assert.ok(
    allowedExtensions.has(extension),
    `Unexpected runtime file: ${file}`
  )
  if (extension === '.json') JSON.parse(fs.readFileSync(file, 'utf8'))
  if (extension === '.svg')
    assert.doesNotMatch(
      fs.readFileSync(file, 'utf8'),
      /<script\b|\bon[a-z]+\s*=|javascript:/i,
      `Executable SVG content: ${file}`
    )
}

for (const removed of [
  'repository-workflow.png',
  'static/choosealicense.com',
  'static/common',
  'static/darwin',
  'static/linux',
  'static/logos',
  'static/win32',
]) {
  assert.equal(
    fs.existsSync(path.join(publicDir, removed)),
    false,
    `Removed runtime residue returned: ${removed}`
  )
}

const manifest = JSON.parse(
  fs.readFileSync(path.join(publicDir, 'build-manifest.json'), 'utf8')
)
for (const asset of [
  manifest.assets.bootstrap,
  manifest.assets.application,
  manifest.assets.stylesheet,
]) {
  assert.match(asset, /-[a-f0-9]{12}\.(?:css|js)$/)
  assert.ok(fs.existsSync(path.join(publicDir, 'assets', asset)))
}
assert.equal(manifest.assets.highlighter.entry, 'highlighter.js')
assert.ok(
  fs.existsSync(path.join(publicDir, manifest.assets.highlighter.entry))
)
for (const chunk of manifest.assets.highlighter.chunks)
  assert.ok(fs.existsSync(path.join(publicDir, chunk)))

assert.ok(
  fs.existsSync(path.join(publicDir, 'static/LICENSE.choosealicense.md'))
)
assert.ok(fs.existsSync(path.join(publicDir, 'static/LICENSE.gitignore')))
assert.ok(
  JSON.parse(
    fs.readFileSync(
      path.join(publicDir, 'static/available-licenses.json'),
      'utf8'
    )
  ).length > 0
)
assert.ok(
  fs.existsSync(path.join(publicDir, 'static/gitignore/Node.gitignore'))
)
const application = fs.readFileSync(
  path.join(publicDir, 'assets', manifest.assets.application),
  'utf8'
)
assert.match(application, /__DESKTOP_PLUS_SOURCE_RENDERER__/)
assert.match(application, /Add repository/)
assert.match(application, /Repository tools/)
assert.doesNotMatch(
  application,
  /desktop-app\.template\.js|sourceCommit|__desktopPlusDispatcherContract/
)

console.log(
  `Web payload passed: ${files.length} files, ${(bytes / 1024 / 1024).toFixed(
    2
  )} MiB`
)
