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

/* Light and dark themes for the Space App Vibing host. The host pushes its
 * resolved mode (see theme-mode.ts); each theme declares the pinned palette
 * once as --vibing-* primitives and every Desktop Plus variable below refers
 * to them. Loaded after web-desktop.scss, so these override the GitHub palettes
 * (including Desktop Plus's own dark toolbar, which the light shell does not
 * keep). */
body.theme-dark {
  color-scheme: dark;

  --vibing-surface: #1d2125;
  --vibing-raised: #24292e;
  --vibing-hover: #2f363d;
  --vibing-selected: #444d56;
  /* Hairlines and outlines: the palette's own border value, never the hover tone. */
  --vibing-border: #2b3137;
  --vibing-text-faint: #959da5;
  --vibing-text-subdued: #d1d5da;
  --vibing-text: #f6f8fa;
  --vibing-blue: #79b8ff;
  --vibing-green: #28a745;
  --vibing-yellow: #f9c513;
  --vibing-red: #f97583;
  --vibing-purple: #b392f0;
  --vibing-on-accent: #1d2125;
  --vibing-blue-hover: color-mix(in srgb, var(--vibing-blue) 85%, white);
  --vibing-surface-clear: rgb(from var(--vibing-surface) r g b / 0);
  --vibing-surface-half: rgb(from var(--vibing-surface) r g b / 0.5);

  --text-color: var(--vibing-text);
  --text-secondary-color: var(--vibing-text-subdued);
  --background-color: var(--vibing-surface);
  --text-secondary-color-muted: var(--vibing-text-faint);
  --color-new: var(--vibing-green);
  --color-deleted: var(--vibing-red);
  --color-modified: var(--vibing-yellow);
  --color-renamed: var(--vibing-blue);
  --color-conflicted: color-mix(
    in srgb,
    var(--vibing-yellow) 55%,
    var(--vibing-red)
  );

  --button-text-color: var(--vibing-on-accent);
  --button-background: var(--vibing-blue);
  --button-hover-background: var(--vibing-blue-hover);
  --link-button-color: var(--vibing-blue);
  --link-button-hover-color: var(--vibing-blue-hover);
  --secondary-button-background: var(--vibing-surface);
  --secondary-button-hover-border-color: var(--vibing-selected);

  --box-background-color: var(--vibing-raised);
  --box-alt-background-color: var(--vibing-surface);
  --box-border-color: var(--vibing-border);
  --box-border-contrast-color: var(--vibing-selected);
  --box-border-accent-color: var(--vibing-blue);
  --box-hover-background-color: var(--vibing-hover);
  --box-selected-background-color: var(--vibing-selected);
  --box-selected-active-background-color: var(--vibing-blue);
  --box-selected-active-text-color: var(--vibing-on-accent);
  --box-skeleton-background-color: var(--vibing-selected);
  --skeleton-background-gradient: -webkit-linear-gradient(
    left,
    var(--vibing-surface-clear) 0%,
    var(--vibing-surface-half) 50%,
    var(--vibing-surface-clear) 100%
  );
  --box-placeholder-color: var(--vibing-text-faint);

  --toolbar-background-color: var(--vibing-surface);
  --toolbar-border-color: var(--vibing-border);
  --toolbar-text-color: var(--vibing-text);
  --toolbar-text-secondary-color: var(--vibing-text-subdued);
  --toolbar-button-border-color: var(--vibing-border);
  --toolbar-button-hover-color: var(--vibing-text);
  --toolbar-button-hover-background-color: var(--vibing-hover);
  --toolbar-button-focus-background-color: var(--vibing-hover);
  --toolbar-button-progress-color: var(--vibing-hover);
  --toolbar-button-focus-progress-color: var(--vibing-selected);
  --toolbar-button-hover-progress-color: var(--vibing-selected);
  --toolbar-badge-background-color: var(--vibing-selected);
  --toolbar-badge-active-background-color: var(--vibing-selected);
  --toolbar-dropdown-open-progress-color: var(--vibing-blue-hover);
  --toolbar-dropdown-text-warning-color: var(--vibing-yellow);
  --toolbar-dropdown-text-hover-color: var(--vibing-text);
  --toolbar-tooltip-background-color: var(--vibing-hover);
  --toolbar-tooltip-shadow-color: rgba(0, 0, 0, 0.5);
  --win32-title-bar-background-color: var(--vibing-surface);

  --app-menu-pane-background-color: var(--vibing-surface);
  --app-menu-divider-color: var(--vibing-selected);
  --app-menu-button-active-background-color: var(--vibing-hover);

  --tab-bar-hover-background-color: var(--vibing-hover);
  --tab-bar-count-background-color: var(--vibing-selected);
  --list-item-badge-color: var(--vibing-text);
  --list-item-badge-background-color: var(--vibing-selected);
  --branch-pill-background-color: var(--vibing-hover);
  --list-item-hover-background-color: var(--vibing-hover);

  --focus-color: var(--vibing-blue);
  --accent-color: var(--vibing-blue-hover);
  --overlay-background-color: rgba(0, 0, 0, 0.6);
  --path-segment-background: var(--vibing-hover);
  --tooltip-background-color: var(--vibing-surface);
  --tooltip-color: var(--vibing-text);
  --tooltip-shadow-color: rgba(0, 0, 0, 0.5);
  --commit-warning-badge-background-color: var(--vibing-raised);
  --commit-warning-badge-border-color: var(--vibing-selected);

  --box-overflow-shadow-background: linear-gradient(
    180deg,
    var(--vibing-surface-clear) 0%,
    var(--vibing-surface) 90%,
    var(--vibing-surface) 100%
  );
  --no-shadow-top: linear-gradient(
    var(--vibing-surface),
    var(--vibing-surface-clear)
  );
  --no-shadow-bottom: linear-gradient(
    var(--vibing-surface-clear),
    var(--vibing-surface)
  );
  --top-shadow: linear-gradient(
    0deg,
    var(--vibing-surface-clear) 0%,
    rgba(0, 0, 0, 0.6) 90%,
    rgba(0, 0, 0, 1) 100%
  );
  --bottom-shadow: linear-gradient(
      180deg,
      var(--vibing-surface-clear) 0%,
      rgba(0, 0, 0, 0.6) 90%,
      rgba(0, 0, 0, 1) 100%
    )
    0 100%;
}

