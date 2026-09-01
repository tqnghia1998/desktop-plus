# Desktop parity gap inventory

This is the exhaustive implementation-gap inventory for the source-owned web
renderer. The target for this release is branded Google Chrome with the local
companion on macOS.

Status meanings:

- **Partial**: the web renderer exposes a subset of the desktop behavior.
- **Missing**: the desktop behavior is local and relevant, but the source web
  renderer has no corresponding control or implementation.
- **Deferred**: intentionally excluded from the current local-only product
  promise. The companion or typed contract may still contain future support.

This document compares the visible source renderer, not the retired snapshot
dispatcher. Companion endpoints without a visible source control do not count
as implementation parity.

The release-candidate evidence now passes for branded Google Chrome on macOS:
the harness verifies loopback binding, an unprivileged companion process,
changed-file state, paginated history, and a clean browser console. Those
checks are release evidence rather than remaining implementation gaps.

The rows below are the remaining concrete desktop differences. Hosted and
native integrations remain explicitly deferred.

Some GitHub and GitLab companion endpoints and typed client methods already
exist. They do not establish feature parity: the source renderer provides no
hosting sign-in entry point and passes empty account and Pull Request data to
the reused desktop controls. A companion API is therefore not counted as a
visible web feature until its source-renderer UI is wired.

## Repository management

| ID | Desktop behavior | Web status | Evidence and disposition |
| --- | --- | --- | --- |
| REPO-02 | Repository aliases | Supported | Repository settings expose a persisted alias and the picker renders it. |
| REPO-03 | Repository groups and group renaming | Supported | Repository settings assign groups and the picker visibly renames a group across all member repositories. |
| REPO-04 | Recent-repository visibility and ordering preferences | Supported | Recent visibility, recent ordering, and alphabetical ordering are persisted and exposed in Preferences. |
| REPO-05 | Missing-repository detection and recovery | Supported | Persisted stale paths expose Check again, Relocate, Clone repository again, and Remove recovery actions. |
| REPO-06 | Relocate a repository | Supported | The stale-repository view validates a replacement path and updates the remembered repository and pinned path. |
| REPO-07 | Remove a repository from the app with desktop confirmation preferences | Supported | Removal is visible, confirmed by default, and has a persisted confirmation preference. |
| REPO-08 | Delete a repository from disk | Supported | The desktop Remove Repository dialog optionally moves the repository to Trash through the browser companion. |
| REPO-09 | Tutorial repository and onboarding flow | Deferred | The desktop onboarding flow depends on account-backed services that are not exposed by the local browser adapter. |
| REPO-10 | Repository settings, default branch, and account association | Deferred | Alias, group, and default-branch settings are source-owned; hosted account association is outside the local-only release. |
| REPO-11 | Clone provider repository lists and provider-specific clone dialogs | Deferred | Hosted account and provider controls are intentionally not exposed. |
| REPO-12 | Native folder selection for add, clone, init, and worktree paths | Supported | Source dialogs expose Choose controls backed by the macOS companion folder picker; Chrome evidence covers add, clone, init, relocation, and worktree paths. |
| REPO-14 | Repository context actions for copy, browser view, and new-window opening | Supported | The picker exposes copy path, Finder reveal, remote browser, and new-window controls. |
| REPO-15 | Install or recover from a missing Git executable | Deferred | Missing-Git errors have a macOS-specific explanation, retry, and installation-guide action; automated Command Line Tools installation is native installer behavior outside the browser release. |
| REPO-16 | Unsafe-directory detection and Trust Repository recovery | Supported | Source add and persisted-repository flows distinguish Git's unsafe-directory result and expose a guarded `safe.directory` trust action, covered by the repository recovery browser workflow. |
| REPO-17 | Repository-list branch-name display preference | Supported | Never, always, and non-default-only branch-name display modes are persisted in Preferences. |
| REPO-18 | Repository-list linked-worktree visibility preference | Supported | Preferences control grouped linked-worktree rows beneath repositories. |
| REPO-19 | Repository-list change and ahead/behind indicators with refresh preference | Supported | Repository rows render changed-file and ahead/behind indicators with a persisted enable/disable preference. |
| REPO-23 | Bare and non-Git add-repository validation and recovery | Supported | Source add probes regular, bare, missing, unsafe, and non-Git paths, normalizes `~`, blocks bare repositories, and offers initialization or trust recovery. |
| REPO-24 | Clone destination validation and URL-derived path behavior | Supported | Clone preview validates URL and destination state and shows the derived repository name and destination before cloning. |

