# Fork Overlay (Upstream Sync Checklist)

This fork (`tqnghia1998/desktop-plus`) tracks
[desktop-plus/desktop-plus](https://github.com/desktop-plus/desktop-plus) as
`upstream`. The fork's delta over upstream is:

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
| Opt-in iframe embedding | `web-server/src/embedding.js` (new file), `securityHeaders` in `web-server/server.js` and `web-server/src/http.js`, assertions in `web-server/test-security.js` | When `DESKTOP_PLUS_FRAME_ANCESTORS` is set, responses drop `X-Frame-Options` and the CSP `frame-ancestors` directive lists the configured origins instead of `'none'`; when unset, upstream behavior is identical (`X-Frame-Options: DENY`). Entries containing whitespace, quotes, semicolons, or commas are stripped as a CSP-injection guard. COOP `same-origin`, the loopback `Host` check, and the session-token check are untouched. The env is read per request so tests can set it mid-run. |
| Worktree family in the repository picker | `addRepositoryWithWorktrees` in `app/src/ui/web/contracts.ts` and `app/src/ui/web/store.ts`, called by the `?repository=` effect in `app/src/ui/web-app.tsx` | Opening the app with `?repository=<path>` (the Space App Vibing embed flow) adds the requested repository **plus every sibling worktree** as its own flat repository row, without selecting the siblings; selection stays on the requested path. Siblings are persisted with `lastOpenedAt: 0` and null branches. Relies on the server computing worktrees only for the selected repository (`git worktree list`, main worktree first), so repositories selected before this change gain sibling rows on the next `?repository=` mount. |
| Foldout viewport clamp | `app/src/ui/toolbar/dropdown.tsx` (`foldoutWidth` state + `foldoutDiv` ref in `getFoldoutStyle`) | Two-phase measurement: the first render after opening is intentionally unclamped so `offsetWidth` captures the natural foldout width once; then when `rect.left + max(foldoutWidth, rect.width)` overflows `documentElement.clientWidth` (an iframe viewport), `marginLeft` shifts left toward 0 and `maxWidth` is set to the remaining width. `foldoutWidth` resets to null on close. Never measure after clamping (children adapt and the natural width is lost → oscillation). One fix covers the Repository, Branch, and Push/Pull dropdowns (shared `ToolbarDropdown`). Wide desktop windows are unchanged because the shift only triggers on overflow. |
| Narrow-viewport toolbar fit | `webToolbarButtonWidth` (`min: 140`) in `app/src/ui/web-app.tsx`, toolbar rules in `web-server/src/browser-renderer.css` | In narrow viewports (the embed sits beside a host details panel) the toolbar must not push the trailing Repository/Branch action-menu buttons past the right edge: `#desktop-app-toolbar > *` and `#desktop-app-toolbar .resizable-component` get `flex-shrink: 1`; floors are `min-width: 140px` on resizable components and `105px` on `.toolbar-action-menu`. `#desktop-app-toolbar > .sidebar-section` and `#repository-sidebar` share the identical clamp `max-width: calc(100vw - 630px)` because both size from the same persisted `sidebarWidth` value (630px ≈ 3 resizable buttons × 140px + 2 action menus × 105px). The `webToolbarButtonWidth` constant matters because `Resizable` sets `min-width` inline, which CSS cannot override. |
| Space App Vibing dark theme | `body.theme-dark` override block in `web-server/src/browser-renderer.css` (loads after `app/styles/web-desktop.scss` and wins the cascade) | Maps the GitHub dark palette onto the Space App Vibing Metro tokens: `#1a1a1a` surfaces, `#2d2d30` hover, `#3f3f46` selected/badges, `#252526` secondary buttons/menu panes/tooltips, `#222225`/`#2c2c30` borders, `#ffffff`/`#a0a0a0` text, `#3a96dd` accent (`#55a8e3` hover), plus the skeleton and box-edge gradients rebuilt around `rgba(26, 26, 26, …)`. Web-only: the desktop app is untouched. |
| Browser CSS ownership guard | Expected `browser-renderer.css` content and failure message in `web-server/test-ui-ownership.js` | The guard pins the exact browser-renderer.css content; its policy is that browser CSS may only size the renderer root, position the shared menu, align the dark theme with the Space App Vibing host, and fit the toolbar in narrow viewports. After any `browser-renderer.css` change, regenerate the expected string from the file. |
| Dimmed disabled menu items | `&:disabled` rule in `.toolbar-action-list button` in `app/styles/ui/toolbar/_action-menu.scss` | Toolbar action-menu items render as plain buttons (native menus dim disabled items automatically, this markup does not), so disabled items must keep `opacity: 0.6` — the app's existing disabled convention (`.button` and links in `app/styles/ui/_button.scss`) — to stay visibly distinct from clickable items. Covers the Repository, Branch, and Push/Pull action menus (shared `ToolbarActionMenu`). |
| Vibing runtime bundle | `scripts/bundle-desktop-plus-web.mjs` (+ `bundle:vibing` script) | `yarn build:web && yarn bundle:vibing` writes a self-contained runtime into `../space-app-vibing/scripts/desktop-plus-web/` (committed build output there, shipped inside the vibing app). It copies the require closure of `web-server/server.js` (walks relative + bare requires), `web-server/public/`, `ssh-askpass.js` (spawned by path, never required), the runtime packages (dugite with embedded git, keytar, ignore, semver and transitive deps), and a `package.json` pinning `type: "commonjs"` because vibing's root package.json is ESM. On macOS the bundler prunes dugite's `git/libexec/git-core` of git-lfs and the .NET runtime behind Git Credential Manager (~120MB): credential flows re-point `GIT_EXEC_PATH` at the system Git (only it carries the osxkeychain helper), and Vibing hosts have no git-lfs. Windows keeps GCM and must not be pruned. The output carries platform-specific binaries, so each release OS must re-run the bundler from a checkout on that OS. |

## Sync verification

```sh
yarn check:web                 # types, format, docs, source-dependencies, ui-ownership
yarn test:web:contract
yarn test:web:payload
yarn test:web:platform
yarn test:web:security         # see the pre-existing failure note below
yarn build:web
```

Then one manual browser pass:

1. Start the companion with a comma-separated allowlist, e.g.
   `DESKTOP_PLUS_FRAME_ANCESTORS='http://localhost:5183,http://localhost:8300' node web-server/server.js --port 9611`,
   and confirm `frame-ancestors` lists both origins with no
   `X-Frame-Options` header.
2. Embed `http://127.0.0.1:9611/?repository=<absolute worktree path>` in a
   ~900px-wide iframe next to a host panel and check: the whole toolbar row is
   visible and every button clickable, the Repository/Branch foldouts open
   fully inside the viewport, sibling worktrees appear as repository rows, and
   the dark theme matches the Space App Vibing palette.

## Gotchas

- `DESKTOP_PLUS_FRAME_ANCESTORS` must be **comma-separated**: entries
  containing whitespace are stripped by the sanitizer, so a space-separated
  list silently leaves `frame-ancestors 'none'`.
- `frame-ancestors 'null'` does not reliably match `file://` hosts in Chrome;
  verify embedding from a real HTTP origin.
- `web-server/public/` is generated output (`yarn build:web`); never hand-edit
  it. Space App Vibing serves the built bundle straight from this checkout, so
  rebuild here after any renderer or CSS change.
- `web-server/test-security.js` may abort at line 135
  (`AssertionError 400 !== 415`). This failure is pre-existing on a clean
  tree and unrelated to the overlay; the embedding assertions above it still
  pass.
