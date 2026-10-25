import * as React from 'react'
import { DialogStackContext } from '../../ui/dialog/dialog'
import { ApplicationTheme } from '../../ui/lib/application-theme'
import { getFileTreeView, setFileTreeView } from '../../ui/lib/file-tree-folder'
import { Preferences } from '../../ui/preferences/preferences'
import { ImageDiffType } from '../../models/diff'
import { BranchSortOrder } from '../../models/branch-sort-order'
import {
  defaultDiffFontFamily,
  defaultDiffFontSize,
  DiffFontFamily,
} from '../../models/diff-font'
import { ShowBranchNameInRepoListSetting } from '../../models/show-branch-name-in-repo-list'
import { defaultCopyPathNormalization } from '../../models/copy-path-normalization'
import type { Dispatcher } from '../../ui/dispatcher'
import {
  getHideWhitespaceInDiff,
  getImageDiffType,
  getShowDiffCheckMarks,
  getShowDiffMinimap,
  getShowSideBySideDiff,
  getShowWholeFile,
  getWrapDiffLines,
  setHideWhitespaceInDiff,
  setImageDiffType,
  setShowDiffCheckMarks,
  setShowDiffMinimap,
  setShowSideBySideDiff,
  setShowWholeFile,
  setWrapDiffLines,
} from '../../ui/lib/diff-mode'
import { getNumber, setBoolean, setNumber } from '../../lib/local-storage'
import { WebIntegrationSelection } from './contracts'
import {
  UncommittedChangesStrategy,
  defaultUncommittedChangesStrategy,
} from '../../models/uncommitted-changes-strategy'
import { getGlobalConfigValue } from '../../lib/git'
import { getDefaultBranch } from '../../lib/helpers/default-branch'
import { getAvailableEditors } from '../../lib/editors/lookup'
import { getAvailableShells, parse as parseShell } from '../../lib/shells'
import { getDesktopRepository } from './models'

let webPreferencesWarmup: Promise<void> | null = null

export function warmWebPreferences(): Promise<void> {
  if (webPreferencesWarmup === null) {
    webPreferencesWarmup = Promise.all([
      getGlobalConfigValue('user.name'),
      getGlobalConfigValue('user.email'),
      getDefaultBranch(),
      getAvailableEditors(),
      getAvailableShells(),
    ])
      .then(() => undefined)
      .catch(() => {
        webPreferencesWarmup = null
      })
  }
  return webPreferencesWarmup
}

export const webShowBranchNameStorageKey = 'show-branch-name-in-repository-list'

export const webPreferAbsoluteDatesStorageKey = 'prefer-absolute-dates'

export const webShowConventionalCommitBadgesStorageKey =
  'show-conventional-commit-badges'

export const webConfirmStashActionsStorageKey = 'confirm-stash-actions'

export const webShowWorktreesInRepositoryListStorageKey =
  'show-worktrees-in-repository-list'

export const webRepositoryIndicatorsEnabledStorageKey =
  'enable-repository-indicators'

export const webConfirmRepositoryRemovalStorageKey =
  'confirm-repository-removal'

export const webConfirmWorktreeRemovalStorageKey = 'confirm-worktree-removal'

export const webConfirmCheckoutCommitStorageKey = 'confirmCheckoutCommit'

export const webConfirmDiscardChangesStorageKey = 'confirmDiscardChanges'

export const webConfirmDiscardChangesPermanentlyStorageKey =
  'confirmDiscardChangesPermanently'

export const webConfirmCommitFilteredChangesStorageKey =
  'confirmCommitFilteredChanges'

export const webConfirmCommitMessageOverrideStorageKey =
  'confirmCommitMessageOverride'

export const webConfirmForcePushStorageKey = 'confirmForcePush'

export const webConfirmUndoCommitStorageKey = 'confirmUndoCommit'

export const webShowCommitLengthWarningStorageKey = 'show-commit-length-warning'

export const webShowCommitAuthorInfoStorageKey = 'show-commit-author-info'

export const webShowCompareTabStorageKey = 'show-compare-tab'

export const webShowWorktreesStorageKey = 'show-worktrees'

export const webCommitSummaryLengthWarningThresholdStorageKey =
  'commit-summary-length-warning-threshold'

