# Web implementation status

The browser application is source-owned: `app/src/ui/web-index.tsx`,
`app/src/ui/web-app.tsx`, and `app/src/ui/web/` provide the renderer, while the
local companion in `web-server/` performs Git and filesystem work. The browser
does not execute Git itself and does not load the retired desktop snapshot.

## Release scope

The supported release target is Google Chrome on macOS with the loopback local
companion. The product promise is local Git workflows, not full GitHub Desktop
parity. Hosted account UI, Pull Requests, Copilot, repository rules, push
protection, native notifications, and automated Git installation are deferred.

The current, row-level support status and evidence are maintained in
[CAPABILITIES.md](CAPABILITIES.md) and [PARITY-GAPS.md](PARITY-GAPS.md). Do not
duplicate their totals here.

## Current architecture

- `yarn build:web` creates content-hashed assets in `web-server/public/`.
- `yarn start:web` starts the loopback companion.
- The companion owns Git subprocesses, local paths, credential lookup, and
  platform operations.
- The renderer owns browser UI, persisted non-secret preferences, confirmations,
  and operation progress.
- Each browser API request is bound to the loopback origin and a per-process
  session token.

## Credentials

For HTTP(S) remotes, the companion first uses `git credential fill` with the
configured credential helper, including Keychain or Git Credential Manager.
It suppresses terminal and editor askpass prompts so the browser owns the
fallback flow. If authentication still fails, the source renderer displays a
one-time username/password dialog and retries the operation without persisting
the credentials in browser storage or a credential helper.

This is generic Git authentication only. Hosted account sign-in and interactive
SSH trust, passphrase, or username/password prompts remain outside the release
scope.

## Evidence and maintenance rules

- A Supported capability requires a visible source-renderer control, a typed
  companion path, and automated source-renderer evidence.
- Partial rows must state the exact missing platform or product evidence.
- Deferred rows must have no claimed source-renderer support.
- Update [CAPABILITIES.md](CAPABILITIES.md),
  [PARITY-GAPS.md](PARITY-GAPS.md), and [README.md](README.md) with any scope
  change.
- Keep `yarn test:web:docs` green; it validates runtime feature flags, matrix
  statuses, inventory counts, and evidence references.

Run the normal validation set before changing the release claim:

```sh
yarn build:web
yarn test:web
WEB_BROWSER=chrome yarn test:web:release
```

See [RELEASE.md](RELEASE.md) for the production build and release procedure.