/* Light and dark themes for the Space App Vibing host. The host pushes its
 * resolved mode (see theme-mode.ts); each theme declares the pinned palette
 * once as --vibing-* primitives and every Desktop Plus variable below refers
 * to them. Loaded after web-desktop.scss, so these override the GitHub palettes
 * (including Desktop Plus's own dark toolbar, which the light shell does not
 * keep). */
body.theme-light {
  color-scheme: light;

  --vibing-surface: #d6d8df;
  --vibing-raised: #e6e7ed;
  --vibing-hover: #cbcdd3;
  --vibing-selected: #bfc9df;
  /* Hairlines and outlines: the palette's own border value, never the hover tone. */
  --vibing-border: #c1c2c7;
  --vibing-text-faint: #686a77;
  --vibing-text-subdued: #4c505e;
  --vibing-text: #343b59;
  --vibing-blue: #395d99;
  --vibing-green: #33635c;
  --vibing-yellow: #7e5211;
  --vibing-red: #8c4351;
  --vibing-purple: #7540b1;
  --vibing-on-accent: #ffffff;
  --vibing-blue-hover: color-mix(in srgb, var(--vibing-blue) 85%, black);
  --vibing-surface-clear: rgb(from var(--vibing-surface) r g b / 0);
  --vibing-surface-half: rgb(from var(--vibing-surface) r g b / 0.5);

  --text-color: var(--vibing-text);
  --text-secondary-color: var(--vibing-text-subdued);
  --background-color: var(--vibing-surface);
  --text-secondary-color-muted: var(--vibing-text-faint);
  --color-new: var(--vibing-green);
  --color-deleted: var(--vibing-red);
  --color-modified: var(--vibing-yellow);
  --color-renamed: var(--vibing-blue);
  --color-conflicted: color-mix(
    in srgb,
    var(--vibing-yellow) 55%,
    var(--vibing-red)
  );

  --button-text-color: var(--vibing-on-accent);
  --button-background: var(--vibing-blue);
  --button-hover-background: var(--vibing-blue-hover);
  --link-button-color: var(--vibing-blue);
  --link-button-hover-color: var(--vibing-blue-hover);
  --secondary-button-background: var(--vibing-surface);
  --secondary-button-hover-border-color: var(--vibing-selected);

  --box-background-color: var(--vibing-raised);
  --box-alt-background-color: var(--vibing-surface);
  --box-border-color: var(--vibing-border);
  --box-border-contrast-color: var(--vibing-selected);
  --box-border-accent-color: var(--vibing-blue);
  --box-hover-background-color: var(--vibing-hover);
  --box-selected-background-color: var(--vibing-selected);
  --box-selected-active-background-color: var(--vibing-blue);
  --box-selected-active-text-color: var(--vibing-on-accent);
  --box-skeleton-background-color: var(--vibing-selected);
  --skeleton-background-gradient: -webkit-linear-gradient(
    left,
    var(--vibing-surface-clear) 0%,
    var(--vibing-surface-half) 50%,
    var(--vibing-surface-clear) 100%
  );
  --box-placeholder-color: var(--vibing-text-faint);

  --toolbar-background-color: var(--vibing-surface);
  --toolbar-border-color: var(--vibing-border);
  --toolbar-text-color: var(--vibing-text);
  --toolbar-text-secondary-color: var(--vibing-text-subdued);
  --toolbar-button-border-color: var(--vibing-border);
  --toolbar-button-hover-color: var(--vibing-text);
  --toolbar-button-hover-background-color: var(--vibing-hover);
  --toolbar-button-focus-background-color: var(--vibing-hover);
  --toolbar-button-progress-color: var(--vibing-hover);
  --toolbar-button-focus-progress-color: var(--vibing-selected);
  --toolbar-button-hover-progress-color: var(--vibing-selected);
  --toolbar-badge-background-color: var(--vibing-selected);
  --toolbar-badge-active-background-color: var(--vibing-selected);
  --toolbar-dropdown-open-progress-color: var(--vibing-blue-hover);
  --toolbar-dropdown-text-warning-color: var(--vibing-yellow);
  --toolbar-dropdown-text-hover-color: var(--vibing-text);
  --toolbar-tooltip-background-color: var(--vibing-hover);
  --toolbar-tooltip-shadow-color: rgba(0, 0, 0, 0.16);
  --win32-title-bar-background-color: var(--vibing-surface);

  --app-menu-pane-background-color: var(--vibing-surface);
  --app-menu-divider-color: var(--vibing-selected);
  --app-menu-button-active-background-color: var(--vibing-hover);

  --tab-bar-hover-background-color: var(--vibing-hover);
  --tab-bar-count-background-color: var(--vibing-selected);
  --list-item-badge-color: var(--vibing-text);
  --list-item-badge-background-color: var(--vibing-selected);
  --branch-pill-background-color: var(--vibing-hover);
  --list-item-hover-background-color: var(--vibing-hover);

  --focus-color: var(--vibing-blue);
  --accent-color: var(--vibing-blue-hover);
  --overlay-background-color: rgba(0, 0, 0, 0.4);
  --path-segment-background: var(--vibing-hover);
  --tooltip-background-color: var(--vibing-surface);
  --tooltip-color: var(--vibing-text);
  --tooltip-shadow-color: rgba(0, 0, 0, 0.16);
  --commit-warning-badge-background-color: var(--vibing-raised);
  --commit-warning-badge-border-color: var(--vibing-selected);

  --box-overflow-shadow-background: linear-gradient(
    180deg,
    var(--vibing-surface-clear) 0%,
    var(--vibing-surface) 90%,
    var(--vibing-surface) 100%
  );
  --no-shadow-top: linear-gradient(
    var(--vibing-surface),
    var(--vibing-surface-clear)
  );
  --no-shadow-bottom: linear-gradient(
    var(--vibing-surface-clear),
    var(--vibing-surface)
  );
  --top-shadow: linear-gradient(
    0deg,
    var(--vibing-surface-clear) 0%,
    rgba(0, 0, 0, 0.1) 90%,
    rgba(0, 0, 0, 0.18) 100%
  );
  --bottom-shadow: linear-gradient(
      180deg,
      var(--vibing-surface-clear) 0%,
      rgba(0, 0, 0, 0.1) 90%,
      rgba(0, 0, 0, 0.18) 100%
    )
    0 100%;

  /* Tints of the palette hues for status surfaces (diff rows, banners, tags). They
   * mix toward the raised tone so text and syntax colors keep their contrast. */
  --vibing-red-wash: color-mix(in srgb, var(--vibing-red) 10%, var(--vibing-raised));
  --vibing-red-wash-strong: color-mix(in srgb, var(--vibing-red) 24%, var(--vibing-raised));
  --vibing-red-line: color-mix(in srgb, var(--vibing-red) 45%, var(--vibing-raised));
  --vibing-red-text: color-mix(in srgb, var(--vibing-red) 55%, var(--vibing-text));
  --vibing-green-wash: color-mix(in srgb, var(--vibing-green) 10%, var(--vibing-raised));
  --vibing-green-wash-strong: color-mix(in srgb, var(--vibing-green) 24%, var(--vibing-raised));
  --vibing-green-line: color-mix(in srgb, var(--vibing-green) 45%, var(--vibing-raised));
  --vibing-green-text: color-mix(in srgb, var(--vibing-green) 55%, var(--vibing-text));
  --vibing-blue-wash: color-mix(in srgb, var(--vibing-blue) 10%, var(--vibing-raised));
  --vibing-blue-wash-strong: color-mix(in srgb, var(--vibing-blue) 24%, var(--vibing-raised));
  --vibing-blue-line: color-mix(in srgb, var(--vibing-blue) 45%, var(--vibing-raised));
  --vibing-yellow-wash: color-mix(in srgb, var(--vibing-yellow) 10%, var(--vibing-raised));

  /* Upstream GitHub light values that the light theme used to inherit from :root.
   * The upstream surface was white, so they matched; each now follows its role on
   * the ladder (see docs/theme.md in Space App Vibing). */
  --button-focus-border-color: var(--vibing-blue-line);
  --link-button-selected-hover-color: var(--vibing-on-accent);
  --secondary-button-focus-shadow-color: color-mix(
    in srgb,
    var(--vibing-selected) 75%,
    transparent
  );
  --secondary-button-focus-border-color: var(--vibing-selected);
  --button-destructive-background: var(--vibing-red-wash);
  --button-destructive-border-color: var(--vibing-red-line);
  --button-destructive-text-color: var(--vibing-red-text);
  --button-destructive-hover-background: var(--vibing-red-wash-strong);
  --button-destructive-hover-border-color: var(--vibing-red);
  --button-destructive-focus-background: var(--vibing-red-wash-strong);
  --button-destructive-focus-border-color: var(--vibing-red);
  --badge-icon-color: var(--vibing-on-accent);
  --warning-badge-icon-color: var(--vibing-yellow);
  --input-icon-warning-color: var(--vibing-yellow);
  --input-icon-error-color: var(--vibing-red);
  --input-icon-hover-background-color: var(--vibing-hover);
  --copilot-commit-glow-color: color-mix(
    in srgb,
    var(--vibing-blue) 14%,
    transparent
  );
  --copilot-commit-accent-color: var(--vibing-blue);
  --box-hover-text-color: var(--vibing-text);
  --box-selected-text-color: var(--vibing-text);
  --box-selected-border-color: var(--vibing-text-faint);
  --box-selected-active-border-color: var(--vibing-text-faint);
  --co-author-tag-background-color: var(--vibing-blue-wash);
  --co-author-tag-border-color: var(--vibing-blue-line);
  --commit-warning-badge-border: var(--vibing-selected);
  --list-item-selected-badge-color: var(--vibing-text);
  --list-item-selected-badge-background-color: var(--vibing-raised);
  --list-item-selected-active-badge-color: var(--vibing-text);
  --list-item-selected-active-badge-background-color: var(--vibing-raised);
  --toast-notification-color: var(--vibing-text);
  --toast-notification-background-color: color-mix(
    in srgb,
    var(--vibing-raised) 92%,
    transparent
  );
  --tip-box-background-color: color-mix(
    in srgb,
    var(--vibing-blue) 6%,
    transparent
  );
  --tip-box-border-color: var(--vibing-blue-line);
  --text-field-focus-shadow-color: color-mix(
    in srgb,
    var(--vibing-blue) 25%,
    transparent
  );
  --primary-suggested-action-background: var(--vibing-blue-wash);
  --primary-suggested-action-border-color: var(--vibing-blue-line);
  --suggested-action-icon-color: var(--vibing-blue);
  --path-segment-background-focus: var(--vibing-blue-wash-strong);
  --title-tool-tip-background-color: var(--vibing-raised);

  --diff-text-color: var(--vibing-text);
  --diff-alt-text-color: var(--vibing-text-subdued);
  --diff-border-color: var(--vibing-border);
  --diff-gutter-color: var(--vibing-border);
  --diff-line-number-color: var(--vibing-text-subdued);
  --diff-linenumber-focus-color: var(--vibing-blue);
  --diff-selected-background-color: var(--vibing-blue-hover);
  --diff-selected-border-color: var(--vibing-blue-hover);
  --diff-selected-gutter-color: var(--vibing-blue-hover);
  --diff-add-background-color: var(--vibing-green-wash);
  --diff-add-border-color: var(--vibing-green-line);
  --diff-add-gutter-color: var(--vibing-green-line);
  --diff-add-gutter-background-color: var(--vibing-green-wash-strong);
  --diff-add-inner-background-color: var(--vibing-green-wash-strong);
  --diff-delete-background-color: var(--vibing-red-wash);
  --diff-delete-border-color: var(--vibing-red-line);
  --diff-delete-gutter-color: var(--vibing-red-line);
  --diff-delete-gutter-background-color: var(--vibing-red-wash-strong);
  --diff-delete-inner-background-color: var(--vibing-red-wash-strong);
  --diff-hunk-background-color: var(--vibing-blue-wash);
  --diff-hunk-border-color: var(--vibing-blue-line);
  --diff-hunk-gutter-color: var(--vibing-blue-line);
  --diff-hunk-gutter-background-color: var(--vibing-blue-wash-strong);
  --diff-hunk-text-color: var(--vibing-text-subdued);
  --diff-hover-background-color: var(--vibing-blue);
  --diff-hover-border-color: var(--vibing-blue-hover);
  --diff-hover-gutter-color: var(--vibing-blue-hover);
  --diff-add-hover-background-color: var(--vibing-green-line);
  --diff-add-hover-border-color: var(--vibing-green);
  --diff-add-hover-gutter-color: var(--vibing-green);
  --diff-delete-hover-background-color: var(--vibing-red-line);
  --diff-delete-hover-border-color: var(--vibing-red);
  --diff-delete-hover-gutter-color: var(--vibing-red);
  --diff-empty-row-background-color: var(--vibing-raised);
  --diff-empty-hunk-handle: var(--vibing-selected);

  --syntax-variable-color: var(--vibing-purple);
  --syntax-alt-variable-color: var(--vibing-text);
  --syntax-keyword-color: var(--vibing-red);
  --syntax-atom-color: var(--vibing-blue);
  --syntax-string-color: var(--vibing-yellow);
  --syntax-qualifier-color: var(--vibing-purple);
  --syntax-type-color: var(--vibing-red);
  --syntax-comment-color: var(--vibing-text-faint);
  --syntax-tag-color: var(--vibing-green);
  --syntax-attribute-color: var(--vibing-purple);
  --syntax-link-color: var(--vibing-blue);
  --syntax-header-color: var(--vibing-blue);
  --syntax-quote-color: var(--vibing-green);

  --error-color: var(--vibing-red);
  --form-error-background: var(--vibing-red-wash);
  --form-error-border-color: var(--vibing-red-line);
  --form-error-text-color: var(--vibing-red-text);
  --input-error-text-color: var(--vibing-red);
  --dialog-banner-success-background: var(--vibing-green-wash);
  --dialog-banner-success-border-color: var(--vibing-green-line);
  --dialog-banner-success-text-color: var(--vibing-green-text);
  --dialog-warning-color: var(--vibing-yellow);
  --dialog-information-color: var(--vibing-blue);
  --dialog-error-color: var(--vibing-red);
  --dialog-progress-background: var(--vibing-green);
  --banner-warning-background: var(--vibing-yellow-wash);
  --banner-warning-link-color: var(--vibing-blue);
  --banner-warning-icon-color: var(--vibing-yellow);
  --file-warning-background-color: var(--vibing-yellow-wash);
  --file-warning-color: var(--vibing-yellow);
  --file-warning-border-color: color-mix(
    in srgb,
    var(--vibing-yellow) 40%,
    transparent
  );
  --status-pending-color: var(--vibing-yellow);
  --status-error-color: var(--vibing-red);
  --status-success-color: var(--vibing-green);
  --pr-open-icon-color: var(--vibing-green);
  --pr-draft-icon-color: var(--vibing-text-faint);
  --pr-changes-requested-icon-color: var(--vibing-on-accent);
  --pr-changes-requested-icon-background-color: var(--vibing-red);
  --pr-approved-icon-color: var(--vibing-on-accent);
  --pr-approved-icon-background-color: var(--vibing-green);
  --pr-commented-icon-background-color: var(--vibing-selected);
  --unpushed-branch-color: var(--vibing-yellow);
  --call-to-action-bubble-border-color: var(--vibing-green);
  --call-to-action-bubble-color: var(--vibing-green);

  --md-border-default-color: var(--vibing-border);
  --md-border-muted-color: var(--vibing-border);
  --md-canvas-default-color: var(--vibing-surface);
  --md-canvas-subtle-color: var(--vibing-raised);
  --md-fg-default-color: var(--vibing-text);
  --md-fg-muted-color: var(--vibing-text-subdued);
  --md-danger-fg-color: var(--vibing-red);
  --md-neutral-muted-color: color-mix(
    in srgb,
    var(--vibing-text-faint) 20%,
    transparent
  );
  --md-accent-emphasis-color: var(--vibing-blue);
  --md-accent-fg-color: var(--vibing-blue);
}

