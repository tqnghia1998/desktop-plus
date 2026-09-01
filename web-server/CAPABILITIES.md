# Web capability matrix

This matrix describes the source-owned Desktop renderer and local companion
shipped by the web app. The current web release intentionally promises local
repository workflows only. The in-scope release evidence target is branded
Google Chrome running with the companion on macOS. Other browser and operating
system rows remain informative and do not block this release.

The complete desktop-versus-web implementation inventory is maintained in
[PARITY-GAPS.md](PARITY-GAPS.md). It lists every known partial, missing, and
intentionally deferred desktop behavior, including cases where a typed
companion operation exists without a visible source-renderer control.
The current inventory contains 134 rows: 98 Supported, 9 Partial, 2 Missing,
and 25 Deferred.

- **Supported**: implemented and covered by an automated browser workflow.
- **Partial**: a visible source control and companion path exist, but the
  workflow or evidence is incomplete.
- **Missing**: not yet implemented by the web renderer.
- **Deferred**: intentionally outside the current release scope and not exposed.

## Workflows

| Capability ID | Status | Scope and limitations |
| --- | --- | --- |
| localRepositories | Supported | Add and open a local repository, switch between remembered paths, and initialize or clone from the source home view. Repository creation exposes name, parent directory, description, README, Git ignore, license, initial branch, and initial-commit controls with persisted default-directory behavior and preflight warnings. The source browser workflow covers add, create, clone, and worktree setup. |
| history | Supported | Load and paginate commit history, compare another branch in Ahead or Behind directions, inspect selected commits' changed files, additions/deletions, and read-only file diffs, create a branch or annotated tag at a selected commit, copy its SHA or tag(s), confirm detached checkout of a selected commit, cherry-pick a selected Behind comparison commit, and perform guarded local reset, revert, undo, reorder, and squash actions. Source browser evidence covers branch comparison, commit inspection and diff rendering, selected-history branch/tag/checkout/copy actions, selected comparison cherry-pick confirmation, revert/reset/undo confirmations, and revert conflict recovery. |
| changesAndCommits | Supported | Inspect working-directory changes and diffs, include or exclude complete files or selected text-diff lines in commits, persist per-repository commit drafts and options, validate and add manual co-author trailers, control commit spellcheck, show a summary-length warning, ignore selected files or file patterns, copy selected and included paths in absolute or relative form, add sign-off trailers, require confirmation for no-verify and filtered commits, monitor and cancel running commits, discard/reset/revert with confirmation, and resolve a merge conflict. Source browser evidence verifies selected patches, visible operation progress and cancellation, ignore, clipboard, commit-option, persistence, validation, and trailer actions. |
| branchesAndTags | Supported | Branch creation checks out the new branch. The source renderer publishes an untracked branch, checks out a remote-only branch as a local tracking branch, fast-forwards a non-current tracking branch, and squash-merges a local branch with conflict recovery. It also bulk-deletes merged local branches after confirmation, excluding branches checked out in worktrees. Reset-and-pull requires confirmation, stashes dirty changes, fetches, and refuses unsafe direct execution. |
| repositoryListIndicators | Supported | Repository rows can show changed-file and ahead/behind indicators, with a persisted preference to enable or disable them. |
| repositoryRecovery | Supported | Stale remembered repositories expose check-again, relocate, clone-again, and remove recovery actions; add and persisted-path flows classify regular, bare, missing, and unsafe repositories. |
| updateFromDefaultBranch | Supported | The sync menu fetches the latest remotes and updates the current non-default branch from the fetched default-branch ref using merge or rebase. |
| stashes | Supported | The Changes view exposes inline stash inspection, apply, pop, rename, and drop actions; Repository Tools also exposes stash creation and the same lifecycle controls. Source browser evidence covers inspection and diff rendering from Changes, lifecycle actions, and stash-pop conflict recovery through the visible Changes resolver. |
| worktrees | Supported | The Tools view exposes worktree create, open, move, and remove. Source browser evidence covers the complete lifecycle, including open/switch and removal, on the in-scope Chrome/macOS target. |
| advancedHistoryRewrites | Supported | The History view exposes guarded reorder with an exact insertion point, squash with an editable commit message, and exact-tip undo. Source browser evidence exercises both configured rewrites, confirmation, and undo against a disposable repository. |
| inProgressGitOperations | Supported | Source browser evidence covers shared live progress and cancellation plus merge abort and resolution/continuation, rebase resolution/continuation/skip, cherry-pick resolution/continuation, and revert conflict recovery after a refresh. |
| pullRequests | Deferred | Hosted Pull Request and merge-request controls are not exposed by the source renderer in the local-only release. |
| hostingAuthentication | Deferred | Hosted account controls are not exposed by the source renderer in the local-only release. This does not prevent generic HTTP(S) Git credential reuse or its one-time in-app retry dialog. |
| editorIntegration | Partial | Repository Tools discovers editors and exposes launch actions through the typed macOS companion contract. The browser fixture validates selection and payloads, but native editor process execution still needs macOS execution evidence. |
| shellIntegration | Partial | Repository Tools discovers shells and exposes launch actions through the typed macOS companion contract. The browser fixture validates selection and payloads, but native shell process execution still needs macOS execution evidence. |
| filesystemIntegration | Partial | Repository and worktree reveal, default-open, and Trash controls are source-owned and use the typed companion contract. Injected browser services validate the visible flows, but real native filesystem execution still needs macOS execution evidence. |
| browserNotifications | Supported | Preferences expose a persisted browser-notification toggle and permission guidance; hosted notification feeds and native notifications remain deferred. |
| nativeNotifications | Deferred | Native desktop notification infrastructure is not part of the web release. |
| automaticUpdates | Partial | Repository Tools checks for signed updates, downloads and verifies artifacts with progress and cancellation, and requires confirmation before installer handoff. The browser fixture validates the state machine with an injected service; real signed artifact and installer execution still needs macOS evidence. |
| copilot | Deferred | Copilot controls are not exposed by the source renderer. |
| pushProtectionBypass | Deferred | Hosted push-protection controls are not exposed by the source renderer. |
| repositoryRules | Deferred | Hosted repository-rule controls are not exposed by the source renderer. |
| globalLfsInstall | Partial | Repository Tools exposes confirmed global Git LFS filter installation through the typed companion contract. Browser evidence uses an injected LFS service; native Git LFS installation still needs macOS execution evidence. |
| gitLfs | Partial | Repository Tools exposes Git LFS status, local filter installation, hook repair, transfer progress, and cancellation. Browser evidence uses an injected LFS service; native Git LFS execution still needs macOS execution evidence. |

