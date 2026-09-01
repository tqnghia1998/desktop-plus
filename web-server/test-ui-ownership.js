const assert = require('assert/strict')
const fs = require('fs')
const path = require('path')
const ts = require('typescript')

const root = path.join(__dirname, '..')
const webUiSources = [
  'app/src/ui/web-index.tsx',
  'app/src/ui/web-app.tsx',
  'app/src/ui/web-emoji.ts',
  ...fs
    .readdirSync(path.join(root, 'app/src/ui/web'))
    .filter(file => /\.(?:ts|tsx)$/.test(file))
    .map(file => `app/src/ui/web/${file}`),
]
const forbiddenVisualPrimitives = new Set([
  'Dialog',
  'DialogContent',
  'DialogFooter',
  'FocusContainer',
  'Resizable',
  'TabBar',
  'Toolbar',
  'ToolbarSidebarSection',
  'UiView',
])

function lineAndColumn(sourceFile, node) {
  const position = sourceFile.getLineAndCharacterOfPosition(node.getStart())
  return `${position.line + 1}:${position.character + 1}`
}

for (const file of webUiSources) {
  const sourcePath = path.join(root, file)
  const source = fs.readFileSync(sourcePath, 'utf8')
  const sourceFile = ts.createSourceFile(
    sourcePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  )

  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName.getText(sourceFile)
      assert.ok(
        !/^[a-z]/.test(tagName),
        `Web UI must render desktop-owned components, not <${tagName}>: ` +
          `${file}:${lineAndColumn(sourceFile, node)}`
      )
      assert.ok(
        !forbiddenVisualPrimitives.has(tagName),
        `Web UI must use desktop-owned composed views, not ${tagName}: ` +
          `${file}:${lineAndColumn(sourceFile, node)}`
      )

      for (const attribute of node.attributes.properties) {
        if (!ts.isJsxAttribute(attribute)) continue
        const attributeName = attribute.name.getText(sourceFile)
        assert.ok(
          !['className', 'style', 'foldoutStyle'].includes(attributeName),
          `Web UI must not own visual props (${attributeName}): ` +
            `${file}:${lineAndColumn(sourceFile, attribute)}`
        )
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
}

assert.equal(
  fs.readFileSync(path.join(root, 'app/styles/web-desktop.scss'), 'utf8'),
  "@import 'desktop';\n",
  'The web stylesheet must only import the desktop visual system'
)

assert.equal(
  fs.readFileSync(
    path.join(root, 'web-server/src/browser-renderer.css'),
    'utf8'
  ),
  `html,
body {
  width: 100%;
  height: 100%;
  margin: 0;
}

#root {
  position: fixed;
  inset: 0;
  width: 100%;
  min-width: 320px;
  height: 100%;
  min-height: 0;
}

/* The menu UI itself is rendered by the shared desktop AppMenu components. */
#web-context-menu {
  position: fixed;
  z-index: 2147483647;
}
`,
  'Browser CSS may only size the renderer root and position the shared menu'
)

const browserSources = fs
  .readdirSync(path.join(root, 'web-server/src'))
  .filter(file => file.endsWith('.js'))
for (const file of browserSources) {
  const source = fs.readFileSync(
    path.join(root, 'web-server/src', file),
    'utf8'
  )
  assert.doesNotMatch(
    source,
    /\b(?:innerHTML|outerHTML|insertAdjacentHTML)\b/,
    `Browser adapter must not create visual markup: web-server/src/${file}`
  )
  assert.doesNotMatch(
    source,
    /React\.createElement\(\s*['"][a-z]/,
    `Browser adapter must render shared React UI: web-server/src/${file}`
  )
  assert.doesNotMatch(
    source,
    /\.className\s*=|setAttribute\(\s*['"]class/,
    `Browser adapter must not attach visual classes: web-server/src/${file}`
  )
  if (file !== 'desktop-main-process-proxy-stub.js') {
    assert.doesNotMatch(
      source,
      /document\.createElement\(/,
      `Browser adapter must not create visual DOM: web-server/src/${file}`
    )
    assert.doesNotMatch(
      source,
      /\.style\./,
      `Browser adapter must not own styling: web-server/src/${file}`
    )
  }
}

const contextMenuAdapter = fs.readFileSync(
  path.join(root, 'web-server/src/desktop-main-process-proxy-stub.js'),
  'utf8'
)
assert.equal(
  (
    contextMenuAdapter.match(/document\.createElement\(\s*['"]div['"]\s*\)/g) ||
    []
  ).length,
  1,
  'The context-menu adapter may create exactly one nonvisual React mount node'
)
const contextMenuStyleAssignments = [
  ...contextMenuAdapter.matchAll(/root\.style\.([A-Za-z]+)/g),
].map(match => match[1])
assert.deepEqual(
  [...new Set(contextMenuStyleAssignments)].sort(),
  ['left', 'top'],
  'The context-menu adapter may only position the shared desktop menu'
)

console.log(
  `Web UI ownership check passed: ${webUiSources.length} controller sources`
)