/* Desktop Plus declares these on :root as var() references, and a custom
 * property resolves where it is declared, so the :root values would ignore the
 * theme blocks above. Redeclare them on the body so they follow the active
 * theme (themes/_dark.scss does the same for the dark ones). */
body.theme-dark,
body.theme-light {
  --tab-bar-active-color: var(--vibing-blue);
  --tab-bar-background-color: var(--box-background-color);
  --tab-bar-count-color: var(--text-color);

  --secondary-button-border-color: var(--box-border-contrast-color);
  --secondary-button-hover-background: var(--secondary-button-background);
  --secondary-button-text-color: var(--text-color);

  --toolbar-button-color: var(--toolbar-text-color);
  --toolbar-button-secondary-color: var(--toolbar-text-secondary-color);
  --toolbar-button-hover-border-color: var(--toolbar-button-border-color);
  --toolbar-button-active-color: var(--text-color);
  --toolbar-button-active-background-color: var(--background-color);
  --toolbar-button-active-border-color: var(--background-color);

  --app-menu-button-color: var(--toolbar-text-color);
  --app-menu-button-hover-color: var(--toolbar-button-hover-color);
  --app-menu-button-hover-background-color: var(
    --toolbar-button-hover-background-color
  );
  --app-menu-button-active-color: var(--text-color);
  --app-menu-pane-color: var(--text-color);
  --app-menu-pane-secondary-color: var(--text-secondary-color);

  --base-border: 1px solid var(--box-border-color);
  --contrast-border: 1px solid var(--box-border-contrast-color);
  --banner-warning-text-color: var(--text-color);
  --diff-add-hover-text-color: var(--text-color);
  --diff-delete-hover-text-color: var(--text-color);
  --box-overflow-shadow-background-two: var(--no-shadow-top),
    var(--no-shadow-bottom) 0 100%, var(--top-shadow), var(--bottom-shadow);
}

