import * as React from 'react'

import { NoRepositoriesView } from './no-repositories/no-repositories-view'
import { AppTheme } from './app-theme'
import { Dialog, DialogStackContext } from './dialog/dialog'
import { DialogContent } from './dialog/content'
import { DialogFooter } from './dialog/footer'
import { Button } from './lib/button'
import { ApplicationTheme } from './lib/application-theme'
import { TabBar } from './tab-bar'
import { Toolbar } from './toolbar/toolbar'
import { ToolbarButtonStyle } from './toolbar/button'
import { ToolbarDropdown } from './toolbar/dropdown'
import { Octicon, syncClockwise } from './octicons'
import * as octicons from './octicons/octicons.generated'
import { ChangedFile } from './changes/changed-file'
import { FilterList, IFilterListItem } from './lib/filter-list'
import {
  AppFileStatus,
  AppFileStatusKind,
  CommittedFileChange,
  GitStatusEntry,
  UnmergedEntrySummary,
  WorkingDirectoryFileChange,
} from '../models/status'
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
import { CommitList } from './history/commit-list'
import { List } from './lib/list'
import { CommitGraphCommitListItem } from './history/commit-graph-commit-list-item'
import {
  commitGraph_buildRows,
  commitGraph_getColor,
  commitGraph_RowHeight,
  ICommitGraphRow,
} from './history/commit-graph-model'
import { CommitHistoryViewMode } from '../lib/stores/commit-graph-state'
import { ExpandableCommitSummary } from './history/expandable-commit-summary'
import { KeyboardInsertionData } from './lib/list'
import { DragType } from '../models/drag-drop'
import {
  UnreachableCommitsDialog,
  UnreachableCommitsTab,
} from './history/unreachable-commits-dialog'
import { AutocompletingTextArea } from './autocompletion/autocompletion-provider'
import { EmojiAutocompletionProvider } from './autocompletion/emoji-autocompletion-provider'
import { DiffHeader } from './diff/diff-header'
import { SeamlessDiffSwitcher } from './diff/seamless-diff-switcher'
import { IFileContents } from './diff/syntax-highlighting'
import { DiffParser } from '../lib/diff-parser'
import { IDiff, DiffType } from '../models/diff'
import {
  formatPatch,
  formatPatchToDiscardChanges,
} from '../lib/patch-formatter'
import type { Repository } from '../models/repository'
import { Branch, BranchType } from '../models/branch'
import { UiView } from './ui-view'
import { FocusContainer } from './lib/focus-container'
import { Resizable } from './resizable'
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
type DiffFontFamily = string

const defaultDiffFontFamily = 'default'
const defaultDiffFontSize = 11
const availableTabSizes = [1, 2, 3, 4, 6, 8]
const getDiffFontFamilyCssValue = (fontFamily: DiffFontFamily) =>
  fontFamily === defaultDiffFontFamily
    ? 'var(--font-family-monospace)'
    : `${JSON.stringify(fontFamily)}, var(--font-family-monospace)`
const getDiffLineHeight = (diffFontSize: number) =>
  Math.max(20, diffFontSize + 8)
import {
  getBoolean,
  getFloatNumber,
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
  WebGitOperation,
  WebDiff,
  WebRemote,
  WebStash,
  WebTag,
  WebBranchPruneCandidate,
  WebPullStrategy,
  WebSubmoduleUpdateStrategy,
  WebWorktree,
  WebRepositoryInitializationOptions,
  WebRepositoryInspection,
  WebRepositorySetupPreview,
  WebCloneSetupPreview,
  WebGitIdentity,
  WebCommitOptions,
  WebOperationOptions,
  WebOperationTask,
  WebRepositoryDeleteMode,
  WebCustomIntegration,
  WebIntegrationSelection,
  WebIntegrations,
} from './web/contracts'
import { TutorialStep } from '../models/tutorial-step'
import {
  UncommittedChangesStrategy,
  defaultUncommittedChangesStrategy,
} from '../models/uncommitted-changes-strategy'
import { showContextualMenu } from '../lib/menu-item'
import type { IMenuItem } from '../lib/menu-item'

interface WebAppProps {
  readonly store: WebApplicationStore
  readonly dispatcher: WebDispatcher
}

const webRepositoryParentPathStorageKey =
  'desktop-plus-web-default-repository-parent'
const webShowBranchNameStorageKey = 'show-branch-name-in-repository-list'
const webBranchSortOrderStorageKey = 'branch-sort-order'
const webPreferAbsoluteDatesStorageKey = 'prefer-absolute-dates'
const webShowConventionalCommitBadgesStorageKey =
  'show-conventional-commit-badges'
const webConfirmStashActionsStorageKey = 'confirm-stash-actions'
const webShowWorktreesInRepositoryListStorageKey =
  'show-worktrees-in-repository-list'
const webRepositoryIndicatorsEnabledStorageKey = 'enable-repository-indicators'
const webConfirmRepositoryRemovalStorageKey = 'confirm-repository-removal'
const webConfirmWorktreeRemovalStorageKey = 'confirm-worktree-removal'
const webRepositorySortOrderStorageKey = 'repository-sort-order'
const webDiscardPermanentlyStorageKey = 'discard-permanently'
const webPullStrategyStorageKey = 'pull-strategy'
const webUpdateStrategyStorageKey = 'update-from-default-strategy'
const webShowCommitLengthWarningStorageKey = 'show-commit-length-warning'
const webCommitSummaryLengthWarningThresholdStorageKey =
  'commit-summary-length-warning-threshold'
const webShowRecentRepositoriesStorageKey = 'show-recent-repositories'
const webUncommittedChangesStrategyStorageKey = 'uncommitted-changes-strategy'
const webResetUpstreamStrategyStorageKey = 'reset-upstream-strategy'
const webHistorySelectionStorageKey = 'desktop-plus-history-selection'
const webBrowserNotificationsEnabledStorageKey = 'browser-notifications-enabled'
const webShowChangesFilterStorageKey = 'show-changes-filter'
const webShowStashedChangesStorageKey = 'show-stashed-changes'
const webSidebarWidthStorageKey = 'desktop-plus-web-sidebar-width'
const webChangesScrollStorageKey = 'desktop-plus-web-changes-scroll'
const webCompareScrollStorageKey = 'desktop-plus-web-compare-scroll'
const webZoomFactorStorageKey = 'desktop-plus-web-zoom-factor'
const webEditorIntegrationStorageKey = 'desktop-plus-web-editor-integration'
const webShellIntegrationStorageKey = 'desktop-plus-web-shell-integration'

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

function getWebNotificationPermission():
  | NotificationPermission
  | 'unsupported' {
  return 'Notification' in window ? Notification.permission : 'unsupported'
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

function clampWebZoomFactor(value: number) {
  return Math.min(1.5, Math.max(0.75, Math.round(value * 20) / 20))
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

type WebRepositorySortOrder = 'recent' | 'alphabetical'

interface DesktopChangedFileListItem extends IFilterListItem {
  readonly file: WorkingDirectoryFileChange
}

function pathBasename(value: string) {
  return value.split(/[\\/]/).pop() || value
}

function pathExtension(value: string) {
  const basename = pathBasename(value)
  const dot = basename.lastIndexOf('.')
  return dot > 0 ? basename.slice(dot) : ''
}

function pathName(value: string) {
  const normalized = value.replace(/[\\/]+$/, '')
  return normalized.split(/[\\/]/).pop() || normalized
}

function pathParent(value: string) {
  const normalized = value.replace(/[\\/]+$/, '')
  const separator = Math.max(
    normalized.lastIndexOf('/'),
    normalized.lastIndexOf('\\')
  )
  return separator > 0 ? normalized.slice(0, separator) : normalized
}

function validateGitRefName(value: string, label: string) {
  const name = value.trim()
  if (!name) return `${label} is required.`
  if (
    name.startsWith('-') ||
    name.endsWith('.') ||
    name.endsWith('/') ||
    name.includes('..') ||
    name.includes('//') ||
    /[\s~^:?*\[\\]/.test(name) ||
    name.endsWith('.lock') ||
    name.includes('@{')
  )
    return `${label} contains characters Git does not allow.`
  return null
}

function validateRemoteName(value: string) {
  const name = value.trim()
  if (!name) return 'Remote name is required.'
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name))
    return 'Remote names may contain letters, numbers, dots, underscores, and hyphens.'
  return null
}

function validateRemoteURL(value: string) {
  const url = value.trim()
  if (!url) return 'Remote URL is required.'
  if (
    !/^(?:https?|ssh|git|file):\/\/\S+$/i.test(url) &&
    !/^[^@\s]+@[^:\s]+:\S+$/.test(url) &&
    !/^(?:~|\.{1,2})?[\\/][^\s]+$/.test(url)
  )
    return 'Enter an HTTPS, SSH, Git, file, or local path remote URL.'
  return null
}

function validateAbsolutePath(value: string, label: string) {
  const path = value.trim()
  if (!path) return `${label} is required.`
  if (!path.startsWith('/') && !path.startsWith('~'))
    return `${label} must be an absolute path.`
  return null
}

function validateWebCustomIntegration(
  selection: WebIntegrationSelection,
  label: string
) {
  if (!selection.custom) return null
  const pathError = validateAbsolutePath(
    selection.custom.path,
    `${label} executable`
  )
  if (pathError) return pathError
  if (!selection.custom.arguments.includes('%TARGET_PATH%'))
    return `${label} arguments must contain %TARGET_PATH%.`
  return null
}

function repositoryFilePath(repositoryPath: string, filePath: string) {
  return `${repositoryPath.replace(/[\\/]+$/, '')}/${filePath.replace(
    /^[\\/]+/,
    ''
  )}`
}

function WebFileActions(props: {
  readonly path: string
  readonly fullPath: string
  readonly dispatcher: WebDispatcher
  readonly openDisabled?: boolean
}) {
  const editorSelection = useWebIntegrationSelection('editor')
  return (
    <div
      aria-label={`${props.path} file actions`}
      className="web-file-actions"
      role="group"
    >
      <Button
        disabled={props.openDisabled}
        onClick={() => void props.dispatcher.openPath(props.fullPath)}
      >
        Open in default app
      </Button>
      <Button
        disabled={props.openDisabled}
        onClick={() => void props.dispatcher.openPath(props.fullPath, true)}
      >
        Reveal in Finder
      </Button>
      <Button
        disabled={props.openDisabled}
        onClick={() =>
          void props.dispatcher.openIntegration(
            'editor',
            props.fullPath,
            editorSelection
          )
        }
      >
        Open in editor
      </Button>
      <Button onClick={() => void props.dispatcher.copyText(props.fullPath)}>
        Copy full path
      </Button>
    </div>
  )
}

function WebSubmoduleActions(props: {
  readonly fullPath: string | null | undefined
  readonly filePath: string
  readonly dispatcher: WebDispatcher
  readonly status?: WebFile['status']['submoduleStatus']
  readonly disabled?: boolean
}) {
  const [strategy, setStrategy] =
    React.useState<WebSubmoduleUpdateStrategy>('checkout')

  return (
    <div className="web-submodule-actions" role="group">
      {props.status?.recordedCommit || props.status?.currentCommit ? (
        <p role="status">
          Recorded commit:{' '}
          {props.status.recordedCommit
            ? props.status.recordedCommit.slice(0, 8)
            : 'unknown'}
          ; current commit:{' '}
          {props.status.currentCommit
            ? props.status.currentCommit.slice(0, 8)
            : 'unavailable'}
        </p>
      ) : null}
      {props.status?.nested?.length ? (
        <div aria-label="Nested submodules" className="web-submodule-nested">
          <strong>Nested submodules</strong>
          {props.status.nested.map(nested => (
            <Button
              disabled={props.disabled}
              key={nested.path}
              onClick={() =>
                void props.dispatcher.addRepository(
                  repositoryFilePath(props.fullPath || '', nested.path)
                )
              }
            >
              Open nested submodule {nested.path}
            </Button>
          ))}
        </div>
      ) : null}
      {props.fullPath ? (
        <Button
          disabled={props.disabled}
          onClick={() => void props.dispatcher.addRepository(props.fullPath!)}
        >
          Open submodule repository
        </Button>
      ) : null}
      <label htmlFor={`web-submodule-strategy-${props.filePath}`}>
        Update strategy
      </label>
      <select
        disabled={props.disabled}
        id={`web-submodule-strategy-${props.filePath}`}
        onChange={event =>
          setStrategy(event.target.value as WebSubmoduleUpdateStrategy)
        }
        value={strategy}
      >
        <option value="checkout">Checkout recorded commit</option>
        <option value="merge">Merge recorded commit</option>
        <option value="rebase">Rebase onto recorded commit</option>
      </select>
      <Button
        disabled={props.disabled}
        onClick={() =>
          void props.dispatcher.runOperation('submodule-update', {
            values: [props.filePath],
            submoduleStrategy: strategy,
          })
        }
      >
        Update submodule
      </Button>
    </div>
  )
}

const coAuthorPattern = /^.+\s+<[^<>\r\n]+>$/

function invalidCoAuthorLines(value: string) {
  return value
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0 && !coAuthorPattern.test(line))
}

type WebStashAction = {
  readonly stash: WebStash
  readonly operation: 'stash-apply' | 'stash-pop' | 'stash-drop'
}

type WebResetUpstreamStrategy = 'stash' | 'cancel'

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
    getNumber('diff-font-size', defaultDiffFontSize)
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

function WebPreferencesDialog(props: {
  readonly open: boolean
  readonly preferences: WebDiffPresentationPreferences
  readonly dispatcher: WebDispatcher
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
  readonly showCommitLengthWarning: boolean
  readonly onShowCommitLengthWarningChanged: (value: boolean) => void
  readonly commitSummaryLengthWarningThreshold: number
  readonly onCommitSummaryLengthWarningThresholdChanged: (value: number) => void
  readonly uncommittedChangesStrategy: UncommittedChangesStrategy
  readonly onUncommittedChangesStrategyChanged: (
    value: UncommittedChangesStrategy
  ) => void
  readonly showRecentRepositories: boolean
  readonly onShowRecentRepositoriesChanged: (value: boolean) => void
  readonly showChangesFilter: boolean
  readonly onShowChangesFilterChanged: (value: boolean) => void
  readonly showStashedChanges: boolean
  readonly onShowStashedChangesChanged: (value: boolean) => void
  readonly integrations: WebIntegrations | null
  readonly editorIntegration: WebIntegrationSelection
  readonly shellIntegration: WebIntegrationSelection
  readonly onEditorIntegrationChanged: (value: WebIntegrationSelection) => void
  readonly onShellIntegrationChanged: (value: WebIntegrationSelection) => void
  readonly repositorySortOrder: WebRepositorySortOrder
  readonly onRepositorySortOrderChanged: (value: WebRepositorySortOrder) => void
  readonly onDismiss: () => void
}) {
  const [notificationPermission, setNotificationPermission] = React.useState<
    NotificationPermission | 'unsupported'
  >(getWebNotificationPermission)
  if (!props.open) return null

  const preferences = props.preferences
  const integrationChoice = (selection: WebIntegrationSelection): string =>
    selection.custom ? '__custom__' : selection.name || ''
  const editorIntegrationError = validateWebCustomIntegration(
    props.editorIntegration,
    'Custom editor'
  )
  const shellIntegrationError = validateWebCustomIntegration(
    props.shellIntegration,
    'Custom shell'
  )
  const updateIntegration = (kind: 'editor' | 'shell', value: string) => {
    const current =
      kind === 'editor' ? props.editorIntegration : props.shellIntegration
    const next =
      value === '__custom__'
        ? {
            name: null,
            custom: current.custom || {
              path: '',
              arguments: '%TARGET_PATH%',
            },
          }
        : { name: value || null, custom: null }
    ;(kind === 'editor'
      ? props.onEditorIntegrationChanged
      : props.onShellIntegrationChanged)(next)
  }
  const updateCustomIntegration = (
    kind: 'editor' | 'shell',
    field: keyof WebCustomIntegration,
    value: string
  ) => {
    const current =
      kind === 'editor' ? props.editorIntegration : props.shellIntegration
    const next: WebIntegrationSelection = {
      name: null,
      custom: {
        ...(current.custom || { path: '', arguments: '%TARGET_PATH%' }),
        [field]: value,
      },
    }
    ;(kind === 'editor'
      ? props.onEditorIntegrationChanged
      : props.onShellIntegrationChanged)(next)
  }
  const diffTypes: ReadonlyArray<[ImageDiffType, string]> = [
    [ImageDiffType.TwoUp, 'Two-up'],
    [ImageDiffType.Swipe, 'Swipe'],
    [ImageDiffType.OnionSkin, 'Onion skin'],
    [ImageDiffType.Difference, 'Difference'],
  ]

  return (
    <DialogStackContext.Provider value={{ isTopMost: true }}>
      <Dialog
        ariaDescribedBy="web-preferences-description"
        onDismissed={props.onDismiss}
        onSubmit={props.onDismiss}
        title="Preferences"
      >
        <DialogContent>
          <p id="web-preferences-description">
            Customize the appearance and diff presentation for this browser.
          </p>
          <fieldset className="web-dialog-options" aria-label="Appearance">
            <legend>Appearance</legend>
            {(
              [
                [ApplicationTheme.Dark, 'Dark'],
                [ApplicationTheme.Light, 'Light'],
                [ApplicationTheme.System, 'System'],
              ] as const
            ).map(([value, label]) => (
              <label key={value}>
                <input
                  checked={preferences.theme === value}
                  name="web-theme"
                  onChange={() => preferences.onThemeChanged(value)}
                  type="radio"
                />
                {label}
              </label>
            ))}
          </fieldset>
          <label htmlFor="web-diff-font-size">Diff font size</label>
          <input
            id="web-diff-font-size"
            max={24}
            min={8}
            onChange={event =>
              preferences.onDiffFontSizeChanged(Number(event.target.value))
            }
            type="number"
            value={preferences.diffFontSize}
          />
          <label htmlFor="web-diff-font-family">Diff font</label>
          <select
            id="web-diff-font-family"
            onChange={event =>
              preferences.onDiffFontFamilyChanged(event.target.value)
            }
            value={preferences.diffFontFamily}
          >
            <option value={defaultDiffFontFamily}>System monospace</option>
            <option value="Menlo">Menlo</option>
            <option value="SFMono-Regular">SF Mono</option>
            <option value="Monaco">Monaco</option>
          </select>
          <label htmlFor="web-tab-size">Tab size</label>
          <select
            id="web-tab-size"
            onChange={event =>
              preferences.onTabSizeChanged(Number(event.target.value))
            }
            value={preferences.tabSize}
          >
            {availableTabSizes.map(value => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <label htmlFor="web-branch-sort-order">Branch sort order</label>
          <select
            id="web-branch-sort-order"
            onChange={event =>
              props.onBranchSortOrderChanged(
                event.target.value as BranchSortOrder
              )
            }
            value={props.branchSortOrder}
          >
            <option value={BranchSortOrder.LastModified}>Last modified</option>
            <option value={BranchSortOrder.Alphabetical}>Alphabetical</option>
          </select>
          <label htmlFor="web-show-branch-name">
            Show current branch next to repository
          </label>
          <select
            id="web-show-branch-name"
            onChange={event =>
              props.onShowBranchNameChanged(
                event.target.value as 'never' | 'always' | 'non-default'
              )
            }
            value={props.showBranchName}
          >
            <option value="never">Never</option>
            <option value="always">Always</option>
            <option value="non-default">
              When it is not the default branch
            </option>
          </select>
          <label htmlFor="web-repository-sort-order">
            Repository sort order
          </label>
          <select
            id="web-repository-sort-order"
            onChange={event =>
              props.onRepositorySortOrderChanged(
                event.target.value as WebRepositorySortOrder
              )
            }
            value={props.repositorySortOrder}
          >
            <option value="recent">Recently opened</option>
            <option value="alphabetical">Alphabetical</option>
          </select>
          <fieldset
            aria-label="External integrations"
            className="web-dialog-options"
          >
            <legend>External integrations</legend>
            <label htmlFor="web-editor-integration">Repository editor</label>
            <select
              id="web-editor-integration"
              onChange={event =>
                updateIntegration('editor', event.target.value)
              }
              value={integrationChoice(props.editorIntegration)}
            >
              <option value="">Automatic (first available)</option>
              {(props.integrations?.editors || []).map(editor => (
                <option key={editor.name} value={editor.name}>
                  {editor.name}
                </option>
              ))}
              <option value="__custom__">Custom executable</option>
            </select>
            {props.editorIntegration.custom ? (
              <>
                <label htmlFor="web-custom-editor-path">
                  Custom editor executable
                </label>
                <input
                  aria-invalid={Boolean(editorIntegrationError)}
                  id="web-custom-editor-path"
                  onChange={event =>
                    updateCustomIntegration(
                      'editor',
                      'path',
                      event.target.value
                    )
                  }
                  placeholder="/Applications/My Editor.app"
                  type="text"
                  value={props.editorIntegration.custom.path}
                />
                <label htmlFor="web-custom-editor-arguments">
                  Custom editor arguments
                </label>
                <input
                  aria-invalid={Boolean(editorIntegrationError)}
                  id="web-custom-editor-arguments"
                  onChange={event =>
                    updateCustomIntegration(
                      'editor',
                      'arguments',
                      event.target.value
                    )
                  }
                  placeholder="%TARGET_PATH%"
                  type="text"
                  value={props.editorIntegration.custom.arguments}
                />
                {editorIntegrationError ? (
                  <p role="alert">{editorIntegrationError}</p>
                ) : null}
              </>
            ) : null}
            <label htmlFor="web-shell-integration">Repository shell</label>
            <select
              id="web-shell-integration"
              onChange={event => updateIntegration('shell', event.target.value)}
              value={integrationChoice(props.shellIntegration)}
            >
              <option value="">Automatic (first available)</option>
              {(props.integrations?.shells || []).map(shell => (
                <option key={shell.name} value={shell.name}>
                  {shell.name}
                </option>
              ))}
              <option value="__custom__">Custom executable</option>
            </select>
            {props.shellIntegration.custom ? (
              <>
                <label htmlFor="web-custom-shell-path">
                  Custom shell executable
                </label>
                <input
                  aria-invalid={Boolean(shellIntegrationError)}
                  id="web-custom-shell-path"
                  onChange={event =>
                    updateCustomIntegration('shell', 'path', event.target.value)
                  }
                  placeholder="/usr/local/bin/my-shell"
                  type="text"
                  value={props.shellIntegration.custom.path}
                />
                <label htmlFor="web-custom-shell-arguments">
                  Custom shell arguments
                </label>
                <input
                  aria-invalid={Boolean(shellIntegrationError)}
                  id="web-custom-shell-arguments"
                  onChange={event =>
                    updateCustomIntegration(
                      'shell',
                      'arguments',
                      event.target.value
                    )
                  }
                  placeholder="--cwd %TARGET_PATH%"
                  type="text"
                  value={props.shellIntegration.custom.arguments}
                />
                {shellIntegrationError ? (
                  <p role="alert">{shellIntegrationError}</p>
                ) : null}
              </>
            ) : null}
            {props.integrations?.guidance ? (
              <p role="status">{props.integrations.guidance}</p>
            ) : null}
          </fieldset>
          <label>
            <input
              checked={props.preferAbsoluteDates}
              onChange={event =>
                props.onPreferAbsoluteDatesChanged(event.target.checked)
              }
              type="checkbox"
            />
            Use absolute dates in history
          </label>
          <label>
            <input
              checked={props.showConventionalCommitBadges}
              onChange={event =>
                props.onShowConventionalCommitBadgesChanged(
                  event.target.checked
                )
              }
              type="checkbox"
            />
            Show Conventional Commit badges
          </label>
          <label>
            <input
              checked={props.confirmStashActions}
              onChange={event =>
                props.onConfirmStashActionsChanged(event.target.checked)
              }
              type="checkbox"
            />
            Confirm stash apply, pop, and drop
          </label>
          <label>
            <input
              checked={props.showWorktreesInRepositoryList}
              onChange={event =>
                props.onShowWorktreesInRepositoryListChanged(
                  event.target.checked
                )
              }
              type="checkbox"
            />
            Show linked worktrees in repository list
          </label>
          <label>
            <input
              checked={props.repositoryIndicatorsEnabled}
              onChange={event =>
                props.onRepositoryIndicatorsEnabledChanged(event.target.checked)
              }
              type="checkbox"
            />
            Show repository change and sync indicators
          </label>
          <label>
            <input
              checked={props.confirmRepositoryRemoval}
              onChange={event =>
                props.onConfirmRepositoryRemovalChanged(event.target.checked)
              }
              type="checkbox"
            />
            Confirm repository removal
          </label>
          <label>
            <input
              checked={props.confirmWorktreeRemoval}
              onChange={event =>
                props.onConfirmWorktreeRemovalChanged(event.target.checked)
              }
              type="checkbox"
            />
            Confirm worktree removal
          </label>
          <label>
            <input
              checked={props.showRecentRepositories}
              onChange={event =>
                props.onShowRecentRepositoriesChanged(event.target.checked)
              }
              type="checkbox"
            />
            Show recent repositories
          </label>
          <label>
            <input
              checked={props.showChangesFilter}
              onChange={event =>
                props.onShowChangesFilterChanged(event.target.checked)
              }
              type="checkbox"
            />
            Show Changes filters
          </label>
          <label>
            <input
              checked={props.showStashedChanges}
              onChange={event =>
                props.onShowStashedChangesChanged(event.target.checked)
              }
              type="checkbox"
            />
            Show stashed changes in Changes
          </label>
          <fieldset
            aria-label="Browser notifications"
            className="web-dialog-options"
          >
            <legend>Browser notifications</legend>
            <label>
              <input
                checked={props.browserNotificationsEnabled}
                onChange={event =>
                  props.onBrowserNotificationsEnabledChanged(
                    event.target.checked
                  )
                }
                type="checkbox"
              />
              Enable browser notifications
            </label>
            <p role="status">
              {!props.browserNotificationsEnabled
                ? 'Browser notifications are disabled in Desktop Plus.'
                : notificationPermission === 'granted'
                ? 'Browser notifications are allowed for this browser.'
                : notificationPermission === 'denied'
                ? 'Browser notifications are blocked. Allow them in the browser site settings.'
                : notificationPermission === 'default'
                ? 'Browser notifications need permission before they can appear.'
                : 'This browser does not support notifications.'}
            </p>
            {props.browserNotificationsEnabled &&
            notificationPermission !== 'granted' &&
            notificationPermission !== 'unsupported' ? (
              <Button
                onClick={async () => {
                  const permission =
                    await props.dispatcher.requestNotificationPermission()
                  setNotificationPermission(permission)
                }}
              >
                Allow browser notifications
              </Button>
            ) : null}
          </fieldset>
          <label>
            <input
              checked={props.showCommitLengthWarning}
              onChange={event =>
                props.onShowCommitLengthWarningChanged(event.target.checked)
              }
              type="checkbox"
            />
            Show commit length warning
          </label>
          <label htmlFor="web-commit-summary-length-warning-threshold">
            Commit summary warning length
          </label>
          <input
            id="web-commit-summary-length-warning-threshold"
            max={72}
            min={1}
            onChange={event =>
              props.onCommitSummaryLengthWarningThresholdChanged(
                Number(event.target.value)
              )
            }
            type="number"
            value={props.commitSummaryLengthWarningThreshold}
          />
          <fieldset
            aria-label="Changes when switching branches"
            className="web-dialog-options"
          >
            <legend>If I have changes and switch branches</legend>
            {(
              [
                [
                  UncommittedChangesStrategy.AskForConfirmation,
                  'Ask me where I want the changes to go',
                ],
                [
                  UncommittedChangesStrategy.MoveToNewBranch,
                  'Always bring my changes to my new branch',
                ],
                [
                  UncommittedChangesStrategy.StashOnCurrentBranch,
                  'Always stash and leave my changes on the current branch',
                ],
              ] as const
            ).map(([value, label]) => (
              <label key={value}>
                <input
                  checked={props.uncommittedChangesStrategy === value}
                  name="web-uncommitted-changes-strategy"
                  onChange={() =>
                    props.onUncommittedChangesStrategyChanged(value)
                  }
                  type="radio"
                />
                {label}
              </label>
            ))}
          </fieldset>
          <fieldset className="web-dialog-options" aria-label="Image diffs">
            <legend>Image diffs</legend>
            {diffTypes.map(([value, label]) => (
              <label key={value}>
                <input
                  checked={preferences.imageDiffType === value}
                  name="web-image-diff-type"
                  onChange={() => preferences.onImageDiffTypeChanged(value)}
                  type="radio"
                />
                {label}
              </label>
            ))}
          </fieldset>
          <label>
            <input
              checked={preferences.showDiffCheckMarks}
              onChange={event =>
                preferences.onShowDiffCheckMarksChanged(event.target.checked)
              }
              type="checkbox"
            />
            Show diff inclusion check marks
          </label>
          <label>
            <input
              checked={preferences.showSideBySideDiff}
              onChange={event =>
                preferences.onShowSideBySideDiffChanged(event.target.checked)
              }
              type="checkbox"
            />
            Show side-by-side diffs
          </label>
          <label>
            <input
              checked={preferences.showDiffMinimap}
              onChange={event =>
                preferences.onShowDiffMinimapChanged(event.target.checked)
              }
              type="checkbox"
            />
            Show diff minimap
          </label>
          <label>
            <input
              checked={preferences.wrapDiffLines}
              onChange={event =>
                preferences.onWrapDiffLinesChanged(event.target.checked)
              }
              type="checkbox"
            />
            Wrap diff lines
          </label>
          <label>
            <input
              checked={preferences.hideWhitespaceInDiff}
              onChange={event =>
                preferences.onHideWhitespaceInDiffChanged(event.target.checked)
              }
              type="checkbox"
            />
            Hide whitespace changes
          </label>
          <label>
            <input
              checked={preferences.showWholeFile}
              onChange={event =>
                preferences.onShowWholeFileChanged(event.target.checked)
              }
              type="checkbox"
            />
            Show whole files in diffs
          </label>
        </DialogContent>
        <DialogFooter>
          <Button onClick={props.onDismiss}>Close</Button>
        </DialogFooter>
      </Dialog>
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
  return { gitHubRepository: null, path } as Repository
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

function getDesktopFileContents(
  file: WorkingDirectoryFileChange | CommittedFileChange,
  webDiff: WebDiff | null
): IFileContents | null {
  const contents = webDiff?.fileContents
  if (!contents) return null
  const cached = desktopFileContentsCache.get(contents)
  if (cached?.file === file) return cached
  const result = {
    file,
    oldContents: contents.oldContents,
    newContents: contents.newContents,
    canBeExpanded: contents.canBeExpanded,
  }
  desktopFileContentsCache.set(contents, result)
  return result
}

const desktopFileContentsCache = new WeakMap<
  NonNullable<WebDiff['fileContents']>,
  IFileContents
>()

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

function getDesktopTag(tag: WebTag): Branch {
  return new Branch(
    tag.name,
    null,
    { sha: tag.sha, author: { date: new Date(0) } },
    BranchType.Local,
    `refs/tags/${tag.name}`,
    false
  )
}

function getReachableHistorySHAs(
  tips: ReadonlyArray<string>,
  commits: ReadonlyMap<string, Commit>
) {
  const reachable = new Set<string>()
  const pending = [...tips]

  while (pending.length > 0) {
    const sha = pending.pop()
    if (!sha || reachable.has(sha)) continue

    const commit = commits.get(sha)
    if (!commit) continue

    reachable.add(sha)
    pending.push(...commit.parentSHAs)
  }

  return reachable
}

type WebHistoryGraphGroup = 'local' | 'origin' | 'upstream' | 'remote' | 'tags'

function getWebHistoryGraphGroup(branch: Branch): WebHistoryGraphGroup {
  if (branch.ref.startsWith('refs/tags/')) return 'tags'
  if (branch.type === BranchType.Local) return 'local'
  if (branch.remoteName === 'origin') return 'origin'
  if (branch.remoteName === 'upstream') return 'upstream'
  return 'remote'
}

function WebHistoryGraphView(props: {
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
}) {
  const webBranches = props.state.branches?.branches || []
  const branches = webBranches
    .map(getDesktopBranch)
    .filter((branch): branch is Branch => branch !== null)
    .filter(branch => !branch.name.endsWith('/HEAD'))
  const tags = (props.state.branches?.tags || []).map(getDesktopTag)
  const allBranches = [...branches, ...tags]
  const hiddenRefs = new Set(props.state.historyGraphHiddenRefs)
  const visibleBranches = allBranches.filter(
    branch => !hiddenRefs.has(branch.ref)
  )
  const commits = props.state.history.map(getDesktopCommit)
  const commitLookup = new Map(commits.map(commit => [commit.sha, commit]))
  const reachable = getReachableHistorySHAs(
    visibleBranches.map(branch => branch.tip.sha),
    commitLookup
  )
  const visibleCommits = commits.filter(commit => reachable.has(commit.sha))
  const visibleCommitSHAs = visibleCommits.map(commit => commit.sha)
  const currentBranch = getDesktopBranch(props.state.branches?.branch)
  const branchColors = new Map<string, string>()
  const colorsByTip = new Map<string, string>()
  allBranches.forEach(branch => {
    let color = colorsByTip.get(branch.tip.sha)
    if (!color) {
      color = commitGraph_getColor(colorsByTip.size)
      colorsByTip.set(branch.tip.sha, color)
    }
    branchColors.set(branch.ref, color)
  })
  const branchesByCommit = new Map<string, Branch[]>()
  visibleBranches.forEach(branch => {
    if (branch.ref.startsWith('refs/tags/')) return
    const current = branchesByCommit.get(branch.tip.sha) || []
    current.push(branch)
    branchesByCommit.set(branch.tip.sha, current)
  })
  const refColors = visibleBranches.map(branch => ({
    sha: branch.tip.sha,
    color: branchColors.get(branch.ref) || commitGraph_getColor(0),
  }))
  const primaryLaneSha =
    currentBranch &&
    visibleBranches.some(branch => branch.ref === currentBranch.ref)
      ? currentBranch.tip.sha
      : undefined
  const rows = commitGraph_buildRows(visibleCommits, refColors, primaryLaneSha)
  const rowBySha = new Map(rows.map(row => [row.sha, row]))
  const groups = (
    [
      'local',
      'origin',
      'upstream',
      'remote',
      'tags',
    ] as ReadonlyArray<WebHistoryGraphGroup>
  ).filter(group =>
    allBranches.some(branch => getWebHistoryGraphGroup(branch) === group)
  )
  const groupLabels: Record<WebHistoryGraphGroup, string> = {
    local: 'Local branches',
    origin: 'origin',
    upstream: 'upstream',
    remote: 'Other remotes',
    tags: 'Tags',
  }

  const toggleBranch = (branch: Branch) => {
    const next = new Set(hiddenRefs)
    if (next.has(branch.ref)) next.delete(branch.ref)
    else next.add(branch.ref)
    props.dispatcher.setHistoryGraphHiddenRefs([...next])
  }
  const toggleGroup = (group: WebHistoryGraphGroup) => {
    const groupBranches = allBranches.filter(
      branch => getWebHistoryGraphGroup(branch) === group
    )
    const allSelected = groupBranches.every(
      branch => !hiddenRefs.has(branch.ref)
    )
    const next = new Set(hiddenRefs)
    groupBranches.forEach(branch => {
      if (allSelected) next.add(branch.ref)
      else next.delete(branch.ref)
    })
    props.dispatcher.setHistoryGraphHiddenRefs([...next])
  }
  const toggleCollapsed = (group: WebHistoryGraphGroup) => {
    const next = new Set(props.state.historyGraphCollapsedGroups)
    if (next.has(group)) next.delete(group)
    else next.add(group)
    props.dispatcher.setHistoryGraphCollapsedGroups([...next])
  }

  return (
    <div className="web-history-graph-view">
      <aside className="commitGraph-branches-pane" aria-label="History refs">
        <div className="commitGraph-branch-list" role="group">
          {groups.map(group => {
            const groupBranches = allBranches.filter(
              branch => getWebHistoryGraphGroup(branch) === group
            )
            const collapsed =
              props.state.historyGraphCollapsedGroups.includes(group)
            const selectedCount = groupBranches.filter(
              branch => !hiddenRefs.has(branch.ref)
            ).length
            return (
              <div className="commitGraph-branch-group" key={group}>
                <div className="commitGraph-branch-group-row">
                  <button
                    aria-expanded={!collapsed}
                    aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${
                      groupLabels[group]
                    }`}
                    className="commitGraph-group-disclosure"
                    onClick={() => toggleCollapsed(group)}
                    type="button"
                  >
                    <Octicon
                      symbol={
                        collapsed
                          ? octicons.triangleRight
                          : octicons.triangleDown
                      }
                    />
                  </button>
                  <label className="commitGraph-group-checkbox">
                    <input
                      aria-label={`Select ${groupLabels[group]}`}
                      checked={selectedCount === groupBranches.length}
                      onChange={() => toggleGroup(group)}
                      type="checkbox"
                    />
                    {groupLabels[group]} ({groupBranches.length})
                  </label>
                </div>
                {!collapsed
                  ? groupBranches.map(branch => (
                      <label className="commitGraph-branch" key={branch.ref}>
                        <input
                          aria-label={`Show ${branch.name}`}
                          checked={!hiddenRefs.has(branch.ref)}
                          onChange={() => toggleBranch(branch)}
                          type="checkbox"
                        />
                        <span
                          className="commitGraph-branch-label-content"
                          title={branch.name}
                        >
                          <span
                            className="commitGraph-branch-color-swatch"
                            style={{
                              backgroundColor:
                                branchColors.get(branch.ref) || undefined,
                            }}
                          />
                          {branch.ref === currentBranch?.ref ? (
                            <span className="commitGraph-branch-current-indicator" />
                          ) : null}
                          <span
                            className={
                              branch.ref === currentBranch?.ref
                                ? 'commitGraph-branch-label current'
                                : 'commitGraph-branch-label'
                            }
                          >
                            {branch.name}
                          </span>
                        </span>
                      </label>
                    ))
                  : null}
              </div>
            )
          })}
        </div>
      </aside>
      <div className="commitGraph-list">
        <CommitList
          accounts={[]}
          allHistoryCommitSHAs={visibleCommitSHAs}
          canAmendCommits={true}
          canResetToCommits={false}
          canUndoCommits={true}
          className="commitGraph-commit-list"
          commitGraphRowHeight={commitGraph_RowHeight}
          commitLookup={commitLookup}
          commitSHAs={visibleCommitSHAs}
          disableReordering={true}
          disableRowFocusTooltip={true}
          dispatcher={props.dispatcher as never}
          emptyListMessage={
            visibleBranches.length === 0 ? 'No branches selected' : 'No history'
          }
          emoji={props.state.emoji}
          headCommitSha={props.state.branches?.branch?.tip?.sha || undefined}
          isInformationalView={false}
          isLocalRepository={(props.state.branches?.remotes?.length || 0) === 0}
          localCommitSHAs={props.state.branches?.localCommitSHAs || []}
          preferAbsoluteDates={props.preferAbsoluteDates}
          repository={getDesktopRepository(
            props.state.selectedRepositoryPath || ''
          )}
          onAmendCommit={commit => props.onAmendCommit(commit)}
          onCheckoutCommit={commit => {
            const selected = commitLookup.get(commit.sha)
            if (selected) props.onCheckoutCommit(selected)
          }}
          onCherryPick={commits =>
            props.onCherryPick(
              commits.flatMap(commit => {
                const selected = commitLookup.get(commit.sha)
                return selected ? [selected] : []
              })
            )
          }
          onCommitsSelected={commits => {
            const shas = commits.map(commit => commit.sha)
            props.onSelectedSHAsChanged(shas)
            if (shas.length === 1)
              void props.dispatcher.inspectHistoryCommit(shas[0])
            else props.dispatcher.clearHistoryInspection()
          }}
          onCreateBranch={commit => {
            const selected = commitLookup.get(commit.sha)
            if (selected) props.onCreateBranch(selected)
          }}
          onCreateTag={sha => {
            const commit = commitLookup.get(sha)
            if (commit) props.onCreateTag(commit)
          }}
          onDeleteTag={name => props.onDeleteTag(name)}
          onRevertCommit={commit => props.onRevertCommit(commit)}
          onResetToCommit={commit => props.onResetToCommit(commit)}
          onScroll={(_start, end) => {
            if (
              props.state.hasMoreHistory &&
              end >= visibleCommitSHAs.length - 5
            )
              void props.dispatcher.loadMoreHistory()
          }}
          onUndoCommit={commit => props.onUndoCommit(commit)}
          renderCommitItem={({
            commit,
            row,
            showUnpushedIndicator,
            unpushedIndicatorTitle,
          }) => {
            const graphRow: ICommitGraphRow | undefined = rowBySha.get(
              commit.sha
            )
            if (!graphRow) return null
            return (
              <CommitGraphCommitListItem
                accounts={[]}
                branchColors={branchColors}
                branches={branchesByCommit.get(commit.sha) || []}
                commit={commit}
                commitGraphRow={graphRow}
                currentBranch={currentBranch}
                currentTipSha={props.state.branches?.branch?.tip?.sha || null}
                emoji={props.state.emoji}
                gitHubRepository={null}
                key={commit.sha}
                preferAbsoluteDates={props.preferAbsoluteDates}
                showConventionalCommitBadges={
                  props.showConventionalCommitBadges
                }
                showUnpushedIndicator={showUnpushedIndicator}
                unpushedIndicatorTitle={unpushedIndicatorTitle}
              />
            )
          }}
          selectedSHAs={props.selectedSHAs}
          showConventionalCommitBadges={props.showConventionalCommitBadges}
          tagsToPush={props.state.branches?.tagsToPush || []}
        />
      </div>
    </div>
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

function sanitizedOperationOutput(
  output: {
    readonly stdout: string
    readonly stderr: string
    readonly exitCode: number
  } | null
) {
  if (!output) return ''
  const text = [output.stderr, output.stdout].filter(Boolean).join('\n').trim()
  return text
    .replace(
      /(https?:\/\/)([^@\s/:]+):([^@\s]+)@/gi,
      '$1[credentials redacted]@'
    )
    .replace(
      /\b(?:ghp|gho|ghu|ghs|ghr|glpat|github_pat)_[A-Za-z0-9_]+/g,
      '[token redacted]'
    )
    .replace(
      /(\b(?:authorization|password|token|oauth_token)\s*[:=]\s*)(\S+)/gi,
      '$1[redacted]'
    )
    .slice(-256 * 1024)
}

function ErrorDialog(props: {
  readonly error: string | null
  readonly errorCode: string | null
  readonly configLockScope: 'local' | 'global' | null
  readonly canRetry: boolean
  readonly hookFailure: {
    readonly hookName: string
    readonly terminalOutput: string
  } | null
  readonly operationOutput: {
    readonly stdout: string
    readonly stderr: string
    readonly exitCode: number
  } | null
  readonly dispatcher: WebDispatcher
  readonly onRefreshRepository?: () => void
  readonly onChoosePermanentDelete?: () => void
}) {
  if (!props.error) return null
  const remoteErrorCodes = new Set([
    'authentication-required',
    'credential-helper-failed',
    'ssh-host-key',
    'certificate-error',
    'network-unavailable',
    'git-remote-failed',
  ])
  const output = remoteErrorCodes.has(props.errorCode || '')
    ? sanitizedOperationOutput(props.operationOutput)
    : ''
  return (
    <DialogStackContext.Provider value={{ isTopMost: true }}>
      <Dialog
        ariaDescribedBy="error-message"
        onDismissed={() => props.dispatcher.dismissError()}
        title="Error"
        type="error"
      >
        <DialogContent>
          <p id="error-message">{props.error}</p>
          {props.hookFailure ? (
            <details open={true}>
              <summary>{props.hookFailure.hookName} hook output</summary>
              <pre className="web-error-output">
                {props.hookFailure.terminalOutput}
              </pre>
            </details>
          ) : null}
          {props.errorCode === 'submodule-update-failed' &&
          props.operationOutput ? (
            <details open={true}>
              <summary>Submodule command output</summary>
              <pre className="web-error-output">
                {(
                  props.operationOutput.stderr ||
                  props.operationOutput.stdout ||
                  `Git exited with ${props.operationOutput.exitCode}`
                ).trim()}
              </pre>
              <p>
                Refresh the repository after fixing the nested repository or
                remote, then retry the update.
              </p>
            </details>
          ) : null}
          {props.errorCode === 'authentication-required' ? (
            <p role="alert">
              Check the macOS Keychain or SSH key used by Git. Desktop Plus
              never stores remote credentials in browser storage.
            </p>
          ) : null}
          {props.errorCode === 'credential-helper-failed' ? (
            <p role="alert">
              Git could not obtain credentials from its configured helper. Check
              the helper configuration and macOS Keychain access, then retry.
            </p>
          ) : null}
          {props.errorCode === 'ssh-host-key' ? (
            <p role="alert">
              Confirm the remote host identity before changing{' '}
              <code>~/.ssh/known_hosts</code>. Retry only after the host key is
              trusted.
            </p>
          ) : null}
          {props.errorCode === 'certificate-error' ? (
            <p role="alert">
              Check the remote certificate, proxy, and Git TLS configuration. Do
              not bypass certificate verification unless the endpoint is
              trusted.
            </p>
          ) : null}
          {props.errorCode === 'network-unavailable' ? (
            <p role="alert">
              Check the network connection, proxy, and remote URL, then retry.
            </p>
          ) : null}
          {output ? (
            <details open={true}>
              <summary>Git remote output</summary>
              <pre className="web-error-output">
                {output || `Git exited with ${props.operationOutput?.exitCode}`}
              </pre>
            </details>
          ) : null}
          {props.errorCode === 'missing-git' ? (
            <p role="alert">
              Git is unavailable on this Mac. Install Apple Command Line Tools
              and restart Desktop Plus before retrying.
            </p>
          ) : null}
          {props.errorCode === 'git-config-locked' && props.configLockScope ? (
            <p role="alert">
              Desktop Plus removes only a stale lock older than five minutes.
              Make sure no Git editor or other Git process is using the{' '}
              {props.configLockScope} config before continuing.
            </p>
          ) : null}
        </DialogContent>
        <DialogFooter>
          {props.errorCode === 'missing-git' ? (
            <Button
              onClick={() =>
                props.dispatcher.openExternal(
                  'https://developer.apple.com/library/archive/technotes/tn2339/_index.html'
                )
              }
              type="button"
            >
              Open Git installation guide
            </Button>
          ) : null}
          {props.canRetry ? (
            <Button
              onClick={() => void props.dispatcher.retryLastAction()}
              type="button"
            >
              Retry
            </Button>
          ) : null}
          {props.errorCode === 'submodule-update-failed' &&
          props.onRefreshRepository ? (
            <Button onClick={props.onRefreshRepository} type="button">
              Refresh repository
            </Button>
          ) : null}
          {props.errorCode === 'git-config-locked' && props.configLockScope ? (
            <Button
              className="destructive"
              onClick={() =>
                void props.dispatcher.recoverGitConfigLock(
                  props.configLockScope!
                )
              }
              type="button"
            >
              Recover stale config lock
            </Button>
          ) : null}
          {props.errorCode === 'trash-failed' &&
          props.onChoosePermanentDelete ? (
            <Button
              className="destructive"
              onClick={props.onChoosePermanentDelete}
              type="button"
            >
              Delete permanently
            </Button>
          ) : null}
          <Button onClick={() => props.dispatcher.dismissError()} type="button">
            Close
          </Button>
        </DialogFooter>
      </Dialog>
    </DialogStackContext.Provider>
  )
}

function WebOperationTaskStatus(props: {
  readonly task: WebOperationTask | null
  readonly onCancel: () => void
}) {
  if (!props.task) return null
  const output = sanitizedOperationOutput(
    props.task.result
      ? {
          stdout: props.task.result.stdout,
          stderr: props.task.result.stderr,
          exitCode: props.task.result.exitCode,
        }
      : props.task.output
      ? { stdout: props.task.output, stderr: '', exitCode: 0 }
      : null
  )
  const running = props.task.status === 'running'
  const cancelling = props.task.phase === 'Cancelling'
  const operationTitle = props.task.operation
    .replaceAll('-', ' ')
    .replace(/\b\w/g, character => character.toUpperCase())
  const commitProgress =
    props.task.position !== null && props.task.totalCommitCount !== null
      ? `${operationTitle} progress: ${props.task.position} of ${props.task.totalCommitCount}`
      : null
  return (
    <section
      aria-label="Git operation progress"
      aria-live="polite"
      aria-busy={running}
      className="web-operation-task"
    >
      <div className="web-operation-task-heading">
        <strong>
          {operationTitle} {props.task.phase.toLowerCase()}
        </strong>
        {props.task.progress !== null ? (
          <span>{props.task.progress}%</span>
        ) : null}
      </div>
      {commitProgress ? (
        <p className="web-operation-progress" role="status">
          {commitProgress}
          {props.task.currentCommitSummary
            ? ` (${props.task.currentCommitSummary})`
            : props.task.currentCommit
            ? ` (${props.task.currentCommit.slice(0, 8)})`
            : ''}
        </p>
      ) : null}
      {props.task.progress !== null ? (
        <progress
          max={100}
          value={props.task.progress}
          aria-label={`${props.task.operation} progress`}
        />
      ) : null}
      <p>
        {running
          ? 'Git is working in the companion.'
          : props.task.status === 'failed'
          ? `${operationTitle} stopped. Resolve any conflicts in Changes, then continue or abort the operation.`
          : props.task.phase}
      </p>
      {output ? (
        <details>
          <summary>Git operation output</summary>
          <pre className="web-error-output">{output}</pre>
        </details>
      ) : null}
      {running ? (
        <Button
          className="destructive"
          disabled={cancelling}
          onClick={props.onCancel}
        >
          {cancelling ? 'Cancelling…' : 'Cancel Git operation'}
        </Button>
      ) : null}
    </section>
  )
}

function DesktopAppChrome(props: {
  readonly children: React.ReactNode
  readonly className?: string
  readonly theme: ApplicationTheme
  readonly tabSize: number
  readonly diffFontSize: number
  readonly diffFontFamily: DiffFontFamily
  readonly zoomFactor?: number
  readonly menu?: WebApplicationMenuProps
}) {
  return (
    <div
      className={props.className ? `focused ${props.className}` : 'focused'}
      id="desktop-app-chrome"
      style={
        {
          tabSize: props.tabSize,
          '--diff-font-size': `${props.diffFontSize}px`,
          '--diff-font-family': getDiffFontFamilyCssValue(props.diffFontFamily),
          '--diff-line-height': `${getDiffLineHeight(props.diffFontSize)}px`,
          zoom: props.zoomFactor || 1,
        } as React.CSSProperties
      }
    >
      <AppTheme theme={props.theme} />
      <div id="desktop-app-contents">
        {props.menu ? <WebApplicationMenu {...props.menu} /> : null}
        {props.children}
      </div>
    </div>
  )
}

type WebApplicationMenuProps = {
  readonly onOpenRepositoryDialog: () => void
  readonly onOpenCloneDialog: () => void
  readonly onOpenInitDialog: () => void
  readonly onOpenPreferences: () => void
  readonly zoomFactor?: number
  readonly onZoomIn?: () => void
  readonly onZoomOut?: () => void
  readonly onResetZoom?: () => void
  readonly onSelectSection?: (
    section: 'changes' | 'history' | 'compare' | 'repository-tools'
  ) => void
  readonly onRefresh?: () => void
  readonly onCommit?: () => void
  readonly showChangesFilter?: boolean
  readonly onToggleChangesFilter?: () => void
  readonly showStashedChanges?: boolean
  readonly onToggleStashedChanges?: () => void
  readonly onEdit?: (
    action: 'undo' | 'redo' | 'cut' | 'copy' | 'paste' | 'select-all' | 'find'
  ) => void
  readonly onRequestAction?: (action: WebMenuAction) => void
  readonly onOpenRepositoryList?: () => void
  readonly onOpenBranchList?: () => void
  readonly onOpenWorktreesList?: () => void
  readonly onToggleFullscreen?: () => void
  readonly onResize?: (direction: 'increase' | 'decrease') => void
  readonly onRemoveRepository?: () => void
  readonly onOpenShell?: () => void
  readonly onOpenEditor?: () => void
  readonly onRevealRepository?: () => void
  readonly onOpenRepositorySettings?: () => void
  readonly onManageRemotes?: () => void
  readonly onBranchAction?: (
    action:
      | 'create'
      | 'rename'
      | 'delete'
      | 'discard'
      | 'stash'
      | 'update'
      | 'merge'
      | 'squash-merge'
      | 'rebase'
  ) => void
  readonly onOpenExternal?: (url: string) => void
  readonly onRunOperation?: (
    operation: WebGitOperation,
    options?: WebOperationOptions
  ) => void
}

type WebMenuAction =
  | 'repository-list'
  | 'branch-list'
  | 'worktrees-list'
  | 'branch-create'
  | 'branch-rename'
  | 'branch-delete'
  | 'branch-discard'
  | 'branch-stash'
  | 'branch-update'
  | 'branch-merge'
  | 'branch-squash-merge'
  | 'branch-rebase'

type WebApplicationMenuGroup = {
  readonly label: string
  readonly items: ReadonlyArray<{
    readonly label: string
    readonly shortcut?: string
    readonly onSelect: () => void
  }>
}

function WebApplicationMenu(props: WebApplicationMenuProps) {
  const [openMenu, setOpenMenu] = React.useState<string | null>(null)
  const menuRef = React.useRef<HTMLElement | null>(null)

  const viewItems: WebApplicationMenuGroup['items'] = [
    ...(props.onSelectSection
      ? [
          {
            label: 'Changes',
            shortcut: '⌘1',
            onSelect: () => props.onSelectSection?.('changes'),
          },
          {
            label: 'History',
            shortcut: '⌘2',
            onSelect: () => props.onSelectSection?.('history'),
          },
          {
            label: 'Compare',
            shortcut: '⌘3',
            onSelect: () => props.onSelectSection?.('compare'),
          },
          {
            label: 'Repository tools',
            shortcut: '⌘4',
            onSelect: () => props.onSelectSection?.('repository-tools'),
          },
        ]
      : []),
    ...(props.onRequestAction
      ? [
          {
            label: 'Repository list',
            shortcut: '⌘T',
            onSelect: () => props.onRequestAction?.('repository-list'),
          },
        ]
      : []),
    ...(props.onRequestAction
      ? [
          {
            label: 'Branches list',
            shortcut: '⌘B',
            onSelect: () => props.onRequestAction?.('branch-list'),
          },
        ]
      : []),
    ...(props.onRequestAction
      ? [
          {
            label: 'Worktrees list',
            shortcut: '⌥⌘W',
            onSelect: () => props.onRequestAction?.('worktrees-list'),
          },
        ]
      : []),
    ...(props.onRefresh
      ? [
          {
            label: 'Refresh repository',
            onSelect: props.onRefresh,
          },
        ]
      : []),
    ...(props.onToggleChangesFilter
      ? [
          {
            label: `${
              props.showChangesFilter ? 'Hide' : 'Show'
            } Changes filters`,
            onSelect: props.onToggleChangesFilter,
          },
        ]
      : []),
    ...(props.onToggleStashedChanges
      ? [
          {
            label: `${
              props.showStashedChanges ? 'Hide' : 'Show'
            } stashed changes`,
            onSelect: props.onToggleStashedChanges,
          },
        ]
      : []),
    ...(props.onZoomIn && props.onZoomOut && props.onResetZoom
      ? [
          {
            label: 'Zoom in',
            shortcut: '⌘+',
            onSelect: props.onZoomIn,
          },
          {
            label: 'Zoom out',
            shortcut: '⌘-',
            onSelect: props.onZoomOut,
          },
          {
            label: `Reset zoom${
              props.zoomFactor
                ? ` (${Math.round(props.zoomFactor * 100)}%)`
                : ''
            }`,
            shortcut: '⌘0',
            onSelect: props.onResetZoom,
          },
        ]
      : []),
    ...(props.onToggleFullscreen
      ? [
          {
            label: 'Toggle full screen',
            onSelect: props.onToggleFullscreen,
          },
        ]
      : []),
    ...(props.onResize
      ? [
          {
            label: 'Expand active resizable',
            shortcut: '⌘9',
            onSelect: () => props.onResize?.('increase'),
          },
          {
            label: 'Contract active resizable',
            shortcut: '⌘8',
            onSelect: () => props.onResize?.('decrease'),
          },
        ]
      : []),
    {
      label: 'Preferences',
      shortcut: '⌘,',
      onSelect: props.onOpenPreferences,
    },
  ]

  const groups: ReadonlyArray<WebApplicationMenuGroup> = [
    {
      label: 'File',
      items: [
        {
          label: 'New repository',
          shortcut: '⌘N',
          onSelect: props.onOpenInitDialog,
        },
        {
          label: 'Add local repository',
          shortcut: '⌘O',
          onSelect: props.onOpenRepositoryDialog,
        },
        {
          label: 'Clone repository',
          shortcut: '⇧⌘O',
          onSelect: props.onOpenCloneDialog,
        },
      ],
    },
    ...(props.onEdit
      ? [
          {
            label: 'Edit',
            items: [
              {
                label: 'Undo',
                shortcut: '⌘Z',
                onSelect: () => props.onEdit?.('undo'),
              },
              {
                label: 'Redo',
                shortcut: '⇧⌘Z',
                onSelect: () => props.onEdit?.('redo'),
              },
              {
                label: 'Cut',
                shortcut: '⌘X',
                onSelect: () => props.onEdit?.('cut'),
              },
              {
                label: 'Copy',
                shortcut: '⌘C',
                onSelect: () => props.onEdit?.('copy'),
              },
              {
                label: 'Paste',
                shortcut: '⌘V',
                onSelect: () => props.onEdit?.('paste'),
              },
              {
                label: 'Select all',
                shortcut: '⌘A',
                onSelect: () => props.onEdit?.('select-all'),
              },
              {
                label: 'Find',
                shortcut: '⌘F',
                onSelect: () => props.onEdit?.('find'),
              },
            ],
          },
        ]
      : []),
    {
      label: 'View',
      items: viewItems,
    },
    ...(props.onCommit
      ? [
          {
            label: 'Repository',
            items: [
              {
                label: 'Commit included changes',
                onSelect: props.onCommit,
              },
              ...(props.onRunOperation
                ? [
                    {
                      label: 'Fetch',
                      onSelect: () => props.onRunOperation?.('fetch'),
                    },
                    {
                      label: 'Pull',
                      onSelect: () => props.onRunOperation?.('pull'),
                    },
                    {
                      label: 'Push',
                      onSelect: () => props.onRunOperation?.('push'),
                    },
                  ]
                : []),
              ...(props.onRemoveRepository
                ? [
                    {
                      label: 'Remove repository',
                      onSelect: props.onRemoveRepository,
                    },
                  ]
                : []),
              ...(props.onOpenShell
                ? [{ label: 'Open in shell', onSelect: props.onOpenShell }]
                : []),
              ...(props.onOpenEditor
                ? [{ label: 'Open in editor', onSelect: props.onOpenEditor }]
                : []),
              ...(props.onRevealRepository
                ? [
                    {
                      label: 'Show in Finder',
                      onSelect: props.onRevealRepository,
                    },
                  ]
                : []),
              ...(props.onOpenRepositorySettings
                ? [
                    {
                      label: 'Repository settings',
                      onSelect: props.onOpenRepositorySettings,
                    },
                  ]
                : []),
              ...(props.onManageRemotes
                ? [{ label: 'Manage remotes', onSelect: props.onManageRemotes }]
                : []),
            ],
          },
        ]
      : []),
    ...(props.onRequestAction
      ? [
          {
            label: 'Branch',
            items: [
              {
                label: 'New branch',
                shortcut: '⇧⌘N',
                onSelect: () => props.onRequestAction?.('branch-create'),
              },
              {
                label: 'Rename current branch',
                shortcut: '⇧⌘R',
                onSelect: () => props.onRequestAction?.('branch-rename'),
              },
              {
                label: 'Delete current branch',
                shortcut: '⇧⌘D',
                onSelect: () => props.onRequestAction?.('branch-delete'),
              },
              {
                label: 'Discard all changes',
                onSelect: () => props.onRequestAction?.('branch-discard'),
              },
              {
                label: 'Stash all changes',
                shortcut: '⇧⌘S',
                onSelect: () => props.onRequestAction?.('branch-stash'),
              },
              {
                label: 'Update from default branch',
                shortcut: '⇧⌘U',
                onSelect: () => props.onRequestAction?.('branch-update'),
              },
              {
                label: 'Merge into current branch',
                shortcut: '⇧⌘M',
                onSelect: () => props.onRequestAction?.('branch-merge'),
              },
              {
                label: 'Squash merge into current branch',
                shortcut: '⇧⌘H',
                onSelect: () => props.onRequestAction?.('branch-squash-merge'),
              },
              {
                label: 'Rebase current branch',
                shortcut: '⇧⌘E',
                onSelect: () => props.onRequestAction?.('branch-rebase'),
              },
            ],
          },
        ]
      : []),
    ...(props.onOpenExternal
      ? [
          {
            label: 'Help',
            items: [
              {
                label: 'User guides',
                onSelect: () =>
                  props.onOpenExternal?.('https://docs.github.com/en/desktop'),
              },
              {
                label: 'Keyboard shortcuts',
                onSelect: () =>
                  props.onOpenExternal?.(
                    'https://docs.github.com/en/desktop/installing-and-configuring-github-desktop/overview/keyboard-shortcuts'
                  ),
              },
              {
                label: 'Report issue',
                onSelect: () =>
                  props.onOpenExternal?.(
                    'https://github.com/desktop-plus/desktop-plus/issues/new/choose'
                  ),
              },
            ],
          },
        ]
      : []),
  ]

  React.useEffect(() => {
    const onDocumentPointerDown = (event: PointerEvent) => {
      if (
        openMenu &&
        menuRef.current &&
        event.target instanceof Node &&
        !menuRef.current.contains(event.target)
      )
        setOpenMenu(null)
    }
    const onDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenMenu(null)
        return
      }
      if (event.defaultPrevented || (!event.metaKey && !event.ctrlKey)) return
      const target = event.target
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      )
        return

      const key = event.key.toLowerCase()
      const action =
        key === 'n'
          ? props.onOpenInitDialog
          : key === 'o' && event.shiftKey
          ? props.onOpenCloneDialog
          : key === 'o'
          ? props.onOpenRepositoryDialog
          : key === '1' && props.onSelectSection
          ? () => props.onSelectSection?.('changes')
          : key === '2' && props.onSelectSection
          ? () => props.onSelectSection?.('history')
          : key === '3' && props.onSelectSection
          ? () => props.onSelectSection?.('compare')
          : key === '4' && props.onSelectSection
          ? () => props.onSelectSection?.('repository-tools')
          : key === ','
          ? props.onOpenPreferences
          : (key === '=' || key === '+') && props.onZoomIn
          ? props.onZoomIn
          : key === '-' && props.onZoomOut
          ? props.onZoomOut
          : key === '0' && props.onResetZoom
          ? props.onResetZoom
          : key === 'z' && props.onEdit
          ? () => props.onEdit?.(event.shiftKey ? 'redo' : 'undo')
          : key === 'x' && props.onEdit
          ? () => props.onEdit?.('cut')
          : key === 'c' && props.onEdit
          ? () => props.onEdit?.('copy')
          : key === 'v' && props.onEdit
          ? () => props.onEdit?.('paste')
          : key === 'a' && props.onEdit
          ? () => props.onEdit?.('select-all')
          : key === 'f' && props.onEdit
          ? () => props.onEdit?.('find')
          : key === 't' && props.onRequestAction
          ? () => props.onRequestAction?.('repository-list')
          : key === 'b' && props.onRequestAction
          ? () => props.onRequestAction?.('branch-list')
          : key === '9' && props.onResize
          ? () => props.onResize?.('increase')
          : key === '8' && props.onResize
          ? () => props.onResize?.('decrease')
          : null
      if (!action) return
      event.preventDefault()
      setOpenMenu(null)
      action()
    }
    document.addEventListener('pointerdown', onDocumentPointerDown)
    document.addEventListener('keydown', onDocumentKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onDocumentPointerDown)
      document.removeEventListener('keydown', onDocumentKeyDown)
    }
  }, [openMenu, props])

  return (
    <nav
      aria-label="Application menu"
      className="web-application-menu"
      ref={menuRef}
    >
      {groups.map(group => {
        if (group.items.length === 0) return null
        const isOpen = openMenu === group.label
        return (
          <div className="web-application-menu-group" key={group.label}>
            <Button
              ariaExpanded={isOpen}
              ariaHaspopup="menu"
              className="web-application-menu-button"
              onClick={() => setOpenMenu(isOpen ? null : group.label)}
            >
              {group.label}
            </Button>
            {isOpen ? (
              <div className="web-application-menu-popup" role="menu">
                {group.items.map(item => (
                  <Button
                    className="web-application-menu-item"
                    key={item.label}
                    onClick={() => {
                      setOpenMenu(null)
                      item.onSelect()
                    }}
                    role="menuitem"
                  >
                    <span>{item.label}</span>
                    {item.shortcut ? <kbd>{item.shortcut}</kbd> : null}
                  </Button>
                ))}
              </div>
            ) : null}
          </div>
        )
      })}
    </nav>
  )
}

function RepositoryPathDialog(props: {
  readonly open: boolean
  readonly onDismiss: () => void
  readonly onSubmit: (path: string) => Promise<void>
  readonly onChooseDirectory?: () => Promise<string | null>
  readonly onInspect: (path: string) => Promise<WebRepositoryInspection>
  readonly onTrust: (path: string) => Promise<void>
  readonly onCreateRepository?: (path: string) => void
  readonly description?: string
  readonly submitLabel?: string
  readonly title?: string
}) {
  const [path, setPath] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [inspection, setInspection] =
    React.useState<WebRepositoryInspection | null>(null)
  const [inspecting, setInspecting] = React.useState(false)
  const inspectionGeneration = React.useRef(0)
  const pendingInspection =
    React.useRef<Promise<WebRepositoryInspection | null> | null>(null)

  React.useEffect(() => {
    if (props.open) {
      setPath('')
      setSubmitting(false)
      setInspection(null)
      setInspecting(false)
    }
  }, [props.open])

  if (!props.open) return null

  const inspectPath = (value: string) => {
    const nextPath = value.trim()
    const generation = ++inspectionGeneration.current
    if (!nextPath) {
      setInspection(null)
      setInspecting(false)
      pendingInspection.current = Promise.resolve(null)
      return pendingInspection.current
    }
    setInspecting(true)
    const request = props
      .onInspect(nextPath)
      .then(nextInspection => {
        if (generation === inspectionGeneration.current)
          setInspection(nextInspection)
        return nextInspection
      })
      .catch(() => {
        if (generation === inspectionGeneration.current) setInspection(null)
        return null
      })
      .finally(() => {
        if (generation === inspectionGeneration.current) setInspecting(false)
      })
    pendingInspection.current = request
    return request
  }

  const submit = async () => {
    if (!path.trim() || submitting) return
    setSubmitting(true)
    try {
      const nextInspection =
        inspection ||
        (pendingInspection.current
          ? await pendingInspection.current
          : await inspectPath(path))
      if (nextInspection?.kind !== 'regular') return
      await props.onSubmit(path.trim())
    } finally {
      setSubmitting(false)
    }
  }

  const canInitialize =
    inspection?.kind === 'missing' &&
    inspection.exists &&
    inspection.isDirectory

  return (
    <DialogStackContext.Provider value={{ isTopMost: true }}>
      <Dialog
        ariaDescribedBy="repository-path-description"
        disabled={submitting}
        loading={submitting}
        onDismissed={props.onDismiss}
        onSubmit={() => void submit()}
        title={props.title || 'Add repository'}
      >
        <DialogContent>
          <p id="repository-path-description">
            {props.description ||
              'Enter the absolute path to a local Git repository.'}
          </p>
          <label htmlFor="repository-path">Local path</label>
          <div className="web-path-picker">
            <input
              autoFocus={true}
              id="repository-path"
              onChange={event => {
                const value = event.target.value
                setPath(value)
                setInspection(null)
                void inspectPath(value)
              }}
              type="text"
              value={path}
            />
            {props.onChooseDirectory ? (
              <Button
                onClick={async () => {
                  const selectedPath = await props.onChooseDirectory?.()
                  if (!selectedPath) return
                  setPath(selectedPath)
                  setInspection(null)
                  void inspectPath(selectedPath)
                }}
                type="button"
              >
                Choose folder
              </Button>
            ) : null}
          </div>
          {inspecting ? <p role="status">Checking repository…</p> : null}
          {!inspecting && inspection?.kind === 'regular' ? (
            <p role="status">Git repository found.</p>
          ) : null}
          {!inspecting && inspection?.kind === 'bare' ? (
            <p role="alert">
              This directory is a bare Git repository. Bare repositories are not
              currently supported.
            </p>
          ) : null}
          {!inspecting && inspection?.kind === 'unsafe' ? (
            <>
              <p role="alert">
                This Git repository appears to be owned by another user on your
                machine. Adding untrusted repositories may automatically execute
                files in the repository.
              </p>
              <Button
                disabled={submitting}
                onClick={async () => {
                  setSubmitting(true)
                  try {
                    await props.onTrust(path.trim())
                    await inspectPath(path)
                  } finally {
                    setSubmitting(false)
                  }
                }}
                type="button"
              >
                Trust repository
              </Button>
            </>
          ) : null}
          {!inspecting && canInitialize ? (
            <p role="alert">
              This directory does not appear to be a Git repository.{' '}
              {props.onCreateRepository ? (
                <Button
                  onClick={() => props.onCreateRepository?.(inspection.path)}
                  type="button"
                >
                  Create repository here
                </Button>
              ) : null}
            </p>
          ) : null}
          {!inspecting && inspection?.kind === 'missing' && !canInitialize ? (
            <p role="alert">
              The selected path does not contain a Git repository.
            </p>
          ) : null}
        </DialogContent>
        <DialogFooter>
          <Button onClick={props.onDismiss} type="button">
            Cancel
          </Button>
          <Button
            disabled={
              !path.trim() ||
              submitting ||
              (inspection !== null && inspection.kind !== 'regular')
            }
            onClick={() => void submit()}
            type="submit"
          >
            {props.submitLabel || 'Add repository'}
          </Button>
        </DialogFooter>
      </Dialog>
    </DialogStackContext.Provider>
  )
}

function RepositorySetupDialog(props: {
  readonly mode: 'clone' | 'init'
  readonly open: boolean
  readonly initialURL?: string
  readonly initialRepositoryPath?: string
  readonly setupOptions: WebApplicationState['repositorySetupOptions']
  readonly dispatcher: WebDispatcher
  readonly onChooseDirectory?: () => Promise<string | null>
  readonly onDismiss: () => void
  readonly onClone: (
    url: string,
    path: string,
    branch?: string
  ) => Promise<void>
  readonly onInit: (
    options: WebRepositoryInitializationOptions
  ) => Promise<void>
}) {
  const [url, setURL] = React.useState(props.initialURL || '')
  const [path, setPath] = React.useState('')
  const [name, setName] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [branch, setBranch] = React.useState('')
  const [createReadme, setCreateReadme] = React.useState(false)
  const [gitignore, setGitignore] = React.useState<string | null>(null)
  const [license, setLicense] = React.useState<string | null>(null)
  const [initialCommit, setInitialCommit] = React.useState(true)
  const [preview, setPreview] =
    React.useState<WebRepositorySetupPreview | null>(null)
  const [clonePreview, setClonePreview] =
    React.useState<WebCloneSetupPreview | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const previewRequest = React.useRef(0)
  const previewTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const nameRef = React.useRef(name)
  const pathRef = React.useRef(path)
  const createReadmeRef = React.useRef(createReadme)

  React.useEffect(() => {
    if (props.open) {
      setURL(props.initialURL || '')
      const initialPath = isClone
        ? ''
        : props.initialRepositoryPath
        ? pathParent(props.initialRepositoryPath)
        : localStorage.getItem(webRepositoryParentPathStorageKey) || ''
      const initialName =
        !isClone && props.initialRepositoryPath
          ? pathName(props.initialRepositoryPath)
          : ''
      setPath(initialPath)
      setName(initialName)
      pathRef.current = initialPath
      nameRef.current = initialName
      setDescription('')
      setBranch('')
      setCreateReadme(false)
      createReadmeRef.current = false
      setGitignore(null)
      setLicense(null)
      setInitialCommit(true)
      setPreview(null)
      setClonePreview(null)
      setSubmitting(false)
    }
  }, [props.initialRepositoryPath, props.initialURL, props.open])

  React.useEffect(
    () => () => {
      if (previewTimer.current) clearTimeout(previewTimer.current)
    },
    []
  )

  if (!props.open) return null

  const isClone = props.mode === 'clone'
  const parentPath =
    pathRef.current.trim() || props.setupOptions?.defaultParentPath || ''
  const refreshPreview = async (
    nextName = nameRef.current,
    nextParentPath = parentPath,
    nextCreateReadme = createReadmeRef.current
  ) => {
    const requestId = ++previewRequest.current
    if (previewTimer.current) clearTimeout(previewTimer.current)
    if (isClone || !nextName.trim() || !nextParentPath.trim()) {
      setPreview(null)
      return
    }
    await new Promise<void>(resolve => {
      previewTimer.current = setTimeout(resolve, 100)
    })
    if (requestId !== previewRequest.current) return
    try {
      const nextPreview =
        await props.dispatcher.previewRepositoryInitialization({
          name: nextName.trim(),
          parentPath: nextParentPath.trim(),
          createReadme: nextCreateReadme,
        })
      if (requestId === previewRequest.current) setPreview(nextPreview)
    } catch {
      if (requestId === previewRequest.current) setPreview(null)
    }
  }
  const refreshClonePreview = async (nextURL = url, nextPath = path) => {
    const requestId = ++previewRequest.current
    if (!isClone || !nextURL.trim() || !nextPath.trim()) {
      setClonePreview(null)
      return
    }
    const nextPreview = await props.dispatcher.previewCloneRepository(
      nextURL.trim(),
      nextPath.trim()
    )
    if (requestId === previewRequest.current) setClonePreview(nextPreview)
  }
  const branchError = branch.trim()
    ? validateGitRefName(branch, 'Initial branch')
    : null
  const submit = async () => {
    if (
      submitting ||
      branchError ||
      (isClone &&
        (!url.trim() || !path.trim() || clonePreview?.canClone !== true)) ||
      (!isClone &&
        (!name.trim() || !parentPath.trim() || preview?.canCreate === false))
    )
      return
    setSubmitting(true)
    try {
      if (isClone)
        await props.onClone(url.trim(), path.trim(), branch.trim() || undefined)
      else
        await props.onInit({
          name: name.trim(),
          parentPath: parentPath.trim(),
          description,
          initialBranch: branch.trim() || undefined,
          createReadme,
          gitignore,
          license,
          initialCommit,
        })
      if (!isClone)
        localStorage.setItem(
          webRepositoryParentPathStorageKey,
          parentPath.trim()
        )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DialogStackContext.Provider value={{ isTopMost: true }}>
      <Dialog
        ariaDescribedBy="repository-setup-description-copy"
        disabled={submitting}
        loading={submitting}
        onDismissed={props.onDismiss}
        onSubmit={() => void submit()}
        title={isClone ? 'Clone repository' : 'Create repository'}
      >
        <DialogContent>
          <p id="repository-setup-description-copy">
            {isClone
              ? 'Clone a repository into a new local folder.'
              : 'Initialize an empty Git repository in a new local folder.'}
          </p>
          {isClone ? (
            <>
              <label htmlFor="repository-setup-url">Repository URL</label>
              <input
                autoFocus={true}
                id="repository-setup-url"
                onChange={event => {
                  setURL(event.target.value)
                  void refreshClonePreview(event.target.value)
                }}
                type="text"
                value={url}
              />
            </>
          ) : null}
          {isClone ? (
            <>
              <label htmlFor="repository-setup-path">Destination path</label>
              <div className="web-path-picker">
                <input
                  autoFocus={false}
                  id="repository-setup-path"
                  onChange={event => {
                    setPath(event.target.value)
                    void refreshClonePreview(url, event.target.value)
                  }}
                  type="text"
                  value={path}
                />
                {props.onChooseDirectory ? (
                  <Button
                    onClick={async () => {
                      const selectedPath = await props.onChooseDirectory?.()
                      if (!selectedPath) return
                      setPath(selectedPath)
                      void refreshClonePreview(url, selectedPath)
                    }}
                    type="button"
                  >
                    Choose folder
                  </Button>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <label htmlFor="repository-setup-name">Repository name</label>
              <input
                autoFocus={true}
                id="repository-setup-name"
                onBlur={() => void refreshPreview()}
                onChange={event => {
                  const value = event.target.value
                  nameRef.current = value
                  setName(value)
                  void refreshPreview(value, parentPath)
                }}
                type="text"
                value={name}
              />
              <label htmlFor="repository-setup-parent-path">
                Parent directory
              </label>
              <div className="web-path-picker">
                <input
                  id="repository-setup-parent-path"
                  onBlur={() => void refreshPreview()}
                  onChange={event => {
                    const value = event.target.value
                    pathRef.current = value
                    setPath(value)
                    void refreshPreview(nameRef.current, value)
                  }}
                  type="text"
                  value={parentPath}
                />
                {props.onChooseDirectory ? (
                  <Button
                    onClick={async () => {
                      const selectedPath = await props.onChooseDirectory?.()
                      if (!selectedPath) return
                      pathRef.current = selectedPath
                      setPath(selectedPath)
                      void refreshPreview(nameRef.current, selectedPath)
                    }}
                    type="button"
                  >
                    Choose folder
                  </Button>
                ) : null}
              </div>
              {preview ? (
                <div id="repository-setup-preview">
                  <p>
                    The repository will be created at{' '}
                    <strong>{preview.repositoryPath}</strong>.
                  </p>
                  {preview.warnings.map(warning => (
                    <p key={warning.code} role="status">
                      {warning.message}
                    </p>
                  ))}
                </div>
              ) : null}
              <label htmlFor="repository-setup-description-input">
                Description
              </label>
              <textarea
                id="repository-setup-description-input"
                onChange={event => setDescription(event.target.value)}
                value={description}
              />
              <label htmlFor="repository-setup-create-readme">
                <input
                  checked={createReadme}
                  id="repository-setup-create-readme"
                  onChange={event => {
                    const checked = event.target.checked
                    createReadmeRef.current = checked
                    setCreateReadme(checked)
                    void refreshPreview(nameRef.current, parentPath, checked)
                  }}
                  type="checkbox"
                />
                Initialize with a README
              </label>
              <label htmlFor="repository-setup-gitignore">Git ignore</label>
              <select
                id="repository-setup-gitignore"
                onChange={event => setGitignore(event.target.value || null)}
                value={gitignore || ''}
              >
                <option value="">None</option>
                {(props.setupOptions?.gitignoreNames || []).map(option => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <label htmlFor="repository-setup-license">License</label>
              <select
                id="repository-setup-license"
                onChange={event => setLicense(event.target.value || null)}
                value={license || ''}
              >
                <option value="">None</option>
                {(props.setupOptions?.licenses || []).map(option => (
                  <option key={option.name} value={option.name}>
                    {option.name}
                  </option>
                ))}
              </select>
              <label htmlFor="repository-setup-initial-commit">
                <input
                  checked={initialCommit}
                  id="repository-setup-initial-commit"
                  onChange={event => setInitialCommit(event.target.checked)}
                  type="checkbox"
                />
                Create an initial commit
              </label>
            </>
          )}
          {isClone && clonePreview ? (
            <div id="repository-clone-preview">
              <p>
                Clone <strong>{clonePreview.repositoryName}</strong> into{' '}
                <strong>{clonePreview.destinationPath || path}</strong>.
              </p>
              {clonePreview.warnings.map(warning => (
                <p key={warning.code} role="alert">
                  {warning.message}
                </p>
              ))}
            </div>
          ) : null}
          <label htmlFor="repository-setup-branch">
            Initial branch (optional)
          </label>
          <input
            id="repository-setup-branch"
            onChange={event => setBranch(event.target.value)}
            type="text"
            value={branch}
          />
          {branchError ? <p role="alert">{branchError}</p> : null}
        </DialogContent>
        <DialogFooter>
          <Button onClick={props.onDismiss}>Cancel</Button>
          <Button
            disabled={
              submitting ||
              (isClone
                ? !path.trim() ||
                  !url.trim() ||
                  clonePreview?.canClone !== true ||
                  Boolean(branchError)
                : !name.trim() ||
                  !parentPath.trim() ||
                  preview?.canCreate === false ||
                  Boolean(branchError))
            }
            onClick={() => void submit()}
            type="submit"
          >
            {isClone ? 'Clone repository' : 'Create repository'}
          </Button>
        </DialogFooter>
      </Dialog>
    </DialogStackContext.Provider>
  )
}

function DesktopHome(props: {
  readonly dispatcher: WebDispatcher
  readonly onOpenRepositoryDialog: () => void
  readonly onOpenCloneDialog: (url?: string) => void
  readonly onOpenInitDialog: () => void
  readonly onOpenPreferences: () => void
  readonly onCreateTutorialRepository: () => void
  readonly onResumeTutorialRepository: () => void
  readonly tutorialPaused: boolean
  readonly diffPreferences: WebDiffPresentationPreferences
}) {
  return (
    <DesktopAppChrome
      diffFontFamily={props.diffPreferences.diffFontFamily}
      diffFontSize={props.diffPreferences.diffFontSize}
      tabSize={props.diffPreferences.tabSize}
      theme={props.diffPreferences.theme}
      menu={{
        onOpenCloneDialog: () => props.onOpenCloneDialog(),
        onOpenInitDialog: props.onOpenInitDialog,
        onOpenPreferences: props.onOpenPreferences,
        onOpenRepositoryDialog: props.onOpenRepositoryDialog,
      }}
    >
      <NoRepositoriesView
        accounts={[]}
        apiRepositories={new Map()}
        onAdd={props.onOpenRepositoryDialog}
        onClone={props.onOpenCloneDialog}
        onCreate={props.onOpenInitDialog}
        onCreateTutorialRepository={props.onCreateTutorialRepository}
        onRefreshRepositories={() => undefined}
        onResumeTutorialRepository={props.onResumeTutorialRepository}
        tutorialPaused={props.tutorialPaused}
        allowTutorialWithoutAccount={true}
      />
    </DesktopAppChrome>
  )
}

function WebTutorialStartDialog(props: {
  readonly open: boolean
  readonly defaultParentPath: string
  readonly loading: boolean
  readonly onChooseDirectory?: () => Promise<string | null>
  readonly onDismiss: () => void
  readonly onSubmit: (parentPath: string) => Promise<void>
}) {
  const [parentPath, setParentPath] = React.useState(props.defaultParentPath)

  React.useEffect(() => {
    if (props.open) setParentPath(props.defaultParentPath)
  }, [props.defaultParentPath, props.open])

  if (!props.open) return null

  const error = validateAbsolutePath(parentPath, 'Parent directory')
  return (
    <DialogStackContext.Provider value={{ isTopMost: true }}>
      <Dialog
        ariaDescribedBy="web-tutorial-start-description"
        disabled={props.loading}
        loading={props.loading}
        onDismissed={props.onDismiss}
        onSubmit={() => {
          if (!error) void props.onSubmit(parentPath.trim())
        }}
        title="Start local Git tutorial"
      >
        <DialogContent>
          <p id="web-tutorial-start-description">
            Create a disposable local repository for the Desktop Plus Git
            tutorial.
          </p>
          <label htmlFor="web-tutorial-parent-path">Parent directory</label>
          <div className="web-path-picker">
            <input
              autoFocus={true}
              id="web-tutorial-parent-path"
              onChange={event => setParentPath(event.target.value)}
              type="text"
              value={parentPath}
            />
            {props.onChooseDirectory ? (
              <Button
                onClick={async () => {
                  const selectedPath = await props.onChooseDirectory?.()
                  if (selectedPath) setParentPath(selectedPath)
                }}
                type="button"
              >
                Choose folder
              </Button>
            ) : null}
          </div>
          {error ? <p role="alert">{error}</p> : null}
        </DialogContent>
        <DialogFooter>
          <Button onClick={props.onDismiss}>Cancel</Button>
          <Button
            disabled={Boolean(error) || props.loading}
            onClick={() => {
              if (!error) void props.onSubmit(parentPath.trim())
            }}
            type="submit"
          >
            Create tutorial repository
          </Button>
        </DialogFooter>
      </Dialog>
    </DialogStackContext.Provider>
  )
}

function WebTutorialPanel(props: {
  readonly state: WebApplicationState
  readonly dispatcher: WebDispatcher
}) {
  const path = props.state.tutorialRepositoryPath
  if (!path || props.state.currentTutorialStep === TutorialStep.NotApplicable)
    return null

  const readmePath = `${path.replace(/[\\/]+$/, '')}/README.md`
  const steps: ReadonlyArray<{
    readonly step: TutorialStep
    readonly label: string
    readonly description: string
  }> = [
    {
      step: TutorialStep.CreateBranch,
      label: 'Create a branch',
      description:
        'Create and check out a branch so your work is isolated from main.',
    },
    {
      step: TutorialStep.EditFile,
      label: 'Edit README.md',
      description:
        'Open README.md, make a small change, save it, then refresh Changes.',
    },
    {
      step: TutorialStep.MakeCommit,
      label: 'Make a commit',
      description:
        'Commit the README change with a short message describing what you changed.',
    },
    {
      step: TutorialStep.PushBranch,
      label: 'Publish to GitHub',
      description:
        'Publishing is unavailable in the local-only web release. Continue with the local tutorial.',
    },
    {
      step: TutorialStep.OpenPullRequest,
      label: 'Open a pull request',
      description:
        'Pull requests are outside the local-only web release. Your local Git tutorial is complete.',
    },
  ]
  const currentIndex = steps.findIndex(
    step => step.step === props.state.currentTutorialStep
  )
  const completeThrough =
    props.state.currentTutorialStep === TutorialStep.AllDone
      ? steps.length
      : Math.max(0, currentIndex)

  return (
    <aside
      aria-label="Git tutorial"
      className="web-tutorial-panel"
      data-tutorial-step={props.state.currentTutorialStep}
    >
      <div className="web-tutorial-heading">
        <div>
          <h2>Git tutorial</h2>
          <p>Learn the local Git basics in this repository.</p>
        </div>
        <Button
          disabled={props.state.loading}
          onClick={() => void props.dispatcher.pauseTutorial()}
          type="button"
        >
          Pause
        </Button>
      </div>
      <ol>
        {steps.map((step, index) => {
          const complete = index < completeThrough
          const current = index === currentIndex
          return (
            <li
              className={
                complete ? 'complete' : current ? 'current' : undefined
              }
              key={step.step}
            >
              <strong>{step.label}</strong>
              <p>{step.description}</p>
              {current && step.step === TutorialStep.CreateBranch ? (
                <Button
                  disabled={props.state.loading}
                  onClick={() =>
                    void props.dispatcher.runOperation('create-branch', {
                      values: ['tutorial-work'],
                      checkout: true,
                    })
                  }
                  type="button"
                >
                  Create tutorial branch
                </Button>
              ) : null}
              {current && step.step === TutorialStep.EditFile ? (
                <div className="web-tutorial-actions">
                  <Button
                    disabled={props.state.loading}
                    onClick={() =>
                      void props.dispatcher.openPath(readmePath, false)
                    }
                    type="button"
                  >
                    Open README.md
                  </Button>
                  <Button
                    disabled={props.state.loading}
                    onClick={() => void props.dispatcher.refresh()}
                    type="button"
                  >
                    Refresh changes
                  </Button>
                </div>
              ) : null}
              {current && step.step === TutorialStep.MakeCommit ? (
                <Button
                  disabled={props.state.loading}
                  onClick={props.dispatcher.requestCommitDialog}
                  type="button"
                >
                  Commit README change
                </Button>
              ) : null}
            </li>
          )
        })}
      </ol>
      {props.state.currentTutorialStep === TutorialStep.AllDone ? (
        <div className="web-tutorial-complete" role="status">
          <strong>You're done!</strong>
          <p>
            You created a branch, edited a file, and committed your local
            changes. Hosted publishing and pull requests are deferred.
          </p>
        </div>
      ) : null}
    </aside>
  )
}

function DesktopRepositoryPicker(props: {
  readonly repositories: ReadonlyArray<
    WebApplicationState['repositories'][number]
  >
  readonly pinnedRepositoryPaths: ReadonlyArray<string>
  readonly selectedRepositoryPath: string | null
  readonly onSelect: (path: string) => void
  readonly onAdd: () => void
  readonly onRemove: (path: string) => void
  readonly onDeleteRepository: (path: string) => void
  readonly onTogglePinned: (path: string) => void
  readonly onEdit: (
    repository: WebApplicationState['repositories'][number]
  ) => void
  readonly showBranchName: 'never' | 'always' | 'non-default'
  readonly showWorktrees: boolean
  readonly repositoryIndicatorsEnabled: boolean
  readonly onCopyPath: (path: string) => void
  readonly onOpenPath: (path: string, reveal?: boolean) => void
  readonly onOpenExternal: (url: string) => void
  readonly onOpenNewWindow: (path: string) => void
  readonly onPullGroup: (group: string | null) => void
  readonly onRenameGroup: (group: string) => void
  readonly showRecentRepositories: boolean
  readonly repositorySortOrder: WebRepositorySortOrder
}) {
  const [filterText, setFilterText] = React.useState('')
  const normalizedFilterText = filterText.trim().toLowerCase()
  const filteredRepositories = [...props.repositories]
    .sort((left, right) => {
      if (props.repositorySortOrder === 'alphabetical')
        return (left.alias || left.name).localeCompare(
          right.alias || right.name
        )
      return (
        (right.lastOpenedAt || 0) - (left.lastOpenedAt || 0) ||
        (left.alias || left.name).localeCompare(right.alias || right.name)
      )
    })
    .filter(repository => {
      if (!normalizedFilterText) return true
      return `${repository.name} ${repository.alias || ''} ${
        repository.group || ''
      } ${repository.path}`
        .toLowerCase()
        .includes(normalizedFilterText)
    })
  const pinned = props.pinnedRepositoryPaths
    .map(path =>
      filteredRepositories.find(repository => repository.path === path)
    )
    .filter(
      (repository): repository is WebApplicationState['repositories'][number] =>
        repository !== undefined
    )
  const pinnedPaths = new Set(pinned.map(repository => repository.path))
  const recentRepositories =
    props.showRecentRepositories && filteredRepositories.length > 7
      ? filteredRepositories
          .filter(repository => !pinnedPaths.has(repository.path))
          .slice()
          .sort(
            (left, right) =>
              (right.lastOpenedAt || 0) - (left.lastOpenedAt || 0)
          )
          .slice(0, 7)
      : []
  const groupedRepositories = filteredRepositories.filter(
    repository =>
      !pinnedPaths.has(repository.path) &&
      !recentRepositories.some(
        recentRepository => recentRepository.path === repository.path
      )
  )
  const groups = [
    ...new Set(
      groupedRepositories.map(repository => repository.group || 'Repositories')
    ),
  ].sort((left, right) => {
    if (left === 'Repositories') return 1
    if (right === 'Repositories') return -1
    return left.localeCompare(right)
  })
  const renderRepository = (
    repository: WebApplicationState['repositories'][number]
  ) => {
    const isPinned = props.pinnedRepositoryPaths.includes(repository.path)
    const changedFilesCount = repository.changedFilesCount || 0
    const aheadBehind = repository.aheadBehind
    const linkedWorktrees = (repository.worktrees || []).filter(
      worktree => worktree.type === 'linked'
    )
    const renderWorktree = (worktree: WebWorktree) => (
      <div
        className="list-item repository-worktree-list-item"
        key={worktree.path}
      >
        <div
          className="repository-list-item repository-worktree-item"
          onClick={() => props.onSelect(worktree.path)}
          role="button"
          tabIndex={0}
          title={worktree.path}
        >
          <Octicon
            className="icon-for-repository"
            symbol={octicons.fileDirectory}
          />
          <div className="name">
            {pathBasename(worktree.path)}
            {worktree.branch ? (
              <small> ({worktree.branch.replace(/^refs\/heads\//, '')})</small>
            ) : null}
          </div>
        </div>
        <Button
          ariaLabel={`Copy path for ${pathBasename(worktree.path)}`}
          onClick={event => {
            event.stopPropagation()
            props.onCopyPath(worktree.path)
          }}
          tooltip="Copy worktree path"
        >
          <Octicon symbol={octicons.copy} />
        </Button>
        <Button
          ariaLabel={`Open ${pathBasename(worktree.path)} in a new window`}
          onClick={event => {
            event.stopPropagation()
            props.onOpenNewWindow(worktree.path)
          }}
          tooltip="Open worktree in a new window"
        >
          <Octicon symbol={octicons.screenNormal} />
        </Button>
      </div>
    )
    return (
      <>
        <div
          className={`list-item${
            props.selectedRepositoryPath === repository.path ? ' selected' : ''
          }`}
          key={repository.path}
        >
          <div
            className="repository-list-item"
            onClick={() => props.onSelect(repository.path)}
            role="button"
            tabIndex={0}
            title={repository.path}
          >
            <Octicon className="icon-for-repository" symbol={octicons.repo} />
            <div className="name">
              {repository.alias || repository.name}
              {props.showBranchName === 'always' && repository.currentBranch ? (
                <small> ({repository.currentBranch})</small>
              ) : props.showBranchName === 'non-default' &&
                repository.currentBranch &&
                repository.currentBranch !== repository.defaultBranch ? (
                <small> ({repository.currentBranch})</small>
              ) : null}
            </div>
            {props.repositoryIndicatorsEnabled ? (
              <span
                aria-label={`${changedFilesCount} changed files${
                  aheadBehind
                    ? `, ${aheadBehind.ahead} ahead, ${aheadBehind.behind} behind`
                    : ''
                }`}
                className="web-repository-indicators"
              >
                {changedFilesCount > 0 ? (
                  <span className="web-repository-indicator">
                    {changedFilesCount} changed
                  </span>
                ) : null}
                {aheadBehind &&
                (aheadBehind.ahead > 0 || aheadBehind.behind > 0) ? (
                  <span className="web-repository-indicator">
                    ↑{aheadBehind.ahead} ↓{aheadBehind.behind}
                  </span>
                ) : null}
              </span>
            ) : null}
          </div>
          <Button
            ariaLabel={`Copy path for ${repository.alias || repository.name}`}
            onClick={event => {
              event.stopPropagation()
              props.onCopyPath(repository.path)
            }}
            tooltip="Copy repository path"
          >
            <Octicon symbol={octicons.copy} />
          </Button>
          <Button
            ariaLabel={`Reveal ${
              repository.alias || repository.name
            } in Finder`}
            onClick={event => {
              event.stopPropagation()
              props.onOpenPath(repository.path, true)
            }}
            tooltip="Reveal repository in Finder"
          >
            <Octicon symbol={octicons.fileDirectory} />
          </Button>
          {repository.remoteWebURL ? (
            <Button
              ariaLabel={`Open ${
                repository.alias || repository.name
              } remote in browser`}
              onClick={event => {
                event.stopPropagation()
                if (repository.remoteWebURL)
                  props.onOpenExternal(repository.remoteWebURL)
              }}
              tooltip="Open repository remote in browser"
            >
              <Octicon symbol={octicons.linkExternal} />
            </Button>
          ) : null}
          <Button
            ariaLabel={`Open ${
              repository.alias || repository.name
            } in a new window`}
            onClick={event => {
              event.stopPropagation()
              props.onOpenNewWindow(repository.path)
            }}
            tooltip="Open repository in a new window"
          >
            <Octicon symbol={octicons.screenNormal} />
          </Button>
          <Button
            ariaLabel={`Edit ${repository.alias || repository.name}`}
            className="repository-edit-button"
            onClick={event => {
              event.stopPropagation()
              props.onEdit(repository)
            }}
            tooltip={`Edit ${repository.alias || repository.name}`}
          >
            <Octicon symbol={octicons.gear} />
          </Button>
          <Button
            ariaLabel={`${isPinned ? 'Unpin' : 'Pin'} ${repository.name}`}
            className="repository-pin-button"
            onClick={event => {
              event.stopPropagation()
              props.onTogglePinned(repository.path)
            }}
            tooltip={`${isPinned ? 'Unpin' : 'Pin'} ${repository.name}`}
          >
            <Octicon symbol={isPinned ? octicons.pinSlash : octicons.pin} />
          </Button>
          <Button
            ariaLabel={`Remove ${repository.name}`}
            className="repository-remove-button"
            onClick={event => {
              event.stopPropagation()
              props.onRemove(repository.path)
            }}
            tooltip={`Remove ${repository.name} from Desktop Plus`}
          >
            <Octicon symbol={octicons.x} />
          </Button>
          <Button
            ariaLabel={`Delete ${repository.name} from disk`}
            className="repository-delete-button"
            onClick={event => {
              event.stopPropagation()
              props.onDeleteRepository(repository.path)
            }}
            tooltip={`Delete ${repository.name} from disk`}
          >
            <Octicon symbol={octicons.trash} />
          </Button>
        </div>
        {props.showWorktrees ? linkedWorktrees.map(renderWorktree) : null}
      </>
    )
  }

  return (
    <div className="repository-list">
      <div className="repository-picker-filter">
        <label htmlFor="web-repository-filter">Filter repositories</label>
        <input
          id="web-repository-filter"
          onChange={event => setFilterText(event.target.value)}
          placeholder="Filter"
          type="search"
          value={filterText}
        />
      </div>
      <div className="list-focus-container focus-within">
        {pinned.length > 0 ? (
          <>
            <div className="repository-picker-group-heading">Pinned</div>
            {pinned.map(renderRepository)}
          </>
        ) : null}
        {recentRepositories.length > 0 ? (
          <>
            <div className="repository-picker-group-heading">Recent</div>
            {recentRepositories.map(renderRepository)}
          </>
        ) : null}
        {groups.map(group => {
          const repositories = groupedRepositories.filter(
            repository => (repository.group || 'Repositories') === group
          )
          return repositories.length ? (
            <React.Fragment key={group}>
              <div className="repository-picker-group-heading">
                <span>{group}</span>
                <Button
                  ariaLabel={`Pull ${group}`}
                  onClick={event => {
                    event.stopPropagation()
                    props.onPullGroup(group === 'Repositories' ? null : group)
                  }}
                >
                  Pull
                </Button>
                {group !== 'Repositories' ? (
                  <Button
                    ariaLabel={`Rename ${group}`}
                    onClick={event => {
                      event.stopPropagation()
                      props.onRenameGroup(group)
                    }}
                  >
                    Rename
                  </Button>
                ) : null}
              </div>
              {repositories.map(renderRepository)}
            </React.Fragment>
          ) : null
        })}
        {filteredRepositories.length === 0 ? (
          <p className="repository-picker-empty">
            No repositories match the filter.
          </p>
        ) : null}
      </div>
      <Button
        className="new-repository-button button-with-icon"
        onClick={props.onAdd}
      >
        Add
        <Octicon symbol={octicons.triangleDown} />
      </Button>
    </div>
  )
}

function WebRepositorySettingsDialog(props: {
  readonly open: boolean
  readonly repository: WebApplicationState['repositories'][number] | null
  readonly branches: ReadonlyArray<WebBranch>
  readonly onDismiss: () => void
  readonly onSave: (
    alias: string,
    group: string | null,
    branch: string | null
  ) => void
}) {
  const [alias, setAlias] = React.useState('')
  const [group, setGroup] = React.useState('')
  const [defaultBranch, setDefaultBranch] = React.useState('')

  React.useEffect(() => {
    if (!props.open) return
    setAlias(props.repository?.alias || '')
    setGroup(props.repository?.group || '')
    setDefaultBranch(props.repository?.defaultBranch || '')
  }, [props.open, props.repository])

  if (!props.open || !props.repository) return null
  const localBranches = props.branches.filter(
    branch => branch.type !== 'Remote'
  )

  return (
    <DialogStackContext.Provider value={{ isTopMost: true }}>
      <Dialog
        ariaDescribedBy="web-repository-settings-description"
        onDismissed={props.onDismiss}
        onSubmit={() =>
          props.onSave(alias, group || null, defaultBranch || null)
        }
        title={`Repository settings: ${props.repository.name}`}
      >
        <DialogContent>
          <p id="web-repository-settings-description">
            Customize how this repository appears in Desktop Plus.
          </p>
          <label htmlFor="web-repository-alias">Alias</label>
          <input
            autoFocus={true}
            id="web-repository-alias"
            onChange={event => setAlias(event.target.value)}
            type="text"
            value={alias}
          />
          <label htmlFor="web-repository-group">Group</label>
          <input
            id="web-repository-group"
            onChange={event => setGroup(event.target.value)}
            type="text"
            value={group}
          />
          <label htmlFor="web-repository-default-branch">Default branch</label>
          <select
            id="web-repository-default-branch"
            onChange={event => setDefaultBranch(event.target.value)}
            value={defaultBranch}
          >
            <option value="">Automatic</option>
            {localBranches.map(branch => (
              <option key={branch.name} value={branch.name}>
                {branch.name}
              </option>
            ))}
          </select>
        </DialogContent>
        <DialogFooter>
          <Button onClick={props.onDismiss}>Cancel</Button>
          <Button
            onClick={() =>
              props.onSave(alias, group || null, defaultBranch || null)
            }
            type="submit"
          >
            Save repository
          </Button>
        </DialogFooter>
      </Dialog>
    </DialogStackContext.Provider>
  )
}

function WebBranchPicker(props: {
  readonly branches: ReadonlyArray<WebBranch>
  readonly currentBranch: string
  readonly defaultBranch: string | null
  readonly recentBranches: ReadonlyArray<string>
  readonly sortOrder: BranchSortOrder
  readonly onCheckout: (branch: WebBranch) => void
}) {
  const [filterText, setFilterText] = React.useState('')
  const normalizedFilterText = filterText.trim().toLowerCase()
  const branches = props.branches.filter(
    branch =>
      !branch.name.endsWith('/HEAD') &&
      (!normalizedFilterText ||
        `${branch.name} ${branch.upstream || ''}`
          .toLowerCase()
          .includes(normalizedFilterText))
  )
  const localBranches = branches.filter(branch => branch.type !== 'Remote')
  const remoteBranches = branches.filter(branch => branch.type === 'Remote')
  const sortBranches = (items: ReadonlyArray<WebBranch>) =>
    [...items].sort((left, right) => {
      if (props.sortOrder === BranchSortOrder.Alphabetical)
        return left.name.localeCompare(right.name)
      const leftDate = left.tip?.author?.date
        ? Date.parse(left.tip.author.date)
        : 0
      const rightDate = right.tip?.author?.date
        ? Date.parse(right.tip.author.date)
        : 0
      return rightDate - leftDate || left.name.localeCompare(right.name)
    })
  const defaultBranches = sortBranches(
    localBranches.filter(branch => branch.name === props.defaultBranch)
  )
  const defaultNames = new Set(defaultBranches.map(branch => branch.name))
  const recentNames = new Set(props.recentBranches)
  const recentBranches = sortBranches(
    localBranches.filter(
      branch => !defaultNames.has(branch.name) && recentNames.has(branch.name)
    )
  )
  const recentBranchNames = new Set(recentBranches.map(branch => branch.name))
  const otherLocalBranches = sortBranches(
    localBranches.filter(
      branch =>
        !defaultNames.has(branch.name) && !recentBranchNames.has(branch.name)
    )
  )
  const sortedRemoteBranches = sortBranches(remoteBranches)

  const renderBranch = (branch: WebBranch) => {
    const isCurrent = branch.name === props.currentBranch
    const isDefault = branch.name === props.defaultBranch
    const actionLabel =
      branch.type === 'Remote' ? 'Checkout remote' : 'Switch to'
    return (
      <Button
        ariaLabel={`${actionLabel} ${branch.name}${
          isDefault ? ', default branch' : ''
        }`}
        className={isCurrent ? 'selected' : undefined}
        disabled={isCurrent}
        key={`${branch.type || 'Local'}:${branch.name}`}
        onClick={() => props.onCheckout(branch)}
      >
        {actionLabel} {branch.name}
        {isDefault ? ' (default)' : ''}
      </Button>
    )
  }

  const renderGroup = (label: string, group: ReadonlyArray<WebBranch>) =>
    group.length ? (
      <React.Fragment key={label}>
        <div className="web-branch-group-heading">{label}</div>
        {group.map(renderBranch)}
      </React.Fragment>
    ) : null

  return (
    <div className="web-branch-picker">
      <label htmlFor="web-branch-filter">Filter branches</label>
      <input
        autoFocus={true}
        id="web-branch-filter"
        onChange={event => setFilterText(event.target.value)}
        placeholder="Filter"
        type="search"
        value={filterText}
      />
      <div className="web-toolbar-menu web-branch-list">
        {renderGroup('Default branch', defaultBranches)}
        {renderGroup('Recent branches', recentBranches)}
        {renderGroup('Local branches', otherLocalBranches)}
        {renderGroup('Remote branches', sortedRemoteBranches)}
        {branches.length === 0 ? (
          <p className="web-branch-picker-empty">
            No branches match the filter.
          </p>
        ) : null}
      </div>
    </div>
  )
}

function DesktopToolbar(props: {
  readonly state: WebApplicationState
  readonly dispatcher: WebDispatcher
  readonly sidebarWidth: number
  readonly onOpenRepositoryDialog: () => void
  readonly onOpenPreferences: () => void
  readonly onOpenRepositorySettings: (
    repository: WebApplicationState['repositories'][number]
  ) => void
  readonly onRemoveRepository: (path: string) => void
  readonly onDeleteRepository: (path: string) => void
  readonly showBranchName: 'never' | 'always' | 'non-default'
  readonly branchSortOrder: BranchSortOrder
  readonly onBranchSortOrderChanged: (value: BranchSortOrder) => void
  readonly showWorktreesInRepositoryList: boolean
  readonly repositoryIndicatorsEnabled: boolean
  readonly showRecentRepositories: boolean
  readonly onCopyPath: (path: string) => void
  readonly onOpenPath: (path: string, reveal?: boolean) => void
  readonly onOpenExternal: (url: string) => void
  readonly onOpenNewWindow: (path: string) => void
  readonly onPullAllRepositories: () => void
  readonly onPullRepositoryGroup: (group: string | null) => void
  readonly onRenameRepositoryGroup: (group: string) => void
  readonly repositorySortOrder: WebRepositorySortOrder
  readonly uncommittedChangesStrategy: UncommittedChangesStrategy
  readonly menuAction?: {
    readonly id: number
    readonly action:
      | 'repository-list'
      | 'branch-list'
      | 'worktrees-list'
      | 'branch-create'
      | 'branch-rename'
      | 'branch-delete'
      | 'branch-discard'
      | 'branch-stash'
      | 'branch-update'
      | 'branch-merge'
      | 'branch-squash-merge'
      | 'branch-rebase'
  }
  readonly onMenuActionHandled?: () => void
}) {
  const [repositoryPickerOpen, setRepositoryPickerOpen] = React.useState(false)
  const [branchMenuOpen, setBranchMenuOpen] = React.useState(false)
  const [syncMenuOpen, setSyncMenuOpen] = React.useState(false)
  const [branchDialog, setBranchDialog] = React.useState<
    'create' | 'rename' | null
  >(null)
  const [branchName, setBranchName] = React.useState('')
  const [branchSubmitting, setBranchSubmitting] = React.useState(false)
  const [forcePushOpen, setForcePushOpen] = React.useState(false)
  const [publishBranchOpen, setPublishBranchOpen] = React.useState(false)
  const [fetchRefspecOpen, setFetchRefspecOpen] = React.useState(false)
  const [pullStrategyOpen, setPullStrategyOpen] = React.useState(false)
  const [updateFromDefaultOpen, setUpdateFromDefaultOpen] =
    React.useState(false)
  const [updateStrategy, setUpdateStrategy] = React.useState<
    'merge' | 'rebase'
  >(() => {
    return localStorage.getItem(webUpdateStrategyStorageKey) === 'rebase'
      ? 'rebase'
      : 'merge'
  })
  const [pullStrategy, setPullStrategy] = React.useState<WebPullStrategy>(
    () => {
      const value = localStorage.getItem(webPullStrategyStorageKey)
      return value === 'rebase' || value === 'ff-only' ? value : 'merge'
    }
  )
  const [pruneCandidates, setPruneCandidates] =
    React.useState<ReadonlyArray<WebBranchPruneCandidate> | null>(null)
  const [pruneLoading, setPruneLoading] = React.useState(false)
  const [publishRemote, setPublishRemote] = React.useState('')
  const [checkoutTarget, setCheckoutTarget] = React.useState<{
    readonly label: string
    readonly options: WebOperationOptions
  } | null>(null)
  const [deleteCurrentBranchOpen, setDeleteCurrentBranchOpen] =
    React.useState(false)
  const [deleteCurrentBranchBlocked, setDeleteCurrentBranchBlocked] =
    React.useState<string | null>(null)
  const [discardAllChangesOpen, setDiscardAllChangesOpen] =
    React.useState(false)
  const [stashAllChangesOpen, setStashAllChangesOpen] = React.useState(false)
  const branchActionRequest: 'merge' | 'squash-merge' | 'rebase' | undefined =
    props.menuAction?.action === 'branch-merge'
      ? 'merge'
      : props.menuAction?.action === 'branch-squash-merge'
      ? 'squash-merge'
      : props.menuAction?.action === 'branch-rebase'
      ? 'rebase'
      : undefined
  const repository =
    props.state.repositories.find(
      item => item.path === props.state.selectedRepositoryPath
    ) || null
  const branch = props.state.branches?.branch?.name || 'No branch'
  const defaultBranch =
    repository?.defaultBranch ?? props.state.branches?.defaultBranch ?? null
  const aheadBehind = props.state.branches?.aheadBehind
  const remotes = props.state.branches?.remotes || []
  const canPublish =
    branch !== 'No branch' &&
    props.state.branches?.branch?.upstream === null &&
    remotes.length > 0

  const handledMenuActionId = React.useRef<number | null>(null)
  React.useEffect(() => {
    const menuAction = props.menuAction
    const action = menuAction?.action
    if (!menuAction || !action || handledMenuActionId.current === menuAction.id)
      return
    if (
      action === 'branch-merge' ||
      action === 'branch-squash-merge' ||
      action === 'branch-rebase'
    ) {
      setBranchMenuOpen(true)
      return
    }
    if (action === 'repository-list') setRepositoryPickerOpen(true)
    if (action === 'branch-list') setBranchMenuOpen(true)
    if (action === 'worktrees-list') {
      void props.dispatcher.selectSection('repository-tools')
      setTimeout(() => {
        document
          .querySelector('[aria-label="Worktrees"]')
          ?.scrollIntoView({ block: 'nearest' })
      }, 0)
    }
    if (action === 'branch-create') {
      setBranchDialog('create')
      setBranchMenuOpen(false)
    }
    if (action === 'branch-rename') {
      setBranchDialog('rename')
      setBranchMenuOpen(false)
    }
    if (action === 'branch-delete') {
      const localBranches = props.state.branches?.branches || []
      if (branch === 'No branch') {
        setDeleteCurrentBranchBlocked(
          'There is no current branch to delete in this repository.'
        )
      } else if (branch === defaultBranch) {
        setDeleteCurrentBranchBlocked(
          `The default branch ${branch} cannot be deleted while it is checked out. Switch to another branch or change the default branch first.`
        )
      } else if (
        !localBranches.some(
          candidate => candidate.type !== 'Remote' && candidate.name !== branch
        )
      ) {
        setDeleteCurrentBranchBlocked(
          `The only local branch, ${branch}, cannot be deleted. Create or check out another branch first.`
        )
      } else {
        setDeleteCurrentBranchOpen(true)
      }
      setBranchMenuOpen(false)
    }
    if (action === 'branch-discard') {
      setDiscardAllChangesOpen(true)
      setBranchMenuOpen(false)
    }
    if (action === 'branch-stash') {
      setStashAllChangesOpen(true)
      setBranchMenuOpen(false)
    }
    if (action === 'branch-update') setUpdateFromDefaultOpen(true)
    handledMenuActionId.current = menuAction.id
    props.onMenuActionHandled?.()
  }, [
    branch,
    defaultBranch,
    props.dispatcher,
    props.menuAction?.action,
    props.menuAction?.id,
    props.onMenuActionHandled,
    props.state.branches?.branches,
  ])

  React.useEffect(() => {
    if (canPublish) setPublishRemote(remotes[0]?.name || '')
  }, [canPublish, remotes])

  const previewPruneBranches = async () => {
    if (pruneLoading) return
    setPruneLoading(true)
    try {
      setPruneCandidates(await props.dispatcher.previewPruneBranches())
    } finally {
      setPruneLoading(false)
    }
  }

  const requestCheckout = (options: WebOperationOptions, label: string) => {
    setBranchMenuOpen(false)
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
      setCheckoutTarget({ label, options })
      return
    }
    void props.dispatcher.runOperation('checkout', options)
  }

  const recoverCheckout = async (recovery: 'stash' | 'move' | 'discard') => {
    if (!checkoutTarget) return
    if (recovery === 'stash') {
      await props.dispatcher.runOperation('checkout', {
        ...checkoutTarget.options,
        stashChanges: true,
      })
    } else if (recovery === 'move') {
      await props.dispatcher.runOperation('checkout', {
        ...checkoutTarget.options,
        moveChanges: true,
      })
    } else {
      await props.dispatcher.discardFiles(
        props.state.status?.workingDirectory.files.map(file => file.path) || [],
        true
      )
      await props.dispatcher.runOperation('checkout', checkoutTarget.options)
    }
    setCheckoutTarget(null)
  }

  const runBranchDialog = async () => {
    const name = branchName.trim()
    const nameError = validateGitRefName(name, 'Branch name')
    if (!name || nameError || !branchDialog || branchSubmitting) return
    setBranchSubmitting(true)
    try {
      if (branchDialog === 'create')
        await props.dispatcher.runOperation('create-branch', {
          values: [name],
          checkout: true,
        })
      else
        await props.dispatcher.runOperation('rename-branch', {
          values: [branch, name],
        })
      setBranchDialog(null)
      setBranchName('')
    } finally {
      setBranchSubmitting(false)
    }
  }

  return (
    <>
      <Toolbar id="desktop-app-toolbar">
        <div className="sidebar-section" style={{ width: props.sidebarWidth }}>
          <ToolbarDropdown
            description="Current repository"
            dropdownContentRenderer={() => (
              <DesktopRepositoryPicker
                onAdd={() => {
                  props.onOpenRepositoryDialog()
                  setRepositoryPickerOpen(false)
                }}
                onRemove={props.onRemoveRepository}
                onDeleteRepository={props.onDeleteRepository}
                onSelect={path => {
                  void props.dispatcher.selectRepository(path)
                  setRepositoryPickerOpen(false)
                }}
                onTogglePinned={path =>
                  props.dispatcher.toggleRepositoryPinned(path)
                }
                onEdit={props.onOpenRepositorySettings}
                pinnedRepositoryPaths={props.state.pinnedRepositoryPaths}
                repositories={props.state.repositories}
                selectedRepositoryPath={props.state.selectedRepositoryPath}
                showBranchName={props.showBranchName}
                showWorktrees={props.showWorktreesInRepositoryList}
                repositoryIndicatorsEnabled={props.repositoryIndicatorsEnabled}
                showRecentRepositories={props.showRecentRepositories}
                onCopyPath={props.onCopyPath}
                onOpenPath={props.onOpenPath}
                onOpenExternal={props.onOpenExternal}
                onOpenNewWindow={props.onOpenNewWindow}
                onPullGroup={props.onPullRepositoryGroup}
                onRenameGroup={props.onRenameRepositoryGroup}
                repositorySortOrder={props.repositorySortOrder}
              />
            )}
            dropdownState={repositoryPickerOpen ? 'open' : 'closed'}
            foldoutStyle={{
              position: 'absolute',
              marginLeft: 0,
              width: props.sidebarWidth,
              minWidth: props.sidebarWidth,
              height: '100%',
              top: 0,
            }}
            icon={octicons.repo}
            onDropdownStateChanged={state =>
              setRepositoryPickerOpen(state === 'open')
            }
            title={repository?.name || 'Repository'}
            tooltip={repository?.path}
          />
        </div>
        <ToolbarDropdown
          className="branch-toolbar-button"
          description="Current Branch"
          dropdownContentRenderer={() => (
            <>
              <BranchActionMenu
                branches={props.state.branches?.branches || []}
                currentBranch={branch}
                currentBranchUpstream={
                  props.state.branches?.branch?.upstream || null
                }
                defaultBranch={defaultBranch}
                dispatcher={props.dispatcher}
                hasUncommittedChanges={
                  (props.state.status?.workingDirectory.files.length || 0) > 0
                }
                mergedBranches={props.state.branches?.mergedBranches || []}
                onClose={() => setBranchMenuOpen(false)}
                onRequestedActionHandled={props.onMenuActionHandled}
                requestedAction={branchActionRequest}
                onCheckout={(candidate, options) =>
                  requestCheckout(
                    options,
                    candidate.type === 'Remote'
                      ? `remote branch ${candidate.name}`
                      : `branch ${candidate.name}`
                  )
                }
                pullStrategy={pullStrategy}
              />
              <WebBranchPicker
                branches={props.state.branches?.branches || []}
                currentBranch={branch}
                defaultBranch={defaultBranch}
                onCheckout={candidate => {
                  const localBranchName =
                    candidate.type === 'Remote'
                      ? candidate.name.split('/').slice(1).join('/')
                      : candidate.name
                  const localExists = (
                    props.state.branches?.branches || []
                  ).some(
                    item =>
                      item.type !== 'Remote' && item.name === localBranchName
                  )
                  requestCheckout(
                    {
                      values: [localExists ? localBranchName : candidate.name],
                      ...(candidate.type === 'Remote' && !localExists
                        ? {
                            createLocalBranch: localBranchName,
                          }
                        : {}),
                    },
                    candidate.type === 'Remote'
                      ? `remote branch ${candidate.name}`
                      : `branch ${candidate.name}`
                  )
                }}
                recentBranches={props.state.branches?.recentBranches || []}
                sortOrder={props.branchSortOrder}
              />
              <div className="web-toolbar-menu">
                <Button
                  onClick={() => {
                    setBranchDialog('create')
                    setBranchMenuOpen(false)
                  }}
                >
                  Create branch
                </Button>
                <Button
                  disabled={branch === 'No branch'}
                  onClick={() => {
                    setBranchDialog('rename')
                    setBranchMenuOpen(false)
                  }}
                >
                  Rename current branch
                </Button>
              </div>
            </>
          )}
          dropdownState={branchMenuOpen ? 'open' : 'closed'}
          icon={octicons.gitBranch}
          onDropdownStateChanged={state => setBranchMenuOpen(state === 'open')}
          title={branch}
          tooltip={`Current branch is ${branch}`}
        />
        <ToolbarDropdown
          className="push-pull-button"
          description={
            aheadBehind
              ? `${aheadBehind.ahead} ahead, ${aheadBehind.behind} behind`
              : 'Synchronize repository'
          }
          dropdownContentRenderer={() => (
            <div className="web-toolbar-menu">
              <Button
                onClick={() => {
                  void props.dispatcher.runOperation('fetch')
                  setSyncMenuOpen(false)
                }}
              >
                Fetch
              </Button>
              <Button
                onClick={() => {
                  void props.onPullAllRepositories()
                  setSyncMenuOpen(false)
                }}
              >
                Pull all repositories
              </Button>
              {defaultBranch &&
              branch !== 'No branch' &&
              branch !== defaultBranch ? (
                <Button
                  onClick={() => {
                    setUpdateFromDefaultOpen(true)
                    setSyncMenuOpen(false)
                  }}
                >
                  Update from {defaultBranch}
                </Button>
              ) : null}
              <Button
                onClick={() => {
                  void props.dispatcher.runOperation('pull', {
                    pullStrategy,
                  })
                  setSyncMenuOpen(false)
                }}
              >
                Pull (
                {pullStrategy === 'ff-only'
                  ? 'fast-forward only'
                  : pullStrategy}
                )
              </Button>
              <Button
                onClick={() => {
                  setPullStrategyOpen(true)
                  setSyncMenuOpen(false)
                }}
              >
                Pull strategy
              </Button>
              <Button
                onClick={() => {
                  setFetchRefspecOpen(true)
                  setSyncMenuOpen(false)
                }}
              >
                Fetch refspec
              </Button>
              <Button
                onClick={() => {
                  void previewPruneBranches()
                  setSyncMenuOpen(false)
                }}
              >
                Prune stale branches
              </Button>
              {canPublish ? (
                <Button
                  onClick={() => {
                    setPublishBranchOpen(true)
                    setSyncMenuOpen(false)
                  }}
                >
                  Publish branch
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    void props.dispatcher.runOperation('push')
                    setSyncMenuOpen(false)
                  }}
                >
                  Push
                </Button>
              )}
              <Button
                className="destructive"
                onClick={() => {
                  setForcePushOpen(true)
                  setSyncMenuOpen(false)
                }}
              >
                Force-push with lease
              </Button>
              <Button
                onClick={() => {
                  void props.dispatcher.refresh()
                  setSyncMenuOpen(false)
                }}
              >
                Refresh status
              </Button>
            </div>
          )}
          dropdownState={syncMenuOpen ? 'open' : 'closed'}
          icon={syncClockwise}
          onDropdownStateChanged={state => setSyncMenuOpen(state === 'open')}
          style={ToolbarButtonStyle.Subtitle}
          title="Sync"
        />
        <Button
          ariaLabel="Open preferences"
          className="web-preferences-button"
          onClick={props.onOpenPreferences}
          tooltip="Preferences"
        >
          <Octicon symbol={octicons.gear} />
        </Button>
      </Toolbar>
      {updateFromDefaultOpen ? (
        <DialogStackContext.Provider value={{ isTopMost: true }}>
          <Dialog
            ariaDescribedBy="update-from-default-description"
            onDismissed={() => setUpdateFromDefaultOpen(false)}
            onSubmit={() => {
              void props.dispatcher
                .runOperation('update-from-default', {
                  ...(defaultBranch ? { defaultBranch } : {}),
                  updateStrategy,
                })
                .then(() => setUpdateFromDefaultOpen(false))
            }}
            title={`Update from ${defaultBranch || 'default branch'}`}
          >
            <DialogContent>
              <p id="update-from-default-description">
                Fetch the latest default branch, then update {branch} by merging
                or rebasing its commits on top.
              </p>
              <fieldset
                aria-label="Update strategy"
                className="web-dialog-options"
              >
                <label>
                  <input
                    checked={updateStrategy === 'merge'}
                    name="web-update-strategy"
                    onChange={() => {
                      setUpdateStrategy('merge')
                      localStorage.setItem(webUpdateStrategyStorageKey, 'merge')
                    }}
                    type="radio"
                  />
                  Merge the default branch into {branch}
                </label>
                <label>
                  <input
                    checked={updateStrategy === 'rebase'}
                    name="web-update-strategy"
                    onChange={() => {
                      setUpdateStrategy('rebase')
                      localStorage.setItem(
                        webUpdateStrategyStorageKey,
                        'rebase'
                      )
                    }}
                    type="radio"
                  />
                  Rebase {branch} onto the default branch
                </label>
              </fieldset>
            </DialogContent>
            <DialogFooter>
              <Button onClick={() => setUpdateFromDefaultOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {updateStrategy === 'merge'
                  ? 'Merge and update'
                  : 'Rebase and update'}
              </Button>
            </DialogFooter>
          </Dialog>
        </DialogStackContext.Provider>
      ) : null}
      <WebConfirmDialog
        confirmLabel="Delete current branch"
        message={`Delete the local branch ${branch}? Its unmerged commits will be permanently removed.`}
        onConfirm={async () => {
          if (branch !== 'No branch')
            await props.dispatcher.runOperation('delete-branch', {
              values: [branch],
              confirmed: true,
            })
          setDeleteCurrentBranchOpen(false)
        }}
        onDismiss={() => setDeleteCurrentBranchOpen(false)}
        open={deleteCurrentBranchOpen}
        title="Delete current branch?"
      />
      <WebNoticeDialog
        message={deleteCurrentBranchBlocked || ''}
        onDismiss={() => setDeleteCurrentBranchBlocked(null)}
        open={deleteCurrentBranchBlocked !== null}
        title="Cannot delete branch"
      />
      <WebConfirmDialog
        confirmLabel="Discard all changes"
        message="Move all current changes to Trash when possible? If Trash is unavailable, untracked files will be deleted permanently."
        onConfirm={async () => {
          const files = props.state.status?.workingDirectory.files || []
          await props.dispatcher.discardFiles(
            files.map(file => file.path),
            true
          )
          setDiscardAllChangesOpen(false)
        }}
        onDismiss={() => setDiscardAllChangesOpen(false)}
        open={discardAllChangesOpen}
        title="Discard all changes?"
      />
      <WebStashDialog
        onDismiss={() => setStashAllChangesOpen(false)}
        onSubmit={async (message, options) => {
          await props.dispatcher.runOperation('stash', {
            values:
              props.state.status?.workingDirectory.files.map(
                file => file.path
              ) || [],
            message,
            ...options,
            includeUntracked: true,
          })
          setStashAllChangesOpen(false)
        }}
        open={stashAllChangesOpen}
      />
      <WebConfirmDialog
        confirmLabel="Force-push with lease"
        message="Force-pushing replaces the remote branch history. Continue only if you intend to rewrite it."
        onConfirm={async () => {
          await props.dispatcher.runOperation('push', {
            force: true,
            confirmed: true,
          })
          setForcePushOpen(false)
        }}
        onDismiss={() => setForcePushOpen(false)}
        open={forcePushOpen}
        title="Force-push with lease?"
      />
      <WebCheckoutRecoveryDialog
        branchLabel={checkoutTarget?.label || 'the selected branch'}
        onDismiss={() => setCheckoutTarget(null)}
        onDiscard={() => recoverCheckout('discard')}
        onMove={() => recoverCheckout('move')}
        onStash={() => recoverCheckout('stash')}
        open={checkoutTarget !== null}
      />
      <WebTextDialog
        description="Fetch a refspec from every configured remote. Use Git refspec syntax, such as refs/heads/release:refs/remotes/origin/release."
        label="Refspec"
        onDismiss={() => setFetchRefspecOpen(false)}
        onSubmit={async value => {
          await props.dispatcher.runOperation('fetch-refspec', {
            values: [value],
          })
          setFetchRefspecOpen(false)
        }}
        open={fetchRefspecOpen}
        submitLabel="Fetch refspec"
        title="Fetch refspec"
      />
      {pullStrategyOpen ? (
        <DialogStackContext.Provider value={{ isTopMost: true }}>
          <Dialog
            ariaDescribedBy="pull-strategy-description"
            onDismissed={() => setPullStrategyOpen(false)}
            onSubmit={() => setPullStrategyOpen(false)}
            title="Pull strategy"
          >
            <DialogContent>
              <p id="pull-strategy-description">
                Choose how Pull reconciles changes from the configured upstream.
              </p>
              <fieldset
                aria-label="Pull strategy"
                className="web-dialog-options"
              >
                {(
                  [
                    ['merge', 'Merge'],
                    ['rebase', 'Rebase'],
                    ['ff-only', 'Fast-forward only'],
                  ] as const
                ).map(([value, label]) => (
                  <label key={value}>
                    <input
                      checked={pullStrategy === value}
                      name="web-pull-strategy"
                      onChange={() => {
                        setPullStrategy(value)
                        localStorage.setItem(webPullStrategyStorageKey, value)
                      }}
                      type="radio"
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
            </DialogContent>
            <DialogFooter>
              <Button onClick={() => setPullStrategyOpen(false)}>Close</Button>
            </DialogFooter>
          </Dialog>
        </DialogStackContext.Provider>
      ) : null}
      {pruneCandidates && pruneCandidates.length > 0 ? (
        <WebConfirmDialog
          confirmLabel="Prune branches"
          message={
            pruneCandidates.length
              ? `Delete these merged local branches? ${pruneCandidates
                  .map(candidate => candidate.name)
                  .join(
                    ', '
                  )}. Branches checked out recently or in another worktree are excluded.`
              : 'No stale merged local branches are eligible for pruning.'
          }
          onConfirm={async () => {
            if (pruneCandidates.length)
              await props.dispatcher.runOperation('prune-branches', {
                confirmed: true,
                ...(defaultBranch ? { defaultBranch } : {}),
              })
            setPruneCandidates(null)
          }}
          onDismiss={() => setPruneCandidates(null)}
          open={true}
          title="Prune stale branches?"
        />
      ) : null}
      {pruneCandidates && pruneCandidates.length === 0 ? (
        <DialogStackContext.Provider value={{ isTopMost: true }}>
          <Dialog
            ariaDescribedBy="prune-branches-empty-description"
            onDismissed={() => setPruneCandidates(null)}
            onSubmit={() => setPruneCandidates(null)}
            title="Prune stale branches"
          >
            <DialogContent>
              <p id="prune-branches-empty-description">
                No merged local branches are eligible for pruning. Branches
                checked out recently or in another worktree are excluded.
              </p>
            </DialogContent>
            <DialogFooter>
              <Button onClick={() => setPruneCandidates(null)}>Close</Button>
            </DialogFooter>
          </Dialog>
        </DialogStackContext.Provider>
      ) : null}
      {publishBranchOpen ? (
        <DialogStackContext.Provider value={{ isTopMost: true }}>
          <Dialog
            ariaDescribedBy="publish-branch-description"
            onDismissed={() => setPublishBranchOpen(false)}
            onSubmit={() => {
              if (!publishRemote) return
              void props.dispatcher
                .runOperation('publish-branch', {
                  values: [publishRemote, branch],
                })
                .then(() => setPublishBranchOpen(false))
            }}
            title="Publish branch"
          >
            <DialogContent>
              <p id="publish-branch-description">
                Publish {branch} and set its upstream tracking branch.
              </p>
              <label htmlFor="publish-branch-remote">Remote</label>
              <select
                id="publish-branch-remote"
                onChange={event => setPublishRemote(event.target.value)}
                value={publishRemote}
              >
                {remotes.map(remote => (
                  <option key={remote.name} value={remote.name}>
                    {remote.name}
                  </option>
                ))}
              </select>
            </DialogContent>
            <DialogFooter>
              <Button onClick={() => setPublishBranchOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={!publishRemote}
                onClick={() => {
                  void props.dispatcher
                    .runOperation('publish-branch', {
                      values: [publishRemote, branch],
                    })
                    .then(() => setPublishBranchOpen(false))
                }}
              >
                Publish branch
              </Button>
            </DialogFooter>
          </Dialog>
        </DialogStackContext.Provider>
      ) : null}
      {branchDialog ? (
        <DialogStackContext.Provider value={{ isTopMost: true }}>
          <Dialog
            ariaDescribedBy="branch-dialog-description"
            onDismissed={() => {
              setBranchDialog(null)
              setBranchName('')
            }}
            disabled={branchSubmitting}
            loading={branchSubmitting}
            onSubmit={() => void runBranchDialog()}
            title={
              branchDialog === 'create' ? 'Create branch' : 'Rename branch'
            }
          >
            <DialogContent>
              <p id="branch-dialog-description">
                {branchDialog === 'create'
                  ? 'Create a new local branch.'
                  : `Rename ${branch} to a new local branch name.`}
              </p>
              <label htmlFor="web-branch-name">Branch name</label>
              <input
                autoFocus={true}
                id="web-branch-name"
                onChange={event => setBranchName(event.target.value)}
                value={branchName}
              />
              {validateGitRefName(branchName, 'Branch name') ? (
                <p role="alert">
                  {validateGitRefName(branchName, 'Branch name')}
                </p>
              ) : null}
            </DialogContent>
            <DialogFooter>
              <Button
                onClick={() => {
                  setBranchDialog(null)
                  setBranchName('')
                }}
              >
                Cancel
              </Button>
              <Button
                disabled={
                  !branchName.trim() ||
                  Boolean(validateGitRefName(branchName, 'Branch name')) ||
                  branchSubmitting
                }
                type="submit"
              >
                {branchDialog === 'create' ? 'Create branch' : 'Rename branch'}
              </Button>
            </DialogFooter>
          </Dialog>
        </DialogStackContext.Provider>
      ) : null}
    </>
  )
}

function WebGitIdentityDialog(props: {
  readonly open: boolean
  readonly identity: WebGitIdentity | null
  readonly onDismiss: () => void
  readonly onOpenGlobalGitConfig: () => Promise<void>
  readonly onSubmit: (
    scope: 'local' | 'global',
    name: string,
    email: string
  ) => Promise<void>
}) {
  const [scope, setScope] = React.useState<'local' | 'global'>('local')
  const [name, setName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [globalName, setGlobalName] = React.useState('')
  const [globalEmail, setGlobalEmail] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (!props.open) return
    const identity = props.identity
    setScope('local')
    setName(identity?.localName || identity?.name || '')
    setEmail(identity?.localEmail || identity?.email || '')
    setGlobalName(identity?.globalName || '')
    setGlobalEmail(identity?.globalEmail || '')
    setSubmitting(false)
  }, [props.identity, props.open])

  if (!props.open) return null

  const selectedName = scope === 'global' ? globalName : name
  const selectedEmail = scope === 'global' ? globalEmail : email
  const submit = async () => {
    if (!selectedName.trim() || !selectedEmail.trim() || submitting) return
    setSubmitting(true)
    try {
      await props.onSubmit(scope, selectedName.trim(), selectedEmail.trim())
      props.onDismiss()
    } catch {
      // The shared error dialog owns the failure state; keep this form open so
      // the user can retry after recovering the underlying Git configuration.
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DialogStackContext.Provider value={{ isTopMost: true }}>
      <Dialog
        ariaDescribedBy="web-git-identity-description"
        disabled={submitting}
        loading={submitting}
        onDismissed={props.onDismiss}
        onSubmit={() => void submit()}
        title="Configure Git user"
      >
        <DialogContent>
          <p id="web-git-identity-description">
            Git uses this name and email address when creating commits.
          </p>
          <label htmlFor="web-git-identity-scope">Save to</label>
          <select
            id="web-git-identity-scope"
            onChange={event =>
              setScope(event.target.value as 'local' | 'global')
            }
            value={scope}
          >
            <option value="local">This repository</option>
            <option value="global">Global Git config</option>
          </select>
          <label htmlFor="web-git-identity-name">Name</label>
          <input
            autoFocus={true}
            id="web-git-identity-name"
            onChange={event =>
              scope === 'global'
                ? setGlobalName(event.target.value)
                : setName(event.target.value)
            }
            value={selectedName}
          />
          <label htmlFor="web-git-identity-email">Email</label>
          <input
            id="web-git-identity-email"
            onChange={event =>
              scope === 'global'
                ? setGlobalEmail(event.target.value)
                : setEmail(event.target.value)
            }
            type="email"
            value={selectedEmail}
          />
          {props.identity?.nameOrigin || props.identity?.emailOrigin ? (
            <div role="status">
              <strong>Current effective identity</strong>
              {props.identity.nameOrigin ? (
                <div>
                  user.name: {props.identity.name} (
                  {props.identity.nameOrigin.scope};{' '}
                  {props.identity.nameOrigin.origin})
                </div>
              ) : null}
              {props.identity.emailOrigin ? (
                <div>
                  user.email: {props.identity.email} (
                  {props.identity.emailOrigin.scope};{' '}
                  {props.identity.emailOrigin.origin})
                </div>
              ) : null}
            </div>
          ) : null}
          <Button
            onClick={() => void props.onOpenGlobalGitConfig()}
            type="button"
          >
            Open global Git config
          </Button>
        </DialogContent>
        <DialogFooter>
          <Button onClick={props.onDismiss}>Cancel</Button>
          <Button
            disabled={
              !selectedName.trim() || !selectedEmail.trim() || submitting
            }
            type="submit"
          >
            Save Git user
          </Button>
        </DialogFooter>
      </Dialog>
    </DialogStackContext.Provider>
  )
}

function WebCommitDialog(props: {
  readonly open: boolean
  readonly commitToAmend: WebApplicationState['commitToAmend']
  readonly commitDialogRequest: number
  readonly emoji: WebApplicationState['emoji']
  readonly onDismiss: () => void
  readonly onStopAmending: () => void
  readonly selectedFileCount: number
  readonly hiddenIncludedFileCount: number
  readonly identity: WebGitIdentity | null
  readonly message: string
  readonly trailerText: string
  readonly options: WebCommitOptions
  readonly spellcheckEnabled: boolean
  readonly showCommitLengthWarning: boolean
  readonly commitSummaryLengthWarningThreshold: number
  readonly onMessageChanged: (message: string) => void
  readonly onTrailerTextChanged: (text: string) => void
  readonly onOptionChanged: (
    option: keyof WebCommitOptions,
    value: boolean
  ) => void
  readonly onSpellcheckChanged: (enabled: boolean) => void
  readonly onConfigureIdentity: () => void
  readonly onSubmit: (
    message: string,
    options: Omit<WebCommitOptions, 'allowEmpty'> & {
      readonly allowEmpty: boolean
      readonly amend: boolean
      readonly trailers: ReadonlyArray<{
        readonly token: string
        readonly value: string
      }>
    }
  ) => Promise<void>
}) {
  const [submitting, setSubmitting] = React.useState(false)
  const [confirmNoVerify, setConfirmNoVerify] = React.useState(false)
  const [confirmFilteredCommit, setConfirmFilteredCommit] =
    React.useState(false)
  const [trailerError, setTrailerError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (props.open) {
      setSubmitting(false)
      setConfirmNoVerify(false)
      setConfirmFilteredCommit(false)
      setTrailerError(null)
    }
  }, [props.open])

  if (!props.open) return null

  const performSubmit = async () => {
    setSubmitting(true)
    try {
      await props.onSubmit(props.message.trim(), {
        ...props.options,
        trailers: props.trailerText
          .split(/\r?\n/)
          .map(value => value.trim())
          .filter(Boolean)
          .map(value => ({ token: 'Co-Authored-By', value })),
      })
    } finally {
      setSubmitting(false)
    }
  }

  const submit = async () => {
    const identityMissing =
      !props.identity?.name.trim() || !props.identity?.email.trim()
    const invalidTrailers = invalidCoAuthorLines(props.trailerText)
    if (invalidTrailers.length > 0) {
      setTrailerError(
        `Each co-author must use the format Name <email>. Invalid entry: ${invalidTrailers[0]}`
      )
      return
    }
    setTrailerError(null)
    if (
      !props.message.trim() ||
      submitting ||
      identityMissing ||
      (props.selectedFileCount === 0 && !props.options.allowEmpty)
    )
      return
    if (props.hiddenIncludedFileCount > 0 && !confirmFilteredCommit) {
      setConfirmFilteredCommit(true)
      return
    }
    if (props.options.noVerify && !confirmNoVerify) {
      setConfirmNoVerify(true)
      return
    }
    await performSubmit()
  }

  return (
    <DialogStackContext.Provider value={{ isTopMost: true }}>
      <Dialog
        ariaDescribedBy="web-commit-dialog-description"
        disabled={submitting}
        loading={submitting}
        onDismissed={props.onDismiss}
        onSubmit={() => void submit()}
        title="Commit changes"
      >
        <DialogContent>
          <p id="web-commit-dialog-description">
            Commit the included files in the selected repository.
          </p>
          {props.hiddenIncludedFileCount > 0 ? (
            <p>
              {props.hiddenIncludedFileCount} included{' '}
              {props.hiddenIncludedFileCount === 1 ? 'file is' : 'files are'}{' '}
              hidden by the current filter.
            </p>
          ) : null}
          {!props.identity ? (
            <p role="status">Loading Git user configuration...</p>
          ) : !props.identity.name.trim() || !props.identity.email.trim() ? (
            <div role="alert">
              <p>
                Configure a Git user name and email before creating a commit.
              </p>
              <Button onClick={props.onConfigureIdentity}>
                Configure Git user
              </Button>
            </div>
          ) : (
            <p role="status">
              Committing as {props.identity.name} &lt;{props.identity.email}
              &gt; ({props.identity.nameOrigin?.scope || 'unknown'} config)
            </p>
          )}
          <label htmlFor="web-commit-message">Commit message</label>
          {props.commitToAmend ? (
            <div className="web-amend-notice" role="status">
              Amending {props.commitToAmend.shortSha}:{' '}
              {props.commitToAmend.summary || 'Empty commit message'}
              <Button onClick={props.onStopAmending} type="button">
                Stop amending
              </Button>
            </div>
          ) : null}
          <AutocompletingTextArea
            autocompletionProviders={[
              new EmojiAutocompletionProvider(props.emoji),
            ]}
            autoFocus={true}
            className="web-commit-message-input"
            elementId="web-commit-message"
            onValueChanged={props.onMessageChanged}
            rows={4}
            spellcheck={props.spellcheckEnabled}
            value={props.message}
          />
          {props.showCommitLengthWarning &&
          props.message.split(/\r?\n/, 1)[0].trim().length >
            props.commitSummaryLengthWarningThreshold ? (
            <p role="status">
              Commit summaries are longer than{' '}
              {props.commitSummaryLengthWarningThreshold} characters. Put extra
              detail in the description when possible.
            </p>
          ) : null}
          <label htmlFor="web-commit-spellcheck">
            <input
              checked={props.spellcheckEnabled}
              id="web-commit-spellcheck"
              onChange={event =>
                props.onSpellcheckChanged(event.target.checked)
              }
              type="checkbox"
            />
            Enable commit spellcheck
          </label>
          <label htmlFor="web-commit-coauthors">Co-authors</label>
          <textarea
            id="web-commit-coauthors"
            onChange={event => {
              props.onTrailerTextChanged(event.target.value)
              setTrailerError(null)
            }}
            placeholder="Name <email>, one per line"
            rows={3}
            value={props.trailerText}
          />
          {trailerError ? <p role="alert">{trailerError}</p> : null}
          <div className="web-dialog-options">
            <label>
              <input
                checked={props.options.amend}
                onChange={event => {
                  if (props.commitToAmend && !event.target.checked)
                    props.onStopAmending()
                  else props.onOptionChanged('amend', event.target.checked)
                }}
                type="checkbox"
              />
              {props.commitToAmend
                ? 'Amend selected commit'
                : 'Amend the previous commit'}
            </label>
            <label>
              <input
                checked={props.options.signOff}
                onChange={event =>
                  props.onOptionChanged('signOff', event.target.checked)
                }
                type="checkbox"
              />
              Add Signed-off-by trailer
            </label>
            <label>
              <input
                checked={props.options.noVerify}
                onChange={event =>
                  props.onOptionChanged('noVerify', event.target.checked)
                }
                type="checkbox"
              />
              Skip commit hooks
            </label>
            <label>
              <input
                checked={props.options.allowEmpty}
                onChange={event =>
                  props.onOptionChanged('allowEmpty', event.target.checked)
                }
                type="checkbox"
              />
              Allow an empty commit
            </label>
          </div>
        </DialogContent>
        <DialogFooter>
          <Button onClick={props.onDismiss}>Cancel</Button>
          <Button
            disabled={
              !props.message.trim() ||
              submitting ||
              !props.identity?.name.trim() ||
              !props.identity?.email.trim() ||
              (props.selectedFileCount === 0 && !props.options.allowEmpty)
            }
            type="submit"
          >
            {props.commitToAmend ? 'Amend commit' : 'Commit changes'}
          </Button>
        </DialogFooter>
      </Dialog>
      <WebConfirmDialog
        confirmLabel="Skip commit hooks"
        message="Skipping commit hooks can bypass repository checks. Continue?"
        onConfirm={async () => {
          await props.onSubmit(props.message.trim(), {
            ...props.options,
            trailers: props.trailerText
              .split(/\r?\n/)
              .map(value => value.trim())
              .filter(Boolean)
              .map(value => ({ token: 'Co-Authored-By', value })),
          })
          setConfirmNoVerify(false)
        }}
        onDismiss={() => setConfirmNoVerify(false)}
        open={confirmNoVerify}
        title="Skip commit hooks?"
      />
      <WebConfirmDialog
        confirmLabel="Commit hidden changes"
        message={`The current filter hides ${
          props.hiddenIncludedFileCount
        } included ${
          props.hiddenIncludedFileCount === 1 ? 'file' : 'files'
        }. Those files will also be committed.`}
        onConfirm={async () => {
          setConfirmFilteredCommit(false)
          if (props.options.noVerify) setConfirmNoVerify(true)
          else await performSubmit()
        }}
        onDismiss={() => setConfirmFilteredCommit(false)}
        open={confirmFilteredCommit}
        title="Commit filtered changes?"
      />
    </DialogStackContext.Provider>
  )
}

function WebResetDialog(props: {
  readonly open: boolean
  readonly onDismiss: () => void
  readonly onConfirm: (mode: 'mixed' | 'hard') => Promise<void>
}) {
  const [mode, setMode] = React.useState<'mixed' | 'hard'>('mixed')
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (props.open) {
      setMode('mixed')
      setSubmitting(false)
    }
  }, [props.open])

  if (!props.open) return null

  const submit = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      await props.onConfirm(mode)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DialogStackContext.Provider value={{ isTopMost: true }}>
      <Dialog
        ariaDescribedBy="web-reset-dialog-description"
        disabled={submitting}
        loading={submitting}
        onDismissed={props.onDismiss}
        onSubmit={() => void submit()}
        role="alertdialog"
        title="Reset selected commit?"
        type="warning"
      >
        <DialogContent>
          <p id="web-reset-dialog-description">
            Choose how the current branch should be reset to the selected
            commit.
          </p>
          <fieldset
            aria-label="Reset mode"
            className="web-dialog-options"
            disabled={submitting}
          >
            <label>
              <input
                checked={mode === 'mixed'}
                name="web-reset-mode"
                onChange={() => setMode('mixed')}
                type="radio"
                value="mixed"
              />
              Mixed reset: keep file changes in the working directory
            </label>
            <label>
              <input
                checked={mode === 'hard'}
                name="web-reset-mode"
                onChange={() => setMode('hard')}
                type="radio"
                value="hard"
              />
              Hard reset: discard tracked file changes
            </label>
          </fieldset>
          {mode === 'hard' ? (
            <p>
              Hard reset permanently discards tracked working-directory changes
              and rewrites local history.
            </p>
          ) : null}
        </DialogContent>
        <DialogFooter>
          <Button onClick={props.onDismiss}>Cancel</Button>
          <Button
            className={mode === 'hard' ? 'destructive' : undefined}
            type="submit"
          >
            {mode === 'hard' ? 'Hard reset' : 'Mixed reset'}
          </Button>
        </DialogFooter>
      </Dialog>
    </DialogStackContext.Provider>
  )
}

function WebConfirmDialog(props: {
  readonly open: boolean
  readonly title: string
  readonly message: string
  readonly confirmLabel: string
  readonly onDismiss: () => void
  readonly onConfirm: () => Promise<void>
  readonly additionalContent?: React.ReactNode
}) {
  const [submitting, setSubmitting] = React.useState(false)
  if (!props.open) return null

  const confirm = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      await props.onConfirm()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DialogStackContext.Provider value={{ isTopMost: true }}>
      <Dialog
        ariaDescribedBy="web-confirm-dialog-message"
        disabled={submitting}
        loading={submitting}
        onDismissed={props.onDismiss}
        title={props.title}
        type="warning"
        role="alertdialog"
      >
        <DialogContent>
          <p id="web-confirm-dialog-message">{props.message}</p>
          {props.additionalContent}
        </DialogContent>
        <DialogFooter>
          <Button onClick={props.onDismiss}>Cancel</Button>
          <Button
            className="destructive"
            onClick={() => void confirm()}
            type="submit"
          >
            {props.confirmLabel}
          </Button>
        </DialogFooter>
      </Dialog>
    </DialogStackContext.Provider>
  )
}

function WebCheckoutRecoveryDialog(props: {
  readonly open: boolean
  readonly branchLabel: string
  readonly onDismiss: () => void
  readonly onStash: () => Promise<void>
  readonly onMove: () => Promise<void>
  readonly onDiscard: () => Promise<void>
}) {
  const [submitting, setSubmitting] = React.useState(false)
  const [confirmDiscard, setConfirmDiscard] = React.useState(false)

  React.useEffect(() => {
    if (props.open) {
      setSubmitting(false)
      setConfirmDiscard(false)
    }
  }, [props.open])

  if (!props.open) return null

  const run = async (action: () => Promise<void>) => {
    if (submitting) return
    setSubmitting(true)
    try {
      await action()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DialogStackContext.Provider value={{ isTopMost: true }}>
      <Dialog
        ariaDescribedBy="web-checkout-recovery-message"
        disabled={submitting}
        loading={submitting}
        onDismissed={props.onDismiss}
        role="alertdialog"
        title="Changes prevent checkout"
        type="warning"
      >
        <DialogContent>
          <p id="web-checkout-recovery-message">
            The working directory has uncommitted changes. Choose how to
            preserve or discard them before switching to {props.branchLabel}.
          </p>
        </DialogContent>
        <DialogFooter>
          <Button disabled={submitting} onClick={props.onDismiss}>
            Cancel
          </Button>
          <Button disabled={submitting} onClick={() => void run(props.onStash)}>
            Leave changes here
          </Button>
          <Button disabled={submitting} onClick={() => void run(props.onMove)}>
            Bring changes to branch
          </Button>
          <Button
            className="destructive"
            disabled={submitting}
            onClick={() => setConfirmDiscard(true)}
          >
            Discard and switch
          </Button>
        </DialogFooter>
      </Dialog>
      <WebConfirmDialog
        confirmLabel="Discard and switch"
        message={`Discard all uncommitted changes before switching to ${props.branchLabel}? This cannot be undone.`}
        onConfirm={async () => {
          await run(props.onDiscard)
          setConfirmDiscard(false)
        }}
        onDismiss={() => setConfirmDiscard(false)}
        open={confirmDiscard}
        title="Discard changes before switching?"
      />
    </DialogStackContext.Provider>
  )
}

function WebDeleteRepositoryDialog(props: {
  readonly open: boolean
  readonly repositoryName: string
  readonly loading: boolean
  readonly onDismiss: () => void
  readonly onConfirm: (mode: WebRepositoryDeleteMode) => Promise<boolean>
}) {
  const [mode, setMode] = React.useState<WebRepositoryDeleteMode>('trash')

  React.useEffect(() => {
    if (props.open) setMode('trash')
  }, [props.open])

  if (!props.open) return null

  return (
    <DialogStackContext.Provider value={{ isTopMost: true }}>
      <Dialog
        ariaDescribedBy="web-delete-repository-message"
        disabled={props.loading}
        loading={props.loading}
        onDismissed={props.onDismiss}
        role="alertdialog"
        title="Delete repository from disk?"
        type="warning"
      >
        <DialogContent>
          <p id="web-delete-repository-message">
            Delete {props.repositoryName} and all of its files from this Mac?
          </p>
          <fieldset
            aria-label="Repository deletion mode"
            className="web-dialog-options"
            disabled={props.loading}
          >
            <legend>Deletion method</legend>
            <label>
              <input
                checked={mode === 'trash'}
                name="web-repository-delete-mode"
                onChange={() => setMode('trash')}
                type="radio"
              />
              Move to Trash
            </label>
            <label>
              <input
                checked={mode === 'permanent'}
                name="web-repository-delete-mode"
                onChange={() => setMode('permanent')}
                type="radio"
              />
              Delete permanently
            </label>
          </fieldset>
          <p role="alert">
            {mode === 'permanent'
              ? 'Permanent deletion cannot be undone.'
              : 'Moving to Trash keeps the repository recoverable in Finder.'}
          </p>
        </DialogContent>
        <DialogFooter>
          <Button onClick={props.onDismiss}>Cancel</Button>
          <Button
            className="destructive"
            disabled={props.loading}
            onClick={async () => {
              if (await props.onConfirm(mode)) props.onDismiss()
            }}
            type="submit"
          >
            {mode === 'permanent' ? 'Delete permanently' : 'Move to Trash'}
          </Button>
        </DialogFooter>
      </Dialog>
    </DialogStackContext.Provider>
  )
}

function WebTextDialog(props: {
  readonly open: boolean
  readonly title: string
  readonly description: string
  readonly label: string
  readonly initialValue?: string
  readonly submitLabel: string
  readonly validate?: (value: string) => string | null
  readonly onDismiss: () => void
  readonly onSubmit: (value: string) => Promise<void>
}) {
  const [value, setValue] = React.useState(props.initialValue || '')
  const [submitting, setSubmitting] = React.useState(false)
  const validationError = props.validate?.(value) || null

  React.useEffect(() => {
    if (props.open) {
      setValue(props.initialValue || '')
      setSubmitting(false)
    }
  }, [props.initialValue, props.open])

  if (!props.open) return null

  const submit = async () => {
    if (!value.trim() || validationError || submitting) return
    setSubmitting(true)
    try {
      await props.onSubmit(value.trim())
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DialogStackContext.Provider value={{ isTopMost: true }}>
      <Dialog
        ariaDescribedBy="web-text-dialog-description"
        disabled={submitting}
        loading={submitting}
        onDismissed={props.onDismiss}
        onSubmit={() => void submit()}
        title={props.title}
      >
        <DialogContent>
          <p id="web-text-dialog-description">{props.description}</p>
          <label htmlFor="web-text-dialog-value">{props.label}</label>
          <input
            autoFocus={true}
            id="web-text-dialog-value"
            onChange={event => setValue(event.target.value)}
            type="text"
            value={value}
          />
          {validationError ? <p role="alert">{validationError}</p> : null}
        </DialogContent>
        <DialogFooter>
          <Button onClick={props.onDismiss}>Cancel</Button>
          <Button
            disabled={!value.trim() || Boolean(validationError) || submitting}
            onClick={() => void submit()}
            type="submit"
          >
            {props.submitLabel}
          </Button>
        </DialogFooter>
      </Dialog>
    </DialogStackContext.Provider>
  )
}

function WebMessageDialog(props: {
  readonly open: boolean
  readonly title: string
  readonly description: string
  readonly label: string
  readonly initialValue?: string
  readonly submitLabel: string
  readonly onDismiss: () => void
  readonly onSubmit: (value: string) => Promise<void>
}) {
  const [value, setValue] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (props.open) {
      setValue(props.initialValue || '')
      setSubmitting(false)
    }
  }, [props.initialValue, props.open])

  if (!props.open) return null

  const submit = async () => {
    if (!value.trim() || submitting) return
    setSubmitting(true)
    try {
      await props.onSubmit(value.trim())
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DialogStackContext.Provider value={{ isTopMost: true }}>
      <Dialog
        ariaDescribedBy="web-message-dialog-description"
        disabled={submitting}
        loading={submitting}
        onDismissed={props.onDismiss}
        onSubmit={() => void submit()}
        title={props.title}
      >
        <DialogContent>
          <p id="web-message-dialog-description">{props.description}</p>
          <label htmlFor="web-message-dialog-value">{props.label}</label>
          <textarea
            autoFocus={true}
            id="web-message-dialog-value"
            onChange={event => setValue(event.target.value)}
            rows={4}
            value={value}
          />
        </DialogContent>
        <DialogFooter>
          <Button onClick={props.onDismiss}>Cancel</Button>
          <Button
            disabled={!value.trim() || submitting}
            onClick={() => void submit()}
            type="submit"
          >
            {props.submitLabel}
          </Button>
        </DialogFooter>
      </Dialog>
    </DialogStackContext.Provider>
  )
}

function WebNoticeDialog(props: {
  readonly open: boolean
  readonly title: string
  readonly message: string
  readonly onDismiss: () => void
}) {
  if (!props.open) return null

  return (
    <DialogStackContext.Provider value={{ isTopMost: true }}>
      <Dialog
        ariaDescribedBy="web-notice-dialog-message"
        onDismissed={props.onDismiss}
        onSubmit={props.onDismiss}
        title={props.title}
      >
        <DialogContent>
          <p id="web-notice-dialog-message">{props.message}</p>
        </DialogContent>
        <DialogFooter>
          <Button onClick={props.onDismiss} type="button">
            Close
          </Button>
        </DialogFooter>
      </Dialog>
    </DialogStackContext.Provider>
  )
}

function WebStashDialog(props: {
  readonly open: boolean
  readonly onDismiss: () => void
  readonly onSubmit: (
    message: string,
    options: { readonly includeUntracked: boolean; readonly keepIndex: boolean }
  ) => Promise<void>
}) {
  const [message, setMessage] = React.useState('')
  const [includeUntracked, setIncludeUntracked] = React.useState(false)
  const [keepIndex, setKeepIndex] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (!props.open) return
    setMessage('')
    setIncludeUntracked(false)
    setKeepIndex(false)
    setSubmitting(false)
  }, [props.open])

  if (!props.open) return null

  const submit = async () => {
    if (!message.trim() || submitting) return
    setSubmitting(true)
    try {
      await props.onSubmit(message.trim(), { includeUntracked, keepIndex })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DialogStackContext.Provider value={{ isTopMost: true }}>
      <Dialog
        ariaDescribedBy="web-stash-dialog-description"
        disabled={submitting}
        loading={submitting}
        onDismissed={props.onDismiss}
        onSubmit={() => void submit()}
        title="Create stash"
      >
        <DialogContent>
          <p id="web-stash-dialog-description">
            Save selected changes so they can be restored later.
          </p>
          <label htmlFor="web-stash-message">Message</label>
          <textarea
            autoFocus={true}
            id="web-stash-message"
            onChange={event => setMessage(event.target.value)}
            rows={4}
            value={message}
          />
          <label>
            <input
              checked={includeUntracked}
              onChange={event => setIncludeUntracked(event.target.checked)}
              type="checkbox"
            />
            Include untracked files
          </label>
          <label>
            <input
              checked={keepIndex}
              onChange={event => setKeepIndex(event.target.checked)}
              type="checkbox"
            />
            Keep staged changes staged
          </label>
        </DialogContent>
        <DialogFooter>
          <Button onClick={props.onDismiss}>Cancel</Button>
          <Button
            disabled={!message.trim() || submitting}
            onClick={() => void submit()}
            type="submit"
          >
            Create stash
          </Button>
        </DialogFooter>
      </Dialog>
    </DialogStackContext.Provider>
  )
}

function WebRemoteDialog(props: {
  readonly open: boolean
  readonly remote: WebRemote | null
  readonly onDismiss: () => void
  readonly onSubmit: (name: string, url: string) => Promise<void>
}) {
  const [name, setName] = React.useState('')
  const [url, setURL] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (!props.open) return
    setName(props.remote?.name || '')
    setURL(props.remote?.url || '')
    setSubmitting(false)
  }, [props.open, props.remote])

  if (!props.open) return null

  const nameError = validateRemoteName(name)
  const urlError = validateRemoteURL(url)
  const submit = async () => {
    if (nameError || urlError || submitting) return
    setSubmitting(true)
    try {
      await props.onSubmit(name.trim(), url.trim())
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DialogStackContext.Provider value={{ isTopMost: true }}>
      <Dialog
        ariaDescribedBy="web-remote-dialog-description"
        disabled={submitting}
        loading={submitting}
        onDismissed={props.onDismiss}
        onSubmit={() => void submit()}
        title={props.remote ? 'Set remote URL' : 'Add remote'}
      >
        <DialogContent>
          <p id="web-remote-dialog-description">
            Configure the remote name and the HTTPS, SSH, Git, or local path
            used to reach it.
          </p>
          <label htmlFor="web-remote-name">Remote name</label>
          <input
            autoFocus={true}
            id="web-remote-name"
            onChange={event => setName(event.target.value)}
            type="text"
            value={name}
          />
          {nameError ? <p role="alert">{nameError}</p> : null}
          <label htmlFor="web-remote-url">Remote URL</label>
          <input
            id="web-remote-url"
            onChange={event => setURL(event.target.value)}
            type="text"
            value={url}
          />
          {urlError ? <p role="alert">{urlError}</p> : null}
        </DialogContent>
        <DialogFooter>
          <Button onClick={props.onDismiss}>Cancel</Button>
          <Button
            disabled={Boolean(nameError || urlError) || submitting}
            onClick={() => void submit()}
            type="submit"
          >
            {props.remote ? 'Set URL' : 'Add remote'}
          </Button>
        </DialogFooter>
      </Dialog>
    </DialogStackContext.Provider>
  )
}

function WebTagDialog(props: {
  readonly open: boolean
  readonly title?: string
  readonly initialTarget?: string
  readonly onDismiss: () => void
  readonly onSubmit: (
    name: string,
    target: string,
    message: string
  ) => Promise<void>
}) {
  const [name, setName] = React.useState('')
  const [target, setTarget] = React.useState('')
  const [message, setMessage] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (!props.open) return
    setName('')
    setTarget(props.initialTarget || '')
    setMessage('')
    setSubmitting(false)
  }, [props.initialTarget, props.open])

  if (!props.open) return null

  const nameError = validateGitRefName(name, 'Tag name')
  const submit = async () => {
    if (!name.trim() || nameError || submitting) return
    setSubmitting(true)
    try {
      await props.onSubmit(
        name.trim(),
        target.trim(),
        message.trim() || name.trim()
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DialogStackContext.Provider value={{ isTopMost: true }}>
      <Dialog
        ariaDescribedBy="web-tag-dialog-description"
        disabled={submitting}
        loading={submitting}
        onDismissed={props.onDismiss}
        onSubmit={() => void submit()}
        title={props.title || 'Create tag'}
      >
        <DialogContent>
          <p id="web-tag-dialog-description">
            Create an annotated tag with a target and message.
          </p>
          <label htmlFor="web-tag-name">Tag name</label>
          <input
            autoFocus={true}
            id="web-tag-name"
            onChange={event => setName(event.target.value)}
            type="text"
            value={name}
          />
          {nameError ? <p role="alert">{nameError}</p> : null}
          <label htmlFor="web-tag-target">Target commit or ref</label>
          <input
            id="web-tag-target"
            onChange={event => setTarget(event.target.value)}
            placeholder="Current branch tip"
            type="text"
            value={target}
          />
          <label htmlFor="web-tag-message">Tag message</label>
          <textarea
            id="web-tag-message"
            onChange={event => setMessage(event.target.value)}
            rows={4}
            value={message}
          />
        </DialogContent>
        <DialogFooter>
          <Button onClick={props.onDismiss}>Cancel</Button>
          <Button
            disabled={!name.trim() || Boolean(nameError) || submitting}
            onClick={() => void submit()}
            type="submit"
          >
            Create tag
          </Button>
        </DialogFooter>
      </Dialog>
    </DialogStackContext.Provider>
  )
}

function WebWorktreeDialog(props: {
  readonly open: boolean
  readonly onDismiss: () => void
  readonly onChooseDirectory?: () => Promise<string | null>
  readonly initialBranch?: WebBranch | null
  readonly worktreeInclude?: {
    readonly configured: boolean
    readonly patterns: ReadonlyArray<string>
  }
  readonly onSubmit: (path: string, branch: string) => Promise<void>
}) {
  const [path, setPath] = React.useState('')
  const [branch, setBranch] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (props.open) {
      setPath('')
      const initialBranch = props.initialBranch
      setBranch(
        initialBranch?.type === 'Remote'
          ? initialBranch.name.split('/').slice(1).join('/')
          : initialBranch?.name || ''
      )
      setSubmitting(false)
    }
  }, [props.initialBranch, props.open])

  if (!props.open) return null

  const pathError = validateAbsolutePath(path, 'Worktree path')
  const branchError = validateGitRefName(branch, 'Branch name')
  const submit = async () => {
    if (
      !path.trim() ||
      !branch.trim() ||
      pathError ||
      branchError ||
      submitting
    )
      return
    setSubmitting(true)
    try {
      await props.onSubmit(path.trim(), branch.trim())
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DialogStackContext.Provider value={{ isTopMost: true }}>
      <Dialog
        ariaDescribedBy="web-worktree-dialog-description"
        disabled={submitting}
        loading={submitting}
        onDismissed={props.onDismiss}
        onSubmit={() => void submit()}
        title="Create a linked worktree"
      >
        <DialogContent>
          <p id="web-worktree-dialog-description">
            {props.initialBranch
              ? `Create a linked worktree from ${props.initialBranch.name}.`
              : 'Create a linked worktree on a new local branch.'}
          </p>
          {props.worktreeInclude?.configured ? (
            <p role="status">
              This repository has {props.worktreeInclude.patterns.length}{' '}
              <code>.worktreeinclude</code>{' '}
              {props.worktreeInclude.patterns.length === 1
                ? 'pattern'
                : 'patterns'}
              . Matching ignored files will be copied into the new worktree.
            </p>
          ) : null}
          <label htmlFor="web-worktree-path">Worktree path</label>
          <div className="web-path-picker">
            <input
              autoFocus={true}
              id="web-worktree-path"
              onChange={event => setPath(event.target.value)}
              type="text"
              value={path}
            />
            {props.onChooseDirectory ? (
              <Button
                onClick={async () => {
                  const selectedPath = await props.onChooseDirectory?.()
                  if (selectedPath) setPath(selectedPath)
                }}
                type="button"
              >
                Choose folder
              </Button>
            ) : null}
          </div>
          {pathError ? <p role="alert">{pathError}</p> : null}
          <label htmlFor="web-worktree-branch">
            {props.initialBranch ? 'Branch' : 'New branch'}
          </label>
          <input
            readOnly={
              props.initialBranch !== null && props.initialBranch !== undefined
            }
            id="web-worktree-branch"
            onChange={event => setBranch(event.target.value)}
            type="text"
            value={branch}
          />
          {branchError ? <p role="alert">{branchError}</p> : null}
        </DialogContent>
        <DialogFooter>
          <Button onClick={props.onDismiss}>Cancel</Button>
          <Button
            disabled={
              !path.trim() ||
              !branch.trim() ||
              Boolean(pathError) ||
              Boolean(branchError) ||
              submitting
            }
            onClick={() => void submit()}
            type="submit"
          >
            Create worktree
          </Button>
        </DialogFooter>
      </Dialog>
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
}) {
  const files = (props.state.status?.workingDirectory.files || []).map(file =>
    getDesktopWorkingDirectoryFile(
      file,
      props.state.fileSelections.get(file.path)
    )
  )
  const selectedFiles = files
    .filter(
      file => file.selection.getSelectionType() !== DiffSelectionType.None
    )
    .map(file => file.path)
  const changesFilter = props.showChangesFilter
    ? props.state.changesFilter
    : {
        filterText: '',
        isIncludedInCommit: false,
        isExcludedFromCommit: false,
        isNewFile: false,
        isModifiedFile: false,
        isDeletedFile: false,
      }
  const conflictedFiles = files.filter(
    file => file.status.kind === AppFileStatusKind.Conflicted
  )
  const [commitDialogOpen, setCommitDialogOpen] = React.useState(false)
  const [gitIdentityDialogOpen, setGitIdentityDialogOpen] =
    React.useState(false)
  const [discardDialogOpen, setDiscardDialogOpen] = React.useState(false)
  const [selectedStashDialogOpen, setSelectedStashDialogOpen] =
    React.useState(false)
  const [stashDialogTarget, setStashDialogTarget] =
    React.useState<WebStash | null>(null)
  const [selectedChangePaths, setSelectedChangePaths] = React.useState<
    ReadonlyArray<string>
  >([])
  const lastCommitDialogRequest = React.useRef(0)
  const [discardPermanently, setDiscardPermanently] = React.useState(() =>
    getBoolean(webDiscardPermanentlyStorageKey, false)
  )
  const changesScrollStorageKey = repositoryViewStorageKey(
    webChangesScrollStorageKey,
    props.state.selectedRepositoryPath
  )
  const [changesScrollTop, setChangesScrollTop] = React.useState(() =>
    Number(localStorage.getItem(changesScrollStorageKey) || 0)
  )
  React.useEffect(() => {
    const next = Number(localStorage.getItem(changesScrollStorageKey) || 0)
    setChangesScrollTop(next)
  }, [changesScrollStorageKey])
  React.useEffect(() => {
    if (props.state.selectedFilePath === null) setSelectedChangePaths([])
  }, [props.state.selectedFilePath])
  const operation = props.state.status?.operation
  const operationState = props.state.status?.operationState || null
  const operationLabel =
    operation === 'rebase'
      ? 'Rebase'
      : operation === 'cherryPick'
      ? 'Cherry-pick'
      : operation === 'merge'
      ? 'Merge'
      : operation === 'revert'
      ? 'Revert'
      : operation === 'squash'
      ? 'Squash merge'
      : null

  React.useEffect(() => {
    if (
      props.mode === 'sidebar' &&
      props.state.commitDialogRequest > 0 &&
      props.state.commitDialogRequest > lastCommitDialogRequest.current
    ) {
      lastCommitDialogRequest.current = props.state.commitDialogRequest
      setCommitDialogOpen(true)
    }
  }, [props.mode, props.state.commitDialogRequest])
  const matchesStatusFilters = (file: WorkingDirectoryFileChange) => {
    const selectionType = file.selection.getSelectionType()
    if (
      changesFilter.isIncludedInCommit &&
      selectionType === DiffSelectionType.None
    )
      return false
    if (
      changesFilter.isExcludedFromCommit &&
      selectionType !== DiffSelectionType.None
    )
      return false
    if (
      changesFilter.isNewFile &&
      file.status.kind !== AppFileStatusKind.New &&
      file.status.kind !== AppFileStatusKind.Untracked
    )
      return false
    if (
      changesFilter.isModifiedFile &&
      file.status.kind !== AppFileStatusKind.Modified
    )
      return false
    if (
      changesFilter.isDeletedFile &&
      file.status.kind !== AppFileStatusKind.Deleted
    )
      return false
    return true
  }
  const normalizedFilterText = changesFilter.filterText.trim().toLowerCase()
  const visibleFiles = files.filter(file => {
    if (!matchesStatusFilters(file)) return false
    if (!normalizedFilterText) return true
    return `${file.path} ${file.status.kind}`
      .toLowerCase()
      .includes(normalizedFilterText)
  })
  const items: ReadonlyArray<DesktopChangedFileListItem> = visibleFiles.map(
    file => ({
      file,
      id: file.id,
      text: [file.path, file.status.kind],
    })
  )
  const selectedItem =
    items.find(item => item.file.path === props.state.selectedFilePath) || null
  const visibleFilePaths = visibleFiles.map(file => file.path)
  const hiddenIncludedFileCount = selectedFiles.filter(
    file => !visibleFilePaths.includes(file)
  ).length

  const setFilterOption = (
    option:
      | 'isIncludedInCommit'
      | 'isExcludedFromCommit'
      | 'isNewFile'
      | 'isModifiedFile'
      | 'isDeletedFile'
  ) => props.dispatcher.setChangesFilterOption(option, !changesFilter[option])

  const selectedChange =
    files.find(file => file.path === props.state.selectedFilePath) || null
  const selectedRowFiles = selectedChangePaths
    .map(path => files.find(file => file.path === path))
    .filter((file): file is WorkingDirectoryFileChange => file !== undefined)
  const actionFiles = selectedRowFiles.length
    ? selectedRowFiles
    : selectedChange
    ? [selectedChange]
    : []
  const actionFilePaths = actionFiles.map(file => file.path)
  const activeChange = selectedChange || selectedRowFiles[0] || null
  const selectedExtension = activeChange ? pathExtension(activeChange.path) : ''
  const canIgnoreSelectedFile =
    activeChange !== null && pathBasename(activeChange.path) !== '.gitignore'

  if (props.mode === 'sidebar') {
    return (
      <section className="panel">
        <div className="changes-list-container">
          <div className="header">
            <div className="web-changes-actions">
              <Button
                disabled={props.state.loading}
                onClick={() => setCommitDialogOpen(true)}
              >
                Commit
              </Button>
              <Button
                disabled={selectedFiles.length === 0 || props.state.loading}
                onClick={() => setDiscardDialogOpen(true)}
              >
                Discard
              </Button>
              <Button
                disabled={selectedRowFiles.length === 0 || props.state.loading}
                onClick={() =>
                  props.dispatcher.setAllVisibleFilesIncluded(
                    actionFilePaths,
                    true
                  )
                }
              >
                Include selected
              </Button>
              <Button
                disabled={selectedRowFiles.length === 0 || props.state.loading}
                onClick={() =>
                  props.dispatcher.setAllVisibleFilesIncluded(
                    actionFilePaths,
                    false
                  )
                }
              >
                Exclude selected
              </Button>
              <Button
                disabled={selectedRowFiles.length === 0 || props.state.loading}
                onClick={() =>
                  void props.dispatcher.copyPaths(actionFilePaths, false)
                }
              >
                Copy selected paths
              </Button>
              <Button
                disabled={selectedRowFiles.length === 0 || props.state.loading}
                onClick={() =>
                  void props.dispatcher.copyPaths(actionFilePaths, true)
                }
              >
                Copy selected relative paths
              </Button>
              <Button
                disabled={selectedRowFiles.length === 0 || props.state.loading}
                onClick={() => setSelectedStashDialogOpen(true)}
              >
                Stash selected
              </Button>
              <Button
                disabled={visibleFiles.length === 0 || props.state.loading}
                onClick={() =>
                  props.dispatcher.setAllVisibleFilesIncluded(
                    visibleFilePaths,
                    true
                  )
                }
              >
                Include visible
              </Button>
              <Button
                disabled={visibleFiles.length === 0 || props.state.loading}
                onClick={() =>
                  props.dispatcher.setAllVisibleFilesIncluded(
                    visibleFilePaths,
                    false
                  )
                }
              >
                Exclude visible
              </Button>
            </div>
          </div>
          {props.showChangesFilter ? (
            <div
              aria-label="Changes filters"
              className="web-changes-filter-options"
              role="group"
            >
              {(
                [
                  ['isIncludedInCommit', 'Included'],
                  ['isExcludedFromCommit', 'Excluded'],
                  ['isNewFile', 'New'],
                  ['isModifiedFile', 'Modified'],
                  ['isDeletedFile', 'Deleted'],
                ] as const
              ).map(([option, label]) => (
                <Button
                  ariaPressed={changesFilter[option]}
                  className={changesFilter[option] ? 'selected' : undefined}
                  key={option}
                  onClick={() => setFilterOption(option)}
                >
                  {label}
                </Button>
              ))}
              <Button
                disabled={
                  changesFilter.filterText === '' &&
                  !changesFilter.isIncludedInCommit &&
                  !changesFilter.isExcludedFromCommit &&
                  !changesFilter.isNewFile &&
                  !changesFilter.isModifiedFile &&
                  !changesFilter.isDeletedFile
                }
                onClick={() => {
                  props.dispatcher.setChangesFilterText('')
                  ;(
                    [
                      'isIncludedInCommit',
                      'isExcludedFromCommit',
                      'isNewFile',
                      'isModifiedFile',
                      'isDeletedFile',
                    ] as const
                  ).forEach(option =>
                    props.dispatcher.setChangesFilterOption(option, false)
                  )
                }}
              >
                Clear filters
              </Button>
            </div>
          ) : null}
          <div className="filter-list changes-list">
            {props.showChangesFilter ? (
              <>
                <label htmlFor="web-changes-filter">Filter changed files</label>
                <input
                  id="web-changes-filter"
                  onChange={event =>
                    props.dispatcher.setChangesFilterText(event.target.value)
                  }
                  placeholder="Filter"
                  type="search"
                  value={changesFilter.filterText}
                />
              </>
            ) : null}
            {items.length ? (
              <List
                ariaLabel="Changed files"
                invalidationProps={{
                  selectedFilePath: props.state.selectedFilePath,
                  selectedChangePaths,
                  includedFiles: props.state.includedFiles,
                  fileSelections: props.state.fileSelections,
                  status: props.state.status,
                }}
                onRowClick={row => {
                  const item = items[row]
                  if (item) void props.dispatcher.selectFile(item.file.path)
                }}
                onSelectionChanged={rows => {
                  const paths = rows
                    .map(row => items[row]?.file.path)
                    .filter((path): path is string => path !== undefined)
                  setSelectedChangePaths(paths)
                  const first = items[rows[0] || 0]
                  if (first) void props.dispatcher.selectFile(first.file.path)
                }}
                rowCount={items.length}
                rowHeight={29}
                rowRenderer={row => {
                  const item = items[row]
                  return (
                    <ChangedFile
                      availableWidth={props.availableWidth}
                      checkboxTooltip={undefined}
                      disableSelection={false}
                      file={item.file}
                      focused={item.file.path === props.state.selectedFilePath}
                      include={
                        item.file.selection.getSelectionType() ===
                        DiffSelectionType.All
                          ? true
                          : item.file.selection.getSelectionType() ===
                            DiffSelectionType.None
                          ? false
                          : null
                      }
                      onIncludeChanged={(file, included) =>
                        props.dispatcher.setFileIncluded(file.path, included)
                      }
                    />
                  )
                }}
                selectedRows={items.flatMap((item, index) =>
                  selectedChangePaths.includes(item.file.path) ? [index] : []
                )}
                onScroll={
                  props.mode === 'sidebar'
                    ? scrollTop => {
                        setChangesScrollTop(scrollTop)
                        localStorage.setItem(
                          changesScrollStorageKey,
                          String(scrollTop)
                        )
                      }
                    : undefined
                }
                setScrollTop={props.mode === 'sidebar' ? changesScrollTop : 0}
                selectionMode="multi"
              />
            ) : (
              <p>No changed files match the filter.</p>
            )}
          </div>
          {activeChange ? (
            <div
              aria-label={`${activeChange.path} actions`}
              className="web-change-context-actions"
              role="group"
            >
              <strong>{activeChange.path}</strong>
              <Button
                disabled={!canIgnoreSelectedFile}
                onClick={() =>
                  void props.dispatcher.appendIgnoreFile([activeChange.path])
                }
              >
                Ignore file
              </Button>
              {selectedExtension ? (
                <Button
                  disabled={!canIgnoreSelectedFile}
                  onClick={() =>
                    void props.dispatcher.appendIgnorePattern([
                      `*${selectedExtension}`,
                    ])
                  }
                >
                  Ignore {selectedExtension} files
                </Button>
              ) : null}
              <Button
                onClick={() =>
                  void props.dispatcher.copyPaths([activeChange.path], false)
                }
              >
                Copy path
              </Button>
              <Button
                onClick={() =>
                  void props.dispatcher.copyPaths([activeChange.path], true)
                }
              >
                Copy relative path
              </Button>
              {selectedFiles.length > 1 ? (
                <>
                  <Button
                    onClick={() =>
                      void props.dispatcher.copyPaths(selectedFiles, false)
                    }
                  >
                    Copy included paths
                  </Button>
                  <Button
                    onClick={() =>
                      void props.dispatcher.copyPaths(selectedFiles, true)
                    }
                  >
                    Copy included relative paths
                  </Button>
                </>
              ) : null}
            </div>
          ) : null}
          {props.showStashedChanges && props.state.branches?.stashes?.length ? (
            <section className="web-inline-stashes" aria-label="Stashes">
              <div className="web-inline-stashes-heading">
                <strong>Stashes</strong>
                <span>{props.state.branches.stashes.length}</span>
              </div>
              <div className="web-inline-stashes-list">
                {props.state.branches.stashes.map(stash => (
                  <div className="web-inline-stash-row" key={stash.stashSha}>
                    <Button
                      className={
                        props.state.inspectedStash?.stashSha === stash.stashSha
                          ? 'selected'
                          : undefined
                      }
                      onClick={() => void props.dispatcher.inspectStash(stash)}
                    >
                      {stash.customName || stash.name} on {stash.branchName}
                    </Button>
                    <Button
                      onClick={() =>
                        props.onStashActionChanged({
                          operation: 'stash-apply',
                          stash,
                        })
                      }
                    >
                      Apply
                    </Button>
                    <Button
                      onClick={() =>
                        props.onStashActionChanged({
                          operation: 'stash-pop',
                          stash,
                        })
                      }
                    >
                      Pop
                    </Button>
                    <Button onClick={() => setStashDialogTarget(stash)}>
                      Rename
                    </Button>
                    <Button
                      className="destructive"
                      onClick={() =>
                        props.onStashActionChanged({
                          operation: 'stash-drop',
                          stash,
                        })
                      }
                    >
                      Drop
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
          {operation || conflictedFiles.length > 0 ? (
            <div className="web-conflict-actions" role="group">
              {operationLabel && operationState?.totalCommitCount ? (
                <p className="web-operation-progress" role="status">
                  {operationLabel} progress: {operationState.position || 1} of{' '}
                  {operationState.totalCommitCount}
                  {operationState.currentCommit
                    ? ` (${operationState.currentCommit.slice(0, 8)})`
                    : ''}
                </p>
              ) : null}
              {conflictedFiles.length > 0 ? (
                <strong>Resolve conflicts</strong>
              ) : null}
              {conflictedFiles.map(file => (
                <div className="web-conflict-row" key={file.path}>
                  <span>{file.path}</span>
                  <Button
                    disabled={props.state.loading}
                    onClick={() =>
                      void props.dispatcher.runOperation('resolve-conflict', {
                        values: [file.path, 'ours'],
                      })
                    }
                  >
                    Use ours
                  </Button>
                  <Button
                    disabled={props.state.loading}
                    onClick={() =>
                      void props.dispatcher.runOperation('resolve-conflict', {
                        values: [file.path, 'theirs'],
                      })
                    }
                  >
                    Use theirs
                  </Button>
                </div>
              ))}
              {operation === 'rebase' ||
              operation === 'cherryPick' ||
              operation === 'merge' ||
              operation === 'revert' ||
              operation === 'squash' ? (
                <Button
                  disabled={props.state.loading}
                  onClick={() =>
                    void props.dispatcher.runOperation(
                      operation === 'rebase'
                        ? 'continue-rebase'
                        : operation === 'cherryPick'
                        ? 'continue-cherry-pick'
                        : 'finish-merge',
                      {}
                    )
                  }
                >
                  Continue operation
                </Button>
              ) : null}
              {operation === 'rebase' ? (
                <Button
                  disabled={props.state.loading}
                  onClick={() =>
                    void props.dispatcher.runOperation('skip-rebase')
                  }
                >
                  Skip current commit
                </Button>
              ) : null}
              {operation === 'rebase' ||
              operation === 'cherryPick' ||
              operation === 'merge' ||
              operation === 'revert' ||
              operation === 'squash' ? (
                <Button
                  disabled={props.state.loading}
                  onClick={() => {
                    if (operation === 'rebase')
                      void props.dispatcher.runOperation('abort-rebase')
                    else if (operation === 'cherryPick')
                      void props.dispatcher.runOperation('abort-cherry-pick')
                    else if (operation === 'squash')
                      void props.dispatcher.runOperation('abort-squash')
                    else void props.dispatcher.runOperation('abort-merge')
                  }}
                >
                  Abort operation
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
        <WebCommitDialog
          commitDialogRequest={props.state.commitDialogRequest}
          commitToAmend={props.state.commitToAmend}
          emoji={props.state.emoji}
          identity={props.state.gitIdentity}
          message={props.state.commitDraft}
          onMessageChanged={props.dispatcher.setCommitDraft}
          onOptionChanged={props.dispatcher.setCommitOption}
          onSpellcheckChanged={props.dispatcher.setCommitSpellcheckEnabled}
          onTrailerTextChanged={props.dispatcher.setCommitTrailerText}
          onDismiss={() => {
            setCommitDialogOpen(false)
            if (props.state.commitToAmend) props.dispatcher.stopAmendingCommit()
          }}
          onStopAmending={props.dispatcher.stopAmendingCommit}
          onConfigureIdentity={() => {
            setCommitDialogOpen(false)
            setGitIdentityDialogOpen(true)
          }}
          onSubmit={async (message, options) => {
            setCommitDialogOpen(false)
            await props.dispatcher.commit(message, options)
          }}
          open={commitDialogOpen}
          hiddenIncludedFileCount={hiddenIncludedFileCount}
          options={props.state.commitOptions}
          selectedFileCount={selectedFiles.length}
          spellcheckEnabled={props.state.commitSpellcheckEnabled}
          showCommitLengthWarning={props.showCommitLengthWarning}
          commitSummaryLengthWarningThreshold={
            props.commitSummaryLengthWarningThreshold
          }
          trailerText={props.state.commitTrailerText}
        />
        <WebGitIdentityDialog
          identity={props.state.gitIdentity}
          onDismiss={() => setGitIdentityDialogOpen(false)}
          onOpenGlobalGitConfig={props.dispatcher.openGlobalGitConfig}
          onSubmit={async (scope, name, email) => {
            await props.dispatcher.configureGitIdentity(scope, name, email)
            setGitIdentityDialogOpen(false)
            setCommitDialogOpen(true)
          }}
          open={gitIdentityDialogOpen}
        />
        <WebConfirmDialog
          confirmLabel={
            discardPermanently ? 'Delete permanently' : 'Discard changes'
          }
          message={
            discardPermanently
              ? 'Permanently delete the selected changes? This cannot be undone.'
              : 'Move the selected changes to Trash when possible. If Trash is unavailable, untracked files will be deleted permanently.'
          }
          onConfirm={async () => {
            await props.dispatcher.discardFiles(
              selectedFiles,
              true,
              discardPermanently
            )
            setDiscardDialogOpen(false)
            setSelectedChangePaths([])
          }}
          onDismiss={() => setDiscardDialogOpen(false)}
          additionalContent={
            <label>
              <input
                checked={discardPermanently}
                onChange={event => {
                  const value = event.target.checked
                  setDiscardPermanently(value)
                  setBoolean(webDiscardPermanentlyStorageKey, value)
                }}
                type="checkbox"
              />
              Permanently delete selected changes by default
            </label>
          }
          open={discardDialogOpen}
          title="Discard changes?"
        />
        <WebStashDialog
          onDismiss={() => setSelectedStashDialogOpen(false)}
          onSubmit={async (message, options) => {
            await props.dispatcher.runOperation('stash', {
              values: actionFilePaths,
              message,
              ...options,
            })
            setSelectedStashDialogOpen(false)
            setSelectedChangePaths([])
          }}
          open={selectedStashDialogOpen}
        />
        <WebTextDialog
          description="Rename the selected stash without changing its contents."
          initialValue={stashDialogTarget?.customName || ''}
          label="Stash name"
          onDismiss={() => setStashDialogTarget(null)}
          onSubmit={async value => {
            if (!stashDialogTarget) return
            await props.dispatcher.runOperation('stash-rename', {
              values: [stashDialogTarget.name],
              customName: value,
            })
            setStashDialogTarget(null)
          }}
          open={stashDialogTarget !== null}
          submitLabel="Rename stash"
          title="Rename stash"
        />
      </section>
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
  const preferences = useWebDiffPresentationPreferences()
  const [canExpandWholeFile, setCanExpandWholeFile] = React.useState(false)
  const [pendingDiscard, setPendingDiscard] = React.useState<{
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

  if (!file || !props.state.selectedRepositoryPath) return null

  return (
    <div className="diff-container">
      <DiffHeader
        canExpandWholeFile={canExpandWholeFile}
        diff={diff}
        hideWhitespaceInDiff={preferences.hideWhitespaceInDiff}
        onHideWhitespaceInDiffChanged={async checked =>
          preferences.onHideWhitespaceInDiffChanged(checked)
        }
        onShowDiffMinimapChanged={preferences.onShowDiffMinimapChanged}
        onShowSideBySideDiffChanged={preferences.onShowSideBySideDiffChanged}
        onShowWholeFileChanged={preferences.onShowWholeFileChanged}
        onWrapDiffLinesChanged={preferences.onWrapDiffLinesChanged}
        path={file.path}
        showDiffMinimap={preferences.showDiffMinimap}
        showSideBySideDiff={preferences.showSideBySideDiff}
        showWholeFile={preferences.showWholeFile}
        status={file.status}
        wrapDiffLines={preferences.wrapDiffLines}
      />
      {sourceFile?.status.submoduleStatus ? (
        <WebSubmoduleActions
          disabled={props.state.loading}
          dispatcher={props.dispatcher}
          filePath={sourceFile.path}
          fullPath={props.state.diff?.fullPath}
          status={sourceFile.status.submoduleStatus}
        />
      ) : null}
      {diff ? (
        <SeamlessDiffSwitcher
          askForConfirmationOnDiscardChanges={true}
          diff={diff}
          file={file}
          externalFileContents={getDesktopFileContents(file, props.state.diff)}
          hideWhitespaceInDiff={preferences.hideWhitespaceInDiff}
          imageDiffType={preferences.imageDiffType}
          onChangeImageDiffType={preferences.onImageDiffTypeChanged}
          onHideWhitespaceInDiffChanged={async checked =>
            preferences.onHideWhitespaceInDiffChanged(checked)
          }
          onOpenBinaryFile={fullPath =>
            void props.dispatcher.openPath(fullPath)
          }
          onOpenSubmodule={fullPath =>
            void props.dispatcher.addRepository(fullPath)
          }
          onDiscardChanges={(discardDiff, selection) => {
            setPendingDiscard({
              diff: discardDiff,
              selection: selection.withSelectableLines(
                getSelectableLines(discardDiff)
              ),
            })
          }}
          onIncludeChanged={
            diff.kind === DiffType.Text ? updateSelection : undefined
          }
          readOnly={diff.kind !== DiffType.Text}
          repository={getDesktopRepository(props.state.selectedRepositoryPath)}
          showDiffCheckMarks={
            preferences.showDiffCheckMarks && diff.kind === DiffType.Text
          }
          showDiffMinimap={preferences.showDiffMinimap}
          showSideBySideDiff={preferences.showSideBySideDiff}
          showWholeFile={preferences.showWholeFile}
          onShowWholeFileChanged={preferences.onShowWholeFileChanged}
          onWholeFileExpansionAvailabilityChanged={canExpandWholeFile =>
            setCanExpandWholeFile(canExpandWholeFile)
          }
          wrapDiffLines={preferences.wrapDiffLines}
        />
      ) : null}
      <WebFileActions
        dispatcher={props.dispatcher}
        fullPath={repositoryFilePath(
          props.state.selectedRepositoryPath,
          file.path
        )}
        openDisabled={file.status.kind === AppFileStatusKind.Deleted}
        path={file.path}
      />
      <WebConfirmDialog
        confirmLabel="Discard selected lines"
        message="Discard the selected lines? This cannot be undone."
        onConfirm={async () => {
          if (!file || !pendingDiscard) return
          const patch = formatPatchToDiscardChanges(
            file.path,
            pendingDiscard.diff,
            pendingDiscard.selection
          )
          if (patch) {
            await props.dispatcher.runOperation('discard-patch', { patch })
          }
          setPendingDiscard(null)
        }}
        onDismiss={() => setPendingDiscard(null)}
        open={pendingDiscard !== null}
        title="Discard selected lines?"
      />
    </div>
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
  const selectedFile =
    props.files.find(file => file.path === props.selectedFilePath) || null
  const file = selectedFile
    ? getDesktopWorkingDirectoryFile(selectedFile)
    : null
  const parsedDiff =
    file && selectedFile?.status.submoduleStatus
      ? getDesktopSubmoduleDiff(selectedFile, props.diff)
      : file
      ? getDesktopDiff(props.diff)
      : null
  const preferences = useWebDiffPresentationPreferences()
  const [canExpandWholeFile, setCanExpandWholeFile] = React.useState(false)

  return (
    <section className="web-stash-inspection" aria-label="Stash inspection">
      <div className="web-tools-section-heading">
        <h3>Inspect stash: {props.stash.customName || props.stash.name}</h3>
        <Button onClick={props.dispatcher.clearStashInspection}>Close</Button>
      </div>
      <div className="web-stash-inspection-grid">
        <div
          className="web-stash-file-list"
          aria-label="Stashed files"
          role="listbox"
        >
          {props.files.length ? (
            props.files.map(stashFile => (
              <Button
                aria-selected={stashFile.path === props.selectedFilePath}
                className={
                  stashFile.path === props.selectedFilePath
                    ? 'selected'
                    : undefined
                }
                key={stashFile.path}
                onClick={() =>
                  void props.dispatcher.selectStashFile(stashFile.path)
                }
                role="option"
              >
                {stashFile.path}
              </Button>
            ))
          ) : (
            <p>
              {props.loading ? 'Loading stashed files…' : 'No stashed files'}
            </p>
          )}
        </div>
        <div className="web-stash-diff">
          {file && parsedDiff ? (
            <>
              {selectedFile?.status.submoduleStatus ? (
                <WebSubmoduleActions
                  disabled={props.loading}
                  dispatcher={props.dispatcher}
                  filePath={selectedFile.path}
                  fullPath={props.diff?.fullPath}
                  status={selectedFile.status.submoduleStatus}
                />
              ) : null}
              <DiffHeader
                canExpandWholeFile={canExpandWholeFile}
                diff={parsedDiff}
                hideWhitespaceInDiff={preferences.hideWhitespaceInDiff}
                onHideWhitespaceInDiffChanged={async checked =>
                  preferences.onHideWhitespaceInDiffChanged(checked)
                }
                onShowDiffMinimapChanged={preferences.onShowDiffMinimapChanged}
                onShowSideBySideDiffChanged={
                  preferences.onShowSideBySideDiffChanged
                }
                onShowWholeFileChanged={preferences.onShowWholeFileChanged}
                onWrapDiffLinesChanged={preferences.onWrapDiffLinesChanged}
                path={file.path}
                showDiffMinimap={preferences.showDiffMinimap}
                showSideBySideDiff={preferences.showSideBySideDiff}
                showWholeFile={preferences.showWholeFile}
                status={file.status}
                wrapDiffLines={preferences.wrapDiffLines}
              />
              <SeamlessDiffSwitcher
                diff={parsedDiff}
                file={file}
                externalFileContents={getDesktopFileContents(file, props.diff)}
                hideWhitespaceInDiff={preferences.hideWhitespaceInDiff}
                imageDiffType={preferences.imageDiffType}
                onChangeImageDiffType={preferences.onImageDiffTypeChanged}
                onHideWhitespaceInDiffChanged={async checked =>
                  preferences.onHideWhitespaceInDiffChanged(checked)
                }
                onOpenBinaryFile={fullPath =>
                  void props.dispatcher.openPath(fullPath)
                }
                onOpenSubmodule={fullPath =>
                  void props.dispatcher.addRepository(fullPath)
                }
                readOnly={true}
                repository={getDesktopRepository(props.repositoryPath)}
                showDiffCheckMarks={false}
                showDiffMinimap={preferences.showDiffMinimap}
                showSideBySideDiff={preferences.showSideBySideDiff}
                showWholeFile={preferences.showWholeFile}
                onShowWholeFileChanged={preferences.onShowWholeFileChanged}
                onWholeFileExpansionAvailabilityChanged={setCanExpandWholeFile}
                wrapDiffLines={preferences.wrapDiffLines}
              />
              <WebFileActions
                dispatcher={props.dispatcher}
                fullPath={repositoryFilePath(props.repositoryPath, file.path)}
                openDisabled={file.status.kind === AppFileStatusKind.Deleted}
                path={file.path}
              />
            </>
          ) : (
            <p>Select a stashed file to inspect its diff.</p>
          )}
        </div>
      </div>
    </section>
  )
}

function WebWorktreeList(props: {
  readonly worktrees: ReadonlyArray<WebWorktree>
  readonly selectedRepositoryPath: string
  readonly onOpen: (path: string) => void
  readonly onMove: (worktree: WebWorktree) => void
  readonly onRemove: (worktree: WebWorktree) => void
  readonly onPrune: (worktree: WebWorktree) => void
  readonly onCopyPath: (path: string) => void
  readonly onRevealPath: (path: string) => void
  readonly onOpenInNewWindow: (path: string) => void
}) {
  const [filterText, setFilterText] = React.useState('')
  const normalizedFilterText = filterText.trim().toLowerCase()
  const filtered = props.worktrees.filter(worktree =>
    `${worktree.path} ${worktree.branch || ''} ${worktree.head}`
      .toLowerCase()
      .includes(normalizedFilterText)
  )
  const main = filtered.filter(worktree => worktree.type === 'main')
  const linked = filtered.filter(worktree => worktree.type === 'linked')
  const renderWorktree = (worktree: WebWorktree) => {
    const isMain = worktree.type === 'main'
    const canForceRemove = worktree.isLocked || worktree.isDirty !== false
    const showWorktreeContextMenu = () => {
      const items: IMenuItem[] = [
        {
          label: 'Open worktree in new window',
          action: () => props.onOpenInNewWindow(worktree.path),
        },
        { type: 'separator' },
        {
          label: 'Copy worktree name',
          action: () => props.onCopyPath(pathName(worktree.path)),
        },
        {
          label: 'Copy worktree path',
          action: () => props.onCopyPath(worktree.path),
        },
      ]
      if (!isMain) {
        items.push(
          { type: 'separator' },
          {
            label: 'Rename worktree',
            action: () => props.onMove(worktree),
            enabled: !worktree.isLocked,
          },
          {
            label: canForceRemove ? 'Force remove worktree' : 'Remove worktree',
            action: () => props.onRemove(worktree),
          }
        )
      }
      void showContextualMenu(items)
    }
    return (
      <div
        className="web-tool-row"
        key={worktree.path}
        onContextMenu={event => {
          event.preventDefault()
          showWorktreeContextMenu()
        }}
      >
        <span title={worktree.path}>
          {worktree.branch?.replace(/^refs\/heads\//, '') ||
            worktree.head.slice(0, 8)}
          : {worktree.path}
          {worktree.isLocked ? ' (locked)' : ''}
          {worktree.isPrunable ? ' (prunable)' : ''}
          {worktree.isDirty ? ' (has changes)' : ''}
        </span>
        <Button
          disabled={worktree.path === props.selectedRepositoryPath}
          onClick={() => props.onOpen(worktree.path)}
        >
          Open
        </Button>
        <Button onClick={() => props.onCopyPath(worktree.path)}>
          Copy path
        </Button>
        <Button onClick={() => props.onRevealPath(worktree.path)}>
          Reveal in Finder
        </Button>
        {!isMain ? (
          <>
            <Button
              disabled={worktree.isLocked}
              onClick={() => props.onMove(worktree)}
            >
              Rename
            </Button>
            {worktree.isPrunable ? (
              <Button
                className="destructive"
                onClick={() => props.onPrune(worktree)}
              >
                Prune
              </Button>
            ) : (
              <Button
                className="destructive"
                onClick={() => props.onRemove(worktree)}
              >
                {canForceRemove ? 'Force remove' : 'Remove'}
              </Button>
            )}
          </>
        ) : null}
      </div>
    )
  }
  const renderGroup = (label: string, worktrees: ReadonlyArray<WebWorktree>) =>
    worktrees.length ? (
      <React.Fragment key={label}>
        <div className="web-tools-section-heading">
          <strong>{label}</strong>
          <span>{worktrees.length}</span>
        </div>
        {worktrees.map(renderWorktree)}
      </React.Fragment>
    ) : null

  return (
    <>
      <label htmlFor="web-worktree-filter">Filter worktrees</label>
      <input
        id="web-worktree-filter"
        onChange={event => setFilterText(event.target.value)}
        placeholder="Filter"
        type="search"
        value={filterText}
      />
      {renderGroup('Main worktree', main)}
      {renderGroup('Linked worktrees', linked)}
      {!filtered.length ? <p>No worktrees match the filter.</p> : null}
    </>
  )
}

function BranchActionMenu(props: {
  readonly branches: ReadonlyArray<WebBranch>
  readonly currentBranch: string
  readonly currentBranchUpstream: string | null
  readonly defaultBranch: string | null
  readonly dispatcher: WebDispatcher
  readonly hasUncommittedChanges: boolean
  readonly mergedBranches: ReadonlyArray<WebBranch>
  readonly onClose: () => void
  readonly onRequestedActionHandled?: () => void
  readonly onCheckout: (branch: WebBranch, options: WebOperationOptions) => void
  readonly pullStrategy: WebPullStrategy
  readonly requestedAction?: 'merge' | 'squash-merge' | 'rebase'
}) {
  const [dialog, setDialog] = React.useState<
    'merge' | 'squash-merge' | 'rebase' | 'cherry-pick' | null
  >(null)
  const [value, setValue] = React.useState('')
  const [branchToDelete, setBranchToDelete] = React.useState<string | null>(
    null
  )
  const [deleteMergedBranchesOpen, setDeleteMergedBranchesOpen] =
    React.useState(false)
  const [resetUpstreamOpen, setResetUpstreamOpen] = React.useState(false)
  const [resetUpstreamStrategy, setResetUpstreamStrategy] =
    React.useState<WebResetUpstreamStrategy>(() =>
      localStorage.getItem(webResetUpstreamStrategyStorageKey) === 'cancel'
        ? 'cancel'
        : 'stash'
    )
  const localBranches = props.branches.filter(
    branch => branch.type !== 'Remote' && branch.name !== props.currentBranch
  )
  const remoteBranches = props.branches.filter(
    branch => branch.type === 'Remote' && !branch.name.endsWith('/HEAD')
  )
  const selectedBranch = localBranches.find(branch => branch.name === value)
  const [remoteBranchToDelete, setRemoteBranchToDelete] = React.useState<{
    readonly remote: string
    readonly branch: string
    readonly label: string
  } | null>(null)
  const [remoteBranchToCheckout, setRemoteBranchToCheckout] = React.useState<{
    readonly branch: WebBranch
    readonly remoteBranch: string
    readonly branchName: string
  } | null>(null)
  const [worktreeBranch, setWorktreeBranch] = React.useState<WebBranch | null>(
    null
  )
  const remoteBranchNameError = remoteBranchToCheckout
    ? validateGitRefName(remoteBranchToCheckout.branchName, 'Local branch name')
    : null
  const handledRequestedAction = React.useRef<
    'merge' | 'squash-merge' | 'rebase' | null
  >(null)
  React.useEffect(() => {
    if (!props.requestedAction) {
      handledRequestedAction.current = null
      return
    }
    if (handledRequestedAction.current === props.requestedAction) return
    if (!localBranches.length) {
      handledRequestedAction.current = props.requestedAction
      props.onRequestedActionHandled?.()
      return
    }
    handledRequestedAction.current = props.requestedAction
    setDialog(props.requestedAction)
    setValue(localBranches[0]?.name || '')
    props.onRequestedActionHandled?.()
  }, [
    props.onRequestedActionHandled,
    props.requestedAction,
    localBranches.length,
    localBranches[0]?.name,
  ])

  const showBranchContextMenu = (branch: WebBranch) => {
    const isRemote = branch.type === 'Remote'
    const remoteSeparator = branch.name.indexOf('/')
    const remote =
      isRemote && remoteSeparator > 0
        ? branch.name.slice(0, remoteSeparator)
        : null
    const remoteBranch =
      isRemote && remoteSeparator > 0
        ? branch.name.slice(remoteSeparator + 1)
        : branch.name
    const localBranch = isRemote
      ? props.branches.find(
          candidate =>
            candidate.type !== 'Remote' && candidate.name === remoteBranch
        )
      : branch
    void showContextualMenu([
      {
        label: 'Copy branch name',
        action: () => void props.dispatcher.copyText(branch.name),
      },
      {
        label: isRemote ? 'Checkout remote branch' : 'Switch to branch',
        action: () =>
          props.onCheckout(
            branch,
            isRemote && !localBranch
              ? { values: [branch.name], createLocalBranch: remoteBranch }
              : { values: [isRemote ? remoteBranch : branch.name] }
          ),
        enabled: branch.name !== props.currentBranch,
      },
      {
        label: 'Checkout in new worktree',
        action: () => setWorktreeBranch(branch),
      },
      {
        label: 'Pull branch',
        action: () =>
          void props.dispatcher.runOperation(
            isRemote ? 'fetch' : 'fast-forward',
            isRemote
              ? { values: remote ? [remote] : [] }
              : { values: [branch.name] }
          ),
        enabled: isRemote
          ? Boolean(remote)
          : Boolean(branch.upstream) && !branch.isGone,
      },
      {
        label: 'Set as default branch',
        action: () =>
          void props.dispatcher
            .setRepositoryDefaultBranch(isRemote ? remoteBranch : branch.name)
            .then(() => undefined),
        enabled: !isRemote && branch.name !== props.defaultBranch,
      },
      {
        type: 'separator',
      },
      {
        label: isRemote ? 'Delete remote branch' : 'Delete branch',
        action: () => {
          if (isRemote && remote) {
            setRemoteBranchToDelete({
              remote,
              branch: remoteBranch,
              label: branch.name,
            })
          } else if (!isRemote) {
            setBranchToDelete(branch.name)
          }
        },
        enabled: isRemote
          ? Boolean(remote)
          : branch.name !== props.currentBranch,
      },
    ])
  }

  const submit = async () => {
    if (!selectedBranch) return
    const operation =
      dialog === 'merge'
        ? 'merge'
        : dialog === 'squash-merge'
        ? 'squash-merge'
        : dialog === 'rebase'
        ? 'rebase'
        : 'cherry-pick'
    await props.dispatcher.runOperation(operation, {
      values: [selectedBranch.tip?.sha || selectedBranch.name],
    })
    props.onClose()
    setDialog(null)
    setValue('')
  }

  const operationDescription =
    dialog === 'merge'
      ? `Merge ${selectedBranch?.name || 'the selected branch'} into ${
          props.currentBranch
        }. Git may create a merge commit and conflicts remain available in Changes.`
      : dialog === 'squash-merge'
      ? `Squash ${selectedBranch?.name || 'the selected branch'} into ${
          props.currentBranch
        } as one commit. Conflicts remain available in Changes for explicit resolution or abort.`
      : dialog === 'rebase'
      ? `Rebase ${props.currentBranch} onto ${
          selectedBranch?.name || 'the selected branch'
        }. This rewrites the current branch commits; conflicts remain available in Changes.`
      : `Cherry-pick the tip of ${
          selectedBranch?.name || 'the selected branch'
        } onto ${
          props.currentBranch
        }. Conflicts remain available in Changes for explicit resolution or abort.`

  return (
    <>
      <div className="web-toolbar-menu">
        <Button
          disabled={
            props.currentBranch === 'No branch' ||
            props.currentBranchUpstream === null
          }
          onClick={() => {
            props.onClose()
            void props.dispatcher.runOperation('pull', {
              pullStrategy: props.pullStrategy,
            })
          }}
        >
          Pull {props.currentBranch}
        </Button>
        <Button
          disabled={
            props.currentBranch === 'No branch' ||
            props.currentBranchUpstream === null
          }
          onClick={() => {
            setResetUpstreamOpen(true)
          }}
        >
          Reset and pull
        </Button>
        <Button
          disabled={
            props.currentBranch === 'No branch' ||
            props.currentBranch === props.defaultBranch
          }
          onClick={() => {
            void props.dispatcher
              .setRepositoryDefaultBranch(props.currentBranch)
              .then(props.onClose)
          }}
        >
          Set {props.currentBranch} as default branch
        </Button>
        <Button
          disabled={!localBranches.length}
          onClick={() => {
            setDialog('merge')
            setValue(localBranches[0]?.name || '')
          }}
        >
          Merge branch
        </Button>
        <Button
          disabled={!localBranches.length}
          onClick={() => {
            setDialog('squash-merge')
            setValue(localBranches[0]?.name || '')
          }}
        >
          Squash merge branch
        </Button>
        <Button
          disabled={!localBranches.length}
          onClick={() => {
            setDialog('rebase')
            setValue(localBranches[0]?.name || '')
          }}
        >
          Rebase onto branch
        </Button>
        <Button
          disabled={!localBranches.length}
          onClick={() => {
            setDialog('cherry-pick')
            setValue(localBranches[0]?.name || '')
          }}
        >
          Cherry-pick branch tip
        </Button>
        <Button
          disabled={!props.mergedBranches.length}
          onClick={() => setDeleteMergedBranchesOpen(true)}
        >
          Delete unused local branches
        </Button>
        {localBranches.map(branch => (
          <React.Fragment key={branch.name}>
            <Button
              onContextMenu={event => {
                event.preventDefault()
                showBranchContextMenu(branch)
              }}
              onClick={() => {
                props.onCheckout(branch, { values: [branch.name] })
              }}
            >
              Switch to {branch.name}
            </Button>
            <Button
              disabled={!branch.upstream || branch.isGone}
              onClick={() => {
                props.onClose()
                void props.dispatcher.runOperation('fast-forward', {
                  values: [branch.name],
                })
              }}
            >
              Pull {branch.name}
            </Button>
            <Button
              disabled={branch.name === props.defaultBranch}
              onClick={() => {
                props.onClose()
                void props.dispatcher
                  .setRepositoryDefaultBranch(branch.name)
                  .then(() => undefined)
              }}
            >
              Set {branch.name} as default branch
            </Button>
            <Button
              onClick={() => {
                setWorktreeBranch(branch)
              }}
            >
              Checkout {branch.name} in new worktree
            </Button>
            <Button
              className="destructive"
              onClick={() => {
                setBranchToDelete(branch.name)
              }}
            >
              Delete {branch.name}
            </Button>
          </React.Fragment>
        ))}
        {remoteBranches.map(branch => {
          const separator = branch.name.indexOf('/')
          const remote = separator > 0 ? branch.name.slice(0, separator) : ''
          const remoteBranch =
            separator > 0 ? branch.name.slice(separator + 1) : branch.name
          const localExists = props.branches.some(
            candidate =>
              candidate.type !== 'Remote' && candidate.name === remoteBranch
          )
          return (
            <React.Fragment key={branch.name}>
              {!localExists ? (
                <Button
                  onContextMenu={event => {
                    event.preventDefault()
                    showBranchContextMenu(branch)
                  }}
                  onClick={() => {
                    setRemoteBranchToCheckout({
                      branch,
                      remoteBranch: branch.name,
                      branchName: remoteBranch,
                    })
                  }}
                >
                  Checkout {branch.name}
                </Button>
              ) : null}
              <Button
                onContextMenu={event => {
                  event.preventDefault()
                  showBranchContextMenu(branch)
                }}
                className="destructive"
                onClick={() => {
                  setRemoteBranchToDelete({
                    remote,
                    branch: remoteBranch,
                    label: branch.name,
                  })
                }}
              >
                Delete remote {branch.name}
              </Button>
              <Button
                onContextMenu={event => {
                  event.preventDefault()
                  showBranchContextMenu(branch)
                }}
                onClick={() => {
                  setWorktreeBranch(branch)
                }}
              >
                Checkout {branch.name} in new worktree
              </Button>
            </React.Fragment>
          )
        })}
      </div>
      {dialog ? (
        <DialogStackContext.Provider value={{ isTopMost: true }}>
          <Dialog
            ariaDescribedBy="branch-action-description"
            onDismissed={() => {
              setDialog(null)
              setValue('')
            }}
            onSubmit={() => void submit()}
            title={
              dialog === 'merge'
                ? 'Merge branch'
                : dialog === 'squash-merge'
                ? 'Squash merge branch'
                : dialog === 'rebase'
                ? 'Rebase onto branch'
                : 'Cherry-pick branch tip'
            }
          >
            <DialogContent>
              <p id="branch-action-description">Choose a local branch.</p>
              <label htmlFor="web-branch-action">Branch</label>
              <select
                id="web-branch-action"
                onChange={event => setValue(event.target.value)}
                value={value}
              >
                {localBranches.map(branch => (
                  <option key={branch.name} value={branch.name}>
                    {branch.name}
                  </option>
                ))}
              </select>
              <p aria-label="Branch operation preflight" role="status">
                {operationDescription}
              </p>
            </DialogContent>
            <DialogFooter>
              <Button onClick={() => setDialog(null)}>Cancel</Button>
              <Button disabled={!selectedBranch} onClick={() => void submit()}>
                Continue
              </Button>
            </DialogFooter>
          </Dialog>
        </DialogStackContext.Provider>
      ) : null}
      {remoteBranchToCheckout ? (
        <DialogStackContext.Provider value={{ isTopMost: true }}>
          <Dialog
            ariaDescribedBy="remote-branch-checkout-description"
            onDismissed={() => setRemoteBranchToCheckout(null)}
            onSubmit={() => {
              const target = remoteBranchToCheckout
              if (remoteBranchNameError) return
              props.onCheckout(target.branch, {
                values: [target.remoteBranch],
                createLocalBranch: target.branchName.trim(),
              })
              setRemoteBranchToCheckout(null)
            }}
            title="Checkout remote branch"
          >
            <DialogContent>
              <p id="remote-branch-checkout-description">
                Create a local branch that tracks{' '}
                {remoteBranchToCheckout.remoteBranch}.
              </p>
              <label htmlFor="remote-branch-name">Local branch name</label>
              <input
                autoFocus={true}
                id="remote-branch-name"
                onChange={event =>
                  setRemoteBranchToCheckout({
                    ...remoteBranchToCheckout,
                    branchName: event.target.value,
                  })
                }
                type="text"
                value={remoteBranchToCheckout.branchName}
              />
              {remoteBranchNameError ? (
                <p role="alert">{remoteBranchNameError}</p>
              ) : null}
            </DialogContent>
            <DialogFooter>
              <Button onClick={() => setRemoteBranchToCheckout(null)}>
                Cancel
              </Button>
              <Button
                disabled={Boolean(remoteBranchNameError)}
                onClick={() => {
                  const target = remoteBranchToCheckout
                  if (remoteBranchNameError) return
                  props.onCheckout(target.branch, {
                    values: [target.remoteBranch],
                    createLocalBranch: target.branchName.trim(),
                  })
                  setRemoteBranchToCheckout(null)
                }}
              >
                Checkout branch
              </Button>
            </DialogFooter>
          </Dialog>
        </DialogStackContext.Provider>
      ) : null}
      <WebWorktreeDialog
        initialBranch={worktreeBranch}
        onChooseDirectory={() => props.dispatcher.chooseDirectory()}
        onDismiss={() => setWorktreeBranch(null)}
        onSubmit={async (path, branch) => {
          if (!worktreeBranch) return
          const localBranchName =
            worktreeBranch.type === 'Remote'
              ? worktreeBranch.name.split('/').slice(1).join('/')
              : worktreeBranch.name
          const localBranchExists = props.branches.some(
            candidate =>
              candidate.type !== 'Remote' && candidate.name === localBranchName
          )
          await props.dispatcher.runOperation('worktree-add', {
            values: [path],
            worktreePath: path,
            ...(worktreeBranch.type === 'Remote' && !localBranchExists
              ? {
                  createBranch: branch,
                  commitish: worktreeBranch.name,
                }
              : {
                  commitish:
                    worktreeBranch.type === 'Remote'
                      ? localBranchName
                      : worktreeBranch.name,
                }),
          })
          await props.dispatcher.addRepository(path)
          setWorktreeBranch(null)
        }}
        open={worktreeBranch !== null}
      />
      <WebConfirmDialog
        confirmLabel={
          props.hasUncommittedChanges && resetUpstreamStrategy === 'stash'
            ? 'Stash changes and reset'
            : props.hasUncommittedChanges
            ? 'Cancel reset'
            : 'Reset and pull'
        }
        message={
          props.hasUncommittedChanges && resetUpstreamStrategy === 'stash'
            ? `Your uncommitted changes will be stashed before ${props.currentBranch} is reset to ${props.currentBranchUpstream}. Local commits that are not on the upstream branch will be discarded.`
            : props.hasUncommittedChanges
            ? `Reset and pull will not run while ${props.currentBranch} has uncommitted changes. Leave the changes untouched and cancel this operation, or choose the stash option.`
            : `Reset ${props.currentBranch} to ${props.currentBranchUpstream}? Local commits that are not on the upstream branch will be discarded.`
        }
        additionalContent={
          props.hasUncommittedChanges ? (
            <fieldset
              aria-label="Reset and pull change strategy"
              className="web-dialog-options"
            >
              <legend>When uncommitted changes exist</legend>
              <label>
                <input
                  checked={resetUpstreamStrategy === 'stash'}
                  name="web-reset-upstream-strategy"
                  onChange={() => {
                    setResetUpstreamStrategy('stash')
                    localStorage.setItem(
                      webResetUpstreamStrategyStorageKey,
                      'stash'
                    )
                  }}
                  type="radio"
                />
                Stash changes before resetting
              </label>
              <label>
                <input
                  checked={resetUpstreamStrategy === 'cancel'}
                  name="web-reset-upstream-strategy"
                  onChange={() => {
                    setResetUpstreamStrategy('cancel')
                    localStorage.setItem(
                      webResetUpstreamStrategyStorageKey,
                      'cancel'
                    )
                  }}
                  type="radio"
                />
                Leave changes untouched and cancel
              </label>
            </fieldset>
          ) : null
        }
        onConfirm={async () => {
          if (
            props.hasUncommittedChanges &&
            resetUpstreamStrategy === 'cancel'
          ) {
            setResetUpstreamOpen(false)
            props.onClose()
            return
          }
          if (props.hasUncommittedChanges)
            await props.dispatcher.runOperation('stash', {
              message: 'Changes before reset and pull',
            })
          await props.dispatcher.runOperation('reset-upstream', {
            confirmed: true,
          })
          setResetUpstreamOpen(false)
          props.onClose()
        }}
        onDismiss={() => {
          setResetUpstreamOpen(false)
          props.onClose()
        }}
        open={resetUpstreamOpen}
        title="Reset and pull?"
      />
      <WebConfirmDialog
        confirmLabel="Delete branches"
        message={`Delete ${props.mergedBranches.length} merged local ${
          props.mergedBranches.length === 1 ? 'branch' : 'branches'
        }? Only branches that are already merged into ${
          props.currentBranch
        } and are not checked out in another worktree are included: ${props.mergedBranches
          .map(branch => branch.name)
          .join(', ')}. This cannot be undone.`}
        onConfirm={async () => {
          await props.dispatcher.runOperation('delete-branches', {
            confirmed: true,
            values: props.mergedBranches.map(branch => branch.name),
          })
          setDeleteMergedBranchesOpen(false)
          props.onClose()
        }}
        onDismiss={() => setDeleteMergedBranchesOpen(false)}
        open={deleteMergedBranchesOpen}
        title="Delete unused local branches?"
      />
      <WebConfirmDialog
        confirmLabel="Delete branch"
        message={`Delete the local branch ${branchToDelete}? Its unmerged commits will be permanently removed.`}
        onConfirm={async () => {
          if (!branchToDelete) return
          await props.dispatcher.runOperation('delete-branch', {
            values: [branchToDelete],
            confirmed: true,
          })
          setBranchToDelete(null)
          props.onClose()
        }}
        onDismiss={() => setBranchToDelete(null)}
        open={branchToDelete !== null}
        title="Delete branch?"
      />
      <WebConfirmDialog
        confirmLabel="Delete remote branch"
        message={`Delete ${
          remoteBranchToDelete?.label || 'this remote branch'
        } from the remote repository?`}
        onConfirm={async () => {
          if (!remoteBranchToDelete) return
          await props.dispatcher.runOperation('delete-remote-branch', {
            values: [remoteBranchToDelete.remote, remoteBranchToDelete.branch],
            confirmed: true,
          })
          setRemoteBranchToDelete(null)
          props.onClose()
        }}
        onDismiss={() => setRemoteBranchToDelete(null)}
        open={remoteBranchToDelete !== null}
        title="Delete remote branch?"
      />
    </>
  )
}

function formatWebBytes(value: number) {
  if (!Number.isFinite(value) || value < 1024) return `${Math.max(0, value)} B`
  if (value < 1024 * 1024)
    return `${(value / 1024).toFixed(1).replace(/\.0$/, '')} KB`
  return `${(value / (1024 * 1024)).toFixed(1).replace(/\.0$/, '')} MB`
}

function WebIntegrationsSection(props: {
  readonly state: WebApplicationState
  readonly dispatcher: WebDispatcher
  readonly editorIntegration: WebIntegrationSelection
  readonly shellIntegration: WebIntegrationSelection
}) {
  React.useEffect(() => {
    if (!props.state.integrations) void props.dispatcher.loadIntegrations()
  }, [props.dispatcher, props.state.integrations])

  const integrations = props.state.integrations
  const editorIntegrationError = validateWebCustomIntegration(
    props.editorIntegration,
    'Custom editor'
  )
  const shellIntegrationError = validateWebCustomIntegration(
    props.shellIntegration,
    'Custom shell'
  )
  return (
    <section className="web-tools-section" aria-label="Platform integrations">
      <div className="web-tools-section-heading">
        <h3>Platform integrations</h3>
        <Button
          ariaLabel="Refresh platform integrations"
          onClick={() => void props.dispatcher.loadIntegrations()}
        >
          Refresh
        </Button>
      </div>
      {integrations?.guidance ? (
        <p role="status">{integrations.guidance}</p>
      ) : null}
      <div className="web-integration-group">
        <strong>Editors</strong>
        {integrations?.editors.length ? (
          integrations.editors.map(editor => (
            <div className="web-tool-row" key={`editor:${editor.name}`}>
              <span title={editor.path}>{editor.name}</span>
              <Button
                disabled={props.state.loading}
                onClick={() =>
                  void props.dispatcher.launchIntegration('editor', editor.name)
                }
              >
                Open repository
              </Button>
            </div>
          ))
        ) : (
          <p>
            {integrations ? 'No editors detected.' : 'Discovering editors…'}
          </p>
        )}
        <div className="web-tool-row">
          <span>
            Selected:{' '}
            {props.editorIntegration.custom
              ? props.editorIntegration.custom.path || 'Custom editor'
              : props.editorIntegration.name || 'Automatic'}
          </span>
          <Button
            disabled={props.state.loading || Boolean(editorIntegrationError)}
            onClick={() =>
              void props.dispatcher.launchIntegration(
                'editor',
                props.editorIntegration.name,
                props.editorIntegration.custom
              )
            }
          >
            Open selected editor
          </Button>
        </div>
        {editorIntegrationError ? (
          <p role="alert">{editorIntegrationError}</p>
        ) : null}
      </div>
      <div className="web-integration-group">
        <strong>Shells</strong>
        {integrations?.shells.length ? (
          integrations.shells.map(shell => (
            <div className="web-tool-row" key={`shell:${shell.name}`}>
              <span title={shell.path}>{shell.name}</span>
              <Button
                disabled={props.state.loading}
                onClick={() =>
                  void props.dispatcher.launchIntegration('shell', shell.name)
                }
              >
                Open repository
              </Button>
            </div>
          ))
        ) : (
          <p>{integrations ? 'No shells detected.' : 'Discovering shells…'}</p>
        )}
        <div className="web-tool-row">
          <span>
            Selected:{' '}
            {props.shellIntegration.custom
              ? props.shellIntegration.custom.path || 'Custom shell'
              : props.shellIntegration.name || 'Automatic'}
          </span>
          <Button
            disabled={props.state.loading || Boolean(shellIntegrationError)}
            onClick={() =>
              void props.dispatcher.launchIntegration(
                'shell',
                props.shellIntegration.name,
                props.shellIntegration.custom
              )
            }
          >
            Open selected shell
          </Button>
        </div>
        {shellIntegrationError ? (
          <p role="alert">{shellIntegrationError}</p>
        ) : null}
      </div>
    </section>
  )
}

function WebUpdateSection(props: {
  readonly state: WebApplicationState
  readonly dispatcher: WebDispatcher
}) {
  const [openConfirmation, setOpenConfirmation] = React.useState(false)
  const status = props.state.updateStatus
  const operation = props.state.updateOperation
  const canDownload =
    status?.status === 'available' &&
    (!operation ||
      operation.status === 'cancelled' ||
      operation.status === 'failed' ||
      operation.status === 'opened')
  const canOpen = operation?.status === 'downloaded'
  const progress =
    operation && operation.totalBytes > 0
      ? Math.min(
          100,
          Math.round((operation.downloadedBytes / operation.totalBytes) * 100)
        )
      : operation?.status === 'downloaded'
      ? 100
      : null

  return (
    <>
      <section className="web-tools-section" aria-label="Application updates">
        <div className="web-tools-section-heading">
          <h3>Application updates</h3>
          <Button
            disabled={
              props.state.loading || operation?.status === 'downloading'
            }
            onClick={() => void props.dispatcher.checkForUpdates()}
          >
            Check for updates
          </Button>
        </div>
        {status ? (
          <p role="status">
            {status.message}
            {status.availableVersion
              ? ` Available version: ${status.availableVersion}.`
              : ''}
          </p>
        ) : (
          <p>Updates are checked only when requested.</p>
        )}
        {status?.releaseNotes ? (
          <details>
            <summary>Release notes</summary>
            <p>{status.releaseNotes}</p>
          </details>
        ) : null}
        {canDownload ? (
          <Button onClick={() => void props.dispatcher.downloadUpdate()}>
            Download and verify update
          </Button>
        ) : null}
        {operation ? (
          <div className="web-update-operation" aria-live="polite">
            <p>
              {operation.status === 'downloading'
                ? `Downloading ${operation.artifactName}: ${formatWebBytes(
                    operation.downloadedBytes
                  )} of ${formatWebBytes(operation.totalBytes)}.`
                : operation.status === 'downloaded'
                ? `Verified ${operation.artifactName}.`
                : operation.status === 'cancelled'
                ? 'Update download cancelled.'
                : operation.status === 'opened'
                ? 'Verified update handoff completed.'
                : operation.error || 'Update download failed.'}
            </p>
            {progress !== null ? (
              <progress
                aria-label="Update download progress"
                max={100}
                value={progress}
              />
            ) : null}
            {operation.status === 'downloading' ? (
              <Button
                className="destructive"
                onClick={() => void props.dispatcher.cancelUpdateDownload()}
              >
                Cancel download
              </Button>
            ) : null}
            {canOpen ? (
              <Button onClick={() => setOpenConfirmation(true)}>
                Open verified installer
              </Button>
            ) : null}
          </div>
        ) : null}
      </section>
      <WebConfirmDialog
        confirmLabel="Open verified installer"
        message="Open the verified update artifact with the macOS installer? Desktop Plus will not install or restart itself."
        onConfirm={async () => {
          await props.dispatcher.openDownloadedUpdate(true)
          setOpenConfirmation(false)
        }}
        onDismiss={() => setOpenConfirmation(false)}
        open={openConfirmation}
        title="Open verified update?"
      />
    </>
  )
}

function WebLfsSection(props: {
  readonly state: WebApplicationState
  readonly dispatcher: WebDispatcher
}) {
  const [confirmation, setConfirmation] = React.useState<
    'local' | 'global' | 'repair' | null
  >(null)
  const status = props.state.lfsStatus
  const operation = props.state.lfsOperation

  React.useEffect(() => {
    if (props.state.selectedRepositoryPath && !status)
      void props.dispatcher.loadLfsStatus()
  }, [props.dispatcher, props.state.selectedRepositoryPath, status])

  const confirmLfsAction = async () => {
    if (!confirmation) return
    if (confirmation === 'repair') await props.dispatcher.repairLfs(true)
    else await props.dispatcher.installLfs(confirmation, true)
    setConfirmation(null)
  }

  return (
    <>
      <section className="web-tools-section" aria-label="Git LFS">
        <div className="web-tools-section-heading">
          <h3>Git LFS</h3>
          <Button
            ariaLabel="Refresh Git LFS status"
            onClick={() => void props.dispatcher.loadLfsStatus()}
          >
            Refresh
          </Button>
        </div>
        {status ? (
          <>
            <p role="status">
              {status.available
                ? `Git LFS ${status.version || ''} is available.`
                : 'Git LFS is not installed on this computer.'}
            </p>
            {status.trackedPatterns.length ? (
              <p>Tracked patterns: {status.trackedPatterns.join(', ')}</p>
            ) : (
              <p>No LFS patterns are tracked in this repository.</p>
            )}
            {status.mismatches.map(mismatch => (
              <p key={`${mismatch.kind}:${mismatch.message}`} role="alert">
                {mismatch.message}
              </p>
            ))}
            <div className="web-tools-actions">
              <Button
                disabled={!status.available}
                onClick={() => setConfirmation('local')}
              >
                Install repository filters
              </Button>
              <Button
                disabled={!status.available}
                onClick={() => setConfirmation('global')}
              >
                Install global filters
              </Button>
              <Button
                disabled={!status.available}
                onClick={() => setConfirmation('repair')}
              >
                Repair repository hooks
              </Button>
            </div>
            <div className="web-tools-actions">
              {(['fetch', 'pull', 'push'] as const).map(command => (
                <Button
                  disabled={
                    !status.available || operation?.status === 'running'
                  }
                  key={command}
                  onClick={() =>
                    void props.dispatcher.startLfsTransfer(command)
                  }
                >
                  LFS {command}
                </Button>
              ))}
            </div>
          </>
        ) : (
          <p>Checking Git LFS status…</p>
        )}
        {operation ? (
          <div className="web-lfs-operation" aria-live="polite">
            <p>
              LFS {operation.command} {operation.status}.
              {operation.progress !== null ? ` ${operation.progress}%` : ''}
            </p>
            {operation.progress !== null ? (
              <progress
                aria-label="Git LFS transfer progress"
                max={100}
                value={operation.progress}
              />
            ) : null}
            {operation.output ? (
              <details>
                <summary>Git LFS output</summary>
                <pre className="web-error-output">{operation.output}</pre>
              </details>
            ) : null}
            {operation.status === 'running' ? (
              <Button
                className="destructive"
                onClick={() => void props.dispatcher.cancelLfsTransfer()}
              >
                Cancel LFS transfer
              </Button>
            ) : null}
          </div>
        ) : null}
      </section>
      <WebConfirmDialog
        confirmLabel={
          confirmation === 'repair'
            ? 'Repair hooks'
            : confirmation === 'global'
            ? 'Install globally'
            : 'Install for repository'
        }
        message={
          confirmation === 'repair'
            ? 'Repair Git LFS filters and the repository pre-push hook? This changes Git configuration for the selected repository.'
            : confirmation === 'global'
            ? 'Install Git LFS filters globally for this user? This changes your global Git configuration.'
            : 'Install Git LFS filters for this repository? This changes its local Git configuration.'
        }
        onConfirm={confirmLfsAction}
        onDismiss={() => setConfirmation(null)}
        open={confirmation !== null}
        title="Change Git LFS configuration?"
      />
    </>
  )
}

function WebRepositoryToolsView(props: {
  readonly state: WebApplicationState
  readonly dispatcher: WebDispatcher
  readonly onStashActionChanged: (action: WebStashAction | null) => void
  readonly confirmWorktreeRemoval: boolean
}) {
  const editorIntegration = useWebIntegrationSelection('editor')
  const shellIntegration = useWebIntegrationSelection('shell')
  const branches = props.state.branches
  const stashes = branches?.stashes || []
  const worktrees = branches?.worktrees || []
  const remotes = branches?.remotes || []
  const tags = branches?.tags || []
  const [dialog, setDialog] = React.useState<
    'stash' | 'remote' | 'tag' | 'worktree' | 'worktree-move' | null
  >(null)
  const [target, setTarget] = React.useState<
    WebStash | WebRemote | WebWorktree | null
  >(null)
  const [tagToDelete, setTagToDelete] = React.useState<WebTag | null>(null)
  const [remoteTagToDelete, setRemoteTagToDelete] = React.useState<{
    readonly tag: WebTag
    readonly remotes: ReadonlyArray<string>
  } | null>(null)
  const [confirmation, setConfirmation] = React.useState<{
    readonly title: string
    readonly message: string
    readonly label: string
    readonly operation: WebGitOperation
    readonly values: ReadonlyArray<string>
    readonly force?: boolean
  } | null>(null)
  const [worktreeToMove, setWorktreeToMove] =
    React.useState<WebWorktree | null>(null)
  const close = () => {
    setDialog(null)
    setTarget(null)
  }
  const confirmOperation = async () => {
    if (!confirmation) return
    await props.dispatcher.runOperation(confirmation.operation, {
      values: confirmation.values,
      confirmed: true,
      ...(confirmation.force === undefined
        ? {}
        : { force: confirmation.force }),
    })
    setConfirmation(null)
  }
  const deleteLocalTag = async () => {
    if (!tagToDelete) return
    await props.dispatcher.runOperation('tag-delete', {
      values: [tagToDelete.name],
      confirmed: true,
    })
    if (tagToDelete.pushedRemotes?.length)
      setRemoteTagToDelete({
        tag: tagToDelete,
        remotes: tagToDelete.pushedRemotes,
      })
    setTagToDelete(null)
  }
  const deleteRemoteTag = async () => {
    if (!remoteTagToDelete) return
    for (const remote of remoteTagToDelete.remotes)
      await props.dispatcher.runOperation('delete-remote-tag', {
        values: [remote, remoteTagToDelete.tag.name],
        confirmed: true,
      })
    setRemoteTagToDelete(null)
  }
  const showStashContextMenu = (stash: WebStash) => {
    void showContextualMenu([
      {
        label: 'Inspect stash',
        action: () => void props.dispatcher.inspectStash(stash),
      },
      {
        label: 'Copy stash SHA',
        action: () => void props.dispatcher.copyText(stash.stashSha),
      },
      {
        label: 'Copy stash name',
        action: () => void props.dispatcher.copyText(stash.name),
      },
      {
        label: 'Copy branch name',
        action: () => void props.dispatcher.copyText(stash.branchName),
      },
      { type: 'separator' },
      {
        label: 'Apply stash',
        action: () =>
          props.onStashActionChanged({ operation: 'stash-apply', stash }),
      },
      {
        label: 'Pop stash',
        action: () =>
          props.onStashActionChanged({ operation: 'stash-pop', stash }),
      },
      {
        label: 'Rename stash',
        action: () => {
          setTarget(stash)
          setDialog('stash')
        },
      },
      {
        label: 'Drop stash',
        action: () =>
          props.onStashActionChanged({ operation: 'stash-drop', stash }),
      },
    ])
  }
  const showRemoteContextMenu = (remote: WebRemote) => {
    void showContextualMenu([
      {
        label: 'Copy remote URL',
        action: () => void props.dispatcher.copyText(remote.url),
      },
      {
        label: 'Open remote in browser',
        action: () => {
          if (remote.webURL) props.dispatcher.openExternal(remote.webURL)
        },
        enabled: Boolean(remote.webURL),
      },
      {
        label: 'Set remote URL',
        action: () => {
          setTarget(remote)
          setDialog('remote')
        },
      },
      { type: 'separator' },
      {
        label: 'Remove remote',
        action: () =>
          setConfirmation({
            label: 'Remove remote',
            message: 'Remove this remote configuration from the repository?',
            operation: 'remote-remove',
            title: 'Remove remote?',
            values: [remote.name],
          }),
      },
    ])
  }

  if (!props.state.selectedRepositoryPath) return null

  return (
    <section
      aria-busy={props.state.loading}
      className="web-tools-panel"
      aria-label="Repository tools"
    >
      <div className="web-tools-heading">
        <h2>Repository tools</h2>
        <Button
          ariaLabel="Refresh repository"
          onClick={() => void props.dispatcher.refresh()}
        >
          Refresh
        </Button>
      </div>
      <div className="web-tools-grid">
        <section className="web-tools-section" aria-label="Stashes">
          <div className="web-tools-section-heading">
            <h3>Stashes</h3>
            <Button onClick={() => setDialog('stash')}>Create stash</Button>
          </div>
          {stashes.length ? (
            stashes.map(stash => (
              <div
                className="web-tool-row"
                key={stash.stashSha}
                onContextMenu={event => {
                  event.preventDefault()
                  showStashContextMenu(stash)
                }}
              >
                <span title={stash.name}>
                  {stash.customName || stash.name} on {stash.branchName}
                </span>
                <Button
                  onClick={() => void props.dispatcher.inspectStash(stash)}
                >
                  Inspect
                </Button>
                <Button
                  onClick={() =>
                    props.onStashActionChanged({
                      operation: 'stash-apply',
                      stash,
                    })
                  }
                >
                  Apply
                </Button>
                <Button
                  onClick={() =>
                    props.onStashActionChanged({
                      operation: 'stash-pop',
                      stash,
                    })
                  }
                >
                  Pop
                </Button>
                <Button
                  onClick={() => {
                    setTarget(stash)
                    setDialog('stash')
                  }}
                >
                  Rename
                </Button>
                <Button
                  className="destructive"
                  onClick={() =>
                    props.onStashActionChanged({
                      operation: 'stash-drop',
                      stash,
                    })
                  }
                >
                  Drop
                </Button>
              </div>
            ))
          ) : (
            <p>No stashes</p>
          )}
        </section>
        <section className="web-tools-section" aria-label="Remotes and tags">
          <div className="web-tools-section-heading">
            <h3>Remotes</h3>
            <Button onClick={() => setDialog('remote')}>Add remote</Button>
          </div>
          {remotes.map(remote => (
            <div
              className="web-tool-row"
              key={remote.name}
              onContextMenu={event => {
                event.preventDefault()
                showRemoteContextMenu(remote)
              }}
            >
              <span title={remote.url}>
                {remote.name}: {remote.url}
              </span>
              <Button
                onClick={() => {
                  setTarget(remote)
                  setDialog('remote')
                }}
              >
                Set URL
              </Button>
              <Button
                className="destructive"
                onClick={() =>
                  setConfirmation({
                    label: 'Remove remote',
                    message:
                      'Remove this remote configuration from the repository?',
                    operation: 'remote-remove',
                    title: 'Remove remote?',
                    values: [remote.name],
                  })
                }
              >
                Remove
              </Button>
            </div>
          ))}
          <div className="web-tools-section-heading">
            <h3>Tags</h3>
            <Button onClick={() => setDialog('tag')}>Create tag</Button>
          </div>
          {tags.map(tag => (
            <div className="web-tool-row" key={tag.name}>
              <span
                title={
                  tag.pushedRemotes?.length
                    ? `Pushed to ${tag.pushedRemotes.join(', ')}`
                    : 'Local tag'
                }
              >
                {tag.name}
                {tag.pushedRemotes?.length
                  ? ` (pushed to ${tag.pushedRemotes.join(', ')})`
                  : ' (local only)'}
              </span>
              {!tag.pushedRemotes?.length ? (
                <Button
                  onClick={() =>
                    void props.dispatcher.runOperation('push', {
                      tagsToPush: [tag.name],
                    })
                  }
                >
                  Push tag
                </Button>
              ) : null}
              <Button
                className="destructive"
                onClick={() => setTagToDelete(tag)}
              >
                Delete
              </Button>
            </div>
          ))}
        </section>
        <section className="web-tools-section" aria-label="Worktrees">
          <div className="web-tools-section-heading">
            <h3>Worktrees</h3>
            <Button onClick={() => setDialog('worktree')}>
              Create worktree
            </Button>
          </div>
          <WebWorktreeList
            onCopyPath={path => void props.dispatcher.copyText(path)}
            onRevealPath={path => void props.dispatcher.openPath(path, true)}
            onMove={worktree => {
              setWorktreeToMove(worktree)
              setDialog('worktree-move')
            }}
            onOpen={path => void props.dispatcher.addRepository(path)}
            onPrune={worktree =>
              setConfirmation({
                label: 'Prune worktree',
                message:
                  'Prune this stale worktree metadata? The worktree path is no longer available.',
                operation: 'worktree-prune',
                title: 'Prune worktree?',
                values: [worktree.path],
              })
            }
            onRemove={worktree =>
              (() => {
                const force = worktree.isLocked || worktree.isDirty !== false
                const action = {
                  force,
                  label: force ? 'Force remove worktree' : 'Remove worktree',
                  message: force
                    ? 'This worktree is locked or contains uncommitted changes. Force removal permanently removes its worktree files.'
                    : 'Remove this linked worktree? Uncommitted changes may be lost.',
                  operation: 'worktree-remove' as const,
                  title: force ? 'Force remove worktree?' : 'Remove worktree?',
                  values: [worktree.path],
                }
                if (!props.confirmWorktreeRemoval) {
                  void props.dispatcher.runOperation(action.operation, {
                    values: action.values,
                    force: action.force,
                  })
                } else {
                  setConfirmation(action)
                }
              })()
            }
            selectedRepositoryPath={props.state.selectedRepositoryPath}
            worktrees={worktrees}
            onOpenInNewWindow={path =>
              props.dispatcher.openRepositoryInNewWindow(path)
            }
          />
        </section>
        <WebIntegrationsSection
          dispatcher={props.dispatcher}
          editorIntegration={editorIntegration}
          shellIntegration={shellIntegration}
          state={props.state}
        />
        <WebUpdateSection dispatcher={props.dispatcher} state={props.state} />
        <WebLfsSection dispatcher={props.dispatcher} state={props.state} />
      </div>
      {props.state.inspectedStash ? (
        <StashDiffView
          diff={props.state.stashDiff}
          dispatcher={props.dispatcher}
          files={props.state.stashFiles}
          loading={props.state.loading}
          repositoryPath={props.state.selectedRepositoryPath}
          selectedFilePath={props.state.selectedStashFilePath}
          stash={props.state.inspectedStash}
        />
      ) : null}
      {target && 'stashSha' in target ? (
        <WebTextDialog
          description="Rename the selected stash without changing its contents."
          initialValue={target.customName || ''}
          label="Stash name"
          onDismiss={close}
          onSubmit={async value => {
            await props.dispatcher.runOperation('stash-rename', {
              values: [target.name],
              customName: value,
            })
            close()
          }}
          open={dialog === 'stash'}
          submitLabel="Rename stash"
          title="Rename stash"
        />
      ) : (
        <WebStashDialog
          onDismiss={close}
          onSubmit={async (message, options) => {
            await props.dispatcher.runOperation('stash', {
              values: props.state.includedFiles,
              message,
              ...options,
            })
            close()
          }}
          open={dialog === 'stash'}
        />
      )}
      <WebRemoteDialog
        onDismiss={close}
        onSubmit={async (name, url) => {
          await props.dispatcher.runOperation(
            target && 'url' in target ? 'remote-set-url' : 'remote-add',
            { values: [name, url] }
          )
          close()
        }}
        open={dialog === 'remote'}
        remote={target && 'url' in target ? target : null}
      />
      <WebTagDialog
        onDismiss={close}
        onSubmit={async (name, tagTarget, message) => {
          await props.dispatcher.runOperation('tag-create', {
            values: [name, ...(tagTarget ? [tagTarget] : [])],
            message,
          })
          close()
        }}
        open={dialog === 'tag'}
      />
      <WebWorktreeDialog
        onChooseDirectory={() => props.dispatcher.chooseDirectory()}
        onDismiss={close}
        onSubmit={async (value, branch) => {
          await props.dispatcher.runOperation('worktree-add', {
            values: [value],
            createBranch: branch,
            worktreePath: value,
          })
          close()
        }}
        open={dialog === 'worktree'}
        worktreeInclude={branches?.worktreeInclude}
      />
      <WebTextDialog
        description="Move the selected linked worktree to an absolute path."
        label="New worktree path"
        onDismiss={close}
        initialValue={
          worktreeToMove ? pathName(worktreeToMove.path) : undefined
        }
        validate={value => {
          const nextPath = worktreeToMove
            ? `${pathParent(worktreeToMove.path)}/${value.trim()}`
            : value
          return validateAbsolutePath(nextPath, 'New worktree path')
        }}
        onSubmit={async value => {
          if (worktreeToMove) {
            const nextPath = `${pathParent(worktreeToMove.path)}/${value}`
            await props.dispatcher.runOperation('worktree-move', {
              values: [worktreeToMove.path, nextPath],
            })
          }
          close()
          setWorktreeToMove(null)
        }}
        open={dialog === 'worktree-move'}
        submitLabel="Rename worktree"
        title="Rename worktree"
      />
      <WebConfirmDialog
        confirmLabel={confirmation?.label || 'Confirm'}
        message={confirmation?.message || ''}
        onConfirm={confirmOperation}
        onDismiss={() => setConfirmation(null)}
        open={confirmation !== null}
        title={confirmation?.title || 'Confirm action'}
      />
      <WebConfirmDialog
        confirmLabel="Delete local tag"
        message={`Delete the local tag ${tagToDelete?.name || 'this tag'}?${
          tagToDelete?.pushedRemotes?.length
            ? ` It is also pushed to ${tagToDelete.pushedRemotes.join(
                ', '
              )}; you can remove the remote tag in the next confirmation.`
            : ''
        }`}
        onConfirm={deleteLocalTag}
        onDismiss={() => setTagToDelete(null)}
        open={tagToDelete !== null}
        title="Delete tag?"
      />
      <WebConfirmDialog
        confirmLabel="Delete remote tag"
        message={`Also delete ${
          remoteTagToDelete?.tag.name || 'this tag'
        } from ${
          remoteTagToDelete?.remotes.join(', ') || 'the configured remote'
        }? This cannot be undone remotely.`}
        onConfirm={deleteRemoteTag}
        onDismiss={() => setRemoteTagToDelete(null)}
        open={remoteTagToDelete !== null}
        title="Delete pushed tag remotely?"
      />
    </section>
  )
}

function HistoryCommitInspection(props: {
  readonly state: WebApplicationState
  readonly dispatcher: WebDispatcher
  readonly commit: WebApplicationState['history'][number]
}) {
  const details = props.state.historyCommitDetails
  const [selectedHistoryFilePaths, setSelectedHistoryFilePaths] =
    React.useState<ReadonlyArray<string>>([])
  const historyFileKey = details?.files.map(file => file.path).join('\0') || ''
  React.useEffect(() => {
    setSelectedHistoryFilePaths(
      props.state.selectedHistoryFilePath
        ? [props.state.selectedHistoryFilePath]
        : []
    )
  }, [historyFileKey, props.commit.sha])
  const selectedFile =
    details?.files.find(
      file => file.path === props.state.selectedHistoryFilePath
    ) || null
  const selectedFiles = details
    ? selectedHistoryFilePaths.flatMap(path => {
        const file = details.files.find(candidate => candidate.path === path)
        return file ? [file] : []
      })
    : []
  const selectedFilePaths = selectedFiles.map(file => file.path)
  const desktopFile = selectedFile
    ? getDesktopCommittedFile(selectedFile, props.commit)
    : null
  const diff =
    desktopFile && selectedFile?.status.submoduleStatus
      ? getDesktopSubmoduleDiff(selectedFile, props.state.historyDiff)
      : getDesktopDiff(props.state.historyDiff)
  const preferences = useWebDiffPresentationPreferences()
  const [canExpandWholeFile, setCanExpandWholeFile] = React.useState(false)

  if (!props.state.selectedRepositoryPath) return null

  return (
    <section
      aria-busy={props.state.historyInspectionLoading}
      aria-label="Commit details"
      className="web-history-inspection"
    >
      <div className="web-tools-section-heading">
        <div>
          <h3>{props.commit.summary || 'Empty commit message'}</h3>
          <p>
            {props.commit.shortSha} - {details?.linesAdded || 0} additions,{' '}
            {details?.linesDeleted || 0} deletions
          </p>
          <div aria-label="Commit metadata" className="web-commit-metadata">
            <p>
              Author: {props.commit.author.name} &lt;{props.commit.author.email}
              &gt; on {new Date(props.commit.author.date).toLocaleString()}
            </p>
            <p>
              Committer: {props.commit.committer.name} &lt;
              {props.commit.committer.email}&gt; on{' '}
              {new Date(props.commit.committer.date).toLocaleString()}
            </p>
            {props.commit.tags.length ? (
              <p>Tags: {props.commit.tags.join(', ')}</p>
            ) : null}
            {props.commit.body.trim() ? (
              <details>
                <summary>Commit body</summary>
                <pre>{props.commit.body}</pre>
              </details>
            ) : null}
            {props.commit.trailers.length ? (
              <details>
                <summary>Commit trailers</summary>
                <ul>
                  {props.commit.trailers.map((trailer, index) => (
                    <li key={`${trailer.token}-${index}`}>
                      {trailer.token}: {trailer.value}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        </div>
        <Button onClick={props.dispatcher.clearHistoryInspection}>Close</Button>
      </div>
      <div className="web-history-inspection-grid">
        <div aria-label="Committed files" className="web-history-file-list">
          {details ? (
            details.files.length ? (
              <>
                <List
                  ariaLabel="Committed files"
                  getRowAriaLabel={row => {
                    const file = details.files[row]
                    return file ? `${file.path} ${file.status.kind}` : undefined
                  }}
                  invalidationProps={{
                    selectedHistoryFilePaths,
                    selectedHistoryFilePath:
                      props.state.selectedHistoryFilePath,
                  }}
                  onRowClick={row => {
                    const file = details.files[row]
                    if (file) void props.dispatcher.selectHistoryFile(file.path)
                  }}
                  onSelectionChanged={rows => {
                    const paths = rows
                      .map(row => details.files[row]?.path)
                      .filter((path): path is string => path !== undefined)
                    setSelectedHistoryFilePaths(paths)
                    const first = details.files[rows[0] || 0]
                    if (first)
                      void props.dispatcher.selectHistoryFile(first.path)
                  }}
                  rowCount={details.files.length}
                  rowHeight={29}
                  rowRenderer={row => {
                    const file = details.files[row]
                    return (
                      <div className="file">
                        <span>{file.path}</span>
                        <small>{file.status.kind}</small>
                      </div>
                    )
                  }}
                  selectedRows={details.files.flatMap((file, index) =>
                    selectedHistoryFilePaths.includes(file.path) ? [index] : []
                  )}
                  selectionMode="multi"
                />
                {selectedFiles.length > 1 ? (
                  <div
                    aria-label="Selected committed file actions"
                    className="web-history-file-actions"
                    role="group"
                  >
                    <Button
                      onClick={() =>
                        void props.dispatcher.copyPaths(
                          selectedFilePaths,
                          false
                        )
                      }
                    >
                      Copy selected paths
                    </Button>
                    <Button
                      onClick={() =>
                        void props.dispatcher.copyPaths(selectedFilePaths, true)
                      }
                    >
                      Copy selected relative paths
                    </Button>
                  </div>
                ) : null}
              </>
            ) : (
              <p>No files changed</p>
            )
          ) : (
            <p>Loading committed files...</p>
          )}
        </div>
        <div className="web-history-diff">
          {desktopFile && diff ? (
            <>
              {selectedFile?.status.submoduleStatus ? (
                <WebSubmoduleActions
                  disabled={props.state.historyInspectionLoading}
                  dispatcher={props.dispatcher}
                  filePath={selectedFile.path}
                  fullPath={props.state.historyDiff?.fullPath}
                  status={selectedFile.status.submoduleStatus}
                />
              ) : null}
              <DiffHeader
                canExpandWholeFile={canExpandWholeFile}
                diff={diff}
                hideWhitespaceInDiff={preferences.hideWhitespaceInDiff}
                onHideWhitespaceInDiffChanged={async checked =>
                  preferences.onHideWhitespaceInDiffChanged(checked)
                }
                onShowDiffMinimapChanged={preferences.onShowDiffMinimapChanged}
                onShowSideBySideDiffChanged={
                  preferences.onShowSideBySideDiffChanged
                }
                onShowWholeFileChanged={preferences.onShowWholeFileChanged}
                onWrapDiffLinesChanged={preferences.onWrapDiffLinesChanged}
                path={desktopFile.path}
                showDiffMinimap={preferences.showDiffMinimap}
                showSideBySideDiff={preferences.showSideBySideDiff}
                showWholeFile={preferences.showWholeFile}
                status={desktopFile.status}
                wrapDiffLines={preferences.wrapDiffLines}
              />
              <SeamlessDiffSwitcher
                diff={diff}
                file={desktopFile}
                externalFileContents={getDesktopFileContents(
                  desktopFile,
                  props.state.historyDiff
                )}
                hideWhitespaceInDiff={preferences.hideWhitespaceInDiff}
                imageDiffType={preferences.imageDiffType}
                onChangeImageDiffType={preferences.onImageDiffTypeChanged}
                onHideWhitespaceInDiffChanged={async checked =>
                  preferences.onHideWhitespaceInDiffChanged(checked)
                }
                onOpenBinaryFile={fullPath =>
                  void props.dispatcher.openPath(fullPath)
                }
                onOpenSubmodule={fullPath =>
                  void props.dispatcher.addRepository(fullPath)
                }
                readOnly={true}
                repository={getDesktopRepository(
                  props.state.selectedRepositoryPath
                )}
                showDiffCheckMarks={preferences.showDiffCheckMarks}
                showDiffMinimap={preferences.showDiffMinimap}
                showSideBySideDiff={preferences.showSideBySideDiff}
                showWholeFile={preferences.showWholeFile}
                onShowWholeFileChanged={preferences.onShowWholeFileChanged}
                onWholeFileExpansionAvailabilityChanged={setCanExpandWholeFile}
                wrapDiffLines={preferences.wrapDiffLines}
              />
              <WebFileActions
                dispatcher={props.dispatcher}
                fullPath={repositoryFilePath(
                  props.state.selectedRepositoryPath,
                  desktopFile.path
                )}
                openDisabled={
                  desktopFile.status.kind === AppFileStatusKind.Deleted
                }
                path={desktopFile.path}
              />
            </>
          ) : (
            <p>
              {props.state.selectedHistoryFilePath
                ? 'Loading file diff...'
                : 'Select a committed file to inspect its diff.'}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}

function DesktopHistoryView(props: {
  readonly state: WebApplicationState
  readonly dispatcher: WebDispatcher
  readonly mode: 'sidebar' | 'content'
  readonly selectedSHAs: ReadonlyArray<string>
  readonly onSelectedSHAsChanged: (shas: ReadonlyArray<string>) => void
  readonly preferAbsoluteDates: boolean
  readonly showConventionalCommitBadges: boolean
}) {
  if (props.mode === 'sidebar') {
    const commits = props.state.history.map(getDesktopCommit)
    const commitLookup = new Map(commits.map(commit => [commit.sha, commit]))
    const selectedCommit =
      props.selectedSHAs.length === 1
        ? commitLookup.get(props.selectedSHAs[0]) || null
        : null
    const headSHA = props.state.branches?.branch?.tip?.sha || null
    const [historyAction, setHistoryAction] = React.useState<
      'reset' | 'revert' | 'undo' | 'rewrite' | null
    >(null)
    const [resetDialogOpen, setResetDialogOpen] = React.useState(false)
    const [cherryPickCommits, setCherryPickCommits] =
      React.useState<ReadonlyArray<Commit> | null>(null)
    const [tagToDelete, setTagToDelete] = React.useState<{
      readonly name: string
      readonly remotes: ReadonlyArray<string>
    } | null>(null)
    const [remoteTagToDelete, setRemoteTagToDelete] = React.useState<{
      readonly name: string
      readonly remotes: ReadonlyArray<string>
    } | null>(null)
    const [keyboardReorderData, setKeyboardReorderData] = React.useState<
      KeyboardInsertionData | undefined
    >(undefined)
    const [rewriteAction, setRewriteAction] = React.useState<
      'reorder' | 'squash' | null
    >(null)
    const [reorderBefore, setReorderBefore] = React.useState('')
    const [squashMessage, setSquashMessage] = React.useState('')
    const [pendingRewrite, setPendingRewrite] = React.useState<{
      readonly action: 'reorder' | 'squash'
      readonly before: string | null
      readonly message: string
    } | null>(null)
    const [selectedCommitAction, setSelectedCommitAction] = React.useState<
      'branch' | 'tag' | 'checkout' | null
    >(null)
    const historyScrollStorageKey = `desktop-plus-history-scroll:${
      props.state.selectedRepositoryPath
    }:${props.state.historyGraphMode ? 'graph' : 'list'}`
    const [historyScrollTop, setHistoryScrollTop] = React.useState(() =>
      Number(localStorage.getItem(historyScrollStorageKey) || 0)
    )
    const reorderTargets = props.state.history.filter(
      commit => !props.selectedSHAs.includes(commit.sha)
    )
    const historyActionCommit =
      selectedCommit ||
      (historyAction === 'undo' && headSHA
        ? commitLookup.get(headSHA) || null
        : null)
    const confirmHistoryAction = async () => {
      if (!historyAction) return
      if (historyAction === 'rewrite') return
      const commitSHA = historyActionCommit?.sha
      if (!commitSHA && historyAction !== 'undo') return
      await props.dispatcher.runOperation(
        historyAction === 'reset'
          ? 'reset-commit'
          : historyAction === 'revert'
          ? 'revert'
          : 'undo',
        historyAction === 'undo'
          ? {}
          : {
              values: [commitSHA as string],
              ...(historyAction === 'reset' ? { mode: 'mixed' } : {}),
            }
      )
      setHistoryAction(null)
      props.onSelectedSHAsChanged([])
    }
    const confirmDeleteTag = async () => {
      if (!tagToDelete) return
      await props.dispatcher.runOperation('tag-delete', {
        values: [tagToDelete.name],
        confirmed: true,
      })
      if (tagToDelete.remotes.length)
        setRemoteTagToDelete({
          name: tagToDelete.name,
          remotes: tagToDelete.remotes,
        })
      setTagToDelete(null)
    }
    const confirmDeleteRemoteTag = async () => {
      if (!remoteTagToDelete) return
      for (const remote of remoteTagToDelete.remotes)
        await props.dispatcher.runOperation('delete-remote-tag', {
          values: [remote, remoteTagToDelete.name],
          confirmed: true,
        })
      setRemoteTagToDelete(null)
    }
    const reorderCommits = async (
      baseCommit: Commit | null,
      commitsToInsert: ReadonlyArray<Commit>,
      lastRetainedCommitRef: string | null
    ) => {
      setKeyboardReorderData(undefined)
      await props.dispatcher.runOperation('reorder-commits', {
        commits: commitsToInsert.map(commit => commit.sha),
        ...(baseCommit ? { before: baseCommit.sha } : {}),
        ...(lastRetainedCommitRef ? { base: lastRetainedCommitRef } : {}),
      })
      props.onSelectedSHAsChanged([])
    }

    return (
      <>
        <section className="panel">
          <div className="web-history-actions">
            <label htmlFor="web-history-filter">Search commits</label>
            <input
              id="web-history-filter"
              onChange={event =>
                void props.dispatcher.setHistoryFilterText(event.target.value)
              }
              placeholder="Summary, body, SHA, author, or tag"
              type="search"
              value={props.state.historyFilterText}
            />
            <div
              aria-label="History view"
              className="web-history-view-mode-switch button-group"
            >
              <Button
                ariaLabel="List view"
                ariaPressed={!props.state.historyGraphMode}
                className={
                  !props.state.historyGraphMode ? 'selected' : undefined
                }
                disabled={props.state.loading}
                onClick={() => void props.dispatcher.setHistoryGraphMode(false)}
                size="small"
              >
                <Octicon symbol={octicons.listUnordered} />
              </Button>
              <Button
                ariaLabel="Graph view"
                ariaPressed={props.state.historyGraphMode}
                className={
                  props.state.historyGraphMode ? 'selected' : undefined
                }
                disabled={props.state.loading}
                onClick={() => void props.dispatcher.setHistoryGraphMode(true)}
                size="small"
              >
                <Octicon symbol={octicons.gitBranch} />
              </Button>
            </div>
            <Button
              disabled={props.selectedSHAs.length === 0 || props.state.loading}
              onClick={() => {
                setReorderBefore('')
                setRewriteAction('reorder')
              }}
            >
              Reorder selected
            </Button>
            <Button
              disabled={props.selectedSHAs.length < 2 || props.state.loading}
              onClick={() => {
                setSquashMessage(`Squash ${props.selectedSHAs.length} commits`)
                setRewriteAction('squash')
              }}
            >
              Squash selected
            </Button>
            {props.state.historyRewriteUndo ? (
              <Button
                className="destructive"
                onClick={() => setHistoryAction('rewrite')}
              >
                Undo history rewrite
              </Button>
            ) : null}
            <Button
              disabled={selectedCommit === null || props.state.loading}
              onClick={() => setSelectedCommitAction('branch')}
            >
              Create branch at selected commit
            </Button>
            <Button
              disabled={selectedCommit === null || props.state.loading}
              onClick={() => setSelectedCommitAction('tag')}
            >
              Create tag at selected commit
            </Button>
            <Button
              disabled={selectedCommit === null || props.state.loading}
              onClick={() => setSelectedCommitAction('checkout')}
            >
              Checkout selected commit
            </Button>
            <Button
              disabled={selectedCommit === null || props.state.loading}
              onClick={() => {
                if (selectedCommit)
                  void props.dispatcher.copyText(selectedCommit.sha)
              }}
            >
              Copy SHA
            </Button>
            <Button
              disabled={
                selectedCommit === null ||
                selectedCommit.tags.length === 0 ||
                props.state.loading
              }
              onClick={() => {
                if (selectedCommit)
                  void props.dispatcher.copyText(selectedCommit.tags.join(' '))
              }}
            >
              {selectedCommit && selectedCommit.tags.length > 1
                ? 'Copy tags'
                : 'Copy tag'}
            </Button>
            <Button
              disabled={
                selectedCommit === null ||
                selectedCommit.sha === headSHA ||
                props.state.loading
              }
              onClick={() => setResetDialogOpen(true)}
            >
              Reset selected commit
            </Button>
            <Button
              disabled={selectedCommit === null || props.state.loading}
              onClick={() => setHistoryAction('revert')}
            >
              Revert selected commit
            </Button>
            <Button
              disabled={
                selectedCommit === null ||
                selectedCommit.sha !== headSHA ||
                props.state.loading
              }
              onClick={() => setHistoryAction('undo')}
            >
              Undo latest commit
            </Button>
          </div>
          {props.state.historyGraphMode ? (
            <WebHistoryGraphView
              dispatcher={props.dispatcher}
              onAmendCommit={commit => {
                props.onSelectedSHAsChanged([commit.sha])
                void props.dispatcher.startAmendingCommit(commit.sha)
              }}
              onCheckoutCommit={commit => {
                props.onSelectedSHAsChanged([commit.sha])
                setSelectedCommitAction('checkout')
              }}
              onCherryPick={commits => setCherryPickCommits(commits)}
              onCreateBranch={commit => {
                props.onSelectedSHAsChanged([commit.sha])
                setSelectedCommitAction('branch')
              }}
              onCreateTag={commit => {
                props.onSelectedSHAsChanged([commit.sha])
                setSelectedCommitAction('tag')
              }}
              onDeleteTag={name => {
                const tag = props.state.branches?.tags?.find(
                  candidate => candidate.name === name
                )
                setTagToDelete({
                  name,
                  remotes: tag?.pushedRemotes || [],
                })
              }}
              onResetToCommit={commit => {
                props.onSelectedSHAsChanged([commit.sha])
                setResetDialogOpen(true)
              }}
              onRevertCommit={commit => {
                props.onSelectedSHAsChanged([commit.sha])
                setHistoryAction('revert')
              }}
              onSelectedSHAsChanged={selectedSHAs => {
                props.onSelectedSHAsChanged(selectedSHAs)
                if (selectedSHAs.length === 1)
                  void props.dispatcher.inspectHistoryCommit(selectedSHAs[0])
                else props.dispatcher.clearHistoryInspection()
              }}
              onUndoCommit={commit => {
                props.onSelectedSHAsChanged([commit.sha])
                setHistoryAction('undo')
              }}
              preferAbsoluteDates={props.preferAbsoluteDates}
              selectedSHAs={props.selectedSHAs}
              showConventionalCommitBadges={props.showConventionalCommitBadges}
              state={props.state}
            />
          ) : (
            <CommitList
              accounts={[]}
              commitLookup={commitLookup}
              commitSHAs={commits.map(commit => commit.sha)}
              dispatcher={props.dispatcher as never}
              emptyListMessage="No commits to list"
              emoji={props.state.emoji}
              headCommitSha={headSHA || undefined}
              canAmendCommits={headSHA !== null}
              canResetToCommits={headSHA !== null}
              canUndoCommits={headSHA !== null}
              isInformationalView={false}
              isLocalRepository={
                (props.state.branches?.remotes?.length || 0) === 0
              }
              localCommitSHAs={props.state.branches?.localCommitSHAs || []}
              tagsToPush={props.state.branches?.tagsToPush || []}
              reorderingEnabled={true}
              isMultiCommitOperationInProgress={false}
              keyboardReorderData={keyboardReorderData}
              onCancelKeyboardReorder={() => setKeyboardReorderData(undefined)}
              onScroll={(scrollTop, clientHeight) => {
                const end =
                  Math.floor(scrollTop / 50) + Math.ceil(clientHeight / 50)
                if (
                  props.state.hasMoreHistory &&
                  end >= props.state.history.length - 5
                )
                  void props.dispatcher.loadMoreHistory()
              }}
              onRowsRendered={(_start, end) => {
                if (
                  props.state.hasMoreHistory &&
                  end >= props.state.history.length - 5
                )
                  void props.dispatcher.loadMoreHistory()
              }}
              onCompareListScrolled={scrollTop => {
                setHistoryScrollTop(scrollTop)
                localStorage.setItem(historyScrollStorageKey, String(scrollTop))
              }}
              onCommitsSelected={commits => {
                const selectedSHAs = commits.map(commit => commit.sha)
                props.onSelectedSHAsChanged(selectedSHAs)
                if (selectedSHAs.length === 1)
                  void props.dispatcher.inspectHistoryCommit(selectedSHAs[0])
                else props.dispatcher.clearHistoryInspection()
              }}
              onUndoCommit={commit => {
                props.onSelectedSHAsChanged([commit.sha])
                setHistoryAction('undo')
              }}
              onResetToCommit={commit => {
                props.onSelectedSHAsChanged([commit.sha])
                setResetDialogOpen(true)
              }}
              onRevertCommit={commit => {
                props.onSelectedSHAsChanged([commit.sha])
                setHistoryAction('revert')
              }}
              onAmendCommit={commit => {
                props.onSelectedSHAsChanged([commit.sha])
                void props.dispatcher.startAmendingCommit(commit.sha)
              }}
              onCreateBranch={commit => {
                props.onSelectedSHAsChanged([commit.sha])
                setSelectedCommitAction('branch')
              }}
              onCreateTag={sha => {
                props.onSelectedSHAsChanged([sha])
                setSelectedCommitAction('tag')
              }}
              onCheckoutCommit={commit => {
                props.onSelectedSHAsChanged([commit.sha])
                setSelectedCommitAction('checkout')
              }}
              onDeleteTag={name => {
                const tag = props.state.branches?.tags?.find(
                  candidate => candidate.name === name
                )
                setTagToDelete({
                  name,
                  remotes: tag?.pushedRemotes || [],
                })
              }}
              onCherryPick={commitLines =>
                setCherryPickCommits(
                  commitLines.flatMap(commit => {
                    const selected = commitLookup.get(commit.sha)
                    return selected ? [selected] : []
                  })
                )
              }
              onKeyboardReorder={toReorder =>
                setKeyboardReorderData({
                  type: DragType.Commit,
                  commits: toReorder,
                  itemIndices: toReorder.map(commit =>
                    commits.findIndex(item => item.sha === commit.sha)
                  ),
                })
              }
              onDropCommitInsertion={(
                baseCommit,
                commitsToInsert,
                lastRetained
              ) =>
                void reorderCommits(baseCommit, commitsToInsert, lastRetained)
              }
              onSquash={(toSquash, squashOnto, lastRetained) => {
                setPendingRewrite({
                  action: 'squash',
                  before: lastRetained,
                  message: squashOnto.summary,
                })
                props.onSelectedSHAsChanged(toSquash.map(commit => commit.sha))
              }}
              compareListScrollTop={historyScrollTop}
              preferAbsoluteDates={props.preferAbsoluteDates}
              repository={null}
              selectedSHAs={props.selectedSHAs}
              showConventionalCommitBadges={props.showConventionalCommitBadges}
            />
          )}
        </section>
        <WebConfirmDialog
          confirmLabel={
            historyAction === 'reset'
              ? 'Reset commit'
              : historyAction === 'revert'
              ? 'Revert commit'
              : 'Undo commit'
          }
          message={
            historyAction === 'reset'
              ? 'Resetting will move the current branch back to the selected commit and keep the changes in the working directory. Continue?'
              : historyAction === 'revert'
              ? 'Create a new commit that reverses the selected commit?'
              : 'Undo the latest commit and leave its changes in the working directory?'
          }
          onConfirm={confirmHistoryAction}
          onDismiss={() => setHistoryAction(null)}
          open={historyAction !== null}
          title={
            historyAction === 'reset'
              ? 'Reset selected commit?'
              : historyAction === 'revert'
              ? 'Revert selected commit?'
              : 'Undo latest commit?'
          }
        />
        <WebResetDialog
          onConfirm={async mode => {
            if (!selectedCommit) return
            await props.dispatcher.runOperation('reset-commit', {
              values: [selectedCommit.sha],
              mode,
            })
            setResetDialogOpen(false)
            props.onSelectedSHAsChanged([])
          }}
          onDismiss={() => setResetDialogOpen(false)}
          open={resetDialogOpen}
        />
        {rewriteAction ? (
          <DialogStackContext.Provider value={{ isTopMost: true }}>
            <Dialog
              ariaDescribedBy="history-rewrite-description"
              onDismissed={() => setRewriteAction(null)}
              onSubmit={() => {
                if (rewriteAction === 'squash' && !squashMessage.trim()) return
                setPendingRewrite({
                  action: rewriteAction,
                  before: reorderBefore || null,
                  message: squashMessage.trim(),
                })
                setRewriteAction(null)
              }}
              title={
                rewriteAction === 'reorder'
                  ? 'Reorder selected commits'
                  : 'Squash selected commits'
              }
            >
              <DialogContent>
                <p id="history-rewrite-description">
                  {rewriteAction === 'reorder'
                    ? 'Choose where the selected commits should be inserted.'
                    : 'Provide the message for the rewritten squash commit.'}
                </p>
                {rewriteAction === 'reorder' ? (
                  <>
                    <label htmlFor="web-reorder-before">Insert before</label>
                    <select
                      id="web-reorder-before"
                      onChange={event => setReorderBefore(event.target.value)}
                      value={reorderBefore}
                    >
                      <option value="">End of the current history</option>
                      {reorderTargets.map(commit => (
                        <option key={commit.sha} value={commit.sha}>
                          {commit.summary || 'Empty commit message'} (
                          {commit.shortSha})
                        </option>
                      ))}
                    </select>
                  </>
                ) : (
                  <>
                    <label htmlFor="web-squash-message">Commit message</label>
                    <textarea
                      autoFocus={true}
                      id="web-squash-message"
                      onChange={event => setSquashMessage(event.target.value)}
                      rows={4}
                      value={squashMessage}
                    />
                  </>
                )}
              </DialogContent>
              <DialogFooter>
                <Button onClick={() => setRewriteAction(null)}>Cancel</Button>
                <Button
                  disabled={rewriteAction === 'squash' && !squashMessage.trim()}
                  type="submit"
                >
                  Continue
                </Button>
              </DialogFooter>
            </Dialog>
          </DialogStackContext.Provider>
        ) : null}
        <WebConfirmDialog
          confirmLabel={
            pendingRewrite?.action === 'reorder'
              ? 'Reorder commits'
              : 'Squash commits'
          }
          message={
            pendingRewrite?.action === 'reorder'
              ? 'Reorder the selected commits and rewrite local history? The exact previous tip will be available for a guarded undo.'
              : 'Squash the selected commits and rewrite local history? The exact previous tip will be available for a guarded undo.'
          }
          onConfirm={async () => {
            if (!pendingRewrite) return
            if (pendingRewrite.action === 'reorder')
              await props.dispatcher.runOperation('reorder-commits', {
                commits: props.selectedSHAs,
                ...(pendingRewrite.before
                  ? { before: pendingRewrite.before }
                  : {}),
              })
            else
              await props.dispatcher.runOperation('squash-commits', {
                commits: props.selectedSHAs.slice(1),
                squashOnto: props.selectedSHAs[0],
                message: pendingRewrite.message,
              })
            setPendingRewrite(null)
            props.onSelectedSHAsChanged([])
          }}
          onDismiss={() => setPendingRewrite(null)}
          open={pendingRewrite !== null}
          title={
            pendingRewrite?.action === 'reorder'
              ? 'Reorder commits?'
              : 'Squash commits?'
          }
        />
        <WebConfirmDialog
          confirmLabel="Undo history rewrite"
          message="Restore the exact branch tip from before the last history rewrite? This is guarded against intervening changes."
          onConfirm={async () => {
            const undo = props.state.historyRewriteUndo
            if (!undo) return
            await props.dispatcher.runOperation('undo-history-rewrite', {
              values: [undo.branch, undo.originalTip, undo.rewrittenTip],
              confirmed: true,
            })
            setHistoryAction(null)
            props.onSelectedSHAsChanged([])
          }}
          onDismiss={() => setHistoryAction(null)}
          open={historyAction === 'rewrite'}
          title="Undo history rewrite?"
        />
        <WebTextDialog
          description={`Create and check out a new local branch at ${
            selectedCommit?.shortSha || 'the selected commit'
          }.`}
          label="Branch name"
          onDismiss={() => setSelectedCommitAction(null)}
          onSubmit={async name => {
            if (!selectedCommit) return
            await props.dispatcher.runOperation('create-branch', {
              values: [name, selectedCommit.sha],
              checkout: true,
            })
            setSelectedCommitAction(null)
            props.onSelectedSHAsChanged([])
          }}
          validate={value => validateGitRefName(value, 'Branch name')}
          open={selectedCommitAction === 'branch'}
          submitLabel="Create branch"
          title="Create branch at selected commit"
        />
        <WebTagDialog
          initialTarget={selectedCommit?.sha}
          onDismiss={() => setSelectedCommitAction(null)}
          onSubmit={async (name, target, message) => {
            if (!selectedCommit) return
            await props.dispatcher.runOperation('tag-create', {
              values: [name, target || selectedCommit.sha],
              message,
            })
            setSelectedCommitAction(null)
            props.onSelectedSHAsChanged([])
          }}
          open={selectedCommitAction === 'tag'}
          title="Create tag at selected commit"
        />
        <WebConfirmDialog
          confirmLabel="Checkout commit"
          message={`Checking out ${
            selectedCommit?.shortSha || 'the selected commit'
          } creates a detached HEAD. You will no longer be on a branch.`}
          onConfirm={async () => {
            if (!selectedCommit) return
            await props.dispatcher.runOperation('checkout-commit', {
              values: [selectedCommit.sha],
            })
            setSelectedCommitAction(null)
            props.onSelectedSHAsChanged([])
          }}
          onDismiss={() => setSelectedCommitAction(null)}
          open={selectedCommitAction === 'checkout'}
          title="Checkout selected commit?"
        />
        <WebConfirmDialog
          confirmLabel={
            cherryPickCommits?.length === 1
              ? 'Cherry-pick commit'
              : `Cherry-pick ${cherryPickCommits?.length || 0} commits`
          }
          message={`Cherry-pick ${
            cherryPickCommits?.map(commit => commit.shortSha).join(', ') ||
            'the selected commit'
          } onto the current branch? Conflicts can be resolved from Changes.`}
          onConfirm={async () => {
            if (!cherryPickCommits?.length) return
            await props.dispatcher.runOperation('cherry-pick', {
              values: cherryPickCommits.map(commit => commit.sha),
            })
            setCherryPickCommits(null)
            props.onSelectedSHAsChanged([])
          }}
          onDismiss={() => setCherryPickCommits(null)}
          open={cherryPickCommits !== null}
          title="Cherry-pick selected commit?"
        />
        <WebConfirmDialog
          confirmLabel="Delete local tag"
          message={`Delete the local tag ${tagToDelete?.name || 'this tag'}?${
            tagToDelete?.remotes.length
              ? ` It is also pushed to ${tagToDelete.remotes.join(
                  ', '
                )}; you can remove the remote tag in the next confirmation.`
              : ''
          }`}
          onConfirm={confirmDeleteTag}
          onDismiss={() => setTagToDelete(null)}
          open={tagToDelete !== null}
          title="Delete tag?"
        />
        <WebConfirmDialog
          confirmLabel="Delete remote tag"
          message={`Also delete ${remoteTagToDelete?.name || 'this tag'} from ${
            remoteTagToDelete?.remotes.join(', ') || 'the remote'
          }? This cannot be undone remotely.`}
          onConfirm={confirmDeleteRemoteTag}
          onDismiss={() => setRemoteTagToDelete(null)}
          open={remoteTagToDelete !== null}
          title="Delete pushed tag remotely?"
        />
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
  const selectedCommitWeb =
    selectedCommit &&
    props.state.history.find(commit => commit.sha === selectedCommit.sha)
  const details =
    selectedCommitWeb &&
    props.state.historyCommitDetails &&
    props.state.historyCommitDetails.files
      ? props.state.historyCommitDetails
      : null
  const changesetData = {
    files:
      selectedCommitWeb && details
        ? details.files.map(file =>
            getDesktopCommittedFile(file, selectedCommitWeb)
          )
        : [],
    linesAdded: details?.linesAdded || 0,
    linesDeleted: details?.linesDeleted || 0,
  }
  const [isExpanded, setIsExpanded] = React.useState(false)
  const [shasToHighlight, setShasToHighlight] = React.useState<
    ReadonlyArray<string>
  >([])
  const [unreachableTab, setUnreachableTab] =
    React.useState<UnreachableCommitsTab | null>(null)
  const commitLookup = new Map(commits.map(commit => [commit.sha, commit]))
  const shasInDiff = selectedCommit ? [selectedCommit.sha] : []

  if (selectedCommits.length === 0 || !props.state.selectedRepositoryPath)
    return null

  return (
    <div id="history" className={isExpanded ? 'expanded' : 'collapsed'}>
      <ExpandableCommitSummary
        accounts={[]}
        changesetData={changesetData}
        emoji={props.state.emoji}
        isExpanded={isExpanded}
        onExpandChanged={setIsExpanded}
        onHighlightShas={setShasToHighlight}
        repository={getDesktopRepository(props.state.selectedRepositoryPath)}
        selectedCommits={selectedCommits}
        shasInDiff={shasInDiff}
        showUnreachableCommits={setUnreachableTab}
      />
      {unreachableTab !== null ? (
        <UnreachableCommitsDialog
          accounts={[]}
          commitLookup={commitLookup}
          dispatcher={props.dispatcher as never}
          emoji={props.state.emoji}
          onDismissed={() => setUnreachableTab(null)}
          preferAbsoluteDates={props.preferAbsoluteDates}
          selectedShas={props.selectedSHAs}
          selectedTab={unreachableTab}
          shasInDiff={shasInDiff}
        />
      ) : null}
      {shasToHighlight.length ? (
        <div
          aria-label="Highlighted commits"
          className="web-history-highlight-status"
        >
          Highlighting {shasToHighlight.length} commit
          {shasToHighlight.length === 1 ? '' : 's'}
        </div>
      ) : null}
      {props.state.selectedHistoryCommitSHA === selectedCommits[0]?.sha ? (
        <HistoryCommitInspection
          commit={
            props.state.history.find(
              commit => commit.sha === props.state.selectedHistoryCommitSHA
            ) || props.state.history[0]
          }
          dispatcher={props.dispatcher}
          state={props.state}
        />
      ) : (
        <div className="commit-details" />
      )}
    </div>
  )
}

function DesktopCompareView(props: {
  readonly state: WebApplicationState
  readonly dispatcher: WebDispatcher
  readonly mode: 'sidebar' | 'content'
}) {
  const currentBranch = props.state.branches?.branch?.name || null
  const branches = (props.state.branches?.branches || []).filter(
    branch =>
      branch.name !== currentBranch &&
      !branch.name.endsWith('/HEAD') &&
      Boolean(branch.tip?.sha)
  )
  const comparisonFilter = props.state.comparisonFilterText.trim().toLowerCase()
  const filteredBranches = branches.filter(branch =>
    !comparisonFilter
      ? true
      : `${branch.name} ${branch.upstream || ''}`
          .toLowerCase()
          .includes(comparisonFilter)
  )
  const comparison = props.state.comparison
  const selectedCommit =
    comparison?.commits.find(
      commit => commit.sha === props.state.selectedHistoryCommitSHA
    ) || null
  const [cherryPickOpen, setCherryPickOpen] = React.useState(false)
  const [selectedComparisonSHAs, setSelectedComparisonSHAs] = React.useState<
    ReadonlyArray<string>
  >([])
  const [cherryPickUndoOpen, setCherryPickUndoOpen] = React.useState(false)
  const [mergeAction, setMergeAction] = React.useState<
    'merge' | 'squash-merge' | 'rebase' | null
  >(null)
  const compareScrollStorageKey = repositoryViewStorageKey(
    webCompareScrollStorageKey,
    props.state.selectedRepositoryPath
  )
  const [compareScrollTop, setCompareScrollTop] = React.useState(() =>
    Number(localStorage.getItem(compareScrollStorageKey) || 0)
  )
  const compareListRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    setCompareScrollTop(
      Number(localStorage.getItem(compareScrollStorageKey) || 0)
    )
  }, [compareScrollStorageKey])

  React.useEffect(() => {
    if (compareListRef.current)
      compareListRef.current.scrollTop = compareScrollTop
  }, [compareScrollTop, comparison])

  React.useEffect(() => {
    if (
      props.mode === 'sidebar' &&
      props.state.comparisonBranch &&
      !props.state.comparison &&
      !props.state.comparisonLoading &&
      props.state.branches
    ) {
      void props.dispatcher.loadComparison(
        props.state.comparisonBranch,
        props.state.comparisonMode
      )
    }
  }, [
    props.dispatcher,
    props.mode,
    props.state.branches,
    props.state.comparison,
    props.state.comparisonBranch,
    props.state.comparisonLoading,
    props.state.comparisonMode,
  ])

  React.useEffect(() => {
    if (!comparison) {
      setSelectedComparisonSHAs([])
      return
    }
    setSelectedComparisonSHAs(current =>
      current.filter(sha =>
        comparison.commits.some(commit => commit.sha === sha)
      )
    )
  }, [comparison])

  if (props.mode === 'sidebar') {
    const selectedCommits = comparison
      ? selectedComparisonSHAs.flatMap(sha => {
          const commit = comparison.commits.find(item => item.sha === sha)
          return commit ? [commit] : []
        })
      : []

    return (
      <section className="panel web-compare-sidebar" aria-label="Compare">
        <div className="web-compare-controls">
          {props.state.comparisonBranchListVisible ? (
            <>
              <label htmlFor="web-comparison-branch">Branch</label>
              <select
                id="web-comparison-branch"
                onChange={event => {
                  const branch = event.target.value
                  if (branch)
                    void props.dispatcher.loadComparison(
                      branch,
                      props.state.comparisonMode
                    )
                }}
                value={props.state.comparisonBranch || ''}
              >
                <option value="">Choose a branch</option>
                {filteredBranches.map(branch => (
                  <option key={branch.name} value={branch.name}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </>
          ) : null}
          <label htmlFor="web-comparison-filter">Filter</label>
          {props.state.comparisonBranchListVisible ? (
            <input
              id="web-comparison-filter"
              onChange={event =>
                props.dispatcher.setComparisonFilterText(event.target.value)
              }
              placeholder="Filter"
              type="search"
              value={props.state.comparisonFilterText}
            />
          ) : null}
          <Button
            onClick={() =>
              props.dispatcher.setComparisonBranchListVisible(
                !props.state.comparisonBranchListVisible
              )
            }
          >
            {props.state.comparisonBranchListVisible
              ? 'Hide branch list'
              : 'Show branch list'}
          </Button>
          <div aria-label="Comparison direction" className="web-compare-modes">
            <Button
              className={
                props.state.comparisonMode === 'Behind' ? 'selected' : undefined
              }
              disabled={!props.state.comparisonBranch}
              onClick={() => {
                if (props.state.comparisonBranch)
                  void props.dispatcher.loadComparison(
                    props.state.comparisonBranch,
                    'Behind'
                  )
              }}
            >
              Behind
            </Button>
            <Button
              className={
                props.state.comparisonMode === 'Ahead' ? 'selected' : undefined
              }
              disabled={!props.state.comparisonBranch}
              onClick={() => {
                if (props.state.comparisonBranch)
                  void props.dispatcher.loadComparison(
                    props.state.comparisonBranch,
                    'Ahead'
                  )
              }}
            >
              Ahead
            </Button>
          </div>
        </div>
        {comparison ? (
          <>
            <p className="web-compare-summary">
              {comparison.ahead} ahead, {comparison.behind} behind
            </p>
            <Button
              disabled={
                selectedCommits.length === 0 ||
                props.state.comparisonMode !== 'Behind' ||
                props.state.loading
              }
              onClick={() => setCherryPickOpen(true)}
            >
              Cherry-pick selected commit
              {selectedCommits.length > 1 ? 's' : ''}
            </Button>
            <div
              aria-label="Comparison branch actions"
              className="web-compare-actions"
              role="group"
            >
              <Button
                disabled={
                  props.state.loading ||
                  !props.state.comparisonBranch ||
                  props.state.comparisonMode !== 'Behind'
                }
                onClick={() => setMergeAction('merge')}
              >
                Merge branch
              </Button>
              <Button
                disabled={
                  props.state.loading ||
                  !props.state.comparisonBranch ||
                  props.state.comparisonMode !== 'Behind'
                }
                onClick={() => setMergeAction('squash-merge')}
              >
                Squash merge branch
              </Button>
              <Button
                disabled={
                  props.state.loading ||
                  !props.state.comparisonBranch ||
                  props.state.comparisonMode !== 'Behind'
                }
                onClick={() => setMergeAction('rebase')}
              >
                Rebase onto branch
              </Button>
            </div>
            <div
              aria-busy={props.state.comparisonLoading}
              aria-label="Comparison commits"
              className="web-compare-commits"
              onScroll={event => {
                const scrollTop = event.currentTarget.scrollTop
                setCompareScrollTop(scrollTop)
                localStorage.setItem(compareScrollStorageKey, String(scrollTop))
              }}
              ref={compareListRef}
              role="listbox"
              style={{ overflow: 'auto' }}
            >
              {comparison.commits.length ? (
                comparison.commits.map(commit => (
                  <Button
                    ariaSelected={selectedComparisonSHAs.includes(commit.sha)}
                    className={
                      selectedComparisonSHAs.includes(commit.sha)
                        ? 'selected'
                        : undefined
                    }
                    key={commit.sha}
                    onClick={event => {
                      const nextSelection =
                        event.metaKey || event.ctrlKey
                          ? selectedComparisonSHAs.includes(commit.sha)
                            ? selectedComparisonSHAs.filter(
                                sha => sha !== commit.sha
                              )
                            : [...selectedComparisonSHAs, commit.sha]
                          : [commit.sha]
                      setSelectedComparisonSHAs(nextSelection)
                      if (nextSelection.length === 1)
                        void props.dispatcher.inspectHistoryCommit(
                          nextSelection[0]
                        )
                      else props.dispatcher.clearHistoryInspection()
                    }}
                    role="option"
                  >
                    <span>{commit.summary || 'Empty commit message'}</span>
                    <small>{commit.shortSha}</small>
                  </Button>
                ))
              ) : (
                <p>No commits in this direction.</p>
              )}
            </div>
          </>
        ) : (
          <p>
            {props.state.comparisonLoading
              ? 'Loading comparison...'
              : filteredBranches.length
              ? 'Choose a branch to compare.'
              : 'No other branches are available to compare.'}
          </p>
        )}
        {props.state.cherryPickUndo ? (
          <Button
            className="destructive"
            disabled={props.state.loading}
            onClick={() => setCherryPickUndoOpen(true)}
          >
            Undo cherry-pick
          </Button>
        ) : null}
        <WebConfirmDialog
          confirmLabel={
            selectedCommits.length === 1
              ? 'Cherry-pick commit'
              : `Cherry-pick ${selectedCommits.length} commits`
          }
          message={`Cherry-pick ${
            selectedCommits.length
              ? selectedCommits.map(commit => commit.shortSha).join(', ')
              : selectedCommit?.shortSha || 'the selected commit'
          } onto the current branch? Conflicts can be resolved from Changes.`}
          onConfirm={async () => {
            if (!selectedCommits.length) return
            await props.dispatcher.runOperation('cherry-pick', {
              values: selectedCommits.map(commit => commit.sha),
            })
            setCherryPickOpen(false)
            setSelectedComparisonSHAs([])
          }}
          onDismiss={() => setCherryPickOpen(false)}
          open={cherryPickOpen}
          title={
            selectedCommits.length === 1
              ? 'Cherry-pick selected commit?'
              : `Cherry-pick ${selectedCommits.length} commits?`
          }
        />
        <WebConfirmDialog
          confirmLabel="Undo cherry-pick"
          message="Restore the exact branch tip from before the last cherry-pick? This is guarded against intervening changes and local changes."
          onConfirm={async () => {
            const undo = props.state.cherryPickUndo
            if (!undo) return
            await props.dispatcher.runOperation('undo-cherry-pick', {
              values: [undo.branch, undo.originalTip, undo.rewrittenTip],
              confirmed: true,
            })
            setCherryPickUndoOpen(false)
          }}
          onDismiss={() => setCherryPickUndoOpen(false)}
          open={cherryPickUndoOpen}
          title="Undo cherry-pick?"
        />
        <WebConfirmDialog
          confirmLabel={
            mergeAction === 'squash-merge'
              ? 'Squash merge branch'
              : mergeAction === 'rebase'
              ? 'Rebase onto branch'
              : 'Merge branch'
          }
          message={
            mergeAction === 'squash-merge'
              ? `Squash the commits from ${props.state.comparisonBranch} into the current branch and create one commit? Conflicts can be resolved from Changes.`
              : mergeAction === 'rebase'
              ? `Rebase the current branch onto ${props.state.comparisonBranch}? This rewrites local commits and conflicts can be resolved from Changes.`
              : `Merge ${props.state.comparisonBranch} into the current branch? Conflicts can be resolved from Changes.`
          }
          onConfirm={async () => {
            if (!mergeAction || !props.state.comparisonBranch) return
            await props.dispatcher.runOperation(mergeAction, {
              values: [props.state.comparisonBranch],
            })
            setMergeAction(null)
          }}
          onDismiss={() => setMergeAction(null)}
          open={mergeAction !== null}
          title={
            mergeAction === 'squash-merge'
              ? 'Squash merge branch?'
              : mergeAction === 'rebase'
              ? 'Rebase onto branch?'
              : 'Merge branch?'
          }
        />
      </section>
    )
  }

  if (!selectedCommit) return <div className="commit-details" />

  return (
    <div id="history" className="collapsed">
      <HistoryCommitInspection
        commit={selectedCommit}
        dispatcher={props.dispatcher}
        state={props.state}
      />
    </div>
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
  readonly onCloneRepositoryAgain: (url: string) => void
  readonly preferAbsoluteDates: boolean
  readonly showConventionalCommitBadges: boolean
  readonly confirmStashActions: boolean
  readonly confirmWorktreeRemoval: boolean
  readonly showCommitLengthWarning: boolean
  readonly commitSummaryLengthWarningThreshold: number
  readonly showChangesFilter: boolean
  readonly showStashedChanges: boolean
}) {
  const [stashAction, setStashAction] = React.useState<WebStashAction | null>(
    null
  )
  const requestStashAction = React.useCallback(
    (action: WebStashAction | null) => {
      if (action === null) {
        setStashAction(null)
        return
      }
      if (!props.confirmStashActions) {
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
  const changesSelected = props.state.selectedSection === 'changes'
  const historySelected = props.state.selectedSection === 'history'
  const compareSelected = props.state.selectedSection === 'compare'
  const toolsSelected = props.state.selectedSection === 'repository-tools'
  const inspection = props.state.selectedRepositoryInspection
  const inspectedRepository =
    inspection &&
    props.state.repositories.find(
      repository => repository.path === inspection.path
    )

  if (inspection && inspection.kind !== 'regular') {
    const isUnsafe = inspection.kind === 'unsafe'
    return (
      <UiView id="missing-repository-view">
        <div className="title-container">
          <div className="title">
            {isUnsafe
              ? `${inspection.repositoryName} is potentially unsafe`
              : inspection.kind === 'bare'
              ? `${inspection.repositoryName} is a bare repository`
              : `Can't find "${inspection.repositoryName}"`}
          </div>
          <div className="details">
            {isUnsafe ? (
              <>
                <p>
                  The Git repository at{' '}
                  <strong>{inspection.unsafePath || inspection.path}</strong>{' '}
                  appears to be owned by another user on your machine.
                </p>
                <p>
                  Trust the repository only if you trust its owner and its
                  contents.
                </p>
              </>
            ) : inspection.kind === 'bare' ? (
              <p>
                Bare repositories are not currently supported by the web
                renderer.
              </p>
            ) : (
              <p>
                It was last seen at <strong>{inspection.path}</strong>.
              </p>
            )}
          </div>
        </div>
        <div className="row">
          {isUnsafe ? (
            <Button
              disabled={props.state.loading}
              onClick={async () => {
                await props.dispatcher.trustRepository(inspection.path)
                await props.dispatcher.selectRepository(inspection.path)
              }}
              type="button"
            >
              Trust repository
            </Button>
          ) : (
            <Button
              disabled={props.state.loading}
              onClick={() =>
                void props.dispatcher.selectRepository(inspection.path)
              }
              type="button"
            >
              Check again
            </Button>
          )}
          {!isUnsafe ? (
            <Button
              disabled={props.state.loading}
              onClick={() => props.onRelocateRepository(inspection.path)}
              type="button"
            >
              Relocate repository
            </Button>
          ) : null}
          {!isUnsafe && inspectedRepository?.remoteURL ? (
            <Button
              disabled={props.state.loading}
              onClick={() =>
                props.onCloneRepositoryAgain(inspectedRepository.remoteURL!)
              }
              type="button"
            >
              Clone repository again
            </Button>
          ) : null}
          <Button
            onClick={() => props.onRemoveRepository(inspection.path)}
            type="button"
          >
            Remove
          </Button>
        </div>
      </UiView>
    )
  }

  return (
    <UiView id="repository">
      <WebTutorialPanel dispatcher={props.dispatcher} state={props.state} />
      <WebOperationTaskStatus
        onCancel={() => void props.dispatcher.cancelOperation()}
        task={props.state.operationTask}
      />
      <FocusContainer>
        <Resizable
          description="Repository sidebar"
          id="repository-sidebar"
          maximumWidth={500}
          minimumWidth={220}
          onReset={() => props.onSidebarWidthChanged(250)}
          onResize={props.onSidebarWidthChanged}
          width={props.sidebarWidth}
        >
          <TabBar
            onTabClicked={index =>
              void props.dispatcher.selectSection(
                index === 0
                  ? 'changes'
                  : index === 1
                  ? 'history'
                  : index === 2
                  ? 'compare'
                  : 'repository-tools'
              )
            }
            selectedIndex={
              changesSelected
                ? 0
                : historySelected
                ? 1
                : compareSelected
                ? 2
                : 3
            }
          >
            <span className="with-indicator" id="changes-tab">
              <span>Changes</span>
            </span>
            <span className="with-indicator" id="history-tab">
              <span>History</span>
            </span>
            <span className="with-indicator" id="compare-tab">
              <span>Compare</span>
            </span>
            <span className="with-indicator" id="repository-tools-tab">
              <span>Tools</span>
            </span>
          </TabBar>
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
              commitSummaryLengthWarningThreshold={
                props.commitSummaryLengthWarningThreshold
              }
            />
          ) : historySelected ? (
            <DesktopHistoryView
              dispatcher={props.dispatcher}
              mode="sidebar"
              onSelectedSHAsChanged={props.onSelectedHistorySHAsChanged}
              preferAbsoluteDates={props.preferAbsoluteDates}
              selectedSHAs={props.selectedHistorySHAs}
              showConventionalCommitBadges={props.showConventionalCommitBadges}
              state={props.state}
            />
          ) : compareSelected ? (
            <DesktopCompareView
              dispatcher={props.dispatcher}
              mode="sidebar"
              state={props.state}
            />
          ) : toolsSelected ? (
            <section className="panel web-tools-sidebar-summary">
              <strong>Repository tools</strong>
              <p>
                Use the main pane to manage stashes, remotes, tags, and
                worktrees.
              </p>
            </section>
          ) : null}
        </Resizable>
      </FocusContainer>
      {changesSelected ? (
        <DesktopChangesView
          availableWidth={props.sidebarWidth - 1}
          dispatcher={props.dispatcher}
          mode="content"
          onStashActionChanged={requestStashAction}
          state={props.state}
          showCommitLengthWarning={props.showCommitLengthWarning}
          showChangesFilter={props.showChangesFilter}
          showStashedChanges={props.showStashedChanges}
          commitSummaryLengthWarningThreshold={
            props.commitSummaryLengthWarningThreshold
          }
        />
      ) : historySelected ? (
        <DesktopHistoryView
          dispatcher={props.dispatcher}
          mode="content"
          onSelectedSHAsChanged={props.onSelectedHistorySHAsChanged}
          preferAbsoluteDates={props.preferAbsoluteDates}
          selectedSHAs={props.selectedHistorySHAs}
          showConventionalCommitBadges={props.showConventionalCommitBadges}
          state={props.state}
        />
      ) : compareSelected ? (
        <DesktopCompareView
          dispatcher={props.dispatcher}
          mode="content"
          state={props.state}
        />
      ) : (
        <WebRepositoryToolsView
          dispatcher={props.dispatcher}
          onStashActionChanged={requestStashAction}
          confirmWorktreeRemoval={props.confirmWorktreeRemoval}
          state={props.state}
        />
      )}
      <WebConfirmDialog
        confirmLabel={
          stashAction?.operation === 'stash-pop'
            ? 'Pop stash'
            : stashAction?.operation === 'stash-drop'
            ? 'Drop stash'
            : 'Apply stash'
        }
        message={
          stashAction?.operation === 'stash-drop'
            ? `Drop ${
                stashAction.stash.customName ||
                stashAction.stash.name ||
                'this stash'
              }? Its saved changes will be permanently removed.`
            : `${stashAction?.operation === 'stash-pop' ? 'Pop' : 'Apply'} ${
                stashAction?.stash.customName ||
                stashAction?.stash.name ||
                'this stash'
              }? This changes the working directory.`
        }
        onConfirm={async () => {
          if (!stashAction) return
          await props.dispatcher.runOperation(stashAction.operation, {
            values: [stashAction.stash.name],
            ...(stashAction.operation === 'stash-drop'
              ? { confirmed: true }
              : {}),
          })
          setStashAction(null)
        }}
        onDismiss={() => setStashAction(null)}
        open={stashAction !== null}
        title={
          stashAction?.operation === 'stash-pop'
            ? 'Pop stash?'
            : stashAction?.operation === 'stash-drop'
            ? 'Drop stash?'
            : 'Apply stash?'
        }
      />
    </UiView>
  )
}

export function WebApp({ store, dispatcher }: WebAppProps) {
  const state = useApplicationState(store)
  const diffPreferences = useWebDiffPresentationPreferencesState()
  const [zoomFactor, setZoomFactor] = React.useState(() =>
    clampWebZoomFactor(getFloatNumber(webZoomFactorStorageKey, 1))
  )
  const [zoomAnnouncement, setZoomAnnouncement] = React.useState<string | null>(
    null
  )
  const [sidebarWidth, setSidebarWidth] = React.useState(() =>
    Math.min(500, Math.max(220, getNumber(webSidebarWidthStorageKey, 250)))
  )
  const [repositoryDialogOpen, setRepositoryDialogOpen] = React.useState(false)
  const [tutorialStartOpen, setTutorialStartOpen] = React.useState(false)
  const [preferencesOpen, setPreferencesOpen] = React.useState(false)
  const [browserNotificationsEnabled, setBrowserNotificationsEnabled] =
    React.useState(() =>
      getBoolean(webBrowserNotificationsEnabledStorageKey, true)
    )
  const [showChangesFilter, setShowChangesFilter] = React.useState(() =>
    getBoolean(webShowChangesFilterStorageKey, true)
  )
  const [showStashedChanges, setShowStashedChanges] = React.useState(() =>
    getBoolean(webShowStashedChangesStorageKey, true)
  )
  const [repositorySettingsTarget, setRepositorySettingsTarget] =
    React.useState<WebApplicationState['repositories'][number] | null>(null)
  const [repositoryRemovalPath, setRepositoryRemovalPath] = React.useState<
    string | null
  >(null)
  const [repositoryDeletionPath, setRepositoryDeletionPath] = React.useState<
    string | null
  >(null)
  const [permanentDeleteRecoveryPath, setPermanentDeleteRecoveryPath] =
    React.useState<string | null>(null)
  const [repositoryGroupToRename, setRepositoryGroupToRename] = React.useState<
    string | null
  >(null)
  const [repositoryRelocationPath, setRepositoryRelocationPath] =
    React.useState<string | null>(null)
  const [showBranchName, setShowBranchName] = React.useState<
    'never' | 'always' | 'non-default'
  >(() => {
    const value = localStorage.getItem('show-branch-name-in-repository-list')
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
  const [
    commitSummaryLengthWarningThreshold,
    setCommitSummaryLengthWarningThreshold,
  ] = React.useState(() =>
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
  const [showRecentRepositories, setShowRecentRepositories] = React.useState(
    () => getBoolean(webShowRecentRepositoriesStorageKey, true)
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
  const [repositorySortOrder, setRepositorySortOrder] =
    React.useState<WebRepositorySortOrder>(() => {
      const value = localStorage.getItem(webRepositorySortOrderStorageKey)
      return value === 'alphabetical' ? 'alphabetical' : 'recent'
    })
  const [editorIntegration, setEditorIntegration] =
    React.useState<WebIntegrationSelection>(() =>
      getStoredIntegrationSelection(webEditorIntegrationStorageKey)
    )
  const [shellIntegration, setShellIntegration] =
    React.useState<WebIntegrationSelection>(() =>
      getStoredIntegrationSelection(webShellIntegrationStorageKey)
    )
  const [menuAction, setMenuAction] = React.useState<{
    readonly id: number
    readonly action: WebMenuAction
  } | null>(null)
  const menuActionId = React.useRef(0)
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
      void dispatcher.addRepository(requestedPath)
    }
  }, [dispatcher, state.selectedRepositoryPath])

  const openRepositoryDialog = () => setRepositoryDialogOpen(true)
  const openCloneDialog = (url = '') => {
    setCloneURL(url)
    setInitialRepositoryPath(undefined)
    setRepositorySetupMode('clone')
  }
  const openInitDialog = (repositoryPath?: string) => {
    setInitialRepositoryPath(repositoryPath)
    setRepositorySetupMode('init')
  }
  const addRepository = async (path: string) => {
    await dispatcher.addRepository(path)
    setRepositoryDialogOpen(false)
  }
  const cloneRepository = async (
    url: string,
    path: string,
    branch?: string
  ) => {
    await dispatcher.cloneRepository(url, path, branch)
    setRepositorySetupMode(null)
    setCloneURL('')
  }
  const initializeRepository = async (
    options: WebRepositoryInitializationOptions
  ) => {
    await dispatcher.initializeRepository(options)
    setRepositorySetupMode(null)
  }
  const openRepositorySettings = async (
    repository: WebApplicationState['repositories'][number]
  ) => {
    if (repository.path !== state.selectedRepositoryPath)
      await dispatcher.selectRepository(repository.path)
    setRepositorySettingsTarget(repository)
  }
  const saveRepositorySettings = (
    alias: string,
    group: string | null,
    defaultBranch: string | null
  ) => {
    dispatcher.setRepositoryAlias(alias)
    dispatcher.setRepositoryGroup(group)
    void dispatcher
      .setRepositoryDefaultBranch(defaultBranch)
      .finally(() => setRepositorySettingsTarget(null))
  }
  const updateShowBranchName = (value: 'never' | 'always' | 'non-default') => {
    localStorage.setItem('show-branch-name-in-repository-list', value)
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
  const updateCommitSummaryLengthWarningThreshold = (value: number) => {
    const threshold = Math.min(72, Math.max(1, Math.round(value) || 50))
    setNumber(webCommitSummaryLengthWarningThresholdStorageKey, threshold)
    setCommitSummaryLengthWarningThreshold(threshold)
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
  const updateShowRecentRepositories = (value: boolean) => {
    setBoolean(webShowRecentRepositoriesStorageKey, value)
    setShowRecentRepositories(value)
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
  const updateRepositorySortOrder = (value: WebRepositorySortOrder) => {
    localStorage.setItem(webRepositorySortOrderStorageKey, value)
    setRepositorySortOrder(value)
  }
  const updateEditorIntegration = (value: WebIntegrationSelection) => {
    setStoredIntegrationSelection(webEditorIntegrationStorageKey, value)
    setEditorIntegration(value)
  }
  const updateShellIntegration = (value: WebIntegrationSelection) => {
    setStoredIntegrationSelection(webShellIntegrationStorageKey, value)
    setShellIntegration(value)
  }
  const requestMenuAction = (action: WebMenuAction) => {
    menuActionId.current += 1
    setMenuAction({ id: menuActionId.current, action })
  }
  const runSelectedIntegration = (kind: 'editor' | 'shell') => {
    const selection = kind === 'editor' ? editorIntegration : shellIntegration
    void dispatcher.launchIntegration(kind, selection.name, selection.custom)
  }
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen()
  }
  const resizeActivePanel = (direction: 'increase' | 'decrease') => {
    updateSidebarWidth(sidebarWidth + (direction === 'increase' ? 20 : -20))
  }
  const updateBrowserNotificationsEnabled = (value: boolean) => {
    setBoolean(webBrowserNotificationsEnabledStorageKey, value)
    setBrowserNotificationsEnabled(value)
  }
  const updateShowChangesFilter = (value: boolean) => {
    setBoolean(webShowChangesFilterStorageKey, value)
    setShowChangesFilter(value)
  }
  const updateShowStashedChanges = (value: boolean) => {
    setBoolean(webShowStashedChangesStorageKey, value)
    setShowStashedChanges(value)
  }
  const updateSidebarWidth = (width: number) => {
    const normalized = Math.min(500, Math.max(220, Math.round(width)))
    setNumber(webSidebarWidthStorageKey, normalized)
    setSidebarWidth(normalized)
  }
  const updateZoomFactor = (value: number) => {
    const normalized = clampWebZoomFactor(value)
    setNumber(webZoomFactorStorageKey, normalized)
    setZoomFactor(normalized)
    setZoomAnnouncement(`Zoom ${Math.round(normalized * 100)}%`)
  }
  const zoomIn = () => updateZoomFactor(zoomFactor + 0.05)
  const zoomOut = () => updateZoomFactor(zoomFactor - 0.05)
  const resetZoom = () => updateZoomFactor(1)

  React.useEffect(() => {
    if (!zoomAnnouncement) return
    const timeout = window.setTimeout(() => setZoomAnnouncement(null), 1000)
    return () => window.clearTimeout(timeout)
  }, [zoomAnnouncement])
  const requestRepositoryRemoval = (path: string) => {
    if (!confirmRepositoryRemoval) {
      dispatcher.removeRepository(path)
      return
    }
    setRepositoryRemovalPath(path)
  }
  const requestRepositoryDeletion = (path: string) => {
    setRepositoryDeletionPath(path)
  }
  const deleteRepository = async (
    mode: WebRepositoryDeleteMode
  ): Promise<boolean> => {
    if (!repositoryDeletionPath) return false
    await dispatcher.deleteRepository(repositoryDeletionPath, mode)
    return !store.getState().error
  }
  const choosePermanentDeleteRecovery = () => {
    if (!repositoryDeletionPath || state.errorCode !== 'trash-failed') return
    setPermanentDeleteRecoveryPath(repositoryDeletionPath)
    dispatcher.dismissError()
  }
  const confirmPermanentDeleteRecovery = async () => {
    if (!permanentDeleteRecoveryPath) return
    await dispatcher.deleteRepository(permanentDeleteRecoveryPath, 'permanent')
    if (!store.getState().error) {
      setPermanentDeleteRecoveryPath(null)
      setRepositoryDeletionPath(null)
    }
  }
  const openRepositoryRelocation = (path: string) => {
    setRepositoryRelocationPath(path)
  }
  const relocateRepository = async (newPath: string) => {
    if (!repositoryRelocationPath) return
    await dispatcher.relocateRepository(repositoryRelocationPath, newPath)
    setRepositoryRelocationPath(null)
  }

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
              onOpenPreferences={() => setPreferencesOpen(true)}
              onOpenRepositoryDialog={openRepositoryDialog}
              onCreateTutorialRepository={() => {
                void dispatcher.loadRepositorySetupOptions()
                setTutorialStartOpen(true)
              }}
              onResumeTutorialRepository={() =>
                void dispatcher.resumeTutorial()
              }
              tutorialPaused={state.tutorialPaused}
            />
            <RepositoryPathDialog
              onChooseDirectory={() => dispatcher.chooseDirectory()}
              onDismiss={() => setRepositoryDialogOpen(false)}
              onCreateRepository={path => {
                setRepositoryDialogOpen(false)
                openInitDialog(path)
              }}
              onInspect={path => dispatcher.inspectRepository(path)}
              onTrust={path => dispatcher.trustRepository(path)}
              onSubmit={addRepository}
              open={repositoryDialogOpen}
            />
            <RepositorySetupDialog
              initialRepositoryPath={initialRepositoryPath}
              initialURL={cloneURL}
              mode={repositorySetupMode || 'clone'}
              dispatcher={dispatcher}
              onChooseDirectory={() => dispatcher.chooseDirectory()}
              onClone={cloneRepository}
              onDismiss={() => {
                setRepositorySetupMode(null)
                setCloneURL('')
                setInitialRepositoryPath(undefined)
              }}
              onInit={initializeRepository}
              open={repositorySetupMode !== null}
              setupOptions={state.repositorySetupOptions}
            />
          </>
        ) : state.tutorialPaused ? (
          <>
            <DesktopHome
              diffPreferences={diffPreferences}
              dispatcher={dispatcher}
              onOpenCloneDialog={openCloneDialog}
              onOpenInitDialog={() => openInitDialog()}
              onOpenPreferences={() => setPreferencesOpen(true)}
              onOpenRepositoryDialog={openRepositoryDialog}
              onCreateTutorialRepository={() => {
                void dispatcher.loadRepositorySetupOptions()
                setTutorialStartOpen(true)
              }}
              onResumeTutorialRepository={() =>
                void dispatcher.resumeTutorial()
              }
              tutorialPaused={state.tutorialPaused}
            />
            <RepositoryPathDialog
              onChooseDirectory={() => dispatcher.chooseDirectory()}
              onDismiss={() => setRepositoryDialogOpen(false)}
              onCreateRepository={path => {
                setRepositoryDialogOpen(false)
                openInitDialog(path)
              }}
              onInspect={path => dispatcher.inspectRepository(path)}
              onTrust={path => dispatcher.trustRepository(path)}
              onSubmit={addRepository}
              open={repositoryDialogOpen}
            />
            <RepositorySetupDialog
              initialRepositoryPath={initialRepositoryPath}
              initialURL={cloneURL}
              mode={repositorySetupMode || 'clone'}
              dispatcher={dispatcher}
              onChooseDirectory={() => dispatcher.chooseDirectory()}
              onClone={cloneRepository}
              onDismiss={() => {
                setRepositorySetupMode(null)
                setCloneURL('')
                setInitialRepositoryPath(undefined)
              }}
              onInit={initializeRepository}
              open={repositorySetupMode !== null}
              setupOptions={state.repositorySetupOptions}
            />
          </>
        ) : (
          <>
            <DesktopAppChrome
              diffFontFamily={diffPreferences.diffFontFamily}
              diffFontSize={diffPreferences.diffFontSize}
              tabSize={diffPreferences.tabSize}
              theme={diffPreferences.theme}
              zoomFactor={zoomFactor}
              menu={{
                onCommit: dispatcher.requestCommitDialog,
                onOpenCloneDialog: openCloneDialog,
                onOpenInitDialog: () => openInitDialog(),
                onOpenPreferences: () => setPreferencesOpen(true),
                onOpenRepositoryDialog: openRepositoryDialog,
                onResetZoom: resetZoom,
                onRefresh: () => void dispatcher.refresh(),
                onRunOperation: (operation, options) =>
                  void dispatcher.runOperation(operation, options),
                onZoomIn: zoomIn,
                onZoomOut: zoomOut,
                onToggleChangesFilter: () =>
                  updateShowChangesFilter(!showChangesFilter),
                onToggleStashedChanges: () =>
                  updateShowStashedChanges(!showStashedChanges),
                showChangesFilter,
                showStashedChanges,
                zoomFactor,
                onSelectSection: section =>
                  void dispatcher.selectSection(section),
                onEdit: action => {
                  if (action === 'find') {
                    const event = new CustomEvent('find-text', {
                      bubbles: true,
                      cancelable: true,
                    })
                    if (document.activeElement !== null) {
                      document.activeElement.dispatchEvent(event)
                    } else {
                      document.dispatchEvent(event)
                    }
                    return
                  }
                  document.execCommand(action)
                },
                onRequestAction: requestMenuAction,
                onToggleFullscreen: toggleFullscreen,
                onResize: resizeActivePanel,
                onRemoveRepository: () => {
                  if (state.selectedRepositoryPath)
                    requestRepositoryRemoval(state.selectedRepositoryPath)
                },
                onOpenShell: () => runSelectedIntegration('shell'),
                onOpenEditor: () => runSelectedIntegration('editor'),
                onRevealRepository: () => {
                  if (state.selectedRepositoryPath)
                    void dispatcher.openPath(state.selectedRepositoryPath, true)
                },
                onOpenRepositorySettings: () => {
                  if (selectedRepository)
                    void openRepositorySettings(selectedRepository)
                },
                onManageRemotes: () =>
                  void dispatcher.selectSection('repository-tools'),
                onOpenExternal: url => dispatcher.openExternal(url),
              }}
            >
              <DesktopToolbar
                dispatcher={dispatcher}
                onOpenRepositoryDialog={openRepositoryDialog}
                onOpenPreferences={() => setPreferencesOpen(true)}
                onOpenRepositorySettings={repository =>
                  void openRepositorySettings(repository)
                }
                onRemoveRepository={requestRepositoryRemoval}
                onDeleteRepository={requestRepositoryDeletion}
                branchSortOrder={branchSortOrder}
                onBranchSortOrderChanged={updateBranchSortOrder}
                sidebarWidth={sidebarWidth}
                showBranchName={showBranchName}
                showWorktreesInRepositoryList={showWorktreesInRepositoryList}
                repositoryIndicatorsEnabled={repositoryIndicatorsEnabled}
                showRecentRepositories={showRecentRepositories}
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
                repositorySortOrder={repositorySortOrder}
                uncommittedChangesStrategy={uncommittedChangesStrategy}
                menuAction={menuAction || undefined}
                onMenuActionHandled={() => setMenuAction(null)}
                state={state}
              />
              <DesktopRepositoryView
                dispatcher={dispatcher}
                onSidebarWidthChanged={updateSidebarWidth}
                onSelectedHistorySHAsChanged={updateSelectedHistorySHAs}
                selectedHistorySHAs={selectedHistorySHAs}
                sidebarWidth={sidebarWidth}
                state={state}
                onRemoveRepository={requestRepositoryRemoval}
                onRelocateRepository={openRepositoryRelocation}
                onCloneRepositoryAgain={openCloneDialog}
                preferAbsoluteDates={preferAbsoluteDates}
                showConventionalCommitBadges={showConventionalCommitBadges}
                confirmStashActions={confirmStashActions}
                confirmWorktreeRemoval={confirmWorktreeRemoval}
                showCommitLengthWarning={showCommitLengthWarning}
                showChangesFilter={showChangesFilter}
                showStashedChanges={showStashedChanges}
                commitSummaryLengthWarningThreshold={
                  commitSummaryLengthWarningThreshold
                }
              />
              <ErrorDialog
                canRetry={state.canRetry}
                dispatcher={dispatcher}
                error={state.error}
                errorCode={state.errorCode}
                configLockScope={state.configLockScope}
                hookFailure={state.hookFailure}
                operationOutput={state.operationOutput}
                onRefreshRepository={() => void dispatcher.refresh()}
                onChoosePermanentDelete={choosePermanentDeleteRecovery}
              />
            </DesktopAppChrome>
            {zoomAnnouncement ? (
              <div
                aria-label="Browser zoom"
                aria-live="polite"
                className="web-zoom-announcement"
                role="status"
              >
                {zoomAnnouncement}
              </div>
            ) : null}
            <RepositoryPathDialog
              onChooseDirectory={() => dispatcher.chooseDirectory()}
              onDismiss={() => setRepositoryDialogOpen(false)}
              onCreateRepository={path => {
                setRepositoryDialogOpen(false)
                openInitDialog(path)
              }}
              onInspect={path => dispatcher.inspectRepository(path)}
              onTrust={path => dispatcher.trustRepository(path)}
              onSubmit={addRepository}
              open={repositoryDialogOpen}
            />
            <RepositorySetupDialog
              initialRepositoryPath={initialRepositoryPath}
              initialURL={cloneURL}
              mode={repositorySetupMode || 'clone'}
              dispatcher={dispatcher}
              onChooseDirectory={() => dispatcher.chooseDirectory()}
              onClone={cloneRepository}
              onDismiss={() => {
                setRepositorySetupMode(null)
                setCloneURL('')
                setInitialRepositoryPath(undefined)
              }}
              onInit={initializeRepository}
              open={repositorySetupMode !== null}
              setupOptions={state.repositorySetupOptions}
            />
            <WebRepositorySettingsDialog
              branches={state.branches?.branches || []}
              onDismiss={() => setRepositorySettingsTarget(null)}
              onSave={saveRepositorySettings}
              open={repositorySettingsTarget !== null}
              repository={repositorySettingsTarget}
            />
          </>
        )}
        <WebPreferencesDialog
          branchSortOrder={branchSortOrder}
          browserNotificationsEnabled={browserNotificationsEnabled}
          dispatcher={dispatcher}
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
          commitSummaryLengthWarningThreshold={
            commitSummaryLengthWarningThreshold
          }
          onCommitSummaryLengthWarningThresholdChanged={
            updateCommitSummaryLengthWarningThreshold
          }
          uncommittedChangesStrategy={uncommittedChangesStrategy}
          onUncommittedChangesStrategyChanged={updateUncommittedChangesStrategy}
          showRecentRepositories={showRecentRepositories}
          onShowRecentRepositoriesChanged={updateShowRecentRepositories}
          showChangesFilter={showChangesFilter}
          onShowChangesFilterChanged={updateShowChangesFilter}
          showStashedChanges={showStashedChanges}
          onShowStashedChangesChanged={updateShowStashedChanges}
          integrations={state.integrations}
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
          repositorySortOrder={repositorySortOrder}
          onRepositorySortOrderChanged={updateRepositorySortOrder}
        />
        <RepositoryPathDialog
          onChooseDirectory={() => dispatcher.chooseDirectory()}
          description="Enter the new absolute path for this remembered repository."
          onDismiss={() => setRepositoryRelocationPath(null)}
          onInspect={path => dispatcher.inspectRepository(path)}
          onSubmit={relocateRepository}
          onTrust={path => dispatcher.trustRepository(path)}
          open={repositoryRelocationPath !== null}
          submitLabel="Relocate repository"
          title="Relocate repository"
        />
        <WebTextDialog
          description="Rename this repository group. All repositories in the group will keep their current settings."
          initialValue={repositoryGroupToRename || ''}
          label="Group name"
          onDismiss={() => setRepositoryGroupToRename(null)}
          onSubmit={async value => {
            if (repositoryGroupToRename)
              dispatcher.renameRepositoryGroup(
                repositoryGroupToRename,
                value.trim() || null
              )
            setRepositoryGroupToRename(null)
          }}
          open={repositoryGroupToRename !== null}
          submitLabel="Rename group"
          title={`Rename group: ${repositoryGroupToRename || ''}`}
        />
        <WebConfirmDialog
          confirmLabel="Remove repository"
          message={`Remove ${
            state.repositories.find(item => item.path === repositoryRemovalPath)
              ?.name || 'this repository'
          } from Desktop Plus? The repository files will remain on disk.`}
          onConfirm={async () => {
            if (repositoryRemovalPath)
              dispatcher.removeRepository(repositoryRemovalPath)
            setRepositoryRemovalPath(null)
          }}
          onDismiss={() => setRepositoryRemovalPath(null)}
          open={repositoryRemovalPath !== null}
          title="Remove repository?"
        />
        <WebDeleteRepositoryDialog
          loading={state.loading}
          onConfirm={deleteRepository}
          onDismiss={() => setRepositoryDeletionPath(null)}
          open={repositoryDeletionPath !== null}
          repositoryName={
            state.repositories.find(
              repository => repository.path === repositoryDeletionPath
            )?.name || 'this repository'
          }
        />
        <WebConfirmDialog
          confirmLabel="Delete permanently"
          message={`Permanently delete ${
            state.repositories.find(
              repository => repository.path === permanentDeleteRecoveryPath
            )?.name || 'this repository'
          } and all of its files? Moving it to the macOS Trash failed, so this action cannot be undone.`}
          onConfirm={confirmPermanentDeleteRecovery}
          onDismiss={() => setPermanentDeleteRecoveryPath(null)}
          open={permanentDeleteRecoveryPath !== null}
          title="Delete repository permanently?"
        />
        <WebTutorialStartDialog
          defaultParentPath={
            state.repositorySetupOptions?.defaultParentPath || ''
          }
          loading={state.loading}
          onChooseDirectory={() => dispatcher.chooseDirectory()}
          onDismiss={() => setTutorialStartOpen(false)}
          onSubmit={async parentPath => {
            await dispatcher.createTutorialRepository(parentPath)
            setTutorialStartOpen(false)
          }}
          open={tutorialStartOpen}
        />
      </WebDiffPresentationPreferencesContext.Provider>
    </WebIntegrationPreferencesContext.Provider>
  )
}
