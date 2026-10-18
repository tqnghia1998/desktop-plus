# Browser port and Vibing patches

Keep fork-owned behavior in named modules and keep the changes to shared
Desktop Plus components small. This makes an upstream sync reviewable: shared
components expose explicit hooks, while the browser and host policies have
separate owners. Existing Git workflows, saved preferences, and embedded
behavior are preserved by this organization.

## Where to start

| Location | Responsibility |
| --- | --- |
| `app/src/patches/web/index.tsx` | Browser renderer entry point |
| `app/src/patches/web/application.tsx` | Application state, preference wiring, and top-level composition |
| `app/src/patches/web/models.ts` | Convert companion data into shared Desktop models |
| `app/src/patches/web/preferences.tsx` | Saved settings, presentation context, and the shared Preferences dialog adapter |
| `app/src/patches/web/repository.tsx` | Repository layout, operation state, home, and tutorial adapters |
| `app/src/patches/web/repository-picker.tsx` | Repository and worktree picker adapter |
| `app/src/patches/web/repository-dialogs.tsx` | Repository setup, settings, groups, and recovery dialogs |
| `app/src/patches/web/operation-dialogs.tsx` | Authentication, branch, tag, stash, and confirmation dialogs |
| `app/src/patches/web/toolbar.tsx` | Branch, worktree, network, and repository actions |
| `app/src/patches/web/changes.tsx` | Changed files, working diffs, and stash views |
| `app/src/patches/web/history.tsx` | Commit graph, history, selected commits, and comparison views |
| `app/src/patches/web/contracts.ts`, `client.ts`, `platform.ts`, `store.ts` | Typed companion contract, HTTP clients, platform calls, and browser state |
| `app/src/patches/web/keyboard.ts`, `viewport.ts` | Browser input and viewport policies used by shared controls |
| `app/src/patches/vibing/embedding.ts` | Trusted parent origin, host refresh, and worktree query hooks |
| `app/src/patches/vibing/appearance.css` | Vibing colors, typography, compact controls, and narrow toolbar sizing |
| `web-server/src/patches/vibing/embedding.js` | Opt-in CSP framing allowlist |
| `web-server/src/patches/web/git-credentials.js` | Configured Git credential helpers and macOS Keychain lookup environment |
| `web-server/server.js`, `routes/`, `src/desktop-*-stub.js` | Local companion, routes, and browser replacements for native modules |
| `web-server/src/renderer-sources.js` | Source inventory shared by build manifests and browser ownership checks |
| `scripts/bundle-desktop-plus-web.mjs` | Portable runtime packaging for Vibing |

The browser modules render the shared Desktop controls. Their imports flow
through model adapters and preferences into dialogs and views, then into the
application root. Lower-level modules must not import the application root.
Vibing hooks depend on browser contracts only through type imports.

The companion server and browser store remain substantial parts of the web
port. Moving ownership into directories does not remove that implementation
or establish full native Desktop feature parity; see
[`web-server/CAPABILITIES.md`](../web-server/CAPABILITIES.md).

## Remaining shared-code hooks

| Shared code | Why the hook remains |
| --- | --- |
| `ui/toolbar/dropdown.tsx` | Measure an unclamped foldout once, then call `getFoldoutViewportStyle`; keep measurement/reset lifecycle in the component |
| `ui/lib/list/section-list.tsx` | Call `clampScrollTop` when restoring controlled scroll after content shrinks |
| Lists, commit message, diff, and dialog controls | Call the browser keyboard policy for the platform's primary modifier |
| Changes/history file lists and stash headers | Optional row-height and compact-header props let the browser select its density while retaining shared rendering |
| Repository/worktree dropdowns | Optional disabled props keep host-selected navigation locked inside an embed |
| App chrome, repository layout/tabs, toolbar menus, and other shared controls | Composed views and narrow adapter props let the web port reuse the Desktop visual system |
| Feature flags and patch formatting | Browser-native capability gating and the existing partial-selection correctness fix |

Paths in this table are relative to `app/src/`. Shared visual components stay
there so desktop and browser behavior continue to use the same implementation.
New custom policy belongs in a patch module, with an explicit import or prop at
the shared boundary. Avoid runtime monkey patches, a patch registry, and copies
of shared visual components.

## Verification and bundle refresh

Run from the fork checkout:

```sh
yarn check:web
yarn test:web:operation-parity
yarn test:web:payload
yarn test:web:platform
yarn test:web:api
node script/test.mjs app/test/unit/ui/keyboard-test.ts app/test/unit/ui/section-list-scroll-test.tsx
NODE_ENV=production yarn build:web
yarn test:web:contract
```

The UI regression command uses the repository runner to load platform globals
and requires React 16-compatible `@testing-library/react@12.1.5`. If that local
test dependency is missing, install it in a temporary directory and include
its `node_modules`, this checkout's `app/node_modules`, and its `node_modules`
in `NODE_PATH` when running the command.

`check:web` checks all renderer patch sources for types, formatting, native
dependencies, and shared UI ownership. The CSS guard checks the browser base
stylesheet followed by the Vibing stylesheet, preserving the original rule
order and allowed visual scope.

For embedded verification, use the trusted host origin in
`DESKTOP_PLUS_FRAME_ANCESTORS` and open the worktree with `?repository=...` plus
`parentOrigin`. Confirm the pickers are visible and disabled, host refresh
updates the view, and menus fit a narrow frame. Standalone pickers remain
enabled. The full behavior inventory and known security-test baseline are in
[`FORK-OVERLAY.md`](../web-server/FORK-OVERLAY.md).

Build output stays under `web-server/public/`; edit source and rebuild it.
Vibing's runtime pin, renderer, and native archive must refer to the same
committed fork revision when refreshing its bundle. Push that revision before
remote release jobs use the pin. A source refactor does not require publishing
or restarting the user's running companion.