body.theme-light {
  --commit-message-action-button-separator-color: var(--box-border-color);
  /* Declared on :root as var() references, so without these two the light diff gutter resolved
   * there to upstream's white page colour, and the gutter of an empty row to its own raised tone.
   * Dark's gutters are the canvas (themes/_dark.scss redeclares them), so light's are too. */
  --diff-gutter-background-color: var(--background-color);
  --diff-empty-row-gutter-background-color: var(--diff-gutter-background-color);
  --pr-timeline-line-color: var(--box-border-contrast-color);
}

/* Upstream hard-codes the GitHub CI status colours for a white page (pending
 * #dbab09 is 1.5:1 and success #28a745 2.2:1 on the light canvas). Light uses
 * the palette hues instead, so status icons keep 3:1 and the check titles 4.5:1;
 * dark keeps the upstream colours. */
body.theme-light .ci-status-pending,
body.theme-light .toolbar-dropdown.open .ci-status-pending,
body.theme-light .merge-status-component .merge-status-loading,
body.theme-light
  .ci-check-list-popover
  .ci-check-run-list-header
  .ci-check-run-list-title-container
  .title
  .pending {
  color: var(--vibing-yellow);
}

body.theme-light .ci-status-timed-out,
body.theme-light .ci-status-action-required,
body.theme-light .ci-status-failure,
body.theme-light .toolbar-dropdown.open .ci-status-failure,
body.theme-light .merge-status-component .merge-status-invalid,
body.theme-light
  .ci-check-list-popover
  .ci-check-run-list-header
  .ci-check-run-list-title-container
  .title
  .failure,
