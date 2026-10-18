import * as React from 'react'
import { NoRepositoriesView } from '../../ui/no-repositories/no-repositories-view'
import { MissingRepository } from '../../ui/missing-repository'
import { AppContents, FocusedAppChrome } from '../../ui/app-chrome'
import { DialogStackContext } from '../../ui/dialog/dialog'
import { ApplicationTheme } from '../../ui/lib/application-theme'
import { TutorialPanel } from '../../ui/tutorial'
import { ConflictsDialog } from '../../ui/multi-commit-operation/dialog/conflicts-dialog'
import { ConfirmAbortDialog } from '../../ui/multi-commit-operation/dialog/confirm-abort-dialog'
import { ConflictsFoundBanner } from '../../ui/banners/conflicts-found-banner'
import { renderBanner } from '../../ui/banners'
import { CommitMessageDialog } from '../../ui/commit-message/commit-message-dialog'
import { AppFileStatusKind, WorkingDirectoryStatus } from '../../models/status'
import { CommitIdentity } from '../../models/commit-identity'
import { Repository } from '../../models/repository'
import { DiffFontFamily } from '../../models/diff-font'
import { BannerType } from '../../models/banner'
import type { Dispatcher } from '../../ui/dispatcher'
import { RepositoryLayout } from '../../ui/repository-layout'
import { RepositoryTabs } from '../../ui/repository-tabs'
import {
  WebApplicationState,
  WebDispatcher,
  WebIntegrationSelection,
} from './contracts'
import { TutorialStep } from '../../models/tutorial-step'
import { RepoRulesInfo } from '../../models/repo-rules'
import { RepositorySectionTab } from '../../lib/app-state'
import { MultiCommitOperationKind } from '../../models/multi-commit-operation'
import { ManualConflictResolution } from '../../models/manual-conflict-resolution'
import { WebDiffPresentationPreferences, webSidebarWidth } from './preferences'
import {
  getDesktopRepository,
  WebStashAction,
  CommitMessagePopup,
  HistoryRewriteKind,
  getDesktopWorkingDirectoryFile,
} from './models'
import { DesktopChangesView } from './changes'
import { DesktopHistoryView, DesktopCompareView } from './history'
import {
  DesktopCommitProgressDialog,
  DesktopConfirmDiscardStashDialog,
} from './operation-dialogs'

export function DesktopAppChrome(props: {
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

export function DesktopHome(props: {
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

export function DesktopRepositoryView(props: {
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
