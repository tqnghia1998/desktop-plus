import {
  getEmbeddedParentOrigin,
  useHostRefresh,
  useRepositoryQuery,
} from '../vibing/embedding'
import * as React from 'react'
import { useStoredBoolean } from './preferences-state'
import { SuccessfulCherryPick } from '../../ui/banners/successful-cherry-pick'
import { CherryPickUndone } from '../../ui/banners/cherry-pick-undone'
import {
  BranchSortOrder,
  DEFAULT_BRANCH_SORT_ORDER,
} from '../../models/branch-sort-order'
import { getBoolean, getNumber, setNumber } from '../../lib/local-storage'
import {
  WebApplicationState,
  WebApplicationStore,
  WebDispatcher,
  WebIntegrationSelection,
} from './contracts'
import { UncommittedChangesStrategy } from '../../models/uncommitted-changes-strategy'
import {
  useWebDiffPresentationPreferencesState,
  webSidebarWidth,
  webSidebarWidthStorageKey,
  webBrowserNotificationsEnabledStorageKey,
  webShowChangesFilterStorageKey,
  webShowStashedChangesStorageKey,
  webShowBranchNameStorageKey,
  webPreferAbsoluteDatesStorageKey,
  webShowConventionalCommitBadgesStorageKey,
  webConfirmStashActionsStorageKey,
  webShowCommitLengthWarningStorageKey,
  webCommitSummaryLengthWarningThresholdStorageKey,
  getStoredUncommittedChangesStrategy,
  webRecentRepositoriesCountStorageKey,
  webShowRecentRepositoriesStorageKey,
  webShowWorktreesInRepositoryListStorageKey,
  webRepositoryIndicatorsEnabledStorageKey,
  webConfirmRepositoryRemovalStorageKey,
  webConfirmWorktreeRemovalStorageKey,
  webConfirmCheckoutCommitStorageKey,
  webConfirmDiscardChangesStorageKey,
  webConfirmCommitFilteredChangesStorageKey,
  webConfirmCommitMessageOverrideStorageKey,
  webConfirmDiscardChangesPermanentlyStorageKey,
  webConfirmForcePushStorageKey,
  webConfirmUndoCommitStorageKey,
  webHideWindowOnQuitStorageKey,
  webOptOutOfUsageTrackingStorageKey,
  webShowCommitAuthorInfoStorageKey,
  webShowCompareTabStorageKey,
  webShowWorktreesStorageKey,
  webUseExternalCredentialHelperStorageKey,
  webUseWindowsOpenSSHStorageKey,
  getStoredIntegrationSelection,
  webEditorIntegrationStorageKey,
  webShellIntegrationStorageKey,
  historySelectionStorageKey,
  getStoredHistorySelection,
  setStoredHistorySelection,
  warmWebPreferences,
  webUncommittedChangesStrategyStorageKey,
  setStoredIntegrationSelection,
  WebIntegrationPreferencesContext,
  WebDiffPresentationPreferencesContext,
  DesktopPreferencesDialog,
} from './preferences'
import {
  DesktopHome,
  DesktopAppChrome,
  DesktopRepositoryView,
} from './repository'
import {
  DesktopAddExistingRepositoryDialog,
  DesktopCloneRepositoryDialog,
  DesktopCreateRepositoryDialog,
  DesktopRepositorySettingsDialog,
  DesktopChangeRepositoryAliasDialog,
  DesktopRelocateRepositoryDialog,
  DesktopEditRepositoryGroupDialog,
  DesktopConfirmRemoveRepositoryDialog,
} from './repository-dialogs'
import { DesktopToolbar } from './toolbar'
import {
  DesktopOperationAuthPrompt,
  DesktopAppError,
} from './operation-dialogs'

interface WebAppProps {
  readonly store: WebApplicationStore
  readonly dispatcher: WebDispatcher
}

function useApplicationState(store: WebApplicationStore) {
  const [state, setState] = React.useState<WebApplicationState>(
    store.getState()
  )
  React.useEffect(
    () => store.subscribe(() => setState(store.getState())),
    [store]
  )
  return state
}

