const assert = require('assert/strict')
const fs = require('fs')
const path = require('path')
const ts = require('typescript')

const root = path.join(__dirname, '..')
const webpackConfig = require('./webpack.config')
assert.equal(
  webpackConfig.resolve.alias[
    path.join(root, 'app/src/lib/git/repository-operation.ts')
  ],
  path.join(__dirname, 'src/desktop-repository-operation-stub.js')
)
assert.match(
  fs.readFileSync(
    path.join(root, 'app/src/ui/preferences/integrations.tsx'),
    'utf8'
  ),
  /private renderCopilotApp\(\)\s*\{\s*if \(__LINUX__ \|\| process\.env\.DESKTOP_PLUS_WEB === '1'\)/
)
assert.match(
  fs.readFileSync(path.join(__dirname, 'src/desktop-process-stub.js'), 'utf8'),
  /DESKTOP_PLUS_WEB: '1'/
)
assert.equal(
  webpackConfig.resolve.alias[
    path.join(root, 'app/src/lib/copilot-app/index.ts')
  ],
  path.join(__dirname, 'src/desktop-copilot-app-stub.js')
)
assert.equal(
  webpackConfig.resolve.alias[path.join(root, 'app/src/lib/clone-info.ts')],
  path.join(__dirname, 'src/desktop-clone-info-stub.js')
)
assert.match(
  fs.readFileSync(
    path.join(root, 'app/src/patches/web/preferences.tsx'),
    'utf8'
  ),
  /setShowChangedFileCount: props\.onShowChangedFileCountChanged/
)
const { rendererSources: sourceFiles } = require('./src/renderer-sources')
const forbiddenImports =
  /(?:from\s+['"](?:electron|node:|child_process|crypto|fs|http|https|os|path|stream|url)['"]|require\(['"](?:electron|node:|child_process|crypto|fs|http|https|os|path|stream|url)['"]\))/u

const webApp = sourceFiles
  .map(file => fs.readFileSync(path.join(root, file), 'utf8'))
  .join('\n')
assert.match(webApp, /space:desktop-plus-refresh-request/)
assert.match(webApp, /const isEmbedded = getEmbeddedParentOrigin\(\) !== null/)
assert.match(webApp, /isEmbedded=\{isEmbedded\}/)
assert.match(webApp, /props\.showWorktrees && repository/)
assert.match(webApp, /<WorktreeDropdown[\s\S]*disabled=\{props\.isEmbedded\}/)
const webToolbar = fs.readFileSync(
  path.join(root, 'app/src/patches/web/toolbar.tsx'),
  'utf8'
)
assert.ok(
  /const desktopWorktreeDispatcher = React\.useMemo\([\s\S]*?copyPathToClipboard: props\.onCopyPath,[\s\S]*?\} as unknown as Dispatcher\)/.test(
    webToolbar
  ),
  'The worktree dropdown must copy paths through the browser clipboard'
)
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
assert.match(
  webApp,
  /filteredHistoryCommitSearchQuery: props\.state\.historyFilterText/
)
assert.match(webApp, /filteredHistoryCommitSearchQuery: ''/)

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

// Follow the recorder import used by the shared Changes list. Type-only
// imports are fine; a runtime dependency here pulls it into the web renderer.
const changesFileListPath = path.join(
  root,
  'app/src/ui/changes/filter-changes-list.tsx'
)
const recorderImport = ts
  .createSourceFile(
    changesFileListPath,
    changesFileList,
    ts.ScriptTarget.Latest
  )
  .statements.filter(ts.isImportDeclaration)
  .find(statement => {
    const bindings = statement.importClause?.namedBindings
    return (
      bindings &&
      ts.isNamedImports(bindings) &&
      bindings.elements.some(
        binding =>
          (binding.propertyName ?? binding.name).text ===
          'recordAssistedCommitMetric'
      )
    )
  })
assert.ok(
  recorderImport,
  'The shared Changes list must use the metric recorder'
)
const recorderPath = path.resolve(
  path.dirname(changesFileListPath),
  `${recorderImport.moduleSpecifier.text}.ts`
)
const { outputText: recorderJS } = ts.transpileModule(
  fs.readFileSync(recorderPath, 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.ESNext }, fileName: recorderPath }
)
assert.deepEqual(
  ts.preProcessFile(recorderJS, true, true).importedFiles.map(x => x.fileName),
  [],
  'The shared assisted-commit metric recorder must have no runtime imports'
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