## Changes and commits

| ID | Desktop behavior | Web status | Evidence and disposition |
| --- | --- | --- | --- |
| CHG-03 | Multi-file row selection for batch actions | Supported | Changes uses the shared multi-selection list for include, exclude, copy, stash, and discard actions. |
| CHG-07 | Copy one or more paths and relative paths | Supported | Visible actions copy selected, included, absolute, and relative paths. |
| CHG-08 | Open a changed file in its default application | Supported | Diff and committed/stashed inspection views call the macOS companion open action. |
| CHG-09 | Reveal a changed file in the file manager | Supported | Diff and repository picker actions reveal paths through the companion. |
| CHG-10 | Open a changed file in the configured external editor | Supported | Diff inspection exposes the configured editor integration through the platform contract. |
| CHG-11 | Permanently discard changes or fall back after trash failure | Supported | The source dialog offers permanent deletion, a persisted default, and guarded fallback after macOS Trash failure; branded Chrome evidence covers the recovery path. |
| CHG-12 | Discard or stash a selected group of files | Supported | Multi-selected files can be discarded or stashed with confirmation and stash options. |
| CHG-13 | Refresh and display commit author identity and config origin | Supported | The source commit dialog displays effective `user.name` and `user.email` with resolved local/global origin, and the companion exposes both scopes. |
| CHG-14 | Configure missing Git user name or email from the commit view | Supported | A visible `Configure Git user` dialog validates and saves local or global identity, blocks incomplete commits, and recovers stale Git config locks. |
| CHG-15 | Add and validate Co-Authored-By entries | Supported | The source renderer validates one `Name <email>` entry per line and transports each as a `Co-Authored-By` trailer, with commit evidence covering valid and invalid input. |
| CHG-16 | Commit-message autocomplete, emoji, and rich desktop commit input | Supported | The source commit input preserves drafts, spellcheck, trailers, summary warnings, and visible emoji autocomplete; account-backed hosted suggestions remain deferred. |
| CHG-17 | Commit spellcheck setting and behavior | Supported | Spellcheck is persisted and applied to the source commit input; browser-native context-menu behavior remains platform-owned. |
| CHG-18 | Commit summary length warning | Supported | The source Preferences dialog persists the warning threshold and the commit dialog renders the warning at that configured value. |
| CHG-19 | Protected-branch warning and repository-rule context | Deferred | Hosted repository policy controls are excluded from the local-only release. |
| CHG-20 | Account/write-access warning before commit or publish | Deferred | Hosted account context is excluded from the local-only release. |
| CHG-21 | Generated commit messages and Copilot override flow | Deferred | Copilot controls are intentionally not exposed in the current source renderer. |
| CHG-22 | Commit-hook progress output | Supported | The source renderer shows a live Git-operation progress region with phase, captured output, progress state, and completion status; branded Chrome evidence covers a deliberately slow commit hook. |
| CHG-23 | Amend workflow with desktop commit context and stop-amending behavior | Supported | History rows start an amend with the selected commit message and the commit dialog exposes Stop amending. |
| CHG-24 | Persist commit message while switching repository sections | Supported | Drafts, co-authors, and commit options persist per repository across close/reopen, section changes, repository changes, and reload. |
| CHG-25 | Commit option preferences for sign-off, no-verify, empty commits, and filtered commits | Supported | Source preferences persist sign-off, no-verify, allow-empty, filtered-commit confirmation, and amend state. |
| CHG-26 | Unknown-author and commit-message override confirmations | Deferred | Account-backed author lookup and the desktop unknown-author override flow are intentionally outside the approved local-only release scope. |
| CHG-27 | Commit progress cancellation and detailed hook failure recovery | Supported | Failed hooks expose sanitized output and retry; the visible progress region supports cancellation, terminates the operation process tree, and leaves the repository uncommitted. Branded Chrome evidence covers both failure recovery and cancellation. |
## Diff and file inspection

