import * as React from 'react'
import { DialogStackContext } from '../../ui/dialog/dialog'
import {
  ApplicationToolbar,
  BranchDropdown,
  PushPullButton,
  RepositoryToolbarDropdown,
  WorktreeDropdown,
  ToolbarActionMenu,
  ToolbarActionMenuItem,
} from '../../ui/toolbar'
import * as octicons from '../../ui/octicons/octicons.generated'
import { AddRemoteDialog } from '../../ui/manage-remotes/add-remote-dialog'
import { ManageRemotesDialog } from '../../ui/manage-remotes/manage-remotes-dialog'
import { OpenWithExternalEditor } from '../../ui/open-with-external-editor/open-with-external-editor'
import { CreateBranch } from '../../ui/create-branch/create-branch-dialog'
import { RenameBranch } from '../../ui/rename-branch/rename-branch-dialog'
import { AddWorktreeDialog } from '../../ui/worktrees/add-worktree-dialog'
import { RenameWorktreeDialog } from '../../ui/worktrees/rename-worktree-dialog'
import { DeleteWorktreeDialog } from '../../ui/worktrees/delete-worktree-dialog'
import { DeleteWorktreeFailedDialog } from '../../ui/worktrees/delete-worktree-failed-dialog'
import { MergeChooseBranchDialog } from '../../ui/multi-commit-operation/choose-branch/merge-choose-branch-dialog'
import { RebaseChooseBranchDialog } from '../../ui/multi-commit-operation/choose-branch/rebase-choose-branch-dialog'
import { BranchSortOrder } from '../../models/branch-sort-order'
import { Repository } from '../../models/repository'
import { IRemote } from '../../models/remote'
import { Branch, BranchType } from '../../models/branch'
import { BranchesTab } from '../../models/branches-tab'
import { Popup, PopupType } from '../../models/popup'
import { Tip, TipState } from '../../models/tip'
import { FoldoutType } from '../../lib/app-state'
import type { Progress } from '../../models/progress'
import type { Dispatcher } from '../../ui/dispatcher'
import { getNumber, setNumber } from '../../lib/local-storage'
import {
  WebApplicationState,
  WebDispatcher,
  WebBranch,
  WebOperationOptions,
  WebOperationTask,
} from './contracts'
import { UncommittedChangesStrategy } from '../../models/uncommitted-changes-strategy'
import { IRepositoryState } from '../../lib/app-state'
import { getCurrentBranchForcePushState } from '../../lib/rebase'
import { MultiCommitOperationKind } from '../../models/multi-commit-operation'
import {
  useWebIntegrationSelection,
  webToolbarButtonWidth,
  webBranchDropdownWidthStorageKey,
  webPushPullButtonWidthStorageKey,
  webWorktreeDropdownWidthStorageKey,
  getStoredUpdateBranchStrategy,
} from './preferences'
import { getDesktopRepository, getDesktopBranch } from './models'
import { DesktopRepositoryPicker } from './repository-picker'
import {
  DesktopDiscardChangesDialog,
  DesktopConfirmForcePushDialog,
  DesktopStashAndSwitchBranchDialog,
  DesktopDeleteRemoteBranchDialog,
  DesktopDeleteBranchDialog,
  DesktopDeleteUnusedLocalBranchesDialog,
} from './operation-dialogs'

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

export function DesktopToolbar(props: {
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
  const [deleteUnusedLocalBranches, setDeleteUnusedLocalBranches] =
    React.useState<ReadonlyArray<WebBranch> | null>(null)
  const [manageRemotesOpen, setManageRemotesOpen] = React.useState(false)
  const [addRemoteOpen, setAddRemoteOpen] = React.useState(false)
  const [remoteToEdit, setRemoteToEdit] = React.useState<IRemote | undefined>()
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
          readonly branches?: ReadonlyArray<Branch>
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
              setDeleteUnusedLocalBranches(
                popup.branches?.flatMap(
                  branch =>
                    props.state.branches?.branches?.filter(
                      candidate =>
                        candidate.type === 'Local' &&
                        candidate.ref === branch.ref
                    ) || []
                ) || []
              )
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
      setDeleteUnusedLocalBranches(props.state.branches?.mergedBranches || [])
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
        action: () =>
          setDeleteUnusedLocalBranches(
            props.state.branches?.mergedBranches || []
          ),
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

  const remoteDispatcher = React.useMemo(
    () =>
      ({
        getRemotes: () =>
          Promise.resolve(
            (props.state.branches?.remotes || []).map(remote => ({
              name: remote.name,
              url: remote.url,
            }))
          ),
        postError: () => Promise.resolve(),
        addRemote: (_repository: Repository, name: string, url: string) =>
          props.dispatcher.runOperationOrThrow('remote-add', {
            values: [name, url],
          }),
        removeRemote: (_repository: Repository, name: string) =>
          props.dispatcher.runOperationOrThrow('remote-remove', {
            values: [name],
          }),
        setRemoteURL: (_repository: Repository, name: string, url: string) =>
          props.dispatcher.runOperationOrThrow('remote-set-url', {
            values: [name, url],
          }),
        showPopup: (popup: Popup) => {
          if (popup.type === PopupType.AddRemote) {
            setRemoteToEdit(popup.remote)
            setAddRemoteOpen(true)
          }
          return Promise.resolve()
        },
      } as unknown as Dispatcher),
    [props.dispatcher, props.state.branches?.remotes]
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
      {deleteUnusedLocalBranches && props.state.selectedRepositoryPath ? (
        <DesktopDeleteUnusedLocalBranchesDialog
          branches={deleteUnusedLocalBranches}
          dispatcher={props.dispatcher}
          onDeleted={() => undefined}
          onDismiss={() => setDeleteUnusedLocalBranches(null)}
          repositoryPath={props.state.selectedRepositoryPath}
        />
      ) : null}
      {manageRemotesOpen && props.state.selectedRepositoryPath ? (
        <DialogStackContext.Provider value={{ isTopMost: !addRemoteOpen }}>
          <ManageRemotesDialog
            dispatcher={remoteDispatcher}
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
            dispatcher={remoteDispatcher}
            existingRemoteNames={(props.state.branches?.remotes || []).map(
              remote => remote.name
            )}
            onDismissed={() => {
              setAddRemoteOpen(false)
              setRemoteToEdit(undefined)
            }}
            remote={remoteToEdit}
            repository={getDesktopRepository(
              props.state.selectedRepositoryPath
            )}
          />
        </DialogStackContext.Provider>
      ) : null}
    </>
  )
}
