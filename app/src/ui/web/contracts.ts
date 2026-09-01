import type { DiffSelection } from '../../models/diff'
import type { Emoji } from '../../lib/emoji'
import type { TutorialStep } from '../../models/tutorial-step'

export interface WebRepository {
  readonly path: string
  readonly name: string
  readonly lastOpenedAt?: number
  readonly defaultBranch: string | null
  readonly currentBranch?: string | null
  readonly alias?: string | null
  readonly group?: string | null
  readonly changedFilesCount?: number
  readonly aheadBehind?: {
    readonly ahead: number
    readonly behind: number
  } | null
  readonly remoteURL?: string | null
  readonly remoteWebURL?: string | null
  readonly worktrees?: ReadonlyArray<WebWorktree>
  readonly isTutorialRepository?: boolean
}

export interface WebRepositoryInspection {
  readonly path: string
  readonly repositoryPath: string
  readonly kind: 'regular' | 'bare' | 'missing' | 'unsafe'
  readonly exists: boolean
  readonly isDirectory: boolean
  readonly unsafePath?: string
  readonly repositoryName: string
  readonly parentPath: string
}

export interface WebSubmoduleStatus {
  readonly commitChanged: boolean
  readonly modifiedChanges: boolean
  readonly untrackedChanges: boolean
  readonly recordedCommit?: string | null
  readonly currentCommit?: string | null
  readonly nested?: ReadonlyArray<{
    readonly path: string
    readonly status: WebSubmoduleStatus
  }>
}

export interface WebFile {
  readonly path: string
  readonly oldPath?: string
  readonly status: {
    readonly kind: string
    readonly entry?: {
      readonly us: string
      readonly them: string
    }
    readonly conflictMarkerCount?: number
    readonly submoduleStatus?: WebSubmoduleStatus
  }
}

export interface WebStatus {
  readonly workingDirectory: {
    readonly files: ReadonlyArray<WebFile>
  }
  readonly operation: string | null
  readonly operationState?: {
    readonly currentCommit?: string | null
    readonly position?: number | null
    readonly totalCommitCount?: number | null
  } | null
}

export interface WebBranch {
  readonly name: string
  readonly upstream: string | null
  readonly isGone?: boolean
  readonly type?: 'Local' | 'Remote'
  readonly ref?: string
  readonly tip?: {
    readonly sha: string
    readonly author?: {
      readonly date: string
    }
  }
}

export interface WebBranchPruneCandidate {
  readonly name: string
  readonly ref: string
  readonly sha: string
  readonly upstream: string
}

export type WebPullStrategy = 'merge' | 'rebase' | 'ff-only'
export type WebSubmoduleUpdateStrategy = 'checkout' | 'merge' | 'rebase'

export interface WebBranches {
  readonly branch: WebBranch | null
  readonly defaultBranch: string | null
  readonly recentBranches: ReadonlyArray<string>
  readonly pullWithRebase?: boolean
  readonly branches?: ReadonlyArray<WebBranch>
  readonly mergedBranches?: ReadonlyArray<WebBranch>
  readonly remotes?: ReadonlyArray<WebRemote>
  readonly tags?: ReadonlyArray<WebTag>
  readonly stashes?: ReadonlyArray<WebStash>
  readonly worktrees?: ReadonlyArray<WebWorktree>
  readonly worktreeInclude?: {
    readonly configured: boolean
    readonly patterns: ReadonlyArray<string>
  }
  readonly localCommitSHAs?: ReadonlyArray<string>
  readonly tagsToPush?: ReadonlyArray<string>
  readonly aheadBehind: {
    readonly ahead: number
    readonly behind: number
  } | null
}

export interface WebRepositoryIndicators {
  readonly currentBranch: string | null
  readonly defaultBranch: string | null
  readonly changedFilesCount: number
  readonly aheadBehind: {
    readonly ahead: number
    readonly behind: number
  } | null
  readonly remoteURL: string | null
  readonly remoteWebURL: string | null
}

export interface WebRemote {
  readonly name: string
  readonly url: string
  readonly webURL?: string | null
}

export interface WebTag {
  readonly name: string
  readonly sha: string
  readonly pushedRemotes?: ReadonlyArray<string>
}

export interface WebStash {
  readonly name: string
  readonly branchName: string
  readonly customName: string | null
  readonly stashSha: string
  readonly createdAt: string
}