| ID | Desktop behavior | Web status | Evidence and disposition |
| --- | --- | --- | --- |
| DIFF-01 | Persist whitespace, side-by-side, minimap, wrapping, image mode, font, theme, tab, and diff check-mark settings | Supported | The source Preferences dialog persists all listed browser diff and appearance settings, and the shared diff views consume them. |
| DIFF-05 | Image diff presentation modes | Supported | Image diffs receive the persisted Two-up, Swipe, Onion skin, and Difference mode from the source Preferences dialog. |
| DIFF-06 | Open binary files in the default application | Supported | Binary diff actions call the macOS companion open-path operation from working, stash, and history inspection views. |
| DIFF-07 | Open files in the external editor from diff inspection | Supported | Working, stash, and history inspection views expose the configured editor action through the platform contract. |
| DIFF-08 | Open submodules from working, committed, and stashed diffs | Supported | All three source diff surfaces expose Open submodule repository and route it through the companion. |
| DIFF-09 | Submodule commit metadata, status actions, and nested repository behavior | Supported | Source diff views render recorded/current submodule commits, recursively surface nested submodules, open nested repositories, and expose checkout, merge, and rebase update strategies. |
| DIFF-10 | Diff-specific context actions for paths, default apps, reveal, and editor | Supported | Source diff inspection exposes path copy plus default-app, Finder reveal, and editor actions through visible controls. |
| DIFF-11 | Syntax-highlighted diff contents | Supported | The source renderer tokenizes companion-supplied file contents through the existing CodeMirror worker; branded Chrome evidence verifies rendered syntax tokens and diff interaction. |

## History

| ID | Desktop behavior | Web status | Evidence and disposition |
| --- | --- | --- | --- |
| HIST-02 | Graph/list history mode toggle | Supported | History exposes persisted List and Graph modes backed by the source commit graph renderer. |
| HIST-03 | Branch visibility toggles in the graph | Supported | The graph sidebar exposes per-ref visibility checkboxes and persists hidden refs. |
| HIST-04 | Collapsible branch groups for local, remote, and tag refs | Supported | The graph sidebar groups local, origin, upstream, other remote, and tag refs with collapsible group controls. |
| HIST-05 | Branch, tag, and remote labels on commit rows | Supported | Graph rows render branch/ref labels and tag labels from companion-supplied refs. |
| HIST-06 | Full commit body, author, committer, trailers, avatars, and attribution | Supported | Commit rows and expanded details render body, author, committer, trailers, avatars, and multi-person attribution, with source evidence for the visible metadata surface. |
| HIST-07 | Conventional-commit badges and date preferences | Supported | Preferences persist Conventional Commit badges and absolute-date display, and both list and graph rows consume them. |
| HIST-08 | View commit or file on the hosting provider | Deferred | Hosted/provider controls are intentionally not exposed. |
| HIST-09 | Per-commit amend action | Supported | Source history rows expose Amend commit through the existing context menu and open the source commit dialog in amend mode. |
| HIST-10 | Per-commit cherry-pick action from history | Supported | Normal list and graph history rows expose cherry-pick and route the selected commit through the guarded source operation. |
| HIST-11 | Per-commit context actions for reset, revert, undo, branch, tag, checkout, and delete-tag | Supported | Source list and graph rows expose the local reset, revert, undo, branch, tag, checkout, cherry-pick, copy, and tag-deletion actions with confirmations where destructive. Hosted links remain deferred. |
| HIST-12 | Unreachable/reachable commit inspection | Supported | Expandable commit summaries open the source unreachable/reachable inspection dialog with the selected commit sets. |
| HIST-13 | Drag-and-drop commit reorder | Supported | The source CommitList wires drag insertion to the guarded reorder operation and exact-tip undo state. |
| HIST-14 | Keyboard commit reorder with accessible insertion announcements | Supported | The source CommitList exposes keyboard reorder mode and insertion confirmation callbacks. |
| HIST-15 | Desktop multi-commit operation progress and recovery dialogs | Supported | Reorder, squash, and multi-commit cherry-pick expose operation-specific progress, current commit metadata, captured output, cancellation, and conflict recovery guidance through the shared operation task surface. |
| HIST-16 | Merge-commit safeguards and operation-specific warnings | Supported | The companion rejects unsafe operations and the source branch-action dialogs present operation-specific preflight explanations before merge, squash-merge, rebase, and cherry-pick. |
| HIST-17 | Commit status/checks on history rows and rerun actions | Deferred | Provider checks are not exposed by the source renderer. |
| HIST-18 | History scroll-position persistence and branch-aware selection | Supported | List and graph scroll positions and selected commits persist per repository, branch, and view mode, with reload evidence for both list and graph. |
| HIST-19 | Selected-commit changed-file multi-selection and external actions | Supported | Committed-file inspection supports multi-selection, absolute/relative path copy, diff inspection, default-app, Finder reveal, editor, and submodule actions. |
| HIST-20 | Expandable commit summary details and SHA highlighting | Supported | The source history content view wires expandable summary details, SHA highlighting, and unreachable-commit inspection. |
| HIST-21 | Commit-row copy SHA and copy tag context actions | Supported | History rows expose Copy SHA and Copy tag actions through the visible source context menu, with clipboard execution evidence in branded Chrome. |
| HIST-22 | Local-commit and unpushed-tag indicators in history rows | Supported | The companion computes local commit SHAs and unpushed tags; list and graph rows receive both values and render their indicators. |
| HIST-23 | Emoji shortcut rendering in commit summaries | Supported | The source store loads the bundled emoji map and passes it to list, graph, and expandable history summaries. |

