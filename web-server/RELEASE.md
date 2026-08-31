# Web release procedure

## Build and verify

```sh
yarn build:web
yarn test:web
git diff --exit-code -- web-server/public
BUILD_SHA="$(git rev-parse HEAD)" RELEASE_CHANNEL=production yarn build:web
WEB_BROWSER=chrome yarn test:web:release
```

Confirm that `public/build-manifest.json` reports the expected version,
channel, build SHA, and `web` platform. The generated payload must contain only
the source renderer, its CSS, approved runtime assets, and no `unsafe-eval`
CSP exception. The CSP permits the shared renderer's calculated layout values
through the narrowly scoped `style-src-attr` directive; inline scripts and
inline stylesheet elements remain blocked.

Automatic updates are exposed in Repository Tools, but remain Partial until
native artifact and installer execution is evidenced. Publish an
Ed25519-signed manifest and matching artifact checksum before enabling the
configured update channel. The companion downloads and verifies artifacts but
requires the user to explicitly open the verified installer; restart, rollback,
and unattended installation are not release capabilities.

## Browser evidence boundary

Release browser commands must exercise visible source-renderer controls.
`test-browser-api-workflows.js` is retained as historical snapshot-dispatcher
coverage only and is excluded from the release browser suites.

The browser launcher accepts `WEB_BROWSER=chromium`, `chrome`, `edge`,
`firefox`, or `webkit`. The release gate uses `WEB_BROWSER=chrome` on macOS;
the full source-renderer suite and macOS platform smoke tests are required for
that target. CI's additional browser and platform jobs are regression coverage
and are not completion blockers for this narrowed release scope. WebKit is not
Safari application evidence.

## Deferred provider sandbox

The `Web port` workflow retains an opt-in companion/API provider sandbox on its
Tuesday schedule and by manual dispatch. It is not current source-renderer
release evidence because hosted controls remain deferred. Configure one or both
repository secrets to exercise temporary private resources:

- `DESKTOP_PLUS_GITHUB_SANDBOX_TOKEN`
- `DESKTOP_PLUS_GITLAB_SANDBOX_TOKEN`

The runner creates a uniquely named private repository or project, publishes
an initial commit, pushes a feature branch, creates and lists a Pull Request
or merge request, and deletes the remote resource in cleanup. It skips when
no sandbox token is configured. Configure the optional endpoint variables when
validating GitHub Enterprise or self-hosted GitLab.

## Release-candidate verification

`WEB_BROWSER=chrome yarn test:web:release` automates the in-scope evidence:
branded Google Chrome on Darwin, an unprivileged companion process bound to
loopback, a repository with changed files and more than one history page, and
zero browser console errors or uncaught exceptions. Confirm the visible UI
matches [CAPABILITIES.md](CAPABILITIES.md) before release. Native
notifications, hosted provider controls, and automated Git installation remain
deferred. Browser notification permission guidance and macOS filesystem actions
are source-owned and covered by the Chrome/macOS browser fixtures. Editor,
shell, folder-picker, update, and LFS controls require the
companion configuration and evidence described in the source-platform browser
fixture; the platform-sensitive browser fixture uses injected services and
does not replace native editor, shell, filesystem, installer, or Git LFS
execution evidence. The browser application menu and keyboard shortcuts are
covered as a Partial parity surface because the native macOS menu bar remains
outside web renderer ownership.

Do not promote a deferred or partial workflow to Supported until it has a
visible source-renderer control, companion support, automated evidence, and the
required in-scope provider or platform execution evidence.