export const webShowRecentRepositoriesStorageKey = 'show-recent-repositories'

export const webRecentRepositoriesCountStorageKey = 'recent-repositories-count'

export const webUncommittedChangesStrategyStorageKey =
  'uncommitted-changes-strategy'

const webUpdateBranchStrategyStorageKey = 'update-branch-strategy'

export const webHideWindowOnQuitStorageKey = 'hide-window-on-quit'

export const webOptOutOfUsageTrackingStorageKey = 'opt-out-of-usage-tracking'

export const webUseExternalCredentialHelperStorageKey =
  'use-external-credential-helper'

export const webUseWindowsOpenSSHStorageKey = 'use-windows-openssh'

const webHistorySelectionStorageKey = 'desktop-plus-history-selection'

export const webBrowserNotificationsEnabledStorageKey =
  'browser-notifications-enabled'

export const webShowChangesFilterStorageKey = 'show-changes-filter'

export const webShowStashedChangesStorageKey = 'show-stashed-changes'

export const webSidebarWidthStorageKey = 'desktop-plus-web-sidebar-width'

export const webChangesScrollStorageKey = 'desktop-plus-web-changes-scroll'

export const webCompareScrollStorageKey = 'desktop-plus-web-compare-scroll'

export const webEditorIntegrationStorageKey =
  'desktop-plus-web-editor-integration'

export const webShellIntegrationStorageKey =
  'desktop-plus-web-shell-integration'

export const webBranchDropdownWidthStorageKey = 'branch-dropdown-width'

export const webPushPullButtonWidthStorageKey = 'push-pull-button-width'

export const webWorktreeDropdownWidthStorageKey = 'worktree-dropdown-width'

export const webSidebarWidth = { min: 220, max: 800, default: 480 }

export const webToolbarButtonWidth = { min: 140, max: 620, default: 300 }

function updateBranchStrategyStorageKey(repositoryPath: string) {
  return `${webUpdateBranchStrategyStorageKey}:${repositoryPath}`
}

export function getStoredUpdateBranchStrategy(repositoryPath: string) {
  return localStorage.getItem(
    updateBranchStrategyStorageKey(repositoryPath)
  ) === 'rebase'
    ? 'rebase'
    : 'merge'
}

export function setStoredUpdateBranchStrategy(
  repositoryPath: string,
  strategy: string
) {
  if (strategy === 'rebase')
    localStorage.setItem(
      updateBranchStrategyStorageKey(repositoryPath),
      strategy
    )
  else localStorage.removeItem(updateBranchStrategyStorageKey(repositoryPath))
}

export function getStoredIntegrationSelection(
  key: string
): WebIntegrationSelection {
  try {
    const value = JSON.parse(
      localStorage.getItem(key) || 'null'
    ) as Partial<WebIntegrationSelection> | null
    const custom = value?.custom
    if (
      custom &&
      typeof custom === 'object' &&
      typeof custom.path === 'string' &&
      typeof custom.arguments === 'string'
    )
      return {
        name: null,
        custom: {
          path: custom.path,
          arguments: custom.arguments,
        },
      }
    return {
      name: typeof value?.name === 'string' && value.name ? value.name : null,
      custom: null,
    }
  } catch {
    return { name: null, custom: null }
  }
}

export function setStoredIntegrationSelection(
  key: string,
  selection: WebIntegrationSelection
) {
  localStorage.setItem(key, JSON.stringify(selection))
}

export const WebIntegrationPreferencesContext = React.createContext<{
  readonly editor: WebIntegrationSelection
  readonly shell: WebIntegrationSelection
} | null>(null)

export function useWebIntegrationSelection(kind: 'editor' | 'shell') {
  const preferences = React.useContext(WebIntegrationPreferencesContext)
  if (!preferences)
    throw new Error('Web integration preferences are unavailable')
  return preferences[kind]
}

export function getStoredUncommittedChangesStrategy(): UncommittedChangesStrategy {
  const value = localStorage.getItem(webUncommittedChangesStrategyStorageKey)
  return value === UncommittedChangesStrategy.MoveToNewBranch ||
    value === UncommittedChangesStrategy.StashOnCurrentBranch
    ? value
    : defaultUncommittedChangesStrategy
}

