import {
  WebApplicationState,
  WebApplicationStore,
  WebDispatcher,
  WebGitClient,
  WebHistory,
  WebHostingAccount,
  WebHostingClient,
  WebNotification,
  WebRepositoryPolicies,
  WebStash,
  WebPlatform,
  WebPullRequestDetails,
  WebRepository,
  WebChangesFilter,
  PublishRepositoryOptions,
  WebGitOperation,
  WebOperationOptions,
  WebRepositoryInitializationOptions,
  WebCloneSetupPreview,
  WebRepositoryInspection,
  WebGitConfigScope,
  WebCommitOptions,
  WebCommitTrailer,
  WebWorktree,
  WebHookFailure,
  WebOperationOutput,
  WebOperationResult,
  WebRepositoryDeleteMode,
  WebStatus,
  WebBranches,
  WebOperationTask,
  WebDiff,
} from './contracts'
import { cancelCopilotRequest } from './client'
import { DiffSelection, DiffSelectionType } from '../../models/diff'
import webEmoji from '../web-emoji'
import { TutorialStep } from '../../models/tutorial-step'

const storageKey = 'desktop-plus-web-source-state'
const historyPageSize = 100
const historyGraphModeKey = 'desktop-plus-web-history-graph-mode'
const historyGraphHiddenRefsKey = 'desktop-plus-web-history-hidden-refs'
const historyGraphCollapsedGroupsKey =
  'desktop-plus-web-history-collapsed-groups'
const comparisonStateKey = 'desktop-plus-web-comparison-state'

interface PersistedComparisonState {
  readonly branch: string | null
  readonly mode: 'Ahead' | 'Behind'
  readonly filterText: string
  readonly branchListVisible: boolean
}

function comparisonStorageKey(repositoryPath: string | null) {
  return `${comparisonStateKey}:${repositoryPath || 'none'}`
}

function getStoredComparisonState(
  repositoryPath: string | null
): PersistedComparisonState {
  try {
    const value = JSON.parse(
      localStorage.getItem(comparisonStorageKey(repositoryPath)) || '{}'
    ) as Partial<PersistedComparisonState>
    return {
      branch: typeof value.branch === 'string' ? value.branch : null,
      mode: value.mode === 'Ahead' ? 'Ahead' : 'Behind',
      filterText: typeof value.filterText === 'string' ? value.filterText : '',
      branchListVisible: value.branchListVisible !== false,
    }
  } catch {
    return {
      branch: null,
      mode: 'Behind',
      filterText: '',
      branchListVisible: true,
    }
  }
}

function setStoredComparisonState(
  repositoryPath: string | null,
  values: Partial<PersistedComparisonState>
) {
  const current = getStoredComparisonState(repositoryPath)
  localStorage.setItem(
    comparisonStorageKey(repositoryPath),
    JSON.stringify({ ...current, ...values })
  )
}

function getStoredBoolean(key: string, fallback: boolean) {
  const value = localStorage.getItem(key)
  return value === null ? fallback : value === 'true'
}

function getStoredStringArray(key: string, fallback: ReadonlyArray<string>) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null')
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : fallback
  } catch {
    return fallback
  }
}

function setStoredStringArray(key: string, values: ReadonlyArray<string>) {
  localStorage.setItem(key, JSON.stringify(values))
}

function defaultHistoryGraphHiddenRefs(
  branches: WebApplicationState['branches']
) {
  if (!branches) return []
  const refs = (branches.branches || []).map(
    branch =>
      branch.ref ||
      (branch.type === 'Remote'
        ? `refs/remotes/${branch.name}`
        : `refs/heads/${branch.name}`)
  )
  const selected = new Set<string>()
  const current = branches.branch
  if (current) selected.add(current.ref || `refs/heads/${current.name}`)
  if (branches.defaultBranch) {
    const defaultBranch = (branches.branches || []).find(
      branch =>
        branch.type !== 'Remote' && branch.name === branches.defaultBranch
    )
    selected.add(defaultBranch?.ref || `refs/heads/${branches.defaultBranch}`)
  }
  return [
    ...refs.filter(ref => !selected.has(ref)),
    ...(branches.tags || []).map(tag => `refs/tags/${tag.name}`),
  ]
}

function joinRepositoryPath(repository: string, file: string) {
  return `${repository.replace(/[\\/]+$/, '')}/${file}`
}

interface PersistedState {
  readonly repositories: ReadonlyArray<WebRepository>
  readonly pinnedRepositoryPaths: ReadonlyArray<string>
  readonly selectedRepositoryPath: string | null
  readonly hostingAccount: WebHostingAccount | null
  readonly changesFilter: WebChangesFilter
  readonly commitDrafts: Record<string, string>
  readonly commitTrailerTexts: Record<string, string>
  readonly commitOptions: Record<string, Partial<WebCommitOptions>>
  readonly commitSpellcheckEnabled: boolean
  readonly tutorialRepositoryPath: string | null
  readonly tutorialPaused: boolean
}

const defaultChangesFilter: WebChangesFilter = {
  filterText: '',
  isIncludedInCommit: false,
  isExcludedFromCommit: false,
  isNewFile: false,
  isModifiedFile: false,
  isDeletedFile: false,
}

function repositoryName(path: string) {
  const trimmed = path.replace(/[\\/]+$/, '')
  const pieces = trimmed.split(/[\\/]/)
  return pieces[pieces.length - 1] || path
}

function getTutorialStep(
  status: WebStatus,
  branches: WebBranches,
  history: ReadonlyArray<WebApplicationState['history'][number]>,
  paused: boolean
) {
  if (paused) return TutorialStep.Paused
  const currentBranch = branches.branch?.name || null
  const defaultBranch = branches.defaultBranch || 'main'
  const hasTutorialBranch = Boolean(
    currentBranch &&
      currentBranch !== defaultBranch &&
      branches.branches?.some(
        branch => branch.type !== 'Remote' && branch.name === currentBranch
      )
  )
  if (!hasTutorialBranch) return TutorialStep.CreateBranch

  const readmeChanged = status.workingDirectory.files.some(
    file =>
      file.path.toLowerCase() === 'readme.md' &&
      file.status.kind !== 'Conflicted'
  )
  if (readmeChanged) return TutorialStep.MakeCommit
  if (history.length < 2) return TutorialStep.EditFile
  return TutorialStep.AllDone
}

function isWebWorktree(value: unknown): value is WebWorktree {
  if (typeof value !== 'object' || value === null) return false
  const worktree = value as Partial<WebWorktree>
  return (
    typeof worktree.path === 'string' &&
    typeof worktree.head === 'string' &&
    (worktree.branch === null || typeof worktree.branch === 'string') &&
    typeof worktree.isDetached === 'boolean' &&
    (worktree.type === 'main' || worktree.type === 'linked') &&
    typeof worktree.isLocked === 'boolean' &&
    typeof worktree.isPrunable === 'boolean' &&
    (worktree.isDirty === undefined || typeof worktree.isDirty === 'boolean')
  )
}

function hasStringPath(value: unknown): value is { path: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { path: unknown }).path === 'string'
  )
}

function isWebHostingAccount(value: unknown): value is WebHostingAccount {
  if (typeof value !== 'object' || value === null) return false
  const account = value as WebHostingAccount
  return (
    typeof account.credentialId === 'string' &&
    typeof account.login === 'string' &&
    typeof account.endpoint === 'string'
  )
}

function isWebChangesFilter(value: unknown): value is WebChangesFilter {
  if (typeof value !== 'object' || value === null) return false
  const filter = value as Partial<WebChangesFilter>
  return (
    typeof filter.filterText === 'string' &&
    typeof filter.isIncludedInCommit === 'boolean' &&
    typeof filter.isExcludedFromCommit === 'boolean' &&
    typeof filter.isNewFile === 'boolean' &&
    typeof filter.isModifiedFile === 'boolean' &&
    typeof filter.isDeletedFile === 'boolean'
  )
}

function stringRecord(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return {}
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string'
    )
  )
}

function commitOptionsRecord(
  value: unknown
): Record<string, Partial<WebCommitOptions>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return {}
  return Object.fromEntries(
    Object.entries(value).flatMap(([path, options]) => {
      if (typeof options !== 'object' || options === null) return []
      const candidate = options as Record<string, unknown>
      return [
        [
          path,
          {
            ...(typeof candidate.signOff === 'boolean'
              ? { signOff: candidate.signOff }
              : {}),
            ...(typeof candidate.amend === 'boolean'
              ? { amend: candidate.amend }
              : {}),
            ...(typeof candidate.noVerify === 'boolean'
              ? { noVerify: candidate.noVerify }
              : {}),
            ...(typeof candidate.allowEmpty === 'boolean'
              ? { allowEmpty: candidate.allowEmpty }
              : {}),
          },
        ],
      ]
    })
  )
}

