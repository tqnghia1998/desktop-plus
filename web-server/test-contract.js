const assert = require('assert/strict')
const childProcess = require('child_process')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const sourceFiles = [
  'app/src/ui/web-index.tsx',
  'app/src/ui/web-app.tsx',
  'app/src/ui/web-emoji.ts',
  'app/src/ui/web/contracts.ts',
  'app/src/ui/web/client.ts',
  'app/src/ui/web/platform.ts',
  'app/src/ui/web/store.ts',
]

function digestGeneratedBuild() {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'public/build-manifest.json'), 'utf8')
  )
  const files = [
    'index.html',
    'build-manifest.json',
    `assets/${manifest.assets.bootstrap}`,
    `assets/${manifest.assets.application}`,
    `assets/${manifest.assets.stylesheet}`,
    manifest.assets.highlighter.entry,
    ...manifest.assets.highlighter.chunks.map(file => file),
  ]
  const hash = crypto.createHash('sha256')
  for (const file of files) {
    hash.update(file)
    hash.update(fs.readFileSync(path.join(__dirname, 'public', file)))
  }
  return { digest: hash.digest('hex'), manifest }
}

for (const file of sourceFiles)
  assert.ok(fs.existsSync(path.join(root, file)), `Missing web source: ${file}`)

childProcess.execFileSync(process.execPath, ['web-server/build.js'], {
  cwd: root,
  stdio: 'inherit',
})
const firstBuild = digestGeneratedBuild()
childProcess.execFileSync(process.execPath, ['web-server/build.js'], {
  cwd: root,
  stdio: 'inherit',
})
const secondBuild = digestGeneratedBuild()

assert.equal(secondBuild.digest, firstBuild.digest)
assert.equal(
  secondBuild.manifest.version,
  require('../app/package.json').version
)
assert.equal(secondBuild.manifest.platform, 'web')
assert.equal(secondBuild.manifest.renderer.entry, 'app/src/ui/web-index.tsx')
assert.deepEqual(secondBuild.manifest.renderer.source, sourceFiles)
assert.equal(Object.hasOwn(secondBuild.manifest, 'snapshot'), false)
assert.equal(secondBuild.manifest.assets.highlighter.entry, 'highlighter.js')
assert.ok(secondBuild.manifest.assets.highlighter.chunks.length > 0)

const application = fs.readFileSync(
  path.join(
    __dirname,
    'public/assets',
    secondBuild.manifest.assets.application
  ),
  'utf8'
)
assert.doesNotMatch(
  application,
  /desktop-app\.template\.js|sourceCommit|__desktopPlusDispatcherContract/
)
assert.match(application, /__DESKTOP_PLUS_SOURCE_RENDERER__/)

console.log(
  `Web source build passed: ${
    sourceFiles.length
  } modules, reproducible ${secondBuild.digest.slice(0, 12)}`
)
