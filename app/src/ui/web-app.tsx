import * as React from 'react'

import { NoRepositoriesView } from './no-repositories/no-repositories-view'
import { MissingRepository } from './missing-repository'
import { AppError } from './app-error'
import { GenericGitAuthentication } from './generic-git-auth'
import { AddSSHHost } from './ssh/add-ssh-host'
import { SSHKeyPassphrase } from './ssh/ssh-key-passphrase'
import { SSHUserPassword } from './ssh/ssh-user-password'
import { HookFailed } from './hook-failed/hook-failed'
import { AppContents, FocusedAppChrome } from './app-chrome'
import { DialogStackContext } from './dialog/dialog'
import { ApplicationTheme } from './lib/application-theme'
import { Preferences } from './preferences/preferences'
import { RepositoriesList } from './repositories-list/repositories-list'
import { ChangeRepositoryAlias } from './change-repository-alias/change-repository-alias-dialog'
import { AddExistingRepository } from './add-repository/add-existing-repository'
import { CreateRepository } from './add-repository/create-repository'
import { CloneRepository } from './clone-repository/clone-repository'
import {
  ApplicationToolbar,
  BranchDropdown,
  PushPullButton,
  RepositoryToolbarDropdown,
  WorktreeDropdown,
  ToolbarActionMenu,
  ToolbarActionMenuItem,
} from './toolbar'
import * as octicons from './octicons/octicons.generated'
import { Changes, ChangesSidebar } from './changes'
import { NoChanges } from './changes/no-changes'
import { StashDiffViewer } from './stashing'
import { CreateTag } from './create-tag/create-tag-dialog'
import { DeleteTag } from './delete-tag/delete-tag-dialog'
import { DeleteBranch } from './delete-branch/delete-branch-dialog'
import { DeleteRemoteBranch } from './delete-branch/delete-remote-branch-dialog'
import { DeleteUnusedLocalBranches } from './delete-branch/delete-unused-local-branches-dialog'
import { AddRemoteDialog } from './manage-remotes/add-remote-dialog'
import { ManageRemotesDialog } from './manage-remotes/manage-remotes-dialog'
import {
  RepositorySettings,
  RepositorySettingsTab,
} from './repository-settings/repository-settings'
import { ConfirmCheckoutCommitDialog } from './checkout/confirm-checkout-commit'
import { ConfirmRemoveRepository } from './remove-repository/confirm-remove-repository'
import { OpenWithExternalEditor } from './open-with-external-editor/open-with-external-editor'
import { DiscardChanges } from './discard-changes/discard-changes-dialog'
import { DiscardSelection } from './discard-changes/discard-selection-dialog'
import { ConfirmDeletePushedTagDialog } from './tag/confirm-delete-pushed-tag'
import { ConfirmCommitFilteredChanges } from './changes/confirm-commit-filtered-changes-dialog'
import { CreateRepositoryGroup } from './create-repository-group/create-repository-group-dialog'
import { CreateBranch } from './create-branch/create-branch-dialog'
import { RenameBranch } from './rename-branch/rename-branch-dialog'
import { AddWorktreeDialog } from './worktrees/add-worktree-dialog'
import { RenameWorktreeDialog } from './worktrees/rename-worktree-dialog'
import { DeleteWorktreeDialog } from './worktrees/delete-worktree-dialog'
import { DeleteWorktreeFailedDialog } from './worktrees/delete-worktree-failed-dialog'
import { TutorialPanel } from './tutorial'
import { WarnResetToPushedCommit } from './reset/warn-reset-to-pushed-commit'
import { ConfirmForcePush } from './rebase/confirm-force-push'
import { StashAndSwitchBranch } from './stash-changes/stash-and-switch-branch-dialog'
import { ChooseTargetBranchDialog } from './multi-commit-operation/choose-branch/choose-target-branch'
import { MergeChooseBranchDialog } from './multi-commit-operation/choose-branch/merge-choose-branch-dialog'
import { RebaseChooseBranchDialog } from './multi-commit-operation/choose-branch/rebase-choose-branch-dialog'
import { ConflictsDialog } from './multi-commit-operation/dialog/conflicts-dialog'
import { ConfirmAbortDialog } from './multi-commit-operation/dialog/confirm-abort-dialog'
import { ConflictsFoundBanner } from './banners/conflicts-found-banner'
import { SuccessfulCherryPick } from './banners/successful-cherry-pick'
import { CherryPickUndone } from './banners/cherry-pick-undone'
import { renderBanner } from './banners'
import { CommitMessageDialog } from './commit-message/commit-message-dialog'
import { CommitProgress } from './commit-progress/commit-progress'
import {
  AppFileStatus,
  AppFileStatusKind,
  CommittedFileChange,
  GitStatusEntry,
  UnmergedEntrySummary,
  WorkingDirectoryFileChange,
  WorkingDirectoryStatus,
} from '../models/status'
import { StashedChangesLoadStates } from '../models/stash-entry'
import {
  DiffLineType,
  DiffSelection,
  DiffSelectionType,
  ImageDiffType,
  ITextDiff,
} from '../models/diff'
import { Commit } from '../models/commit'
import { CommitIdentity } from '../models/commit-identity'
import {
  BranchSortOrder,
  DEFAULT_BRANCH_SORT_ORDER,
} from '../models/branch-sort-order'
import { CommitGraphSidebar, CompareSidebar, SelectedCommits } from './history'
import { ConfirmDiscardStashDialog } from './stashing/confirm-discard-stash'
import { RenameStashDialog } from './stashing/rename-stash-dialog'
import { DiffParser } from '../lib/diff-parser'
import { IDiff, DiffType } from '../models/diff'
import {
  formatPatch,
  formatPatchToDiscardChanges,
} from '../lib/patch-formatter'
import { Repository } from '../models/repository'
import type { IRemote } from '../models/remote'
import {
  defaultDiffFontFamily,
  defaultDiffFontSize,
  DiffFontFamily,
} from '../models/diff-font'
import { Branch, BranchType } from '../models/branch'
import { BranchesTab } from '../models/branches-tab'
import { Popup, PopupType } from '../models/popup'
import { BannerType } from '../models/banner'
import { CloneRepositoryTab } from '../models/clone-repository-tab'
import { Tip, TipState } from '../models/tip'
import { FoldoutType } from '../lib/app-state'
import type { Progress } from '../models/progress'
import { ShowBranchNameInRepoListSetting } from '../models/show-branch-name-in-repo-list'
import { defaultCopyPathNormalization } from '../models/copy-path-normalization'
import type { Dispatcher } from './dispatcher'
import { RepositoryLayout } from './repository-layout'
import { RepositoryTabs } from './repository-tabs'
import type { IMenu } from '../models/app-menu'
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
} from './lib/diff-mode'
import {
  getBoolean,
  getNumber,
  setBoolean,
  setNumber,
} from '../lib/local-storage'

import {
  WebApplicationState,
  WebApplicationStore,
  WebDispatcher,
  WebFile,
  WebBranch,
  WebBranches,
  WebDiff,
  WebStash,
  WebTag,
  WebOperationOptions,
  WebOperationTask,
  WebIntegrationSelection,
} from './web/contracts'
import { TutorialStep } from '../models/tutorial-step'
import {
  UncommittedChangesStrategy,
  defaultUncommittedChangesStrategy,
} from '../models/uncommitted-changes-strategy'
import { RepoRulesInfo } from '../models/repo-rules'
import { ICommitMessage } from '../models/commit-message'
import { ICommitContext } from '../models/commit'
import {
  ChangesSelectionKind,
  ComparisonMode,
  HistoryTabMode,
  ICompareState,
  IChangesState,
  IRepositoryState,
  RepositorySectionTab,
} from '../lib/app-state'
import { AheadBehindStore } from '../lib/stores/ahead-behind-store'
import { getCurrentBranchForcePushState } from '../lib/rebase'
import { MultiCommitOperationKind } from '../models/multi-commit-operation'
import { ManualConflictResolution } from '../models/manual-conflict-resolution'
import { getGlobalConfigValue } from '../lib/git'
import { TerminalOutputListener } from '../lib/git'
import { getDefaultBranch } from '../lib/helpers/default-branch'
import { getAvailableEditors } from '../lib/editors/lookup'
import { getAvailableShells, parse as parseShell } from '../lib/shells'

interface WebAppProps {
  readonly store: WebApplicationStore
  readonly dispatcher: WebDispatcher
}

type CommitMessagePopup = Extract<
  Popup,
  { readonly type: PopupType.CommitMessage }
>
type HistoryRewriteKind = 'reorder' | 'squash'

let webPreferencesWarmup: Promise<void> | null = null

