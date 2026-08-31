# Web Git parity plan

## Objective

Make the browser-delivered web application a source-owned renderer with the
advertised Desktop Git workflows, then prove each advertised provider, browser,
and companion platform works. The local companion remains the sole executor of
Git and filesystem operations; the browser must not reimplement Git.

## Baseline and architectural decision

The original web implementation was built from
`web-server/vendor/desktop-app.template.js`, with browser shims and
`src/bootstrap.js` injected. That historical runtime had broad Git-operation
coverage but was not source-owned.

`app/src/ui/web-index.tsx`, `app/src/ui/web-app.tsx`, and `app/src/ui/web/` are
the shipped source renderer. Its visible UI currently covers repository setup,
Changes/History, branch and sync controls, and local Repository Tools.
Hosted, Copilot, notification, and automated Git-installation workflows remain
deferred. The source renderer now exposes companion-backed folder-picker,
editor/shell, verified-update, and Git LFS controls. Their browser fixtures
validate injected companion contracts; native process, installer, filesystem,
and Git LFS execution evidence remains a tracked partial limitation.

**Current product decision:** the release makes an explicit narrower promise of
source-owned local Git workflows. Hosted/provider and platform integrations
remain deferred until their source controls and evidence are complete.

**Current execution scope:** for this release gate, the promised browser target
is branded Google Chrome with the local companion on macOS. Firefox, Edge,
Safari, Windows, and Linux evidence may remain informative or incomplete
without blocking completion. Native notifications, hosted providers, and
automated Git installation are not part of the release promise.

The generated asset is now built from `app/src/ui/web-index.tsx`; the vendored
desktop snapshot and snapshot provenance are not production dependencies.

The complete desktop-versus-web audit is recorded in
[PARITY-GAPS.md](PARITY-GAPS.md). It is the detailed companion to the
capability matrix and distinguishes partial local behavior from intentionally
deferred provider and platform behavior.

## Scope and non-goals

In scope:

- Source-owned UI for the companion Git-operation surface.
- GitHub/GitLab feature and verification closure.
- Desktop-provider parity or an explicit, product-approved narrower provider
  promise.
- Browser and operating-system verification for the approved release target.
- Build, documentation, contract, and release evidence that cannot drift.

Out of scope:

- Reproducing Electron lifecycle, unrestricted browser filesystem access,
  native application menus, or a second Git implementation in TypeScript.
- Marking a feature supported solely because the companion has an endpoint.

## Principles and release rules

- Reuse the existing companion allowlist and schemas. Add a typed web adapter;
  do not duplicate Git command logic in the renderer.
- Preserve confirmation for destructive actions, credential isolation, secret
  redaction, cancellation, and recoverable conflict state.
- A capability is **Supported** only if a visible source-renderer control, its
  companion path, and automated evidence exist. Real-provider and interactive
  OS behavior additionally needs current execution evidence.
- **Partial** must name a concrete limitation and owner; use **Deferred** for
  product exclusions and remove the related visible controls.
- Every phase updates `CAPABILITIES.md`, this plan, relevant README text, and
  regression tests in the same change.

| Priority | Meaning |
| --- | --- |
| P0 | Required before the source renderer or a core Git workflow can ship. |
| P1 | Required before declaring an advertised capability fully supported. |
| P2 | Optional product work; may remain Deferred with no visible control. |

## Work breakdown

### 1. Reconcile build architecture — P0

**Tracked task:** #2

Make one implementation authoritative.

1. Trace `yarn build:web` from `package.json` to the JavaScript and CSS assets
   loaded by `web-server/public/index.html`.
2. Change the production build to compile and load `app/src/ui/web-index.tsx`.
3. Port the source renderer only as the following phases make it functional,
   then remove the vendored snapshot, injected snapshot shims, and provenance.
4. Update `build-manifest.json`, `test-contract.js`, README, and capability
   wording so they agree with the actual build.
5. Add a build test that proves the loaded application asset is source-renderer
   output and fails if the snapshot is imported again.

#### Exit criteria

- The production browser asset is traceable to the source web entry.
- No docs claim snapshot removal while the build imports a snapshot.
- The manifest and reproducibility tests describe the build actually shipped.

#### Current status

Complete. `yarn build:web`, `yarn test:web:contract`, and the source dependency
and reproducibility checks trace the shipped asset to the source entry.

### 2. Define typed local Git parity contracts — P0

**Tracked task:** #3; depends on #2