export function historySelectionStorageKey(
  repositoryPath: string | null,
  branch: string | null,
  graphMode: boolean
) {
  return `${webHistorySelectionStorageKey}:${repositoryPath || 'none'}:${
    branch || 'detached'
  }:${graphMode ? 'graph' : 'list'}`
}

export function repositoryViewStorageKey(
  prefix: string,
  repositoryPath: string | null
) {
  return `${prefix}:${repositoryPath || 'none'}`
}

export function getStoredHistorySelection(key: string): ReadonlyArray<string> {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : []
  } catch {
    return []
  }
}

export function setStoredHistorySelection(
  key: string,
  selection: ReadonlyArray<string>
) {
  localStorage.setItem(key, JSON.stringify(selection))
}

export interface WebDiffPresentationPreferences {
  readonly fileTreeView: boolean
  readonly onFileTreeViewChanged: (value: boolean) => void
  readonly theme: ApplicationTheme
  readonly onThemeChanged: (value: ApplicationTheme) => void
  readonly imageDiffType: ImageDiffType
  readonly onImageDiffTypeChanged: (value: ImageDiffType) => void
  readonly showDiffCheckMarks: boolean
  readonly onShowDiffCheckMarksChanged: (value: boolean) => void
  readonly tabSize: number
  readonly onTabSizeChanged: (value: number) => void
  readonly diffFontSize: number
  readonly onDiffFontSizeChanged: (value: number) => void
  readonly diffFontFamily: DiffFontFamily
  readonly onDiffFontFamilyChanged: (value: DiffFontFamily) => void
  readonly showSideBySideDiff: boolean
  readonly onShowSideBySideDiffChanged: (value: boolean) => void
  readonly showDiffMinimap: boolean
  readonly onShowDiffMinimapChanged: (value: boolean) => void
  readonly wrapDiffLines: boolean
  readonly onWrapDiffLinesChanged: (value: boolean) => void
  readonly hideWhitespaceInDiff: boolean
  readonly onHideWhitespaceInDiffChanged: (value: boolean) => void
  readonly showWholeFile: boolean
  readonly onShowWholeFileChanged: (value: boolean) => void
}

export const WebDiffPresentationPreferencesContext =
  React.createContext<WebDiffPresentationPreferences | null>(null)

