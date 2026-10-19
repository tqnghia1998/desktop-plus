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
import { request } from './platform'

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
    return request('/api/repository-setup/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    })
  },

  previewCloneRepository(url, path): Promise<WebCloneSetupPreview> {
    return request('/api/repository-setup/clone-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, path }),
    })
  },

  inspectRepository(path): Promise<WebRepositoryInspection> {
    return request('/api/repository/inspect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    })
  },

  async trustRepository(path) {
    await request('/api/repository/trust', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    })
  },

  async deleteRepository(path: string, mode: WebRepositoryDeleteMode) {
    await request('/api/repository/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, mode, confirmed: true }),
    })
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
    return request('/api/git/identity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, scope, name, email }),
    })
  },

  async recoverGitConfigLock(path, scope, confirmed) {
    await request('/api/git/config-lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, scope, confirmed }),
    })
  },

  async getGlobalGitConfigPath() {
    return request('/api/git/global-config-path')
  },

  readGitIgnore(path): Promise<{ readonly text: string | null }> {
    return request(`/api/gitignore${repositoryQuery(path)}`)
  },

  saveGitIgnore(path, text): Promise<WebStatus> {
    return request('/api/gitignore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, text }),
    })
  },

  appendIgnore(path, body): Promise<WebStatus> {
    return request('/api/gitignore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, ...body }),
    })
  },

  runOperation(
    path: string,
    operation: WebGitOperation,
    options: WebOperationOptions = {}
  ): Promise<WebOperationResult> {
    const { values = [], ...body } = options
    return request('/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, operation, values, ...body }),
    })
  },

  startOperation(
    path: string,
    operation: WebGitOperation,
    options: WebOperationOptions = {}
  ): Promise<WebOperationTask> {
    const { values = [], ...body } = options
    return request('/api/git/operations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, operation, values, ...body }),
    })
  },

  getOperation(id: string): Promise<WebOperationTask> {
    return request(`/api/git/operations/${encodeURIComponent(id)}`)
  },

  cancelOperation(id: string): Promise<WebOperationTask> {
    return request(`/api/git/operations/${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel' }),
    })
  },

  respondOperationAuth(
    id: string,
    response: string,
    remember = false
  ): Promise<WebOperationTask> {
    return request(`/api/git/operations/${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'auth-response', response, remember }),
    })
  },
}