export interface WebStashFiles {
  readonly files: ReadonlyArray<WebFile>
}

export interface WebGitIgnoreRequest {
  readonly paths: ReadonlyArray<string>
  readonly kind: 'file' | 'pattern'
}

export interface WebWorktree {
  readonly path: string
  readonly head: string
  readonly branch: string | null
  readonly isDetached: boolean
  readonly type: 'main' | 'linked'
  readonly isLocked: boolean
  readonly isPrunable: boolean
  readonly isDirty?: boolean
}

export interface WebCommit {
  readonly sha: string
  readonly shortSha: string
  readonly summary: string
  readonly body: string
  readonly author: {
    readonly name: string
    readonly email: string
    readonly date: string
    readonly tzOffset: number
  }
  readonly committer: {
    readonly name: string
    readonly email: string
    readonly date: string
    readonly tzOffset: number
  }
  readonly parentSHAs: ReadonlyArray<string>
  readonly trailers: ReadonlyArray<WebCommitTrailer>
  readonly tags: ReadonlyArray<string>
}

export interface WebHistory {
  readonly commits: ReadonlyArray<WebCommit>
}

export interface WebComparison extends WebHistory {
  readonly ahead: number
  readonly behind: number
}

export interface WebCommitDetails {
  readonly files: ReadonlyArray<
    WebFile & {
      readonly commitish: string
      readonly parentCommitish: string
    }
  >
  readonly linesAdded: number
  readonly linesDeleted: number
}

export interface WebCloneSetupPreview {
  readonly repositoryURL: string
  readonly destinationPath: string
  readonly repositoryName: string
  readonly canClone: boolean
  readonly warnings: ReadonlyArray<{
    readonly code:
      | 'invalid-url'
      | 'invalid-path'
      | 'existing-file'
      | 'destination-not-empty'
    readonly message: string
  }>
}

export interface WebDiff {
  readonly patch: string
  readonly submoduleUrl?: string | null
  readonly fullPath?: string
  readonly image?: {
    readonly previous?: {
      readonly contents: string
      readonly mediaType: string
      readonly bytes: number
    }
    readonly current?: {
      readonly contents: string
      readonly mediaType: string
      readonly bytes: number
    }
  } | null
  readonly fileContents?: {
    readonly oldContents: ReadonlyArray<string>
    readonly newContents: ReadonlyArray<string>
    readonly canBeExpanded: boolean
  } | null
}

export interface WebHistoryRewriteUndo {
  readonly branch: string
  readonly originalTip: string
  readonly rewrittenTip: string
}

export interface WebCherryPickUndo extends WebHistoryRewriteUndo {
  readonly count: number
}

export interface WebChangesFilter {
  readonly filterText: string
  readonly isIncludedInCommit: boolean
  readonly isExcludedFromCommit: boolean
  readonly isNewFile: boolean
  readonly isModifiedFile: boolean
  readonly isDeletedFile: boolean
}

export interface WebGitIdentityOrigin {
  readonly scope: string
  readonly origin: string
}

export interface WebGitIdentity {
  readonly name: string
  readonly email: string
  readonly nameOrigin: WebGitIdentityOrigin | null
  readonly emailOrigin: WebGitIdentityOrigin | null
  readonly localName: string | null
  readonly localEmail: string | null
  readonly globalName: string | null
  readonly globalEmail: string | null
}

export interface WebHookFailure {
  readonly hookName: string
  readonly terminalOutput: string
}

export interface WebOperationOutput {
  readonly stdout: string
  readonly stderr: string
  readonly exitCode: number
}

export interface WebOperationTask {
  readonly id: string
  readonly operation: WebGitOperation
  readonly status: 'running' | 'completed' | 'failed' | 'cancelled'
  readonly phase: string
  readonly output: string
  readonly progress: number | null
  readonly position: number | null
  readonly totalCommitCount: number | null
  readonly currentCommit: string | null
  readonly currentCommitSummary: string | null
  readonly result: WebOperationResult | null
  readonly error: string | null
  readonly errorCode: string | null
  readonly hookFailure?: WebHookFailure | null
  readonly configLockScope?: WebGitConfigScope | null
  readonly bypassURL?: string | null
}

export type WebGitConfigScope = 'local' | 'global'

export type WebRepositoryDeleteMode = 'trash' | 'permanent'

export interface WebCommitTrailer {
  readonly token: string
  readonly value: string
}