function loadPersistedState(): PersistedState {
  try {
    const value: {
      repositories?: unknown
      pinnedRepositoryPaths?: unknown
      selectedRepositoryPath?: unknown
      hostingAccount?: unknown
      changesFilter?: unknown
      commitDrafts?: unknown
      commitTrailerTexts?: unknown
      commitOptions?: unknown
      commitSpellcheckEnabled?: unknown
      tutorialRepositoryPath?: unknown
      tutorialPaused?: unknown
    } = JSON.parse(localStorage.getItem(storageKey) || '{}')
    const repositories = Array.isArray(value.repositories)
      ? value.repositories.filter(hasStringPath).map(repository => {
          const saved = repository as {
            path: string
            lastOpenedAt?: unknown
            defaultBranch?: unknown
            currentBranch?: unknown
            alias?: unknown
            group?: unknown
            remoteURL?: unknown
            remoteWebURL?: unknown
            changedFilesCount?: unknown
            aheadBehind?: unknown
            worktrees?: unknown
            isTutorialRepository?: unknown
          }
          const aheadBehind =
            typeof saved.aheadBehind === 'object' &&
            saved.aheadBehind !== null &&
            typeof (saved.aheadBehind as { ahead?: unknown }).ahead ===
              'number' &&
            typeof (saved.aheadBehind as { behind?: unknown }).behind ===
              'number'
              ? {
                  ahead: (saved.aheadBehind as { ahead: number }).ahead,
                  behind: (saved.aheadBehind as { behind: number }).behind,
                }
              : null
          return {
            path: saved.path,
            name: repositoryName(saved.path),
            ...(typeof saved.lastOpenedAt === 'number'
              ? { lastOpenedAt: saved.lastOpenedAt }
              : {}),
            defaultBranch:
              typeof saved.defaultBranch === 'string'
                ? saved.defaultBranch
                : null,
            ...(typeof saved.currentBranch === 'string'
              ? { currentBranch: saved.currentBranch }
              : {}),
            ...(typeof saved.alias === 'string' ? { alias: saved.alias } : {}),
            ...(typeof saved.group === 'string' ? { group: saved.group } : {}),
            ...(typeof saved.remoteURL === 'string'
              ? { remoteURL: saved.remoteURL }
              : {}),
            ...(typeof saved.remoteWebURL === 'string'
              ? { remoteWebURL: saved.remoteWebURL }
              : {}),
            ...(typeof saved.changedFilesCount === 'number'
              ? { changedFilesCount: saved.changedFilesCount }
              : {}),
            ...(aheadBehind ? { aheadBehind } : {}),
            ...(Array.isArray(saved.worktrees)
              ? {
                  worktrees: saved.worktrees.filter(isWebWorktree),
                }
              : {}),
            ...(saved.isTutorialRepository === true
              ? { isTutorialRepository: true }
              : {}),
          }
        })
      : []
    const pinnedRepositoryPaths = Array.isArray(value.pinnedRepositoryPaths)
      ? value.pinnedRepositoryPaths.filter(
          (path): path is string => typeof path === 'string'
        )
      : []
    return {
      repositories,
      pinnedRepositoryPaths,
      selectedRepositoryPath:
        typeof value.selectedRepositoryPath === 'string'
          ? value.selectedRepositoryPath
          : null,
      hostingAccount: isWebHostingAccount(value.hostingAccount)
        ? value.hostingAccount
        : null,
      changesFilter: isWebChangesFilter(value.changesFilter)
        ? value.changesFilter
        : defaultChangesFilter,
      commitDrafts: stringRecord(value.commitDrafts),
      commitTrailerTexts: stringRecord(value.commitTrailerTexts),
      commitOptions: commitOptionsRecord(value.commitOptions),
      commitSpellcheckEnabled:
        typeof value.commitSpellcheckEnabled === 'boolean'
          ? value.commitSpellcheckEnabled
          : true,
      tutorialRepositoryPath:
        typeof value.tutorialRepositoryPath === 'string'
          ? value.tutorialRepositoryPath
          : null,
      tutorialPaused:
        typeof value.tutorialPaused === 'boolean'
          ? value.tutorialPaused
          : false,
    }
  } catch {
    return {
      repositories: [],
      pinnedRepositoryPaths: [],
      selectedRepositoryPath: null,
      hostingAccount: null,
      changesFilter: defaultChangesFilter,
      commitDrafts: {},
      commitTrailerTexts: {},
      commitOptions: {},
      commitSpellcheckEnabled: true,
      tutorialRepositoryPath: null,
      tutorialPaused: false,
    }
  }
}

function initialState(): WebApplicationState {
  const persisted = loadPersistedState()
  const selectedPath = persisted.selectedRepositoryPath
  const comparisonState = getStoredComparisonState(selectedPath)
  return {
    repositories: persisted.repositories,
    emoji: webEmoji,
    repositorySetupOptions: null,
    selectedRepositoryInspection: null,
    pinnedRepositoryPaths: persisted.pinnedRepositoryPaths.filter(path =>
      persisted.repositories.some(repository => repository.path === path)
    ),
    selectedRepositoryPath: persisted.selectedRepositoryPath,
    selectedFilePath: null,
    includedFiles: [],
    fileSelections: new Map(),
    partialFilePatches: new Map(),
    changesFilter: persisted.changesFilter,
    commitDraft: selectedPath ? persisted.commitDrafts[selectedPath] || '' : '',
    commitTrailerText: selectedPath
      ? persisted.commitTrailerTexts[selectedPath] || ''
      : '',
    commitOptions: {
      amend: Boolean(
        selectedPath && persisted.commitOptions[selectedPath]?.amend
      ),
      signOff: Boolean(
        selectedPath && persisted.commitOptions[selectedPath]?.signOff
      ),
      noVerify: Boolean(
        selectedPath && persisted.commitOptions[selectedPath]?.noVerify
      ),
      allowEmpty: Boolean(
        selectedPath && persisted.commitOptions[selectedPath]?.allowEmpty
      ),
    },
    commitToAmend: null,
    commitDialogRequest: 0,
    commitSpellcheckEnabled: persisted.commitSpellcheckEnabled,
    tutorialRepositoryPath: persisted.tutorialRepositoryPath,
    tutorialPaused: persisted.tutorialPaused,
    currentTutorialStep: persisted.tutorialPaused
      ? TutorialStep.Paused
      : persisted.tutorialRepositoryPath
      ? TutorialStep.CreateBranch
      : TutorialStep.NotApplicable,
    historyFilterText: '',
    historyGraphMode: getStoredBoolean(historyGraphModeKey, false),
    historyGraphHiddenRefs: getStoredStringArray(historyGraphHiddenRefsKey, []),
    historyGraphCollapsedGroups: getStoredStringArray(
      historyGraphCollapsedGroupsKey,
      ['origin', 'upstream', 'tags']
    ),
    selectedSection: 'changes',
    status: null,
    branches: null,
    history: [],
    historyRewriteUndo: null,
    cherryPickUndo: null,
    hasMoreHistory: false,
    selectedHistoryCommitSHA: null,
    historyCommitDetails: null,
    selectedHistoryFilePath: null,
    historyDiff: null,
    historyInspectionLoading: false,
    comparisonBranch: comparisonState.branch,
    comparisonMode: comparisonState.mode,
    comparisonFilterText: comparisonState.filterText,
    comparisonBranchListVisible: comparisonState.branchListVisible,
    comparison: null,
    comparisonLoading: false,
    diff: null,
    inspectedStash: null,
    stashFiles: [],
    selectedStashFilePath: null,
    stashDiff: null,
    gitIdentity: null,
    hostingAccount: persisted.hostingAccount,
    pullRequests: [],
    pullRequestDetails: null,
    checks: null,
    notifications: [],
    lfsStatus: null,
    lfsOperation: null,
    updateStatus: null,
    updateOperation: null,
    integrations: null,
    repositoryPolicies: null,
    copilotMetadata: null,
    copilotContent: null,
    loading: false,
    error: null,
    errorCode: null,
    errorActionURL: null,
    hookFailure: null,
    operationOutput: null,
    operationTask: null,
    configLockScope: null,
    canRetry: false,
  }
}

