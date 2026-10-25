import * as React from 'react'
import { CommittedFileChange } from '../../models/status'
import { Commit } from '../../models/commit'
import { DEFAULT_BRANCH_SORT_ORDER } from '../../models/branch-sort-order'
import {
  CommitGraphSidebar,
  CompareSidebar,
  SelectedCommits,
} from '../../ui/history'
import { Repository } from '../../models/repository'
import { Branch, BranchType } from '../../models/branch'
import { Popup, PopupType } from '../../models/popup'
import type { Dispatcher } from '../../ui/dispatcher'
import { getNumber, setNumber } from '../../lib/local-storage'
import { WebApplicationState, WebDispatcher } from './contracts'
import { ICommitContext } from '../../models/commit'
import {
  ComparisonMode,
  HistoryTabMode,
  ICompareState,
} from '../../lib/app-state'
import { AheadBehindStore } from '../../lib/stores/ahead-behind-store'
import {
  CommitMessagePopup,
  HistoryRewriteKind,
  getDesktopBranch,
  getDesktopCommit,
  getDesktopRepository,
  formatCommitContextMessage,
  getDesktopCommittedFile,
  getDesktopSubmoduleDiff,
  getDesktopDiff,
} from './models'
import {
  repositoryViewStorageKey,
  webCompareScrollStorageKey,
  useWebDiffPresentationPreferences,
} from './preferences'
import {
  DesktopResetWarningDialog,
  DesktopCreateBranchAtCommitDialog,
  DesktopCreateTagDialog,
  DesktopConfirmCheckoutCommitDialog,
  DesktopChooseCherryPickTargetDialog,
  DesktopConfirmDeletePushedTagDialog,
  DesktopDeleteTagDialog,
} from './operation-dialogs'

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
  readonly onRevertCommits: (commits: ReadonlyArray<Commit>) => void
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
        // ponytail: the web history API has no author-options endpoint; keep
        // the upstream lifecycle call harmless until author autocomplete is
        // supported by the web port.
        commitGraph_loadFilterAuthors: () => Promise.resolve(),
        // updateCompareForm already fetches 100 server-filtered matches, more
        // than the native graph's minimum; scrolling loads subsequent pages.
        commitGraph_ensureEnoughFilteredCommits: () => Promise.resolve(),
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
    filteredHistoryCommitSearchQuery: props.state.historyFilterText,
    tip: props.state.branches?.branch?.tip?.sha || null,
    allHistoryCommitSHAs: historySHAs,
    commitGraphCommitSHAs: historySHAs,
    commitGraphCollapsedBranchGroups: props.state.historyGraphCollapsedGroups,
    commitGraphHiddenBranchRefs: hiddenRefs,
    commitGraphFilterAuthorsList: null,
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
      onRevertCommits={props.onRevertCommits}
      onViewCommitOnGitHub={() => undefined}
      repository={repository}
      selectedCommitShas={props.selectedSHAs}
      shasToHighlight={[]}
      showConventionalCommitBadges={props.showConventionalCommitBadges}
      preferAbsoluteDates={props.preferAbsoluteDates}
      showViewModeSwitches={true}
      tagsToPush={props.state.branches?.tagsToPush || []}
    />
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
      fileTreeView={preferences.fileTreeView}
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

export function DesktopHistoryView(props: {
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
          onRevertCommits={commits =>
            void props.dispatcher.runOperation('revert', {
              values: commits.map(commit => commit.sha),
            })
          }
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

export function DesktopCompareView(props: {
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
    commitGraphFilterAuthorsList: null,
    commitGraphRefs: [],
    commitSearchQuery: '',
    filteredHistoryCommitSearchQuery: '',
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
          onRevertCommits={commits =>
            void props.dispatcher.runOperation('revert', {
              values: commits.map(commit => commit.sha),
            })
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