body.theme-light
  .ci-check-list-popover
  .ci-check-run-list-header
  .completeness-indicator
  .completeness-indicator-error {
  color: var(--vibing-red);
}

body.theme-light .ci-status-success,
body.theme-light .toolbar-dropdown.open .ci-status-success,
body.theme-light .merge-status-component .merge-status-clean,
body.theme-light
  .ci-check-list-popover
  .ci-check-run-list-header
  .completeness-indicator
  .completeness-indicator-success {
  color: var(--vibing-green);
}

body.theme-light .ci-status-cancelled,
body.theme-light .ci-status-stale,
body.theme-light .ci-status-skipped,
body.theme-light .ci-status-neutral {
  color: var(--vibing-text-faint);
}

body.theme-light
  .ci-check-list-popover
  .ci-check-run-list-header
  .completeness-indicator
  .donut
  > .error,
body.theme-light
  .ci-check-list-popover
  .ci-check-run-list-header
  .completeness-indicator
  .donut
  > .cancelled,
body.theme-light
  .ci-check-list-popover
  .ci-check-run-list-header
  .completeness-indicator
  .donut
  > .action_required,
body.theme-light
  .ci-check-list-popover
  .ci-check-run-list-header
  .completeness-indicator
  .donut
  > .timed_out,
body.theme-light
  .ci-check-list-popover
  .ci-check-run-list-header
  .completeness-indicator
  .donut
  > .failure {
  fill: var(--vibing-red);
}