Expand `app/src/ui/web/contracts.ts`, `client.ts`, and `store.ts` to expose the
existing companion operations needed by the source UI:

- changes: include/exclude files or supported patch selections, commit/amend,
  discard, reset, revert, and conflict resolution;
- sync: fetch, pull, push, publish, force-push confirmation and retry;
- branches: create, checkout, rename, delete, reset-upstream, and
  remote-branch deletion;
- stashes, remotes, tags, clone/init, and submodules;
- merge, rebase, cherry-pick, continue/skip/abort recovery;
- guarded reorder/squash/undo history rewrites; and
- worktree create, switch, move, and removal.

Build a contract-parity test from the companion allowlist. Any operation not
exposed must be a deliberate, documented exception—not accidental drift.

#### Contract exit criteria

- Typed contracts cover all intended web operations.
- CI detects a mismatch among the companion allowlist, source client, store,
  and documented intentional exclusions.

#### Current status

Complete for the 55-operation companion allowlist. The typed source contract,
client adapter, store forwarding, and intentional-exclusion test are aligned.

### 3. Port Changes and Commit workflows — P0

**Tracked task:** #4; depends on #3

Implement accessible source UI for:

- file include/exclude and existing supported line/hunk selection;
- commit message, amend, sign-off, no-verify confirmation, and co-authors where
  the shared desktop semantics already support them;
- discard/reset/revert with explicit data-loss confirmation; and
- in-progress conflict resolution, continue, skip, and abort where valid.

Use existing diff models and shared dialogs where practical. Do not add a new
Git abstraction or a generic workflow framework.

#### Evidence

Visible browser tests must perform a normal commit, supported partial commit,
discard/reset/revert, and one conflict recovery flow using temporary
repositories. Tests must not call the snapshot dispatcher.

#### Current status

The source-renderer tests cover selected text-diff patch commit, sign-off and no-verify
confirmation, discard cancellation and confirmation, reset, revert, revert
conflict recovery after refresh, merge conflict recovery, working-directory and
committed-file diff inspection, selected-history branch/tag/detached-checkout
actions, paginated history, and Ahead/Behind branch comparison. Broader change
flows remain outside the local-only release promise.

### 4. Port synchronization and Branch workflows — P0

**Tracked task:** #5; depends on #3

Implement source controls for:

- fetch, pull, push, publish, ahead/behind state, and safe retry;
- force-push confirmation;
- branch create, switch, rename, delete, reset-upstream, and remote deletion;
- pull merge/rebase recovery and clear hosted/authenticated error guidance.

#### Synchronization evidence

Visible browser workflows cover local synchronization, branch lifecycle, a
rejected operation, and recovery. Hosted/authenticated synchronization remains
outside the current local-only product promise.

#### Current status

Source-renderer evidence covers create-and-checkout branch lifecycle, local push
rejection and recovery, pull, guarded reset-and-pull with dirty-change stashing,
force-push-with-lease confirmation, remote-branch deletion, publishing an
untracked branch, remote-only branch checkout as a local tracking branch, and
fast-forwarding a non-current tracking branch against disposable local remotes.
The source renderer also supports clean and conflicted squash merges through
the existing Changes conflict resolver and confirmed bulk deletion of merged
local branches, excluding branches checked out in other worktrees. This
capability is Supported for the local-only release. Hosted/authenticated
synchronization remains outside the current product promise and has no
source-renderer controls.

### 5. Port advanced local Git workflows — P1

**Tracked task:** #6; depends on #4 and #5

Implement the smallest source UI covering:

- stash create, inspect, apply, pop, drop, rename, and conflict recovery;
- remote add/set URL/remove and annotated tag create/delete;
- worktree create/switch/move/remove;
- clone/init and submodule entry/open;
- merge, rebase, cherry-pick, revert, and their continuation/abort paths; and
- guarded interactive reorder/squash with native-equivalent undo safeguards.

Do not expose arbitrary manually edited interactive-rebase todo commands.

#### Advanced workflow evidence

Each family has a browser test driven through a visible control; each
conflict-capable family has a recovery/error test.

#### Current status

Source-renderer evidence covers stash create/inspect/diff/rename/apply/pop/drop
and stash-pop conflict recovery, remote add/set/remove, annotated tag creation,
worktree create/open/switch/move/remove, submodule open/update controls,
selected Behind-comparison commit cherry-pick confirmation, merge/rebase/cherry-pick
conflict recovery, force-push, remote-branch deletion, local push rejection
recovery, pull, merge abort, rebase skip, revert conflict recovery after a
refresh, and guarded reorder/squash rewrites with exact placement, editable
squash messages, and exact-tip undo. The in-progress operation capability is
Supported for the local-only
release. Hosted or platform-specific evidence is not implied by the
companion/API tests.