export interface WebCommitOptions {
  readonly amend: boolean
  readonly signOff: boolean
  readonly noVerify: boolean
  readonly allowEmpty: boolean
}

export const webOperationNames = [
  'fetch',
  'update-from-default',
  'fetch-refspec',
  'prune-branches',
  'pull',
  'push',
  'publish-branch',
  'checkout',
  'checkout-commit',
  'create-branch',
  'rename-branch',
  'delete-branch',
  'delete-branches',
  'delete-remote-branch',
  'discard',
  'stash',
  'stash-apply',
  'stash-pop',
  'stash-drop',
  'stash-rename',
  'undo',
  'reset-commit',
  'reset-upstream',
  'revert',
  'cherry-pick',
  'continue-cherry-pick',
  'abort-cherry-pick',
  'merge',
  'squash-merge',
  'rebase',
  'continue-rebase',
  'skip-rebase',
  'abort-merge',
  'abort-rebase',
  'abort-squash',
  'remote-add',
  'remote-set-url',
  'remote-remove',
  'tag-create',
  'tag-delete',
  'delete-remote-tag',
  'worktree-add',
  'worktree-move',
  'worktree-remove',
  'worktree-prune',
  'submodule-update',
  'fast-forward',
  'undo-history-rewrite',
  'undo-cherry-pick',
  'reorder-commits',
  'squash-commits',
  'resolve-conflict',
  'finish-merge',
  'discard-patch',
  'lfs-install',
  'init',
  'clone',
  'commit',
] as const

export type WebGitOperation = typeof webOperationNames[number]

export interface WebOperationOptions {
  readonly values?: ReadonlyArray<string>
  readonly files?: ReadonlyArray<string>
  readonly patches?: ReadonlyArray<string>
  readonly message?: string
  readonly trailers?: ReadonlyArray<WebCommitTrailer>
  readonly confirmed?: boolean
  readonly amend?: boolean
  readonly signOff?: boolean
  readonly noVerify?: boolean
  readonly allowEmpty?: boolean
  readonly includeUntracked?: boolean
  readonly keepIndex?: boolean
  readonly mode?: 'mixed' | 'hard'
  readonly force?: boolean
  readonly pullStrategy?: WebPullStrategy
  readonly submoduleStrategy?: WebSubmoduleUpdateStrategy
  readonly dryRun?: boolean
  readonly defaultBranch?: string
  readonly updateStrategy?: 'merge' | 'rebase'
  readonly checkout?: boolean
  readonly createLocalBranch?: string
  readonly moveChanges?: boolean
  readonly stashChanges?: boolean
  readonly resolutions?: ReadonlyArray<
    readonly [string, 'ours' | 'theirs' | 'manual']
  >
  readonly [key: string]: unknown
}

export interface WebOperationResult {
  readonly stdout: string
  readonly stderr: string
  readonly exitCode: number
  readonly repositoryPath?: string
  readonly candidates?: ReadonlyArray<WebBranchPruneCandidate>
  readonly pruned?: ReadonlyArray<WebBranchPruneCandidate>
  readonly undo?: {
    readonly branch: string
    readonly originalTip: string
    readonly rewrittenTip: string
  }
}

export interface WebRepositoryInitializationOptions {
  readonly name: string
  readonly parentPath: string
  readonly description: string
  readonly initialBranch?: string
  readonly createReadme: boolean
  readonly gitignore: string | null
  readonly license: string | null
  readonly initialCommit: boolean
}

export interface WebRepositorySetupOptions {
  readonly defaultParentPath: string
  readonly gitignoreNames: ReadonlyArray<string>
  readonly licenses: ReadonlyArray<{
    readonly name: string
    readonly featured: boolean
  }>
}

export interface WebRepositorySetupPreview {
  readonly repositoryPath: string
  readonly repositoryName: string
  readonly canCreate: boolean
  readonly readmeExists: boolean
  readonly isRepository: boolean
  readonly isSubfolderOfRepository: boolean
  readonly warnings: ReadonlyArray<{
    readonly code:
      | 'invalid-path'
      | 'existing-repository'
      | 'subfolder-of-repository'
      | 'readme-overwrite'
    readonly message: string
  }>
}

export interface WebHostingAccount {
  readonly credentialId: string
  readonly login: string
  readonly name: string
  readonly endpoint: string
  readonly provider?: 'github' | 'gitlab'
}

