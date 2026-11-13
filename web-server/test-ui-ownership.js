const assert = require('assert/strict')
const fs = require('fs')
const path = require('path')
const ts = require('typescript')

const root = path.join(__dirname, '..')
const { rendererSources: webUiSources } = require('./src/renderer-sources')
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
  ) +
    '\n' +
    fs.readFileSync(
      path.join(root, 'app/src/patches/vibing/appearance.css'),
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

button:not(:disabled):not([aria-disabled='true']) {
  cursor: pointer;
}

button:disabled,
button[aria-disabled='true'] {
  cursor: default;
}

button.resize-handle {
  cursor: ew-resize !important;
}

/* The menu UI itself is rendered by the shared desktop AppMenu components. */
#web-context-menu {
  position: fixed;
  z-index: 2147483647;
}

/* Fit the app inside narrow viewports (e.g. embedded next to a host details
 * panel): let the resizable toolbar buttons shrink instead of pushing the
 * trailing Repository/Branch menu buttons past the right edge, and clamp the
 * toolbar sidebar section. 630px ≈ the floor space the remaining toolbar
 * buttons need
 * (3 resizable buttons at 140px + 2 action menus at 105px). */
#desktop-app-toolbar > *,
#desktop-app-toolbar .resizable-component {
  flex-shrink: 1;
  min-width: 0;
}

#desktop-app-toolbar .toolbar-action-menu {
  min-width: 105px;
}

/* The trailing Branch action has no adjacent toolbar control to separate. */
#desktop-app-toolbar
  > .toolbar-action-menu:last-child
  > .toolbar-button
  > button {
  border-right: 0;
}

#desktop-app-toolbar > .sidebar-section {
  max-width: calc(100vw - 630px);
}

/* Reuse the shared AppMenu markup, with the same visual elevation as desktop
 * popovers so it remains distinct over a diff or other dark surfaces. */
#web-context-menu .menu-pane {
  border-radius: var(--border-radius);
  box-shadow: var(--base-box-shadow);
}

/* Avoid the desktop app's narrow 400–450px dialogs in the embedded view.
 * The shared responsive rule still takes precedence below 600px. */
dialog {
  min-width: 600px;
}

/* The host's iframe is compact; keep every semantic type token 1px larger
 * than the desktop default. */
:root {
  --font-size: 13px;
  --font-size-sm: 12px;
  --font-size-md: 15px;
  --font-size-lg: 29px;
  --font-size-xl: 33px;
  --font-size-xxl: 43px;
  --font-size-xs: 10px;

  /* Keep the shared desktop spacing rhythm with compact controls. */
  --button-height: 32px;
  --text-field-height: 32px;
  --dropdown-select-button-height: 32px;
  --menu-item-height: 32px;
  --toolbar-height: 58px;
  --tab-bar-height: 36px;
  --button-border-radius: 8px;
  --border-radius: 8px;
}

/* Align the dark theme with the Space App Vibing host application: its
 * blue-gray surfaces and blue accent.
 * Loaded after web-desktop.scss, so these override the GitHub dark palette. */
body.theme-dark {
  --text-color: #abb2bf;
  --text-secondary-color: #9da5b4;
  --background-color: #181a1f;
  --text-secondary-color-muted: #7f848e;
  --color-new: #98c379;
  --color-deleted: #e06c75;
  --color-modified: #e5c07b;
  --color-renamed: #61afef;
  --color-conflicted: #d19a66;

  --button-text-color: #181a1f;
  --button-background: #61afef;
  --button-hover-background: #78baf2;
  --link-button-color: #61afef;
  --link-button-hover-color: #78baf2;
  --secondary-button-background: #181a1f;
  --secondary-button-hover-border-color: #333741;

  --box-background-color: #1c2025;
  --box-alt-background-color: #181a1f;
  --box-border-color: #21242b;
  --box-border-contrast-color: #333741;
  --box-border-accent-color: #61afef;
  --box-hover-background-color: #21242b;
  --box-selected-background-color: #21242b;
  --box-selected-active-background-color: #61afef;
  --box-selected-active-text-color: #181a1f;
  --box-skeleton-background-color: #333741;
  --skeleton-background-gradient: -webkit-linear-gradient(
    left,
    rgba(24, 26, 31, 0) 0%,
    rgba(24, 26, 31, 0.5) 50%,
    rgba(24, 26, 31, 0) 100%
  );
  --box-placeholder-color: #7f848e;

  --toolbar-background-color: #181a1f;
  --toolbar-button-hover-background-color: #21242b;
  --toolbar-button-focus-background-color: #21242b;
  --toolbar-button-progress-color: #21242b;
  --toolbar-button-focus-progress-color: #333741;
  --toolbar-button-hover-progress-color: #333741;
  --toolbar-badge-background-color: #333741;
  --toolbar-dropdown-open-progress-color: #78baf2;

  --app-menu-pane-background-color: #181a1f;
  --app-menu-divider-color: #333741;
  --app-menu-button-active-background-color: #21242b;

  --tab-bar-hover-background-color: #21242b;
  --tab-bar-count-background-color: #333741;
  --list-item-badge-background-color: #333741;
  --branch-pill-background-color: #21242b;
  --list-item-hover-background-color: #21242b;

  --focus-color: #61afef;
  --accent-color: #78baf2;
  --overlay-background-color: rgba(0, 0, 0, 0.6);
  --path-segment-background: #21242b;
  --tooltip-background-color: #181a1f;
  --commit-warning-badge-background-color: #1c2025;
  --commit-warning-badge-border-color: #333741;

  --box-overflow-shadow-background: linear-gradient(
    180deg,
    rgba(24, 26, 31, 0) 0%,
    #181a1f 90%,
    #181a1f 100%
  );
  --no-shadow-top: linear-gradient(#181a1f, rgba(255, 255, 255, 0));
  --no-shadow-bottom: linear-gradient(rgba(255, 255, 255, 0), #181a1f);
  --top-shadow: linear-gradient(
    0deg,
    rgba(24, 26, 31, 0) 0%,
    rgba(0, 0, 0, 0.6) 90%,
    rgba(0, 0, 0, 1) 100%
  );
  --bottom-shadow: linear-gradient(
      180deg,
      rgba(24, 26, 31, 0) 0%,
      rgba(0, 0, 0, 0.6) 90%,
      rgba(0, 0, 0, 1) 100%
    )
    0 100%;
}
`,
  'Browser CSS may only size the renderer root, position shared menus and\n' +
    'dialogs, align the dark theme with the Space App Vibing host, and fit the\n' +
    'toolbar in narrow viewports'
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
