import {
  WebHostingAccount,
  WebHostingClient,
  WebLfsOperation,
  WebLfsStatus,
  WebNotification,
  WebRepositoryPolicies,
  WebChecks,
  WebCopilotMetadata,
  WebPullRequestDetails,
  WebPullRequest,
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

  getLfsStatus(path): Promise<WebLfsStatus> {
    return request(`/api/lfs${repositoryQuery(path)}`)
  },

  async installLfs(path, scope, confirmed) {
    const result = await request<{ status: WebLfsStatus }>('/api/lfs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, action: 'install', scope, confirmed }),
    })
    return result.status
  },

  async repairLfs(path, confirmed) {
    const result = await request<{ status: WebLfsStatus }>('/api/lfs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, action: 'repair', confirmed }),
    })
    return result.status
  },

  async startLfsTransfer(path, command) {
    const result = await request<{ operation: WebLfsOperation }>(
      '/api/lfs/operations',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, action: 'start', command }),
      }
    )
    return result.operation
  },

  async getLfsOperation(id) {
    const result = await request<{ operation: WebLfsOperation }>(
      `/api/lfs/operations/${encodeURIComponent(id)}`
    )
    return result.operation
  },

  async cancelLfsOperation(id) {
    const result = await request<{ operation: WebLfsOperation }>(
      `/api/lfs/operations/${encodeURIComponent(id)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      }
    )
    return result.operation
  },
}

function accountPayload(account: WebHostingAccount) {
  return {
    endpoint: account.endpoint,
    login: account.login,
    credentialId: account.credentialId,
  }
}
let copilotAbortController: AbortController | null = null

async function copilotRequest<T>(
  account: WebHostingAccount,
  path: string,
  action: string,
  model?: string
) {
  copilotAbortController?.abort()
  const controller = new AbortController()
  copilotAbortController = controller
  try {
    return await request<T>('/api/copilot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        ...accountPayload(account),
        path,
        action,
        ...(model ? { model } : {}),
      }),
    })
  } finally {
    if (copilotAbortController === controller) copilotAbortController = null
  }
}

export const webHostingClient: WebHostingClient = {
  async signIn(provider, endpoint, token) {
    const result = await request<{
      credentialId: string
      user: {
        login: string
        name: string
        endpoint: string
      }
    }>(provider === 'gitlab' ? '/api/gitlab/auth' : '/api/hosting/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint, token }),
    })
    return {
      credentialId: result.credentialId,
      login: result.user.login,
      name: result.user.name,
      endpoint: result.user.endpoint,
      provider,
    }
  },

  async signOut(account) {
    await request(
      account.provider === 'gitlab'
        ? '/api/gitlab/logout'
        : '/api/hosting/logout',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentialId: account.credentialId }),
      }
    )
  },

  async publish(account, options) {
    await request(
      account.provider === 'gitlab'
        ? '/api/gitlab/projects'
        : '/api/hosting/publish',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...accountPayload(account),
          ...options,
          ...(account.provider === 'gitlab' ? { action: 'create' } : {}),
        }),
      }
    )
  },

  async getPullRequests(account, owner, repository) {
    const result = await request<{
      pullRequests: ReadonlyArray<WebPullRequest>
    }>(
      account.provider === 'gitlab'
        ? '/api/gitlab/merge-requests'
        : '/api/hosting/pull-requests',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...accountPayload(account),
          action: 'list',
          owner,
          repository,
        }),
      }
    )
    return result.pullRequests
  },

  async createPullRequest(account, owner, repository, title, head, base, body) {
    const result = await request<{ pullRequest: WebPullRequest }>(
      account.provider === 'gitlab'
        ? '/api/gitlab/merge-requests'
        : '/api/hosting/pull-requests',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...accountPayload(account),
          action: 'create',
          owner,
          repository,
          title,
          head,
          base,
          body,
        }),
      }
    )
    return result.pullRequest
  },

  async checkoutPullRequest(account, path, pullRequest) {
    if (account.provider === 'gitlab') {
      await request('/api/gitlab/checkout-merge-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...accountPayload(account),
          path,
          pullRequestNumber: pullRequest.number,
        }),
      })
      return
    }
    const cloneURL = pullRequest.head?.repo?.clone_url
    const headRef = pullRequest.head?.ref
    const owner = pullRequest.head?.repo?.owner?.login
    if (!cloneURL || !headRef || !owner)
      throw new Error(
        'This pull request does not include the repository information required for checkout.'
      )
    await request('/api/hosting/checkout-pull-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...accountPayload(account),
        path,
        cloneURL,
        headRef,
        owner,
        pullRequestNumber: pullRequest.number,
      }),
    })
  },

  async getPullRequestDetails(account, owner, repository, pullRequestNumber) {
    return request<WebPullRequestDetails>(
      account.provider === 'gitlab'
        ? '/api/gitlab/merge-requests'
        : '/api/hosting/pull-requests',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...accountPayload(account),
          action: 'details',
          owner,
          repository,
          pullRequestNumber,
        }),
      }
    )
  },

  async getChecks(account, owner, repository, ref) {
    const result = await request<{ check: WebChecks | null }>(
      account.provider === 'gitlab'
        ? '/api/gitlab/pipelines'
        : '/api/hosting/checks',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...accountPayload(account),
          action: 'get',
          owner,
          repository,
          ref,
        }),
      }
    )
    return result.check
  },

  async rerunCheckSuites(account, owner, repository, checkSuiteIds) {
    await request(
      account.provider === 'gitlab'
        ? '/api/gitlab/pipelines'
        : '/api/hosting/checks',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...accountPayload(account),
          action: 'rerun',
          owner,
          repository,
          checkSuiteIds,
        }),
      }
    )
  },

  async getNotifications(account) {
    const result = await request<{
      notifications: ReadonlyArray<WebNotification>
    }>('/api/hosting/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...accountPayload(account), action: 'list' }),
    })
    return result.notifications
  },

  async markNotificationRead(account, notificationId) {
    await request('/api/hosting/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...accountPayload(account),
        action: 'mark-read',
        notificationId,
      }),
    })
  },

  async getRepositoryPolicies(account, owner, repository, branch) {
    if (account.provider === 'gitlab')
      throw new Error(
        'Repository rules are currently available for GitHub only.'
      )
    const result = await request<{ policies: WebRepositoryPolicies }>(
      '/api/hosting/policies',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...accountPayload(account),
          action: 'load',
          owner,
          repository,
          branch,
        }),
      }
    )
    return result.policies
  },

  async pushRepository(account, path, owner, repository, branch) {
    await request(
      account.provider === 'gitlab'
        ? '/api/gitlab/projects'
        : '/api/hosting/push',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...accountPayload(account),
          ...(account.provider === 'gitlab' ? { action: 'push' } : {}),
          path,
          owner,
          repository,
          branch,
        }),
      }
    )
  },

  async getCopilotMetadata(account, path) {
    return copilotRequest<WebCopilotMetadata>(account, path, 'metadata')
  },

  async generateCopilotCommitMessage(account, path, model) {
    const result = await copilotRequest<{ content: string }>(
      account,
      path,
      'generate-commit-message',
      model
    )
    return result.content
  },

  async resolveCopilotConflicts(account, path, model) {
    const result = await copilotRequest<{ content: string }>(
      account,
      path,
      'resolve-conflicts',
      model
    )
    return result.content
  },
}

export function cancelCopilotRequest() {
  copilotAbortController?.abort()
}
