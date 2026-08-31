const __WEB_STORAGE_KEY = 'desktop-plus-web-state'
const __WEB_STORAGE_VERSION = 2
const __WEB_LEGACY_KEYS = [
  'desktop_plus_repositories',
  'desktop_plus_selected_repo_path',
  'desktop-plus-hosting-account',
  'sidebar-width',
  'branch-dropdown-width',
  'worktree-dropdown-width',
  'push-pull-button-width',
  'commit-summary-width',
  'stashed-files-width',
  'pull-request-files-width',
  'commitGraph-branch-list-width',
]
const __webStorageRecoveryIssues = []

function __webStorageIssue(message) {
  __webStorageRecoveryIssues.push(message)
  console.error(`[Desktop Plus Web storage] ${message}`)
}

function __webParseJson(raw, label) {
  try {
    return JSON.parse(raw)
  } catch {
    __webStorageIssue(`${label} contained invalid JSON and was ignored.`)
    return null
  }
}

function __webRepositoryRecord(value) {
  if (!value || typeof value !== 'object' || typeof value.path !== 'string') {
    return null
  }
  return {
    path: value.path,
    id: Number.isFinite(value.id) ? value.id : Date.now(),
    missing: value.missing === true,
    alias: typeof value.alias === 'string' ? value.alias : null,
    groupName: typeof value.groupName === 'string' ? value.groupName : null,
    defaultBranch:
      typeof value.defaultBranch === 'string' ? value.defaultBranch : null,
    workflowPreferences:
      value.workflowPreferences &&
      typeof value.workflowPreferences === 'object' &&
      !Array.isArray(value.workflowPreferences)
        ? value.workflowPreferences
        : {},
    customEditorOverride:
      value.customEditorOverride &&
      typeof value.customEditorOverride === 'object' &&
      !Array.isArray(value.customEditorOverride)
        ? value.customEditorOverride
        : null,
    isTutorialRepository: value.isTutorialRepository === true,
    overrideLogin:
      typeof value.overrideLogin === 'string' || value.overrideLogin === 1
        ? value.overrideLogin
        : null,
    gitDir: typeof value.gitDir === 'string' ? value.gitDir : undefined,
    mainWorktreePath:
      typeof value.mainWorktreePath === 'string'
        ? value.mainWorktreePath
        : undefined,
    gitHubRepository:
      value.gitHubRepository && typeof value.gitHubRepository === 'object'
        ? value.gitHubRepository
        : null,
  }
}

function __webWidthRecord(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? Math.max(150, Math.min(400, numeric)) : null
}

function __webNormalizeStorage(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    (value.version !== 1 && value.version !== 2)
  ) {
    __webStorageIssue(
      'The saved web state used an unsupported schema and was reset.'
    )
    return null
  }

  const repositories = Array.isArray(value.repositories)
    ? value.repositories.flatMap(repository => {
        const normalized = __webRepositoryRecord(repository)
        if (normalized) return [normalized]
        __webStorageIssue('An invalid saved repository entry was removed.')
        return []
      })
    : []
  const selectedRepositoryPath =
    typeof value.selectedRepositoryPath === 'string'
      ? value.selectedRepositoryPath
      : null
  const hostingAccount =
    value.hostingAccount &&
    typeof value.hostingAccount === 'object' &&
    typeof value.hostingAccount.credentialId === 'string' &&
    typeof value.hostingAccount.endpoint === 'string'
      ? value.hostingAccount
      : null
  const widths = {}
  if (value.widths && typeof value.widths === 'object') {
    for (const [key, width] of Object.entries(value.widths)) {
      const normalized = __webWidthRecord(width)
      if (normalized !== null) widths[key] = normalized
    }
  }

  return {
    version: __WEB_STORAGE_VERSION,
    repositories,
    selectedRepositoryPath,
    hostingAccount,
    widths,
    preferences:
      value.preferences &&
      typeof value.preferences === 'object' &&
      !Array.isArray(value.preferences)
        ? value.preferences
        : {},
    repositoryState:
      value.repositoryState &&
      typeof value.repositoryState === 'object' &&
      !Array.isArray(value.repositoryState)
        ? value.repositoryState
        : {},
  }
}

function __webMigrateLegacyStorage() {
  const repositoriesRaw = localStorage.getItem('desktop_plus_repositories')
  const parsedRepositories = repositoriesRaw
    ? __webParseJson(repositoriesRaw, 'Saved repositories')
    : []
  const repositories = Array.isArray(parsedRepositories)
    ? parsedRepositories.flatMap(repository => {
        const normalized = __webRepositoryRecord(repository)
        if (normalized) return [normalized]
        __webStorageIssue('An invalid legacy repository entry was removed.')
        return []
      })
    : []
  const hostingRaw = localStorage.getItem('desktop-plus-hosting-account')
  const parsedHostingAccount = hostingRaw
    ? __webParseJson(hostingRaw, 'Saved hosting account')
    : null
  const hostingAccount =
    parsedHostingAccount &&
    typeof parsedHostingAccount.credentialId === 'string' &&
    typeof parsedHostingAccount.endpoint === 'string'
      ? parsedHostingAccount
      : null
  const widths = {}
  for (const key of __WEB_LEGACY_KEYS.slice(3)) {
    const width = __webWidthRecord(localStorage.getItem(key))
    if (width !== null) widths[key] = width
  }
  return {
    version: __WEB_STORAGE_VERSION,
    repositories,
    selectedRepositoryPath:
      localStorage.getItem('desktop_plus_selected_repo_path') || null,
    hostingAccount,
    widths,
    preferences: {},
    repositoryState: {},
  }
}

