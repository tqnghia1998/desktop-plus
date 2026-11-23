import * as React from 'react'
import { AppError } from '../../ui/app-error'
import { GenericGitAuthentication } from '../../ui/generic-git-auth'
import { AddSSHHost } from '../../ui/ssh/add-ssh-host'
import { SSHKeyPassphrase } from '../../ui/ssh/ssh-key-passphrase'
import { SSHUserPassword } from '../../ui/ssh/ssh-user-password'
import { HookFailed } from '../../ui/hook-failed/hook-failed'
import { DialogStackContext } from '../../ui/dialog/dialog'
import { CreateTag } from '../../ui/create-tag/create-tag-dialog'
import { DeleteTag } from '../../ui/delete-tag/delete-tag-dialog'
import { DeleteBranch } from '../../ui/delete-branch/delete-branch-dialog'
import { DeleteRemoteBranch } from '../../ui/delete-branch/delete-remote-branch-dialog'
import { DeleteUnusedLocalBranches } from '../../ui/delete-branch/delete-unused-local-branches-dialog'
import { ConfirmCheckoutCommitDialog } from '../../ui/checkout/confirm-checkout-commit'
import { DiscardChanges } from '../../ui/discard-changes/discard-changes-dialog'
import { ConfirmDeletePushedTagDialog } from '../../ui/tag/confirm-delete-pushed-tag'
import { CreateBranch } from '../../ui/create-branch/create-branch-dialog'
import { WarnResetToPushedCommit } from '../../ui/reset/warn-reset-to-pushed-commit'
import { ConfirmForcePush } from '../../ui/rebase/confirm-force-push'
import { StashAndSwitchBranch } from '../../ui/stash-changes/stash-and-switch-branch-dialog'
import { ChooseTargetBranchDialog } from '../../ui/multi-commit-operation/choose-branch/choose-target-branch'
import { CommitProgress } from '../../ui/commit-progress/commit-progress'
import { WorkingDirectoryFileChange } from '../../models/status'
import { StashedChangesLoadStates } from '../../models/stash-entry'
import { Commit } from '../../models/commit'
import { DEFAULT_BRANCH_SORT_ORDER } from '../../models/branch-sort-order'
import { ConfirmDiscardStashDialog } from '../../ui/stashing/confirm-discard-stash'
import { RenameStashDialog } from '../../ui/stashing/rename-stash-dialog'
import { Repository } from '../../models/repository'
import { Branch, BranchType } from '../../models/branch'
import { TipState } from '../../models/tip'
import type { Dispatcher } from '../../ui/dispatcher'
import {
  WebApplicationState,
  WebDispatcher,
  WebFile,
  WebBranch,
  WebStash,
  WebTag,
  WebOperationOptions,
  WebOperationTask,
} from './contracts'
import { UncommittedChangesStrategy } from '../../models/uncommitted-changes-strategy'
import { TerminalOutputListener } from '../../lib/git'
import {
  getDesktopRepository,
  getDesktopBranch,
  getDesktopCommit,
  getDesktopWorkingDirectoryFile,
} from './models'

export function DesktopOperationAuthPrompt(props: {
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

export function DesktopAppError(props: {
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

export function DesktopCommitProgressDialog(props: {
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

export function DesktopResetWarningDialog(props: {
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

export function DesktopCreateBranchAtCommitDialog(props: {
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

export function DesktopConfirmForcePushDialog(props: {
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

export function DesktopStashAndSwitchBranchDialog(props: {
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

export function DesktopCreateTagDialog(props: {
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

export function DesktopDeleteTagDialog(props: {
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

export function DesktopConfirmDeletePushedTagDialog(props: {
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

export function DesktopDeleteBranchDialog(props: {
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

export function DesktopDeleteRemoteBranchDialog(props: {
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

export function DesktopDeleteUnusedLocalBranchesDialog(props: {
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

export function DesktopConfirmCheckoutCommitDialog(props: {
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

export function DesktopChooseCherryPickTargetDialog(props: {
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
            .cherryPickToBranches(
              [targetBranch.name],
              props.commits.map(commit => commit.sha)
            )
            .then(props.onDismiss)
        }}
        onCherryPickToMultipleBranches={targetBranches => {
          void props.dispatcher
            .cherryPickToBranches(
              targetBranches.map(branch => branch.name),
              props.commits.map(commit => commit.sha)
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

export function DesktopRenameStashDialog(props: {
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

export function DesktopConfirmDiscardStashDialog(props: {
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

export function DesktopDiscardChangesDialog(props: {
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