## Branches

| ID | Desktop behavior | Web status | Evidence and disposition |
| --- | --- | --- | --- |
| BR-03 | Branch sort-order preference | Supported | Preferences persist Last modified and Alphabetical branch sorting, and the branch picker consumes the selected order. |
| BR-07 | Branch context menu: copy, provider link, pull request link, rename, delete, and worktree checkout | Supported | Source branch rows expose copy, checkout, pull/fast-forward, default-branch, delete, and worktree actions through visible buttons and context menus; hosted provider links and Pull Requests are deferred. |
| BR-09 | Branch-name validation and warning presentation | Supported | Source create, rename, and remote-checkout dialogs validate Git ref names inline before invoking the companion. |
| BR-10 | Merge/rebase/cherry-pick branch selection with desktop preflight dialogs | Supported | Source branch-action dialogs select the target branch and display operation-specific preflight text before guarded merge, squash-merge, rebase, or cherry-pick execution. |

## Synchronization

| ID | Desktop behavior | Web status | Evidence and disposition |
| --- | --- | --- | --- |
| SYNC-04 | Pull all repositories | Supported | The sync menu exposes Pull all repositories and the store runs guarded pulls across remembered regular repositories. |
| SYNC-05 | Reset-and-pull warning and uncommitted-change strategy preferences | Supported | Source reset-and-pull warns about discarded commits, offers stash-or-cancel recovery, and persists the selected dirty-change strategy. |
| SYNC-06 | Fetch/pull/push progress and cancellation | Supported | Fetch, pull, and push use the shared visible operation-progress region with captured output and cancellation; branded Chrome evidence covers cancellation and completion. |
| SYNC-07 | Authentication, certificate, SAML, workflow, and credential-helper recovery | Supported | For HTTP(S) remotes, the companion first reuses the configured Git credential helper without editor prompts. Authentication or helper failures open a one-time in-app username/password retry dialog; credentials are not persisted by the browser. Source remote errors also classify SSH host-key, certificate, proxy, network, and generic failures and show sanitized recovery guidance. Hosted account flows remain deferred. |
| SYNC-08 | Selective tag push and pushed-tag state | Supported | Repository Tools shows local versus pushed tag state and exposes a visible Push tag action for each local-only tag. |
| SYNC-09 | Push rejection, pull-before-push, and force-push decision dialogs | Supported | Push rejection exposes sanitized remote output and retry, while force-push requires an explicit lease confirmation; branded Chrome evidence covers both paths. |
| SYNC-10 | Update the current branch from its contribution/default branch | Supported | The sync menu exposes Update from the configured default branch with persisted merge/rebase strategy selection. |
| SYNC-11 | Pull all repositories in a selected repository group | Supported | Repository picker group headers expose Pull and the store scopes the guarded pull loop to that group. |
| SYNC-12 | Interactive SSH credentials and host trust | Supported | The companion routes SSH askpass prompts through the task API; the source renderer reuses the Desktop host-trust, key-passphrase, and username/password dialogs, resumes or cancels Git without an editor prompt, and can store remembered passwords/passphrases in the operating-system credential store. |