function warmWebPreferences(): Promise<void> {
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

function formatCommitContextMessage(context: ICommitContext): string {
  const message = [context.summary, context.description]
    .filter((part): part is string => Boolean(part))
    .join('\n\n')
  const trailers = (context.trailers || []).map(
    trailer => `${trailer.token}: ${trailer.value}`
  )
  return trailers.length > 0 ? `${message}\n\n${trailers.join('\n')}` : message
}

const webShowBranchNameStorageKey = 'show-branch-name-in-repository-list'
const webPreferAbsoluteDatesStorageKey = 'prefer-absolute-dates'
const webShowConventionalCommitBadgesStorageKey =
  'show-conventional-commit-badges'
const webConfirmStashActionsStorageKey = 'confirm-stash-actions'
const webShowWorktreesInRepositoryListStorageKey =
  'show-worktrees-in-repository-list'
const webRepositoryIndicatorsEnabledStorageKey = 'enable-repository-indicators'
const webConfirmRepositoryRemovalStorageKey = 'confirm-repository-removal'
const webConfirmWorktreeRemovalStorageKey = 'confirm-worktree-removal'
const webConfirmCheckoutCommitStorageKey = 'confirmCheckoutCommit'
const webConfirmDiscardChangesStorageKey = 'confirmDiscardChanges'
const webConfirmDiscardChangesPermanentlyStorageKey =
  'confirmDiscardChangesPermanently'
const webConfirmCommitFilteredChangesStorageKey = 'confirmCommitFilteredChanges'
const webConfirmCommitMessageOverrideStorageKey = 'confirmCommitMessageOverride'
const webConfirmForcePushStorageKey = 'confirmForcePush'
const webConfirmUndoCommitStorageKey = 'confirmUndoCommit'
const webShowCommitLengthWarningStorageKey = 'show-commit-length-warning'
const webShowCommitAuthorInfoStorageKey = 'show-commit-author-info'
const webShowCompareTabStorageKey = 'show-compare-tab'
const webShowWorktreesStorageKey = 'show-worktrees'
const webCommitSummaryLengthWarningThresholdStorageKey =
  'commit-summary-length-warning-threshold'
const webShowRecentRepositoriesStorageKey = 'show-recent-repositories'
const webRecentRepositoriesCountStorageKey = 'recent-repositories-count'
const webUncommittedChangesStrategyStorageKey = 'uncommitted-changes-strategy'
const webUpdateBranchStrategyStorageKey = 'update-branch-strategy'
const webHideWindowOnQuitStorageKey = 'hide-window-on-quit'
const webOptOutOfUsageTrackingStorageKey = 'opt-out-of-usage-tracking'
const webUseExternalCredentialHelperStorageKey =
  'use-external-credential-helper'
const webUseWindowsOpenSSHStorageKey = 'use-windows-openssh'
const webHistorySelectionStorageKey = 'desktop-plus-history-selection'
const webBrowserNotificationsEnabledStorageKey = 'browser-notifications-enabled'
const webShowChangesFilterStorageKey = 'show-changes-filter'
const webShowStashedChangesStorageKey = 'show-stashed-changes'
const webSidebarWidthStorageKey = 'desktop-plus-web-sidebar-width'
const webChangesScrollStorageKey = 'desktop-plus-web-changes-scroll'
const webCompareScrollStorageKey = 'desktop-plus-web-compare-scroll'
const webEditorIntegrationStorageKey = 'desktop-plus-web-editor-integration'
const webShellIntegrationStorageKey = 'desktop-plus-web-shell-integration'
const webBranchDropdownWidthStorageKey = 'branch-dropdown-width'
const webPushPullButtonWidthStorageKey = 'push-pull-button-width'
const webWorktreeDropdownWidthStorageKey = 'worktree-dropdown-width'
const webSidebarWidth = { min: 220, max: 800, default: 480 }
const webToolbarButtonWidth = { min: 140, max: 620, default: 300 }

function updateBranchStrategyStorageKey(repositoryPath: string) {
  return `${webUpdateBranchStrategyStorageKey}:${repositoryPath}`
}

function getStoredUpdateBranchStrategy(repositoryPath: string) {
  return localStorage.getItem(
    updateBranchStrategyStorageKey(repositoryPath)
  ) === 'rebase'
    ? 'rebase'
    : 'merge'
}

function setStoredUpdateBranchStrategy(
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

const webSuggestedActionsMenu: IMenu = {
  type: 'menu',
  items: [
    'open-working-directory',
    'open-external-editor',
    'preferences',
    'toggle-stashed-changes',
    'push',
    'pull',
    'create-pull-request',
    'preview-pull-request',
  ].map(id => ({
    type: 'menuItem' as const,
    id,
    label: id,
    enabled: true,
    visible: true,
    accelerator: null,
    accessKey: null,
  })),
}

function getStoredIntegrationSelection(key: string): WebIntegrationSelection {
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

function setStoredIntegrationSelection(
  key: string,
  selection: WebIntegrationSelection
) {
  localStorage.setItem(key, JSON.stringify(selection))
}

const WebIntegrationPreferencesContext = React.createContext<{
  readonly editor: WebIntegrationSelection
  readonly shell: WebIntegrationSelection
} | null>(null)

function useWebIntegrationSelection(kind: 'editor' | 'shell') {
  const preferences = React.useContext(WebIntegrationPreferencesContext)
  if (!preferences)
    throw new Error('Web integration preferences are unavailable')
  return preferences[kind]
}

function getStoredUncommittedChangesStrategy(): UncommittedChangesStrategy {
  const value = localStorage.getItem(webUncommittedChangesStrategyStorageKey)
  return value === UncommittedChangesStrategy.MoveToNewBranch ||
    value === UncommittedChangesStrategy.StashOnCurrentBranch
    ? value
    : defaultUncommittedChangesStrategy
}

function historySelectionStorageKey(
  repositoryPath: string | null,
  branch: string | null,
  graphMode: boolean
) {
  return `${webHistorySelectionStorageKey}:${repositoryPath || 'none'}:${
    branch || 'detached'
  }:${graphMode ? 'graph' : 'list'}`
}

function repositoryViewStorageKey(
  prefix: string,
  repositoryPath: string | null
) {
  return `${prefix}:${repositoryPath || 'none'}`
}

function getStoredHistorySelection(key: string): ReadonlyArray<string> {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : []
  } catch {
    return []
  }
}

function setStoredHistorySelection(
  key: string,
  selection: ReadonlyArray<string>
) {
  localStorage.setItem(key, JSON.stringify(selection))
}

type WebStashAction = {
  readonly stash: WebStash
  readonly operation: 'stash-apply' | 'stash-pop' | 'stash-drop'
}

interface WebDiffPresentationPreferences {
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

const WebDiffPresentationPreferencesContext =
  React.createContext<WebDiffPresentationPreferences | null>(null)

function useWebDiffPresentationPreferencesState() {
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

function DesktopPreferencesDialog(props: {
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

  const desktopDispatcher = {
    fetchCopilotModels: () => undefined,
    fetchCopilotQuotaSnapshots: () => undefined,
    openInBrowser: (url: string) => window.open(url, '_blank', 'noopener'),
    postError: () => undefined,
    refreshAuthor: () => undefined,
    removeAccount: () => undefined,
    setAlwaysUseCopilotForConflictResolution: () => undefined,
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
    setCustomEditor: (custom: WebIntegrationSelection['custom']) =>
      props.onEditorIntegrationChanged({ name: null, custom }),
    setCustomShell: (custom: WebIntegrationSelection['custom']) =>
      props.onShellIntegrationChanged({ name: null, custom }),
    setDiffCheckMarksSetting: props.preferences.onShowDiffCheckMarksChanged,
    setExternalEditor: (name: string) =>
      props.onEditorIntegrationChanged({ name, custom: null }),
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
      if (!useCustom && props.editorIntegration.custom)
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
        useCustomEditor={props.editorIntegration.custom !== null}
        useCustomShell={props.shellIntegration.custom !== null}
        useExternalCredentialHelper={props.useExternalCredentialHelper}
        useWindowsOpenSSH={props.useWindowsOpenSSH}
      />
    </DialogStackContext.Provider>
  )
}

function useWebDiffPresentationPreferences() {
  const preferences = React.useContext(WebDiffPresentationPreferencesContext)
  if (preferences === null) {
    throw new Error('Web diff presentation preferences are unavailable')
  }
  return preferences
}

function getDesktopFileStatus(file: WebFile): AppFileStatus {
  const submoduleStatus = file.status.submoduleStatus
  if (file.status.kind === AppFileStatusKind.Conflicted) {
    const entry = file.status.entry
    const us = entry?.us || GitStatusEntry.UpdatedButUnmerged
    const them = entry?.them || GitStatusEntry.UpdatedButUnmerged
    const conflictMarkerCount = file.status.conflictMarkerCount
    if (us === GitStatusEntry.Added && them === GitStatusEntry.Added) {
      const textEntry = {
        kind: 'conflicted' as const,
        action: UnmergedEntrySummary.BothAdded,
        us: GitStatusEntry.Added,
        them: GitStatusEntry.Added,
      } as const
      return typeof conflictMarkerCount === 'number'
        ? {
            kind: AppFileStatusKind.Conflicted,
            entry: textEntry,
            conflictMarkerCount,
            ...(submoduleStatus ? { submoduleStatus } : {}),
          }
        : {
            kind: AppFileStatusKind.Conflicted,
            entry: textEntry,
            ...(submoduleStatus ? { submoduleStatus } : {}),
          }
    }
    if (
      us === GitStatusEntry.UpdatedButUnmerged &&
      them === GitStatusEntry.UpdatedButUnmerged
    ) {
      const textEntry = {
        kind: 'conflicted' as const,
        action: UnmergedEntrySummary.BothModified,
        us: GitStatusEntry.UpdatedButUnmerged,
        them: GitStatusEntry.UpdatedButUnmerged,
      } as const
      return typeof conflictMarkerCount === 'number'
        ? {
            kind: AppFileStatusKind.Conflicted,
            entry: textEntry,
            conflictMarkerCount,
            ...(submoduleStatus ? { submoduleStatus } : {}),
          }
        : {
            kind: AppFileStatusKind.Conflicted,
            entry: textEntry,
            ...(submoduleStatus ? { submoduleStatus } : {}),
          }
    }
    if (
      us === GitStatusEntry.Added &&
      them === GitStatusEntry.UpdatedButUnmerged
    )
      return {
        kind: AppFileStatusKind.Conflicted,
        entry: {
          kind: 'conflicted',
          action: UnmergedEntrySummary.AddedByUs,
          us: GitStatusEntry.Added,
          them: GitStatusEntry.UpdatedButUnmerged,
        },
        ...(submoduleStatus ? { submoduleStatus } : {}),
      }
    if (
      us === GitStatusEntry.UpdatedButUnmerged &&
      them === GitStatusEntry.Deleted
    )
      return {
        kind: AppFileStatusKind.Conflicted,
        entry: {
          kind: 'conflicted',
          action: UnmergedEntrySummary.DeletedByThem,
          us: GitStatusEntry.UpdatedButUnmerged,
          them: GitStatusEntry.Deleted,
        },
        ...(submoduleStatus ? { submoduleStatus } : {}),
      }
    if (
      us === GitStatusEntry.UpdatedButUnmerged &&
      them === GitStatusEntry.Added
    )
      return {
        kind: AppFileStatusKind.Conflicted,
        entry: {
          kind: 'conflicted',
          action: UnmergedEntrySummary.AddedByThem,
          us: GitStatusEntry.UpdatedButUnmerged,
          them: GitStatusEntry.Added,
        },
        ...(submoduleStatus ? { submoduleStatus } : {}),
      }
    if (
      us === GitStatusEntry.Deleted &&
      them === GitStatusEntry.UpdatedButUnmerged
    )
      return {
        kind: AppFileStatusKind.Conflicted,
        entry: {
          kind: 'conflicted',
          action: UnmergedEntrySummary.DeletedByUs,
          us: GitStatusEntry.Deleted,
          them: GitStatusEntry.UpdatedButUnmerged,
        },
        ...(submoduleStatus ? { submoduleStatus } : {}),
      }
    return {
      kind: AppFileStatusKind.Conflicted,
      entry: {
        kind: 'conflicted',
        action: UnmergedEntrySummary.BothDeleted,
        us: GitStatusEntry.Deleted,
        them: GitStatusEntry.Deleted,
      },
      ...(submoduleStatus ? { submoduleStatus } : {}),
    }
  }
  switch (file.status.kind) {
    case AppFileStatusKind.New:
      return {
        kind: AppFileStatusKind.New,
        ...(submoduleStatus ? { submoduleStatus } : {}),
      }
    case AppFileStatusKind.Deleted:
      return {
        kind: AppFileStatusKind.Deleted,
        ...(submoduleStatus ? { submoduleStatus } : {}),
      }
    case AppFileStatusKind.Renamed:
      return {
        kind: AppFileStatusKind.Renamed,
        oldPath: file.oldPath || file.path,
        renameIncludesModifications: false,
        ...(submoduleStatus ? { submoduleStatus } : {}),
      }
    case AppFileStatusKind.Copied:
      return {
        kind: AppFileStatusKind.Copied,
        oldPath: file.oldPath || file.path,
        renameIncludesModifications: false,
        ...(submoduleStatus ? { submoduleStatus } : {}),
      }
    case AppFileStatusKind.Untracked:
      return {
        kind: AppFileStatusKind.Untracked,
        ...(submoduleStatus ? { submoduleStatus } : {}),
      }
    default:
      return {
        kind: AppFileStatusKind.Modified,
        ...(submoduleStatus ? { submoduleStatus } : {}),
      }
  }
}

function getDesktopWorkingDirectoryFile(
  file: WebFile,
  selection = DiffSelection.fromInitialSelection(DiffSelectionType.All)
) {
  return new WorkingDirectoryFileChange(
    file.path,
    getDesktopFileStatus(file),
    selection
  )
}

function getDesktopRepository(path: string) {
  return new Repository(path, 0, null, false)
}

function decodeBase64(value: string): ArrayBuffer {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++)
    bytes[index] = binary.charCodeAt(index)
  return bytes.buffer
}

function getDesktopDiff(webDiff: WebDiff | null): IDiff | null {
  if (!webDiff) return null
  if (webDiff.image) {
    return {
      kind: DiffType.Image,
      previous: webDiff.image.previous
        ? {
            rawContents: decodeBase64(webDiff.image.previous.contents),
            ...webDiff.image.previous,
          }
        : undefined,
      current: webDiff.image.current
        ? {
            rawContents: decodeBase64(webDiff.image.current.contents),
            ...webDiff.image.current,
          }
        : undefined,
    }
  }
  const patch = webDiff.patch
  if (!patch) return null

  const parsed = new DiffParser().parse(patch)
  if (parsed.isBinary) return { kind: DiffType.Binary }

  return {
    kind: DiffType.Text,
    text: parsed.contents,
    hunks: parsed.hunks,
    maxLineNumber: parsed.maxLineNumber,
    hasHiddenBidiChars: parsed.hasHiddenBidiChars,
  }
}

function getDesktopSubmoduleDiff(
  file: WebFile,
  diff: WebApplicationState['diff']
): IDiff | null {
  const status = file.status.submoduleStatus
  if (!status || !diff?.fullPath) return null
  return {
    kind: DiffType.Submodule,
    fullPath: diff.fullPath,
    path: file.path,
    url: diff.submoduleUrl || null,
    status,
    oldSHA: diff.patch.match(/^-Subproject commit ([0-9a-f]+)/m)?.[1] || null,
    newSHA: diff.patch.match(/^\+Subproject commit ([0-9a-f]+)/m)?.[1] || null,
  }
}

function getDesktopCommit(commit: WebApplicationState['history'][number]) {
  const authorDate = new Date(commit.author.date)
  const committerDate = new Date(commit.committer.date)
  const author = new CommitIdentity(
    commit.author.name,
    commit.author.email,
    Number.isNaN(authorDate.valueOf()) ? new Date() : authorDate,
    commit.author.tzOffset
  )
  const committer = new CommitIdentity(
    commit.committer.name,
    commit.committer.email,
    Number.isNaN(committerDate.valueOf()) ? new Date() : committerDate,
    commit.committer.tzOffset
  )
  return new Commit(
    commit.sha,
    commit.shortSha,
    commit.summary,
    commit.body,
    author,
    committer,
    commit.parentSHAs,
    commit.trailers,
    commit.tags
  )
}

function getDesktopBranch(branch: WebBranch | null | undefined): Branch | null {
  if (!branch || !branch.tip?.sha || !branch.ref) return null

  return new Branch(
    branch.name,
    branch.upstream,
    {
      sha: branch.tip.sha,
      author: {
        date: new Date(branch.tip.author?.date || 0),
      },
    },
    branch.type === 'Remote' ? BranchType.Remote : BranchType.Local,
    branch.ref,
    branch.isGone === true
  )
}

function DesktopCommitGraphSidebar(props: {
  readonly state: WebApplicationState
  readonly dispatcher: WebDispatcher
  readonly selectedSHAs: ReadonlyArray<string>
  readonly onSelectedSHAsChanged: (shas: ReadonlyArray<string>) => void
  readonly preferAbsoluteDates: boolean
  readonly showConventionalCommitBadges: boolean
  readonly onUndoCommit: (commit: Commit) => void
  readonly onResetToCommit: (commit: Commit) => void
  readonly onRevertCommit: (commit: Commit) => void
  readonly onAmendCommit: (commit: Commit) => void
  readonly onCreateBranch: (commit: Commit) => void
  readonly onCreateTag: (commit: Commit) => void
  readonly onCheckoutCommit: (commit: Commit) => void
  readonly onDeleteTag: (name: string) => void
  readonly onCherryPick: (commits: ReadonlyArray<Commit>) => void
  readonly onCommitMessagePopup: (popup: CommitMessagePopup | null) => void
  readonly onHistoryRewriteStarted: (
    kind: HistoryRewriteKind,
    count: number
  ) => void
}) {
  const compareScrollStorageKey = repositoryViewStorageKey(
    webCompareScrollStorageKey,
    props.state.selectedRepositoryPath
  )
  const [compareListScrollTop, setCompareListScrollTop] = React.useState(() =>
    Number(localStorage.getItem(compareScrollStorageKey) || 0)
  )
  React.useEffect(() => {
    setCompareListScrollTop(
      Number(localStorage.getItem(compareScrollStorageKey) || 0)
    )
  }, [compareScrollStorageKey])
  const webBranches = props.state.branches?.branches || []
  const branches = React.useMemo(
    () =>
      webBranches
        .map(getDesktopBranch)
        .filter((branch): branch is Branch => branch !== null)
        .filter(branch => !branch.name.endsWith('/HEAD')),
    [webBranches]
  )
  const commits = React.useMemo(
    () => props.state.history.map(getDesktopCommit),
    [props.state.history]
  )
  const commitLookup = React.useMemo(
    () => new Map(commits.map(commit => [commit.sha, commit])),
    [commits]
  )
  const historySHAs = React.useMemo(
    () => commits.map(commit => commit.sha),
    [commits]
  )
  const currentBranch = React.useMemo(
    () => getDesktopBranch(props.state.branches?.branch),
    [props.state.branches?.branch]
  )
  const localTags = React.useMemo(
    () =>
      new Map(
        (props.state.branches?.tags || []).map(tag => [tag.name, tag.sha])
      ),
    [props.state.branches?.tags]
  )
  const repository = React.useMemo(
    () => getDesktopRepository(props.state.selectedRepositoryPath || ''),
    [props.state.selectedRepositoryPath]
  )
  const [branchListWidth, setBranchListWidth] = React.useState(() =>
    getNumber('desktop-plus-web-commit-graph-branch-list-width', 180)
  )
  const hiddenRefs = props.state.historyGraphHiddenRefs
  const visibleRefs = React.useMemo(
    () => [
      ...branches
        .filter(branch => !hiddenRefs.includes(branch.ref))
        .map(branch => branch.ref),
      ...Array.from(localTags.keys())
        .map(name => `refs/tags/${name}`)
        .filter(ref => !hiddenRefs.includes(ref)),
    ],
    [branches, hiddenRefs, localTags]
  )
  const desktopDispatcher = React.useMemo(
    () =>
      ({
        changeCommitSelection: (
          _repository: Repository,
          shas: ReadonlyArray<string>
        ) => {
          props.onSelectedSHAsChanged(shas)
          if (shas.length === 1)
            void props.dispatcher.inspectHistoryCommit(shas[0])
          else props.dispatcher.clearHistoryInspection()
        },
        checkoutBranch: (
          _repository: Repository,
          branch: Branch
        ): Promise<Repository> => {
          void props.dispatcher.runOperation('checkout', {
            values: [branch.name],
          })
          return Promise.resolve(repository)
        },
        checkoutCommit: (_repository: Repository, commit: Commit) => {
          props.onCheckoutCommit(commit)
          return Promise.resolve(repository)
        },
        closePopup: () => props.onCommitMessagePopup(null),
        clearDragElement: () => undefined,
        commitGraph_load: () => props.dispatcher.setHistoryGraphMode(true),
        commitGraph_loadNextCommitBatch: () =>
          props.dispatcher.loadMoreHistory(),
        commitGraph_resetBranchListWidth: () => {
          setBranchListWidth(180)
          localStorage.removeItem(
            'desktop-plus-web-commit-graph-branch-list-width'
          )
          return Promise.resolve()
        },
        commitGraph_setBranchListWidth: (width: number) => {
          const normalized = Math.min(400, Math.max(120, width))
          setBranchListWidth(normalized)
          setNumber(
            'desktop-plus-web-commit-graph-branch-list-width',
            normalized
          )
          return Promise.resolve()
        },
        commitGraph_setCollapsedBranchGroups: (
          _repository: Repository,
          groups: ReadonlyArray<string>
        ) => props.dispatcher.setHistoryGraphCollapsedGroups(groups),
        commitGraph_setHiddenBranchRefs: (
          _repository: Repository,
          refs: ReadonlyArray<string>
        ) => props.dispatcher.setHistoryGraphHiddenRefs(refs),
        initializeCompare: () => Promise.resolve(),
        loadChangedFilesForCurrentSelection: () => Promise.resolve(),
        loadNextCommitBatch: () => props.dispatcher.loadMoreHistory(),
        recordSquashInvoked: () => undefined,
        reorderCommits: (
          _repository: Repository,
          commitsToReorder: ReadonlyArray<Commit>,
          beforeCommit: Commit | null,
          lastRetainedCommitRef: string | null
        ) => {
          props.onHistoryRewriteStarted('reorder', commitsToReorder.length)
          return props.dispatcher
            .runOperation('reorder-commits', {
              base: lastRetainedCommitRef,
              commits: commitsToReorder.map(commit => commit.sha),
              before: beforeCommit?.sha || null,
            })
            .then(() => props.onSelectedSHAsChanged([]))
        },
        resetToCommit: (_repository: Repository, commit: Commit) =>
          props.onResetToCommit(commit),
        setCommitSearchQuery: async (_repository: Repository, text: string) => {
          await props.dispatcher.setHistoryGraphMode(false)
          await props.dispatcher.setHistoryFilterText(text)
        },
        setDragElement: () => undefined,
        showCreateTagDialog: (_repository: Repository, sha: string) =>
          props.onCreateTag(commitLookup.get(sha) || commits[0]!),
        showDeleteTagDialog: (_repository: Repository, tagName: string) =>
          props.onDeleteTag(tagName),
        showPopup: (popup: Popup) => {
          if (popup.type === PopupType.CreateBranch && popup.targetCommit) {
            const commit = commitLookup.get(popup.targetCommit.sha)
            if (commit) props.onCreateBranch(commit)
          } else if (
            popup.type === PopupType.ConfirmCheckoutCommit &&
            popup.commit
          ) {
            const commit = commitLookup.get(popup.commit.sha)
            if (commit) props.onCheckoutCommit(commit)
          } else if (
            popup.type === PopupType.ConfirmDeletePushedTag &&
            popup.tagName
          )
            props.onDeleteTag(popup.tagName)
          else if (popup.type === PopupType.CommitMessage)
            props.onCommitMessagePopup(popup)
          return Promise.resolve()
        },
        squash: (
          _repository: Repository,
          toSquash: ReadonlyArray<Commit>,
          squashOnto: Commit,
          lastRetainedCommitRef: string | null,
          context: ICommitContext
        ) => {
          props.onHistoryRewriteStarted('squash', toSquash.length + 1)
          return props.dispatcher
            .runOperation('squash-commits', {
              base: lastRetainedCommitRef,
              commits: toSquash.map(commit => commit.sha),
              squashOnto: squashOnto.sha,
              message: formatCommitContextMessage(context),
              noVerify: props.state.commitOptions.noVerify,
            })
            .then(() => props.onSelectedSHAsChanged([]))
        },
        undoCommit: (_repository: Repository, commit: Commit) =>
          props.onUndoCommit(commit),
        updateCompareForm: (
          _repository: Repository,
          update: { readonly commitSearchQuery?: string }
        ) => {
          if (update.commitSearchQuery !== undefined)
            void props.dispatcher.setHistoryFilterText(update.commitSearchQuery)
        },
      } as unknown as Dispatcher),
    [
      commitLookup,
      commits,
      props.dispatcher,
      props.onAmendCommit,
      props.onCheckoutCommit,
      props.onCommitMessagePopup,
      props.onCreateBranch,
      props.onCreateTag,
      props.onDeleteTag,
      props.onHistoryRewriteStarted,
      props.onResetToCommit,
      props.onSelectedSHAsChanged,
      props.onUndoCommit,
      props.state.commitOptions.noVerify,
      repository,
    ]
  )
  const compareState: ICompareState = {
    formState: { kind: HistoryTabMode.History },
    mergeStatus: null,
    showBranchList: false,
    filterText: '',
    commitSearchQuery: props.state.historyFilterText,
    tip: props.state.branches?.branch?.tip?.sha || null,
    allHistoryCommitSHAs: historySHAs,
    commitGraphCommitSHAs: historySHAs,
    commitGraphCollapsedBranchGroups: props.state.historyGraphCollapsedGroups,
    commitGraphHiddenBranchRefs: hiddenRefs,
    commitGraphRefs: visibleRefs,
    filteredHistoryCommitSHAs: historySHAs,
    compareCommitSHAs: [],
    shasToHighlight: [],
    branches,
    recentBranches: branches.filter(
      branch =>
        branch.type === BranchType.Local &&
        (props.state.branches?.recentBranches || []).includes(branch.name)
    ),
    defaultBranch:
      branches.find(
        branch =>
          branch.type === BranchType.Local &&
          branch.name === props.state.branches?.defaultBranch
      ) || null,
  }

  return (
    <CommitGraphSidebar
      accounts={[]}
      allBranches={branches}
      askForConfirmationOnCheckoutCommit={true}
      commitGraphBranchListWidth={{
        value: branchListWidth,
        min: 120,
        max: 400,
      }}
      commitLookup={commitLookup}
      commitRowHeight={50}
      compareState={compareState}
      currentBranch={currentBranch}
      currentTipSha={props.state.branches?.branch?.tip?.sha || null}
      dispatcher={desktopDispatcher}
      emoji={props.state.emoji}
      isLocalRepository={(props.state.branches?.remotes?.length || 0) === 0}
      isMultiCommitOperationInProgress={
        props.state.operationTask?.status === 'running'
      }
      localCommitSHAs={props.state.branches?.localCommitSHAs || []}
      localTags={localTags}
      onAmendCommit={commit => props.onAmendCommit(commit)}
      onCherryPick={(_repository, commitLines) =>
        props.onCherryPick(
          commitLines.flatMap(commit => {
            const selected = commitLookup.get(commit.sha)
            return selected ? [selected] : []
          })
        )
      }
      onCompareListScrolled={scrollTop => {
        localStorage.setItem(compareScrollStorageKey, String(scrollTop))
        setCompareListScrollTop(scrollTop)
      }}
      compareListScrollTop={compareListScrollTop}
      onRevertCommit={commit => props.onRevertCommit(commit)}
      onViewCommitOnGitHub={() => undefined}
      repository={repository}
      selectedCommitShas={props.selectedSHAs}
      shasToHighlight={[]}
      showConventionalCommitBadges={props.showConventionalCommitBadges}
      preferAbsoluteDates={props.preferAbsoluteDates}
      tagsToPush={props.state.branches?.tagsToPush || []}
    />
  )
}

function getDesktopCommittedFile(
  file: WebFile,
  commit: WebApplicationState['history'][number]
) {
  return new CommittedFileChange(
    file.path,
    getDesktopFileStatus(file),
    commit.sha,
    commit.parentSHAs[0] || `${commit.sha}^`
  )
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

function DesktopOperationAuthPrompt(props: {
  readonly task: WebOperationTask | null
  readonly dispatcher: WebDispatcher
}) {
  const task = props.task
  const prompt = task?.authPrompt
  if (!prompt || !task) return null
  const respond = (response: string, remember = false) =>
    void props.dispatcher.respondOperationAuth(task.id, response, remember)

  return (
    <DialogStackContext.Provider value={{ isTopMost: true }}>
      {prompt.type === 'host' ? (
        <AddSSHHost
          fingerprint={prompt.fingerprint}
          host={prompt.host}
          ip={prompt.ip}
          keyType={prompt.keyType}
          onDismissed={() => undefined}
          onSubmit={addHost => respond(addHost ? 'yes' : 'no')}
        />
      ) : prompt.type === 'passphrase' ? (
        <SSHKeyPassphrase
          keyPath={prompt.keyPath}
          onDismissed={() => undefined}
          onSubmit={(passphrase, remember) =>
            respond(passphrase || '', remember)
          }
        />
      ) : (
        <SSHUserPassword
          onDismissed={() => undefined}
          onSubmit={(password, remember) => respond(password || '', remember)}
          username={prompt.username}
        />
      )}
    </DialogStackContext.Provider>
  )
}

function DesktopRepositorySettingsDialog(props: {
  readonly repository: WebApplicationState['repositories'][number]
  readonly branches: WebBranches | null
  readonly dispatcher: WebDispatcher
  readonly onDismissed: () => void
  readonly onManageRemotes: () => void
}) {
  const repository = React.useMemo(() => {
    const value = getDesktopRepository(props.repository.path)
    Object.assign(value, {
      _url: props.repository.remoteURL || null,
      workflowPreferences: {
        updateBranchStrategy: getStoredUpdateBranchStrategy(
          props.repository.path
        ),
      },
    })
    return value
  }, [props.repository.path, props.repository.remoteURL])
  const remote = React.useMemo<IRemote | null>(() => {
    const origin =
      props.branches?.remotes?.find(remote => remote.name === 'origin') ||
      props.branches?.remotes?.[0]
    return origin ? { name: origin.name, url: origin.url } : null
  }, [props.branches?.remotes])
  const desktopDispatcher = React.useMemo(
    () =>
      ({
        openInBrowser: (url: string) => props.dispatcher.openExternal(url),
        setRemoteURL: (_repository: Repository, name: string, url: string) =>
          props.dispatcher.runOperationOrThrow('remote-set-url', {
            values: [name, url],
          }),
        updateRepositoryDefaultBranch: (
          _repository: Repository,
          branch: string
        ) => props.dispatcher.setRepositoryDefaultBranch(branch),
        saveGitIgnore: (_repository: Repository, text: string) =>
          props.dispatcher.saveGitIgnore(text),
        updateRepositoryAccount: () => Promise.resolve(),
        updateRepositoryWorkflowPreferences: (
          _repository: Repository,
          preferences: { readonly updateBranchStrategy?: string }
        ) => {
          setStoredUpdateBranchStrategy(
            props.repository.path,
            preferences.updateBranchStrategy || 'merge'
          )
          return Promise.resolve()
        },
        refreshAuthor: () => props.dispatcher.loadGitIdentity(),
        updateRepositoryEditorOverride: () => Promise.resolve(),
        showPopup: (popup: { readonly type: PopupType }) => {
          if (popup.type === PopupType.ManageRemotes) props.onManageRemotes()
          return Promise.resolve()
        },
      } as unknown as Dispatcher),
    [props.dispatcher, props.onManageRemotes]
  )

  return (
    <DialogStackContext.Provider value={{ isTopMost: true }}>
      <RepositorySettings
        initialSelectedTab={RepositorySettingsTab.Remote}
        remote={remote}
        dispatcher={desktopDispatcher}
        repository={repository}
        repositoryAccount={null}
        accounts={[]}
        onDismissed={props.onDismissed}
      />
    </DialogStackContext.Provider>
  )
}

function DesktopAppError(props: {
  readonly state: WebApplicationState
  readonly dispatcher: WebDispatcher
}) {
  const hookFailure = props.state.hookFailure
  const error = React.useMemo(
    () => (props.state.error ? new Error(props.state.error) : null),
    [props.state.error]
  )
  if (!error) return null

  const remoteURL =
    props.state.repositories.find(
      repository => repository.path === props.state.selectedRepositoryPath
    )?.remoteURL ||
    props.state.branches?.remotes?.find(remote => remote.name === 'origin')
      ?.url ||
    null
  const needsWebCredentials =
    (props.state.errorCode === 'authentication-required' ||
      props.state.errorCode === 'credential-helper-failed') &&
    Boolean(remoteURL && /^https?:\/\//i.test(remoteURL))

  return (
    <DialogStackContext.Provider value={{ isTopMost: true }}>
      {needsWebCredentials && remoteURL ? (
        <GenericGitAuthentication
          remoteUrl={remoteURL}
          onDismiss={() => props.dispatcher.dismissError()}
          onSave={(username, password) =>
            void props.dispatcher.retryLastActionWithCredentials(
              username,
              password
            )
          }
        />
      ) : hookFailure ? (
        <HookFailed
          hookName={hookFailure.hookName}
          onDismissed={() => props.dispatcher.dismissError()}
          resolve={result => {
            if (result === 'ignore') void props.dispatcher.retryLastAction()
          }}
          terminalOutput={hookFailure.terminalOutput}
        />
      ) : (
        <AppError
          error={error}
          onDismissed={() => props.dispatcher.dismissError()}
          onRetryAction={() => void props.dispatcher.retryLastAction()}
          onShowPopup={() => undefined}
        />
      )}
    </DialogStackContext.Provider>
  )
}

function DesktopCommitProgressDialog(props: {
  readonly output: string
  readonly onDismissed: () => void
}) {
  const output = React.useRef(props.output)
  const listeners = React.useRef(
    new Set<Parameters<TerminalOutputListener>[0]>()
  )

  React.useEffect(() => {
    const previous = output.current
    output.current = props.output
    const chunk = props.output.startsWith(previous)
      ? props.output.slice(previous.length)
      : props.output
    if (!chunk) return
    for (const listener of listeners.current) listener(chunk)
  }, [props.output])

  const subscribeToCommitOutput = React.useCallback<TerminalOutputListener>(
    listener => {
      if (output.current) listener(output.current)
      listeners.current.add(listener)
      return { unsubscribe: () => listeners.current.delete(listener) }
    },
    []
  )

  return (
    <DialogStackContext.Provider value={{ isTopMost: true }}>
      <CommitProgress
        onDismissed={props.onDismissed}
        subscribeToCommitOutput={subscribeToCommitOutput}
      />
    </DialogStackContext.Provider>
  )
}

function DesktopAppChrome(props: {
  readonly children: React.ReactNode
  readonly theme: ApplicationTheme
  readonly tabSize: number
  readonly diffFontSize: number
  readonly diffFontFamily: DiffFontFamily
}) {
  return (
    <FocusedAppChrome
      diffFontFamily={props.diffFontFamily}
      diffFontSize={props.diffFontSize}
      tabSize={props.tabSize}
      theme={props.theme}
    >
      <AppContents>{props.children}</AppContents>
    </FocusedAppChrome>
  )
}

function DesktopAddExistingRepositoryDialog(props: {
  readonly dispatcher: WebDispatcher
  readonly onDismiss: () => void
  readonly onCreateRepository: (path: string) => void
}) {
  const desktopDispatcher = React.useMemo(
    () =>
      ({
        addRepositories: async (paths: ReadonlyArray<string>) => {
          const repositories: Repository[] = []
          for (const path of paths) {
            const inspection = await props.dispatcher.inspectRepository(path)
            await props.dispatcher.addRepository(path)
            repositories.push(
              getDesktopRepository(
                inspection.kind === 'regular' ? inspection.repositoryPath : path
              )
            )
          }
          return repositories
        },
        closeFoldout: () => Promise.resolve(),
        recordAddExistingRepository: () => undefined,
        selectRepository: (repository: Repository) =>
          props.dispatcher.selectRepository(repository.path),
        showPopup: (popup: { readonly type: PopupType; path?: string }) => {
          if (popup.type === PopupType.CreateRepository && popup.path)
            props.onCreateRepository(popup.path)
          return Promise.resolve()
        },
      } as unknown as Dispatcher),
    [props]
  )

  return (
    <DialogStackContext.Provider value={{ isTopMost: true }}>
      <AddExistingRepository
        dispatcher={desktopDispatcher}
        onDismissed={props.onDismiss}
      />
    </DialogStackContext.Provider>
  )
}

function DesktopRelocateRepositoryDialog(props: {
  readonly oldPath: string
  readonly dispatcher: WebDispatcher
  readonly onDismiss: () => void
}) {
  const desktopDispatcher = React.useMemo(
    () =>
      ({
        addRepositories: async (paths: ReadonlyArray<string>) => {
          const path = paths[0]
          if (!path) return []
          await props.dispatcher.relocateRepository(props.oldPath, path)
          return [getDesktopRepository(path)]
        },
        closeFoldout: () => Promise.resolve(),
        recordAddExistingRepository: () => undefined,
        selectRepository: (repository: Repository) =>
          props.dispatcher.selectRepository(repository.path),
        showPopup: () => Promise.resolve(),
      } as unknown as Dispatcher),
    [props.dispatcher, props.oldPath]
  )

  return (
    <DialogStackContext.Provider value={{ isTopMost: true }}>
      <AddExistingRepository
        dispatcher={desktopDispatcher}
        onDismissed={props.onDismiss}
      />
    </DialogStackContext.Provider>
  )
}

function DesktopCloneRepositoryDialog(props: {
  readonly dispatcher: WebDispatcher
  readonly initialURL: string
  readonly onDismiss: () => void
}) {
  const [selectedTab, setSelectedTab] = React.useState(
    CloneRepositoryTab.Generic
  )
  const desktopDispatcher = React.useMemo(
    () =>
      ({
        clone: async (
          url: string,
          path: string,
          _login: string | null,
          options?: { readonly defaultBranch?: string }
        ) => {
          await props.dispatcher.cloneRepository(
            url,
            path,
            options?.defaultBranch
          )
          return getDesktopRepository(path)
        },
        closeFoldout: () => Promise.resolve(),
      } as unknown as Dispatcher),
    [props.dispatcher]
  )

  return (
    <DialogStackContext.Provider value={{ isTopMost: true }}>
      <CloneRepository
        accounts={[]}
        apiRepositories={new Map()}
        dispatcher={desktopDispatcher}
        initialURL={props.initialURL || null}
        isTopMost={true}
        onDismissed={props.onDismiss}
        onRefreshRepositories={() => undefined}
        onTabSelected={setSelectedTab}
        selectedTab={selectedTab}
      />
    </DialogStackContext.Provider>
  )
}

function DesktopCreateRepositoryDialog(props: {
  readonly dispatcher: WebDispatcher
  readonly initialPath?: string
  readonly onDismiss: () => void
  readonly onAddRepository: (path: string) => void
}) {
  const desktopDispatcher = React.useMemo(
    () =>
      ({
        addRepositories: async (paths: ReadonlyArray<string>) => {
          const repositories: Repository[] = []
          for (const path of paths) {
            await props.dispatcher.addRepository(path)
            repositories.push(getDesktopRepository(path))
          }
          return repositories
        },
        closeFoldout: () => Promise.resolve(),
        postError: () => Promise.resolve(),
        recordCreateRepository: () => undefined,
        selectRepository: (repository: Repository) =>
          props.dispatcher.selectRepository(repository.path),
        showPopup: (popup: { readonly type: PopupType; path?: string }) => {
          if (popup.type === PopupType.AddRepository && popup.path)
            props.onAddRepository(popup.path)
          return Promise.resolve()
        },
      } as unknown as Dispatcher),
    [props]
  )

  return (
    <DialogStackContext.Provider value={{ isTopMost: true }}>
      <CreateRepository
        dispatcher={desktopDispatcher}
        initialPath={props.initialPath}
        isTopMost={true}
        onDismissed={props.onDismiss}
      />
    </DialogStackContext.Provider>
  )
}

function DesktopHome(props: {
  readonly dispatcher: WebDispatcher
  readonly onOpenRepositoryDialog: () => void
  readonly onOpenCloneDialog: (url?: string) => void
  readonly onOpenInitDialog: () => void
  readonly diffPreferences: WebDiffPresentationPreferences
}) {
  return (
    <DesktopAppChrome
      diffFontFamily={props.diffPreferences.diffFontFamily}
      diffFontSize={props.diffPreferences.diffFontSize}
      tabSize={props.diffPreferences.tabSize}
      theme={props.diffPreferences.theme}
    >
      <NoRepositoriesView
        accounts={[]}
        apiRepositories={new Map()}
        onAdd={props.onOpenRepositoryDialog}
        onClone={props.onOpenCloneDialog}
        onCreate={props.onOpenInitDialog}
        onCreateTutorialRepository={() => undefined}
        onRefreshRepositories={() => undefined}
        onResumeTutorialRepository={() => undefined}
        tutorialPaused={false}
      />
    </DesktopAppChrome>
  )
}

function DesktopTutorialPanel(props: {
  readonly state: WebApplicationState
  readonly dispatcher: WebDispatcher
  readonly editorIntegration: WebIntegrationSelection
}) {
  const path = props.state.tutorialRepositoryPath
  if (
    !path ||
    props.state.currentTutorialStep === TutorialStep.NotApplicable ||
    props.state.currentTutorialStep === TutorialStep.Paused
  )
    return null
  const repository = getDesktopRepository(path)
  const readmePath = `${path.replace(/[\\/]+$/, '')}/README.md`
  const resolvedExternalEditor =
    props.editorIntegration.name || props.editorIntegration.custom?.path || null
  const desktopDispatcher = {
    createPullRequest: () => undefined,
    markPullRequestTutorialStepAsComplete: () => undefined,
    openInExternalEditor: () =>
      props.dispatcher.openIntegration(
        'editor',
        readmePath,
        props.editorIntegration
      ),
    showPopup: () => Promise.resolve(),
    skipPickEditorTutorialStep: () => undefined,
  } as unknown as Dispatcher

  return (
    <TutorialPanel
      currentTutorialStep={props.state.currentTutorialStep}
      dispatcher={desktopDispatcher}
      onExitTutorial={() => void props.dispatcher.pauseTutorial()}
      repository={repository}
      resolvedExternalEditor={resolvedExternalEditor}
    />
  )
}

function DesktopRepositoryPicker(props: {
  readonly repositories: ReadonlyArray<
    WebApplicationState['repositories'][number]
  >
  readonly selectedRepositoryPath: string | null
  readonly onSelect: (path: string) => void
  readonly onAdd: () => void
  readonly onCreate: () => void
  readonly onClone: () => void
  readonly onRemove: (path: string) => void
  readonly onEdit: (
    repository: WebApplicationState['repositories'][number]
  ) => void
  readonly showBranchName: 'never' | 'always' | 'non-default'
  readonly showWorktrees: boolean
  readonly onCopyPath: (path: string) => void
  readonly onOpenPath: (path: string, reveal?: boolean) => void
  readonly onOpenExternal: (url: string) => void
  readonly onOpenNewWindow: (path: string) => void
  readonly onPullAll: () => void
  readonly onCreateGroup: (paths: ReadonlyArray<string>) => void
  readonly recentRepositoriesCount: number
  readonly branches: ReadonlyArray<WebBranch>
  readonly confirmWorktreeRemoval: boolean
  readonly onConfirmWorktreeRemovalChanged: (value: boolean) => void
  readonly dispatcher: WebDispatcher
}) {
  const [filterText, setFilterText] = React.useState('')
  const [worktreeToAdd, setWorktreeToAdd] = React.useState<Repository | null>(
    null
  )
  const [worktreeToRename, setWorktreeToRename] = React.useState<{
    readonly repository: Repository
    readonly path: string
  } | null>(null)
  const [worktreeToDelete, setWorktreeToDelete] = React.useState<{
    readonly repository: Repository
    readonly path: string
  } | null>(null)
  const integrations = useWebIntegrationSelection('editor')
  const shellIntegration = useWebIntegrationSelection('shell')
  const desktopRepositories = React.useMemo(
    () =>
      props.repositories.map((repository, index) => {
        const desktopRepository = new Repository(
          repository.path,
          index + 1,
          null,
          false,
          repository.alias || null,
          repository.group || null,
          repository.defaultBranch
        )
        Object.assign(desktopRepository, { _url: repository.remoteURL || null })
        return desktopRepository
      }),
    [props.repositories]
  )
  const webRepositoryByPath = React.useMemo(
    () =>
      new Map(
        props.repositories.map(repository => [repository.path, repository])
      ),
    [props.repositories]
  )
  const localRepositoryStateLookup = React.useMemo(
    () =>
      new Map(
        desktopRepositories.map(repository => {
          const webRepository = webRepositoryByPath.get(repository.path)
          return [
            repository.id,
            {
              aheadBehind: webRepository?.aheadBehind || null,
              changedFilesCount: webRepository?.changedFilesCount || 0,
              branchName: webRepository?.currentBranch || null,
              defaultBranchName: webRepository?.defaultBranch || null,
              worktrees: props.showWorktrees
                ? webRepository?.worktrees || []
                : [],
            },
          ]
        })
      ),
    [desktopRepositories, props.showWorktrees, webRepositoryByPath]
  )
  const recentRepositories = React.useMemo(
    () =>
      [...desktopRepositories]
        .sort(
          (left, right) =>
            (webRepositoryByPath.get(right.path)?.lastOpenedAt || 0) -
            (webRepositoryByPath.get(left.path)?.lastOpenedAt || 0)
        )
        .slice(0, props.recentRepositoriesCount)
        .map(repository => repository.id),
    [desktopRepositories, props.recentRepositoriesCount, webRepositoryByPath]
  )
  const getWebRepository = React.useCallback(
    (repository: Repository) =>
      webRepositoryByPath.get(repository.path) || null,
    [webRepositoryByPath]
  )
  const desktopBranches = React.useMemo(
    () =>
      props.branches.flatMap(branch => {
        const desktopBranch = getDesktopBranch(branch)
        return desktopBranch ? [desktopBranch] : []
      }),
    [props.branches]
  )
  const runWorktreeOperation = React.useCallback(
    async (
      repository: Repository,
      operation: 'worktree-move' | 'worktree-remove',
      values: ReadonlyArray<string>
    ) => {
      const worktreePath = values[0]
      const mainWorktreePath =
        webRepositoryByPath
          .get(repository.path)
          ?.worktrees?.find(worktree => worktree.type === 'main')?.path || null
      const operationRepositoryPath =
        repository.path === worktreePath && mainWorktreePath
          ? mainWorktreePath
          : repository.path
      await props.dispatcher.selectRepository(operationRepositoryPath)
      await props.dispatcher.runOperationOrThrow(operation, { values })
      if (operation === 'worktree-move' && repository.path === worktreePath) {
        await props.dispatcher.selectRepository(values[1])
        props.dispatcher.removeRepository(worktreePath)
      } else if (operation === 'worktree-remove') {
        props.dispatcher.removeRepository(worktreePath)
      }
    },
    [props.dispatcher, webRepositoryByPath]
  )
  const desktopDispatcher = React.useMemo(
    () =>
      ({
        changeRepositoryAlias: (
          repository: Repository,
          alias: string | null
        ) => {
          const webRepository = getWebRepository(repository)
          if (!webRepository) return Promise.resolve()
          if (alias === null) {
            void props.dispatcher
              .selectRepository(webRepository.path)
              .then(() => {
                props.dispatcher.setRepositoryAlias('')
              })
          } else {
            props.onEdit(webRepository)
          }
          return Promise.resolve()
        },
        changeRepositoryGroupName: (
          repository: Repository,
          group: string | null
        ) => {
          const webRepository = getWebRepository(repository)
          if (webRepository)
            void props.dispatcher
              .selectRepository(webRepository.path)
              .then(() => {
                props.dispatcher.setRepositoryGroup(group)
              })
          return Promise.resolve()
        },
        closeFoldout: () => undefined,
        copyPathToClipboard: props.onCopyPath,
        pullAllRepositories: () => Promise.resolve(props.onPullAll()),
        pullRepositories: (repositories: ReadonlyArray<Repository>) => {
          const groups = new Set<string | null>()
          for (const repository of repositories) {
            const webRepository = getWebRepository(repository)
            if (webRepository) groups.add(webRepository.group || null)
          }
          for (const group of groups)
            void props.dispatcher.pullRepositoryGroup(group)
          return Promise.resolve()
        },
        recordRepoClicked: () => undefined,
        incrementMetric: () => undefined,
        moveWorktree: async (
          repository: Repository,
          worktreePath: string,
          newPath: string
        ) => {
          try {
            await runWorktreeOperation(repository, 'worktree-move', [
              worktreePath,
              newPath,
            ])
            return true
          } catch {
            return false
          }
        },
        postError: () => Promise.resolve(),
        requestDeleteWorktree: (
          repository: Repository,
          worktreePath: string
        ) => {
          if (props.confirmWorktreeRemoval)
            setWorktreeToDelete({ repository, path: worktreePath })
          else
            void runWorktreeOperation(repository, 'worktree-remove', [
              worktreePath,
            ]).catch(() => undefined)
        },
        selectRepository: (repository: Repository) =>
          Promise.resolve(props.onSelect(repository.path)),
        switchWorktree: (
          _repository: Repository,
          worktree: { readonly path: string }
        ) => props.dispatcher.selectRepository(worktree.path),
        showPopup: (popup: {
          readonly type: PopupType
          readonly repository?: Repository
          readonly preselectedRepositoryIds?: ReadonlyArray<number>
          readonly worktreePath?: string
        }) => {
          switch (popup.type) {
            case PopupType.AddRepository:
              props.onAdd()
              break
            case PopupType.CloneRepository:
              props.onClone()
              break
            case PopupType.CreateRepository:
              props.onCreate()
              break
            case PopupType.ChangeRepositoryAlias: {
              if (popup.repository) {
                const webRepository = getWebRepository(popup.repository)
                if (webRepository) props.onEdit(webRepository)
              }
              break
            }
            case PopupType.CreateRepositoryGroup:
              props.onCreateGroup(
                (popup.preselectedRepositoryIds || [])
                  .map(id =>
                    desktopRepositories.find(repository => repository.id === id)
                  )
                  .filter(
                    (repository): repository is Repository =>
                      repository !== undefined
                  )
                  .map(repository => repository.path)
              )
              break
            case PopupType.AddWorktree:
              if (popup.repository) setWorktreeToAdd(popup.repository)
              break
            case PopupType.RenameWorktree:
              if (popup.repository && popup.worktreePath)
                setWorktreeToRename({
                  repository: popup.repository,
                  path: popup.worktreePath,
                })
              break
          }
          return Promise.resolve()
        },
      } as unknown as Dispatcher),
    [desktopRepositories, getWebRepository, props, runWorktreeOperation]
  )

  return (
    <>
      <RepositoriesList
        askForConfirmationOnRemoveRepository={true}
        dispatcher={desktopDispatcher}
        externalEditorLabel={undefined}
        filterText={filterText}
        localRepositoryStateLookup={localRepositoryStateLookup}
        onFilterTextChanged={setFilterText}
        onOpenInExternalEditor={(repository, path) =>
          void props.dispatcher.launchIntegration(
            'editor',
            integrations.name,
            integrations.custom,
            path || repository.path
          )
        }
        onOpenInNewWindow={(repository, path) =>
          props.onOpenNewWindow(path || repository.path)
        }
        onOpenInShell={(repository, path) =>
          void props.dispatcher.launchIntegration(
            'shell',
            shellIntegration.name,
            shellIntegration.custom,
            path || repository.path
          )
        }
        onRemoveRepository={repository => props.onRemove(repository.path)}
        onSelectionChanged={repository => props.onSelect(repository.path)}
        onShowRepository={(repository, path) =>
          void props.onOpenPath(path || repository.path, true)
        }
        onViewOnGitHub={repository => {
          const webRepository =
            repository instanceof Repository
              ? getWebRepository(repository)
              : null
          if (webRepository?.remoteWebURL)
            props.onOpenExternal(webRepository.remoteWebURL)
        }}
        recentRepositories={recentRepositories}
        repositories={desktopRepositories}
        rowHeight={32}
        selectedRepository={
          desktopRepositories.find(
            repository => repository.path === props.selectedRepositoryPath
          ) || null
        }
        shellLabel={undefined}
        showBranchNameInRepoList={
          props.showBranchName === 'always'
            ? ShowBranchNameInRepoListSetting.Always
            : props.showBranchName === 'non-default'
            ? ShowBranchNameInRepoListSetting.WhenNotDefault
            : ShowBranchNameInRepoListSetting.Never
        }
        showWorktrees={false}
        showWorktreesInRepoList={props.showWorktrees}
      />
      {worktreeToAdd ? (
        <DialogStackContext.Provider value={{ isTopMost: true }}>
          <AddWorktreeDialog
            allBranches={desktopBranches}
            dispatcher={desktopDispatcher}
            onDismissed={() => setWorktreeToAdd(null)}
            repository={worktreeToAdd}
          />
        </DialogStackContext.Provider>
      ) : null}
      {worktreeToRename ? (
        <DialogStackContext.Provider value={{ isTopMost: true }}>
          <RenameWorktreeDialog
            dispatcher={desktopDispatcher}
            onDismissed={() => setWorktreeToRename(null)}
            repository={worktreeToRename.repository}
            worktreePath={worktreeToRename.path}
          />
        </DialogStackContext.Provider>
      ) : null}
      {worktreeToDelete ? (
        <DialogStackContext.Provider value={{ isTopMost: true }}>
          <DeleteWorktreeDialog
            askForConfirmationOnWorktreeRemoval={props.confirmWorktreeRemoval}
            onConfirmWorktreeRemovalChanged={
              props.onConfirmWorktreeRemovalChanged
            }
            onDeleteWorktree={(repository, worktreePath) =>
              runWorktreeOperation(repository, 'worktree-remove', [
                worktreePath,
              ])
            }
            onDismissed={() => setWorktreeToDelete(null)}
            repository={worktreeToDelete.repository}
            worktreePath={worktreeToDelete.path}
          />
        </DialogStackContext.Provider>
      ) : null}
    </>
  )
}

function getNetworkProgress(
  operationTask: WebOperationTask | null,
  remoteName: string | null,
  branchName: string | null
): Progress | null {
  if (operationTask?.status !== 'running') return null

  const remote = remoteName || 'origin'
  const value = (operationTask.progress || 0) / 100
  const description = operationTask.phase || 'Contacting remote…'

  switch (operationTask.operation) {
    case 'fetch':
      return {
        kind: 'fetch',
        remote,
        title: `Fetching ${remote}`,
        description,
        value,
      }
    case 'pull':
    case 'reset-upstream':
      return {
        kind: 'pull',
        remote,
        title:
          operationTask.operation === 'pull'
            ? `Pulling ${remote}`
            : `Resetting and pulling ${remote}`,
        description,
        value,
      }
    case 'push':
    case 'publish-branch':
      return {
        kind: 'push',
        remote,
        branch: branchName || 'current branch',
        title: `Pushing ${remote}`,
        description,
        value,
      }
    default:
      return null
  }
}

function DesktopToolbar(props: {
  readonly state: WebApplicationState
  readonly dispatcher: WebDispatcher
  readonly sidebarWidth: number
  readonly onOpenRepositoryDialog: () => void
  readonly onOpenCloneDialog: () => void
  readonly onOpenInitDialog: () => void
  readonly onChangeRepositoryAlias: (
    repository: WebApplicationState['repositories'][number]
  ) => void
  readonly onRemoveRepository: (path: string) => void
  readonly showBranchName: 'never' | 'always' | 'non-default'
  readonly branchSortOrder: BranchSortOrder
  readonly onBranchSortOrderChanged: (value: BranchSortOrder) => void
  readonly isEmbedded: boolean
  readonly showWorktrees: boolean
  readonly showWorktreesInRepositoryList: boolean
  readonly repositoryIndicatorsEnabled: boolean
  readonly recentRepositoriesCount: number
  readonly onCopyPath: (path: string) => void
  readonly onOpenPath: (path: string, reveal?: boolean) => void
  readonly onOpenExternal: (url: string) => void
  readonly onOpenNewWindow: (path: string) => void
  readonly onPullAllRepositories: () => void
  readonly onPullRepositoryGroup: (group: string | null) => void
  readonly onRenameRepositoryGroup: (group: string) => void
  readonly toolbarMenuRequests: {
    readonly createBranch: number
    readonly renameBranch: number
    readonly deleteBranch: number
    readonly discardAllChanges: number
    readonly permanentlyDiscardAllChanges: number
    readonly stashAllChanges: number
    readonly newWorktree: number
    readonly openWithEditor: number
    readonly deleteUnusedLocalBranches: number
    readonly manageRemotes: number
    readonly mergeBranch: number
    readonly squashMergeBranch: number
    readonly rebaseBranch: number
  }
  readonly uncommittedChangesStrategy: UncommittedChangesStrategy
  readonly confirmForcePush: boolean
  readonly confirmWorktreeRemoval: boolean
  readonly onConfirmWorktreeRemovalChanged: (value: boolean) => void
  readonly confirmDiscardChanges: boolean
  readonly onConfirmDiscardChangesChanged: (value: boolean) => void
  readonly underlineLinks: boolean
}) {
  const editorIntegration = useWebIntegrationSelection('editor')
  const shellIntegration = useWebIntegrationSelection('shell')
  const [branchDropdownWidth, setBranchDropdownWidth] = React.useState(() =>
    Math.min(
      webToolbarButtonWidth.max,
      Math.max(
        webToolbarButtonWidth.min,
        getNumber(
          webBranchDropdownWidthStorageKey,
          webToolbarButtonWidth.default
        )
      )
    )
  )
  const [pushPullButtonWidth, setPushPullButtonWidth] = React.useState(() =>
    Math.min(
      webToolbarButtonWidth.max,
      Math.max(
        webToolbarButtonWidth.min,
        getNumber(
          webPushPullButtonWidthStorageKey,
          webToolbarButtonWidth.default
        )
      )
    )
  )
  const [worktreeDropdownWidth, setWorktreeDropdownWidth] = React.useState(() =>
    Math.min(
      webToolbarButtonWidth.max,
      Math.max(
        webToolbarButtonWidth.min,
        getNumber(
          webWorktreeDropdownWidthStorageKey,
          webToolbarButtonWidth.default
        )
      )
    )
  )
  const [worktreeToAdd, setWorktreeToAdd] = React.useState(false)
  const [worktreeToRename, setWorktreeToRename] = React.useState<string | null>(
    null
  )
  const [worktreeToDelete, setWorktreeToDelete] = React.useState<string | null>(
    null
  )
  const [worktreeDeleteFailure, setWorktreeDeleteFailure] = React.useState<{
    readonly path: string
    readonly error: Error
  } | null>(null)
  const updateBranchDropdownWidth = React.useCallback((width: number) => {
    setNumber(webBranchDropdownWidthStorageKey, width)
    setBranchDropdownWidth(width)
  }, [])
  const resetBranchDropdownWidth = React.useCallback(() => {
    localStorage.removeItem(webBranchDropdownWidthStorageKey)
    setBranchDropdownWidth(webToolbarButtonWidth.default)
  }, [])
  const updatePushPullButtonWidth = React.useCallback((width: number) => {
    setNumber(webPushPullButtonWidthStorageKey, width)
    setPushPullButtonWidth(width)
  }, [])
  const resetPushPullButtonWidth = React.useCallback(() => {
    localStorage.removeItem(webPushPullButtonWidthStorageKey)
    setPushPullButtonWidth(webToolbarButtonWidth.default)
  }, [])
  const updateWorktreeDropdownWidth = React.useCallback((width: number) => {
    setNumber(webWorktreeDropdownWidthStorageKey, width)
    setWorktreeDropdownWidth(width)
  }, [])
  const resetWorktreeDropdownWidth = React.useCallback(() => {
    localStorage.removeItem(webWorktreeDropdownWidthStorageKey)
    setWorktreeDropdownWidth(webToolbarButtonWidth.default)
  }, [])
  const [toolbarDropdown, setToolbarDropdown] = React.useState<
    | 'repository'
    | 'worktree'
    | 'branch'
    | 'sync'
    | 'repository-actions'
    | 'branch-actions'
    | null
  >(null)
  const setToolbarDropdownState = React.useCallback(
    (
      dropdown:
        | 'repository'
        | 'worktree'
        | 'branch'
        | 'sync'
        | 'repository-actions'
        | 'branch-actions',
      state: 'open' | 'closed'
    ) => {
      setToolbarDropdown(current =>
        state === 'open' ? dropdown : current === dropdown ? null : current
      )
    },
    []
  )
  const repositoryPickerOpen = toolbarDropdown === 'repository'
  const worktreeDropdownOpen = toolbarDropdown === 'worktree'
  const branchMenuOpen = toolbarDropdown === 'branch'
  const syncMenuOpen = toolbarDropdown === 'sync'
  const repositoryActionsOpen = toolbarDropdown === 'repository-actions'
  const branchActionsOpen = toolbarDropdown === 'branch-actions'
  React.useEffect(() => {
    if (props.state.selectedRepositoryPath !== null) return
    const frame = window.requestAnimationFrame(() =>
      setToolbarDropdownState('repository', 'open')
    )
    return () => window.cancelAnimationFrame(frame)
  }, [props.state.selectedRepositoryPath, setToolbarDropdownState])
  const closeDropdownOnEscape = (
    event: React.KeyboardEvent<HTMLDivElement>,
    close: () => void
  ) => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    close()
  }
  const [branchDialog, setBranchDialog] = React.useState<
    'create' | 'rename' | 'worktree' | null
  >(null)
  const [branchInitialName, setBranchInitialName] = React.useState('')
  const [branchToRename, setBranchToRename] = React.useState<WebBranch | null>(
    null
  )
  const [branchForWorktree, setBranchForWorktree] =
    React.useState<WebBranch | null>(null)
  const [branchToDelete, setBranchToDelete] = React.useState<WebBranch | null>(
    null
  )
  const [deleteUnusedLocalBranchesOpen, setDeleteUnusedLocalBranchesOpen] =
    React.useState(false)
  const [manageRemotesOpen, setManageRemotesOpen] = React.useState(false)
  const [addRemoteOpen, setAddRemoteOpen] = React.useState(false)
  const [openWithEditorOpen, setOpenWithEditorOpen] = React.useState(false)
  const [forcePushOpen, setForcePushOpen] = React.useState(false)
  const [mergeOperation, setMergeOperation] = React.useState<{
    readonly squash: boolean
    readonly initialBranch?: Branch
  } | null>(null)
  const [rebaseDialog, setRebaseDialog] = React.useState<{
    readonly initialBranch?: Branch
  } | null>(null)
  const lastToolbarMenuRequests = React.useRef(props.toolbarMenuRequests)
  const [checkoutTarget, setCheckoutTarget] = React.useState<{
    readonly options: WebOperationOptions
    readonly branch: Branch
  } | null>(null)
  const [discardAllChangesOpen, setDiscardAllChangesOpen] =
    React.useState(false)
  const [discardAllChangesPermanently, setDiscardAllChangesPermanently] =
    React.useState(false)
  const repository =
    props.state.repositories.find(
      item => item.path === props.state.selectedRepositoryPath
    ) || null
  const worktrees = repository?.worktrees || []
  const desktopWorktreeRepository = getDesktopRepository(
    props.state.selectedRepositoryPath || ''
  )
  const defaultBranch =
    repository?.defaultBranch ?? props.state.branches?.defaultBranch ?? null
  const aheadBehind = props.state.branches?.aheadBehind || null
  const remotes = props.state.branches?.remotes || []
  const desktopBranches = React.useMemo(
    () =>
      (props.state.branches?.branches || []).flatMap(branch => {
        const desktopBranch = getDesktopBranch(branch)
        return desktopBranch ? [desktopBranch] : []
      }),
    [props.state.branches?.branches]
  )
  const desktopCurrentBranch = React.useMemo(
    () => getDesktopBranch(props.state.branches?.branch),
    [props.state.branches?.branch]
  )
  const desktopDefaultBranch = React.useMemo(
    () =>
      desktopBranches.find(
        candidate =>
          candidate.type === BranchType.Local &&
          candidate.name === defaultBranch
      ) || null,
    [defaultBranch, desktopBranches]
  )
  const desktopTip: Tip = React.useMemo(
    () =>
      desktopCurrentBranch
        ? { kind: TipState.Valid as const, branch: desktopCurrentBranch }
        : props.state.branches === null
        ? { kind: TipState.Unknown as const }
        : {
            kind: TipState.Detached as const,
            currentSha: desktopBranches[0]?.tip.sha || '',
          },
    [desktopBranches, desktopCurrentBranch, props.state.branches]
  )
  const desktopBranchDialogTip: Exclude<
    Tip,
    { readonly kind: TipState.Unknown }
  > = React.useMemo(
    () =>
      desktopTip.kind === TipState.Unknown
        ? { kind: TipState.Detached as const, currentSha: '' }
        : desktopTip,
    [desktopTip]
  )
  const desktopBranchDialogDispatcher = React.useMemo(
    () =>
      ({
        getBranchNamePresets: () => Promise.resolve([]),
        renameBranch: (
          _repository: Repository,
          targetBranch: Branch,
          nextName: string
        ) =>
          props.dispatcher.runOperation('rename-branch', {
            values: [targetBranch.name, nextName],
          }),
        postError: () => Promise.resolve(),
        incrementMetric: () => undefined,
        switchWorktree: async (
          _repository: Repository,
          worktree: { readonly path: string }
        ) => {
          await props.dispatcher.addRepository(worktree.path)
          await props.dispatcher.selectRepository(worktree.path)
        },
      } as unknown as Dispatcher),
    [props.dispatcher]
  )

  const requestCheckout = (
    options: WebOperationOptions,
    branchToCheckout: Branch
  ) => {
    setToolbarDropdownState('branch', 'closed')
    if ((props.state.status?.workingDirectory.files.length || 0) > 0) {
      if (
        props.uncommittedChangesStrategy ===
        UncommittedChangesStrategy.StashOnCurrentBranch
      ) {
        void props.dispatcher.runOperation('checkout', {
          ...options,
          stashChanges: true,
        })
        return
      }
      if (
        props.uncommittedChangesStrategy ===
        UncommittedChangesStrategy.MoveToNewBranch
      ) {
        void props.dispatcher.runOperation('checkout', {
          ...options,
          moveChanges: true,
        })
        return
      }
      setCheckoutTarget({ branch: branchToCheckout, options })
      return
    }
    void props.dispatcher.runOperation('checkout', options)
  }
  const desktopBranchDropdownDispatcher = React.useMemo(
    () =>
      ({
        changeBranchesTab: () => Promise.resolve(),
        checkoutBranch: (_repository: Repository, candidate: Branch) => {
          const webBranch =
            props.state.branches?.branches?.find(
              item =>
                item.ref === candidate.ref ||
                (item.name === candidate.name &&
                  item.type ===
                    (candidate.type === BranchType.Remote ? 'Remote' : 'Local'))
            ) || null
          if (!webBranch) return Promise.resolve(getDesktopRepository(''))

          const localBranchName =
            webBranch.type === 'Remote'
              ? webBranch.name.split('/').slice(1).join('/')
              : webBranch.name
          const localExists = (props.state.branches?.branches || []).some(
            item => item.type !== 'Remote' && item.name === localBranchName
          )
          requestCheckout(
            {
              values: [localExists ? localBranchName : webBranch.name],
              ...(webBranch.type === 'Remote' && !localExists
                ? { createLocalBranch: localBranchName }
                : {}),
            },
            candidate
          )
          return Promise.resolve(getDesktopRepository(''))
        },
        closeFoldout: () => setToolbarDropdownState('branch', 'closed'),
        fastForwardBranch: (_repository: Repository, candidate: Branch) =>
          props.dispatcher.runOperation('fast-forward', {
            values: [candidate.name],
          }),
        getBranchAheadBehind: () =>
          Promise.resolve(props.state.branches?.aheadBehind || null),
        pull: () => props.dispatcher.runOperation('pull'),
        showPopup: (popup: {
          readonly type: PopupType
          readonly branch?: Branch
          readonly initialName?: string
          readonly initialBranchName?: string
        }) => {
          const webBranch = popup.branch
            ? props.state.branches?.branches?.find(
                candidate =>
                  candidate.ref === popup.branch?.ref ||
                  (candidate.name === popup.branch?.name &&
                    candidate.type ===
                      (popup.branch?.type === BranchType.Remote
                        ? 'Remote'
                        : 'Local'))
              ) || null
            : popup.initialBranchName
            ? props.state.branches?.branches?.find(
                candidate => candidate.name === popup.initialBranchName
              ) || null
            : null

          switch (popup.type) {
            case PopupType.CreateBranch:
              setBranchInitialName(popup.initialName || '')
              setBranchToRename(null)
              setBranchDialog('create')
              break
            case PopupType.RenameBranch:
              if (webBranch) {
                setBranchToRename(webBranch)
                setBranchDialog('rename')
              }
              break
            case PopupType.DeleteBranch:
            case PopupType.DeleteRemoteBranch:
              if (webBranch) setBranchToDelete(webBranch)
              break
            case PopupType.DeleteUnusedLocalBranches:
              setDeleteUnusedLocalBranchesOpen(true)
              break
            case PopupType.AddWorktree:
              if (webBranch) {
                setBranchForWorktree(webBranch)
                setBranchDialog('worktree')
              }
              break
            case PopupType.ManageRemotes:
              setToolbarDropdownState('branch', 'closed')
              setManageRemotesOpen(true)
              break
          }
          return Promise.resolve()
        },
        startCherryPickWithBranch: () => undefined,
        startMergeBranchOperation: (
          _repository: Repository,
          squash = false,
          initialBranch?: Branch | null
        ) => {
          setToolbarDropdownState('branch', 'closed')
          setMergeOperation({
            squash,
            ...(initialBranch ? { initialBranch } : {}),
          })
        },
        updateRepositoryDefaultBranch: (
          _repository: Repository,
          nextDefaultBranch: string
        ) => props.dispatcher.setRepositoryDefaultBranch(nextDefaultBranch),
        setBranchDropdownWidth: updateBranchDropdownWidth,
        resetBranchDropdownWidth,
      } as unknown as Dispatcher),
    [
      props.dispatcher,
      props.state.branches,
      resetBranchDropdownWidth,
      setToolbarDropdownState,
      updateBranchDropdownWidth,
    ]
  )
  const desktopBranchDropdownState = React.useMemo(
    () =>
      ({
        branchesState: {
          allBranches: desktopBranches,
          currentPullRequest: null,
          defaultBranch: desktopDefaultBranch,
          forcePushBranches: new Map(),
          isLoadingPullRequests: false,
          openPullRequests: [],
          pullWithRebase: props.state.branches?.pullWithRebase,
          recentBranches: desktopBranches.filter(
            candidate =>
              candidate.type === BranchType.Local &&
              (props.state.branches?.recentBranches || []).includes(
                candidate.name
              )
          ),
          tip: desktopTip,
          upstreamDefaultBranch: null,
        },
        changesState: { conflictState: null },
        checkoutProgress: null,
        worktrees,
      } as unknown as IRepositoryState),
    [
      desktopBranches,
      desktopDefaultBranch,
      desktopTip,
      props.state.branches?.pullWithRebase,
      props.state.branches?.recentBranches,
    ]
  )
  const remoteName =
    desktopCurrentBranch?.upstreamRemoteName || remotes[0]?.name || null
  const lastFetched = props.state.branches?.lastFetched
    ? new Date(props.state.branches.lastFetched)
    : null
  const networkProgress = getNetworkProgress(
    props.state.operationTask,
    remoteName,
    desktopCurrentBranch?.name || null
  )
  const forcePushBranchState = getCurrentBranchForcePushState(
    desktopBranchDropdownState.branchesState,
    aheadBehind
  )
  const pushCurrentBranch = React.useCallback(() => {
    if (aheadBehind === null && desktopCurrentBranch && remoteName) {
      return props.dispatcher.runOperation('publish-branch', {
        values: [remoteName, desktopCurrentBranch.name],
      })
    }
    return props.dispatcher.runOperation('push')
  }, [aheadBehind, desktopCurrentBranch, props.dispatcher, remoteName])
  const desktopPushPullDispatcher = React.useMemo(
    () =>
      ({
        closeFoldout: () => setToolbarDropdownState('sync', 'closed'),
        confirmOrForcePush: () => setForcePushOpen(true),
        fetch: () => props.dispatcher.runOperation('fetch'),
        pull: () => props.dispatcher.runOperation('pull'),
        push: pushCurrentBranch,
        resetAndPull: () =>
          props.dispatcher.runOperation('reset-upstream', { confirmed: true }),
        setPushPullButtonWidth: updatePushPullButtonWidth,
        resetPushPullButtonWidth,
      } as unknown as Dispatcher),
    [
      pushCurrentBranch,
      resetPushPullButtonWidth,
      setToolbarDropdownState,
      updatePushPullButtonWidth,
    ]
  )
  const currentWebBranch = props.state.branches?.branch || null
  const canUpdateFromDefault =
    desktopCurrentBranch !== null &&
    defaultBranch !== null &&
    desktopCurrentBranch.name !== defaultBranch
  React.useEffect(() => {
    const requests = props.toolbarMenuRequests
    const previous = lastToolbarMenuRequests.current
    lastToolbarMenuRequests.current = requests
    if (requests.createBranch !== previous.createBranch) {
      setBranchInitialName('')
      setBranchToRename(null)
      setBranchDialog('create')
    }
    if (requests.renameBranch !== previous.renameBranch && currentWebBranch) {
      setBranchToRename(currentWebBranch)
      setBranchDialog('rename')
    }
    if (requests.deleteBranch !== previous.deleteBranch && currentWebBranch)
      setBranchToDelete(currentWebBranch)
    if (requests.discardAllChanges !== previous.discardAllChanges) {
      setDiscardAllChangesPermanently(false)
      setDiscardAllChangesOpen(true)
    }
    if (
      requests.permanentlyDiscardAllChanges !==
      previous.permanentlyDiscardAllChanges
    ) {
      setDiscardAllChangesPermanently(true)
      setDiscardAllChangesOpen(true)
    }
    if (
      requests.stashAllChanges !== previous.stashAllChanges &&
      currentWebBranch &&
      (props.state.status?.workingDirectory.files.length || 0) > 0
    )
      void props.dispatcher.runOperation('stash', {
        values: (props.state.status?.workingDirectory.files || []).map(
          file => file.path
        ),
        includeUntracked: true,
      })
    if (requests.newWorktree !== previous.newWorktree) setWorktreeToAdd(true)
    if (requests.openWithEditor !== previous.openWithEditor)
      setOpenWithEditorOpen(true)
    if (
      requests.deleteUnusedLocalBranches !== previous.deleteUnusedLocalBranches
    )
      setDeleteUnusedLocalBranchesOpen(true)
    if (requests.manageRemotes !== previous.manageRemotes)
      setManageRemotesOpen(true)
    if (requests.mergeBranch !== previous.mergeBranch)
      setMergeOperation({ squash: false })
    if (requests.squashMergeBranch !== previous.squashMergeBranch)
      setMergeOperation({ squash: true })
    if (requests.rebaseBranch !== previous.rebaseBranch) setRebaseDialog({})
  }, [
    currentWebBranch,
    props.dispatcher,
    props.state.status?.workingDirectory.files,
    props.toolbarMenuRequests,
  ])
  const repositoryActionItems = React.useMemo<
    ReadonlyArray<ToolbarActionMenuItem>
  >(
    () => [
      {
        id: 'push',
        type: 'item',
        label: 'Push',
        disabled: !desktopCurrentBranch,
        action: () => void pushCurrentBranch(),
      },
      {
        id: 'pull',
        type: 'item',
        label: 'Pull',
        disabled: !desktopCurrentBranch,
        action: () => void props.dispatcher.runOperation('pull'),
      },
      {
        id: 'fetch',
        type: 'item',
        label: 'Fetch',
        disabled: !repository,
        action: () => void props.dispatcher.runOperation('fetch'),
      },
      { id: 'repository-changes', type: 'separator' },
      {
        id: 'discard-all-changes',
        type: 'item',
        label: 'Discard All Changes…',
        disabled:
          (props.state.status?.workingDirectory.files.length || 0) === 0,
        action: () => {
          setDiscardAllChangesPermanently(false)
          setDiscardAllChangesOpen(true)
        },
      },
      {
        id: 'permanently-discard-all-changes',
        type: 'item',
        label: 'Permanently Discard All Changes…',
        disabled:
          (props.state.status?.workingDirectory.files.length || 0) === 0,
        action: () => {
          setDiscardAllChangesPermanently(true)
          setDiscardAllChangesOpen(true)
        },
      },
      {
        id: 'stash-all-changes',
        type: 'item',
        label: 'Stash All Changes',
        disabled:
          (props.state.status?.workingDirectory.files.length || 0) === 0 ||
          !desktopCurrentBranch,
        action: () =>
          void props.dispatcher.runOperation('stash', {
            values: (props.state.status?.workingDirectory.files || []).map(
              file => file.path
            ),
            includeUntracked: true,
          }),
      },
      { id: 'repository-integrations', type: 'separator' },
      {
        id: 'open-in-editor',
        type: 'item',
        label: `Open in ${editorIntegration.name || 'Visual Studio Code'}`,
        disabled: !repository,
        action: () => {
          if (!repository) return
          void props.dispatcher.openIntegration(
            'editor',
            repository.path,
            editorIntegration
          )
        },
      },
      {
        id: 'open-with-editor',
        type: 'item',
        label: 'Open With…',
        disabled: !repository,
        action: () => setOpenWithEditorOpen(true),
      },
      {
        id: 'open-in-terminal',
        type: 'item',
        label: 'Open in Terminal',
        disabled: !repository,
        action: () => {
          if (!repository) return
          void props.dispatcher.openIntegration(
            'shell',
            repository.path,
            shellIntegration
          )
        },
      },
      {
        id: 'show-in-file-manager',
        type: 'item',
        label: 'Show in File Manager',
        disabled: !repository,
        action: () => {
          if (repository) props.onOpenPath(repository.path, true)
        },
      },
      {
        id: 'remove-repository',
        type: 'item',
        label: 'Remove…',
        disabled: !repository,
        action: () => {
          if (repository) props.onRemoveRepository(repository.path)
        },
      },
      {
        id: 'new-worktree',
        type: 'item',
        label: 'New Worktree…',
        disabled: !repository || !props.showWorktrees,
        action: () => setWorktreeToAdd(true),
      },
      { id: 'repository-remotes', type: 'separator' },
      {
        id: 'manage-remotes',
        type: 'item',
        label: 'Manage Remotes…',
        disabled: !repository,
        action: () => setManageRemotesOpen(true),
      },
    ],
    [
      desktopCurrentBranch,
      props.state.status?.workingDirectory.files,
      editorIntegration,
      props.dispatcher,
      props.onOpenPath,
      pushCurrentBranch,
      repository,
      shellIntegration,
      props.showWorktrees,
    ]
  )
  const branchActionItems = React.useMemo<ReadonlyArray<ToolbarActionMenuItem>>(
    () => [
      {
        id: 'new-branch',
        type: 'item',
        label: 'New Branch…',
        disabled: !repository,
        action: () => {
          setBranchInitialName('')
          setBranchToRename(null)
          setBranchDialog('create')
        },
      },
      {
        id: 'rename-branch',
        type: 'item',
        label: 'Rename…',
        disabled: !currentWebBranch,
        action: () => setBranchToRename(currentWebBranch),
      },
      {
        id: 'delete-branch',
        type: 'item',
        label: 'Delete…',
        disabled: !currentWebBranch,
        action: () => setBranchToDelete(currentWebBranch),
      },
      { id: 'branch-history', type: 'separator' },
      {
        id: 'discard-all-changes',
        type: 'item',
        label: 'Discard All Changes…',
        disabled:
          (props.state.status?.workingDirectory.files.length || 0) === 0,
        action: () => {
          setDiscardAllChangesPermanently(false)
          setDiscardAllChangesOpen(true)
        },
      },
      {
        id: 'permanently-discard-all-changes',
        type: 'item',
        label: 'Permanently Discard All Changes…',
        disabled:
          (props.state.status?.workingDirectory.files.length || 0) === 0,
        action: () => {
          setDiscardAllChangesPermanently(true)
          setDiscardAllChangesOpen(true)
        },
      },
      {
        id: 'stash-all-changes',
        type: 'item',
        label: 'Stash All Changes',
        disabled:
          (props.state.status?.workingDirectory.files.length || 0) === 0 ||
          !desktopCurrentBranch,
        action: () =>
          void props.dispatcher.runOperation('stash', {
            values: (props.state.status?.workingDirectory.files || []).map(
              file => file.path
            ),
            includeUntracked: true,
          }),
      },
      { id: 'branch-history-actions', type: 'separator' },
      {
        id: 'update-from-default',
        type: 'item',
        label: `Update from ${defaultBranch || 'default branch'}`,
        disabled: !canUpdateFromDefault,
        action: () =>
          void props.dispatcher.runOperation('update-from-default', {
            defaultBranch: defaultBranch || undefined,
            updateStrategy: getStoredUpdateBranchStrategy(
              props.state.selectedRepositoryPath || ''
            ),
          }),
      },
      {
        id: 'compare-to-branch',
        type: 'item',
        label: 'Compare to Branch',
        disabled: !desktopCurrentBranch,
        action: () => void props.dispatcher.selectSection('compare'),
      },
      {
        id: 'merge-into-current',
        type: 'item',
        label: 'Merge into Current Branch…',
        disabled: !desktopCurrentBranch,
        action: () => setMergeOperation({ squash: false }),
      },
      {
        id: 'squash-merge-into-current',
        type: 'item',
        label: 'Squash and Merge into Current Branch…',
        disabled: !desktopCurrentBranch,
        action: () => setMergeOperation({ squash: true }),
      },
      {
        id: 'rebase-current',
        type: 'item',
        label: 'Rebase Current Branch…',
        disabled: !desktopCurrentBranch,
        action: () => setRebaseDialog({}),
      },
      {
        id: 'delete-unused-local-branches',
        type: 'item',
        label: 'Delete Unused Local Branches…',
        disabled: (props.state.branches?.mergedBranches?.length || 0) === 0,
        action: () => setDeleteUnusedLocalBranchesOpen(true),
      },
    ],
    [
      canUpdateFromDefault,
      currentWebBranch,
      defaultBranch,
      desktopCurrentBranch,
      props.dispatcher,
      props.state.branches?.mergedBranches,
      props.state.status?.workingDirectory.files,
      repository,
    ]
  )
  const runWorktreeOperation = React.useCallback(
    async (worktreePath: string, force = false) => {
      const mainWorktreePath =
        worktrees.find(worktree => worktree.type === 'main')?.path ||
        desktopWorktreeRepository.path
      const repositoryPath =
        worktreePath === desktopWorktreeRepository.path
          ? mainWorktreePath
          : desktopWorktreeRepository.path
      await props.dispatcher.selectRepository(repositoryPath)
      await props.dispatcher.runOperationOrThrow('worktree-remove', {
        values: [worktreePath],
        ...(force ? { force: true } : {}),
      })
      if (worktreePath !== mainWorktreePath) {
        props.dispatcher.removeRepository(worktreePath)
      }
    },
    [desktopWorktreeRepository.path, props.dispatcher, worktrees]
  )
  const desktopWorktreeDispatcher = React.useMemo(
    () =>
      ({
        closeFoldout: (foldout: FoldoutType) => {
          if (foldout === FoldoutType.Worktree)
            setToolbarDropdownState('worktree', 'closed')
        },
        incrementMetric: () => undefined,
        moveWorktree: async (
          _repository: Repository,
          worktreePath: string,
          newPath: string
        ) => {
          try {
            const isCurrentWorktree =
              worktreePath === desktopWorktreeRepository.path
            const mainWorktreePath =
              worktrees.find(worktree => worktree.type === 'main')?.path ||
              desktopWorktreeRepository.path
            await props.dispatcher.selectRepository(
              isCurrentWorktree
                ? mainWorktreePath
                : desktopWorktreeRepository.path
            )
            await props.dispatcher.runOperationOrThrow('worktree-move', {
              values: [worktreePath, newPath],
            })
            if (isCurrentWorktree) {
              await props.dispatcher.selectRepository(newPath)
              props.dispatcher.removeRepository(worktreePath)
            }
            return true
          } catch {
            return false
          }
        },
        requestDeleteWorktree: (
          _repository: Repository,
          worktreePath: string
        ) => {
          if (props.confirmWorktreeRemoval) setWorktreeToDelete(worktreePath)
          else
            void runWorktreeOperation(worktreePath).catch(error =>
              setWorktreeDeleteFailure({ path: worktreePath, error })
            )
        },
        selectRepository: (nextRepository: Repository) =>
          props.dispatcher.selectRepository(nextRepository.path),
        showPopup: (popup: {
          readonly type: PopupType
          readonly worktreePath?: string
        }) => {
          if (popup.type === PopupType.AddWorktree) setWorktreeToAdd(true)
          if (popup.type === PopupType.RenameWorktree)
            setWorktreeToRename(popup.worktreePath || null)
          return Promise.resolve()
        },
        switchWorktree: (
          _repository: Repository,
          worktree: { readonly path: string }
        ) => props.dispatcher.selectRepository(worktree.path),
        setWorktreeDropdownWidth: updateWorktreeDropdownWidth,
        resetWorktreeDropdownWidth,
      } as unknown as Dispatcher),
    [
      desktopWorktreeRepository.path,
      props.confirmWorktreeRemoval,
      props.dispatcher,
      resetWorktreeDropdownWidth,
      runWorktreeOperation,
      setToolbarDropdownState,
      updateWorktreeDropdownWidth,
      worktrees,
    ]
  )

  return (
    <>
      <ApplicationToolbar
        branch={
          <BranchDropdown
            branchDropdownWidth={{
              max: webToolbarButtonWidth.max,
              min: webToolbarButtonWidth.min,
              value: branchDropdownWidth,
            }}
            branchSortOrder={props.branchSortOrder}
            branchRowHeight={32}
            currentPullRequest={null}
            dispatcher={desktopBranchDropdownDispatcher}
            emoji={new Map()}
            enableFocusTrap={true}
            isLoadingPullRequests={false}
            isOpen={branchMenuOpen}
            onDropDownStateChanged={state =>
              setToolbarDropdownState('branch', state)
            }
            pullRequests={[]}
            repository={getDesktopRepository(
              props.state.selectedRepositoryPath || ''
            )}
            repositoryState={desktopBranchDropdownState}
            selectedTab={BranchesTab.Branches}
            shouldNudge={false}
            showCIStatusPopover={false}
            underlineLinks={props.underlineLinks}
          />
        }
        pushPull={
          <PushPullButton
            aheadBehind={aheadBehind}
            askForConfirmationOnForcePush={props.confirmForcePush}
            dispatcher={desktopPushPullDispatcher}
            enableFocusTrap={true}
            forcePushBranchState={forcePushBranchState}
            isDropdownOpen={syncMenuOpen}
            lastFetched={lastFetched}
            networkActionInProgress={props.state.loading}
            numTagsToPush={props.state.branches?.tagsToPush?.length || 0}
            onDropdownStateChanged={state =>
              setToolbarDropdownState('sync', state)
            }
            progress={networkProgress}
            pullWithRebase={props.state.branches?.pullWithRebase}
            pushPullButtonWidth={{
              max: webToolbarButtonWidth.max,
              min: webToolbarButtonWidth.min,
              value: pushPullButtonWidth,
            }}
            rebaseInProgress={false}
            remoteName={remoteName}
            repository={getDesktopRepository(
              props.state.selectedRepositoryPath || ''
            )}
            shouldNudge={false}
            tipState={desktopTip.kind}
          />
        }
        worktree={
          props.showWorktrees && repository ? (
            <WorktreeDropdown
              disabled={props.isEmbedded}
              dispatcher={desktopWorktreeDispatcher}
              enableFocusTrap={true}
              isOpen={worktreeDropdownOpen}
              onDropDownStateChanged={state =>
                setToolbarDropdownState('worktree', state)
              }
              repository={desktopWorktreeRepository}
              rowHeight={32}
              worktreeDropdownWidth={{
                max: webToolbarButtonWidth.max,
                min: webToolbarButtonWidth.min,
                value: worktreeDropdownWidth,
              }}
              worktrees={worktrees}
              onPruneWorktree={path =>
                void props.dispatcher.runOperationOrThrow('worktree-prune', {
                  values: [path],
                })
              }
            />
          ) : null
        }
        repository={
          <RepositoryToolbarDropdown
            description="Current repository"
            disabled={props.isEmbedded}
            dropdownContentRenderer={() => (
              <DesktopRepositoryPicker
                onAdd={() => {
                  props.onOpenRepositoryDialog()
                  setToolbarDropdownState('repository', 'closed')
                }}
                onClone={() => {
                  props.onOpenCloneDialog()
                  setToolbarDropdownState('repository', 'closed')
                }}
                onCreate={() => {
                  props.onOpenInitDialog()
                  setToolbarDropdownState('repository', 'closed')
                }}
                onRemove={props.onRemoveRepository}
                onSelect={path => {
                  void props.dispatcher.selectRepository(path)
                  setToolbarDropdownState('repository', 'closed')
                }}
                onEdit={props.onChangeRepositoryAlias}
                repositories={props.state.repositories}
                selectedRepositoryPath={props.state.selectedRepositoryPath}
                showBranchName={props.showBranchName}
                showWorktrees={props.showWorktreesInRepositoryList}
                recentRepositoriesCount={props.recentRepositoriesCount}
                onCopyPath={props.onCopyPath}
                onOpenPath={props.onOpenPath}
                onOpenExternal={props.onOpenExternal}
                onOpenNewWindow={props.onOpenNewWindow}
                onPullAll={props.onPullAllRepositories}
                onCreateGroup={() => {
                  props.onRenameRepositoryGroup('')
                  setToolbarDropdownState('repository', 'closed')
                }}
                branches={props.state.branches?.branches || []}
                confirmWorktreeRemoval={props.confirmWorktreeRemoval}
                dispatcher={props.dispatcher}
                onConfirmWorktreeRemovalChanged={
                  props.onConfirmWorktreeRemovalChanged
                }
              />
            )}
            dropdownState={repositoryPickerOpen ? 'open' : 'closed'}
            icon={octicons.repo}
            onKeyDown={event =>
              closeDropdownOnEscape(event, () =>
                setToolbarDropdownState('repository', 'closed')
              )
            }
            onDropdownStateChanged={state =>
              setToolbarDropdownState('repository', state)
            }
            title={repository?.name || 'Repository'}
            tooltip={repository?.path}
            width={props.sidebarWidth}
          />
        }
        actions={
          <>
            <ToolbarActionMenu
              id="web-repository-actions"
              isOpen={repositoryActionsOpen}
              label="Repo"
              items={repositoryActionItems}
              onStateChanged={state =>
                setToolbarDropdownState('repository-actions', state)
              }
            />
            <ToolbarActionMenu
              id="web-branch-actions"
              isOpen={branchActionsOpen}
              label="Branch"
              items={branchActionItems}
              onStateChanged={state =>
                setToolbarDropdownState('branch-actions', state)
              }
            />
          </>
        }
        sidebarWidth={props.sidebarWidth}
      />
      {worktreeToAdd && repository ? (
        <DialogStackContext.Provider value={{ isTopMost: true }}>
          <AddWorktreeDialog
            allBranches={desktopBranches}
            dispatcher={desktopWorktreeDispatcher}
            onDismissed={() => setWorktreeToAdd(false)}
            repository={desktopWorktreeRepository}
          />
        </DialogStackContext.Provider>
      ) : null}
      {worktreeToRename && repository ? (
        <DialogStackContext.Provider value={{ isTopMost: true }}>
          <RenameWorktreeDialog
            dispatcher={desktopWorktreeDispatcher}
            onDismissed={() => setWorktreeToRename(null)}
            repository={desktopWorktreeRepository}
            worktreePath={worktreeToRename}
          />
        </DialogStackContext.Provider>
      ) : null}
      {worktreeToDelete && repository ? (
        <DialogStackContext.Provider value={{ isTopMost: true }}>
          <DeleteWorktreeDialog
            askForConfirmationOnWorktreeRemoval={props.confirmWorktreeRemoval}
            onConfirmWorktreeRemovalChanged={
              props.onConfirmWorktreeRemovalChanged
            }
            onDeleteWorktree={async (_repository, worktreePath) => {
              try {
                await runWorktreeOperation(worktreePath)
              } catch (error) {
                setWorktreeDeleteFailure({
                  path: worktreePath,
                  error:
                    error instanceof Error ? error : new Error(String(error)),
                })
              }
            }}
            onDismissed={() => setWorktreeToDelete(null)}
            repository={desktopWorktreeRepository}
            worktreePath={worktreeToDelete}
          />
        </DialogStackContext.Provider>
      ) : null}
      {worktreeDeleteFailure && repository ? (
        <DialogStackContext.Provider value={{ isTopMost: true }}>
          <DeleteWorktreeFailedDialog
            error={worktreeDeleteFailure.error}
            onDeleteWorktree={async (_repository, worktreePath, force) => {
              await runWorktreeOperation(worktreePath, force)
              setWorktreeDeleteFailure(null)
            }}
            onDismissed={() => setWorktreeDeleteFailure(null)}
            onSwitchToWorktree={(_repository, worktree) =>
              props.dispatcher.selectRepository(worktree.path)
            }
            originalWorktree={
              worktrees.find(
                worktree => worktree.path === worktreeDeleteFailure.path
              ) || null
            }
            repository={desktopWorktreeRepository}
            worktreePath={worktreeDeleteFailure.path}
          />
        </DialogStackContext.Provider>
      ) : null}
      {openWithEditorOpen && repository ? (
        <DialogStackContext.Provider value={{ isTopMost: true }}>
          <OpenWithExternalEditor
            onDismissed={() => setOpenWithEditorOpen(false)}
            onOpenWithEditor={async (editor, custom) => {
              await props.dispatcher.openIntegration(
                'editor',
                repository.path,
                {
                  name: editor,
                  custom: custom
                    ? { path: custom.path, arguments: custom.arguments || '' }
                    : null,
                }
              )
            }}
          />
        </DialogStackContext.Provider>
      ) : null}
      {discardAllChangesOpen && props.state.selectedRepositoryPath ? (
        <DesktopDiscardChangesDialog
          askForConfirmation={props.confirmDiscardChanges}
          dispatcher={props.dispatcher}
          files={props.state.status?.workingDirectory.files || []}
          onConfirmDiscardChangesChanged={props.onConfirmDiscardChangesChanged}
          onDismiss={() => setDiscardAllChangesOpen(false)}
          permanentlyDelete={discardAllChangesPermanently}
          repositoryPath={props.state.selectedRepositoryPath}
        />
      ) : null}
      {forcePushOpen &&
      desktopCurrentBranch &&
      props.state.selectedRepositoryPath ? (
        <DesktopConfirmForcePushDialog
          currentBranch={desktopCurrentBranch}
          dispatcher={props.dispatcher}
          onDismiss={() => setForcePushOpen(false)}
          repositoryPath={props.state.selectedRepositoryPath}
        />
      ) : null}
      {checkoutTarget &&
      desktopCurrentBranch &&
      props.state.selectedRepositoryPath ? (
        <DesktopStashAndSwitchBranchDialog
          branchToCheckout={checkoutTarget.branch}
          checkoutOptions={checkoutTarget.options}
          currentBranch={desktopCurrentBranch}
          dispatcher={props.dispatcher}
          onDismiss={() => setCheckoutTarget(null)}
          repositoryPath={props.state.selectedRepositoryPath}
        />
      ) : null}
      {mergeOperation &&
      desktopCurrentBranch &&
      props.state.selectedRepositoryPath ? (
        <DialogStackContext.Provider value={{ isTopMost: true }}>
          <MergeChooseBranchDialog
            allBranches={desktopBranches}
            branchSortOrder={props.branchSortOrder}
            currentBranch={desktopCurrentBranch}
            defaultBranch={desktopDefaultBranch}
            dispatcher={
              {
                closePopup: () => setMergeOperation(null),
                incrementMetric: () => undefined,
                mergeBranch: (
                  _repository: Repository,
                  branch: Branch,
                  _status: unknown,
                  squash = false
                ) => {
                  setMergeOperation(null)
                  return props.dispatcher.runOperation(
                    squash ? 'squash-merge' : 'merge',
                    { values: [branch.name] }
                  )
                },
                showRebaseDialog: (
                  _repository: Repository,
                  initialBranch?: Branch | null
                ) => {
                  setMergeOperation(null)
                  setRebaseDialog(initialBranch ? { initialBranch } : {})
                  return Promise.resolve()
                },
                startMergeBranchOperation: (
                  _repository: Repository,
                  squash = false,
                  initialBranch?: Branch | null
                ) =>
                  setMergeOperation({
                    squash,
                    ...(initialBranch ? { initialBranch } : {}),
                  }),
              } as unknown as Dispatcher
            }
            initialBranch={mergeOperation.initialBranch}
            onDismissed={() => setMergeOperation(null)}
            operation={
              mergeOperation.squash
                ? MultiCommitOperationKind.Squash
                : MultiCommitOperationKind.Merge
            }
            recentBranches={desktopBranches.filter(
              candidate =>
                candidate.type === BranchType.Local &&
                (props.state.branches?.recentBranches || []).includes(
                  candidate.name
                )
            )}
            repository={getDesktopRepository(
              props.state.selectedRepositoryPath
            )}
          />
        </DialogStackContext.Provider>
      ) : null}
      {rebaseDialog &&
      desktopCurrentBranch &&
      props.state.selectedRepositoryPath ? (
        <DialogStackContext.Provider value={{ isTopMost: true }}>
          <RebaseChooseBranchDialog
            allBranches={desktopBranches}
            branchSortOrder={props.branchSortOrder}
            currentBranch={desktopCurrentBranch}
            defaultBranch={desktopDefaultBranch}
            dispatcher={
              {
                startRebase: (_repository: Repository, baseBranch: Branch) => {
                  setRebaseDialog(null)
                  return props.dispatcher.runOperation('rebase', {
                    values: [baseBranch.name],
                  })
                },
              } as unknown as Dispatcher
            }
            initialBranch={rebaseDialog.initialBranch}
            onDismissed={() => setRebaseDialog(null)}
            operation={MultiCommitOperationKind.Rebase}
            recentBranches={desktopBranches.filter(
              candidate =>
                candidate.type === BranchType.Local &&
                (props.state.branches?.recentBranches || []).includes(
                  candidate.name
                )
            )}
            repository={getDesktopRepository(
              props.state.selectedRepositoryPath
            )}
          />
        </DialogStackContext.Provider>
      ) : null}
      {branchDialog === 'create' ? (
        <DialogStackContext.Provider value={{ isTopMost: true }}>
          <CreateBranch
            accounts={[]}
            allBranches={desktopBranches}
            cachedRepoRulesets={new Map()}
            createBranch={(name, startPoint, noTrack) => {
              void props.dispatcher
                .runOperation('create-branch', {
                  values: [name, ...(startPoint ? [startPoint] : [])],
                  checkout: true,
                  noTrack,
                })
                .then(() => {
                  setBranchDialog(null)
                  setBranchInitialName('')
                })
            }}
            defaultBranch={desktopDefaultBranch}
            dispatcher={desktopBranchDialogDispatcher}
            initialName={branchInitialName}
            onDismissed={() => {
              setBranchDialog(null)
              setBranchInitialName('')
            }}
            repository={getDesktopRepository(
              props.state.selectedRepositoryPath || ''
            )}
            tip={desktopBranchDialogTip}
            upstreamDefaultBranch={null}
            upstreamGitHubRepository={null}
          />
        </DialogStackContext.Provider>
      ) : null}
      {branchDialog === 'rename' && branchToRename ? (
        <DialogStackContext.Provider value={{ isTopMost: true }}>
          <RenameBranch
            accounts={[]}
            branch={getDesktopBranch(branchToRename) as Branch}
            cachedRepoRulesets={new Map()}
            dispatcher={desktopBranchDialogDispatcher}
            onDismissed={() => {
              setBranchDialog(null)
              setBranchToRename(null)
            }}
            repository={getDesktopRepository(
              props.state.selectedRepositoryPath || ''
            )}
          />
        </DialogStackContext.Provider>
      ) : null}
      {branchDialog === 'worktree' && branchForWorktree ? (
        <DialogStackContext.Provider value={{ isTopMost: true }}>
          <AddWorktreeDialog
            allBranches={desktopBranches}
            dispatcher={desktopBranchDialogDispatcher}
            initialBranchName={
              getDesktopBranch(branchForWorktree)?.nameWithoutRemote ||
              branchForWorktree.name
            }
            onDismissed={() => {
              setBranchDialog(null)
              setBranchForWorktree(null)
            }}
            repository={getDesktopRepository(
              props.state.selectedRepositoryPath || ''
            )}
          />
        </DialogStackContext.Provider>
      ) : null}
      {branchToDelete && props.state.selectedRepositoryPath ? (
        branchToDelete.type === 'Remote' ? (
          <DesktopDeleteRemoteBranchDialog
            branch={branchToDelete}
            dispatcher={props.dispatcher}
            onDeleted={() => undefined}
            onDismiss={() => setBranchToDelete(null)}
            repositoryPath={props.state.selectedRepositoryPath}
          />
        ) : (
          <DesktopDeleteBranchDialog
            branch={branchToDelete}
            branches={props.state.branches?.branches || []}
            dispatcher={props.dispatcher}
            onDeleted={() => undefined}
            onDismiss={() => setBranchToDelete(null)}
            repositoryPath={props.state.selectedRepositoryPath}
          />
        )
      ) : null}
      {deleteUnusedLocalBranchesOpen && props.state.selectedRepositoryPath ? (
        <DesktopDeleteUnusedLocalBranchesDialog
          branches={props.state.branches?.mergedBranches || []}
          dispatcher={props.dispatcher}
          onDeleted={() => undefined}
          onDismiss={() => setDeleteUnusedLocalBranchesOpen(false)}
          repositoryPath={props.state.selectedRepositoryPath}
        />
      ) : null}
      {manageRemotesOpen && props.state.selectedRepositoryPath ? (
        <DialogStackContext.Provider value={{ isTopMost: !addRemoteOpen }}>
          <ManageRemotesDialog
            dispatcher={
              {
                getRemotes: () =>
                  Promise.resolve(
                    (props.state.branches?.remotes || []).map(remote => ({
                      name: remote.name,
                      url: remote.url,
                    }))
                  ),
                postError: () => Promise.resolve(),
                removeRemote: (_repository: Repository, name: string) =>
                  props.dispatcher.runOperationOrThrow('remote-remove', {
                    values: [name],
                  }),
                setRemoteURL: (
                  _repository: Repository,
                  name: string,
                  url: string
                ) =>
                  props.dispatcher.runOperationOrThrow('remote-set-url', {
                    values: [name, url],
                  }),
                showPopup: (popup: { readonly type: PopupType }) => {
                  if (popup.type === PopupType.AddRemote) setAddRemoteOpen(true)
                  return Promise.resolve()
                },
              } as unknown as Dispatcher
            }
            isTopMost={!addRemoteOpen}
            onDismissed={() => setManageRemotesOpen(false)}
            repository={getDesktopRepository(
              props.state.selectedRepositoryPath
            )}
          />
        </DialogStackContext.Provider>
      ) : null}
      {addRemoteOpen && props.state.selectedRepositoryPath ? (
        <DialogStackContext.Provider value={{ isTopMost: true }}>
          <AddRemoteDialog
            dispatcher={
              {
                addRemote: (
                  _repository: Repository,
                  name: string,
                  url: string
                ) =>
                  props.dispatcher.runOperationOrThrow('remote-add', {
                    values: [name, url],
                  }),
                postError: () => Promise.resolve(),
              } as unknown as Dispatcher
            }
            existingRemoteNames={(props.state.branches?.remotes || []).map(
              remote => remote.name
            )}
            onDismissed={() => setAddRemoteOpen(false)}
            repository={getDesktopRepository(
              props.state.selectedRepositoryPath
            )}
          />
        </DialogStackContext.Provider>
      ) : null}
    </>
  )
}

function DesktopResetWarningDialog(props: {
  readonly commit: Commit
  readonly dispatcher: WebDispatcher
  readonly onDismiss: () => void
  readonly repositoryPath: string
}) {
  const desktopDispatcher = React.useMemo(
    () =>
      ({
        resetToCommit: (_repository: Repository, commit: Commit) =>
          props.dispatcher
            .runOperation('reset-commit', {
              values: [commit.sha],
              mode: 'mixed',
            })
            .then(() => undefined),
      } as unknown as Dispatcher),
    [props.dispatcher]
  )

  return (
    <DialogStackContext.Provider value={{ isTopMost: true }}>
      <WarnResetToPushedCommit
        commit={props.commit}
        dispatcher={desktopDispatcher}
        onDismissed={props.onDismiss}
        repository={getDesktopRepository(props.repositoryPath)}
      />
    </DialogStackContext.Provider>
  )
}

function DesktopCreateBranchAtCommitDialog(props: {
  readonly commit: Commit
  readonly branches: ReadonlyArray<WebBranch>
  readonly currentBranch: WebBranch | null | undefined
  readonly defaultBranch: string | null
  readonly dispatcher: WebDispatcher
  readonly onDismiss: () => void
  readonly repositoryPath: string
}) {
  const branches = React.useMemo(
    () =>
      props.branches.flatMap(branch => {
        const desktopBranch = getDesktopBranch(branch)
        return desktopBranch ? [desktopBranch] : []
      }),
    [props.branches]
  )
  const currentBranch = getDesktopBranch(props.currentBranch)
  const defaultBranch =
    branches.find(
      branch =>
        branch.type === BranchType.Local && branch.name === props.defaultBranch
    ) || null
  const tip = currentBranch
    ? { kind: TipState.Valid as const, branch: currentBranch }
    : {
        kind: TipState.Detached as const,
        currentSha: props.commit.sha,
      }
  const desktopDispatcher = React.useMemo(
    () =>
      ({
        getBranchNamePresets: () => Promise.resolve([]),
      } as unknown as Dispatcher),
    []
  )

  return (
    <DialogStackContext.Provider value={{ isTopMost: true }}>
      <CreateBranch
        accounts={[]}
        allBranches={branches}
        cachedRepoRulesets={new Map()}
        createBranch={(name, _startPoint, noTrack) => {
          void props.dispatcher
            .runOperation('create-branch', {
              values: [name, props.commit.sha],
              checkout: true,
              noTrack,
            })
            .then(props.onDismiss)
        }}
        defaultBranch={defaultBranch}
        dispatcher={desktopDispatcher}
        initialName=""
        onDismissed={props.onDismiss}
        repository={getDesktopRepository(props.repositoryPath)}
        targetCommit={props.commit}
        tip={tip}
        upstreamDefaultBranch={null}
        upstreamGitHubRepository={null}
      />
    </DialogStackContext.Provider>
  )
}

function DesktopConfirmForcePushDialog(props: {
  readonly currentBranch: Branch
  readonly dispatcher: WebDispatcher
  readonly onDismiss: () => void
  readonly repositoryPath: string
}) {
  const desktopDispatcher = React.useMemo(
    () =>
      ({
        performForcePush: () =>
          props.dispatcher.runOperation('push', {
            force: true,
            confirmed: true,
          }),
        setConfirmForcePushSetting: () => undefined,
      } as unknown as Dispatcher),
    [props.dispatcher]
  )

  return (
    <DialogStackContext.Provider value={{ isTopMost: true }}>
      <ConfirmForcePush
        askForConfirmationOnForcePush={true}
        dispatcher={desktopDispatcher}
        onDismissed={props.onDismiss}
        repository={getDesktopRepository(props.repositoryPath)}
        upstreamBranch={
          props.currentBranch.upstream || props.currentBranch.name
        }
      />
    </DialogStackContext.Provider>
  )
}

function DesktopStashAndSwitchBranchDialog(props: {
  readonly currentBranch: Branch
  readonly branchToCheckout: Branch
  readonly repositoryPath: string
  readonly dispatcher: WebDispatcher
  readonly onDismiss: () => void
  readonly checkoutOptions: WebOperationOptions
}) {
  const repository = React.useMemo(
    () => getDesktopRepository(props.repositoryPath),
    [props.repositoryPath]
  )
  const desktopDispatcher = React.useMemo(
    () =>
      ({
        checkoutBranch: (
          _repository: Repository,
          _branch: Branch,
          strategy: UncommittedChangesStrategy
        ) =>
          props.dispatcher
            .runOperation('checkout', {
              ...props.checkoutOptions,
              ...(strategy === UncommittedChangesStrategy.StashOnCurrentBranch
                ? { stashChanges: true }
                : strategy === UncommittedChangesStrategy.MoveToNewBranch
                ? { moveChanges: true }
                : {}),
            })
            .then(() => repository),
      } as unknown as Dispatcher),
    [props.checkoutOptions, props.dispatcher, repository]
  )

  return (
    <DialogStackContext.Provider value={{ isTopMost: true }}>
      <StashAndSwitchBranch
        branchToCheckout={props.branchToCheckout}
        currentBranch={props.currentBranch}
        dispatcher={desktopDispatcher}
        onDismissed={props.onDismiss}
        repository={repository}
      />
    </DialogStackContext.Provider>
  )
}

function DesktopCreateTagDialog(props: {
  readonly repositoryPath: string
  readonly targetCommitSha: string
  readonly tags: ReadonlyArray<WebTag>
  readonly dispatcher: WebDispatcher
  readonly onDismiss: () => void
  readonly initialName?: string
}) {
  const desktopDispatcher = React.useMemo(
    () =>
      ({
        createTag: (
          _repository: Repository,
          name: string,
          targetCommitSha: string
        ) =>
          props.dispatcher
            .runOperationOrThrow('tag-create', {
              values: [name, targetCommitSha],
              message: '',
            })
            .then(() => undefined),
      } as unknown as Dispatcher),
    [props.dispatcher]
  )
  const localTags = React.useMemo(
    () => new Map(props.tags.map(tag => [tag.name, tag.sha])),
    [props.tags]
  )

  return (
    <DialogStackContext.Provider value={{ isTopMost: true }}>
      <CreateTag
        dispatcher={desktopDispatcher}
        initialName={props.initialName}
        localTags={localTags}
        onDismissed={props.onDismiss}
        repository={getDesktopRepository(props.repositoryPath)}
        targetCommitSha={props.targetCommitSha}
      />
    </DialogStackContext.Provider>
  )
}

function DesktopDeleteTagDialog(props: {
  readonly repositoryPath: string
  readonly tagName: string
  readonly dispatcher: WebDispatcher
  readonly onDismiss: () => void
  readonly onDeleted: () => void
}) {
  const wasDeleted = React.useRef(false)
  const desktopDispatcher = React.useMemo(
    () =>
      ({
        deleteTag: (_repository: Repository, tagName: string) =>
          props.dispatcher
            .runOperationOrThrow('tag-delete', {
              values: [tagName],
              confirmed: true,
            })
            .then(() => {
              wasDeleted.current = true
            }),
      } as unknown as Dispatcher),
    [props.dispatcher]
  )
  const onDismissed = React.useCallback(() => {
    if (wasDeleted.current) props.onDeleted()
    props.onDismiss()
  }, [props.onDeleted, props.onDismiss])

  return (
    <DialogStackContext.Provider value={{ isTopMost: true }}>
      <DeleteTag
        dispatcher={desktopDispatcher}
        onDismissed={onDismissed}
        repository={getDesktopRepository(props.repositoryPath)}
        tagName={props.tagName}
      />
    </DialogStackContext.Provider>
  )
}

function DesktopConfirmDeletePushedTagDialog(props: {
  readonly repositoryPath: string
  readonly tagName: string
  readonly dispatcher: WebDispatcher
  readonly onDismiss: () => void
  readonly onDeleted: () => void
}) {
  const wasDeleted = React.useRef(false)
  const desktopDispatcher = React.useMemo(
    () =>
      ({
        deleteTag: (_repository: Repository, tagName: string) =>
          props.dispatcher
            .runOperationOrThrow('tag-delete', {
              values: [tagName],
              confirmed: true,
            })
            .then(() => {
              wasDeleted.current = true
            }),
      } as unknown as Dispatcher),
    [props.dispatcher]
  )
  const onDismissed = React.useCallback(() => {
    if (wasDeleted.current) props.onDeleted()
    props.onDismiss()
  }, [props.onDeleted, props.onDismiss])

  return (
    <DialogStackContext.Provider value={{ isTopMost: true }}>
      <ConfirmDeletePushedTagDialog
        dispatcher={desktopDispatcher}
        onDismissed={onDismissed}
        repository={getDesktopRepository(props.repositoryPath)}
        tagName={props.tagName}
      />
    </DialogStackContext.Provider>
  )
}

function DesktopDeleteBranchDialog(props: {
  readonly repositoryPath: string
  readonly branch: WebBranch
  readonly branches: ReadonlyArray<WebBranch>
  readonly dispatcher: WebDispatcher
  readonly onDismiss: () => void
  readonly onDeleted: () => void
}) {
  const branch = getDesktopBranch(props.branch)
  const desktopDispatcher = React.useMemo(
    () =>
      ({
        deleteLocalBranch: (
          _repository: Repository,
          branch: Branch,
          includeUpstream?: boolean
        ) =>
          props.dispatcher
            .runOperation('delete-branch', {
              values: [branch.name],
              confirmed: true,
            })
            .then(async () => {
              if (includeUpstream && branch.upstreamRemoteName) {
                await props.dispatcher.runOperation('delete-remote-branch', {
                  values: [
                    branch.upstreamRemoteName,
                    branch.upstreamWithoutRemote || branch.name,
                  ],
                  confirmed: true,
                })
              }
            }),
      } as unknown as Dispatcher),
    [props.dispatcher]
  )
  const upstreamBranchExists =
    branch?.upstream !== null &&
    props.branches.some(
      candidate =>
        candidate.type === 'Remote' && candidate.name === branch?.upstream
    )

  if (!branch) return null

  return (
    <DialogStackContext.Provider value={{ isTopMost: true }}>
      <DeleteBranch
        branch={branch}
        dispatcher={desktopDispatcher}
        existsOnRemote={upstreamBranchExists}
        onDeleted={props.onDeleted}
        onDismissed={props.onDismiss}
        repository={getDesktopRepository(props.repositoryPath)}
      />
    </DialogStackContext.Provider>
  )
}

function DesktopDeleteRemoteBranchDialog(props: {
  readonly repositoryPath: string
  readonly branch: WebBranch
  readonly dispatcher: WebDispatcher
  readonly onDismiss: () => void
  readonly onDeleted: () => void
}) {
  const branch = getDesktopBranch(props.branch)
  const desktopDispatcher = React.useMemo(
    () =>
      ({
        deleteRemoteBranch: (_repository: Repository, branch: Branch) => {
          const remote = branch.remoteName
          if (!remote)
            return Promise.reject(
              new Error(`Remote branch '${branch.name}' has no remote name`)
            )
          return props.dispatcher.runOperation('delete-remote-branch', {
            values: [remote, branch.nameWithoutRemote],
            confirmed: true,
          })
        },
      } as unknown as Dispatcher),
    [props.dispatcher]
  )

  if (!branch) return null

  return (
    <DialogStackContext.Provider value={{ isTopMost: true }}>
      <DeleteRemoteBranch
        branch={branch}
        dispatcher={desktopDispatcher}
        onDeleted={props.onDeleted}
        onDismissed={props.onDismiss}
        repository={getDesktopRepository(props.repositoryPath)}
      />
    </DialogStackContext.Provider>
  )
}

function DesktopDeleteUnusedLocalBranchesDialog(props: {
  readonly repositoryPath: string
  readonly branches: ReadonlyArray<WebBranch>
  readonly dispatcher: WebDispatcher
  readonly onDismiss: () => void
  readonly onDeleted: () => void
}) {
  const branches = React.useMemo(
    () =>
      props.branches.flatMap(branch => {
        const desktopBranch = getDesktopBranch(branch)
        return desktopBranch ? [desktopBranch] : []
      }),
    [props.branches]
  )
  const desktopDispatcher = React.useMemo(
    () =>
      ({
        deleteLocalBranches: (
          _repository: Repository,
          branches: ReadonlyArray<Branch>
        ) =>
          props.dispatcher.runOperation('delete-branches', {
            values: branches.map(branch => branch.name),
            confirmed: true,
          }),
      } as unknown as Dispatcher),
    [props.dispatcher]
  )

  return (
    <DialogStackContext.Provider value={{ isTopMost: true }}>
      <DeleteUnusedLocalBranches
        branches={branches}
        dispatcher={desktopDispatcher}
        onDeleted={props.onDeleted}
        onDismissed={props.onDismiss}
        repository={getDesktopRepository(props.repositoryPath)}
      />
    </DialogStackContext.Provider>
  )
}

function DesktopConfirmCheckoutCommitDialog(props: {
  readonly repositoryPath: string
  readonly commit: WebApplicationState['history'][number]
  readonly askForConfirmation: boolean
  readonly dispatcher: WebDispatcher
  readonly onConfirmCheckoutCommitChanged: (value: boolean) => void
  readonly onDismiss: () => void
}) {
  const desktopDispatcher = React.useMemo(
    () =>
      ({
        checkoutCommit: (_repository: Repository, commit: Commit) =>
          props.dispatcher.runOperation('checkout-commit', {
            values: [commit.sha],
          }),
        setConfirmCheckoutCommitSetting: (askForConfirmation: boolean) => {
          props.onConfirmCheckoutCommitChanged(askForConfirmation)
          return Promise.resolve()
        },
      } as unknown as Dispatcher),
    [props.dispatcher, props.onConfirmCheckoutCommitChanged]
  )

  return (
    <DialogStackContext.Provider value={{ isTopMost: true }}>
      <ConfirmCheckoutCommitDialog
        askForConfirmationOnCheckoutCommit={props.askForConfirmation}
        commit={getDesktopCommit(props.commit)}
        dispatcher={desktopDispatcher}
        onDismissed={props.onDismiss}
        repository={getDesktopRepository(props.repositoryPath)}
      />
    </DialogStackContext.Provider>
  )
}

function DesktopConfirmRemoveRepositoryDialog(props: {
  readonly repository: WebApplicationState['repositories'][number]
  readonly dispatcher: WebDispatcher
  readonly onDismiss: () => void
}) {
  const repository = React.useMemo(
    () => new Repository(props.repository.path, 0, null, false),
    [props.repository.path]
  )

  return (
    <DialogStackContext.Provider value={{ isTopMost: true }}>
      <ConfirmRemoveRepository
        onConfirmation={async (_repository, deleteRepoFromDisk) => {
          if (deleteRepoFromDisk)
            await props.dispatcher.deleteRepository(
              props.repository.path,
              'trash'
            )
          else props.dispatcher.removeRepository(props.repository.path)
        }}
        onDismissed={props.onDismiss}
        repository={repository}
      />
    </DialogStackContext.Provider>
  )
}

function DesktopChooseCherryPickTargetDialog(props: {
  readonly commits: ReadonlyArray<Commit>
  readonly branches: ReadonlyArray<WebBranch>
  readonly currentBranch: WebBranch | null | undefined
  readonly defaultBranch: string | null
  readonly dispatcher: WebDispatcher
  readonly onDismiss: () => void
  readonly repositoryPath: string
}) {
  const branches = React.useMemo(
    () =>
      props.branches.flatMap(branch => {
        const desktopBranch = getDesktopBranch(branch)
        return desktopBranch ? [desktopBranch] : []
      }),
    [props.branches]
  )
  const currentBranch = getDesktopBranch(props.currentBranch)

  if (!currentBranch || !props.repositoryPath) return null

  return (
    <DialogStackContext.Provider value={{ isTopMost: true }}>
      <ChooseTargetBranchDialog
        allBranches={branches}
        branchSortOrder={DEFAULT_BRANCH_SORT_ORDER}
        commitCount={props.commits.length}
        currentBranch={currentBranch}
        defaultBranch={
          branches.find(branch => branch.name === props.defaultBranch) || null
        }
        onCherryPick={targetBranch => {
          void props.dispatcher
            .runOperation('checkout', { values: [targetBranch.name] })
            .then(() =>
              props.dispatcher.runOperation('cherry-pick', {
                values: props.commits.map(commit => commit.sha),
              })
            )
            .then(props.onDismiss)
        }}
        onCreateNewBranch={name => {
          void props.dispatcher
            .runOperation('create-branch', {
              values: [name],
              checkout: true,
            })
            .then(() =>
              props.dispatcher.runOperation('cherry-pick', {
                values: props.commits.map(commit => commit.sha),
              })
            )
            .then(props.onDismiss)
        }}
        onDismissed={props.onDismiss}
        recentBranches={[]}
        repository={getDesktopRepository(props.repositoryPath)}
      />
    </DialogStackContext.Provider>
  )
}

function DesktopChangeRepositoryAliasDialog(props: {
  readonly repository: WebApplicationState['repositories'][number]
  readonly dispatcher: WebDispatcher
  readonly onDismiss: () => void
}) {
  const repository = React.useMemo(
    () =>
      new Repository(
        props.repository.path,
        0,
        null,
        false,
        props.repository.alias || null,
        props.repository.group || null,
        props.repository.defaultBranch
      ),
    [props.repository]
  )
  const desktopDispatcher = React.useMemo(
    () =>
      ({
        changeRepositoryAlias: (
          _repository: Repository,
          alias: string | null
        ) => {
          props.dispatcher.setRepositoryAlias(alias || '')
          return Promise.resolve()
        },
      } as unknown as Dispatcher),
    [props.dispatcher]
  )

  return (
    <DialogStackContext.Provider value={{ isTopMost: true }}>
      <ChangeRepositoryAlias
        dispatcher={desktopDispatcher}
        onDismissed={props.onDismiss}
        repository={repository}
      />
    </DialogStackContext.Provider>
  )
}

function DesktopEditRepositoryGroupDialog(props: {
  readonly repositories: ReadonlyArray<
    WebApplicationState['repositories'][number]
  >
  readonly groupName: string
  readonly dispatcher: WebDispatcher
  readonly onDismiss: () => void
}) {
  const desktopRepositories = React.useMemo(
    () =>
      props.repositories.map(
        (repository, index) =>
          new Repository(
            repository.path,
            index + 1,
            null,
            false,
            repository.alias || null,
            repository.group || null,
            repository.defaultBranch
          )
      ),
    [props.repositories]
  )
  const desktopDispatcher = React.useMemo(
    () =>
      ({
        changeRepositoriesGroupName: async (
          repositories: ReadonlyArray<Repository>,
          groupName: string | null
        ) => {
          for (const repository of repositories) {
            await props.dispatcher.selectRepository(repository.path)
            props.dispatcher.setRepositoryGroup(groupName)
          }
        },
      } as unknown as Dispatcher),
    [props.dispatcher]
  )
  const preselectedRepositoryIds = desktopRepositories
    .filter(repository => repository.groupName === props.groupName)
    .map(repository => repository.id)

  return (
    <DialogStackContext.Provider value={{ isTopMost: true }}>
      <CreateRepositoryGroup
        dispatcher={desktopDispatcher}
        editedGroupName={props.groupName}
        onDismissed={props.onDismiss}
        preselectedRepositoryIds={preselectedRepositoryIds}
        repositories={desktopRepositories}
      />
    </DialogStackContext.Provider>
  )
}

function DesktopRenameStashDialog(props: {
  readonly repositoryPath: string
  readonly stash: WebStash
  readonly dispatcher: WebDispatcher
  readonly onDismiss: () => void
}) {
  const desktopStash = React.useMemo(
    () => ({
      name: props.stash.name,
      branchName: props.stash.branchName,
      customName: props.stash.customName,
      stashSha: props.stash.stashSha,
      createdAt: new Date(props.stash.createdAt),
      files: { kind: StashedChangesLoadStates.NotLoaded as const },
      tree: props.stash.stashSha,
      parents: [],
    }),
    [props.stash]
  )
  const desktopDispatcher = React.useMemo(
    () =>
      ({
        renameStash: (
          _repository: Repository,
          _stash: typeof desktopStash,
          customName: string | null
        ) =>
          props.dispatcher.runOperation('stash-rename', {
            values: [props.stash.name],
            customName: customName || '',
          }),
      } as unknown as Dispatcher),
    [desktopStash, props.dispatcher, props.stash.name]
  )

  return (
    <DialogStackContext.Provider value={{ isTopMost: true }}>
      <RenameStashDialog
        dispatcher={desktopDispatcher}
        onDismissed={props.onDismiss}
        repository={getDesktopRepository(props.repositoryPath)}
        stash={desktopStash}
      />
    </DialogStackContext.Provider>
  )
}

function DesktopConfirmDiscardStashDialog(props: {
  readonly repositoryPath: string
  readonly stash: WebStash
  readonly askForConfirmation: boolean
  readonly dispatcher: WebDispatcher
  readonly onConfirmStashActionsChanged: (value: boolean) => void
  readonly onDismiss: () => void
}) {
  const desktopStash = React.useMemo(
    () => ({
      name: props.stash.name,
      branchName: props.stash.branchName,
      customName: props.stash.customName,
      stashSha: props.stash.stashSha,
      createdAt: new Date(props.stash.createdAt),
      files: { kind: StashedChangesLoadStates.NotLoaded as const },
      tree: props.stash.stashSha,
      parents: [],
    }),
    [props.stash]
  )
  const desktopDispatcher = React.useMemo(
    () =>
      ({
        dropStash: () =>
          props.dispatcher.runOperation('stash-drop', {
            values: [props.stash.name],
            confirmed: true,
          }),
        setConfirmDiscardStashSetting: (value: boolean) => {
          props.onConfirmStashActionsChanged(value)
          return Promise.resolve()
        },
      } as unknown as Dispatcher),
    [props.dispatcher, props.onConfirmStashActionsChanged, props.stash.name]
  )

  return (
    <DialogStackContext.Provider value={{ isTopMost: true }}>
      <ConfirmDiscardStashDialog
        askForConfirmationOnDiscardStash={props.askForConfirmation}
        dispatcher={desktopDispatcher}
        onDismissed={props.onDismiss}
        repository={getDesktopRepository(props.repositoryPath)}
        stash={desktopStash}
      />
    </DialogStackContext.Provider>
  )
}

function DesktopDiscardChangesDialog(props: {
  readonly repositoryPath: string
  readonly files: ReadonlyArray<WebFile>
  readonly permanentlyDelete: boolean
  readonly askForConfirmation: boolean
  readonly dispatcher: WebDispatcher
  readonly onConfirmDiscardChangesChanged: (value: boolean) => void
  readonly onDismiss: () => void
}) {
  const desktopFiles = React.useMemo(
    () => props.files.map(file => getDesktopWorkingDirectoryFile(file)),
    [props.files]
  )
  const desktopDispatcher = React.useMemo(
    () =>
      ({
        discardChanges: (
          _repository: Repository,
          files: ReadonlyArray<WorkingDirectoryFileChange>,
          moveToTrash: boolean,
          cleanUntracked: boolean
        ) =>
          props.dispatcher.discardFiles(
            files.map(file => file.path),
            moveToTrash,
            cleanUntracked
          ),
      } as unknown as Dispatcher),
    [props.dispatcher]
  )

  return (
    <DialogStackContext.Provider value={{ isTopMost: true }}>
      <DiscardChanges
        confirmDiscardChanges={props.askForConfirmation}
        discardingAllChanges={desktopFiles.length > 1}
        dispatcher={desktopDispatcher}
        files={desktopFiles}
        onConfirmDiscardChangesChanged={props.onConfirmDiscardChangesChanged}
        onDismissed={props.onDismiss}
        permanentlyDelete={props.permanentlyDelete}
        repository={getDesktopRepository(props.repositoryPath)}
        showDiscardChangesSetting={true}
      />
    </DialogStackContext.Provider>
  )
}

function DesktopChangesView(props: {
  readonly state: WebApplicationState
  readonly dispatcher: WebDispatcher
  readonly mode: 'sidebar' | 'content'
  readonly availableWidth: number
  readonly onStashActionChanged: (action: WebStashAction | null) => void
  readonly showCommitLengthWarning: boolean
  readonly commitSummaryLengthWarningThreshold: number
  readonly showChangesFilter: boolean
  readonly showStashedChanges: boolean
  readonly showCommitAuthorInfo: boolean
}) {
  const isCommitting =
    props.state.operationTask?.operation === 'commit' &&
    props.state.operationTask.status === 'running'
  const desktopFiles = React.useMemo(
    () =>
      (props.state.status?.workingDirectory.files || []).map(file =>
        getDesktopWorkingDirectoryFile(
          file,
          props.state.fileSelections.get(file.path)
        )
      ),
    [props.state.fileSelections, props.state.status?.workingDirectory.files]
  )
  const workingDirectory = React.useMemo(
    () => WorkingDirectoryStatus.fromFiles(desktopFiles),
    [desktopFiles]
  )
  const [selectedFileIDs, setSelectedFileIDs] = React.useState<
    ReadonlyArray<string>
  >([])
  const [discardRequest, setDiscardRequest] = React.useState<{
    readonly files: ReadonlyArray<WebFile>
    readonly permanentlyDelete: boolean
  } | null>(null)
  const [commitFilteredRequest, setCommitFilteredRequest] = React.useState<
    (() => void) | null
  >(null)
  const [stashToRename, setStashToRename] = React.useState<WebStash | null>(
    null
  )
  const sourceFiles = props.state.status?.workingDirectory.files || []
  const repositoryPath = props.state.selectedRepositoryPath || ''
  const changesScrollStorageKey = repositoryViewStorageKey(
    webChangesScrollStorageKey,
    props.state.selectedRepositoryPath
  )
  const [changesListScrollTop, setChangesListScrollTop] = React.useState(() =>
    Number(localStorage.getItem(changesScrollStorageKey) || 0)
  )
  React.useEffect(() => {
    setChangesListScrollTop(
      Number(localStorage.getItem(changesScrollStorageKey) || 0)
    )
  }, [changesScrollStorageKey])
  const desktopRepository = React.useMemo(
    () => getDesktopRepository(repositoryPath),
    [repositoryPath]
  )
  const stashEntries = React.useMemo(
    () =>
      props.showStashedChanges
        ? (props.state.branches?.stashes || []).map(stash => ({
            name: stash.name,
            branchName: stash.branchName,
            customName: stash.customName,
            stashSha: stash.stashSha,
            createdAt: new Date(stash.createdAt),
            files: { kind: StashedChangesLoadStates.NotLoaded as const },
            tree: stash.stashSha,
            parents: [],
          }))
        : [],
    [props.showStashedChanges, props.state.branches?.stashes]
  )
  const webStashBySha = React.useMemo(
    () =>
      new Map(
        (props.state.branches?.stashes || []).map(stash => [
          stash.stashSha,
          stash,
        ])
      ),
    [props.state.branches?.stashes]
  )
  const selectedStashEntry =
    props.state.inspectedStash === null
      ? null
      : stashEntries.find(
          entry => entry.stashSha === props.state.inspectedStash?.stashSha
        ) || null
  const selection: IChangesState['selection'] = selectedStashEntry
    ? {
        kind: ChangesSelectionKind.Stash,
        selectedStashEntry,
        selectedStashedFile: null,
        selectedStashedFileDiff: null,
      }
    : {
        kind: ChangesSelectionKind.WorkingDirectory,
        selectedFileIDs,
        diff: null,
      }
  const commitMessage = React.useMemo(
    () => ({
      summary: props.state.commitDraft.split(/\r?\n/)[0] || '',
      description: props.state.commitDraft
        .split(/\r?\n/)
        .slice(1)
        .join('\n')
        .replace(/^\n/, ''),
      timestamp: Date.now(),
    }),
    [props.state.commitDraft]
  )
  const desktopChanges: IChangesState = {
    workingDirectory,
    commitMessage,
    showCoAuthoredBy: false,
    coAuthors: [],
    conflictState: null,
    stashEntries,
    selection,
    currentBranchProtected: false,
    currentRepoRulesInfo: new RepoRulesInfo(),
    fileListFilter: props.state.changesFilter,
  }
  const commitAuthor =
    props.state.gitIdentity?.name && props.state.gitIdentity.email
      ? new CommitIdentity(
          props.state.gitIdentity.name,
          props.state.gitIdentity.email,
          new Date()
        )
      : null
  const mostRecentLocalCommit = React.useMemo(() => {
    const sha = props.state.branches?.localCommitSHAs?.[0]
    const commit = sha
      ? props.state.history.find(candidate => candidate.sha === sha)
      : null
    return commit ? getDesktopCommit(commit) : null
  }, [props.state.branches?.localCommitSHAs, props.state.history])

  React.useEffect(() => {
    const selectedFile = desktopFiles.find(
      file => file.path === props.state.selectedFilePath
    )
    setSelectedFileIDs(currentSelection => {
      const availableFileIDs = new Set(desktopFiles.map(file => file.id))
      const retainedSelection = currentSelection.filter(fileID =>
        availableFileIDs.has(fileID)
      )

      // Selecting a file loads its diff through the web store. That store only
      // tracks one path, but the shared Changes UI owns a multi-file selection.
      // Keep that richer local selection whenever it already contains the
      // diff file; otherwise synchronize a selection made outside the list.
      if (selectedFile && retainedSelection.includes(selectedFile.id)) {
        return retainedSelection
      }

      return selectedFile ? [selectedFile.id] : []
    })
  }, [desktopFiles, props.state.selectedFilePath])

  const desktopDispatcher = React.useMemo(
    () =>
      ({
        appendIgnoreFile: (_repository: Repository, file: string | string[]) =>
          props.dispatcher.appendIgnoreFile(
            Array.isArray(file) ? file : [file]
          ),
        appendIgnoreRule: (
          _repository: Repository,
          pattern: string | string[]
        ) =>
          props.dispatcher.appendIgnorePattern(
            Array.isArray(pattern) ? pattern : [pattern]
          ),
        cancelGenerateCommitMessage: () => undefined,
        changeFileIncluded: (
          _repository: Repository,
          file:
            | WorkingDirectoryFileChange
            | ReadonlyArray<WorkingDirectoryFileChange>,
          included: boolean
        ) => {
          const files = Array.isArray(file) ? file : [file]
          for (const selectedFile of files)
            props.dispatcher.setFileIncluded(selectedFile.path, included)
          return Promise.resolve()
        },
        clearBanner: () => undefined,
        commitIncludedChanges: async (
          _repository: Repository,
          context: ICommitContext
        ) => {
          await props.dispatcher.commit(
            [context.summary, context.description]
              .filter((part): part is string => Boolean(part))
              .join('\n\n'),
            {
              amend: context.amend === true,
              allowEmpty: props.state.commitOptions.allowEmpty,
              noVerify: props.state.commitOptions.noVerify,
              signOff: props.state.commitOptions.signOff,
              trailers: context.trailers || [],
            }
          )
          return true
        },
        copyPathToClipboard: (path: string) => props.dispatcher.copyText(path),
        copyPathsToClipboard: (paths: ReadonlyArray<string>) =>
          props.dispatcher.copyText(paths.join('\n')),
        createStashForCurrentBranch: () =>
          props.dispatcher.runOperation('stash', {
            values: sourceFiles.map(file => file.path),
            includeUntracked: true,
          }),
        discardChanges: (
          _repository: Repository,
          files: ReadonlyArray<WorkingDirectoryFileChange>,
          moveToTrash: boolean
        ) =>
          props.dispatcher.discardFiles(
            files.map(file => file.path),
            true,
            !moveToTrash
          ),
        generateCommitMessage: () => undefined,
        incrementMetric: () => undefined,
        applyStash: (
          _repository: Repository,
          entry: { readonly name: string }
        ) =>
          props.dispatcher.runOperation('stash-apply', {
            values: [entry.name],
          }),
        popStash: (_repository: Repository, entry: { readonly name: string }) =>
          props.dispatcher.runOperation('stash-pop', {
            values: [entry.name],
          }),
        promptOverrideWithGeneratedCommitMessage: () => undefined,
        refreshAuthor: () => undefined,
        selectStashedFile: (
          _repository: Repository,
          entry: { readonly stashSha: string }
        ) => {
          const stash = webStashBySha.get(entry.stashSha)
          return stash
            ? props.dispatcher.inspectStash(stash)
            : Promise.resolve()
        },
        selectWorkingDirectoryFiles: (
          _repository: Repository,
          files?: ReadonlyArray<WorkingDirectoryFileChange>
        ) => {
          const selected = files || []
          setSelectedFileIDs(selected.map(file => file.id))
          if (selected[0]) return props.dispatcher.selectFile(selected[0].path)
          props.dispatcher.clearStashInspection()
          return Promise.resolve()
        },
        setChangesListFilterText: (_repository: Repository, text: string) =>
          props.dispatcher.setChangesFilterText(text),
        setCoAuthors: () => undefined,
        setCommitMessage: (_repository: Repository, message: ICommitMessage) =>
          props.dispatcher.setCommitDraft(
            [message.summary, message.description]
              .filter((part): part is string => Boolean(part))
              .join('\n\n')
          ),
        setCommitMessageFocus: () => undefined,
        setCommitSpellcheckEnabled: props.dispatcher.setCommitSpellcheckEnabled,
        setFilterDeletedFiles: (_repository: Repository, enabled: boolean) =>
          props.dispatcher.setChangesFilterOption('isDeletedFile', enabled),
        setFilterExcludedFiles: (_repository: Repository, enabled: boolean) =>
          props.dispatcher.setChangesFilterOption(
            'isExcludedFromCommit',
            enabled
          ),
        setFilterModifiedFiles: (_repository: Repository, enabled: boolean) =>
          props.dispatcher.setChangesFilterOption('isModifiedFile', enabled),
        setFilterNewFiles: (_repository: Repository, enabled: boolean) =>
          props.dispatcher.setChangesFilterOption('isNewFile', enabled),
        setIncludedChangesInCommitFilter: (
          _repository: Repository,
          enabled: boolean
        ) =>
          props.dispatcher.setChangesFilterOption(
            'isIncludedInCommit',
            enabled
          ),
        setShowCoAuthoredBy: () => undefined,
        showCreateForkDialog: () => undefined,
        showFoldout: () => undefined,
        showPopup: (popup: {
          readonly type: PopupType
          readonly files?: ReadonlyArray<WorkingDirectoryFileChange>
          readonly permanentlyDelete?: boolean
          readonly onCommitAnyway?: () => void
          readonly stash?: { readonly stashSha: string }
        }) => {
          if (popup.type === PopupType.ConfirmDiscardChanges) {
            const paths = new Set((popup.files || []).map(file => file.path))
            setDiscardRequest({
              files: sourceFiles.filter(file => paths.has(file.path)),
              permanentlyDelete: popup.permanentlyDelete === true,
            })
          } else if (
            popup.type === PopupType.ConfirmCommitFilteredChanges &&
            popup.onCommitAnyway
          ) {
            setCommitFilteredRequest(() => popup.onCommitAnyway!)
          } else if (
            popup.type === PopupType.ConfirmDiscardStash &&
            popup.stash
          ) {
            const stash = webStashBySha.get(popup.stash.stashSha)
            if (stash)
              props.onStashActionChanged({
                operation: 'stash-drop',
                stash,
              })
          } else if (popup.type === PopupType.RenameStash && popup.stash) {
            setStashToRename(webStashBySha.get(popup.stash.stashSha) || null)
          }
          return Promise.resolve()
        },
        showUnknownAuthorsCommitWarning: (
          _authors: unknown,
          onCommitAnyway: () => void
        ) => onCommitAnyway(),
        stashChanges: (
          _repository: Repository,
          files: ReadonlyArray<WorkingDirectoryFileChange>
        ) =>
          props.dispatcher.runOperation('stash', {
            values: files.map(file => file.path),
            includeUntracked: true,
          }),
        stopAmendingRepository: props.dispatcher.stopAmendingCommit,
        undoCommit: () => props.dispatcher.runOperation('undo'),
      } as unknown as Dispatcher),
    [
      props.dispatcher,
      props.onStashActionChanged,
      props.state.commitOptions,
      sourceFiles,
      webStashBySha,
    ]
  )

  if (props.mode === 'sidebar') {
    return (
      <>
        <ChangesSidebar
          accounts={[]}
          aheadBehind={props.state.branches?.aheadBehind || null}
          askForConfirmationOnCommitFilteredChanges={true}
          askForConfirmationOnDiscardChanges={true}
          askForConfirmationOnDiscardStash={true}
          availableWidth={props.availableWidth}
          branch={props.state.branches?.branch?.name || null}
          changes={desktopChanges}
          commitAuthor={commitAuthor}
          commitMessageGenerationDisabled={true}
          commitSpellcheckEnabled={props.state.commitSpellcheckEnabled}
          commitToAmend={
            props.state.commitToAmend
              ? getDesktopCommit(props.state.commitToAmend)
              : null
          }
          dispatcher={desktopDispatcher}
          emoji={props.state.emoji}
          externalEditorLabel={undefined}
          focusCommitMessage={false}
          gitHubUserStore={{} as never}
          hookProgress={null}
          isCommitting={isCommitting}
          isGeneratingCommitMessage={false}
          isPushPullFetchInProgress={props.state.loading}
          isShowingFoldout={false}
          isShowingModal={false}
          issuesStore={{} as never}
          mostRecentLocalCommit={mostRecentLocalCommit}
          onChangesListScrolled={scrollTop => {
            localStorage.setItem(changesScrollStorageKey, String(scrollTop))
            setChangesListScrollTop(scrollTop)
          }}
          changesListScrollTop={changesListScrollTop}
          onOpenInExternalEditor={path =>
            void props.dispatcher.openIntegration(
              'editor',
              `${repositoryPath.replace(/[\\/]+$/, '')}/${path.replace(
                /^[\\/]+/,
                ''
              )}`
            )
          }
          onShowCommitProgress={undefined}
          onUpdateCommitOptions={(_repository, options) => {
            if (options.skipCommitHooks !== undefined)
              props.dispatcher.setCommitOption(
                'noVerify',
                options.skipCommitHooks
              )
            if (options.signOffCommits !== undefined)
              props.dispatcher.setCommitOption(
                'signOff',
                options.signOffCommits
              )
            if (options.allowEmptyCommit !== undefined)
              props.dispatcher.setCommitOption(
                'allowEmpty',
                options.allowEmptyCommit
              )
          }}
          repository={desktopRepository}
          shouldNudgeToCommit={false}
          shouldShowGenerateCommitMessageCallOut={false}
          showChangesFilter={props.showChangesFilter}
          fileListRowHeight={32}
          showCommitAuthorInfo={props.showCommitAuthorInfo}
          showCommitLengthWarning={props.showCommitLengthWarning}
          signOffCommits={props.state.commitOptions.signOff}
          skipCommitHooks={props.state.commitOptions.noVerify}
          allowEmptyCommit={props.state.commitOptions.allowEmpty}
        />
        {discardRequest ? (
          <DesktopDiscardChangesDialog
            askForConfirmation={true}
            dispatcher={props.dispatcher}
            files={discardRequest.files}
            onConfirmDiscardChangesChanged={value =>
              setBoolean(webConfirmDiscardChangesStorageKey, value)
            }
            onDismiss={() => setDiscardRequest(null)}
            permanentlyDelete={discardRequest.permanentlyDelete}
            repositoryPath={repositoryPath}
          />
        ) : null}
        {commitFilteredRequest ? (
          <DialogStackContext.Provider value={{ isTopMost: true }}>
            <ConfirmCommitFilteredChanges
              onCommitAnyway={commitFilteredRequest}
              onDismissed={() => setCommitFilteredRequest(null)}
              setConfirmCommitFilteredChanges={() => undefined}
              showFilesToBeCommitted={() => {
                props.dispatcher.setChangesFilterText('')
                props.dispatcher.setChangesFilterOption(
                  'isIncludedInCommit',
                  true
                )
                props.dispatcher.setChangesFilterOption(
                  'isExcludedFromCommit',
                  false
                )
                props.dispatcher.setChangesFilterOption('isNewFile', false)
                props.dispatcher.setChangesFilterOption('isModifiedFile', false)
                props.dispatcher.setChangesFilterOption('isDeletedFile', false)
              }}
            />
          </DialogStackContext.Provider>
        ) : null}
        {stashToRename ? (
          <DesktopRenameStashDialog
            dispatcher={props.dispatcher}
            onDismiss={() => setStashToRename(null)}
            repositoryPath={repositoryPath}
            stash={stashToRename}
          />
        ) : null}
      </>
    )
  }

  return props.state.inspectedStash && props.state.selectedRepositoryPath ? (
    <StashDiffView
      diff={props.state.stashDiff}
      dispatcher={props.dispatcher}
      files={props.state.stashFiles}
      loading={props.state.loading}
      repositoryPath={props.state.selectedRepositoryPath}
      selectedFilePath={props.state.selectedStashFilePath}
      stash={props.state.inspectedStash}
    />
  ) : (
    <DesktopDiffView dispatcher={props.dispatcher} state={props.state} />
  )
}

function DesktopDiffView(props: {
  readonly state: WebApplicationState
  readonly dispatcher: WebDispatcher
}) {
  const isCommitting =
    props.state.operationTask?.operation === 'commit' &&
    props.state.operationTask.status === 'running'
  const preferences = useWebDiffPresentationPreferences()
  const [pendingDiscard, setPendingDiscard] = React.useState<{
    readonly file: WorkingDirectoryFileChange
    readonly diff: ITextDiff
    readonly selection: DiffSelection
  } | null>(null)
  const files = (props.state.status?.workingDirectory.files || []).map(
    sourceFile =>
      getDesktopWorkingDirectoryFile(
        sourceFile,
        props.state.fileSelections.get(sourceFile.path)
      )
  )
  const file =
    files.find(item => item.path === props.state.selectedFilePath) || null
  const sourceFile =
    props.state.status?.workingDirectory.files.find(
      item => item.path === props.state.selectedFilePath
    ) || null
  const diff =
    file && sourceFile?.status.submoduleStatus
      ? getDesktopSubmoduleDiff(sourceFile, props.state.diff)
      : getDesktopDiff(props.state.diff)
  const externalFileContents =
    file && props.state.diff?.fileContents
      ? {
          file,
          oldContents: props.state.diff.fileContents.oldContents,
          newContents: props.state.diff.fileContents.newContents,
          canBeExpanded: props.state.diff.fileContents.canBeExpanded,
        }
      : null
  const getSelectableLines = (textDiff: ITextDiff) =>
    new Set(
      textDiff.hunks.flatMap(hunk =>
        hunk.lines.flatMap((line, index) =>
          line.type === DiffLineType.Add || line.type === DiffLineType.Delete
            ? [hunk.unifiedDiffStart + index]
            : []
        )
      )
    )
  const updateSelection = (selection: DiffSelection) => {
    if (!file || !diff || diff.kind !== DiffType.Text) return
    const selectableLines = getSelectableLines(diff)
    const normalizedSelection = selection.withSelectableLines(selectableLines)
    const patch =
      normalizedSelection.getSelectionType() === DiffSelectionType.Partial
        ? formatPatch(file.withSelection(normalizedSelection), diff)
        : null
    props.dispatcher.setFileSelection(file.path, normalizedSelection, patch)
  }

  if (!props.state.selectedRepositoryPath) return null

  if (!file) {
    return (
      <NoChanges
        appMenu={webSuggestedActionsMenu}
        dispatcher={
          { incrementMetric: () => undefined } as unknown as Dispatcher
        }
        isExternalEditorAvailable={false}
        repository={getDesktopRepository(props.state.selectedRepositoryPath)}
        repositoryState={
          {
            aheadBehind: props.state.branches?.aheadBehind || null,
            branchesState: {
              currentPullRequest: null,
              defaultBranch: null,
              tip: getDesktopBranch(props.state.branches?.branch)
                ? {
                    kind: TipState.Valid,
                    branch: getDesktopBranch(props.state.branches?.branch)!,
                  }
                : {
                    kind: TipState.Detached,
                    currentSha: '',
                  },
            },
            changesState: { stashEntries: [] },
            remote: null,
            tagsToPush: null,
          } as unknown as IRepositoryState
        }
      />
    )
  }

  return (
    <>
      <Changes
        askForConfirmationOnDiscardChanges={true}
        diff={diff}
        externalFileContents={externalFileContents}
        key={file.id}
        dispatcher={
          {
            changeFileLineSelection: (
              _repository: Repository,
              _file: WorkingDirectoryFileChange,
              selection: DiffSelection
            ) => updateSelection(selection),
            changeImageDiffType: preferences.onImageDiffTypeChanged,
            onHideWhitespaceInChangesDiffChanged: (
              value: boolean,
              _repository: Repository
            ) => {
              preferences.onHideWhitespaceInDiffChanged(value)
              return Promise.resolve()
            },
            onShowDiffMinimapChanged: preferences.onShowDiffMinimapChanged,
            onShowSideBySideDiffChanged:
              preferences.onShowSideBySideDiffChanged,
            onWrapDiffLinesChanged: preferences.onWrapDiffLinesChanged,
            showPopup: (popup: {
              readonly type: PopupType
              readonly diff?: ITextDiff
              readonly selection?: DiffSelection
            }) => {
              if (
                popup.type === PopupType.ConfirmDiscardSelection &&
                popup.diff &&
                popup.selection
              )
                setPendingDiscard({
                  file,
                  diff: popup.diff,
                  selection: popup.selection.withSelectableLines(
                    getSelectableLines(popup.diff)
                  ),
                })
            },
          } as unknown as Dispatcher
        }
        file={file}
        hideWhitespaceInDiff={preferences.hideWhitespaceInDiff}
        imageDiffType={preferences.imageDiffType}
        isCommitting={isCommitting}
        onChangeImageDiffType={preferences.onImageDiffTypeChanged}
        onDiffOptionsOpened={() => undefined}
        onOpenBinaryFile={fullPath => void props.dispatcher.openPath(fullPath)}
        onOpenSubmodule={fullPath =>
          void props.dispatcher.selectRepository(fullPath)
        }
        repository={getDesktopRepository(props.state.selectedRepositoryPath)}
        showDiffCheckMarks={preferences.showDiffCheckMarks}
        showDiffMinimap={preferences.showDiffMinimap}
        showSideBySideDiff={preferences.showSideBySideDiff}
        wrapDiffLines={preferences.wrapDiffLines}
      />
      {pendingDiscard ? (
        <DialogStackContext.Provider value={{ isTopMost: true }}>
          <DiscardSelection
            diff={pendingDiscard.diff}
            dispatcher={
              {
                discardChangesFromSelection: (
                  _repository: Repository,
                  path: string,
                  textDiff: ITextDiff,
                  selection: DiffSelection
                ) => {
                  const patch = formatPatchToDiscardChanges(
                    path,
                    textDiff,
                    selection
                  )
                  return patch
                    ? props.dispatcher.runOperation('discard-patch', { patch })
                    : Promise.resolve()
                },
                setConfirmDiscardChangesSetting: (value: boolean) => {
                  setBoolean(webConfirmDiscardChangesStorageKey, value)
                  return Promise.resolve()
                },
              } as unknown as Dispatcher
            }
            file={pendingDiscard.file}
            onDismissed={() => setPendingDiscard(null)}
            repository={getDesktopRepository(
              props.state.selectedRepositoryPath
            )}
            selection={pendingDiscard.selection}
          />
        </DialogStackContext.Provider>
      ) : null}
    </>
  )
}

function StashDiffView(props: {
  readonly repositoryPath: string
  readonly stash: WebStash
  readonly files: ReadonlyArray<WebFile>
  readonly selectedFilePath: string | null
  readonly diff: WebDiff | null
  readonly loading: boolean
  readonly dispatcher: WebDispatcher
}) {
  const preferences = useWebDiffPresentationPreferences()
  const [fileListWidth, setFileListWidth] = React.useState(() =>
    Math.min(600, Math.max(100, getNumber('stashed-files-width', 250)))
  )
  const [popup, setPopup] = React.useState<'discard' | 'rename' | null>(null)
  const desktopFiles = React.useMemo(
    () =>
      props.files.map(
        file =>
          new CommittedFileChange(
            file.path,
            getDesktopFileStatus(file),
            props.stash.stashSha,
            `${props.stash.stashSha}^`
          )
      ),
    [props.files, props.stash.stashSha]
  )
  const selectedStashedFile =
    desktopFiles.find(file => file.path === props.selectedFilePath) || null
  const externalFileContents =
    selectedStashedFile && props.diff?.fileContents
      ? {
          file: selectedStashedFile,
          oldContents: props.diff.fileContents.oldContents,
          newContents: props.diff.fileContents.newContents,
          canBeExpanded: props.diff.fileContents.canBeExpanded,
        }
      : null
  const desktopStash = React.useMemo(
    () => ({
      name: props.stash.name,
      branchName: props.stash.branchName,
      customName: props.stash.customName,
      stashSha: props.stash.stashSha,
      createdAt: new Date(props.stash.createdAt),
      files: {
        kind: StashedChangesLoadStates.Loaded,
        files: desktopFiles,
      },
      tree: props.stash.stashSha,
      parents: [],
    }),
    [desktopFiles, props.stash]
  )
  const desktopDispatcher = React.useMemo(
    () =>
      ({
        applyStash: () =>
          props.dispatcher.runOperation('stash-apply', {
            values: [props.stash.name],
          }),
        dropStash: () =>
          props.dispatcher.runOperation('stash-drop', {
            values: [props.stash.name],
            confirmed: true,
          }),
        popStash: () =>
          props.dispatcher.runOperation('stash-pop', {
            values: [props.stash.name],
          }),
        renameStash: (
          _repository: Repository,
          _stash: typeof desktopStash,
          customName: string | null
        ) =>
          props.dispatcher.runOperation('stash-rename', {
            values: [props.stash.name],
            customName: customName || '',
          }),
        resetStashedFilesWidth: () => {
          setNumber('stashed-files-width', 250)
          setFileListWidth(250)
          return Promise.resolve()
        },
        selectStashedFile: (
          _repository: Repository,
          _stash: typeof desktopStash,
          file?: CommittedFileChange | null
        ) =>
          file
            ? props.dispatcher.selectStashFile(file.path)
            : props.dispatcher.clearStashInspection(),
        selectWorkingDirectoryFiles: () =>
          props.dispatcher.clearStashInspection(),
        setConfirmDiscardStashSetting: () => undefined,
        setStashedFilesWidth: (width: number) => {
          setNumber('stashed-files-width', width)
          setFileListWidth(width)
          return Promise.resolve()
        },
        showPopup: (nextPopup: { readonly type: PopupType }) => {
          if (nextPopup.type === PopupType.ConfirmDiscardStash)
            setPopup('discard')
          if (nextPopup.type === PopupType.RenameStash) setPopup('rename')
        },
      } as unknown as Dispatcher),
    [desktopStash, props.dispatcher, props.stash.name]
  )

  return (
    <>
      <StashDiffViewer
        askForConfirmationOnDiscardStash={true}
        dispatcher={desktopDispatcher}
        fileListWidth={{
          value: fileListWidth,
          min: 100,
          max: Math.max(100, window.innerWidth - 150),
        }}
        fileListRowHeight={32}
        compactHeader={true}
        imageDiffType={preferences.imageDiffType}
        onChangeImageDiffType={preferences.onImageDiffTypeChanged}
        onHideWhitespaceInDiffChanged={
          preferences.onHideWhitespaceInDiffChanged
        }
        onOpenBinaryFile={fullPath => void props.dispatcher.openPath(fullPath)}
        onOpenInExternalEditor={path =>
          void props.dispatcher.openIntegration(
            'editor',
            `${props.repositoryPath.replace(/[\\/]+$/, '')}/${path.replace(
              /^[\\/]+/,
              ''
            )}`
          )
        }
        onOpenSubmodule={fullPath =>
          void props.dispatcher.selectRepository(fullPath)
        }
        repository={getDesktopRepository(props.repositoryPath)}
        selectedStashedFile={selectedStashedFile}
        externalFileContents={externalFileContents}
        showDiffMinimap={preferences.showDiffMinimap}
        showSideBySideDiff={preferences.showSideBySideDiff}
        stashedFileDiff={getDesktopDiff(props.diff)}
        stashEntry={desktopStash}
        wrapDiffLines={preferences.wrapDiffLines}
      />
      {popup === 'discard' ? (
        <DialogStackContext.Provider value={{ isTopMost: true }}>
          <ConfirmDiscardStashDialog
            askForConfirmationOnDiscardStash={true}
            dispatcher={desktopDispatcher}
            onDismissed={() => setPopup(null)}
            repository={getDesktopRepository(props.repositoryPath)}
            stash={desktopStash}
          />
        </DialogStackContext.Provider>
      ) : null}
      {popup === 'rename' ? (
        <DialogStackContext.Provider value={{ isTopMost: true }}>
          <RenameStashDialog
            dispatcher={desktopDispatcher}
            onDismissed={() => setPopup(null)}
            repository={getDesktopRepository(props.repositoryPath)}
            stash={desktopStash}
          />
        </DialogStackContext.Provider>
      ) : null}
    </>
  )
}

function DesktopSelectedCommits(props: {
  readonly state: WebApplicationState
  readonly dispatcher: WebDispatcher
  readonly selectedCommits: ReadonlyArray<Commit>
  readonly selectedCommitsWeb: ReadonlyArray<
    WebApplicationState['history'][number]
  >
  readonly shasInDiff: ReadonlyArray<string>
  readonly isContiguous: boolean
}) {
  const preferences = useWebDiffPresentationPreferences()
  const [commitSummaryWidth, setCommitSummaryWidth] = React.useState(() =>
    Math.min(600, Math.max(100, getNumber('commit-summary-width', 250)))
  )
  const repositoryPath = props.state.selectedRepositoryPath
  const selectedCommit =
    props.selectedCommits.length === 1 ? props.selectedCommits[0] : null
  const selectedCommitWeb =
    props.selectedCommitsWeb.length === 1 ? props.selectedCommitsWeb[0] : null
  const details =
    selectedCommitWeb &&
    props.state.selectedHistoryCommitSHA === selectedCommit?.sha
      ? props.state.historyCommitDetails
      : null
  const files =
    selectedCommitWeb && details
      ? details.files.map(file =>
          getDesktopCommittedFile(file, selectedCommitWeb)
        )
      : []
  const selectedFile =
    selectedCommitWeb && details && props.state.selectedHistoryFilePath
      ? files.find(file => file.path === props.state.selectedHistoryFilePath) ||
        null
      : null
  const webSelectedFile =
    details?.files.find(file => file.path === selectedFile?.path) || null
  const currentDiff =
    selectedFile && webSelectedFile?.status.submoduleStatus
      ? getDesktopSubmoduleDiff(webSelectedFile, props.state.historyDiff)
      : getDesktopDiff(props.state.historyDiff)
  const externalFileContents =
    selectedFile && props.state.historyDiff?.fileContents
      ? {
          file: selectedFile,
          oldContents: props.state.historyDiff.fileContents.oldContents,
          newContents: props.state.historyDiff.fileContents.newContents,
          canBeExpanded: props.state.historyDiff.fileContents.canBeExpanded,
        }
      : null
  const desktopDispatcher = React.useMemo(
    () =>
      ({
        changeFileSelection: (
          _repository: Repository,
          file: CommittedFileChange
        ) => props.dispatcher.selectHistoryFile(file.path),
        changeImageDiffType: preferences.onImageDiffTypeChanged,
        copyPathToClipboard: (path: string) => props.dispatcher.copyText(path),
        copyPathsToClipboard: (paths: ReadonlyArray<string>) =>
          props.dispatcher.copyText(paths.join('\n')),
        onHideWhitespaceInHistoryDiffChanged: (
          value: boolean,
          _repository: Repository,
          _file: CommittedFileChange
        ) => {
          preferences.onHideWhitespaceInDiffChanged(value)
          return Promise.resolve()
        },
        onShowDiffMinimapChanged: preferences.onShowDiffMinimapChanged,
        onShowSideBySideDiffChanged: preferences.onShowSideBySideDiffChanged,
        onWrapDiffLinesChanged: preferences.onWrapDiffLinesChanged,
        resetCommitSummaryWidth: () => {
          setNumber('commit-summary-width', 250)
          setCommitSummaryWidth(250)
          return Promise.resolve()
        },
        setCommitSummaryWidth: (width: number) => {
          setNumber('commit-summary-width', width)
          setCommitSummaryWidth(width)
          return Promise.resolve()
        },
        showUnreachableCommits: () => undefined,
        updateShasToHighlight: () => undefined,
      } as unknown as Dispatcher),
    [preferences, props.dispatcher]
  )

  if (!repositoryPath) return null

  return (
    <SelectedCommits
      accounts={[]}
      changesetData={{
        files,
        linesAdded: details?.linesAdded || 0,
        linesDeleted: details?.linesDeleted || 0,
      }}
      commitSummaryWidth={{
        value: commitSummaryWidth,
        min: 100,
        max: Math.max(100, window.innerWidth - 150),
      }}
      currentDiff={currentDiff}
      externalFileContents={externalFileContents}
      fileListRowHeight={32}
      dispatcher={desktopDispatcher}
      emoji={props.state.emoji}
      externalEditorLabel={undefined}
      hideWhitespaceInDiff={preferences.hideWhitespaceInDiff}
      isContiguous={props.isContiguous}
      localCommitSHAs={props.state.branches?.localCommitSHAs || []}
      onChangeImageDiffType={preferences.onImageDiffTypeChanged}
      onDiffOptionsOpened={() => undefined}
      onOpenBinaryFile={fullPath => void props.dispatcher.openPath(fullPath)}
      onOpenInExternalEditor={path =>
        void props.dispatcher.openIntegration(
          'editor',
          `${repositoryPath.replace(/[\\/]+$/, '')}/${path.replace(
            /^[\\/]+/,
            ''
          )}`
        )
      }
      onOpenSubmodule={fullPath =>
        void props.dispatcher.selectRepository(fullPath)
      }
      onViewCommitOnGitHub={() => undefined}
      repository={getDesktopRepository(repositoryPath)}
      selectedCommits={props.selectedCommits}
      selectedDiffType={preferences.imageDiffType}
      selectedFile={selectedFile}
      shasInDiff={props.shasInDiff}
      showDiffMinimap={preferences.showDiffMinimap}
      showDragOverlay={false}
      showSideBySideDiff={preferences.showSideBySideDiff}
      wrapDiffLines={preferences.wrapDiffLines}
    />
  )
}

function DesktopHistoryView(props: {
  readonly state: WebApplicationState
  readonly dispatcher: WebDispatcher
  readonly mode: 'sidebar' | 'content'
  readonly selectedSHAs: ReadonlyArray<string>
  readonly onSelectedSHAsChanged: (shas: ReadonlyArray<string>) => void
  readonly confirmCheckoutCommit: boolean
  readonly onConfirmCheckoutCommitChanged: (value: boolean) => void
  readonly preferAbsoluteDates: boolean
  readonly showConventionalCommitBadges: boolean
  readonly onCommitMessagePopup: (popup: CommitMessagePopup | null) => void
  readonly onHistoryRewriteStarted: (
    kind: HistoryRewriteKind,
    count: number
  ) => void
}) {
  if (props.mode === 'sidebar') {
    const commits = props.state.history.map(getDesktopCommit)
    const commitLookup = new Map(commits.map(commit => [commit.sha, commit]))
    const selectedCommit =
      props.selectedSHAs.length === 1
        ? commitLookup.get(props.selectedSHAs[0]) || null
        : null
    const [resetDialogOpen, setResetDialogOpen] = React.useState(false)
    const [cherryPickCommits, setCherryPickCommits] =
      React.useState<ReadonlyArray<Commit> | null>(null)
    const [tagToDelete, setTagToDelete] = React.useState<{
      readonly name: string
      readonly remotes: ReadonlyArray<string>
    } | null>(null)
    const [selectedCommitAction, setSelectedCommitAction] = React.useState<
      | { readonly kind: 'branch' | 'tag'; readonly commit: Commit }
      | {
          readonly kind: 'checkout'
          readonly commit: WebApplicationState['history'][number]
        }
      | null
    >(null)
    return (
      <>
        <DesktopCommitGraphSidebar
          dispatcher={props.dispatcher}
          onAmendCommit={commit => {
            props.onSelectedSHAsChanged([commit.sha])
            void props.dispatcher.startAmendingCommit(commit.sha)
          }}
          onCheckoutCommit={commit => {
            props.onSelectedSHAsChanged([commit.sha])
            const webCommit = props.state.history.find(
              candidate => candidate.sha === commit.sha
            )
            if (webCommit)
              setSelectedCommitAction({ kind: 'checkout', commit: webCommit })
          }}
          onCherryPick={commits => setCherryPickCommits(commits)}
          onCommitMessagePopup={props.onCommitMessagePopup}
          onCreateBranch={commit => {
            props.onSelectedSHAsChanged([commit.sha])
            setSelectedCommitAction({ kind: 'branch', commit })
          }}
          onCreateTag={commit => {
            props.onSelectedSHAsChanged([commit.sha])
            setSelectedCommitAction({ kind: 'tag', commit })
          }}
          onDeleteTag={name => {
            void props.dispatcher
              .loadRemoteTagMetadata()
              .then(branches => {
                const tag = branches.tags?.find(
                  candidate => candidate.name === name
                )
                setTagToDelete({
                  name,
                  remotes: tag?.pushedRemotes || [],
                })
              })
              .catch(() => undefined)
          }}
          onResetToCommit={commit => {
            props.onSelectedSHAsChanged([commit.sha])
            setResetDialogOpen(true)
          }}
          onRevertCommit={commit =>
            void props.dispatcher
              .runOperation('revert', { values: [commit.sha] })
              .then(() => props.onSelectedSHAsChanged([]))
          }
          onSelectedSHAsChanged={selectedSHAs => {
            props.onSelectedSHAsChanged(selectedSHAs)
            if (selectedSHAs.length === 1)
              void props.dispatcher.inspectHistoryCommit(selectedSHAs[0])
            else props.dispatcher.clearHistoryInspection()
          }}
          onUndoCommit={() =>
            void props.dispatcher
              .runOperation('undo')
              .then(() => props.onSelectedSHAsChanged([]))
          }
          onHistoryRewriteStarted={props.onHistoryRewriteStarted}
          preferAbsoluteDates={props.preferAbsoluteDates}
          selectedSHAs={props.selectedSHAs}
          showConventionalCommitBadges={props.showConventionalCommitBadges}
          state={props.state}
        />
        {resetDialogOpen && selectedCommit ? (
          <DesktopResetWarningDialog
            commit={selectedCommit}
            dispatcher={props.dispatcher}
            onDismiss={() => {
              setResetDialogOpen(false)
              props.onSelectedSHAsChanged([])
            }}
            repositoryPath={props.state.selectedRepositoryPath || ''}
          />
        ) : null}
        {selectedCommitAction?.kind === 'branch' ? (
          <DesktopCreateBranchAtCommitDialog
            branches={props.state.branches?.branches || []}
            commit={selectedCommitAction.commit}
            currentBranch={props.state.branches?.branch}
            defaultBranch={props.state.branches?.defaultBranch || null}
            dispatcher={props.dispatcher}
            onDismiss={() => {
              setSelectedCommitAction(null)
              props.onSelectedSHAsChanged([])
            }}
            repositoryPath={props.state.selectedRepositoryPath || ''}
          />
        ) : null}
        {selectedCommitAction?.kind === 'tag' ? (
          <DesktopCreateTagDialog
            dispatcher={props.dispatcher}
            onDismiss={() => {
              setSelectedCommitAction(null)
              props.onSelectedSHAsChanged([])
            }}
            repositoryPath={props.state.selectedRepositoryPath || ''}
            tags={props.state.branches?.tags || []}
            targetCommitSha={selectedCommitAction.commit.sha}
          />
        ) : null}
        {selectedCommitAction?.kind === 'checkout' ? (
          <DesktopConfirmCheckoutCommitDialog
            askForConfirmation={props.confirmCheckoutCommit}
            commit={selectedCommitAction.commit}
            dispatcher={props.dispatcher}
            onConfirmCheckoutCommitChanged={
              props.onConfirmCheckoutCommitChanged
            }
            onDismiss={() => {
              setSelectedCommitAction(null)
              props.onSelectedSHAsChanged([])
            }}
            repositoryPath={props.state.selectedRepositoryPath || ''}
          />
        ) : null}
        {cherryPickCommits ? (
          <DesktopChooseCherryPickTargetDialog
            branches={props.state.branches?.branches || []}
            commits={cherryPickCommits}
            currentBranch={props.state.branches?.branch}
            defaultBranch={props.state.branches?.defaultBranch || null}
            dispatcher={props.dispatcher}
            onDismiss={() => {
              setCherryPickCommits(null)
              props.onSelectedSHAsChanged([])
            }}
            repositoryPath={props.state.selectedRepositoryPath || ''}
          />
        ) : null}
        {tagToDelete ? (
          tagToDelete.remotes.length ? (
            <DesktopConfirmDeletePushedTagDialog
              dispatcher={props.dispatcher}
              onDeleted={() => undefined}
              onDismiss={() => setTagToDelete(null)}
              repositoryPath={props.state.selectedRepositoryPath || ''}
              tagName={tagToDelete.name}
            />
          ) : (
            <DesktopDeleteTagDialog
              dispatcher={props.dispatcher}
              onDeleted={() => undefined}
              onDismiss={() => setTagToDelete(null)}
              repositoryPath={props.state.selectedRepositoryPath || ''}
              tagName={tagToDelete.name}
            />
          )
        ) : null}
      </>
    )
  }

  return (
    <DesktopHistoryContentView
      dispatcher={props.dispatcher}
      onSelectedSHAsChanged={props.onSelectedSHAsChanged}
      preferAbsoluteDates={props.preferAbsoluteDates}
      selectedSHAs={props.selectedSHAs}
      showConventionalCommitBadges={props.showConventionalCommitBadges}
      state={props.state}
    />
  )
}

function DesktopHistoryContentView(props: {
  readonly state: WebApplicationState
  readonly dispatcher: WebDispatcher
  readonly selectedSHAs: ReadonlyArray<string>
  readonly onSelectedSHAsChanged: (shas: ReadonlyArray<string>) => void
  readonly preferAbsoluteDates: boolean
  readonly showConventionalCommitBadges: boolean
}) {
  const commits = props.state.history.map(getDesktopCommit)
  const selectedCommits = commits.filter(commit =>
    props.selectedSHAs.includes(commit.sha)
  )
  const selectedCommit =
    selectedCommits.length === 1 ? selectedCommits[0] : null
  const selectedCommitsWeb = props.state.history.filter(commit =>
    props.selectedSHAs.includes(commit.sha)
  )

  if (selectedCommits.length === 0 || !props.state.selectedRepositoryPath)
    return null

  return (
    <DesktopSelectedCommits
      dispatcher={props.dispatcher}
      isContiguous={true}
      selectedCommits={selectedCommits}
      selectedCommitsWeb={selectedCommitsWeb}
      shasInDiff={selectedCommit ? [selectedCommit.sha] : []}
      state={props.state}
    />
  )
}

function DesktopCompareView(props: {
  readonly state: WebApplicationState
  readonly dispatcher: WebDispatcher
  readonly mode: 'sidebar' | 'content'
  readonly selectedSHAs: ReadonlyArray<string>
  readonly onSelectedSHAsChanged: (shas: ReadonlyArray<string>) => void
  readonly preferAbsoluteDates: boolean
  readonly showConventionalCommitBadges: boolean
  readonly onCommitMessagePopup: (popup: CommitMessagePopup | null) => void
  readonly onHistoryRewriteStarted: (
    kind: HistoryRewriteKind,
    count: number
  ) => void
}) {
  const branches = React.useMemo(
    () =>
      (props.state.branches?.branches || [])
        .map(getDesktopBranch)
        .filter((branch): branch is Branch => branch !== null)
        .filter(branch => !branch.name.endsWith('/HEAD')),
    [props.state.branches?.branches]
  )
  const currentBranch = React.useMemo(
    () => getDesktopBranch(props.state.branches?.branch),
    [props.state.branches?.branch]
  )
  const comparisonBranch = React.useMemo(
    () =>
      branches.find(branch => branch.name === props.state.comparisonBranch) ||
      null,
    [branches, props.state.comparisonBranch]
  )
  const comparisonCommits = React.useMemo(
    () => (props.state.comparison?.commits || []).map(getDesktopCommit),
    [props.state.comparison?.commits]
  )
  const comparisonLookup = React.useMemo(
    () => new Map(comparisonCommits.map(commit => [commit.sha, commit])),
    [comparisonCommits]
  )
  const comparisonMode =
    props.state.comparisonMode === 'Ahead'
      ? ComparisonMode.Ahead
      : ComparisonMode.Behind
  const repository = React.useMemo(
    () => getDesktopRepository(props.state.selectedRepositoryPath || ''),
    [props.state.selectedRepositoryPath]
  )
  const aheadBehindStore = React.useMemo(() => new AheadBehindStore(), [])
  const compareScrollStorageKey = repositoryViewStorageKey(
    webCompareScrollStorageKey,
    props.state.selectedRepositoryPath
  )
  const [resetCommit, setResetCommit] = React.useState<Commit | null>(null)

  const desktopDispatcher = React.useMemo(
    () =>
      ({
        changeCommitSelection: (
          _repository: Repository,
          shas: ReadonlyArray<string>
        ) => {
          props.onSelectedSHAsChanged(shas)
          if (shas.length === 1)
            return props.dispatcher.inspectHistoryCommit(shas[0])
          props.dispatcher.clearHistoryInspection()
          return Promise.resolve()
        },
        checkoutCommit: (_repository: Repository, commit: Commit) =>
          props.dispatcher.runOperation('checkout-commit', {
            values: [commit.sha],
          }),
        clearDragElement: () => undefined,
        executeCompare: (
          _repository: Repository,
          action:
            | { readonly kind: HistoryTabMode.History }
            | {
                readonly kind: HistoryTabMode.Compare
                readonly branch: Branch
                readonly comparisonMode: ComparisonMode
              }
        ) => {
          if (action.kind === HistoryTabMode.History) {
            void props.dispatcher.selectSection('history')
            return Promise.resolve()
          }
          return props.dispatcher.loadComparison(
            action.branch.name,
            action.comparisonMode === ComparisonMode.Ahead ? 'Ahead' : 'Behind'
          )
        },
        getCommitChangedFiles: () => Promise.resolve([]),
        initializeCompare: () => {
          if (!props.state.comparisonBranch)
            props.dispatcher.setComparisonBranchListVisible(true)
          return Promise.resolve()
        },
        incrementMetric: () => undefined,
        initializeMultiCommitOperation: () => undefined,
        loadChangedFilesForCurrentSelection: () => Promise.resolve(),
        loadNextCommitBatch: () => props.dispatcher.loadMoreHistory(),
        closePopup: () => props.onCommitMessagePopup(null),
        mergeBranch: (
          _repository: Repository,
          branch: Branch,
          _status: unknown,
          squash = false
        ) =>
          props.dispatcher.runOperation(squash ? 'squash-merge' : 'merge', {
            values: [branch.name],
          }),
        openInExternalEditor: () => Promise.resolve(),
        recordSquashInvoked: () => undefined,
        resetToCommit: (_repository: Repository, commit: Commit) =>
          setResetCommit(commit),
        reorderCommits: (
          _repository: Repository,
          commitsToReorder: ReadonlyArray<Commit>,
          beforeCommit: Commit | null,
          lastRetainedCommitRef: string | null
        ) => {
          props.onHistoryRewriteStarted('reorder', commitsToReorder.length)
          return props.dispatcher
            .runOperation('reorder-commits', {
              base: lastRetainedCommitRef,
              commits: commitsToReorder.map(commit => commit.sha),
              before: beforeCommit?.sha || null,
            })
            .then(() => props.onSelectedSHAsChanged([]))
        },
        setCommitSearchQuery: () => Promise.resolve(),
        setDragElement: () => undefined,
        showCreateTagDialog: () => undefined,
        showDeleteTagDialog: () => undefined,
        showPopup: (popup: Popup) => {
          if (popup.type === PopupType.CommitMessage)
            props.onCommitMessagePopup(popup)
          return Promise.resolve()
        },
        squash: (
          _repository: Repository,
          toSquash: ReadonlyArray<Commit>,
          squashOnto: Commit,
          lastRetainedCommitRef: string | null,
          context: ICommitContext
        ) => {
          props.onHistoryRewriteStarted('squash', toSquash.length + 1)
          return props.dispatcher
            .runOperation('squash-commits', {
              base: lastRetainedCommitRef,
              commits: toSquash.map(commit => commit.sha),
              squashOnto: squashOnto.sha,
              message: formatCommitContextMessage(context),
              noVerify: props.state.commitOptions.noVerify,
            })
            .then(() => props.onSelectedSHAsChanged([]))
        },
        startRebase: (
          _repository: Repository,
          baseBranch: Branch,
          _targetBranch: Branch
        ) =>
          props.dispatcher.runOperation('rebase', {
            values: [baseBranch.name],
          }),
        undoCommit: () => props.dispatcher.runOperation('undo'),
        updateCompareForm: (
          _repository: Repository,
          update: {
            readonly filterText?: string
            readonly showBranchList?: boolean
          }
        ) => {
          if (update.filterText !== undefined)
            props.dispatcher.setComparisonFilterText(update.filterText)
          if (update.showBranchList !== undefined)
            props.dispatcher.setComparisonBranchListVisible(
              update.showBranchList
            )
          return Promise.resolve()
        },
      } as unknown as Dispatcher),
    [
      props.dispatcher,
      props.onCommitMessagePopup,
      props.onHistoryRewriteStarted,
      props.onSelectedSHAsChanged,
      props.state.comparisonBranch,
      props.state.commitOptions.noVerify,
      props.state.comparisonBranchListVisible,
      repository,
    ]
  )

  const compareState: ICompareState = {
    allHistoryCommitSHAs: comparisonCommits.map(commit => commit.sha),
    branches: branches.filter(branch => branch.name !== currentBranch?.name),
    commitGraphCollapsedBranchGroups: [],
    commitGraphCommitSHAs: [],
    commitGraphHiddenBranchRefs: [],
    commitGraphRefs: [],
    commitSearchQuery: '',
    compareCommitSHAs: comparisonCommits.map(commit => commit.sha),
    defaultBranch:
      branches.find(
        branch => branch.name === props.state.branches?.defaultBranch
      ) || null,
    filterText: props.state.comparisonFilterText,
    filteredHistoryCommitSHAs: [],
    formState:
      comparisonBranch && props.state.comparison
        ? {
            kind: HistoryTabMode.Compare,
            comparisonBranch,
            comparisonMode,
            aheadBehind: {
              ahead: props.state.comparison.ahead,
              behind: props.state.comparison.behind,
            },
          }
        : { kind: HistoryTabMode.History },
    mergeStatus: null,
    recentBranches: (props.state.branches?.recentBranches || []).flatMap(name =>
      branches.filter(branch => branch.name === name)
    ),
    shasToHighlight: [],
    showBranchList: props.state.comparisonBranchListVisible,
    tip: currentBranch?.tip.sha || null,
  }

  if (props.mode === 'sidebar') {
    return (
      <>
        <CompareSidebar
          accounts={[]}
          aheadBehindStore={aheadBehindStore}
          askForConfirmationOnCheckoutCommit={true}
          branchSortOrder={DEFAULT_BRANCH_SORT_ORDER}
          branchRowHeight={32}
          commitLookup={comparisonLookup}
          compareListScrollTop={Number(
            localStorage.getItem(compareScrollStorageKey) || 0
          )}
          compareState={compareState}
          currentBranch={currentBranch}
          dispatcher={desktopDispatcher}
          emoji={props.state.emoji}
          isCompareView={true}
          isLocalRepository={(props.state.branches?.remotes?.length || 0) === 0}
          isMultiCommitOperationInProgress={
            props.state.operationTask?.status === 'running'
          }
          localCommitSHAs={props.state.branches?.localCommitSHAs || []}
          localTags={
            new Map(
              (props.state.branches?.tags || []).map(tag => [tag.name, tag.sha])
            )
          }
          onAmendCommit={commit =>
            void props.dispatcher.startAmendingCommit(commit.sha)
          }
          onCherryPick={(_repository, commits) =>
            void props.dispatcher.runOperation('cherry-pick', {
              values: commits.map(commit => commit.sha),
            })
          }
          onCompareListScrolled={scrollTop =>
            localStorage.setItem(compareScrollStorageKey, String(scrollTop))
          }
          onRevertCommit={commit =>
            void props.dispatcher.runOperation('revert', {
              values: [commit.sha],
            })
          }
          onViewCommitOnGitHub={() => undefined}
          preferAbsoluteDates={props.preferAbsoluteDates}
          repository={repository}
          selectedCommitShas={props.selectedSHAs}
          shasToHighlight={[]}
          showConventionalCommitBadges={props.showConventionalCommitBadges}
          tagsToPush={props.state.branches?.tagsToPush || []}
        />
        {resetCommit ? (
          <DesktopResetWarningDialog
            commit={resetCommit}
            dispatcher={props.dispatcher}
            onDismiss={() => setResetCommit(null)}
            repositoryPath={props.state.selectedRepositoryPath || ''}
          />
        ) : null}
      </>
    )
  }

  const selectedCommit =
    comparisonCommits.find(
      commit => commit.sha === props.state.selectedHistoryCommitSHA
    ) || null
  const selectedWebCommit =
    props.state.comparison?.commits.find(
      commit => commit.sha === selectedCommit?.sha
    ) || null

  if (!selectedCommit || !selectedWebCommit) return null

  return (
    <DesktopSelectedCommits
      dispatcher={props.dispatcher}
      isContiguous={true}
      selectedCommits={[selectedCommit]}
      selectedCommitsWeb={[selectedWebCommit]}
      shasInDiff={[selectedCommit.sha]}
      state={props.state}
    />
  )
}

function DesktopRepositoryView(props: {
  readonly state: WebApplicationState
  readonly dispatcher: WebDispatcher
  readonly sidebarWidth: number
  readonly onSidebarWidthChanged: (width: number) => void
  readonly selectedHistorySHAs: ReadonlyArray<string>
  readonly onSelectedHistorySHAsChanged: (shas: ReadonlyArray<string>) => void
  readonly onRemoveRepository: (path: string) => void
  readonly onRelocateRepository: (path: string) => void
  readonly preferAbsoluteDates: boolean
  readonly showConventionalCommitBadges: boolean
  readonly confirmStashActions: boolean
  readonly onConfirmStashActionsChanged: (value: boolean) => void
  readonly confirmCheckoutCommit: boolean
  readonly onConfirmCheckoutCommitChanged: (value: boolean) => void
  readonly showCommitLengthWarning: boolean
  readonly commitSummaryLengthWarningThreshold: number
  readonly showChangesFilter: boolean
  readonly showStashedChanges: boolean
  readonly showCommitAuthorInfo: boolean
  readonly showCompareTab: boolean
  readonly editorIntegration: WebIntegrationSelection
}) {
  const [stashAction, setStashAction] = React.useState<WebStashAction | null>(
    null
  )
  const [conflictDialogOpen, setConflictDialogOpen] = React.useState(false)
  const [confirmAbortOpen, setConfirmAbortOpen] = React.useState(false)
  const [commitMessagePopup, setCommitMessagePopup] =
    React.useState<CommitMessagePopup | null>(null)
  const [commitProgressTaskID, setCommitProgressTaskID] = React.useState<
    string | null
  >(null)
  const [historyRewrite, setHistoryRewrite] = React.useState<{
    readonly kind: HistoryRewriteKind
    readonly count: number
  } | null>(null)
  const [undoneHistoryRewrite, setUndoneHistoryRewrite] = React.useState<{
    readonly kind: HistoryRewriteKind
    readonly count: number
  } | null>(null)
  const [manualResolutions, setManualResolutions] = React.useState<
    Map<string, ManualConflictResolution>
  >(new Map())
  const requestStashAction = React.useCallback(
    (action: WebStashAction | null) => {
      if (action === null) {
        setStashAction(null)
        return
      }
      if (action.operation !== 'stash-drop' || !props.confirmStashActions) {
        void props.dispatcher.runOperation(action.operation, {
          values: [action.stash.name],
          ...(action.operation === 'stash-drop' ? { confirmed: true } : {}),
        })
        return
      }
      setStashAction(action)
    },
    [props.confirmStashActions, props.dispatcher]
  )
  const changesSelected =
    props.state.selectedSection !== 'history' &&
    (!props.showCompareTab || props.state.selectedSection !== 'compare')
  const historySelected = props.state.selectedSection === 'history'
  const inspection = props.state.selectedRepositoryInspection
  const operation = props.state.status?.operation || null
  const operationKind =
    operation === 'cherryPick'
      ? MultiCommitOperationKind.CherryPick
      : operation === 'rebase'
      ? MultiCommitOperationKind.Rebase
      : operation === 'squash'
      ? MultiCommitOperationKind.Squash
      : operation === 'merge' || operation === 'revert'
      ? MultiCommitOperationKind.Merge
      : null
  const conflictOperationKey = `${props.state.selectedRepositoryPath || ''}:${
    operation || ''
  }:${props.state.status?.operationState?.currentCommit || ''}`
  const conflictedFiles =
    props.state.status?.workingDirectory.files.filter(
      file => file.status.kind === AppFileStatusKind.Conflicted
    ) || []

  React.useEffect(() => {
    setManualResolutions(new Map())
    setConfirmAbortOpen(false)
    setConflictDialogOpen(operationKind !== null && conflictedFiles.length > 0)
  }, [conflictOperationKey])

  React.useEffect(() => {
    if (operationKind === null) {
      setManualResolutions(new Map())
      setConfirmAbortOpen(false)
      setConflictDialogOpen(false)
    }
  }, [operationKind])

  React.useEffect(() => {
    setCommitMessagePopup(null)
    setCommitProgressTaskID(null)
    setHistoryRewrite(null)
    setUndoneHistoryRewrite(null)
  }, [props.state.selectedRepositoryPath])

  React.useEffect(() => {
    const task = props.state.operationTask
    if (task?.operation === 'commit' && task.status === 'running')
      setCommitProgressTaskID(task.id)
  }, [props.state.operationTask])

  const onHistoryRewriteStarted = React.useCallback(
    (kind: HistoryRewriteKind, count: number) => {
      props.onSelectedHistorySHAsChanged([])
      setUndoneHistoryRewrite(null)
      setHistoryRewrite({ kind, count })
    },
    [props.onSelectedHistorySHAsChanged]
  )
  const commitMessageDispatcher = React.useMemo(
    () =>
      ({
        refreshAuthor: () => Promise.resolve(),
        setCommitSpellcheckEnabled: (enabled: boolean) =>
          props.dispatcher.setCommitSpellcheckEnabled(enabled),
        showCreateForkDialog: () => Promise.resolve(),
        showFoldout: () => Promise.resolve(),
        showPopup: () => Promise.resolve(),
        showUnknownAuthorsCommitWarning: (
          _authors: unknown,
          onCommitAnyway: () => void
        ) => onCommitAnyway(),
        stopAmendingRepository: () => Promise.resolve(),
      } as unknown as Dispatcher),
    [props.dispatcher]
  )

  if (inspection && inspection.kind !== 'regular') {
    const repository = new Repository(inspection.path, 0, null, true)
    const desktopDispatcher = {
      cloneAgain: () => Promise.resolve(),
      postError: () => Promise.resolve(),
      refreshRepository: () =>
        props.dispatcher.selectRepository(inspection.path),
      relocateRepository: () => props.onRelocateRepository(inspection.path),
      removeRepository: () => props.onRemoveRepository(inspection.path),
    } as unknown as Dispatcher

    return (
      <MissingRepository
        dispatcher={desktopDispatcher}
        repository={repository}
      />
    )
  }

  const selectedSection = changesSelected
    ? RepositorySectionTab.Changes
    : historySelected
    ? RepositorySectionTab.History
    : RepositorySectionTab.Compare
  const sidebar = (
    <>
      <RepositoryTabs
        changesCount={props.state.status?.workingDirectory.files.length || 0}
        onTabClicked={section =>
          void props.dispatcher.selectSection(
            section === RepositorySectionTab.Changes
              ? 'changes'
              : section === RepositorySectionTab.History
              ? 'history'
              : 'compare'
          )
        }
        selectedSection={selectedSection}
        showCompareTab={props.showCompareTab}
      />
      {changesSelected ? (
        <DesktopChangesView
          availableWidth={props.sidebarWidth - 1}
          dispatcher={props.dispatcher}
          mode="sidebar"
          onStashActionChanged={requestStashAction}
          state={props.state}
          showCommitLengthWarning={props.showCommitLengthWarning}
          showChangesFilter={props.showChangesFilter}
          showStashedChanges={props.showStashedChanges}
          showCommitAuthorInfo={props.showCommitAuthorInfo}
          commitSummaryLengthWarningThreshold={
            props.commitSummaryLengthWarningThreshold
          }
        />
      ) : historySelected ? (
        <DesktopHistoryView
          confirmCheckoutCommit={props.confirmCheckoutCommit}
          dispatcher={props.dispatcher}
          mode="sidebar"
          onConfirmCheckoutCommitChanged={props.onConfirmCheckoutCommitChanged}
          onCommitMessagePopup={setCommitMessagePopup}
          onHistoryRewriteStarted={onHistoryRewriteStarted}
          onSelectedSHAsChanged={props.onSelectedHistorySHAsChanged}
          preferAbsoluteDates={props.preferAbsoluteDates}
          selectedSHAs={props.selectedHistorySHAs}
          showConventionalCommitBadges={props.showConventionalCommitBadges}
          state={props.state}
        />
      ) : (
        <DesktopCompareView
          dispatcher={props.dispatcher}
          mode="sidebar"
          onCommitMessagePopup={setCommitMessagePopup}
          onHistoryRewriteStarted={onHistoryRewriteStarted}
          onSelectedSHAsChanged={props.onSelectedHistorySHAsChanged}
          preferAbsoluteDates={props.preferAbsoluteDates}
          selectedSHAs={props.selectedHistorySHAs}
          showConventionalCommitBadges={props.showConventionalCommitBadges}
          state={props.state}
        />
      )}
    </>
  )
  const content = changesSelected ? (
    <DesktopChangesView
      availableWidth={props.sidebarWidth - 1}
      dispatcher={props.dispatcher}
      mode="content"
      onStashActionChanged={requestStashAction}
      state={props.state}
      showCommitLengthWarning={props.showCommitLengthWarning}
      showChangesFilter={props.showChangesFilter}
      showStashedChanges={props.showStashedChanges}
      showCommitAuthorInfo={props.showCommitAuthorInfo}
      commitSummaryLengthWarningThreshold={
        props.commitSummaryLengthWarningThreshold
      }
    />
  ) : historySelected ? (
    <DesktopHistoryView
      confirmCheckoutCommit={props.confirmCheckoutCommit}
      dispatcher={props.dispatcher}
      mode="content"
      onConfirmCheckoutCommitChanged={props.onConfirmCheckoutCommitChanged}
      onCommitMessagePopup={setCommitMessagePopup}
      onHistoryRewriteStarted={onHistoryRewriteStarted}
      onSelectedSHAsChanged={props.onSelectedHistorySHAsChanged}
      preferAbsoluteDates={props.preferAbsoluteDates}
      selectedSHAs={props.selectedHistorySHAs}
      showConventionalCommitBadges={props.showConventionalCommitBadges}
      state={props.state}
    />
  ) : (
    <DesktopCompareView
      dispatcher={props.dispatcher}
      mode="content"
      onCommitMessagePopup={setCommitMessagePopup}
      onHistoryRewriteStarted={onHistoryRewriteStarted}
      onSelectedSHAsChanged={props.onSelectedHistorySHAsChanged}
      preferAbsoluteDates={props.preferAbsoluteDates}
      selectedSHAs={props.selectedHistorySHAs}
      showConventionalCommitBadges={props.showConventionalCommitBadges}
      state={props.state}
    />
  )

  return (
    <>
      <RepositoryLayout
        content={content}
        onSidebarReset={() =>
          props.onSidebarWidthChanged(webSidebarWidth.default)
        }
        onSidebarResize={props.onSidebarWidthChanged}
        sidebar={sidebar}
        sidebarWidth={{
          max: webSidebarWidth.max,
          min: webSidebarWidth.min,
          value: props.sidebarWidth,
        }}
        tutorial={
          <DesktopTutorialPanel
            dispatcher={props.dispatcher}
            editorIntegration={props.editorIntegration}
            state={props.state}
          />
        }
      />
      {props.state.historyRewriteUndo && historyRewrite
        ? renderBanner(
            {
              type:
                historyRewrite.kind === 'squash'
                  ? BannerType.SuccessfulSquash
                  : BannerType.SuccessfulReorder,
              count: historyRewrite.count,
              onUndo: () => {
                const undo = props.state.historyRewriteUndo
                if (!undo) return
                void props.dispatcher
                  .runOperation('undo-history-rewrite', {
                    values: [undo.branch, undo.originalTip, undo.rewrittenTip],
                    confirmed: true,
                  })
                  .then(() => {
                    props.onSelectedHistorySHAsChanged([])
                    setUndoneHistoryRewrite(historyRewrite)
                    setHistoryRewrite(null)
                  })
              },
            },
            commitMessageDispatcher,
            () => {
              props.dispatcher.dismissHistoryRewriteUndo()
              setHistoryRewrite(null)
            }
          )
        : undoneHistoryRewrite
        ? renderBanner(
            {
              type:
                undoneHistoryRewrite.kind === 'squash'
                  ? BannerType.SquashUndone
                  : BannerType.ReorderUndone,
              commitsCount: undoneHistoryRewrite.count,
            },
            commitMessageDispatcher,
            () => setUndoneHistoryRewrite(null)
          )
        : null}
      {commitMessagePopup && props.state.selectedRepositoryPath ? (
        <DialogStackContext.Provider value={{ isTopMost: true }}>
          <CommitMessageDialog
            accounts={[]}
            aheadBehind={props.state.branches?.aheadBehind || null}
            allowEmptyCommit={false}
            autocompletionProviders={[]}
            branch={props.state.branches?.branch?.name || null}
            coAuthors={commitMessagePopup.coAuthors}
            commitAuthor={
              props.state.gitIdentity?.name && props.state.gitIdentity.email
                ? new CommitIdentity(
                    props.state.gitIdentity.name,
                    props.state.gitIdentity.email,
                    new Date()
                  )
                : null
            }
            commitMessage={commitMessagePopup.commitMessage}
            commitSpellcheckEnabled={props.state.commitSpellcheckEnabled}
            dialogButtonText={commitMessagePopup.dialogButtonText}
            dialogTitle={commitMessagePopup.dialogTitle}
            dispatcher={commitMessageDispatcher}
            onDismissed={() => setCommitMessagePopup(null)}
            onSubmitCommitMessage={commitMessagePopup.onSubmitCommitMessage}
            onUpdateCommitOptions={(_repository, options) => {
              if (options.skipCommitHooks !== undefined)
                props.dispatcher.setCommitOption(
                  'noVerify',
                  options.skipCommitHooks
                )
              if (options.signOffCommits !== undefined)
                props.dispatcher.setCommitOption(
                  'signOff',
                  options.signOffCommits
                )
            }}
            prepopulateCommitSummary={
              commitMessagePopup.prepopulateCommitSummary
            }
            repository={getDesktopRepository(
              props.state.selectedRepositoryPath
            )}
            repositoryAccount={null}
            repoRulesInfo={new RepoRulesInfo()}
            showBranchProtected={false}
            showCoAuthoredBy={commitMessagePopup.showCoAuthoredBy}
            showCommitLengthWarning={props.showCommitLengthWarning}
            showNoWriteAccess={false}
            signOffCommits={props.state.commitOptions.signOff}
            skipCommitHooks={props.state.commitOptions.noVerify}
          />
        </DialogStackContext.Provider>
      ) : null}
      {commitProgressTaskID &&
      props.state.operationTask?.id === commitProgressTaskID &&
      props.state.operationTask.status === 'running' ? (
        <DesktopCommitProgressDialog
          onDismissed={() => {
            setCommitProgressTaskID(null)
            void props.dispatcher.cancelOperation()
          }}
          output={props.state.operationTask.output}
        />
      ) : null}
      {operationKind !== null &&
      conflictedFiles.length > 0 &&
      !conflictDialogOpen &&
      !confirmAbortOpen ? (
        <ConflictsFoundBanner
          onDismissed={() => undefined}
          onOpenConflictsDialog={() => setConflictDialogOpen(true)}
          operationDescription={operationKind.toLowerCase()}
        />
      ) : null}
      {operationKind !== null &&
      conflictDialogOpen &&
      !props.state.error &&
      props.state.selectedRepositoryPath ? (
        <DialogStackContext.Provider value={{ isTopMost: true }}>
          <ConflictsDialog
            abortButton={`Abort ${operationKind}`}
            accounts={[]}
            dispatcher={
              {
                postError: () => Promise.resolve(),
                updateManualConflictResolution: (
                  _repository: Repository,
                  path: string,
                  resolution: ManualConflictResolution | null
                ) =>
                  setManualResolutions(current => {
                    const next = new Map(current)
                    if (resolution === null) next.delete(path)
                    else next.set(path, resolution)
                    return next
                  }),
              } as unknown as Dispatcher
            }
            headerTitle={`Resolve conflicts before ${operationKind}`}
            manualResolutions={manualResolutions}
            onAbort={async () => {
              if (manualResolutions.size > 0) {
                setConflictDialogOpen(false)
                setConfirmAbortOpen(true)
                return
              }
              await props.dispatcher.runOperation(
                operation === 'rebase'
                  ? 'abort-rebase'
                  : operation === 'cherryPick'
                  ? 'abort-cherry-pick'
                  : operation === 'squash'
                  ? 'abort-squash'
                  : 'abort-merge'
              )
              setConflictDialogOpen(false)
            }}
            onDismissed={() => setConflictDialogOpen(false)}
            onSubmit={async () => {
              await props.dispatcher.runOperation(
                operation === 'rebase'
                  ? 'continue-rebase'
                  : operation === 'cherryPick'
                  ? 'continue-cherry-pick'
                  : 'finish-merge',
                {
                  resolutions: [...manualResolutions].map(
                    ([path, resolution]) => [path, resolution] as const
                  ),
                }
              )
              setConflictDialogOpen(false)
            }}
            onSkip={
              operation === 'rebase'
                ? async () => {
                    await props.dispatcher.runOperation('skip-rebase')
                    setConflictDialogOpen(false)
                  }
                : undefined
            }
            skipButtonText="Skip Rebase"
            openFileInExternalEditor={path =>
              void props.dispatcher.openIntegration(
                'editor',
                path,
                props.editorIntegration
              )
            }
            openRepositoryInShell={repository =>
              void props.dispatcher.openIntegration('shell', repository.path)
            }
            ourBranch={props.state.branches?.branch?.name}
            repository={getDesktopRepository(
              props.state.selectedRepositoryPath
            )}
            resolvedExternalEditor={
              props.editorIntegration.name ||
              props.editorIntegration.custom?.path ||
              null
            }
            shouldShowCopilotConflictResolutionCallOut={false}
            submitButton={`Continue ${operationKind}`}
            theirBranch={undefined}
            userHasResolvedConflicts={manualResolutions.size > 0}
            workingDirectory={WorkingDirectoryStatus.fromFiles(
              (props.state.status?.workingDirectory.files || []).map(file =>
                getDesktopWorkingDirectoryFile(file)
              )
            )}
          />
        </DialogStackContext.Provider>
      ) : null}
      {operationKind !== null && confirmAbortOpen ? (
        <DialogStackContext.Provider value={{ isTopMost: true }}>
          <ConfirmAbortDialog
            onConfirmAbort={async () => {
              await props.dispatcher.runOperation(
                operation === 'rebase'
                  ? 'abort-rebase'
                  : operation === 'cherryPick'
                  ? 'abort-cherry-pick'
                  : operation === 'squash'
                  ? 'abort-squash'
                  : 'abort-merge'
              )
              setConfirmAbortOpen(false)
            }}
            onReturnToConflicts={() => {
              setConfirmAbortOpen(false)
              setConflictDialogOpen(true)
            }}
            operation={operationKind}
          />
        </DialogStackContext.Provider>
      ) : null}
      {stashAction?.operation === 'stash-drop' &&
      props.state.selectedRepositoryPath ? (
        <DesktopConfirmDiscardStashDialog
          askForConfirmation={props.confirmStashActions}
          dispatcher={props.dispatcher}
          onConfirmStashActionsChanged={props.onConfirmStashActionsChanged}
          onDismiss={() => setStashAction(null)}
          repositoryPath={props.state.selectedRepositoryPath}
          stash={stashAction.stash}
        />
      ) : null}
    </>
  )
}

function getEmbeddedParentOrigin(): string | null {
  const raw = new URLSearchParams(window.location.search).get('parentOrigin')
  if (!raw) return null
  try {
    const url = new URL(raw)
    if (
      (url.protocol !== 'http:' && url.protocol !== 'https:') ||
      url.origin !== raw
    )
      return null
    return raw
  } catch {
    return null
  }
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
  const [browserNotificationsEnabled, setBrowserNotificationsEnabled] =
    React.useState(() =>
      getBoolean(webBrowserNotificationsEnabledStorageKey, true)
    )
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
  const [preferAbsoluteDates, setPreferAbsoluteDates] = React.useState(() =>
    getBoolean(webPreferAbsoluteDatesStorageKey, false)
  )
  const [showConventionalCommitBadges, setShowConventionalCommitBadges] =
    React.useState(() =>
      getBoolean(webShowConventionalCommitBadgesStorageKey, true)
    )
  const [confirmStashActions, setConfirmStashActions] = React.useState(() =>
    getBoolean(webConfirmStashActionsStorageKey, true)
  )
  const [showCommitLengthWarning, setShowCommitLengthWarning] = React.useState(
    () => getBoolean(webShowCommitLengthWarningStorageKey, true)
  )
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
  const [showWorktreesInRepositoryList, setShowWorktreesInRepositoryList] =
    React.useState(() =>
      getBoolean(webShowWorktreesInRepositoryListStorageKey, false)
    )
  const [repositoryIndicatorsEnabled, setRepositoryIndicatorsEnabled] =
    React.useState(() =>
      getBoolean(webRepositoryIndicatorsEnabledStorageKey, true)
    )
  const [confirmRepositoryRemoval, setConfirmRepositoryRemoval] =
    React.useState(() =>
      getBoolean(webConfirmRepositoryRemovalStorageKey, true)
    )
  const [confirmWorktreeRemoval, setConfirmWorktreeRemoval] = React.useState(
    () => getBoolean(webConfirmWorktreeRemovalStorageKey, true)
  )
  const [confirmCheckoutCommit, setConfirmCheckoutCommit] = React.useState(() =>
    getBoolean(webConfirmCheckoutCommitStorageKey, true)
  )
  const [confirmDiscardChanges, setConfirmDiscardChanges] = React.useState(() =>
    getBoolean(webConfirmDiscardChangesStorageKey, true)
  )
  const [confirmCommitFilteredChanges, setConfirmCommitFilteredChanges] =
    React.useState(() =>
      getBoolean(webConfirmCommitFilteredChangesStorageKey, true)
    )
  const [confirmCommitMessageOverride, setConfirmCommitMessageOverride] =
    React.useState(() =>
      getBoolean(webConfirmCommitMessageOverrideStorageKey, true)
    )
  const [
    confirmDiscardChangesPermanently,
    setConfirmDiscardChangesPermanently,
  ] = React.useState(() =>
    getBoolean(webConfirmDiscardChangesPermanentlyStorageKey, true)
  )
  const [confirmForcePush, setConfirmForcePush] = React.useState(() =>
    getBoolean(webConfirmForcePushStorageKey, true)
  )
  const [confirmUndoCommit, setConfirmUndoCommit] = React.useState(() =>
    getBoolean(webConfirmUndoCommitStorageKey, true)
  )
  const [hideWindowOnQuit, setHideWindowOnQuit] = React.useState(() =>
    getBoolean(webHideWindowOnQuitStorageKey, false)
  )
  const [optOutOfUsageTracking, setOptOutOfUsageTracking] = React.useState(() =>
    getBoolean(webOptOutOfUsageTrackingStorageKey, false)
  )
  const [showCommitAuthorInfo, setShowCommitAuthorInfo] = React.useState(() =>
    getBoolean(webShowCommitAuthorInfoStorageKey, false)
  )
  const [showCompareTab, setShowCompareTab] = React.useState(() =>
    getBoolean(webShowCompareTabStorageKey, true)
  )
  const [showWorktrees, setShowWorktrees] = React.useState(() =>
    getBoolean(webShowWorktreesStorageKey, true)
  )
  const [useExternalCredentialHelper, setUseExternalCredentialHelper] =
    React.useState(() =>
      getBoolean(webUseExternalCredentialHelperStorageKey, false)
    )
  const [useWindowsOpenSSH, setUseWindowsOpenSSH] = React.useState(() =>
    getBoolean(webUseWindowsOpenSSHStorageKey, false)
  )
  const [underlineLinks, setUnderlineLinks] = React.useState(() =>
    getBoolean('underline-links', false)
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

  const hostRefreshInFlight = React.useRef(false)
  const requestHostRefresh = React.useCallback(() => {
    if (hostRefreshInFlight.current || store.getState().loading) return
    hostRefreshInFlight.current = true
    void dispatcher.refresh().finally(() => {
      hostRefreshInFlight.current = false
    })
  }, [dispatcher, store])

  React.useEffect(() => {
    const onFocus = () => {
      requestHostRefresh()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [requestHostRefresh])

  React.useEffect(() => {
    const parentOrigin = getEmbeddedParentOrigin()
    if (!parentOrigin) return
    const refreshFromHost = (event: MessageEvent) => {
      if (
        event.origin === parentOrigin &&
        event.source === window.parent &&
        event.data?.type === 'space:desktop-plus-refresh-request'
      ) {
        requestHostRefresh()
      }
    }
    window.addEventListener('message', refreshFromHost)
    return () => window.removeEventListener('message', refreshFromHost)
  }, [requestHostRefresh])

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

  const openedRepositoryQuery = React.useRef<string | null>(null)
  React.useEffect(() => {
    const requestedPath = new URLSearchParams(window.location.search).get(
      'repository'
    )
    if (
      requestedPath &&
      openedRepositoryQuery.current !== requestedPath &&
      requestedPath !== state.selectedRepositoryPath
    ) {
      openedRepositoryQuery.current = requestedPath
      void dispatcher.addRepositoryWithWorktrees(requestedPath)
    }
  }, [dispatcher, state.selectedRepositoryPath])

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
  const updatePreferAbsoluteDates = (value: boolean) => {
    setBoolean(webPreferAbsoluteDatesStorageKey, value)
    setPreferAbsoluteDates(value)
  }
  const updateShowConventionalCommitBadges = (value: boolean) => {
    setBoolean(webShowConventionalCommitBadgesStorageKey, value)
    setShowConventionalCommitBadges(value)
  }
  const updateConfirmStashActions = (value: boolean) => {
    setBoolean(webConfirmStashActionsStorageKey, value)
    setConfirmStashActions(value)
  }
  const updateShowCommitLengthWarning = (value: boolean) => {
    setBoolean(webShowCommitLengthWarningStorageKey, value)
    setShowCommitLengthWarning(value)
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
  const updateShowWorktreesInRepositoryList = (value: boolean) => {
    setBoolean(webShowWorktreesInRepositoryListStorageKey, value)
    setShowWorktreesInRepositoryList(value)
  }
  const updateRepositoryIndicatorsEnabled = (value: boolean) => {
    setBoolean(webRepositoryIndicatorsEnabledStorageKey, value)
    setRepositoryIndicatorsEnabled(value)
  }
  const updateConfirmRepositoryRemoval = (value: boolean) => {
    setBoolean(webConfirmRepositoryRemovalStorageKey, value)
    setConfirmRepositoryRemoval(value)
  }
  const updateConfirmWorktreeRemoval = (value: boolean) => {
    setBoolean(webConfirmWorktreeRemovalStorageKey, value)
    setConfirmWorktreeRemoval(value)
  }
  const updateConfirmCheckoutCommit = (value: boolean) => {
    setBoolean(webConfirmCheckoutCommitStorageKey, value)
    setConfirmCheckoutCommit(value)
  }
  const updateConfirmDiscardChanges = (value: boolean) => {
    setBoolean(webConfirmDiscardChangesStorageKey, value)
    setConfirmDiscardChanges(value)
  }
  const updateBooleanPreference = (
    key: string,
    setter: React.Dispatch<React.SetStateAction<boolean>>,
    value: boolean
  ) => {
    setBoolean(key, value)
    setter(value)
  }
  const updateConfirmCommitFilteredChanges = (value: boolean) =>
    updateBooleanPreference(
      webConfirmCommitFilteredChangesStorageKey,
      setConfirmCommitFilteredChanges,
      value
    )
  const updateConfirmCommitMessageOverride = (value: boolean) =>
    updateBooleanPreference(
      webConfirmCommitMessageOverrideStorageKey,
      setConfirmCommitMessageOverride,
      value
    )
  const updateConfirmDiscardChangesPermanently = (value: boolean) =>
    updateBooleanPreference(
      webConfirmDiscardChangesPermanentlyStorageKey,
      setConfirmDiscardChangesPermanently,
      value
    )
  const updateConfirmForcePush = (value: boolean) =>
    updateBooleanPreference(
      webConfirmForcePushStorageKey,
      setConfirmForcePush,
      value
    )
  const updateConfirmUndoCommit = (value: boolean) =>
    updateBooleanPreference(
      webConfirmUndoCommitStorageKey,
      setConfirmUndoCommit,
      value
    )
  const updateHideWindowOnQuit = (value: boolean) =>
    updateBooleanPreference(
      webHideWindowOnQuitStorageKey,
      setHideWindowOnQuit,
      value
    )
  const updateOptOutOfUsageTracking = (value: boolean) =>
    updateBooleanPreference(
      webOptOutOfUsageTrackingStorageKey,
      setOptOutOfUsageTracking,
      value
    )
  const updateShowCommitAuthorInfo = (value: boolean) =>
    updateBooleanPreference(
      webShowCommitAuthorInfoStorageKey,
      setShowCommitAuthorInfo,
      value
    )
  const updateShowCompareTab = (value: boolean) =>
    updateBooleanPreference(
      webShowCompareTabStorageKey,
      setShowCompareTab,
      value
    )
  const updateShowWorktrees = (value: boolean) =>
    updateBooleanPreference(webShowWorktreesStorageKey, setShowWorktrees, value)
  const updateUseExternalCredentialHelper = (value: boolean) =>
    updateBooleanPreference(
      webUseExternalCredentialHelperStorageKey,
      setUseExternalCredentialHelper,
      value
    )
  const updateUseWindowsOpenSSH = (value: boolean) =>
    updateBooleanPreference(
      webUseWindowsOpenSSHStorageKey,
      setUseWindowsOpenSSH,
      value
    )
  const updateUnderlineLinks = (value: boolean) => {
    setBoolean('underline-links', value)
    setUnderlineLinks(value)
  }
  const updateEditorIntegration = (value: WebIntegrationSelection) => {
    setStoredIntegrationSelection(webEditorIntegrationStorageKey, value)
    setEditorIntegration(value)
  }
  const updateShellIntegration = (value: WebIntegrationSelection) => {
    setStoredIntegrationSelection(webShellIntegrationStorageKey, value)
    setShellIntegration(value)
  }
  const updateBrowserNotificationsEnabled = (value: boolean) => {
    setBoolean(webBrowserNotificationsEnabledStorageKey, value)
    setBrowserNotificationsEnabled(value)
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