export interface WebPullRequest {
  readonly number: number
  readonly title: string
  readonly html_url?: string
  readonly state?: string
  readonly user?: {
    readonly login: string
  }
  readonly head?: {
    readonly ref: string
    readonly sha?: string
    readonly repo?: {
      readonly clone_url?: string
      readonly owner?: {
        readonly login: string
      }
    }
  }
  readonly base?: {
    readonly sha?: string
  }
}

export interface WebPullRequestDetails {
  readonly pullRequest: WebPullRequest
  readonly commitSHAs: ReadonlyArray<string>
  readonly files: ReadonlyArray<
    WebFile & {
      readonly additions: number
      readonly deletions: number
      readonly patch: string | null
    }
  >
}

export interface WebCheckRun {
  readonly id: number
  readonly name: string
  readonly description: string
  readonly status: string
  readonly conclusion: string | null
  readonly appName: string
  readonly htmlUrl: string | null
  readonly checkSuiteId: number | null
}

export interface WebChecks {
  readonly status: string
  readonly conclusion: string | null
  readonly checks: ReadonlyArray<WebCheckRun>
}

export interface WebNotification {
  readonly id: string
  readonly reason: string
  readonly updatedAt: string
  readonly title: string
  readonly type: string
  readonly target: {
    readonly owner: string
    readonly repository: string
    readonly pullRequestNumber: number
  } | null
}

export interface WebLfsStatus {
  readonly available: boolean
  readonly version: string | null
  readonly filtersConfigured: boolean
  readonly hooksInstalled: boolean
  readonly trackedPatterns: ReadonlyArray<string>
  readonly mismatches: ReadonlyArray<{
    readonly kind: string
    readonly message: string
  }>
}

export interface WebLfsOperation {
  readonly id: string
  readonly command: string
  readonly status: 'running' | 'completed' | 'failed' | 'cancelled'
  readonly output: string
  readonly progress: number | null
}

export interface WebUpdateStatus {
  readonly status: 'manual' | 'up-to-date' | 'available'
  readonly currentVersion: string
  readonly platform: string
  readonly availableVersion: string | null
  readonly releaseNotes: string
  readonly message: string
}

export interface WebUpdateOperation {
  readonly id: string
  readonly status:
    | 'downloading'
    | 'downloaded'
    | 'cancelled'
    | 'failed'
    | 'opened'
  readonly downloadedBytes: number
  readonly totalBytes: number
  readonly artifactName: string
  readonly error: string | null
}

export interface WebIntegrations {
  readonly platform: string
  readonly editors: ReadonlyArray<{
    readonly name: string
    readonly path: string
  }>
  readonly shells: ReadonlyArray<{
    readonly name: string
    readonly path: string
  }>
  readonly dependencies: Record<string, boolean>
  readonly guidance: string | null
}

export interface WebCustomIntegration {
  readonly path: string
  readonly arguments: string
}

export interface WebIntegrationSelection {
  readonly name: string | null
  readonly custom: WebCustomIntegration | null
}

export interface WebRepositoryRuleset {
  readonly id: number
  readonly name: string
  readonly target: string
  readonly enforcement: string
  readonly ruleTypes: ReadonlyArray<string>
  readonly bypassEligible: boolean
  readonly bypassMode: string | null
  readonly source: string
}

export interface WebPushBypassRequest {
  readonly number: number
  readonly status: string
  readonly comment: string
  readonly htmlURL: string | null
  readonly violations: ReadonlyArray<string>
}

export interface WebRepositoryPolicies {
  readonly branch: string
  readonly rulesets: ReadonlyArray<WebRepositoryRuleset>
  readonly effectiveRuleTypes: ReadonlyArray<string>
  readonly bypassRequests: ReadonlyArray<WebPushBypassRequest>
}

export interface WebCopilotMetadata {
  readonly models: ReadonlyArray<{ readonly id: string; readonly name: string }>
  readonly quota: Record<string, unknown>
}

export interface PublishRepositoryOptions {
  readonly path: string
  readonly name: string
  readonly organization: string
  readonly description: string
  readonly private: boolean
}

