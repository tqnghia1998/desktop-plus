# Fork Overlay (Upstream Sync Checklist)

This fork (`tqnghia1998/desktop-plus`) tracks
[desktop-plus/desktop-plus](https://github.com/desktop-plus/desktop-plus) as
`upstream`. Start with the [patch map](../docs/web-patches.md) for module
ownership and the remaining shared-code hooks. The fork's delta over upstream is:

1. **The web port itself** — documented in [README.md](README.md),
   [CAPABILITIES.md](CAPABILITIES.md), [PARITY-GAPS.md](PARITY-GAPS.md),
   [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md), and
   [RELEASE.md](RELEASE.md).
2. **The Space App Vibing embedding integration** — documented in the table
   below.

When syncing from upstream (`git fetch upstream && git merge upstream/main`),
retain every item in the table, then run the verification at the bottom. Any
new intentional difference added later must be added to this table.

## Intentional differences from upstream

| Intentional difference | Source of truth | Required behavior |
| --- | --- | --- |
| Opt-in iframe embedding | `web-server/src/patches/vibing/embedding.js`, `securityHeaders` in `web-server/server.js` and `web-server/src/http.js`, assertions in `web-server/test-security.js` | When `DESKTOP_PLUS_FRAME_ANCESTORS` is set, responses drop `X-Frame-Options` and the CSP `frame-ancestors` directive lists the configured origins instead of `'none'`; when unset, upstream behavior is identical (`X-Frame-Options: DENY`). Entries containing whitespace, quotes, semicolons, or commas are stripped as a CSP-injection guard. COOP `same-origin`, the loopback `Host` check, and the session-token check are untouched. The env is read per request so tests can set it mid-run. |
| Worktree family in the repository picker | `addRepositoryWithWorktrees` in `app/src/patches/web/contracts.ts` and `app/src/patches/web/store.ts`, called by `useRepositoryQuery` in `app/src/patches/vibing/embedding.ts` | Opening the app with `?repository=<path>` adds the requested repository **plus every sibling worktree** as its own flat repository row, without selecting the siblings; selection stays on the requested path. Siblings are persisted with `lastOpenedAt: 0` and null branches. Relies on the server computing worktrees only for the selected repository (`git worktree list`, main worktree first), so repositories selected before this change gain sibling rows on the next `?repository=` mount. |
| Locked repository/worktree navigation in embeds | `getEmbeddedParentOrigin` in `app/src/patches/vibing/embedding.ts`, wired through `application.tsx` to `toolbar.tsx`, plus the `disabled` prop in `app/src/ui/toolbar/worktree-dropdown.tsx` and assertions in `web-server/test-source-dependencies.js` | A valid `parentOrigin` marks the Vibing embedded mode. It keeps `RepositoryToolbarDropdown` and `WorktreeDropdown` visible but disabled, so the host-selected `?repository=` worktree cannot be changed within the iframe; switch via Vibing workspace tabs instead. A standalone browser tab without `parentOrigin` keeps both controls enabled. |
| Foldout viewport clamp | `app/src/ui/toolbar/dropdown.tsx` (`foldoutWidth` state + `foldoutDiv` ref), delegating geometry to `app/src/patches/web/viewport.ts` | Two-phase measurement: the first render after opening is intentionally unclamped so `offsetWidth` captures the natural foldout width once; then when `rect.left + max(foldoutWidth, rect.width)` overflows `documentElement.clientWidth` (an iframe viewport), `marginLeft` shifts left toward 0 and `maxWidth` is set to the remaining width. `foldoutWidth` resets to null on close. Never measure after clamping (children adapt and the natural width is lost → oscillation). One fix covers the Repository, Branch, and Push/Pull dropdowns (shared `ToolbarDropdown`). Wide desktop windows are unchanged because the shift only triggers on overflow. |
| Narrow-viewport toolbar fit | `webToolbarButtonWidth` (`min: 140`) in `app/src/patches/web/preferences.tsx`, toolbar rules in `app/src/patches/vibing/appearance.css` | In narrow viewports (the embed sits beside a host details panel) the toolbar must not push the trailing Repository/Branch action-menu buttons past the right edge: `#desktop-app-toolbar > *` and `#desktop-app-toolbar .resizable-component` get `flex-shrink: 1`; floors are inline `minWidth: 140` on resizable components and CSS `105px` on `.toolbar-action-menu`. `#desktop-app-toolbar > .sidebar-section` uses `max-width: calc(100vw - 630px)` to leave room for the remaining controls (630px ≈ 3 resizable buttons × 140px + 2 action menus × 105px). The `webToolbarButtonWidth` constant matters because `Resizable` sets `min-width` inline, which CSS cannot override. |
| Space App Vibing theme, typography, and spacing | `:root`, `dialog`, and `body.theme-dark` / `body.theme-light` blocks in `app/src/patches/vibing/appearance.css`, plus the web default `diff-font-size` in `app/src/patches/web/preferences.tsx` (load after `app/styles/web-desktop.scss` and win the cascade) | Maps the Space App Vibing palette onto Desktop Plus's light and dark themes with one role mapping. Each theme has a primitives-only block declaring exactly 13 literal hex values as `--vibing-*` variables (surface/canvas, raised, hover, selected, border, three text tones, blue, green, yellow, red, purple) and nothing else; the values are pinned by Space App Vibing's `docs/theme.md`, and `docs/theme-sites.md` lists every site of each hex. One shared `body.theme-dark, body.theme-light` role block then binds every Desktop Plus variable to those primitives, so the light and dark themes use identical bindings and no hex, no light-only tone and no per-mode percentage appears outside the two primitive blocks (`web-server/test-ui-ownership.js` enforces this). Derived colours are the same expression in both modes: the blue hover is the blue mixed 15% toward the text tone, the `--vibing-<hue>-wash\|wash-strong\|line\|text` tints (diff rows, banners, tags, destructive buttons) mix the hue toward the raised or text tone, the text on an accent fill (`--vibing-on-accent`) is the surface tone, scroll-bar thumbs mix the text tone, shadows are the same black alphas, and the overlay behind dialogs, foldouts and popovers (`--overlay-background-color`, also the list and drag overlays) is the one expression `rgb(from var(--vibing-surface) 0 0 0 / calc(0.64 - g / 885))`: black whose alpha falls as the canvas brightens (0.60 over the dark canvas, 0.35 over the white one; dark drifts at most 1/255 from the old black 0.6 over the canvas, raised, hover and selected tones, light composites to #a5a5a5 over white instead of #666666). Hairline roles (`--box-border-color`, `--toolbar-border-color`, `--toolbar-button-border-color`) use the border primitive, never the hover tone; contrast borders and menu dividers use the selected tone. The role block covers the toolbar, buttons, badges, tooltips, menu panes, skeleton and overflow gradients, diff rows/gutters/word highlights, syntax colours, form/dialog/banner/status/PR colours, toast and the `--md-*` markdown colours, so neither theme falls back to upstream's GitHub values for those. Variables that Desktop Plus declares on `:root` as `var()` references (tab bar, toolbar buttons, app menu, borders, `--base-box-shadow`, commit-message icons, diff text roles and gutters, `--pr-timeline-line-color`) are redeclared in the role block, because a custom property resolves where it is declared. The GitHub CI status colours (`.ci-status-*`, `.merge-status-*`, the CI check popover titles, indicators and donut fills) are overridden for both themes with the yellow, green, red and faint primitives. The semantic type tokens stay 1px larger than desktop defaults and shared `--spacing` remains 10px. Embedded dialogs use a 600px minimum width instead of the desktop 400px floor (the shared responsive rule still fits them below 600px). Web-only controls use 32px buttons, inputs, split-dropdowns, and menu rows, with a 58px toolbar, 36px tabs, 8px radii, 32px branch/worktree dropdown rows, and 50px History commit rows. Embedded Changes, commit-file, and stash-file rows use 32px, stash headers use the normal `--font-size-md` title, one-spacing vertical padding, and a half-spacing title/action gap rather than desktop's `--font-size-xl` title, triple-spacing padding, and full-spacing gaps, and the default diff editor font is 12px (2px below the prior embedded default). The last Branch action button has no trailing border. Web-only: the desktop app is untouched. |
| Host theme mode channel | `app/src/patches/vibing/theme-mode.ts` (with `app/test/unit/vibing-theme-mode-test.tsx`), wired in `useWebDiffPresentationPreferencesState` in `app/src/patches/web/preferences.tsx` | The host loads the frame with `?themeMode=light\|dark` (set once at mount) and later posts `{ type: 'space:theme-mode', mode: 'light' \| 'dark' }` on every mode change and on frame load. `useHostThemeMode` takes its first value synchronously from the query (no flash of the other theme) and accepts a message only when `event.origin === parentOrigin`, `event.source === window.parent` and the data is exactly that shape; everything else is ignored. While a host mode exists it replaces the stored `theme` preference and System detection, nothing is written to `localStorage`, and the Preferences theme change is a no-op; `AppTheme` then swaps `body.theme-dark` and `body.theme-light` live without a reload. Standalone browser tabs (no host mode) keep the stored preference. |
| Role-parity residues and accepted exceptions | `app/src/patches/vibing/appearance.css`, `docs/theme-sites.md` (Role parity section) | Light and dark use one role mapping, with these known exceptions. Fixed: the split-button options menu (`.dropdown-select-button-options`) lost its shadow and gained its 1px offset only in upstream's dark theme; appearance.css now applies both in both modes. Not neutralised: upstream's dark-only `.blankslate-image` filter (`app/styles/themes/_dark.scss`) inverts the illustration for a dark page, and the same expression would break it on the light page, so light keeps the unfiltered artwork; upstream's dark-only `color-scheme: dark` on `#snooze-repository input` (`app/styles/ui/dialogs/_snoozed-repositories.scss`) is already equivalent, because each primitive block sets `color-scheme` on `body` and form controls inherit it. Accepted contrast and elevation residues are listed in `docs/theme-sites.md`. |
| Browser CSS ownership guard | Combined browser-base and Vibing stylesheet content and failure message in `web-server/test-ui-ownership.js` | Two layers. The **palette-alignment block** of the guard is the policy gate: outside the two primitive blocks, `appearance.css` may contain no hex literal, no named or system colour, no `hsl()`/`hwb()`/`lab()`/`lch()`/`oklab()`/`oklch()`/`color()`/`light-dark()`, `rgb()` only as black at the alphas 0.5, 0.6 and 1 or relative to a `var()` role (`rgb(from var(--…) r g b / a)`, plus the one scrim expression `rgb(from var(--vibing-surface) 0 0 0 / calc(0.64 - g / 885))`), `color-mix()` only in `srgb` over `var(--…)` roles and `transparent`, and no `theme-light`/`theme-dark` selector other than the two primitive blocks, the single shared `body.theme-dark, body.theme-light` role block and `body:is(.theme-dark, .theme-light)`. The verbatim copy of the browser base plus `app/src/patches/vibing/appearance.css` pinned in the same file is only a **drift detector**: it makes any stylesheet edit visible in review, but it does not decide whether an edit is allowed (the palette script rewrites its hex literals together with `appearance.css`, which is why it stays a literal, not a hash). Browser CSS may only size the renderer root and shared dialog/menu surfaces, align the light and dark themes and type scale with the Space App Vibing host, and fit the toolbar in narrow viewports. After an intentional stylesheet change, regenerate the pinned literal (`browser-renderer.css`, a blank line, then `appearance.css`, verbatim) and keep the alignment block green. |
| Dimmed disabled menu items | `&:disabled` rule in `.toolbar-action-list button` in `app/styles/ui/toolbar/_action-menu.scss` | Toolbar action-menu items render as plain buttons (native menus dim disabled items automatically, this markup does not), so disabled items must keep `opacity: 0.6` — the app's existing disabled convention (`.button` and links in `app/styles/ui/_button.scss`) — to stay visibly distinct from clickable items. Covers the Repository, Branch, and Push/Pull action menus (shared `ToolbarActionMenu`). |
| Host-triggered state refresh | The `space:desktop-plus-refresh-request` handler in `app/src/patches/vibing/embedding.ts`, guarded by `web-server/test-source-dependencies.js` | A matching trusted parent message refreshes repository data only when Desktop Plus is idle; it never queues a deferred refresh. Queued refreshes run after a user action has opened a modal, replacing its data and dismissing the modal. The Vibing host sends the message after its iframe loads and after a confirmed Git state change—not on a timer. |
| Restored list scroll clamp | `clampScrollTop` in `app/src/patches/web/viewport.ts`, called by `app/src/ui/lib/list/section-list.tsx`, with regression coverage in `app/test/unit/ui/section-list-scroll-test.tsx` | Controlled section lists clamp a restored scroll offset to their current content height and viewport. When a repository's changed-file list becomes shorter, a stale persisted offset cannot place the remaining rows far below the header; valid offsets still restore normally. |
| Vibing runtime bundle | `scripts/bundle-desktop-plus-web.mjs` (+ `bundle:vibing` script) | `npm run build:web && npm run bundle:vibing` writes a self-contained runtime into `../space-app-vibing/scripts/desktop-plus-web/` (committed build output there, shipped inside the vibing app). It copies the require closure of `web-server/server.js` (walks relative + bare requires), `web-server/public/`, `ssh-askpass.js` (spawned by path, never required), and a `package.json` pinning `type: "commonjs"` because vibing's root package.json is ESM. Runtime packages (dugite with embedded git, keytar, ignore, semver and transitive deps) are committed as `runtime-node-modules.tgz`, since Vibing ignores `node_modules`; bare server requires must also resolve from the bundle-root `node_modules`. Directory copying preserves relative symlinks in dugite's git-core, so the archive can move between machines. Vibing packaging expands the archive into the staged server bundle. On macOS the bundler prunes dugite's `git/libexec/git-core` of git-lfs and the .NET runtime behind Git Credential Manager (~120MB): credential flows re-point `GIT_EXEC_PATH` at the system Git (only it carries the osxkeychain helper), and Vibing hosts have no git-lfs. Windows keeps GCM and must not be pruned. The archive carries platform-specific binaries, so each release OS must regenerate it from the pinned committed fork revision via Vibing's `scripts/prepare-desktop-plus-runtime.mjs`; CI does not rely on uncommitted fork edits. |
| Browser-only Copilot App dependency | `app/src/patches/web/preferences.tsx`, `app/src/lib/feature-flag.ts`, `web-server/webpack.config.js`, `web-server/src/desktop-copilot-app-stub.js`, `web-server/src/desktop-process-stub.js`, `web-server/test-source-dependencies.js` | Upstream Preferences imports native Copilot App discovery. The web build aliases that module to a browser-safe stub, supplies the new Preferences props, and disables native handoff in the browser process so no unusable setting appears. Desktop discovery remains unchanged. |
| History query adapter | `app/src/patches/web/history.tsx`, `web-server/test-source-dependencies.js` | Shared History controls require `filteredHistoryCommitSearchQuery` alongside `commitSearchQuery`. The browser History adapter supplies its server-filtered query; the comparison adapter supplies an empty query. Preserve both when upstream changes `ICompareState`. |
| Worktree deletion dialog adapter | `app/src/patches/web/repository-picker.tsx`, `app/src/patches/web/toolbar.tsx` | Browser deletion dialogs supply the shared `options` object. Force retries extract `options.force === true` before sending the companion's boolean flag; the options object itself must never become an implicit force flag. |
| Repository snoozing capability | `app/src/patches/web/repository-picker.tsx`, `app/src/ui/repositories-list/` | The browser passes an empty snoozed-repository map and disables the Snooze menu capability until the companion implements snoozing. Native Desktop retains its Snooze action and dialogs. |
| Auto-install updates preference | `app/src/patches/web/preferences.tsx` | Shared Preferences requires `autoInstallUpdates` (shown only on Windows). The browser companion has no native updater, so it passes `false` and stubs `setAutoInstallUpdates`; native Desktop keeps the setting. |
| Browser JavaScript minimizer | `web-server/webpack.config.js` | Use the upstream Webpack dependency `minimizer-webpack-plugin` and keep comment extraction disabled, so browser builds do not depend on the retired transitive `terser-webpack-plugin` package. |

The browser adapters support upstream multi-commit revert and multi-branch
cherry-pick through the existing tracked Git operations. A cherry-pick batch
holds its repository path, stops on checkout failure, conflict or cancellation,
and leaves earlier successful targets intact; its error survives the final
refresh. The last successful target retains the existing cherry-pick Undo.
Preferences stores **System Default Program** in the existing editor selection,
and the companion opens that target with its native default handler.
`test:web:multi-cherry-pick`, `test:web:api` and `test:web:platform` cover these
contracts.

## Sync verification

```sh
npm run check:web                 # types, format, docs, source-dependencies, ui-ownership
npm run test:web:contract
npm run test:web:payload
npm run test:web:platform
npm run test:web:multi-cherry-pick
npm run test:web:security         # see the pre-existing failure note below
npm run build:web
```

Then one manual browser pass:

1. Start the companion with a comma-separated allowlist, e.g.
   `DESKTOP_PLUS_FRAME_ANCESTORS='http://localhost:5183,http://localhost:8300' node web-server/server.js --port 9611`,
   and confirm `frame-ancestors` lists both origins with no
   `X-Frame-Options` header.
2. Embed `http://127.0.0.1:9611/?repository=<absolute worktree path>&parentOrigin=<host origin>`
   in a ~900px-wide iframe next to a host panel and check: the whole toolbar
   row is visible and every enabled button clickable, repository/worktree
   pickers are visible but disabled, the Branch foldout opens fully inside the viewport, and the dark
   theme matches the Space App Vibing palette, and that appending `&themeMode=light`
   (and posting `{ type: 'space:theme-mode', mode: 'dark' }` from the parent)
   switches the themes live.

## Gotchas

- `DESKTOP_PLUS_FRAME_ANCESTORS` must be **comma-separated**: entries
  containing whitespace are stripped by the sanitizer, so a space-separated
  list silently leaves `frame-ancestors 'none'`.
- `frame-ancestors 'null'` does not reliably match `file://` hosts in Chrome;
  verify embedding from a real HTTP origin.
- `web-server/public/` is generated output (`npm run build:web`); never hand-edit
  it. Space App Vibing serves the built bundle straight from this checkout, so
  rebuild here after any renderer or CSS change.
- `web-server/test-security.js` may abort at line 135
  (`AssertionError 400 !== 415`). This failure is pre-existing on a clean
  tree and unrelated to the overlay; the embedding assertions above it still
  pass.

## Upstream refresh 2026-11-09

Rebased onto Desktop Plus 3.6.11-beta1 (`e86afd65a1`). Browser adapters
provide upstream's account-selection props without a native account catalog.
Clone URL discovery preserves the entered URL through a browser replacement;
the companion still owns cloning and configured Git authentication. The new
changed-file-count preference persists in browser storage and reaches both
the shared Preferences dialog and repository picker.

## Upstream refresh 2026-11-16

Rebased onto Desktop Plus `6fdd9b416a` (v3.6.12.0). The browser History adapter
uses upstream's separate persisted History file-list mode and wires its new
view-mode switch to the native preference helpers. Changes keeps its own mode.

## Upstream refresh 2026-11-23

Rebased the net fork changes onto Desktop Plus `46f7c9cc37` (v3.7.0).
The browser worktree dropdown uses the browser clipboard for upstream's
Copy Worktree Path action and retains the companion's prune action. The
commit graph keeps the fork's flex sizing and upstream's container queries.
