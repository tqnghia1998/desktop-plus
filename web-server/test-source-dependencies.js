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
assert.match(webApp, /const isEmbedded = getEmbeddedParentOrigin\(\) !== null/)
assert.match(webApp, /isEmbedded=\{isEmbedded\}/)
assert.match(webApp, /props\.showWorktrees && repository/)
assert.match(webApp, /<WorktreeDropdown[\s\S]*disabled=\{props\.isEmbedded\}/)
assert.match(
  webApp,
  /<RepositoryToolbarDropdown[\s\S]*disabled=\{props\.isEmbedded\}/
)
assert.match(webApp, /event\.origin === parentOrigin/)
assert.match(webApp, /event\.source === window\.parent/)
assert.match(webApp, /hostRefreshInFlight\.current/)
assert.match(webApp, /store\.getState\(\)\.loading/)
assert.doesNotMatch(webApp, /hostRefreshQueued/)
assert.doesNotMatch(webApp, /historyIdentity/)
assert.doesNotMatch(webApp, /key=\{historyIdentity\}/)
assert.match(
  webApp,
  /commitGraph_loadFilterAuthors: \(\) => Promise\.resolve\(\)/
)
assert.match(webApp, /defaultDiffFontSize \+ 1/)
assert.match(webApp, /fileListRowHeight=\{32\}/)
assert.match(webApp, /compactHeader/)
assert.match(webApp, /readonly branches\?: ReadonlyArray<Branch>/)
assert.match(webApp, /popup\.branches\?\.flatMap/)
assert.match(webApp, /branches=\{deleteUnusedLocalBranches\}/)

const stashDiffStyles = fs.readFileSync(
  path.join(root, 'app/styles/ui/_stash-diff-viewer.scss'),
  'utf8'
)
assert.match(
  stashDiffStyles,
  /&\.compact \{\s+padding: var\(--spacing\)[\s\S]*title-row \{\s+margin-bottom: 0;\s+\}[\s\S]*\.row \{\s+margin-top: var\(--spacing-half\);/
)

const changesFileList = fs.readFileSync(
  path.join(root, 'app/src/ui/changes/filter-changes-list.tsx'),
  'utf8'
)
assert.match(changesFileList, /readonly rowHeight\?: number/)
assert.match(
  changesFileList,
  /rowHeight=\{this\.props\.rowHeight \?\? RowHeight\}/
)

const committedFileList = fs.readFileSync(
  path.join(root, 'app/src/ui/history/file-list.tsx'),
  'utf8'
)
assert.match(committedFileList, /readonly rowHeight\?: number/)
assert.match(committedFileList, /rowHeight=\{this\.props\.rowHeight \?\? 29\}/)

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