export interface WebApplicationState {
  readonly repositories: ReadonlyArray<WebRepository>
  readonly emoji: Map<string, Emoji>
  readonly repositorySetupOptions: WebRepositorySetupOptions | null
  readonly selectedRepositoryInspection: WebRepositoryInspection | null
  readonly pinnedRepositoryPaths: ReadonlyArray<string>
  readonly selectedRepositoryPath: string | null
  readonly selectedFilePath: string | null
  readonly includedFiles: ReadonlyArray<string>
  readonly fileSelections: ReadonlyMap<string, DiffSelection>
  readonly partialFilePatches: ReadonlyMap<string, string>
  readonly changesFilter: WebChangesFilter
  readonly gitIdentity: WebGitIdentity | null
  readonly commitDraft: string
  readonly commitTrailerText: string
  readonly commitOptions: WebCommitOptions
  readonly commitToAmend: WebCommit | null
  readonly commitDialogRequest: number
  readonly commitSpellcheckEnabled: boolean
  readonly tutorialRepositoryPath: string | null
  readonly tutorialPaused: boolean
  readonly currentTutorialStep: TutorialStep
  readonly historyFilterText: string
  readonly historyGraphMode: boolean
  readonly historyGraphHiddenRefs: ReadonlyArray<string>
  readonly historyGraphCollapsedGroups: ReadonlyArray<string>
  readonly selectedSection:
    | 'changes'
    | 'history'
    | 'compare'
    | 'pull-requests'
    | 'notifications'
    | 'account'
    | 'copilot'
    | 'updates'
  readonly status: WebStatus | null
  readonly branches: WebBranches | null
  readonly history: ReadonlyArray<WebCommit>
  readonly historyRewriteUndo: WebHistoryRewriteUndo | null
  readonly cherryPickUndo: WebCherryPickUndo | null
  readonly hasMoreHistory: boolean
  readonly selectedHistoryCommitSHA: string | null
  readonly historyCommitDetails: WebCommitDetails | null
  readonly selectedHistoryFilePath: string | null
  readonly historyDiff: WebDiff | null
  readonly historyInspectionLoading: boolean
  readonly comparisonBranch: string | null
  readonly comparisonMode: 'Ahead' | 'Behind'
  readonly comparisonFilterText: string
  readonly comparisonBranchListVisible: boolean
  readonly comparison: WebComparison | null
  readonly comparisonLoading: boolean
  readonly diff: WebDiff | null
  readonly inspectedStash: WebStash | null
  readonly stashFiles: ReadonlyArray<WebFile>
  readonly selectedStashFilePath: string | null
  readonly stashDiff: WebDiff | null
  readonly hostingAccount: WebHostingAccount | null
  readonly pullRequests: ReadonlyArray<WebPullRequest>
  readonly pullRequestDetails: WebPullRequestDetails | null
  readonly checks: WebChecks | null
  readonly notifications: ReadonlyArray<WebNotification>
  readonly lfsStatus: WebLfsStatus | null
  readonly lfsOperation: WebLfsOperation | null
  readonly updateStatus: WebUpdateStatus | null
  readonly updateOperation: WebUpdateOperation | null
  readonly integrations: WebIntegrations | null
  readonly repositoryPolicies: WebRepositoryPolicies | null
  readonly copilotMetadata: WebCopilotMetadata | null
  readonly copilotContent: string | null
  readonly loading: boolean
  readonly error: string | null
  readonly errorCode: string | null
  readonly errorActionURL: string | null
  readonly hookFailure: WebHookFailure | null
  readonly operationOutput: WebOperationOutput | null
  readonly operationTask: WebOperationTask | null
  readonly configLockScope: WebGitConfigScope | null
  readonly canRetry: boolean
}

export interface WebApplicationStore {
  getState(): WebApplicationState
  subscribe(listener: () => void): () => void
}