body.theme-light
  .ci-check-list-popover
  .ci-check-run-list-header
  .completeness-indicator
  .donut
  > .expected,
body.theme-light
  .ci-check-list-popover
  .ci-check-run-list-header
  .completeness-indicator
  .donut
  > .queued,
body.theme-light
  .ci-check-list-popover
  .ci-check-run-list-header
  .completeness-indicator
  .donut
  > .in_progress,
body.theme-light
  .ci-check-list-popover
  .ci-check-run-list-header
  .completeness-indicator
  .donut
  > .waiting,
body.theme-light
  .ci-check-list-popover
  .ci-check-run-list-header
  .completeness-indicator
  .donut
  > .requested,
body.theme-light
  .ci-check-list-popover
  .ci-check-run-list-header
  .completeness-indicator
  .donut
  > .pending {
  fill: var(--vibing-yellow);
}

body.theme-light
  .ci-check-list-popover
  .ci-check-run-list-header
  .completeness-indicator
  .donut
  > .success {
  fill: var(--vibing-green);
}

body.theme-light
  .ci-check-list-popover
  .ci-check-run-list-header
  .completeness-indicator
  .donut
  > .neutral,
body.theme-light
  .ci-check-list-popover
  .ci-check-run-list-header
  .completeness-indicator
  .donut
  > .stale,
body.theme-light
  .ci-check-list-popover
  .ci-check-run-list-header
  .completeness-indicator
  .donut
  > .skipped {
  fill: var(--vibing-text-faint);
}
`,
  'Browser CSS may only size the renderer root, position shared menus and\n' +
    'dialogs, align the light and dark themes with the Space App Vibing host, and fit\n' +
    'the toolbar in narrow viewports'
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