### 6. Finish advanced advertised features — P1/P2

**Tracked task:** #7; depends on #4 and #5

For Git LFS, GitHub repository rules/push protection, and Copilot:

- complete missing source UI, cancellation, error mapping, and secure state;
- preserve credentials outside browser storage and never persist bypass secrets;
- add applying an accepted Copilot conflict proposal only if its behavior is
  safely reviewable and tested;
- obtain real-provider evidence for claimed behavior.

If execution evidence or a secure source UI is not feasible, mark the feature
Deferred and omit its control instead of retaining indefinite Partial status.

#### Current status

Git LFS, verified updates, editor/shell launch, and folder selection now have
visible source controls, typed companion paths, confirmation/cancellation
handling where applicable, and Chrome evidence. The browser fixtures use
injected companion services for platform-sensitive execution, so editor/shell
processes, installer handoff, filesystem actions, and native Git LFS execution
remain Partial pending macOS evidence. Copilot, repository rules, push
protection, and real-provider behavior remain Deferred.

### 7. Close hosting-provider parity or approve a narrower product scope — P1

**Tracked task:** #8; depends on #2

GitHub.com/GitHub Enterprise and GitLab.com/self-hosted GitLab need isolated
real-provider verification. Desktop additionally supports Bitbucket,
Forgejo/Codeberg, and Gitea; web currently defers them.

For each provider required for parity, implement:

1. endpoint normalization and isolated credential storage;
2. account validation, clone/publish/push and repository association;
3. pull-request-equivalent workflows only where the provider supports them;
4. source-renderer controls, provider-specific errors, fixture contracts, and
   isolated sandbox coverage; and
5. accurate provider-specific capability limitations.

#### Product gate

If these providers are not worth implementing, approve a narrower web support
statement, leave them Deferred, and remove all controls. Do not call the
result full desktop-provider parity.

#### Current status

The narrower product scope is approved for this release: GitHub, GitHub
Enterprise, GitLab, Bitbucket, Forgejo/Codeberg, and Gitea are Deferred in the
capability matrix because the source renderer exposes no hosted controls.

### 8. Verify browsers and companion platforms — P1

**Tracked task:** #9; depends on #2

Establish CI and release-candidate evidence for:

| Area | macOS | Windows | Linux |
| --- | --- | --- | --- |
| Credential create/delete | Required | Required | Required |
| HTTPS and SSH Git operations | Required | Required | Required |
| Open/save folder dialogs | Required | Required | Required |
| Reveal, default-open, trash | Required | Required | Required |
| Editor and shell launch | Required | Required | Required |
| Browser notifications | Required | Required | Required |
| Unicode, spaces, long paths, cancellation | Required | Required | Required |

For the approved release target, browser evidence is required for branded
Chrome on macOS. Edge, Firefox, Safari, Windows, and Linux remain useful
regression targets but are not completion gates for this release. Any
unsupported out-of-scope combination may remain Partial, Deferred, or Missing
with an accurate explanation. Linux missing-dependency guidance (`zenity`,
`xdg-open`, `gio`) remains covered by the existing regression tests.

#### Current status

The source-renderer browser launcher now selects Chromium, branded Chrome,
branded Edge, Firefox, or WebKit through `WEB_BROWSER`. The release gate uses
the installed branded Chrome binary on the actual macOS host, and the full
source-renderer suite plus macOS platform smoke tests pass for that target.
Other browser and operating-system jobs remain useful regression coverage but
are not completion blockers for the narrowed release scope. WebKit is not
Safari application evidence. Native notification behavior and broader
platform-specific filesystem behavior remain outside the release promise.

### 9. Maintain capability and regression gates — cross-cutting

**Tracked task:** #11; depends on #2 through #9

After each phase:

- update `CAPABILITIES.md`, README, and this document;
- test source-level visible controls rather than private dispatcher calls;
- maintain operation-contract parity tests;
- make CI reject build-architecture, capability, contract, or UI-evidence
  drift.

#### Exhaustive parity audit

The August 30, 2026 Chrome/macOS follow-up audit leaves the concrete local
differences listed in [PARITY-GAPS.md](PARITY-GAPS.md). The browser
application menu and keyboard shortcuts are now implemented and classified as
Partial because the native macOS menu bar remains outside web renderer
ownership. Hosted and other native integrations remain explicitly Deferred
under the approved local-only scope.