export interface WebDispatcher {
  loadRepositorySetupOptions(): Promise<void>
  previewRepositoryInitialization(
    options: Pick<
      WebRepositoryInitializationOptions,
      'name' | 'parentPath' | 'createReadme'
    >
  ): Promise<WebRepositorySetupPreview>
  previewCloneRepository(
    url: string,
    path: string
  ): Promise<WebCloneSetupPreview>
  inspectRepository(path: string): Promise<WebRepositoryInspection>
  trustRepository(path: string): Promise<void>
  addRepository(path: string): Promise<void>
  chooseRepository(): Promise<void>
  cloneRepository(url: string, path: string, branch?: string): Promise<void>
  initializeRepository(
    options: WebRepositoryInitializationOptions
  ): Promise<void>
  chooseDirectory(): Promise<string | null>
  createTutorialRepository(parentPath: string): Promise<void>
  resumeTutorial(): Promise<void>
  pauseTutorial(): Promise<void>
  selectRepository(path: string): Promise<void>
  toggleRepositoryPinned(path: string): void
  setRepositoryDefaultBranch(branch: string | null): Promise<void>
  setRepositoryAlias(alias: string): void
  setRepositoryGroup(group: string | null): void
  renameRepositoryGroup(group: string, nextGroup: string | null): void
  relocateRepository(oldPath: string, newPath: string): Promise<void>
  refreshRepositoryIndicators(): Promise<void>
  openRepositoryInNewWindow(path: string): void
  selectFile(path: string): Promise<void>
  setFileIncluded(path: string, included: boolean): void
  setFileSelection(
    path: string,
    selection: DiffSelection,
    patch: string | null
  ): void
  setChangesFilterText(text: string): void
  setComparisonFilterText(text: string): void
  setComparisonBranchListVisible(visible: boolean): void
  setChangesFilterOption(
    option:
      | 'isIncludedInCommit'
      | 'isExcludedFromCommit'
      | 'isNewFile'
      | 'isModifiedFile'
      | 'isDeletedFile',
    enabled: boolean
  ): void
  setAllVisibleFilesIncluded(
    files: ReadonlyArray<string>,
    included: boolean
  ): void
  setHistoryFilterText(text: string): Promise<void>
  setHistoryGraphMode(enabled: boolean): Promise<void>
  setHistoryGraphHiddenRefs(refs: ReadonlyArray<string>): void
  setHistoryGraphCollapsedGroups(groups: ReadonlyArray<string>): void
  inspectHistoryCommit(sha: string): Promise<void>
  selectHistoryFile(path: string): Promise<void>
  clearHistoryInspection(): void
  loadComparison(branch: string, mode: 'Ahead' | 'Behind'): Promise<void>
  loadRemoteTagMetadata(): Promise<WebBranches>
  inspectStash(stash: WebStash): Promise<void>
  selectStashFile(path: string): Promise<void>
  clearStashInspection(): void
  loadGitIdentity(): Promise<void>
  configureGitIdentity(
    scope: WebGitConfigScope,
    name: string,
    email: string
  ): Promise<void>
  recoverGitConfigLock(scope: WebGitConfigScope): Promise<void>
  openGlobalGitConfig(): Promise<void>
  setCommitDraft(message: string): void
  setCommitTrailerText(text: string): void
  setCommitOption(option: keyof WebCommitOptions, value: boolean): void
  startAmendingCommit(sha: string): Promise<void>
  stopAmendingCommit(): void
  requestCommitDialog(): void
  setCommitSpellcheckEnabled(enabled: boolean): void
  appendIgnoreFile(paths: ReadonlyArray<string>): Promise<void>
  appendIgnorePattern(patterns: ReadonlyArray<string>): Promise<void>
  copyPaths(paths: ReadonlyArray<string>, relative: boolean): Promise<void>
  copyText(text: string): Promise<void>
  openPath(path: string, reveal?: boolean): Promise<void>
  openIntegration(
    kind: 'editor' | 'shell',
    path: string,
    selection?: WebIntegrationSelection
  ): Promise<void>
  runOperation(
    operation: WebGitOperation,
    options?: WebOperationOptions
  ): Promise<void>
  runOperationOrThrow(
    operation: WebGitOperation,
    options?: WebOperationOptions
  ): Promise<void>
  cancelOperation(): Promise<void>
  previewPruneBranches(): Promise<ReadonlyArray<WebBranchPruneCandidate>>
  commit(
    message: string,
    options?: Omit<WebOperationOptions, 'message'>
  ): Promise<void>
  discardFiles(
    files: ReadonlyArray<string>,
    confirmed: boolean,
    permanently?: boolean
  ): Promise<void>
  selectSection(
    section:
      | 'changes'
      | 'history'
      | 'compare'
      | 'pull-requests'
      | 'notifications'
      | 'account'
      | 'copilot'
      | 'updates'
  ): Promise<void>
  loadMoreHistory(): Promise<void>
  refresh(): Promise<void>
  removeRepository(path: string): void
  deleteRepository(path: string, mode: WebRepositoryDeleteMode): Promise<void>
  pullAllRepositories(): Promise<void>
  pullRepositoryGroup(group: string | null): Promise<void>
  dismissError(): void
  openErrorAction(): void
  signIn(
    provider: 'github' | 'gitlab',
    endpoint: string,
    token: string
  ): Promise<void>
  signOut(): Promise<void>
  publishRepository(options: PublishRepositoryOptions): Promise<void>
  loadPullRequests(owner: string, repository: string): Promise<void>
  createPullRequest(
    owner: string,
    repository: string,
    title: string,
    head: string,
    base: string,
    body: string
  ): Promise<void>
  checkoutPullRequest(pullRequest: WebPullRequest): Promise<void>
  loadPullRequestDetails(
    owner: string,
    repository: string,
    pullRequestNumber: number
  ): Promise<void>
  loadChecks(owner: string, repository: string, ref: string): Promise<void>
  rerunCheckSuites(
    owner: string,
    repository: string,
    checkSuiteIds: ReadonlyArray<number>
  ): Promise<void>
  retryLastAction(): Promise<void>
  dismissHistoryRewriteUndo(): void
  dismissCherryPickUndo(): void
  loadLfsStatus(): Promise<void>
  installLfs(scope: 'local' | 'global', confirmed: boolean): Promise<void>
  repairLfs(confirmed: boolean): Promise<void>
  startLfsTransfer(command: 'pull' | 'push' | 'fetch'): Promise<void>
  cancelLfsTransfer(): Promise<void>
  checkForUpdates(): Promise<void>
  downloadUpdate(): Promise<void>
  cancelUpdateDownload(): Promise<void>
  openDownloadedUpdate(confirmed: boolean): Promise<void>
  loadIntegrations(): Promise<void>
  launchIntegration(
    kind: 'editor' | 'shell',
    name: string | null,
    custom?: WebCustomIntegration | null
  ): Promise<void>
  loadRepositoryPolicies(owner: string, repository: string): Promise<void>
  pushRepository(owner: string, repository: string): Promise<void>
  loadCopilotMetadata(): Promise<void>
  generateCopilotCommitMessage(model: string): Promise<void>
  resolveCopilotConflicts(model: string): Promise<void>
  cancelCopilot(): void
  requestNotificationPermission(): Promise<NotificationPermission>
  loadNotifications(): Promise<void>
  checkoutNotification(notification: WebNotification): Promise<void>
  openExternal(url: string): void
}