export function WebApp({ store, dispatcher }: WebAppProps) {
  const isEmbedded = getEmbeddedParentOrigin() !== null
  const state = useApplicationState(store)
  const [undoneCherryPick, setUndoneCherryPick] = React.useState<{
    readonly branch: string
    readonly count: number
  } | null>(null)
  const diffPreferences = useWebDiffPresentationPreferencesState()
  const [sidebarWidth, setSidebarWidth] = React.useState(() =>
    Math.min(
      webSidebarWidth.max,
      Math.max(
        webSidebarWidth.min,
        getNumber(webSidebarWidthStorageKey, webSidebarWidth.default)
      )
    )
  )
  const [repositoryDialogOpen, setRepositoryDialogOpen] = React.useState(false)
  const [repositorySettingsOpen, setRepositorySettingsOpen] =
    React.useState(false)
  const [preferencesOpen, setPreferencesOpen] = React.useState(false)
  const [toolbarMenuRequests, setToolbarMenuRequests] = React.useState({
    createBranch: 0,
    renameBranch: 0,
    deleteBranch: 0,
    discardAllChanges: 0,
    permanentlyDiscardAllChanges: 0,
    stashAllChanges: 0,
    newWorktree: 0,
    openWithEditor: 0,
    deleteUnusedLocalBranches: 0,
    manageRemotes: 0,
    mergeBranch: 0,
    squashMergeBranch: 0,
    rebaseBranch: 0,
  })
  const [browserNotificationsEnabled, updateBrowserNotificationsEnabled] =
    useStoredBoolean(webBrowserNotificationsEnabledStorageKey, true)
  const [showChangesFilter] = React.useState(() =>
    getBoolean(webShowChangesFilterStorageKey, true)
  )
  const [showStashedChanges] = React.useState(() =>
    getBoolean(webShowStashedChangesStorageKey, true)
  )
  const [repositoryAliasTarget, setRepositoryAliasTarget] = React.useState<
    WebApplicationState['repositories'][number] | null
  >(null)
  const [repositoryRemovalPath, setRepositoryRemovalPath] = React.useState<
    string | null
  >(null)
  const [repositoryGroupToRename, setRepositoryGroupToRename] = React.useState<
    string | null
  >(null)
  const [repositoryRelocationPath, setRepositoryRelocationPath] =
    React.useState<string | null>(null)
  const [showBranchName, setShowBranchName] = React.useState<
    'never' | 'always' | 'non-default'
  >(() => {
    const value = localStorage.getItem(webShowBranchNameStorageKey)
    return value === 'always' || value === 'non-default' ? value : 'never'
  })
  const [branchSortOrder, setBranchSortOrder] = React.useState<BranchSortOrder>(
    () => {
      const value = localStorage.getItem('branch-sort-order')
      return value === BranchSortOrder.Alphabetical ||
        value === BranchSortOrder.LastModified
        ? value
        : DEFAULT_BRANCH_SORT_ORDER
    }
  )
  const [preferAbsoluteDates, updatePreferAbsoluteDates] = useStoredBoolean(
    webPreferAbsoluteDatesStorageKey,
    false
  )
  const [showConventionalCommitBadges, updateShowConventionalCommitBadges] =
    useStoredBoolean(webShowConventionalCommitBadgesStorageKey, true)
  const [confirmStashActions, updateConfirmStashActions] = useStoredBoolean(
    webConfirmStashActionsStorageKey,
    true
  )
  const [showCommitLengthWarning, updateShowCommitLengthWarning] =
    useStoredBoolean(webShowCommitLengthWarningStorageKey, true)
  const [commitSummaryLengthWarningThreshold] = React.useState(() =>
    Math.min(
      72,
      Math.max(
        1,
        getNumber(webCommitSummaryLengthWarningThresholdStorageKey, 50)
      )
    )
  )
  const [uncommittedChangesStrategy, setUncommittedChangesStrategy] =
    React.useState<UncommittedChangesStrategy>(
      getStoredUncommittedChangesStrategy
    )
  const [recentRepositoriesCount, setRecentRepositoriesCount] = React.useState(
    () =>
      getNumber(
        webRecentRepositoriesCountStorageKey,
        getBoolean(webShowRecentRepositoriesStorageKey, true) ? 3 : 0
      )
  )
  const [showWorktreesInRepositoryList, updateShowWorktreesInRepositoryList] =
    useStoredBoolean(webShowWorktreesInRepositoryListStorageKey, false)
  const [repositoryIndicatorsEnabled, updateRepositoryIndicatorsEnabled] =
    useStoredBoolean(webRepositoryIndicatorsEnabledStorageKey, true)
  const [confirmRepositoryRemoval, updateConfirmRepositoryRemoval] =
    useStoredBoolean(webConfirmRepositoryRemovalStorageKey, true)
  const [confirmWorktreeRemoval, updateConfirmWorktreeRemoval] =
    useStoredBoolean(webConfirmWorktreeRemovalStorageKey, true)
  const [confirmCheckoutCommit, updateConfirmCheckoutCommit] = useStoredBoolean(
    webConfirmCheckoutCommitStorageKey,
    true
  )
  const [confirmDiscardChanges, updateConfirmDiscardChanges] = useStoredBoolean(
    webConfirmDiscardChangesStorageKey,
    true
  )
  const [confirmCommitFilteredChanges, updateConfirmCommitFilteredChanges] =
    useStoredBoolean(webConfirmCommitFilteredChangesStorageKey, true)
  const [confirmCommitMessageOverride, updateConfirmCommitMessageOverride] =
    useStoredBoolean(webConfirmCommitMessageOverrideStorageKey, true)
  const [
    confirmDiscardChangesPermanently,
    updateConfirmDiscardChangesPermanently,
  ] = useStoredBoolean(webConfirmDiscardChangesPermanentlyStorageKey, true)
  const [confirmForcePush, updateConfirmForcePush] = useStoredBoolean(
    webConfirmForcePushStorageKey,
    true
  )
  const [confirmUndoCommit, updateConfirmUndoCommit] = useStoredBoolean(
    webConfirmUndoCommitStorageKey,
    true
  )
  const [hideWindowOnQuit, updateHideWindowOnQuit] = useStoredBoolean(
    webHideWindowOnQuitStorageKey,
    false
  )
  const [optOutOfUsageTracking, updateOptOutOfUsageTracking] = useStoredBoolean(
    webOptOutOfUsageTrackingStorageKey,
    false
  )
  const [showCommitAuthorInfo, updateShowCommitAuthorInfo] = useStoredBoolean(
    webShowCommitAuthorInfoStorageKey,
    false
  )
  const [showCompareTab, updateShowCompareTab] = useStoredBoolean(
    webShowCompareTabStorageKey,
    true
  )
  const [showWorktrees, updateShowWorktrees] = useStoredBoolean(
    webShowWorktreesStorageKey,
    true
  )
  const [useExternalCredentialHelper, updateUseExternalCredentialHelper] =
    useStoredBoolean(webUseExternalCredentialHelperStorageKey, false)
  const [useWindowsOpenSSH, updateUseWindowsOpenSSH] = useStoredBoolean(
    webUseWindowsOpenSSHStorageKey,
    false
  )
  const [underlineLinks, updateUnderlineLinks] = useStoredBoolean(
    'underline-links',
    false
  )
  const [editorIntegration, setEditorIntegration] =
    React.useState<WebIntegrationSelection>(() =>
      getStoredIntegrationSelection(webEditorIntegrationStorageKey)
    )
  const [shellIntegration, setShellIntegration] =
    React.useState<WebIntegrationSelection>(() =>
      getStoredIntegrationSelection(webShellIntegrationStorageKey)
    )
  const [repositorySetupMode, setRepositorySetupMode] = React.useState<
    'clone' | 'init' | null
  >(null)
  const [cloneURL, setCloneURL] = React.useState('')
  const [initialRepositoryPath, setInitialRepositoryPath] = React.useState<
    string | undefined
  >(undefined)
  const repositoryInspectionInFlight = React.useRef<string | null>(null)
  const [selectedHistorySHAs, setSelectedHistorySHAs] = React.useState<
    ReadonlyArray<string>
  >([])
  const historySelectionKey = historySelectionStorageKey(
    state.selectedRepositoryPath,
    state.branches?.branch?.name || null,
    state.historyGraphMode
  )
  const historySelectionLoadedKey = React.useRef<string | null>(null)
  const skipHistorySelectionWrite = React.useRef(false)

  React.useEffect(() => {
    historySelectionLoadedKey.current = historySelectionKey
    skipHistorySelectionWrite.current = true
    setSelectedHistorySHAs(getStoredHistorySelection(historySelectionKey))
  }, [historySelectionKey])

  React.useEffect(() => {
    if (historySelectionLoadedKey.current !== historySelectionKey) return
    if (skipHistorySelectionWrite.current) {
      skipHistorySelectionWrite.current = false
      return
    }
    setStoredHistorySelection(historySelectionKey, selectedHistorySHAs)
  }, [historySelectionKey, selectedHistorySHAs])

  React.useEffect(() => {
    if (state.selectedSection !== 'history') return
    const availableSHAs = new Set(state.history.map(commit => commit.sha))
    setSelectedHistorySHAs(selection => {
      const availableSelection = selection.filter(sha => availableSHAs.has(sha))
      return availableSelection.length === selection.length
        ? selection
        : availableSelection
    })
  }, [state.history, state.selectedSection])

  const updateSelectedHistorySHAs = React.useCallback(
    (shas: ReadonlyArray<string>) => {
      setSelectedHistorySHAs(shas)
    },
    []
  )
  const selectedRepository =
    state.repositories.find(
      repository => repository.path === state.selectedRepositoryPath
    ) || null

  React.useEffect(() => {
    document.title = selectedRepository
      ? `${selectedRepository.name} - Desktop Plus`
      : 'Desktop Plus'
  }, [selectedRepository])

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        !event.shiftKey &&
        event.key === ','
      ) {
        event.preventDefault()
        void warmWebPreferences().then(() => setPreferencesOpen(true))
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  React.useEffect(() => {
    ;(
      window as Window & {
        __DESKTOP_PLUS_WEB_REPOSITORY_PATH__?: string | null
      }
    ).__DESKTOP_PLUS_WEB_REPOSITORY_PATH__ = state.selectedRepositoryPath
  }, [state.selectedRepositoryPath])

  useHostRefresh(store, dispatcher)

  React.useEffect(() => {
    if (repositoryIndicatorsEnabled)
      void dispatcher.refreshRepositoryIndicators()
  }, [dispatcher, repositoryIndicatorsEnabled])

  React.useEffect(() => {
    if (repositorySetupMode === 'init' && state.repositorySetupOptions === null)
      void dispatcher.loadRepositorySetupOptions()
  }, [dispatcher, repositorySetupMode, state.repositorySetupOptions])

  React.useEffect(() => {
    if (
      state.selectedRepositoryPath &&
      !state.selectedRepositoryInspection &&
      repositoryInspectionInFlight.current !== state.selectedRepositoryPath
    ) {
      repositoryInspectionInFlight.current = state.selectedRepositoryPath
      void dispatcher.selectRepository(state.selectedRepositoryPath)
    }
    if (!state.selectedRepositoryPath)
      repositoryInspectionInFlight.current = null
  }, [
    dispatcher,
    state.selectedRepositoryInspection,
    state.selectedRepositoryPath,
  ])

  useRepositoryQuery(dispatcher, state.selectedRepositoryPath)

  const openRepositoryDialog = () => setRepositoryDialogOpen(true)
  const openCloneDialog = (url = '') => {
    setCloneURL(url)
    setInitialRepositoryPath(undefined)
    setRepositorySetupMode('clone')
  }
  const openInitDialog = (repositoryPath?: string) => {
    setCloneURL('')
    setInitialRepositoryPath(repositoryPath)
    setRepositorySetupMode('init')
  }
  const dismissRepositorySetup = () => {
    setRepositorySetupMode(null)
    setCloneURL('')
    setInitialRepositoryPath(undefined)
  }
  const addRepositoryFromCreateDialog = (path: string) => {
    dismissRepositorySetup()
    void dispatcher.addRepository(path)
  }
  const openRepositoryAlias = (
    repository: WebApplicationState['repositories'][number]
  ) => {
    setRepositoryAliasTarget(repository)
  }
  const updateShowBranchName = (value: 'never' | 'always' | 'non-default') => {
    localStorage.setItem(webShowBranchNameStorageKey, value)
    setShowBranchName(value)
  }
  const updateBranchSortOrder = (value: BranchSortOrder) => {
    if (
      value !== BranchSortOrder.Alphabetical &&
      value !== BranchSortOrder.LastModified
    )
      return
    localStorage.setItem('branch-sort-order', value)
    setBranchSortOrder(value)
  }
  const updateUncommittedChangesStrategy = (
    value: UncommittedChangesStrategy
  ) => {
    if (
      value !== UncommittedChangesStrategy.AskForConfirmation &&
      value !== UncommittedChangesStrategy.MoveToNewBranch &&
      value !== UncommittedChangesStrategy.StashOnCurrentBranch
    )
      return
    localStorage.setItem(webUncommittedChangesStrategyStorageKey, value)
    setUncommittedChangesStrategy(value)
  }
  const updateRecentRepositoriesCount = (value: number) => {
    if (Number.isNaN(value)) return
    setNumber(webRecentRepositoriesCountStorageKey, value)
    setRecentRepositoriesCount(value)
  }
  const updateEditorIntegration = (value: WebIntegrationSelection) => {
    setStoredIntegrationSelection(webEditorIntegrationStorageKey, value)
    setEditorIntegration(value)
  }
  const updateShellIntegration = (value: WebIntegrationSelection) => {
    setStoredIntegrationSelection(webShellIntegrationStorageKey, value)
    setShellIntegration(value)
  }
  const updateSidebarWidth = (width: number) => {
    const normalized = Math.min(
      webSidebarWidth.max,
      Math.max(webSidebarWidth.min, Math.round(width))
    )
    setNumber(webSidebarWidthStorageKey, normalized)
    setSidebarWidth(normalized)
  }
  const requestRepositoryRemoval = (path: string) => {
    if (
      !confirmRepositoryRemoval ||
      !state.repositories.some(repository => repository.path === path)
    ) {
      dispatcher.removeRepository(path)
      return
    }
    setRepositoryRemovalPath(path)
  }
  const openRepositoryRelocation = (path: string) => {
    setRepositoryRelocationPath(path)
  }
  const requestToolbarMenu = React.useCallback(
    (menu: keyof typeof toolbarMenuRequests) => {
      setToolbarMenuRequests(requests => ({
        ...requests,
        [menu]: requests[menu] + 1,
      }))
    },
    []
  )
  return (
    <WebIntegrationPreferencesContext.Provider
      value={{ editor: editorIntegration, shell: shellIntegration }}
    >
      <WebDiffPresentationPreferencesContext.Provider value={diffPreferences}>
        {state.repositories.length === 0 ? (
          <>
            <DesktopHome
              diffPreferences={diffPreferences}
              dispatcher={dispatcher}
              onOpenCloneDialog={openCloneDialog}
              onOpenInitDialog={() => openInitDialog()}
              onOpenRepositoryDialog={openRepositoryDialog}
            />
            {repositoryDialogOpen ? (
              <DesktopAddExistingRepositoryDialog
                dispatcher={dispatcher}
                onCreateRepository={path => {
                  setRepositoryDialogOpen(false)
                  openInitDialog(path)
                }}
                onDismiss={() => setRepositoryDialogOpen(false)}
              />
            ) : null}
            {repositorySetupMode === 'clone' ? (
              <DesktopCloneRepositoryDialog
                dispatcher={dispatcher}
                initialURL={cloneURL}
                onDismiss={dismissRepositorySetup}
              />
            ) : repositorySetupMode === 'init' ? (
              <DesktopCreateRepositoryDialog
                dispatcher={dispatcher}
                initialPath={initialRepositoryPath}
                onAddRepository={addRepositoryFromCreateDialog}
                onDismiss={dismissRepositorySetup}
              />
            ) : null}
          </>
        ) : (
          <>
            <DesktopAppChrome
              diffFontFamily={diffPreferences.diffFontFamily}
              diffFontSize={diffPreferences.diffFontSize}
              tabSize={diffPreferences.tabSize}
              theme={diffPreferences.theme}
            >
              <DesktopToolbar
                dispatcher={dispatcher}
                onOpenRepositoryDialog={openRepositoryDialog}
                onOpenCloneDialog={() => openCloneDialog()}
                onOpenInitDialog={() => openInitDialog()}
                onChangeRepositoryAlias={openRepositoryAlias}
                onRemoveRepository={requestRepositoryRemoval}
                branchSortOrder={branchSortOrder}
                onBranchSortOrderChanged={updateBranchSortOrder}
                sidebarWidth={sidebarWidth}
                showBranchName={showBranchName}
                isEmbedded={isEmbedded}
                showWorktrees={showWorktrees}
                showWorktreesInRepositoryList={showWorktreesInRepositoryList}
                repositoryIndicatorsEnabled={repositoryIndicatorsEnabled}
                recentRepositoriesCount={recentRepositoriesCount}
                onCopyPath={path => void dispatcher.copyText(path)}
                onOpenPath={path => void dispatcher.openPath(path, true)}
                onOpenExternal={url => dispatcher.openExternal(url)}
                onOpenNewWindow={path =>
                  dispatcher.openRepositoryInNewWindow(path)
                }
                onPullAllRepositories={() =>
                  void dispatcher.pullAllRepositories()
                }
                onPullRepositoryGroup={group =>
                  void dispatcher.pullRepositoryGroup(group)
                }
                onRenameRepositoryGroup={group =>
                  setRepositoryGroupToRename(group)
                }
                toolbarMenuRequests={toolbarMenuRequests}
                confirmWorktreeRemoval={confirmWorktreeRemoval}
                onConfirmWorktreeRemovalChanged={updateConfirmWorktreeRemoval}
                confirmForcePush={confirmForcePush}
                confirmDiscardChanges={confirmDiscardChanges}
                onConfirmDiscardChangesChanged={updateConfirmDiscardChanges}
                underlineLinks={underlineLinks}
                uncommittedChangesStrategy={uncommittedChangesStrategy}
                state={state}
              />
              {state.cherryPickUndo ? (
                <SuccessfulCherryPick
                  countCherryPicked={state.cherryPickUndo.count}
                  onDismissed={() => dispatcher.dismissCherryPickUndo()}
                  onUndo={() => {
                    const undo = state.cherryPickUndo
                    if (!undo) return
                    void dispatcher
                      .runOperation('undo-cherry-pick', {
                        values: [
                          undo.branch,
                          undo.originalTip,
                          undo.rewrittenTip,
                        ],
                        confirmed: true,
                      })
                      .then(() =>
                        setUndoneCherryPick({
                          branch: undo.branch,
                          count: undo.count,
                        })
                      )
                  }}
                  targetBranchName={state.cherryPickUndo.branch}
                />
              ) : undoneCherryPick ? (
                <CherryPickUndone
                  countCherryPicked={undoneCherryPick.count}
                  onDismissed={() => setUndoneCherryPick(null)}
                  targetBranchName={undoneCherryPick.branch}
                />
              ) : null}
              <DesktopRepositoryView
                dispatcher={dispatcher}
                editorIntegration={editorIntegration}
                onSidebarWidthChanged={updateSidebarWidth}
                onSelectedHistorySHAsChanged={updateSelectedHistorySHAs}
                selectedHistorySHAs={selectedHistorySHAs}
                sidebarWidth={sidebarWidth}
                state={state}
                onRemoveRepository={requestRepositoryRemoval}
                onRelocateRepository={openRepositoryRelocation}
                preferAbsoluteDates={preferAbsoluteDates}
                showConventionalCommitBadges={showConventionalCommitBadges}
                confirmStashActions={confirmStashActions}
                onConfirmStashActionsChanged={updateConfirmStashActions}
                confirmCheckoutCommit={confirmCheckoutCommit}
                onConfirmCheckoutCommitChanged={updateConfirmCheckoutCommit}
                showCommitLengthWarning={showCommitLengthWarning}
                showChangesFilter={showChangesFilter}
                showStashedChanges={showStashedChanges}
                showCommitAuthorInfo={showCommitAuthorInfo}
                showCompareTab={showCompareTab}
                commitSummaryLengthWarningThreshold={
                  commitSummaryLengthWarningThreshold
                }
              />
              <DesktopOperationAuthPrompt
                dispatcher={dispatcher}
                task={state.operationTask}
              />
              {repositorySettingsOpen && selectedRepository ? (
                <DesktopRepositorySettingsDialog
                  branches={state.branches}
                  dispatcher={dispatcher}
                  onDismissed={() => setRepositorySettingsOpen(false)}
                  onManageRemotes={() => {
                    setRepositorySettingsOpen(false)
                    requestToolbarMenu('manageRemotes')
                  }}
                  repository={selectedRepository}
                />
              ) : null}
              <DesktopAppError dispatcher={dispatcher} state={state} />
            </DesktopAppChrome>
            {repositoryDialogOpen ? (
              <DesktopAddExistingRepositoryDialog
                dispatcher={dispatcher}
                onCreateRepository={path => {
                  setRepositoryDialogOpen(false)
                  openInitDialog(path)
                }}
                onDismiss={() => setRepositoryDialogOpen(false)}
              />
            ) : null}
            {repositorySetupMode === 'clone' ? (
              <DesktopCloneRepositoryDialog
                dispatcher={dispatcher}
                initialURL={cloneURL}
                onDismiss={dismissRepositorySetup}
              />
            ) : repositorySetupMode === 'init' ? (
              <DesktopCreateRepositoryDialog
                dispatcher={dispatcher}
                initialPath={initialRepositoryPath}
                onAddRepository={addRepositoryFromCreateDialog}
                onDismiss={dismissRepositorySetup}
              />
            ) : null}
            {repositoryAliasTarget ? (
              <DesktopChangeRepositoryAliasDialog
                dispatcher={dispatcher}
                onDismiss={() => setRepositoryAliasTarget(null)}
                repository={repositoryAliasTarget}
              />
            ) : null}
          </>
        )}
        <DesktopPreferencesDialog
          branchSortOrder={branchSortOrder}
          browserNotificationsEnabled={browserNotificationsEnabled}
          onBrowserNotificationsEnabledChanged={
            updateBrowserNotificationsEnabled
          }
          onBranchSortOrderChanged={updateBranchSortOrder}
          onConfirmStashActionsChanged={updateConfirmStashActions}
          onDismiss={() => setPreferencesOpen(false)}
          onPreferAbsoluteDatesChanged={updatePreferAbsoluteDates}
          onShowBranchNameChanged={updateShowBranchName}
          onShowConventionalCommitBadgesChanged={
            updateShowConventionalCommitBadges
          }
          open={preferencesOpen}
          preferences={diffPreferences}
          preferAbsoluteDates={preferAbsoluteDates}
          showBranchName={showBranchName}
          showConventionalCommitBadges={showConventionalCommitBadges}
          confirmStashActions={confirmStashActions}
          showCommitLengthWarning={showCommitLengthWarning}
          onShowCommitLengthWarningChanged={updateShowCommitLengthWarning}
          uncommittedChangesStrategy={uncommittedChangesStrategy}
          onUncommittedChangesStrategyChanged={updateUncommittedChangesStrategy}
          recentRepositoriesCount={recentRepositoriesCount}
          onRecentRepositoriesCountChanged={updateRecentRepositoriesCount}
          editorIntegration={editorIntegration}
          shellIntegration={shellIntegration}
          onEditorIntegrationChanged={updateEditorIntegration}
          onShellIntegrationChanged={updateShellIntegration}
          showWorktreesInRepositoryList={showWorktreesInRepositoryList}
          onShowWorktreesInRepositoryListChanged={
            updateShowWorktreesInRepositoryList
          }
          repositoryIndicatorsEnabled={repositoryIndicatorsEnabled}
          onRepositoryIndicatorsEnabledChanged={
            updateRepositoryIndicatorsEnabled
          }
          confirmRepositoryRemoval={confirmRepositoryRemoval}
          onConfirmRepositoryRemovalChanged={updateConfirmRepositoryRemoval}
          confirmWorktreeRemoval={confirmWorktreeRemoval}
          onConfirmWorktreeRemovalChanged={updateConfirmWorktreeRemoval}
          confirmCheckoutCommit={confirmCheckoutCommit}
          onConfirmCheckoutCommitChanged={updateConfirmCheckoutCommit}
          confirmDiscardChanges={confirmDiscardChanges}
          onConfirmDiscardChangesChanged={updateConfirmDiscardChanges}
          confirmCommitFilteredChanges={confirmCommitFilteredChanges}
          onConfirmCommitFilteredChangesChanged={
            updateConfirmCommitFilteredChanges
          }
          confirmCommitMessageOverride={confirmCommitMessageOverride}
          onConfirmCommitMessageOverrideChanged={
            updateConfirmCommitMessageOverride
          }
          confirmDiscardChangesPermanently={confirmDiscardChangesPermanently}
          onConfirmDiscardChangesPermanentlyChanged={
            updateConfirmDiscardChangesPermanently
          }
          confirmForcePush={confirmForcePush}
          onConfirmForcePushChanged={updateConfirmForcePush}
          confirmUndoCommit={confirmUndoCommit}
          onConfirmUndoCommitChanged={updateConfirmUndoCommit}
          hideWindowOnQuit={hideWindowOnQuit}
          onHideWindowOnQuitChanged={updateHideWindowOnQuit}
          optOutOfUsageTracking={optOutOfUsageTracking}
          onOptOutOfUsageTrackingChanged={updateOptOutOfUsageTracking}
          showCommitAuthorInfo={showCommitAuthorInfo}
          onShowCommitAuthorInfoChanged={updateShowCommitAuthorInfo}
          showCompareTab={showCompareTab}
          onShowCompareTabChanged={updateShowCompareTab}
          showWorktrees={showWorktrees}
          onShowWorktreesChanged={updateShowWorktrees}
          useExternalCredentialHelper={useExternalCredentialHelper}
          onUseExternalCredentialHelperChanged={
            updateUseExternalCredentialHelper
          }
          useWindowsOpenSSH={useWindowsOpenSSH}
          onUseWindowsOpenSSHChanged={updateUseWindowsOpenSSH}
          underlineLinks={underlineLinks}
          onUnderlineLinksChanged={updateUnderlineLinks}
          onEditGlobalGitConfig={() => void dispatcher.openGlobalGitConfig()}
          selectedRepositoryPath={state.selectedRepositoryPath}
        />
        {repositoryRelocationPath ? (
          <DesktopRelocateRepositoryDialog
            dispatcher={dispatcher}
            oldPath={repositoryRelocationPath}
            onDismiss={() => setRepositoryRelocationPath(null)}
          />
        ) : null}
        {repositoryGroupToRename ? (
          <DesktopEditRepositoryGroupDialog
            dispatcher={dispatcher}
            groupName={repositoryGroupToRename}
            onDismiss={() => setRepositoryGroupToRename(null)}
            repositories={state.repositories}
          />
        ) : null}
        {repositoryRemovalPath ? (
          state.repositories.find(
            repository => repository.path === repositoryRemovalPath
          ) ? (
            <DesktopConfirmRemoveRepositoryDialog
              dispatcher={dispatcher}
              onDismiss={() => setRepositoryRemovalPath(null)}
              repository={
                state.repositories.find(
                  repository => repository.path === repositoryRemovalPath
                )!
              }
            />
          ) : null
        ) : null}
      </WebDiffPresentationPreferencesContext.Provider>
    </WebIntegrationPreferencesContext.Provider>
  )
}