## Stashes

| ID | Desktop behavior | Web status | Evidence and disposition |
| --- | --- | --- | --- |
| STASH-01 | Stash selected files or all changes using the file selection model | Supported | Changes uses the shared multi-selection model for selected-file stashes, while Repository Tools creates a stash from all included changes. |
| STASH-02 | Stash options for untracked files, keep-index, and related strategies | Supported | The source Create stash dialog exposes Include untracked files and Keep staged changes staged and transports both options to the companion. |
| STASH-03 | Configurable discard-stash confirmation | Supported | One persisted Confirm stash apply, pop, and drop preference controls all three visible stash mutations. |
| STASH-04 | Stash list context menu and path/branch metadata actions | Supported | Stash rows expose inspect, copy SHA/name/branch, apply, pop, rename, and drop actions through a visible source context menu; provider actions remain deferred. |
| STASH-05 | Switch stashes while checking out a branch with dirty changes | Supported | Checkout recovery exposes stash, move, and discard choices for dirty working trees and restores or preserves changes through the companion. |
| STASH-07 | Binary, image, submodule, default-app, reveal, and editor actions from stash diffs | Supported | Stash inspection consumes the shared diff controls, including image modes, binary open, submodule open/update, default-app, Finder reveal, editor, and path copy actions. |
| STASH-08 | Stash conflict recovery with operation-specific dialogs | Supported | Stash-pop is guarded by confirmation and conflicts surface in the visible Changes resolver with ours/theirs resolution controls. |

## Remotes and tags

| ID | Desktop behavior | Web status | Evidence and disposition |
| --- | --- | --- | --- |
| REM-01 | Validate remote names and URLs with field-level errors | Supported | The source remote dialog validates names and URL forms inline before submission, and the companion revalidates the operation payload. |
| REM-02 | Manage remotes through a dedicated dialog with context actions | Supported | The source renderer provides dedicated add/set dialogs and visible remote context actions for copy, browser opening, URL editing, and removal. |
| REM-03 | SSH/HTTPS credential and host-key guidance | Supported | HTTP(S) operations reuse configured Git credentials and can retry once through the in-app dialog without browser persistence. SSH host-key, certificate, proxy, network, and generic failures provide sanitized recovery guidance. |
| TAG-01 | Annotated tag dialog with separate name, target, and message | Supported | The source tag dialog exposes separate validated name, target, and message fields and creates an annotated tag through the companion. |
| TAG-02 | Delete pushed-tag warning and optional remote deletion | Supported | Pushed tags are detected, local deletion is confirmed, and a second confirmation offers remote deletion. |
| TAG-03 | Push selected tags and display unpushed tag indicators | Supported | Repository Tools displays local-only tags and exposes a visible Push tag control. |

## Worktrees