export interface WebGitClient {
  getRepositorySetupOptions(): Promise<WebRepositorySetupOptions>
  previewRepositoryInitialization(
    options: Pick<
      WebRepositoryInitializationOptions,
      'name' | 'parentPath' | 'createReadme'
    >
  ): Promise<WebRepositorySetupPreview>
  previewCloneRepository(
    url: string,
    path: string
  ): Promise<WebCloneSetupPreview>
  inspectRepository(path: string): Promise<WebRepositoryInspection>
  trustRepository(path: string): Promise<void>
  deleteRepository(path: string, mode: WebRepositoryDeleteMode): Promise<void>
  getStatus(path: string): Promise<WebStatus>
  getBranches(path: string, includeRemoteTags?: boolean): Promise<WebBranches>
  getRepositoryIndicators(path: string): Promise<WebRepositoryIndicators>
  getHistory(
    path: string,
    limit: number,
    skip: number,
    query?: string,
    all?: boolean
  ): Promise<WebHistory>
  getComparison(
    path: string,
    branch: string,
    mode: 'Ahead' | 'Behind'
  ): Promise<WebComparison>
  getCommitDetails(path: string, sha: string): Promise<WebCommitDetails>
  getDiff(
    path: string,
    file: string,
    sha?: string,
    oldPath?: string,
    commitish?: string,
    parentCommitish?: string
  ): Promise<WebDiff>
  getStashFiles(path: string, stash: string): Promise<WebStashFiles>
  getStashDiff(path: string, stash: string, file: string): Promise<WebDiff>
  getGitIdentity(path: string): Promise<WebGitIdentity>
  getGlobalGitConfigPath(): Promise<{ readonly path: string }>
  setGitIdentity(
    path: string,
    scope: WebGitConfigScope,
    name: string,
    email: string
  ): Promise<WebGitIdentity>
  recoverGitConfigLock(
    path: string,
    scope: WebGitConfigScope,
    confirmed: boolean
  ): Promise<void>
  appendIgnore(path: string, request: WebGitIgnoreRequest): Promise<WebStatus>
  getLfsStatus(path: string): Promise<WebLfsStatus>
  installLfs(
    path: string,
    scope: 'local' | 'global',
    confirmed: boolean
  ): Promise<WebLfsStatus>
  repairLfs(path: string, confirmed: boolean): Promise<WebLfsStatus>
  startLfsTransfer(
    path: string,
    command: 'pull' | 'push' | 'fetch'
  ): Promise<WebLfsOperation>
  getLfsOperation(id: string): Promise<WebLfsOperation>
  cancelLfsOperation(id: string): Promise<WebLfsOperation>
  runOperation(
    path: string,
    operation: WebGitOperation,
    options?: WebOperationOptions
  ): Promise<WebOperationResult>
  startOperation(
    path: string,
    operation: WebGitOperation,
    options?: WebOperationOptions
  ): Promise<WebOperationTask>
  getOperation(id: string): Promise<WebOperationTask>
  cancelOperation(id: string): Promise<WebOperationTask>
}

