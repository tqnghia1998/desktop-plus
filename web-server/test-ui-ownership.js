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
 * sidebar (the toolbar section and the sidebar column share one clamp so they
 * stay aligned). 630px ≈ the floor space the remaining toolbar buttons need
 * (3 resizable buttons at 140px + 2 action menus at 105px). */
#desktop-app-toolbar > *,
#desktop-app-toolbar .resizable-component {
  flex-shrink: 1;
  min-width: 0;
}

#desktop-app-toolbar .resizable-component {
  min-width: 140px;
}

#desktop-app-toolbar .toolbar-action-menu {
  min-width: 105px;
}

#desktop-app-toolbar > .sidebar-section,
#repository-sidebar {
  max-width: calc(100vw - 630px);
}

/* Reuse the shared AppMenu markup, with the same visual elevation as desktop
 * popovers so it remains distinct over a diff or other dark surfaces. */
#web-context-menu .menu-pane {
  background: var(--app-menu-pane-background-color);
  border-radius: var(--border-radius);
  box-shadow: var(--base-box-shadow);
  color: var(--app-menu-pane-color);
}

/* Avoid the desktop app's narrow 400–450px dialogs in the embedded view.
 * The shared responsive rule still takes precedence below 600px. */
dialog {
  min-width: 600px;
}

/* The host's iframe is compact; keep every semantic type token 3px larger
 * than the desktop default. */
:root {
  --font-size: 15px;
  --font-size-sm: 14px;
  --font-size-md: 17px;
  --font-size-lg: 31px;
  --font-size-xl: 35px;
  --font-size-xxl: 45px;
  --font-size-xs: 12px;

  /* Keep the shared desktop spacing rhythm so adjacent actions and dialog
   * padding do not become oversized; control dimensions below carry the
   * embedded density adjustment. */
  --spacing: 10px;
  --button-height: 40px;
  --text-field-height: 40px;
  --dropdown-select-button-height: 42px;
  --menu-item-height: 42px;
  --toolbar-height: 64px;
  --tab-bar-height: 40px;
  --button-border-radius: 10px;
  --border-radius: 10px;
}

/* Align the dark theme with the Space App Vibing host application: flat
 * Metro-style neutral surfaces (#1a1a1a family) and its #3a96dd accent.
 * Loaded after web-desktop.scss, so these override the GitHub dark palette. */
body.theme-dark {
  --text-color: #ffffff;
  --text-secondary-color: #a0a0a0;
  --background-color: #1a1a1a;

  --button-background: #3a96dd;
  --button-hover-background: #55a8e3;
  --button-focus-border-color: #3a96dd;
  --link-button-color: #3a96dd;
  --link-button-hover-color: #55a8e3;
  --secondary-button-background: #252526;
  --secondary-button-border-color: #2c2c30;
  --secondary-button-hover-border-color: #3f3f46;

  --box-background-color: #1a1a1a;
  --box-alt-background-color: #1a1a1a;
  --box-border-color: #222225;
  --box-border-contrast-color: #2c2c30;
  --box-border-accent-color: #3a96dd;
  --box-hover-background-color: #2d2d30;
  --box-selected-background-color: #2d2d30;
  --box-selected-active-background-color: #3a96dd;
  --box-skeleton-background-color: #3f3f46;
  --skeleton-background-gradient: -webkit-linear-gradient(
    left,
    rgba(26, 26, 26, 0) 0%,
    rgba(26, 26, 26, 0.5) 50%,
    rgba(26, 26, 26, 0) 100%
  );
  --box-placeholder-color: #6e6e6e;

  --toolbar-background-color: #1a1a1a;
  --toolbar-button-hover-background-color: #2d2d30;
  --toolbar-button-focus-background-color: #2d2d30;
  --toolbar-button-progress-color: #2d2d30;
  --toolbar-button-focus-progress-color: #3f3f46;
  --toolbar-button-hover-progress-color: #3f3f46;
  --toolbar-badge-background-color: #3f3f46;
  --toolbar-dropdown-open-progress-color: #55a8e3;

  --app-menu-pane-background-color: #252526;
  --app-menu-divider-color: #2c2c30;
  --app-menu-button-active-background-color: #2d2d30;

  --tab-bar-hover-background-color: #2d2d30;
  --tab-bar-count-background-color: #3f3f46;
  --list-item-badge-background-color: #3f3f46;
  --branch-pill-background-color: #2d2d30;
  --list-item-hover-background-color: #2d2d30;

  --focus-color: #3a96dd;
  --accent-color: #55a8e3;
  --overlay-background-color: rgba(0, 0, 0, 0.6);
  --path-segment-background: #2d2d30;
  --path-segment-background-focus: #3f3f46;
  --tooltip-background-color: #252526;
  --commit-warning-badge-background-color: #1a1a1a;
  --commit-warning-badge-border-color: #3f3f46;

  --box-overflow-shadow-background: linear-gradient(
    180deg,
    rgba(26, 26, 26, 0) 0%,
    #1a1a1a 90%,
    #1a1a1a 100%
  );
  --no-shadow-top: linear-gradient(#1a1a1a, rgba(255, 255, 255, 0));
  --no-shadow-bottom: linear-gradient(rgba(255, 255, 255, 0), #1a1a1a);
  --top-shadow: linear-gradient(
    0deg,
    rgba(26, 26, 26, 0) 0%,
    rgba(0, 0, 0, 0.6) 90%,
    rgba(0, 0, 0, 1) 100%
  );
  --bottom-shadow: linear-gradient(
      180deg,
      rgba(26, 26, 26, 0) 0%,
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
