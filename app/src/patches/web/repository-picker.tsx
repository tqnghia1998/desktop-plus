import * as React from 'react'
import { DialogStackContext } from '../../ui/dialog/dialog'
import { RepositoriesList } from '../../ui/repositories-list/repositories-list'
import { AddWorktreeDialog } from '../../ui/worktrees/add-worktree-dialog'
import { RenameWorktreeDialog } from '../../ui/worktrees/rename-worktree-dialog'
import { DeleteWorktreeDialog } from '../../ui/worktrees/delete-worktree-dialog'
import { Repository } from '../../models/repository'
import { PopupType } from '../../models/popup'
import { ShowBranchNameInRepoListSetting } from '../../models/show-branch-name-in-repo-list'
import type { Dispatcher } from '../../ui/dispatcher'
import { WebApplicationState, WebDispatcher, WebBranch } from './contracts'
import { useWebIntegrationSelection } from './preferences'
import { getDesktopBranch } from './models'

const snoozedRepositories: ReadonlyMap<number, number> = new Map()

export function DesktopRepositoryPicker(props: {
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
        enableRepositorySnoozing={false}
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
        snoozedRepositories={snoozedRepositories}
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
            options={{}}
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
