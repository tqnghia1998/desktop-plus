import * as React from 'react'
import { DialogStackContext } from '../../ui/dialog/dialog'
import { ChangeRepositoryAlias } from '../../ui/change-repository-alias/change-repository-alias-dialog'
import { AddExistingRepository } from '../../ui/add-repository/add-existing-repository'
import { CreateRepository } from '../../ui/add-repository/create-repository'
import { CloneRepository } from '../../ui/clone-repository/clone-repository'
import {
  RepositorySettings,
  RepositorySettingsTab,
} from '../../ui/repository-settings/repository-settings'
import { ConfirmRemoveRepository } from '../../ui/remove-repository/confirm-remove-repository'
import { CreateRepositoryGroup } from '../../ui/create-repository-group/create-repository-group-dialog'
import { Repository } from '../../models/repository'
import type { IRemote } from '../../models/remote'
import { PopupType } from '../../models/popup'
import { CloneRepositoryTab } from '../../models/clone-repository-tab'
import type { Dispatcher } from '../../ui/dispatcher'
import { WebApplicationState, WebDispatcher, WebBranches } from './contracts'
import { getDesktopRepository } from './models'
import {
  getStoredUpdateBranchStrategy,
  setStoredUpdateBranchStrategy,
} from './preferences'

export function DesktopRepositorySettingsDialog(props: {
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

export function DesktopAddExistingRepositoryDialog(props: {
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

export function DesktopRelocateRepositoryDialog(props: {
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

export function DesktopCloneRepositoryDialog(props: {
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

export function DesktopCreateRepositoryDialog(props: {
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

export function DesktopConfirmRemoveRepositoryDialog(props: {
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

export function DesktopChangeRepositoryAliasDialog(props: {
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

export function DesktopEditRepositoryGroupDialog(props: {
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