## Local desktop parity gaps

The Supported rows above describe the deliberately smaller local web promise,
not full feature-for-feature desktop parity. The remaining local gaps include:

- Repository setup and recovery: hosted account association and automated Git
  installation are Deferred; native folder dialogs and broader desktop recovery
  variants are Deferred or platform-owned.
- Worktrees and appearance: Pull Request worktree checkout and native title-bar
  controls are Deferred with hosted or native ownership; browser appearance
  preferences are Supported.
- Native and hosted surfaces: the browser application menu and shortcuts are
  Partial because the native macOS menu bar cannot be owned by the web
  renderer. Editor and shell launch, filesystem actions, signed updates, and
  Git LFS controls are Partial because the current browser fixtures validate
  injected companion contracts rather than native process, installer, or LFS
  execution. Repository and worktree folder pickers are available, while the
  broader native open/save-dialog surface is Partial. Native notifications,
  hosted providers, Pull Requests, Copilot, repository rules, and push
  protection remain Deferred; interactive SSH trust and credential dialogs and
  desktop About/legal/release surfaces are Missing, as documented in
  [PARITY-GAPS.md](PARITY-GAPS.md).

## HTTP(S) Git credentials

For unaffiliated HTTP(S) remotes, the companion uses `git credential fill` with
the user's configured credential helper before running a network operation. It
disables editor askpass and terminal prompts, so VS Code or another editor does
not own the authentication UI. If lookup or authentication fails, the renderer
shows a generic username/password dialog and retries the operation once. The
credentials are held only for that request and are not persisted by the
browser or stored back into the credential helper. This is generic Git
authentication, not hosted-account sign-in. SSH host trust and interactive SSH
credentials remain missing.

## Hosting providers

| Capability ID | Status | Authentication |
| --- | --- | --- |
| githubDotCom | Deferred | Hosted controls are not exposed by the source renderer in the local-only release. |
| githubEnterprise | Deferred | Hosted controls are not exposed by the source renderer in the local-only release. |
| bitbucket | Deferred | Not exposed by the source renderer |
| gitlab | Deferred | Hosted controls are not exposed by the source renderer in the local-only release. |
| forgejo | Deferred | Includes Codeberg; not exposed by the source renderer |
| gitea | Deferred | Not exposed by the source renderer |

## Browser and operating-system status

| Target | Status | Verification |
| --- | --- | --- |
| Playwright Chromium on Linux | Supported | Source-renderer browser workflows cover repository add, selected text-diff patch commit, discard/reset/revert confirmations, merge/rebase/cherry-pick/stash-pop and squash-merge conflict recovery, branch/stash inspection and lifecycle, publish, remote-only checkout, branch-specific fast-forward, and bulk unused-branch deletion, remote/tag/worktree lifecycle, force-push and remote deletion, local push rejection recovery, pull, recursive submodule inspection and failed-update recovery, diff refresh, and configured guarded history rewrites. |
| Google Chrome and Chromium desktop | Supported | The full source-renderer suite passes through the installed branded Google Chrome binary, including publish, remote-only checkout, branch-specific fast-forward, clean/conflicted squash merge, bulk unused-branch deletion, configured guarded history rewrites, state persistence, folder-picker entry points, editor/shell launch, verified update states, browser notification guidance, filesystem actions, and Git LFS controls. Native notifications remain deferred; native process, installer, and LFS execution evidence remains partial. |
| Microsoft Edge desktop | Partial | The full source-renderer suite passes locally through the installed branded Microsoft Edge binary and a matching CI job is configured; native desktop integration evidence remains pending. |
| Firefox | Partial | The shared source-renderer launcher and CI job cover Firefox, and the full suite passes locally; native desktop integration evidence remains pending. |
| Safari | Missing | WebKit engine coverage is configured separately; no Safari application execution evidence exists. |
| Linux companion | Partial | Browser/API/security checks; folder picker depends on `zenity`; missing `zenity`, `xdg-open`, or `gio` return installation guidance. |
| macOS companion | Partial | The local Git companion is exercised on the actual Darwin host through the Chrome source-renderer workflows and platform service smoke tests, including recursive submodule inspection and failed-update recovery. Browser fixtures cover folder selection, editor/shell launch, filesystem actions, update states, browser notification guidance, and Git LFS controls, but native process, installer, and LFS execution evidence remains open; native notifications remain deferred. |
| Windows companion | Partial | API smoke coverage and a CI source-renderer browser job; native interactive dialog verification remains open |