- hosted account association and provider-backed clone lists;
- automated Git installation and broader native repository-recovery variants;
- protected-branch, write-access, repository-rule, push-protection, and
  account-backed author/Copilot workflows;
- hosted Pull Requests, merge requests, commit checks, notifications, and
  provider-specific history/file links;
- native macOS menu-bar and Electron menu-lifecycle ownership;
- native editor/shell process execution, filesystem process execution, signed
  installer handoff, and Git LFS execution evidence;
- native desktop notifications, title-bar controls, and broader native
  filesystem/dialog variants;
- Pull Request worktree checkout and other hosted-only worktree flows.

The complete row-level list, with source evidence and disposition, is in
[PARITY-GAPS.md](PARITY-GAPS.md). The current list contains 131 rows: 99
Supported, 6 Partial, 0 Missing, and 26 Deferred. The focused Chrome
source-renderer audit
also closed repository search, Changes status filters and persisted filter
state, filtered bulk include/exclude, history search, diff search, repository
pinning, inline stash inspection/actions, and Changes ignore-file/ignore-pattern
actions; those behaviors are no longer listed as open rows. The audit now has
tested selected-commit Copy SHA and Copy tag(s) context actions. Repository creation
metadata/templates, name-plus-parent-path/default-directory behavior, and
create-path preflight warnings are also covered by the visible Chrome fixture.
The branch picker now has visible search plus default, recent, local, and
remote groups. The platform follow-up also proves folder-picker entry points,
editor/shell launch, signed update state transitions, Git LFS
configuration/transfer/cancellation controls, browser notification permission
guidance, and source-owned macOS filesystem actions through injected companion
contracts. Native process, installer, filesystem, and Git LFS execution
evidence remains Partial; the other remaining differences are explicitly
Deferred limitations: hosted account association, automated Git installation,
Pull Request worktrees, native notifications, native title-bar ownership, and
the other hosted integrations listed in [PARITY-GAPS.md](PARITY-GAPS.md).
Do not promote another row to Supported without a visible source control,
companion behavior, automated evidence, and the required Chrome/macOS
execution evidence.

### 10. Real-provider and release evidence — P0

**Tracked task:** #10; depends on #6, #7, #8, and #9

Provision isolated accounts for every advertised hosted provider, including
GitHub.com, GitHub Enterprise, GitLab.com, and self-hosted GitLab, plus any
newly supported provider. Run scheduled/manual sandbox workflows with
short-lived repositories and credentials.

Run the release gate:

```sh
yarn build:web
yarn test:web
git diff --exit-code -- web-server/public
```

Also verify production `BUILD_SHA`, reproducible output, payload/CSP/security,
unprivileged-companion operation, browser console health, update-channel
behavior when enabled, and documented manual release checks.

#### Current status

The provider sandbox is still credential-gated and is not current source
renderer evidence because hosted controls are deferred. The source-renderer
advanced workflow fixture now passes for force-push, remote-branch deletion,
recursive submodule controls and failed-update recovery, merge abort and merge/rebase/cherry-pick recovery,
rebase skip, worktree open/switch, configured guarded history rewrites,
selected-history branch/tag/detached-checkout actions, and committed-file
history inspection with Ahead/Behind branch comparison. Under the approved
Chrome/macOS scope, the release gate passes locally; out-of-scope browser and
platform gaps remain documented but do not block completion.

#### Release exit criteria

- No P0/P1 item remains open for an advertised capability.
- Every supported workflow has a visible source-renderer control, companion
  implementation, and automated evidence.
- Every advertised in-scope provider/platform has current execution evidence.
- Documentation, capability matrix, manifest, and generated production asset
  agree.

## Delivery order

1. #2 Build architecture truth.
2. #3 Typed operation contracts.
3. #4 Commit workflows and #5 sync/branches in parallel.
4. #6 advanced local Git workflows.
5. #7 advanced advertised features, #8 provider scope, and #9 platform/browser
   verification in parallel as capacity permits.
6. #11 continuously after each merged phase.
7. #10 only when all advertised P0/P1 work has evidence.

## Definition of complete

The web version has closed the relevant desktop Git-operation gaps only when
its shipped source renderer—not a vendored desktop snapshot—exposes the
advertised workflows, the companion executes them safely, and current
automated plus provider/platform evidence supports every Supported status in
the approved release scope. Deferred providers or platform targets are
acceptable only under an explicit narrower product promise.