export function useWebDiffPresentationPreferencesState() {
  const [fileTreeView, setFileTreeViewState] = React.useState(getFileTreeView)
  const updateFileTreeView = React.useCallback((value: boolean) => {
    setFileTreeView(value)
    setFileTreeViewState(value)
  }, [])
  const [imageDiffType, setImageDiffTypeState] =
    React.useState(getImageDiffType)
  const [showDiffCheckMarks, setShowDiffCheckMarksState] = React.useState(
    getShowDiffCheckMarks
  )
  const [tabSize, setTabSizeState] = React.useState(() =>
    getNumber('tab-size', 4)
  )
  const [diffFontSize, setDiffFontSizeState] = React.useState(() =>
    getNumber('diff-font-size', defaultDiffFontSize + 1)
  )
  const [diffFontFamily, setDiffFontFamilyState] =
    React.useState<DiffFontFamily>(
      () => localStorage.getItem('diff-font-family') || defaultDiffFontFamily
    )
  const [theme, setThemeState] = React.useState<ApplicationTheme>(() => {
    const stored = localStorage.getItem('theme')
    return stored === ApplicationTheme.Light ||
      stored === ApplicationTheme.System
      ? stored
      : ApplicationTheme.Dark
  })
  const [showSideBySideDiff, setShowSideBySideDiffState] = React.useState(
    getShowSideBySideDiff
  )
  const [showDiffMinimap, setShowDiffMinimapState] =
    React.useState(getShowDiffMinimap)
  const [wrapDiffLines, setWrapDiffLinesState] =
    React.useState(getWrapDiffLines)
  const [hideWhitespaceInDiff, setHideWhitespaceInDiffState] = React.useState(
    getHideWhitespaceInDiff
  )
  const [showWholeFile, setShowWholeFileState] =
    React.useState(getShowWholeFile)

  const updateShowSideBySideDiff = React.useCallback((value: boolean) => {
    setShowSideBySideDiff(value)
    setShowSideBySideDiffState(value)
  }, [])
  const updateShowDiffMinimap = React.useCallback((value: boolean) => {
    setShowDiffMinimap(value)
    setShowDiffMinimapState(value)
  }, [])
  const updateWrapDiffLines = React.useCallback((value: boolean) => {
    setWrapDiffLines(value)
    setWrapDiffLinesState(value)
  }, [])
  const updateHideWhitespaceInDiff = React.useCallback((value: boolean) => {
    setHideWhitespaceInDiff(value)
    setHideWhitespaceInDiffState(value)
  }, [])
  const updateShowWholeFile = React.useCallback((value: boolean) => {
    setShowWholeFile(value)
    setShowWholeFileState(value)
  }, [])
  const updateImageDiffType = React.useCallback((value: ImageDiffType) => {
    setImageDiffType(value)
    setImageDiffTypeState(value)
  }, [])
  const updateShowDiffCheckMarks = React.useCallback((value: boolean) => {
    setShowDiffCheckMarks(value)
    setShowDiffCheckMarksState(value)
  }, [])
  const updateTabSize = React.useCallback((value: number) => {
    const normalized = Math.max(1, Math.min(16, Math.round(value)))
    setNumber('tab-size', normalized)
    setTabSizeState(normalized)
  }, [])
  const updateDiffFontSize = React.useCallback((value: number) => {
    const normalized = Math.max(8, Math.min(24, Math.round(value)))
    setNumber('diff-font-size', normalized)
    setDiffFontSizeState(normalized)
  }, [])
  const updateDiffFontFamily = React.useCallback((value: DiffFontFamily) => {
    localStorage.setItem('diff-font-family', value)
    setDiffFontFamilyState(value)
  }, [])
  const updateTheme = React.useCallback((value: ApplicationTheme) => {
    localStorage.setItem('theme', value)
    setThemeState(value)
  }, [])

  return {
    theme,
    fileTreeView,
    onFileTreeViewChanged: updateFileTreeView,
    onThemeChanged: updateTheme,
    imageDiffType,
    onImageDiffTypeChanged: updateImageDiffType,
    showDiffCheckMarks,
    onShowDiffCheckMarksChanged: updateShowDiffCheckMarks,
    tabSize,
    onTabSizeChanged: updateTabSize,
    diffFontSize,
    onDiffFontSizeChanged: updateDiffFontSize,
    diffFontFamily,
    onDiffFontFamilyChanged: updateDiffFontFamily,
    showSideBySideDiff,
    onShowSideBySideDiffChanged: updateShowSideBySideDiff,
    showDiffMinimap,
    onShowDiffMinimapChanged: updateShowDiffMinimap,
    wrapDiffLines,
    onWrapDiffLinesChanged: updateWrapDiffLines,
    hideWhitespaceInDiff,
    onHideWhitespaceInDiffChanged: updateHideWhitespaceInDiff,
    showWholeFile,
    onShowWholeFileChanged: updateShowWholeFile,
  }
}

