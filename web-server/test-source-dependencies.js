const assert = require('assert/strict')
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
const forbiddenImports =
  /(?:from\s+['"](?:electron|node:|child_process|crypto|fs|http|https|os|path|stream|url)['"]|require\(['"](?:electron|node:|child_process|crypto|fs|http|https|os|path|stream|url)['"]\))/u

const webApp = fs.readFileSync(
  path.join(root, 'app/src/ui/web-app.tsx'),
  'utf8'
)
assert.match(webApp, /space:desktop-plus-refresh-request/)
assert.match(webApp, /event\.origin === parentOrigin/)
assert.match(webApp, /event\.source === window\.parent/)
assert.match(webApp, /hostRefreshInFlight\.current/)
assert.match(webApp, /store\.getState\(\)\.loading/)
assert.doesNotMatch(webApp, /hostRefreshQueued/)
assert.match(webApp, /defaultDiffFontSize \+ 3/)

for (const file of sourceFiles) {
  const source = fs.readFileSync(path.join(root, file), 'utf8')
  assert.doesNotMatch(
    source,
    forbiddenImports,
    `Web source imports a desktop or Node module: ${file}`
  )
}

const manifest = require('./public/build-manifest.json')
const application = fs.readFileSync(
  path.join(__dirname, 'public/assets', manifest.assets.application),
  'utf8'
)
const highlighter = fs.readFileSync(
  path.join(__dirname, 'public', manifest.assets.highlighter.entry),
  'utf8'
)
// The unchanged Desktop renderer includes inert browser-platform detection
// strings for Electron. Reject actual Electron module loading instead.
assert.doesNotMatch(
  application,
  /(?:require\(\s*['"]electron['"]\s*\)|from\s*['"]electron['"]|electron\/remote)/i
)
assert.doesNotMatch(
  application,
  /(?:require\(\s*['"]child_process['"]\s*\)|from\s*['"]child_process['"])/i
)
assert.doesNotMatch(application, /\bunsafe-eval\b/)
assert.match(highlighter, /contentLines/)
assert.match(highlighter, /postMessage/)

console.log(
  `Web source dependency check passed: ${sourceFiles.length} source boundaries`
)