export interface WebHostingClient {
  signIn(
    provider: 'github' | 'gitlab',
    endpoint: string,
    token: string
  ): Promise<WebHostingAccount>
  signOut(account: WebHostingAccount): Promise<void>
  publish(
    account: WebHostingAccount,
    options: PublishRepositoryOptions
  ): Promise<void>
  getPullRequests(
    account: WebHostingAccount,
    owner: string,
    repository: string
  ): Promise<ReadonlyArray<WebPullRequest>>
  createPullRequest(
    account: WebHostingAccount,
    owner: string,
    repository: string,
    title: string,
    head: string,
    base: string,
    body: string
  ): Promise<WebPullRequest>
  checkoutPullRequest(
    account: WebHostingAccount,
    path: string,
    pullRequest: WebPullRequest
  ): Promise<void>
  getPullRequestDetails(
    account: WebHostingAccount,
    owner: string,
    repository: string,
    pullRequestNumber: number
  ): Promise<WebPullRequestDetails>
  getChecks(
    account: WebHostingAccount,
    owner: string,
    repository: string,
    ref: string
  ): Promise<WebChecks | null>
  rerunCheckSuites(
    account: WebHostingAccount,
    owner: string,
    repository: string,
    checkSuiteIds: ReadonlyArray<number>
  ): Promise<void>
  getNotifications(
    account: WebHostingAccount
  ): Promise<ReadonlyArray<WebNotification>>
  markNotificationRead(
    account: WebHostingAccount,
    notificationId: string
  ): Promise<void>
  getRepositoryPolicies(
    account: WebHostingAccount,
    owner: string,
    repository: string,
    branch: string
  ): Promise<WebRepositoryPolicies>
  pushRepository(
    account: WebHostingAccount,
    path: string,
    owner: string,
    repository: string,
    branch: string
  ): Promise<void>
  getCopilotMetadata(
    account: WebHostingAccount,
    path: string
  ): Promise<WebCopilotMetadata>
  generateCopilotCommitMessage(
    account: WebHostingAccount,
    path: string,
    model: string
  ): Promise<string>
  resolveCopilotConflicts(
    account: WebHostingAccount,
    path: string,
    model: string
  ): Promise<string>
}

export interface WebPlatform {
  chooseDirectory(): Promise<string | null>
  copy(text: string): Promise<void>
  openPath(path: string, reveal?: boolean): Promise<void>
  openRepositoryInNewWindow(path: string): void
  openIntegration(
    kind: 'editor' | 'shell',
    path: string,
    selection?: WebIntegrationSelection
  ): Promise<void>
  openExternal(url: string): void
  requestNotificationPermission(): Promise<NotificationPermission>
  notify(title: string, body: string, onClick?: () => void): void
  checkForUpdates(): Promise<WebUpdateStatus>
  downloadUpdate(): Promise<WebUpdateOperation>
  getUpdateOperation(id: string): Promise<WebUpdateOperation>
  cancelUpdateOperation(id: string): Promise<WebUpdateOperation>
  openDownloadedUpdate(
    id: string,
    confirmed: boolean
  ): Promise<WebUpdateOperation>
  getIntegrations(): Promise<WebIntegrations>
  launchIntegration(
    kind: 'editor' | 'shell',
    target: string,
    name: string | null,
    custom?: WebCustomIntegration | null
  ): Promise<void>
}