function __webWriteStorage(state) {
  localStorage.setItem(__WEB_STORAGE_KEY, JSON.stringify(state))
}

function __webLoadStorage() {
  const raw = localStorage.getItem(__WEB_STORAGE_KEY)
  const state = raw
    ? __webNormalizeStorage(__webParseJson(raw, 'Saved web state'))
    : __webMigrateLegacyStorage()
  const normalized = state || {
    version: __WEB_STORAGE_VERSION,
    repositories: [],
    selectedRepositoryPath: null,
    hostingAccount: null,
    widths: {},
    preferences: {},
    repositoryState: {},
  }
  __webWriteStorage(normalized)
  return normalized
}

let __webPersistedState = __webLoadStorage()

const __webStorage = Object.freeze({
  repositories: () => __webPersistedState.repositories,
  selectedRepositoryPath: () => __webPersistedState.selectedRepositoryPath,
  hostingAccount: () => __webPersistedState.hostingAccount,
  preferences: () => __webPersistedState.preferences,
  repositoryState: repositoryPath =>
    __webPersistedState.repositoryState[repositoryPath] || {},
  width: (key, fallback) => __webPersistedState.widths[key] ?? fallback,
  saveRepositories: (repositories, selectedRepositoryPath) => {
    __webPersistedState = {
      ...__webPersistedState,
      repositories,
      selectedRepositoryPath:
        selectedRepositoryPath ?? __webPersistedState.selectedRepositoryPath,
    }
    __webWriteStorage(__webPersistedState)
  },
  saveHostingAccount: hostingAccount => {
    __webPersistedState = { ...__webPersistedState, hostingAccount }
    __webWriteStorage(__webPersistedState)
  },
  savePreference: (key, value) => {
    __webPersistedState = {
      ...__webPersistedState,
      preferences: { ...__webPersistedState.preferences, [key]: value },
    }
    __webWriteStorage(__webPersistedState)
  },
  saveRepositoryState: (repositoryPath, update) => {
    const current = __webPersistedState.repositoryState[repositoryPath] || {}
    __webPersistedState = {
      ...__webPersistedState,
      repositoryState: {
        ...__webPersistedState.repositoryState,
        [repositoryPath]: { ...current, ...update },
      },
    }
    __webWriteStorage(__webPersistedState)
  },
  moveRepositoryState: (oldPath, newPath) => {
    const repositoryState = { ...__webPersistedState.repositoryState }
    if (repositoryState[oldPath]) {
      repositoryState[newPath] = repositoryState[oldPath]
      delete repositoryState[oldPath]
      __webPersistedState = { ...__webPersistedState, repositoryState }
      __webWriteStorage(__webPersistedState)
    }
  },
  removeRepositoryState: repositoryPath => {
    const repositoryState = { ...__webPersistedState.repositoryState }
    delete repositoryState[repositoryPath]
    __webPersistedState = { ...__webPersistedState, repositoryState }
    __webWriteStorage(__webPersistedState)
  },
  saveWidth: (key, width) => {
    __webPersistedState = {
      ...__webPersistedState,
      widths: { ...__webPersistedState.widths, [key]: width },
    }
    __webWriteStorage(__webPersistedState)
  },
  resetWidth: key => {
    const widths = { ...__webPersistedState.widths }
    delete widths[key]
    __webPersistedState = { ...__webPersistedState, widths }
    __webWriteStorage(__webPersistedState)
  },
  clear: () => {
    localStorage.removeItem(__WEB_STORAGE_KEY)
    for (const key of __WEB_LEGACY_KEYS) localStorage.removeItem(key)
  },
})

function __showWebRecovery(title, error, retry) {
  const existing = document.getElementById('desktop-plus-web-recovery')
  existing?.remove()

  const recovery = document.createElement('section')
  recovery.id = 'desktop-plus-web-recovery'
  recovery.setAttribute('role', 'alert')
  recovery.innerHTML =
    '<h2></h2><p></p><div class="actions"><button type="button" data-action="dismiss">Dismiss</button><button type="button" class="primary" data-action="recover">Reset saved data</button></div>'
  recovery.querySelector('h2').textContent = title
  recovery.querySelector('p').textContent =
    error instanceof Error ? error.message : String(error)
  recovery.querySelector('[data-action="dismiss"]').onclick = () =>
    recovery.remove()
  const recover = recovery.querySelector('[data-action="recover"]')
  if (retry) {
    recover.textContent = 'Try again'
    recover.onclick = async () => {
      recover.disabled = true
      try {
        await retry()
        recovery.remove()
      } catch (retryError) {
        recovery.querySelector('p').textContent =
          retryError instanceof Error ? retryError.message : String(retryError)
        recover.disabled = false
      }
    }
  } else {
    recover.onclick = () => {
      __webStorage.clear()
      location.reload()
    }
  }
  document.body.appendChild(recovery)
}