export function DesktopPreferencesDialog(props: {
  readonly open: boolean
  readonly preferences: WebDiffPresentationPreferences
  readonly selectedRepositoryPath: string | null
  readonly browserNotificationsEnabled: boolean
  readonly onBrowserNotificationsEnabledChanged: (value: boolean) => void
  readonly showBranchName: 'never' | 'always' | 'non-default'
  readonly onShowBranchNameChanged: (
    value: 'never' | 'always' | 'non-default'
  ) => void
  readonly branchSortOrder: BranchSortOrder
  readonly onBranchSortOrderChanged: (value: BranchSortOrder) => void
  readonly preferAbsoluteDates: boolean
  readonly onPreferAbsoluteDatesChanged: (value: boolean) => void
  readonly showConventionalCommitBadges: boolean
  readonly onShowConventionalCommitBadgesChanged: (value: boolean) => void
  readonly confirmStashActions: boolean
  readonly onConfirmStashActionsChanged: (value: boolean) => void
  readonly showWorktreesInRepositoryList: boolean
  readonly onShowWorktreesInRepositoryListChanged: (value: boolean) => void
  readonly repositoryIndicatorsEnabled: boolean
  readonly onRepositoryIndicatorsEnabledChanged: (value: boolean) => void
  readonly confirmRepositoryRemoval: boolean
  readonly onConfirmRepositoryRemovalChanged: (value: boolean) => void
  readonly confirmWorktreeRemoval: boolean
  readonly onConfirmWorktreeRemovalChanged: (value: boolean) => void
  readonly confirmCheckoutCommit: boolean
  readonly onConfirmCheckoutCommitChanged: (value: boolean) => void
  readonly confirmDiscardChanges: boolean
  readonly onConfirmDiscardChangesChanged: (value: boolean) => void
  readonly confirmCommitFilteredChanges: boolean
  readonly onConfirmCommitFilteredChangesChanged: (value: boolean) => void
  readonly confirmCommitMessageOverride: boolean
  readonly onConfirmCommitMessageOverrideChanged: (value: boolean) => void
  readonly confirmDiscardChangesPermanently: boolean
  readonly onConfirmDiscardChangesPermanentlyChanged: (value: boolean) => void
  readonly confirmForcePush: boolean
  readonly onConfirmForcePushChanged: (value: boolean) => void
  readonly confirmUndoCommit: boolean
  readonly onConfirmUndoCommitChanged: (value: boolean) => void
  readonly hideWindowOnQuit: boolean
  readonly onHideWindowOnQuitChanged: (value: boolean) => void
  readonly optOutOfUsageTracking: boolean
  readonly onOptOutOfUsageTrackingChanged: (value: boolean) => void
  readonly showCommitAuthorInfo: boolean
  readonly onShowCommitAuthorInfoChanged: (value: boolean) => void
  readonly showCompareTab: boolean
  readonly onShowCompareTabChanged: (value: boolean) => void
  readonly showWorktrees: boolean
  readonly onShowWorktreesChanged: (value: boolean) => void
  readonly useExternalCredentialHelper: boolean
  readonly onUseExternalCredentialHelperChanged: (value: boolean) => void
  readonly useWindowsOpenSSH: boolean
  readonly onUseWindowsOpenSSHChanged: (value: boolean) => void
  readonly underlineLinks: boolean
  readonly onUnderlineLinksChanged: (value: boolean) => void
  readonly onEditGlobalGitConfig: () => void
  readonly showCommitLengthWarning: boolean
  readonly onShowCommitLengthWarningChanged: (value: boolean) => void
  readonly uncommittedChangesStrategy: UncommittedChangesStrategy
  readonly onUncommittedChangesStrategyChanged: (
    value: UncommittedChangesStrategy
  ) => void
  readonly recentRepositoriesCount: number
  readonly onRecentRepositoriesCountChanged: (value: number) => void
  readonly editorIntegration: WebIntegrationSelection
  readonly shellIntegration: WebIntegrationSelection
  readonly onEditorIntegrationChanged: (value: WebIntegrationSelection) => void
  readonly onShellIntegrationChanged: (value: WebIntegrationSelection) => void
  readonly onDismiss: () => void
}) {
  if (!props.open) return null

  let useSystemDefaultProgram =
    props.editorIntegration.name === 'System Default Program'
  let useCustomEditor = props.editorIntegration.custom !== null

  const desktopDispatcher = {
    fetchCopilotModels: () => undefined,
    fetchCopilotQuotaSnapshots: () => undefined,
    openInBrowser: (url: string) => window.open(url, '_blank', 'noopener'),
    postError: () => undefined,
    refreshAuthor: () => undefined,
    removeAccount: () => undefined,
    setAlwaysUseCopilotForConflictResolution: () => undefined,
    setAlwaysShowWorktreeList: () => undefined,
    setBranchPresetScript: () => undefined,
    setBranchSortOrder: props.onBranchSortOrderChanged,
    setConfirmCheckoutCommitSetting: props.onConfirmCheckoutCommitChanged,
    setConfirmCommitFilteredChanges: (value: boolean) =>
      props.onConfirmCommitFilteredChangesChanged(value),
    setConfirmCommitMessageOverrideSetting: (value: boolean) =>
      props.onConfirmCommitMessageOverrideChanged(value),
    setConfirmDiscardChangesPermanentlySetting: (value: boolean) =>
      props.onConfirmDiscardChangesPermanentlyChanged(value),
    setConfirmDiscardChangesSetting: props.onConfirmDiscardChangesChanged,
    setConfirmDiscardStashSetting: props.onConfirmStashActionsChanged,
    setConfirmForcePushSetting: props.onConfirmForcePushChanged,
    setConfirmRepoRemovalSetting: props.onConfirmRepositoryRemovalChanged,
    setConfirmUndoCommitSetting: props.onConfirmUndoCommitChanged,
    setConfirmWorktreeRemovalSetting: (value: boolean) => {
      setBoolean(webConfirmWorktreeRemovalStorageKey, value)
      props.onConfirmWorktreeRemovalChanged(value)
    },
    setCustomEditor: (custom: WebIntegrationSelection['custom']) => {
      if (!useSystemDefaultProgram && useCustomEditor)
        props.onEditorIntegrationChanged({ name: null, custom })
    },
    setCustomShell: (custom: WebIntegrationSelection['custom']) =>
      props.onShellIntegrationChanged({ name: null, custom }),
    setDiffCheckMarksSetting: props.preferences.onShowDiffCheckMarksChanged,
    setExternalEditor: (name: string) => {
      if (!useSystemDefaultProgram && !useCustomEditor)
        props.onEditorIntegrationChanged({ name, custom: null })
    },
    setUseSystemDefaultProgram: (value: boolean) => {
      useSystemDefaultProgram = value
      if (value)
        props.onEditorIntegrationChanged({
          name: 'System Default Program',
          custom: null,
        })
      else if (props.editorIntegration.name === 'System Default Program')
        props.onEditorIntegrationChanged({ name: null, custom: null })
    },
    setHideWindowOnQuit: props.onHideWindowOnQuitChanged,
    setNotificationsEnabled: props.onBrowserNotificationsEnabledChanged,
    setPreferAbsoluteDates: props.onPreferAbsoluteDatesChanged,
    setRepositoryIndicatorsEnabled: props.onRepositoryIndicatorsEnabledChanged,
    setSelectedCopilotModelsByAccount: () => undefined,
    setSelectedDiffFontFamily: props.preferences.onDiffFontFamilyChanged,
    setSelectedDiffFontSize: props.preferences.onDiffFontSizeChanged,
    setSelectedTabSize: props.preferences.onTabSizeChanged,
    setSelectedTheme: props.preferences.onThemeChanged,
    setShell: (name: string) =>
      props.onShellIntegrationChanged({ name, custom: null }),
    setShowBranchNameInRepoList: (value: ShowBranchNameInRepoListSetting) =>
      props.onShowBranchNameChanged(
        value === ShowBranchNameInRepoListSetting.Always
          ? 'always'
          : value === ShowBranchNameInRepoListSetting.WhenNotDefault
          ? 'non-default'
          : 'never'
      ),
    setShowCommitAuthorInfo: props.onShowCommitAuthorInfoChanged,
    setShowCommitLengthWarning: props.onShowCommitLengthWarningChanged,
    setShowCompareTab: props.onShowCompareTabChanged,
    setShowConventionalCommitBadges:
      props.onShowConventionalCommitBadgesChanged,
    setRecentRepositoriesCount: props.onRecentRepositoriesCountChanged,
    setShowWorktrees: props.onShowWorktreesChanged,
    setShowWorktreesInRepoList: props.onShowWorktreesInRepositoryListChanged,
    setStatsOptOut: async (value: boolean) => {
      props.onOptOutOfUsageTrackingChanged(value)
    },
    setTitleBarStyle: async () => undefined,
    setUnderlineLinksSetting: props.onUnderlineLinksChanged,
    setUncommittedChangesStrategySetting: (
      value: UncommittedChangesStrategy
    ) => {
      localStorage.setItem(webUncommittedChangesStrategyStorageKey, value)
      props.onUncommittedChangesStrategyChanged(value)
    },
    setUseCustomEditor: (useCustom: boolean) => {
      useCustomEditor = useCustom
      if (
        !useSystemDefaultProgram &&
        !useCustom &&
        props.editorIntegration.custom
      )
        props.onEditorIntegrationChanged({ name: null, custom: null })
    },
    setUseCustomShell: (useCustom: boolean) => {
      if (!useCustom && props.shellIntegration.custom)
        props.onShellIntegrationChanged({ name: null, custom: null })
    },
    setUseExternalCredentialHelper: props.onUseExternalCredentialHelperChanged,
    setUseWindowsOpenSSH: props.onUseWindowsOpenSSHChanged,
  } as unknown as Dispatcher

  const defaultIntegration = { path: '', arguments: '%TARGET_PATH%' }
  const shellName =
    props.shellIntegration.name ||
    props.shellIntegration.custom?.path ||
    'Terminal'

  return (
    <DialogStackContext.Provider value={{ isTopMost: true }}>
      <Preferences
        accounts={[]}
        alwaysUseCopilotForConflictResolution={false}
        alwaysShowWorktreeList={false}
        askForConfirmationOnCommitFilteredChanges={
          props.confirmCommitFilteredChanges
        }
        branchPresetScript={defaultIntegration}
        branchSortOrder={props.branchSortOrder}
        byokProviders={[]}
        confirmCheckoutCommit={props.confirmCheckoutCommit}
        confirmCommitMessageOverride={props.confirmCommitMessageOverride}
        confirmDiscardChanges={props.confirmDiscardChanges}
        confirmDiscardChangesPermanently={
          props.confirmDiscardChangesPermanently
        }
        confirmDiscardStash={props.confirmStashActions}
        confirmForcePush={props.confirmForcePush}
        confirmRepositoryRemoval={props.confirmRepositoryRemoval}
        confirmUndoCommit={props.confirmUndoCommit}
        confirmWorktreeRemoval={props.confirmWorktreeRemoval}
        copilotModelsByAccount={new Map()}
        copilotAppPath={null}
        copilotQuotaSnapshotsByAccount={new Map()}
        copyPathNormalization={defaultCopyPathNormalization}
        customEditor={props.editorIntegration.custom}
        customShell={props.shellIntegration.custom}
        dispatcher={desktopDispatcher}
        hideWindowOnQuit={props.hideWindowOnQuit}
        notificationsEnabled={props.browserNotificationsEnabled}
        onDismissed={props.onDismiss}
        onEditGlobalGitConfig={props.onEditGlobalGitConfig}
        optOutOfUsageTracking={props.optOutOfUsageTracking}
        repository={
          props.selectedRepositoryPath
            ? getDesktopRepository(props.selectedRepositoryPath)
            : null
        }
        repositoryIndicatorsEnabled={props.repositoryIndicatorsEnabled}
        selectedCopilotModelsByAccount={new Map()}
        selectedDiffFontFamily={props.preferences.diffFontFamily}
        selectedDiffFontSize={props.preferences.diffFontSize}
        selectedExternalEditor={props.editorIntegration.name}
        selectedShell={parseShell(shellName)}
        selectedTabSize={props.preferences.tabSize}
        selectedTheme={props.preferences.theme}
        showBranchNameInRepoList={
          props.showBranchName === 'always'
            ? ShowBranchNameInRepoListSetting.Always
            : props.showBranchName === 'non-default'
            ? ShowBranchNameInRepoListSetting.WhenNotDefault
            : ShowBranchNameInRepoListSetting.Never
        }
        showCommitAuthorInfo={props.showCommitAuthorInfo}
        showCommitLengthWarning={props.showCommitLengthWarning}
        showCompareTab={props.showCompareTab}
        showConventionalCommitBadges={props.showConventionalCommitBadges}
        showDiffCheckMarks={props.preferences.showDiffCheckMarks}
        recentRepositoriesCount={props.recentRepositoriesCount}
        showWorktrees={props.showWorktrees}
        showWorktreesInRepoList={props.showWorktreesInRepositoryList}
        titleBarStyle="native"
        underlineLinks={props.underlineLinks}
        uncommittedChangesStrategy={props.uncommittedChangesStrategy}
        useSystemDefaultProgram={useSystemDefaultProgram}
        useCustomEditor={props.editorIntegration.custom !== null}
        useCustomShell={props.shellIntegration.custom !== null}
        useExternalCredentialHelper={props.useExternalCredentialHelper}
        useWindowsOpenSSH={props.useWindowsOpenSSH}
      />
    </DialogStackContext.Provider>
  )
}

export function useWebDiffPresentationPreferences() {
  const preferences = React.useContext(WebDiffPresentationPreferencesContext)
  if (preferences === null) {
    throw new Error('Web diff presentation preferences are unavailable')
  }
  return preferences
}