| ID | Desktop behavior | Web status | Evidence and disposition |
| --- | --- | --- | --- |
| WT-01 | Searchable grouped worktree list and dropdown | Supported | The source toolbar renders the shared searchable worktree dropdown, grouped into main and linked worktrees, when the worktree preference is enabled. |
| WT-03 | Checkout a remote branch or Pull Request in a new worktree | Deferred | Source-renderer controls create worktrees from local and remote branches; Pull Request worktree checkout requires hosted provider controls outside the local-only release. |
| WT-04 | Rename a worktree while preserving its parent directory | Supported | The source rename dialog validates a new sibling name and maps it to the existing parent directory before invoking the companion move operation. |
| WT-05 | Open a worktree in a new desktop window | Supported | Worktree rows expose a new-window action backed by the source platform contract. |
| WT-06 | Locked, prunable, and force-remove recovery dialogs | Supported | Worktree state displays locked, prunable, and dirty markers; the shared toolbar context menu exposes prune, and removal routes through the existing force-remove recovery dialog. |
| WT-07 | Worktree removal confirmation preferences and dirty-change handling | Supported | Preferences persist removal confirmation; dirty or locked worktrees require a distinct force-removal confirmation, while the opt-out path remains guarded by the companion. |
| WT-08 | `.worktreeinclude` copy behavior and related creation options | Supported | Worktree creation visibly reports configured include patterns and the companion copies matching ignored files into the new worktree, with Chrome execution evidence. |

## Submodules

| ID | Desktop behavior | Web status | Evidence and disposition |
| --- | --- | --- | --- |
| SUB-01 | Open the submodule repository from working, committed, and stashed diffs | Supported | Working, committed, and stashed diff views expose Open submodule repository. |
| SUB-02 | Initialize, update, and choose submodule update strategy | Supported | All source submodule diff views expose Checkout, Merge, and Rebase update strategies. |
| SUB-03 | Nested submodule navigation and status detail | Supported | Source Changes, committed-diff, and stashed-diff surfaces recursively render nested submodule status and expose visible Open nested submodule actions. |
| SUB-04 | Submodule update failure recovery and output detail | Supported | Failed source submodule updates expose sanitized command output, a recovery explanation, Refresh repository, Retry, and Close actions; the Chrome/macOS browser fixture covers the failure and refresh flow. |

## Platform and application surfaces

| ID | Desktop behavior | Web status | Evidence and disposition |
| --- | --- | --- | --- |
| PLATFORM-01 | Application menu and desktop keyboard shortcut system | Partial | The source renderer reuses the shared AppMenuBar for File, View, Repository, and Branch actions and preserves the Preferences shortcut; the full Electron application menu and native macOS menu lifecycle remain unavailable to web content. |
| PLATFORM-02 | Theme, font, tab-size, title-bar, and appearance preferences | Partial | Theme, diff font, tab size, and related browser appearance settings are source-owned; the remaining gap is Electron-owned native title-bar controls and lifecycle. |
| PLATFORM-03 | External editor discovery, configuration, and launch | Partial | Repository Tools discovers editors and exposes visible Open repository actions through the companion contract; the browser fixture verifies selection and payloads, but native editor process execution evidence remains open. |
| PLATFORM-04 | Shell discovery, configuration, and launch | Partial | Repository Tools discovers shells and exposes visible Open repository actions through the companion contract; the browser fixture verifies selection and payloads, but native shell process execution evidence remains open. |
| PLATFORM-05 | Reveal in file manager, default-open, and trash integration | Partial | Source file, repository, and worktree actions call the macOS companion contract for default-open, Finder reveal, and Trash; injected browser services verify normal and Trash-failure recovery, but real native filesystem execution evidence remains open. |
| PLATFORM-06 | Native folder and save dialogs | Partial | Repository setup and worktree flows use the companion folder picker, but there is no full desktop-equivalent open/save-dialog surface or evidence for the broader native-dialog variants. |
| PLATFORM-07 | Native desktop notifications | Deferred | No native notification surface is exposed. |
| PLATFORM-08 | Browser notification preferences and permission guidance | Supported | Preferences expose a persisted browser-notification toggle, permission status, and browser site-settings guidance; provider notification feeds remain deferred. |
| PLATFORM-09 | Automatic update discovery, download, verification, and installer handoff | Partial | Repository Tools exposes on-demand signed update checks, verified download progress, cancellation, and explicit installer-open confirmation; the browser fixture verifies the state machine with an injected update service, while real signed artifact and installer execution evidence remains open. |
| PLATFORM-10 | Desktop About, legal, release, CLI, and app-install surfaces | Missing | The source renderer does not expose the desktop About, acknowledgements, terms, release notes, CLI-installed confirmation, Move to Applications, or thank-you dialogs. |
| PLATFORM-11 | Effective external credential-helper and Windows OpenSSH preferences | Partial | Both preferences are persisted and rendered, but neither value is transported to the companion's Git invocation. Generic HTTP(S) credential lookup independently uses the configured Git credential helper; the preference does not control it, and the Windows OpenSSH setting has no web execution effect. |

