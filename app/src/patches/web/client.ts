import {
  WebBranches,
  WebComparison,
  WebCommitDetails,
  WebDiff,
  WebGitClient,
  WebHistory,
  WebStatus,
  WebStashFiles,
  WebGitOperation,
  WebOperationOptions,
  WebOperationResult,
  WebOperationTask,
  WebRepositoryInitializationOptions,
  WebRepositorySetupOptions,
  WebRepositorySetupPreview,
  WebCloneSetupPreview,
  WebRepositoryInspection,
  WebRepositoryIndicators,
  WebGitIdentity,
  WebGitConfigScope,
  WebRepositoryDeleteMode,
} from './contracts'
import { postJSON, request } from './platform'

function repositoryQuery(path: string, values: Record<string, string> = {}) {
  const params = new URLSearchParams({ path, ...values })
  return `?${params.toString()}`
}

export const webGitClient: WebGitClient = {
  getRepositorySetupOptions(): Promise<WebRepositorySetupOptions> {
    return request('/api/repository-setup/options')
  },

  previewRepositoryInitialization(
    options: Pick<
      WebRepositoryInitializationOptions,
      'name' | 'parentPath' | 'createReadme'
    >
  ): Promise<WebRepositorySetupPreview> {
    return postJSON('/api/repository-setup/preview', options)
  },

  previewCloneRepository(url, path): Promise<WebCloneSetupPreview> {
    return postJSON('/api/repository-setup/clone-preview', { url, path })
  },

  inspectRepository(path): Promise<WebRepositoryInspection> {
    return postJSON('/api/repository/inspect', { path })
  },

  async trustRepository(path) {
    await postJSON('/api/repository/trust', { path })
  },

  async deleteRepository(path: string, mode: WebRepositoryDeleteMode) {
    await postJSON('/api/repository/delete', { path, mode, confirmed: true })
  },

  getStatus(path): Promise<WebStatus> {
    return request(`/api/status${repositoryQuery(path)}`)
  },

  getBranches(path, includeRemoteTags = false): Promise<WebBranches> {
    return request(
      `/api/branches/current${repositoryQuery(path, {
        ...(includeRemoteTags ? { remoteTags: '1' } : {}),
      })}`
    )
  },

  getRepositoryIndicators(path): Promise<WebRepositoryIndicators> {
    return request(`/api/repository/indicators${repositoryQuery(path)}`)
  },

  getHistory(path, limit, skip, query, all = false): Promise<WebHistory> {
    return request(
      `/api/history${repositoryQuery(path, {
        limit: String(limit),
        skip: String(skip),
        ...(query ? { query } : {}),
        ...(all ? { all: '1' } : {}),
      })}`
    )
  },

  getComparison(path, branch, mode): Promise<WebComparison> {
    return request(
      `/api/compare${repositoryQuery(path, {
        branch,
        mode,
      })}`
    )
  },

  getCommitDetails(path, sha): Promise<WebCommitDetails> {
    return request(`/api/commit${repositoryQuery(path, { sha })}`)
  },

  getDiff(
    path,
    file,
    sha,
    oldPath,
    commitish,
    parentCommitish
  ): Promise<WebDiff> {
    return request(
      `/api/diff${repositoryQuery(path, {
        file,
        ...(sha ? { sha } : {}),
        ...(oldPath ? { oldPath } : {}),
        ...(commitish ? { commitish } : {}),
        ...(parentCommitish ? { parentCommitish } : {}),
      })}`
    )
  },

  getStashFiles(path, stash): Promise<WebStashFiles> {
    return request(
      `/api/stash/files${repositoryQuery(path, {
        stash,
      })}`
    )
  },

  getStashDiff(path, stash, file): Promise<WebDiff> {
    return request(
      `/api/stash/diff${repositoryQuery(path, {
        stash,
        file,
      })}`
    )
  },

  getGitIdentity(path): Promise<WebGitIdentity> {
    return request(`/api/git/identity${repositoryQuery(path)}`)
  },

  setGitIdentity(
    path: string,
    scope: WebGitConfigScope,
    name: string,
    email: string
  ): Promise<WebGitIdentity> {
    return postJSON('/api/git/identity', { path, scope, name, email })
  },

  async recoverGitConfigLock(path, scope, confirmed) {
    await postJSON('/api/git/config-lock', { path, scope, confirmed })
  },

  async getGlobalGitConfigPath() {
    return request('/api/git/global-config-path')
  },

  readGitIgnore(path): Promise<{ readonly text: string | null }> {
    return request(`/api/gitignore${repositoryQuery(path)}`)
  },

  saveGitIgnore(path, text): Promise<WebStatus> {
    return postJSON('/api/gitignore', { path, text })
  },

  appendIgnore(path, body): Promise<WebStatus> {
    return postJSON('/api/gitignore', { path, ...body })
  },

  runOperation(
    path: string,
    operation: WebGitOperation,
    options: WebOperationOptions = {}
  ): Promise<WebOperationResult> {
    const { values = [], ...body } = options
    return postJSON('/api/git/operation', { path, operation, values, ...body })
  },

  startOperation(
    path: string,
    operation: WebGitOperation,
    options: WebOperationOptions = {}
  ): Promise<WebOperationTask> {
    const { values = [], ...body } = options
    return postJSON('/api/git/operations', { path, operation, values, ...body })
  },

  getOperation(id: string): Promise<WebOperationTask> {
    return request(`/api/git/operations/${encodeURIComponent(id)}`)
  },

  cancelOperation(id: string): Promise<WebOperationTask> {
    return postJSON(`/api/git/operations/${encodeURIComponent(id)}`, {
      action: 'cancel',
    })
  },

  respondOperationAuth(
    id: string,
    response: string,
    remember = false
  ): Promise<WebOperationTask> {
    return postJSON(`/api/git/operations/${encodeURIComponent(id)}`, {
      action: 'auth-response',
      response,
      remember,
    })
  },
}
