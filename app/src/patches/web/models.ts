import {
  AppFileStatus,
  AppFileStatusKind,
  CommittedFileChange,
  GitStatusEntry,
  UnmergedEntrySummary,
  WorkingDirectoryFileChange,
} from '../../models/status'
import { DiffSelection, DiffSelectionType } from '../../models/diff'
import { Commit } from '../../models/commit'
import { CommitIdentity } from '../../models/commit-identity'
import { DiffParser } from '../../lib/diff-parser'
import { IDiff, DiffType } from '../../models/diff'
import { Repository } from '../../models/repository'
import { Branch, BranchType } from '../../models/branch'
import { Popup, PopupType } from '../../models/popup'
import type { IMenu } from '../../models/app-menu'
import {
  WebApplicationState,
  WebFile,
  WebBranch,
  WebDiff,
  WebStash,
} from './contracts'
import { ICommitContext } from '../../models/commit'

export type CommitMessagePopup = Extract<
  Popup,
  { readonly type: PopupType.CommitMessage }
>

export type HistoryRewriteKind = 'reorder' | 'squash'

export function formatCommitContextMessage(context: ICommitContext): string {
  const message = [context.summary, context.description]
    .filter((part): part is string => Boolean(part))
    .join('\n\n')
  const trailers = (context.trailers || []).map(
    trailer => `${trailer.token}: ${trailer.value}`
  )
  return trailers.length > 0 ? `${message}\n\n${trailers.join('\n')}` : message
}

export const webSuggestedActionsMenu: IMenu = {
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

export type WebStashAction = {
  readonly stash: WebStash
  readonly operation: 'stash-apply' | 'stash-pop' | 'stash-drop'
}

export function getDesktopFileStatus(file: WebFile): AppFileStatus {
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

export function getDesktopWorkingDirectoryFile(
  file: WebFile,
  selection = DiffSelection.fromInitialSelection(DiffSelectionType.All)
) {
  return new WorkingDirectoryFileChange(
    file.path,
    getDesktopFileStatus(file),
    selection
  )
}

export function getDesktopRepository(path: string) {
  return new Repository(path, 0, null, false)
}

function decodeBase64(value: string): ArrayBuffer {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++)
    bytes[index] = binary.charCodeAt(index)
  return bytes.buffer
}

export function getDesktopDiff(webDiff: WebDiff | null): IDiff | null {
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

export function getDesktopSubmoduleDiff(
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

export function getDesktopCommit(
  commit: WebApplicationState['history'][number]
) {
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

export function getDesktopBranch(
  branch: WebBranch | null | undefined
): Branch | null {
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

export function getDesktopCommittedFile(
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