## Hosted providers and advanced integrations

| ID | Desktop behavior | Web status | Evidence and disposition |
| --- | --- | --- | --- |
| HOST-01 | GitHub.com sign-in, account picker, repository association, publish, and fork | Deferred | Source renderer exposes no hosted account controls. |
| HOST-02 | GitHub Enterprise endpoint validation and sign-in | Deferred | Source renderer exposes no enterprise account controls. |
| HOST-03 | GitLab.com and self-hosted GitLab sign-in and repository association | Deferred | Source renderer exposes no GitLab account controls. |
| HOST-04 | Bitbucket sign-in and repository workflows | Deferred | No source-renderer provider controls. |
| HOST-05 | Forgejo/Codeberg sign-in and repository workflows | Deferred | No source-renderer provider controls. |
| HOST-06 | Gitea sign-in and repository workflows | Deferred | No source-renderer provider controls. |
| HOST-07 | Pull Request and merge-request list, create, checkout, and merge workflows | Deferred | Companion/API support is not source-renderer evidence. |
| HOST-08 | Pull Request diff selection and base-branch changes | Deferred | No source-renderer Pull Request surface. |
| HOST-09 | Commit checks, check-suite details, and rerun actions | Deferred | No source-renderer provider checks surface. |
| HOST-10 | Repository rulesets and push-protection bypass requests | Deferred | No source-renderer policy or bypass controls. |
| HOST-11 | Copilot commit-message generation and conflict-resolution proposal application | Deferred | No source-renderer Copilot controls. |
| HOST-12 | Git LFS status, initialization, repair, transfer progress, and cancellation | Partial | Repository Tools exposes LFS status, local/global filter installation, hook repair, transfer progress, and cancellation with confirmation; Chrome evidence uses an injectable companion LFS service because Git LFS is not installed on the test host, so native Git LFS execution evidence remains open. |

## Release-evidence gaps

| ID | Evidence gap | Web status | Disposition |
| --- | --- | --- | --- |
| EVID-01 | Automated source-renderer coverage for the full desktop behavior inventory | Supported | `src/source-evidence.js` maps every Supported inventory row to one or more visible source-renderer browser suites, and `test-docs.js` rejects missing, unknown, or non-source evidence references. |
| EVID-04 | Real-provider execution evidence for advertised hosted behavior | Deferred | Providers are explicitly not advertised by the current local-only release. |
| EVID-05 | Native process, installer, LFS, notification, and broader native dialog execution evidence | Deferred | The platform fixture covers source-renderer controls and injected companion contracts for editor/shell launch, filesystem actions, updates, Git LFS, and folder-picker entry points. Native editor/shell processes, signed installer handoff, Git LFS execution, desktop notifications, and broader native dialog variants still need platform execution evidence or remain outside the current release promise. |

## Current conclusion

The source renderer is suitable for the documented local-only subset plus the
verified macOS platform controls:
repository setup, working changes, selected text patches, basic commit options,
local synchronization, branch actions, stash lifecycle, remote/tag/worktree
basics, recursive submodule inspection and recovery, conflict recovery,
comparison, guarded history rewrites, folder selection, editor and shell launch,
verified updates, and Git LFS controls. The browser application menu and
keyboard shortcuts are available with the native macOS menu bar limitation
described in PLATFORM-01. It is not full desktop parity. The
rows above are the complete known gap list for the current Chrome/macOS audit
and should be closed or explicitly reclassified before any broader parity
claim.
