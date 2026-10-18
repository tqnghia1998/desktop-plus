import * as React from 'react'
import { DialogStackContext } from '../../ui/dialog/dialog'
import { Changes, ChangesSidebar } from '../../ui/changes'
import { NoChanges } from '../../ui/changes/no-changes'
import { StashDiffViewer } from '../../ui/stashing'
import { DiscardSelection } from '../../ui/discard-changes/discard-selection-dialog'
import { ConfirmCommitFilteredChanges } from '../../ui/changes/confirm-commit-filtered-changes-dialog'
import {
  CommittedFileChange,
  WorkingDirectoryFileChange,
  WorkingDirectoryStatus,
} from '../../models/status'
import { StashedChangesLoadStates } from '../../models/stash-entry'
import {
  DiffLineType,
  DiffSelection,
  DiffSelectionType,
  ITextDiff,
} from '../../models/diff'
import { CommitIdentity } from '../../models/commit-identity'
import { ConfirmDiscardStashDialog } from '../../ui/stashing/confirm-discard-stash'
import { RenameStashDialog } from '../../ui/stashing/rename-stash-dialog'
import { DiffType } from '../../models/diff'
import {
  formatPatch,
  formatPatchToDiscardChanges,
} from '../../lib/patch-formatter'
import { Repository } from '../../models/repository'
import { PopupType } from '../../models/popup'
import { TipState } from '../../models/tip'
import type { Dispatcher } from '../../ui/dispatcher'
import { getNumber, setBoolean, setNumber } from '../../lib/local-storage'
import {
  WebApplicationState,
  WebDispatcher,
  WebFile,
  WebDiff,
  WebStash,
} from './contracts'
import { RepoRulesInfo } from '../../models/repo-rules'
import { ICommitMessage } from '../../models/commit-message'
import { ICommitContext } from '../../models/commit'
import {
  ChangesSelectionKind,
  IChangesState,
  IRepositoryState,
} from '../../lib/app-state'
import {
  WebStashAction,
  getDesktopWorkingDirectoryFile,
  getDesktopRepository,
  getDesktopCommit,
  getDesktopSubmoduleDiff,
  getDesktopDiff,
  webSuggestedActionsMenu,
  getDesktopBranch,
  getDesktopFileStatus,
} from './models'
import {
  useWebDiffPresentationPreferences,
  repositoryViewStorageKey,
  webChangesScrollStorageKey,
  webConfirmDiscardChangesStorageKey,
} from './preferences'
import {
  DesktopDiscardChangesDialog,
  DesktopRenameStashDialog,
} from './operation-dialogs'

export function DesktopChangesView(props: {
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
  const preferences = useWebDiffPresentationPreferences()
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
        setFileTreeView: preferences.onFileTreeViewChanged,
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
      preferences.onFileTreeViewChanged,
      sourceFiles,
      webStashBySha,
    ]
  )

  if (props.mode === 'sidebar') {
    return (
      <>
        <ChangesSidebar
          accounts={[]}
          fileTreeView={preferences.fileTreeView}
          showViewModeSwitches={true}
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
        fileTreeView={preferences.fileTreeView}
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