export function createWebApplicationStore(
  git: WebGitClient,
  platform: WebPlatform,
  hosting: WebHostingClient
): WebApplicationStore & { readonly dispatcher: WebDispatcher } {
  let state = initialState()
  let persisted = loadPersistedState()
  const listeners = new Set<() => void>()
  let retryLastAction: (() => Promise<void>) | null = null
  let retryGenericCredentials: {
    readonly username: string
    readonly password: string
  } | null = null
  const deliveredNotificationIds = new Set<string>()
  let historyRefreshGeneration = 0
  let historyInspectionGeneration = 0
  let comparisonGeneration = 0
  let fileSelectionGeneration = 0
  let repositoryRefreshGeneration = 0
  let repositorySelectionGeneration = 0
  let persistenceTimer: number | null = null

  const emit = () => listeners.forEach(listener => listener())
  const writePersistedState = () => {
    if (persistenceTimer !== null) window.clearTimeout(persistenceTimer)
    persistenceTimer = null
    localStorage.setItem(storageKey, JSON.stringify(persisted))
  }
  const persistentKeys = new Set<keyof WebApplicationState>([
    'repositories',
    'pinnedRepositoryPaths',
    'selectedRepositoryPath',
    'hostingAccount',
    'changesFilter',
    'commitDraft',
    'commitTrailerText',
    'commitOptions',
    'commitSpellcheckEnabled',
    'tutorialRepositoryPath',
    'tutorialPaused',
  ])
  const update = (
    values: Partial<WebApplicationState>,
    options: { readonly persist?: boolean; readonly debounce?: boolean } = {}
  ) => {
    const previousState = state
    state = {
      ...state,
      ...(values.error === null
        ? { canRetry: false, errorCode: null, errorActionURL: null }
        : {}),
      ...values,
    }
    const shouldPersist =
      options.persist !== false &&
      (Object.keys(values) as ReadonlyArray<keyof WebApplicationState>).some(
        key => persistentKeys.has(key)
      )
    if (!shouldPersist) {
      emit()
      return
    }
    const commitDrafts = { ...persisted.commitDrafts }
    const commitTrailerTexts = { ...persisted.commitTrailerTexts }
    const commitOptions = { ...persisted.commitOptions }
    const selectedRepositoryChanged =
      values.selectedRepositoryPath !== undefined &&
      values.selectedRepositoryPath !== previousState.selectedRepositoryPath
    if (previousState.selectedRepositoryPath) {
      commitDrafts[previousState.selectedRepositoryPath] =
        previousState.commitDraft
      commitTrailerTexts[previousState.selectedRepositoryPath] =
        previousState.commitTrailerText
      commitOptions[previousState.selectedRepositoryPath] =
        previousState.commitOptions
    }
    if (!selectedRepositoryChanged && state.selectedRepositoryPath) {
      commitDrafts[state.selectedRepositoryPath] = state.commitDraft
      commitTrailerTexts[state.selectedRepositoryPath] = state.commitTrailerText
      commitOptions[state.selectedRepositoryPath] = state.commitOptions
    }
    persisted = {
      ...persisted,
      repositories: state.repositories,
      pinnedRepositoryPaths: state.pinnedRepositoryPaths,
      selectedRepositoryPath: state.selectedRepositoryPath,
      hostingAccount: state.hostingAccount,
      changesFilter: state.changesFilter,
      commitDrafts,
      commitTrailerTexts,
      commitOptions,
      commitSpellcheckEnabled: state.commitSpellcheckEnabled,
      tutorialRepositoryPath: state.tutorialRepositoryPath,
      tutorialPaused: state.tutorialPaused,
    }
    if (options.debounce) {
      if (persistenceTimer !== null) window.clearTimeout(persistenceTimer)
      persistenceTimer = window.setTimeout(writePersistedState, 250)
    } else {
      writePersistedState()
    }
    emit()
  }
  const begin = () => {
    retryLastAction = null
    update({
      loading: true,
      error: null,
      errorActionURL: null,
      hookFailure: null,
      operationOutput: null,
      operationTask: null,
      configLockScope: null,
      canRetry: false,
      historyRewriteUndo: null,
      cherryPickUndo: null,
    })
  }
  const fail = (error: unknown, retry?: () => Promise<void>) => {
    const errorActionURL =
      error &&
      typeof error === 'object' &&
      'bypassURL' in error &&
      typeof error.bypassURL === 'string'
        ? error.bypassURL
        : null
    retryLastAction = retry || null
    update({
      error: error instanceof Error ? error.message : String(error),
      errorCode:
        error &&
        typeof error === 'object' &&
        'code' in error &&
        typeof error.code === 'string'
          ? error.code
          : null,
      errorActionURL,
      hookFailure:
        error &&
        typeof error === 'object' &&
        'hookFailure' in error &&
        typeof error.hookFailure === 'object' &&
        error.hookFailure !== null
          ? (error.hookFailure as WebHookFailure)
          : null,
      operationOutput:
        error &&
        typeof error === 'object' &&
        'operationOutput' in error &&
        typeof error.operationOutput === 'object' &&
        error.operationOutput !== null
          ? (error.operationOutput as WebOperationOutput)
          : null,
      configLockScope:
        error &&
        typeof error === 'object' &&
        'configLockScope' in error &&
        (error.configLockScope === 'local' ||
          error.configLockScope === 'global')
          ? error.configLockScope
          : null,
      canRetry: Boolean(retryLastAction),
    })
  }
  const createPoller = <T>(
    fetch: (id: string) => Promise<T>,
    isRunning: (result: T) => boolean,
    onUpdate: (result: T) => void
  ) => {
    let timer: number | null = null
    const stop = () => {
      if (timer !== null) window.clearTimeout(timer)
      timer = null
    }
    const poll = (id: string) => {
      stop()
      timer = window.setTimeout(async () => {
        try {
          const result = await fetch(id)
          onUpdate(result)
          if (isRunning(result)) poll(id)
        } catch (error) {
          fail(error)
        }
      }, 500)
    }
    return { poll, stop }
  }
  const updatePoller = createPoller(
    id => platform.getUpdateOperation(id),
    updateOperation => updateOperation.status === 'downloading',
    updateOperation => update({ updateOperation })
  )
  const lfsPoller = createPoller(
    id => git.getLfsOperation(id),
    lfsOperation => lfsOperation.status === 'running',
    lfsOperation => update({ lfsOperation })
  )
  const stopUpdatePolling = updatePoller.stop
  const stopLfsPolling = lfsPoller.stop
  const pollUpdateOperation = updatePoller.poll
  const pollLfsOperation = lfsPoller.poll
  const waitForOperation = (
    task: WebOperationTask
  ): Promise<WebOperationTask> =>
    new Promise((resolve, reject) => {
      let timer: number | null = null
      const poll = async (current: WebOperationTask) => {
        update({ operationTask: current })
        if (current.status !== 'running') {
          resolve(current)
          return
        }
        timer = window.setTimeout(async () => {
          try {
            poll(await git.getOperation(current.id))
          } catch (error) {
            if (timer !== null) window.clearTimeout(timer)
            reject(error)
          }
        }, 300)
      }
      void poll(task)
    })
  const operationError = (task: WebOperationTask) => {
    const error = new Error(
      task.error || `Git operation ${task.operation} failed.`
    )
    Object.assign(error, {
      code: task.errorCode,
      hookFailure: task.hookFailure || null,
      configLockScope: task.configLockScope || null,
      bypassURL: task.bypassURL || null,
      operationOutput: task.result
        ? {
            stdout: task.result.stdout,
            stderr: task.result.stderr,
            exitCode: task.result.exitCode,
          }
        : null,
    })
    return error
  }
  const executeTrackedOperation = async (
    path: string,
    operation: WebGitOperation,
    options: WebOperationOptions = {}
  ): Promise<WebOperationResult | null> => {
    // Credentials are only retained long enough to start the retry. Keeping
    // them out of application state prevents them from reaching localStorage.
    const genericCredentials = retryGenericCredentials
    retryGenericCredentials = null
    const task = await git.startOperation(path, operation, {
      ...options,
      ...(genericCredentials ? { genericCredentials } : {}),
    })
    update({ operationTask: task })
    const completed = await waitForOperation(task)
    if (completed.status === 'cancelled') {
      await refreshRepository(path).catch(() => undefined)
      if (
        typeof document !== 'undefined' &&
        document.visibilityState === 'hidden'
      )
        platform.notify(
          'Desktop Plus',
          `${operation} was cancelled before it completed.`
        )
      return null
    }
    if (completed.status !== 'completed' || !completed.result)
      throw operationError(completed)
    if (
      typeof document !== 'undefined' &&
      document.visibilityState === 'hidden'
    )
      platform.notify('Desktop Plus', `${operation} completed.`)
    return completed.result
  }
  const publishOperationUndo = (
    operation: WebGitOperation,
    options: WebOperationOptions,
    result: WebOperationResult
  ) =>
    update({
      historyRewriteUndo: result.undo || null,
      cherryPickUndo:
        operation === 'cherry-pick' && result.undo
          ? {
              ...result.undo,
              count: options.values?.length || 0,
            }
          : null,
    })
  const selectedPath = () => {
    if (!state.selectedRepositoryPath)
      throw new Error('Choose a repository first.')
    return state.selectedRepositoryPath
  }
  const refreshRepository = async (
    path: string,
    historyFilterText = state.historyFilterText
  ) => {
    const generation = ++repositoryRefreshGeneration
    // A refresh replaces the status and diff payloads. Any file selection
    // request started against the previous snapshot must not clear loading or
    // restore stale diff data after the refresh has begun.
    const selectionGeneration = fileSelectionGeneration
    ++fileSelectionGeneration
    const inspectionGeneration = historyInspectionGeneration
    const activeComparisonGeneration = comparisonGeneration
    const selectedFileBeforeRefresh = state.selectedFilePath
    update({ loading: true, error: null })
    try {
      let comparisonState = getStoredComparisonState(path)
      const [status, branches, history] = await Promise.all([
        git.getStatus(path),
        git.getBranches(path),
        git.getHistory(
          path,
          historyPageSize,
          0,
          historyFilterText,
          state.historyGraphMode
        ),
      ])
      if (
        generation !== repositoryRefreshGeneration ||
        state.selectedRepositoryPath !== path
      )
        return
      let comparison: WebApplicationState['comparison'] = null
      if (comparisonState.branch) {
        const comparisonBranchExists = (branches.branches || []).some(
          branch => branch.name === comparisonState.branch
        )
        if (!comparisonBranchExists) {
          setStoredComparisonState(path, { branch: null })
          comparisonState = { ...comparisonState, branch: null }
        } else {
          comparison = await git
            .getComparison(path, comparisonState.branch, comparisonState.mode)
            .catch(() => null)
        }
      }
      if (
        generation !== repositoryRefreshGeneration ||
        state.selectedRepositoryPath !== path
      )
        return
      const gitIdentity = await git.getGitIdentity(path)
      if (
        generation !== repositoryRefreshGeneration ||
        state.selectedRepositoryPath !== path
      )
        return
      const tutorialPath = state.tutorialRepositoryPath
      const tutorialStep =
        tutorialPath === path
          ? getTutorialStep(
              status,
              branches,
              history.commits,
              state.tutorialPaused
            )
          : TutorialStep.NotApplicable
      const amendingCurrentRepository =
        state.selectedRepositoryPath === path && state.commitToAmend !== null
      const selectedFilePath =
        state.selectedFilePath &&
        status.workingDirectory.files.some(
          file => file.path === state.selectedFilePath
        )
          ? state.selectedFilePath
          : null
      let selectedDiff: WebDiff | null = null
      if (
        selectedFilePath !== null &&
        selectedFilePath === selectedFileBeforeRefresh
      ) {
        const sourceFile = status.workingDirectory.files.find(
          file => file.path === selectedFilePath
        )
        if (sourceFile) {
          selectedDiff = await git.getDiff(
            path,
            selectedFilePath,
            undefined,
            sourceFile.oldPath
          )
        }
      }
      if (
        generation !== repositoryRefreshGeneration ||
        state.selectedRepositoryPath !== path
      )
        return
      const selectionChangedDuringRefresh =
        fileSelectionGeneration !== selectionGeneration + 1
      const committableFiles = status.workingDirectory.files.filter(
        file => file.status.kind !== 'Conflicted'
      )
      const fileSelections = new Map(
        committableFiles.map(file => [
          file.path,
          selectionChangedDuringRefresh
            ? state.fileSelections.get(file.path) ||
              DiffSelection.fromInitialSelection(DiffSelectionType.All)
            : DiffSelection.fromInitialSelection(DiffSelectionType.All),
        ])
      )
      const includedFiles = committableFiles
        .filter(
          file =>
            fileSelections.get(file.path)?.getSelectionType() !==
            DiffSelectionType.None
        )
        .map(file => file.path)
      const partialFilePatches = selectionChangedDuringRefresh
        ? new Map(
            [...state.partialFilePatches].filter(([file]) =>
              fileSelections.has(file)
            )
          )
        : new Map<string, string>()
      const savedState = loadPersistedState()
      const savedOptions = savedState.commitOptions[path]
      update({
        repositories: state.repositories.map(repository =>
          repository.path === path
            ? {
                ...repository,
                currentBranch: branches.branch?.name || null,
                defaultBranch:
                  repository.defaultBranch || branches.defaultBranch || null,
                changedFilesCount: status.workingDirectory.files.length,
                aheadBehind: branches.aheadBehind,
                remoteURL:
                  branches.remotes?.find(remote => remote.name === 'origin')
                    ?.url || null,
                remoteWebURL:
                  branches.remotes?.find(remote => remote.name === 'origin')
                    ?.webURL || null,
                worktrees: branches.worktrees || [],
              }
            : repository
        ),
        status,
        branches,
        gitIdentity,
        currentTutorialStep: tutorialStep,
        history: history.commits,
        historyGraphHiddenRefs:
          localStorage.getItem(historyGraphHiddenRefsKey) !== null
            ? state.historyGraphHiddenRefs
            : defaultHistoryGraphHiddenRefs(branches),
        hasMoreHistory: history.commits.length === historyPageSize,
        ...(historyInspectionGeneration === inspectionGeneration
          ? {
              selectedHistoryCommitSHA: null,
              historyCommitDetails: null,
              selectedHistoryFilePath: null,
              historyDiff: null,
              historyInspectionLoading: false,
            }
          : {}),
        ...(comparisonGeneration === activeComparisonGeneration
          ? {
              comparisonBranch: comparisonState.branch,
              comparisonMode: comparisonState.mode,
              comparisonFilterText: comparisonState.filterText,
              comparisonBranchListVisible: comparisonState.branchListVisible,
              comparison,
              comparisonLoading: false,
            }
          : {}),
        ...(selectionChangedDuringRefresh ? {} : { selectedFilePath }),
        includedFiles,
        fileSelections,
        partialFilePatches,
        ...(selectionChangedDuringRefresh
          ? {}
          : {
              diff:
                selectedFilePath === state.selectedFilePath
                  ? selectedDiff
                  : null,
            }),
        inspectedStash: null,
        stashFiles: [],
        selectedStashFilePath: null,
        stashDiff: null,
        commitDraft: amendingCurrentRepository
          ? state.commitDraft
          : savedState.commitDrafts[path] || '',
        commitTrailerText: amendingCurrentRepository
          ? state.commitTrailerText
          : savedState.commitTrailerTexts[path] || '',
        commitOptions: {
          ...(amendingCurrentRepository
            ? state.commitOptions
            : {
                amend: Boolean(savedOptions?.amend),
                signOff: Boolean(savedOptions?.signOff),
                noVerify: Boolean(savedOptions?.noVerify),
                allowEmpty: Boolean(savedOptions?.allowEmpty),
              }),
        },
        commitToAmend: amendingCurrentRepository ? state.commitToAmend : null,
        historyFilterText,
      })
    } catch (error) {
      if (
        generation !== repositoryRefreshGeneration ||
        state.selectedRepositoryPath !== path
      )
        return
      const inspection = await git.inspectRepository(path).catch(() => null)
      if (
        generation !== repositoryRefreshGeneration ||
        state.selectedRepositoryPath !== path
      )
        return
      if (inspection && inspection.kind !== 'regular') {
        update({
          selectedRepositoryInspection: inspection,
          status: null,
          branches: null,
          history: [],
          hasMoreHistory: false,
          selectedFilePath: null,
          includedFiles: [],
          fileSelections: new Map(),
          partialFilePatches: new Map(),
          diff: null,
          inspectedStash: null,
          stashFiles: [],
          selectedStashFilePath: null,
          stashDiff: null,
          error: null,
        })
      } else {
        update({
          error: error instanceof Error ? error.message : String(error),
        })
      }
    } finally {
      if (
        generation === repositoryRefreshGeneration &&
        state.selectedRepositoryPath === path
      )
        update({ loading: false })
    }
  }
  const refreshRepositoryIndicators = async () => {
    const repositories = state.repositories.filter(
      repository => repository.path !== state.selectedRepositoryPath
    )
    let nextRepository = 0
    await Promise.all(
      Array.from({ length: Math.min(3, repositories.length) }, async () => {
        while (nextRepository < repositories.length) {
          const repository = repositories[nextRepository++]
          try {
            const indicators = await git.getRepositoryIndicators(
              repository.path
            )
            update(
              {
                repositories: state.repositories.map(candidate =>
                  candidate.path === repository.path
                    ? {
                        ...candidate,
                        ...indicators,
                        defaultBranch:
                          candidate.defaultBranch ||
                          indicators.defaultBranch ||
                          null,
                      }
                    : candidate
                ),
              },
              { persist: false }
            )
          } catch {}
        }
      })
    )
  }

  const dispatcher: WebDispatcher = {
    async loadRepositorySetupOptions() {
      try {
        update({
          repositorySetupOptions: await git.getRepositorySetupOptions(),
        })
      } catch (error) {
        fail(error, () => dispatcher.loadRepositorySetupOptions())
      }
    },

    async previewRepositoryInitialization(options) {
      try {
        return await git.previewRepositoryInitialization(options)
      } catch (error) {
        fail(error, async () => {
          await dispatcher.previewRepositoryInitialization(options)
        })
        throw error
      }
    },

    async previewCloneRepository(url, path): Promise<WebCloneSetupPreview> {
      try {
        return await git.previewCloneRepository(url, path)
      } catch (error) {
        fail(error, async () => {
          await dispatcher.previewCloneRepository(url, path)
        })
        throw error
      }
    },

    async inspectRepository(path) {
      return git.inspectRepository(path)
    },

    async trustRepository(path) {
      const action = async () => {
        begin()
        try {
          await git.trustRepository(path)
        } catch (error) {
          fail(error, action)
        } finally {
          update({ loading: false })
        }
      }
      await action()
    },

    async addRepository(path) {
      const inspection = await git.inspectRepository(path)
      if (inspection.kind !== 'regular') {
        const messages: Record<WebRepositoryInspection['kind'], string> = {
          regular: '',
          bare: 'Bare repositories are not currently supported.',
          missing: 'The selected path is not a Git repository.',
          unsafe:
            'The Git repository is potentially unsafe. Trust it before adding it.',
        }
        throw new Error(messages[inspection.kind])
      }
      const repositoryPath = inspection.repositoryPath
      const existing = state.repositories.find(
        repository =>
          repository.path === repositoryPath ||
          repository.path === inspection.path
      )
      const repositories = existing
        ? state.repositories.map(repository =>
            repository.path === repositoryPath ||
            repository.path === inspection.path
              ? {
                  ...repository,
                  path: repositoryPath,
                  name: repositoryName(repositoryPath),
                  lastOpenedAt: Date.now(),
                }
              : repository
          )
        : [
            ...state.repositories,
            {
              path: repositoryPath,
              name: repositoryName(repositoryPath),
              lastOpenedAt: Date.now(),
              defaultBranch: null,
              currentBranch: null,
            },
          ]
      update({
        repositories,
        selectedRepositoryPath: repositoryPath,
        selectedRepositoryInspection: inspection,
        status: null,
        branches: null,
        history: [],
        historyRewriteUndo: null,
        cherryPickUndo: null,
        hasMoreHistory: false,
        selectedHistoryCommitSHA: null,
        historyCommitDetails: null,
        selectedHistoryFilePath: null,
        historyDiff: null,
        historyInspectionLoading: false,
        comparison: null,
        comparisonLoading: false,
        selectedFilePath: null,
        includedFiles: [],
        fileSelections: new Map(),
        partialFilePatches: new Map(),
        diff: null,
        inspectedStash: null,
        stashFiles: [],
        selectedStashFilePath: null,
        stashDiff: null,
      })
      await refreshRepository(repositoryPath)
    },

    async relocateRepository(oldPath, newPath) {
      const inspection = await git.inspectRepository(newPath)
      if (inspection.kind !== 'regular')
        throw new Error('Choose a regular Git repository to relocate here.')
      const repository = state.repositories.find(
        candidate => candidate.path === oldPath
      )
      if (!repository)
        throw new Error('The repository is no longer remembered.')
      const nextPath = inspection.path
      if (
        nextPath !== oldPath &&
        state.repositories.some(candidate => candidate.path === nextPath)
      )
        throw new Error('That repository path is already open.')
      const repositories = state.repositories.map(candidate =>
        candidate.path === oldPath
          ? {
              ...candidate,
              path: nextPath,
              name: repositoryName(nextPath),
            }
          : candidate
      )
      update({
        repositories,
        pinnedRepositoryPaths: state.pinnedRepositoryPaths.map(path =>
          path === oldPath ? nextPath : path
        ),
        selectedRepositoryPath:
          state.selectedRepositoryPath === oldPath
            ? nextPath
            : state.selectedRepositoryPath,
        selectedRepositoryInspection: inspection,
      })
      await refreshRepository(nextPath)
    },

    async chooseRepository() {
      const path = await dispatcher.chooseDirectory()
      if (path) await dispatcher.addRepository(path)
    },

    async chooseDirectory() {
      try {
        return await platform.chooseDirectory()
      } catch (error) {
        fail(error, () => dispatcher.chooseDirectory().then(() => undefined))
        return null
      }
    },

    async cloneRepository(url, path, branch) {
      const action = async () => {
        begin()
        try {
          const result = await executeTrackedOperation(path, 'clone', {
            url,
            ...(branch ? { branch } : {}),
          })
          if (!result) return
          await dispatcher.addRepository(path)
        } catch (error) {
          fail(error, action)
        } finally {
          update({ loading: false })
        }
      }
      await action()
    },

    async initializeRepository(options: WebRepositoryInitializationOptions) {
      const action = async () => {
        begin()
        try {
          const result = await executeTrackedOperation(
            options.parentPath,
            'init',
            {
              name: options.name,
              parentPath: options.parentPath,
              description: options.description,
              createReadme: options.createReadme,
              gitignore: options.gitignore,
              license: options.license,
              initialCommit: options.initialCommit,
              ...(options.initialBranch
                ? { initialBranch: options.initialBranch }
                : {}),
            }
          )
          if (!result) return
          const repositoryPath = result.repositoryPath
          if (!repositoryPath) {
            throw new Error(
              'The companion did not return the created repository path.'
            )
          }
          await dispatcher.addRepository(repositoryPath)
        } catch (error) {
          fail(error, action)
        } finally {
          update({ loading: false })
        }
      }
      await action()
    },

    async createTutorialRepository(parentPath) {
      const action = async () => {
        begin()
        try {
          const setup = await git.getRepositorySetupOptions()
          const effectiveParentPath =
            parentPath.trim() || setup.defaultParentPath
          let name = 'desktop-tutorial'
          for (let suffix = 1; suffix <= 20; suffix++) {
            const preview = await git.previewRepositoryInitialization({
              name,
              parentPath: effectiveParentPath,
              createReadme: true,
            })
            if (preview.canCreate) break
            name = `desktop-tutorial-${suffix + 1}`
          }
          const result = await executeTrackedOperation(
            effectiveParentPath,
            'init',
            {
              name,
              parentPath: effectiveParentPath,
              description: 'Learn Git with Desktop Plus.',
              createReadme: true,
              gitignore: null,
              license: null,
              initialCommit: true,
              initialBranch: 'main',
            }
          )
          if (!result) return
          if (!result.repositoryPath)
            throw new Error(
              'The companion did not return the tutorial repository path.'
            )
          const repositoryPath = result.repositoryPath
          const inspection = await git.inspectRepository(repositoryPath)
          if (inspection.kind !== 'regular')
            throw new Error('The tutorial repository could not be opened.')
          const now = Date.now()
          update({
            repositories: [
              ...state.repositories.filter(
                repository => repository.path !== repositoryPath
              ),
              {
                path: repositoryPath,
                name: repositoryName(repositoryPath),
                lastOpenedAt: now,
                defaultBranch: 'main',
                currentBranch: 'main',
                isTutorialRepository: true,
              },
            ],
            selectedRepositoryPath: repositoryPath,
            selectedRepositoryInspection: inspection,
            tutorialRepositoryPath: repositoryPath,
            tutorialPaused: false,
            currentTutorialStep: TutorialStep.CreateBranch,
          })
          await refreshRepository(repositoryPath)
        } catch (error) {
          fail(error, action)
        } finally {
          update({ loading: false })
        }
      }
      await action()
    },

    async resumeTutorial() {
      const path = state.tutorialRepositoryPath
      if (!path) throw new Error('No tutorial repository is available.')
      update({
        tutorialPaused: false,
        selectedRepositoryPath: path,
        selectedRepositoryInspection: null,
      })
    },

    async pauseTutorial() {
      if (!state.tutorialRepositoryPath) return
      update({
        tutorialPaused: true,
        currentTutorialStep: TutorialStep.Paused,
        selectedRepositoryPath: null,
        selectedRepositoryInspection: null,
        status: null,
        branches: null,
        history: [],
        hasMoreHistory: false,
        selectedFilePath: null,
        diff: null,
        historyCommitDetails: null,
        historyDiff: null,
        inspectedStash: null,
        stashFiles: [],
        stashDiff: null,
      })
    },

    async selectRepository(path) {
      const generation = ++repositorySelectionGeneration
      let selectedPath = path
      const isCurrentSelection = () =>
        generation === repositorySelectionGeneration &&
        state.selectedRepositoryPath === selectedPath
      const lastOpenedAt = Date.now()
      update({
        repositories: state.repositories.map(repository =>
          repository.path === path
            ? { ...repository, lastOpenedAt }
            : repository
        ),
        selectedRepositoryPath: path,
        loading: true,
        error: null,
        selectedRepositoryInspection: null,
        status: null,
        branches: null,
        history: [],
        historyRewriteUndo: null,
        cherryPickUndo: null,
        hasMoreHistory: false,
        selectedHistoryCommitSHA: null,
        historyCommitDetails: null,
        selectedHistoryFilePath: null,
        historyDiff: null,
        historyInspectionLoading: false,
        comparison: null,
        comparisonLoading: false,
        selectedFilePath: null,
        includedFiles: [],
        fileSelections: new Map(),
        partialFilePatches: new Map(),
        diff: null,
        inspectedStash: null,
        stashFiles: [],
        selectedStashFilePath: null,
        stashDiff: null,
        lfsStatus: null,
        lfsOperation: null,
      })
      try {
        const inspection = await git.inspectRepository(path)
        if (!isCurrentSelection()) return
        selectedPath =
          inspection.kind === 'regular' ? inspection.repositoryPath : path
        update({
          selectedRepositoryPath: selectedPath,
          selectedRepositoryInspection: inspection,
        })
        if (inspection.kind === 'regular') {
          if (
            !state.repositories.some(
              repository =>
                repository.path === inspection.repositoryPath ||
                repository.path === inspection.path
            )
          ) {
            update({
              repositories: [
                ...state.repositories,
                {
                  path: inspection.repositoryPath,
                  name: repositoryName(inspection.repositoryPath),
                  lastOpenedAt,
                  defaultBranch: null,
                  currentBranch: null,
                },
              ],
              selectedRepositoryPath: selectedPath,
            })
          }
          await refreshRepository(selectedPath)
        } else {
          if (!isCurrentSelection()) return
          update({
            status: null,
            branches: null,
            history: [],
            hasMoreHistory: false,
            selectedFilePath: null,
            includedFiles: [],
            fileSelections: new Map(),
            partialFilePatches: new Map(),
            diff: null,
            inspectedStash: null,
            stashFiles: [],
            selectedStashFilePath: null,
            stashDiff: null,
          })
        }
      } catch (error) {
        if (!isCurrentSelection()) return
        update({
          error: error instanceof Error ? error.message : String(error),
        })
      } finally {
        if (isCurrentSelection()) update({ loading: false })
      }
    },

    toggleRepositoryPinned(path) {
      const pinnedRepositoryPaths = state.pinnedRepositoryPaths.includes(path)
        ? state.pinnedRepositoryPaths.filter(candidate => candidate !== path)
        : [...state.pinnedRepositoryPaths, path]
      update({ pinnedRepositoryPaths })
    },

    setCommitDraft(message) {
      update({ commitDraft: message }, { debounce: true })
    },

    setCommitTrailerText(text) {
      update({ commitTrailerText: text }, { debounce: true })
    },

    setCommitOption(option, value) {
      update(
        {
          commitOptions: {
            ...state.commitOptions,
            [option]: value,
          },
        },
        { debounce: true }
      )
    },

    async startAmendingCommit(sha) {
      const commit = state.history.find(candidate => candidate.sha === sha)
      if (!commit) throw new Error('The selected commit is not loaded.')
      const path = selectedPath()
      const action = async () => {
        begin()
        try {
          const amendMessage =
            commit.summary + (commit.body ? `\n\n${commit.body}` : '')
          update({
            commitToAmend: commit,
            commitDraft: amendMessage,
            commitOptions: {
              ...state.commitOptions,
              amend: true,
              allowEmpty: true,
            },
            selectedSection: 'changes',
          })
          await refreshRepository(path)
          update({
            commitToAmend: commit,
            commitDraft: amendMessage,
            commitOptions: {
              ...state.commitOptions,
              amend: true,
              allowEmpty: true,
            },
            commitDialogRequest: state.commitDialogRequest + 1,
          })
          const details = await git.getCommitDetails(path, sha)
          update({ historyCommitDetails: details })
        } catch (error) {
          fail(error, action)
        } finally {
          update({ loading: false })
        }
      }
      await action()
    },

    stopAmendingCommit() {
      update({
        commitToAmend: null,
        commitOptions: {
          ...state.commitOptions,
          amend: false,
        },
      })
    },

    requestCommitDialog() {
      update({ commitDialogRequest: state.commitDialogRequest + 1 })
    },

    setCommitSpellcheckEnabled(enabled) {
      update({ commitSpellcheckEnabled: enabled })
    },

    async setRepositoryDefaultBranch(branch) {
      const path = selectedPath()
      if (branch !== null) {
        const availableBranch = state.branches?.branches?.find(
          candidate => candidate.type !== 'Remote' && candidate.name === branch
        )
        if (!availableBranch)
          throw new Error(`The branch '${branch}' does not exist locally.`)
      }
      update({
        repositories: state.repositories.map(repository =>
          repository.path === path
            ? { ...repository, defaultBranch: branch }
            : repository
        ),
      })
    },

    setRepositoryAlias(alias) {
      const path = selectedPath()
      const normalized = alias.trim()
      update({
        repositories: state.repositories.map(repository =>
          repository.path === path
            ? { ...repository, alias: normalized || null }
            : repository
        ),
      })
    },

    setRepositoryGroup(group) {
      const path = selectedPath()
      const normalized = group?.trim() || null
      update({
        repositories: state.repositories.map(repository =>
          repository.path === path
            ? { ...repository, group: normalized }
            : repository
        ),
      })
    },

    renameRepositoryGroup(group, nextGroup) {
      const normalizedGroup = group.trim()
      const normalizedNextGroup = nextGroup?.trim() || null
      if (!normalizedGroup) return
      update({
        repositories: state.repositories.map(repository =>
          repository.group === normalizedGroup
            ? { ...repository, group: normalizedNextGroup }
            : repository
        ),
      })
    },

    async selectFile(file) {
      const path = selectedPath()
      const generation = ++fileSelectionGeneration
      update({ selectedFilePath: file, loading: true, error: null })
      try {
        const sourceFile = state.status?.workingDirectory.files.find(
          candidate => candidate.path === file
        )
        const diff = await git.getDiff(
          path,
          file,
          undefined,
          sourceFile?.oldPath
        )
        if (
          generation === fileSelectionGeneration &&
          state.selectedFilePath === file
        )
          update({ diff })
      } catch (error) {
        if (
          generation === fileSelectionGeneration &&
          state.selectedFilePath === file
        )
          update({
            error: error instanceof Error ? error.message : String(error),
          })
      } finally {
        if (
          generation === fileSelectionGeneration &&
          state.selectedFilePath === file
        )
          update({ loading: false })
      }
    },

    setFileIncluded(file, included) {
      ++fileSelectionGeneration
      const includedFiles = included
        ? [...new Set([...state.includedFiles, file])]
        : state.includedFiles.filter(path => path !== file)
      const fileSelections = new Map(state.fileSelections)
      const currentSelection =
        fileSelections.get(file) ||
        DiffSelection.fromInitialSelection(DiffSelectionType.All)
      fileSelections.set(
        file,
        included
          ? currentSelection.withSelectAll()
          : currentSelection.withSelectNone()
      )
      const partialFilePatches = new Map(state.partialFilePatches)
      partialFilePatches.delete(file)
      update({ includedFiles, fileSelections, partialFilePatches })
    },

    setFileSelection(file, selection, patch) {
      ++fileSelectionGeneration
      const fileSelections = new Map(state.fileSelections)
      const partialFilePatches = new Map(state.partialFilePatches)
      fileSelections.set(file, selection)
      if (patch) partialFilePatches.set(file, patch)
      else partialFilePatches.delete(file)

      const includedFiles =
        selection.getSelectionType() === DiffSelectionType.None
          ? state.includedFiles.filter(path => path !== file)
          : [...new Set([...state.includedFiles, file])]
      update({ includedFiles, fileSelections, partialFilePatches })
    },

    setChangesFilterText(text) {
      update({
        changesFilter: {
          ...state.changesFilter,
          filterText: text,
        },
      })
    },

    setComparisonFilterText(text) {
      setStoredComparisonState(state.selectedRepositoryPath, {
        filterText: text,
      })
      update({ comparisonFilterText: text })
    },

    setComparisonBranchListVisible(visible) {
      setStoredComparisonState(state.selectedRepositoryPath, {
        branchListVisible: visible,
      })
      update({ comparisonBranchListVisible: visible })
    },

    setChangesFilterOption(option, enabled) {
      update({
        changesFilter: {
          ...state.changesFilter,
          [option]: enabled,
        },
      })
    },

    setAllVisibleFilesIncluded(files, included) {
      ++fileSelectionGeneration
      const visibleFiles = new Set(files)
      const includedFiles = included
        ? [
            ...state.includedFiles.filter(file => !visibleFiles.has(file)),
            ...files,
          ]
        : state.includedFiles.filter(file => !visibleFiles.has(file))
      const fileSelections = new Map(state.fileSelections)
      const partialFilePatches = new Map(state.partialFilePatches)
      for (const file of files) {
        const currentSelection =
          fileSelections.get(file) ||
          DiffSelection.fromInitialSelection(DiffSelectionType.All)
        fileSelections.set(
          file,
          included
            ? currentSelection.withSelectAll()
            : currentSelection.withSelectNone()
        )
        partialFilePatches.delete(file)
      }
      update({
        includedFiles: [...new Set(includedFiles)],
        fileSelections,
        partialFilePatches,
      })
    },

    async setHistoryFilterText(text) {
      const path = selectedPath()
      const generation = ++historyRefreshGeneration
      const inspectionGeneration = historyInspectionGeneration
      update({ historyFilterText: text })
      update({ loading: true, error: null })
      try {
        const history = await git.getHistory(
          path,
          historyPageSize,
          0,
          text,
          state.historyGraphMode
        )
        if (generation !== historyRefreshGeneration) return
        update({
          history: history.commits,
          hasMoreHistory: history.commits.length === historyPageSize,
          ...(inspectionGeneration === historyInspectionGeneration
            ? {
                selectedHistoryCommitSHA: null,
                historyCommitDetails: null,
                selectedHistoryFilePath: null,
                historyDiff: null,
                historyInspectionLoading: false,
              }
            : {}),
          historyFilterText: text,
        })
      } catch (error) {
        if (generation === historyRefreshGeneration)
          update({
            error: error instanceof Error ? error.message : String(error),
          })
      } finally {
        if (generation === historyRefreshGeneration) update({ loading: false })
      }
    },

    async setHistoryGraphMode(enabled) {
      const generation = ++historyRefreshGeneration
      const inspectionGeneration = historyInspectionGeneration
      localStorage.setItem(historyGraphModeKey, String(enabled))
      update({ historyGraphMode: enabled, loading: true, error: null })
      try {
        const path = selectedPath()
        const history = await git.getHistory(
          path,
          historyPageSize,
          0,
          state.historyFilterText,
          enabled
        )
        if (generation !== historyRefreshGeneration) return
        update({
          history: history.commits,
          hasMoreHistory: history.commits.length === historyPageSize,
          ...(inspectionGeneration === historyInspectionGeneration
            ? {
                selectedHistoryCommitSHA: null,
                historyCommitDetails: null,
                selectedHistoryFilePath: null,
                historyDiff: null,
                historyInspectionLoading: false,
              }
            : {}),
        })
      } catch (error) {
        if (generation === historyRefreshGeneration)
          fail(error, () => dispatcher.setHistoryGraphMode(enabled))
      } finally {
        if (generation === historyRefreshGeneration) update({ loading: false })
      }
    },

    setHistoryGraphHiddenRefs(refs) {
      setStoredStringArray(historyGraphHiddenRefsKey, refs)
      update({ historyGraphHiddenRefs: refs })
    },

    setHistoryGraphCollapsedGroups(groups) {
      setStoredStringArray(historyGraphCollapsedGroupsKey, groups)
      update({ historyGraphCollapsedGroups: groups })
    },

    async inspectHistoryCommit(sha) {
      const path = selectedPath()
      const generation = ++historyInspectionGeneration
      update({
        selectedHistoryCommitSHA: sha,
        historyCommitDetails: null,
        selectedHistoryFilePath: null,
        historyDiff: null,
        historyInspectionLoading: true,
        error: null,
      })
      try {
        const historyCommitDetails = await git.getCommitDetails(path, sha)
        if (
          generation === historyInspectionGeneration &&
          state.selectedHistoryCommitSHA === sha
        )
          update({ historyCommitDetails })
      } catch (error) {
        if (
          generation === historyInspectionGeneration &&
          state.selectedHistoryCommitSHA === sha
        )
          update({
            error: error instanceof Error ? error.message : String(error),
          })
      } finally {
        if (
          generation === historyInspectionGeneration &&
          state.selectedHistoryCommitSHA === sha
        )
          update({ historyInspectionLoading: false })
      }
    },

    async selectHistoryFile(file) {
      const path = selectedPath()
      const sha = state.selectedHistoryCommitSHA
      if (!sha)
        throw new Error('Select a commit before selecting one of its files.')
      update({
        selectedHistoryFilePath: file,
        historyDiff: null,
        historyInspectionLoading: true,
        error: null,
      })
      try {
        const sourceFile = state.historyCommitDetails?.files.find(
          candidate => candidate.path === file
        )
        const historyDiff = await git.getDiff(
          path,
          file,
          sha,
          sourceFile?.oldPath,
          sourceFile?.commitish,
          sourceFile?.parentCommitish
        )
        if (
          state.selectedHistoryCommitSHA === sha &&
          state.selectedHistoryFilePath === file
        )
          update({ historyDiff })
      } catch (error) {
        if (
          state.selectedHistoryCommitSHA === sha &&
          state.selectedHistoryFilePath === file
        )
          update({
            error: error instanceof Error ? error.message : String(error),
          })
      } finally {
        if (
          state.selectedHistoryCommitSHA === sha &&
          state.selectedHistoryFilePath === file
        )
          update({ historyInspectionLoading: false })
      }
    },

    clearHistoryInspection() {
      ++historyInspectionGeneration
      update({
        selectedHistoryCommitSHA: null,
        historyCommitDetails: null,
        selectedHistoryFilePath: null,
        historyDiff: null,
        historyInspectionLoading: false,
      })
    },

    async loadComparison(branch, mode) {
      const path = selectedPath()
      const generation = ++comparisonGeneration
      setStoredComparisonState(path, { branch, mode })
      update({
        comparisonBranch: branch,
        comparisonMode: mode,
        comparison: null,
        comparisonLoading: true,
        selectedHistoryCommitSHA: null,
        historyCommitDetails: null,
        selectedHistoryFilePath: null,
        historyDiff: null,
        historyInspectionLoading: false,
        error: null,
      })
      try {
        const comparison = await git.getComparison(path, branch, mode)
        if (
          generation === comparisonGeneration &&
          state.comparisonBranch === branch &&
          state.comparisonMode === mode
        )
          update({ comparison })
      } catch (error) {
        if (
          generation === comparisonGeneration &&
          state.comparisonBranch === branch &&
          state.comparisonMode === mode
        )
          update({
            error: error instanceof Error ? error.message : String(error),
          })
      } finally {
        if (
          generation === comparisonGeneration &&
          state.comparisonBranch === branch &&
          state.comparisonMode === mode
        )
          update({ comparisonLoading: false })
      }
    },

    async loadRemoteTagMetadata() {
      const path = selectedPath()
      try {
        const branches = await git.getBranches(path, true)
        if (state.selectedRepositoryPath === path) update({ branches })
        return branches
      } catch (error) {
        update({
          error: error instanceof Error ? error.message : String(error),
        })
        throw error
      }
    },

    async inspectStash(stash: WebStash) {
      const path = selectedPath()
      update({
        inspectedStash: stash,
        stashFiles: [],
        selectedStashFilePath: null,
        stashDiff: null,
        loading: true,
        error: null,
      })
      try {
        const result = await git.getStashFiles(path, stash.name)
        update({ stashFiles: result.files })
      } catch (error) {
        update({
          error: error instanceof Error ? error.message : String(error),
        })
      } finally {
        update({ loading: false })
      }
    },

    async selectStashFile(file) {
      const path = selectedPath()
      const stash = state.inspectedStash
      if (!stash) throw new Error('Inspect a stash before selecting a file.')
      update({ selectedStashFilePath: file, stashDiff: null, loading: true })
      try {
        update({
          stashDiff: await git.getStashDiff(path, stash.name, file),
        })
      } catch (error) {
        update({
          error: error instanceof Error ? error.message : String(error),
        })
      } finally {
        update({ loading: false })
      }
    },

    clearStashInspection() {
      update({
        inspectedStash: null,
        stashFiles: [],
        selectedStashFilePath: null,
        stashDiff: null,
      })
    },

    async loadGitIdentity() {
      const path = selectedPath()
      try {
        update({ gitIdentity: await git.getGitIdentity(path) })
      } catch (error) {
        fail(error, () => dispatcher.loadGitIdentity())
      }
    },

    async configureGitIdentity(scope, name, email) {
      const path = selectedPath()
      const action = async () => {
        begin()
        try {
          update({
            gitIdentity: await git.setGitIdentity(path, scope, name, email),
          })
        } catch (error) {
          fail(error, action)
          throw error
        } finally {
          update({ loading: false })
        }
      }
      await action()
    },

    async recoverGitConfigLock(scope: WebGitConfigScope) {
      const path = selectedPath()
      const previousAction = retryLastAction
      const action = async () => {
        begin()
        try {
          await git.recoverGitConfigLock(path, scope, true)
          update({
            error: null,
            errorCode: null,
            errorActionURL: null,
            hookFailure: null,
            configLockScope: null,
          })
          retryLastAction = null
          if (previousAction) await previousAction()
        } catch (error) {
          fail(error, action)
        } finally {
          update({ loading: false })
        }
      }
      await action()
    },

    async openGlobalGitConfig() {
      const action = async () => {
        begin()
        try {
          const result = await git.getGlobalGitConfigPath()
          await platform.openPath(result.path)
        } catch (error) {
          fail(error, action)
        } finally {
          update({ loading: false })
        }
      }
      await action()
    },

    async appendIgnoreFile(files) {
      const path = selectedPath()
      const action = async () => {
        begin()
        try {
          await git.appendIgnore(path, { kind: 'file', paths: files })
          await refreshRepository(path)
        } catch (error) {
          fail(error, action)
        } finally {
          update({ loading: false })
        }
      }
      await action()
    },

    async appendIgnorePattern(patterns) {
      const path = selectedPath()
      const action = async () => {
        begin()
        try {
          await git.appendIgnore(path, { kind: 'pattern', paths: patterns })
          await refreshRepository(path)
        } catch (error) {
          fail(error, action)
        } finally {
          update({ loading: false })
        }
      }
      await action()
    },

    async copyPaths(files, relative) {
      const repository = selectedPath()
      const paths = relative
        ? files
        : files.map(file => joinRepositoryPath(repository, file))
      await platform.copy(paths.join('\n'))
    },

    async copyText(text) {
      await platform.copy(text)
    },

    async openPath(filePath, reveal = false) {
      await platform.openPath(filePath, reveal)
    },

    async openIntegration(kind, filePath, selection) {
      try {
        await platform.openIntegration(kind, filePath, selection)
      } catch (error) {
        fail(error)
      }
    },

    async runOperation(
      operation: WebGitOperation,
      options: WebOperationOptions = {}
    ) {
      const path = selectedPath()
      const action = async () => {
        begin()
        try {
          const result = await executeTrackedOperation(path, operation, options)
          if (!result) return
          await refreshRepository(path)
          publishOperationUndo(operation, options, result)
        } catch (error) {
          await refreshRepository(path)
          fail(error, action)
        } finally {
          update({ loading: false, operationTask: null })
        }
      }
      await action()
    },

    async runOperationOrThrow(
      operation: WebGitOperation,
      options: WebOperationOptions = {}
    ) {
      const path = selectedPath()
      begin()
      try {
        const result = await executeTrackedOperation(path, operation, options)
        if (!result) return
        await refreshRepository(path)
        publishOperationUndo(operation, options, result)
      } catch (error) {
        await refreshRepository(path)
        fail(error)
        throw error
      } finally {
        update({ loading: false, operationTask: null })
      }
    },

    async cancelOperation() {
      const task = state.operationTask
      if (!task || task.status !== 'running') return
      try {
        update({
          operationTask: await git.cancelOperation(task.id),
        })
      } catch (error) {
        fail(error)
      }
    },

    async previewPruneBranches() {
      const path = selectedPath()
      const repository = state.repositories.find(item => item.path === path)
      const defaultBranch =
        repository?.defaultBranch || state.branches?.defaultBranch || null
      const action = async () => {
        begin()
        try {
          const result = await git.runOperation(path, 'prune-branches', {
            dryRun: true,
            ...(defaultBranch ? { defaultBranch } : {}),
          })
          return result.candidates || []
        } catch (error) {
          fail(error)
          throw error
        } finally {
          update({ loading: false })
        }
      }
      return action()
    },

    async commit(message, options = {}) {
      const path = selectedPath()
      const persistedTrailers: ReadonlyArray<WebCommitTrailer> =
        state.commitTrailerText
          .split(/\r?\n/)
          .filter(line => line.trim())
          .map(value => ({
            token: 'Co-Authored-By',
            value: value.trim(),
          }))
      const requestedTrailers = Array.isArray(options.trailers)
        ? (options.trailers as ReadonlyArray<WebCommitTrailer>)
        : persistedTrailers
      const selectedFiles = state.includedFiles.length
        ? state.includedFiles
        : state.commitOptions.amend
        ? state.status?.workingDirectory.files
            .filter(file => file.status.kind !== 'Conflicted')
            .map(file => file.path) || []
        : []
      const action = async (bypassHooks = false) => {
        begin()
        try {
          const result = await executeTrackedOperation(path, 'commit', {
            ...options,
            noVerify: bypassHooks || options.noVerify === true,
            files: selectedFiles.filter(
              file => !state.partialFilePatches.has(file)
            ),
            patches: [...state.partialFilePatches.values()],
            message,
            trailers: requestedTrailers,
          })
          if (!result) return
          await refreshRepository(path)
          update({
            commitDraft: '',
            commitTrailerText: '',
            commitToAmend: null,
            commitOptions: {
              ...state.commitOptions,
              amend: false,
              allowEmpty: false,
            },
          })
        } catch (error) {
          const hookFailed =
            error &&
            typeof error === 'object' &&
            'hookFailure' in error &&
            error.hookFailure !== null
          fail(error, hookFailed ? () => action(true) : () => action())
        } finally {
          update({ loading: false })
        }
      }
      await action()
    },

    async discardFiles(files, confirmed, permanently = false) {
      if (!confirmed)
        throw new Error('Confirm discarding these changes before continuing.')
      const path = selectedPath()
      const action = async () => {
        begin()
        try {
          const result = await executeTrackedOperation(path, 'discard', {
            values: files,
            moveToTrash: !permanently,
            allowPermanentOnTrashFailure: !permanently,
          })
          if (!result) return
          await refreshRepository(path)
        } catch (error) {
          fail(error, action)
        } finally {
          update({ loading: false })
        }
      }
      await action()
    },

    async selectSection(section) {
      update({ selectedSection: section })
    },

    async loadMoreHistory() {
      const path = selectedPath()
      if (state.loading || !state.hasMoreHistory) return
      update({ loading: true, error: null })
      try {
        const history: WebHistory = await git.getHistory(
          path,
          historyPageSize,
          state.history.length,
          state.historyFilterText,
          state.historyGraphMode
        )
        update({
          history: [...state.history, ...history.commits],
          hasMoreHistory: history.commits.length === historyPageSize,
        })
      } catch (error) {
        update({
          error: error instanceof Error ? error.message : String(error),
        })
      } finally {
        update({ loading: false })
      }
    },

    async refresh() {
      await refreshRepository(selectedPath())
    },

    removeRepository(path) {
      const removingListedRepository = state.repositories.some(
        repository => repository.path === path
      )
      const repositories = state.repositories.filter(
        repository => repository.path !== path
      )
      const pinnedRepositoryPaths = state.pinnedRepositoryPaths.filter(
        repositoryPath => repositoryPath !== path
      )
      const selectedRepositoryPath =
        state.selectedRepositoryPath === path
          ? removingListedRepository
            ? repositories[0]?.path || null
            : null
          : state.selectedRepositoryPath
      const removingTutorial = state.tutorialRepositoryPath === path
      update({
        repositories,
        pinnedRepositoryPaths,
        selectedRepositoryPath,
        status: null,
        branches: null,
        history: [],
        hasMoreHistory: false,
        selectedFilePath: null,
        includedFiles: [],
        fileSelections: new Map(),
        partialFilePatches: new Map(),
        diff: null,
        inspectedStash: null,
        stashFiles: [],
        selectedStashFilePath: null,
        stashDiff: null,
        selectedRepositoryInspection: null,
        error: null,
        errorCode: null,
        errorActionURL: null,
        hookFailure: null,
        operationOutput: null,
        operationTask: null,
        configLockScope: null,
        canRetry: false,
        tutorialRepositoryPath: removingTutorial
          ? null
          : state.tutorialRepositoryPath,
        tutorialPaused: removingTutorial ? false : state.tutorialPaused,
        currentTutorialStep: removingTutorial
          ? TutorialStep.NotApplicable
          : state.currentTutorialStep,
      })
      if (selectedRepositoryPath && selectedRepositoryPath !== path)
        void dispatcher.selectRepository(selectedRepositoryPath)
    },

    async deleteRepository(path, mode: WebRepositoryDeleteMode) {
      const action = async () => {
        begin()
        try {
          await git.deleteRepository(path, mode)
          dispatcher.removeRepository(path)
        } catch (error) {
          fail(error, action)
        } finally {
          update({ loading: false })
        }
      }
      await action()
    },

    async pullAllRepositories() {
      const repositories = [...state.repositories]
      const action = async () => {
        begin()
        try {
          for (const repository of repositories) {
            const inspection = await git.inspectRepository(repository.path)
            if (inspection.kind !== 'regular') continue
            const result = await executeTrackedOperation(
              inspection.path,
              'pull',
              {
                pullStrategy: 'merge',
              }
            )
            if (!result) return
          }
          if (state.selectedRepositoryPath)
            await refreshRepository(state.selectedRepositoryPath)
        } catch (error) {
          fail(error, action)
        } finally {
          update({ loading: false })
        }
      }
      await action()
    },

    async pullRepositoryGroup(group) {
      const repositories = state.repositories.filter(
        repository => (repository.group || null) === group
      )
      const action = async () => {
        begin()
        try {
          for (const repository of repositories) {
            const inspection = await git.inspectRepository(repository.path)
            if (inspection.kind !== 'regular') continue
            const result = await executeTrackedOperation(
              inspection.path,
              'pull',
              {
                pullStrategy: 'merge',
              }
            )
            if (!result) return
          }
          if (state.selectedRepositoryPath)
            await refreshRepository(state.selectedRepositoryPath)
        } catch (error) {
          fail(error, action)
        } finally {
          update({ loading: false })
        }
      }
      await action()
    },

    async refreshRepositoryIndicators() {
      await refreshRepositoryIndicators()
    },

    dismissError() {
      retryLastAction = null
      update({
        error: null,
        errorCode: null,
        errorActionURL: null,
        canRetry: false,
      })
    },

    openErrorAction() {
      if (state.errorActionURL) platform.openExternal(state.errorActionURL)
    },

    openExternal(url) {
      platform.openExternal(url)
    },

    openRepositoryInNewWindow(path) {
      platform.openRepositoryInNewWindow(path)
    },

    async signIn(provider, endpoint, token) {
      begin()
      try {
        update({
          hostingAccount: await hosting.signIn(provider, endpoint, token),
        })
      } catch (error) {
        fail(error, () => dispatcher.signIn(provider, endpoint, token))
      } finally {
        update({ loading: false })
      }
    },

    async signOut() {
      if (!state.hostingAccount) return
      begin()
      try {
        await hosting.signOut(state.hostingAccount)
        update({
          hostingAccount: null,
          pullRequests: [],
          pullRequestDetails: null,
          checks: null,
          notifications: [],
        })
        deliveredNotificationIds.clear()
      } catch (error) {
        fail(error, () => dispatcher.signOut())
      } finally {
        update({ loading: false })
      }
    },

    async publishRepository(options: PublishRepositoryOptions) {
      if (!state.hostingAccount)
        throw new Error(
          'Sign in to a hosting provider before publishing a repository.'
        )
      begin()
      try {
        await hosting.publish(state.hostingAccount, options)
      } catch (error) {
        fail(error, () => dispatcher.publishRepository(options))
      } finally {
        update({ loading: false })
      }
    },

    async loadPullRequests(owner, repository) {
      if (!state.hostingAccount)
        throw new Error(
          'Sign in to a hosting provider before loading pull requests.'
        )
      begin()
      try {
        const pullRequests = await hosting.getPullRequests(
          state.hostingAccount,
          owner,
          repository
        )
        update({ pullRequests, pullRequestDetails: null, checks: null })
      } catch (error) {
        fail(error, () => dispatcher.loadPullRequests(owner, repository))
      } finally {
        update({ loading: false })
      }
    },

    async createPullRequest(owner, repository, title, head, base, body) {
      if (!state.hostingAccount)
        throw new Error(
          'Sign in to a hosting provider before creating a pull request.'
        )
      begin()
      try {
        const pullRequest = await hosting.createPullRequest(
          state.hostingAccount,
          owner,
          repository,
          title,
          head,
          base,
          body
        )
        update({ pullRequests: [pullRequest, ...state.pullRequests] })
      } catch (error) {
        fail(error, () =>
          dispatcher.createPullRequest(
            owner,
            repository,
            title,
            head,
            base,
            body
          )
        )
      } finally {
        update({ loading: false })
      }
    },

    async checkoutPullRequest(pullRequest) {
      if (!state.hostingAccount)
        throw new Error(
          'Sign in to a hosting provider before checking out a pull request.'
        )
      const path = selectedPath()
      begin()
      try {
        await hosting.checkoutPullRequest(
          state.hostingAccount,
          path,
          pullRequest
        )
        await refreshRepository(path)
      } catch (error) {
        fail(error, () => dispatcher.checkoutPullRequest(pullRequest))
      } finally {
        update({ loading: false })
      }
    },

    async loadPullRequestDetails(owner, repository, pullRequestNumber) {
      if (!state.hostingAccount)
        throw new Error(
          'Sign in to a hosting provider before loading pull request details.'
        )
      begin()
      try {
        const pullRequestDetails: WebPullRequestDetails =
          await hosting.getPullRequestDetails(
            state.hostingAccount,
            owner,
            repository,
            pullRequestNumber
          )
        update({ pullRequestDetails, checks: null })
      } catch (error) {
        fail(error, () =>
          dispatcher.loadPullRequestDetails(
            owner,
            repository,
            pullRequestNumber
          )
        )
      } finally {
        update({ loading: false })
      }
    },

    async loadChecks(owner, repository, ref) {
      if (!state.hostingAccount)
        throw new Error('Sign in to a hosting provider before loading checks.')
      begin()
      try {
        update({
          checks: await hosting.getChecks(
            state.hostingAccount,
            owner,
            repository,
            ref
          ),
        })
      } catch (error) {
        fail(error, () => dispatcher.loadChecks(owner, repository, ref))
      } finally {
        update({ loading: false })
      }
    },

    async rerunCheckSuites(owner, repository, checkSuiteIds) {
      if (!state.hostingAccount)
        throw new Error(
          'Sign in to a hosting provider before rerunning checks.'
        )
      begin()
      try {
        await hosting.rerunCheckSuites(
          state.hostingAccount,
          owner,
          repository,
          checkSuiteIds
        )
        const ref = state.pullRequestDetails?.pullRequest.head?.sha
        if (ref)
          update({
            checks: await hosting.getChecks(
              state.hostingAccount,
              owner,
              repository,
              ref
            ),
          })
      } catch (error) {
        fail(error, () =>
          dispatcher.rerunCheckSuites(owner, repository, checkSuiteIds)
        )
      } finally {
        update({ loading: false })
      }
    },

    async requestNotificationPermission() {
      const permission = await platform.requestNotificationPermission()
      if (permission !== 'granted')
        update({
          error:
            'Browser notification permission was not granted. Notifications remain available in this view.',
          canRetry: false,
        })
      return permission
    },

    async loadNotifications() {
      if (!state.hostingAccount)
        throw new Error('Sign in to GitHub before loading notifications.')
      begin()
      try {
        const notifications = await hosting.getNotifications(
          state.hostingAccount
        )
        update({ notifications })
        for (const notification of notifications) {
          if (!notification.target) continue
          const deliveryId = `${state.hostingAccount.provider || 'github'}:${
            state.hostingAccount.credentialId
          }:${notification.id}`
          if (deliveredNotificationIds.has(deliveryId)) continue
          deliveredNotificationIds.add(deliveryId)
          platform.notify(
            'GitHub pull request',
            notification.title,
            () => void dispatcher.checkoutNotification(notification)
          )
        }
      } catch (error) {
        fail(error, () => dispatcher.loadNotifications())
      } finally {
        update({ loading: false })
      }
    },

    async checkoutNotification(notification: WebNotification) {
      if (!state.hostingAccount)
        throw new Error('Sign in to GitHub before checking out a notification.')
      if (!notification.target)
        throw new Error(
          'This notification is not associated with a pull request that can be checked out.'
        )
      const path = selectedPath()
      begin()
      try {
        const details = await hosting.getPullRequestDetails(
          state.hostingAccount,
          notification.target.owner,
          notification.target.repository,
          notification.target.pullRequestNumber
        )
        await hosting.checkoutPullRequest(
          state.hostingAccount,
          path,
          details.pullRequest
        )
        await hosting.markNotificationRead(
          state.hostingAccount,
          notification.id
        )
        update({
          notifications: state.notifications.filter(
            item => item.id !== notification.id
          ),
          pullRequestDetails: details,
        })
        await refreshRepository(path)
      } catch (error) {
        fail(error, () => dispatcher.checkoutNotification(notification))
      } finally {
        update({ loading: false })
      }
    },

    async retryLastAction() {
      const action = retryLastAction
      if (action) await action()
    },

    async retryLastActionWithCredentials(username, password) {
      const action = retryLastAction
      if (!action) return
      retryGenericCredentials = { username, password }
      await action()
    },

    dismissHistoryRewriteUndo() {
      update({ historyRewriteUndo: null })
    },

    dismissCherryPickUndo() {
      update({ cherryPickUndo: null })
    },

    async loadLfsStatus() {
      const path = selectedPath()
      begin()
      try {
        update({ lfsStatus: await git.getLfsStatus(path) })
      } catch (error) {
        fail(error, () => dispatcher.loadLfsStatus())
      } finally {
        update({ loading: false })
      }
    },

    async installLfs(scope, confirmed) {
      const path = selectedPath()
      begin()
      try {
        update({ lfsStatus: await git.installLfs(path, scope, confirmed) })
      } catch (error) {
        fail(error, () => dispatcher.installLfs(scope, confirmed))
      } finally {
        update({ loading: false })
      }
    },

    async repairLfs(confirmed) {
      const path = selectedPath()
      begin()
      try {
        update({ lfsStatus: await git.repairLfs(path, confirmed) })
      } catch (error) {
        fail(error, () => dispatcher.repairLfs(confirmed))
      } finally {
        update({ loading: false })
      }
    },

    async startLfsTransfer(command) {
      const path = selectedPath()
      begin()
      try {
        const lfsOperation = await git.startLfsTransfer(path, command)
        update({ lfsOperation })
        pollLfsOperation(lfsOperation.id)
      } catch (error) {
        fail(error, () => dispatcher.startLfsTransfer(command))
      } finally {
        update({ loading: false })
      }
    },

    async cancelLfsTransfer() {
      if (!state.lfsOperation || state.lfsOperation.status !== 'running') return
      begin()
      try {
        stopLfsPolling()
        update({
          lfsOperation: await git.cancelLfsOperation(state.lfsOperation.id),
        })
      } catch (error) {
        fail(error, () => dispatcher.cancelLfsTransfer())
      } finally {
        update({ loading: false })
      }
    },

    async checkForUpdates() {
      begin()
      try {
        update({ updateStatus: await platform.checkForUpdates() })
      } catch (error) {
        fail(error, () => dispatcher.checkForUpdates())
      } finally {
        update({ loading: false })
      }
    },

    async downloadUpdate() {
      begin()
      try {
        const updateOperation = await platform.downloadUpdate()
        update({ updateOperation })
        pollUpdateOperation(updateOperation.id)
      } catch (error) {
        fail(error, () => dispatcher.downloadUpdate())
      } finally {
        update({ loading: false })
      }
    },

    async cancelUpdateDownload() {
      if (state.updateOperation?.status !== 'downloading') return
      begin()
      try {
        stopUpdatePolling()
        update({
          updateOperation: await platform.cancelUpdateOperation(
            state.updateOperation.id
          ),
        })
      } catch (error) {
        fail(error, () => dispatcher.cancelUpdateDownload())
      } finally {
        update({ loading: false })
      }
    },

    async openDownloadedUpdate(confirmed) {
      if (state.updateOperation?.status !== 'downloaded')
        throw new Error('Download and verify an update before opening it.')
      begin()
      try {
        update({
          updateOperation: await platform.openDownloadedUpdate(
            state.updateOperation.id,
            confirmed
          ),
        })
      } catch (error) {
        fail(error, () => dispatcher.openDownloadedUpdate(confirmed))
      } finally {
        update({ loading: false })
      }
    },

    async loadIntegrations() {
      begin()
      try {
        update({ integrations: await platform.getIntegrations() })
      } catch (error) {
        fail(error, () => dispatcher.loadIntegrations())
      } finally {
        update({ loading: false })
      }
    },

    async launchIntegration(kind, name, custom = null) {
      const target = selectedPath()
      begin()
      try {
        await platform.launchIntegration(kind, target, name, custom)
      } catch (error) {
        fail(error, () => dispatcher.launchIntegration(kind, name, custom))
      } finally {
        update({ loading: false })
      }
    },

    async loadRepositoryPolicies(owner, repository) {
      if (!state.hostingAccount)
        throw new Error('Sign in to GitHub before loading repository policies.')
      const branch = state.branches?.branch?.name
      if (!branch) throw new Error('Choose a branch before loading policies.')
      begin()
      try {
        const repositoryPolicies: WebRepositoryPolicies =
          await hosting.getRepositoryPolicies(
            state.hostingAccount,
            owner,
            repository,
            branch
          )
        update({ repositoryPolicies })
      } catch (error) {
        fail(error, () => dispatcher.loadRepositoryPolicies(owner, repository))
      } finally {
        update({ loading: false })
      }
    },

    async pushRepository(owner, repository) {
      if (!state.hostingAccount)
        throw new Error('Sign in to a hosting provider before pushing.')
      const branch = state.branches?.branch?.name
      if (!branch) throw new Error('Choose a branch before pushing.')
      const path = selectedPath()
      begin()
      try {
        await hosting.pushRepository(
          state.hostingAccount,
          path,
          owner,
          repository,
          branch
        )
        await refreshRepository(path)
      } catch (error) {
        fail(error, () => dispatcher.pushRepository(owner, repository))
      } finally {
        update({ loading: false })
      }
    },

    async loadCopilotMetadata() {
      if (!state.hostingAccount)
        throw new Error('Sign in to GitHub before loading Copilot.')
      const path = selectedPath()
      begin()
      try {
        update({
          copilotMetadata: await hosting.getCopilotMetadata(
            state.hostingAccount,
            path
          ),
          copilotContent: null,
        })
      } catch (error) {
        fail(error, () => dispatcher.loadCopilotMetadata())
      } finally {
        update({ loading: false })
      }
    },

    async generateCopilotCommitMessage(model) {
      if (!state.hostingAccount)
        throw new Error('Sign in to GitHub before using Copilot.')
      const path = selectedPath()
      begin()
      try {
        update({
          copilotContent: await hosting.generateCopilotCommitMessage(
            state.hostingAccount,
            path,
            model
          ),
        })
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        fail(error, () => dispatcher.generateCopilotCommitMessage(model))
      } finally {
        update({ loading: false })
      }
    },

    async resolveCopilotConflicts(model) {
      if (!state.hostingAccount)
        throw new Error('Sign in to GitHub before using Copilot.')
      const path = selectedPath()
      begin()
      try {
        update({
          copilotContent: await hosting.resolveCopilotConflicts(
            state.hostingAccount,
            path,
            model
          ),
        })
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        fail(error, () => dispatcher.resolveCopilotConflicts(model))
      } finally {
        update({ loading: false })
      }
    },

    cancelCopilot() {
      cancelCopilotRequest()
      update({ loading: false })
    },
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    dispatcher,
  }
}
