import {
  WebIntegrations,
  WebPlatform,
  WebUpdateOperation,
  WebUpdateStatus,
} from './contracts'

interface IWebRuntime {
  readonly session?: string
}

declare global {
  interface Window {
    __DESKTOP_PLUS_RUNTIME__?: IWebRuntime
  }
}

const companionErrorGuidance: Record<string, string> = {
  'credentials-invalid':
    'Your hosting credentials were rejected. Sign in again with a valid token.',
  'insufficient-permission':
    'Your token does not have permission for this repository or namespace.',
  'rate-limited':
    'The hosting provider rate limited this account. Wait a moment and try again.',
  'repository-name-collision':
    'A repository with that name already exists in the selected account or organization.',
  'resource-not-found': 'The requested repository or namespace was not found.',
  'validation-failed':
    'The hosting provider rejected those details. Review the entered values and try again.',
  'provider-unavailable':
    'The hosting provider is currently unavailable. Check your network connection and retry.',
  'network-unavailable':
    'The hosting provider could not be reached. Check your network connection and retry.',
  'proxy-failure':
    'The hosting provider could not be reached through the configured proxy. Check the proxy settings and retry.',
  'certificate-error':
    'The hosting provider certificate could not be verified. Check the endpoint and certificate configuration.',
  'protected-branch':
    'The hosting provider rejected this push because the branch is protected. Push a new branch and open a pull request instead.',
  'push-rejected':
    'The hosting provider rejected this push. Fetch the latest changes, resolve any conflicts, and retry.',
  'credential-store-unavailable':
    'The operating-system credential store is unavailable. Unlock or configure it, then try again.',
  'lfs-unavailable':
    'Git LFS is not installed on this computer. Install Git LFS, then refresh this repository.',
  'confirmation-required':
    'Confirm this repository configuration change before continuing.',
  'invalid-url':
    'The repository URL is invalid. Use an HTTPS, SSH, or Git URL and try again.',
  'invalid-clone-destination':
    'The clone destination is not available. Choose an empty directory or a new path and try again.',
  'missing-git':
    'Git could not be started. Install Git with the Xcode Command Line Tools, then restart Desktop Plus.',
  'git-config-locked':
    'The Git config is locked by another editor or an interrupted operation. Close other Git editors, recover the stale lock, and retry.',
  'git-config-lock-active':
    'The Git config lock is recent and may still be in use. Close the editor and wait before recovering it.',
  'git-config-lock-missing':
    'The Git config lock is already gone. Retry the Git operation.',
  'git-config-lock-invalid':
    'The Git config lock is not a regular file, so it was not removed.',
  'authentication-required':
    'Git could not authenticate to the remote. Check the macOS Keychain, SSH key, or credential helper, then retry.',
  'credential-helper-failed':
    'Git could not obtain credentials from the configured helper. Check the macOS Keychain or credential-helper setup, then retry.',
  'ssh-host-key':
    'SSH rejected the remote host key. Review the host entry in ~/.ssh/known_hosts and retry only after confirming the host identity.',
  'git-remote-failed':
    'Git could not complete the remote operation. Check the remote URL and connection, then retry.',
  'submodule-update-failed':
    'The submodule could not be updated. Check its remote and nested repository state, then retry.',
  'trash-failed':
    'The repository could not be moved to the macOS Trash. Choose permanent deletion only if you understand that it cannot be recovered.',
  'invalid-repository-delete-target':
    'That path is not a safe top-level repository directory to delete.',
  'push-protection-blocked':
    'GitHub push protection blocked this push. Review the provider bypass link in the Git output, resolve the finding, or complete the provider confirmation before retrying.',
  'approval-required':
    'This push is waiting for the required policy approval. Check the repository rules and retry after approval.',
  'policy-forbidden':
    'A repository rule forbids this push. Update the branch or use an eligible bypass.',
  'copilot-unavailable':
    'GitHub Copilot is unavailable in this companion installation.',
  'copilot-rate-limited':
    'Copilot rate limited this request. Wait a moment and retry.',
  'copilot-quota-exhausted': 'Copilot quota is exhausted for this account.',
  'copilot-content-filtered':
    'Copilot could not process this request because of a content policy.',
  'copilot-generation-failed':
    'Copilot could not complete this request. Retry or choose another model.',
  'update-unavailable':
    'No verified automatic update is available. Check the configured release channel or use the manual update path.',
  'update-verification-failed':
    'The update metadata or downloaded artifact could not be verified and was not opened.',
  'update-download-failed':
    'The update download failed. Check the network connection and retry.',
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set(
    'X-Desktop-Plus-Session',
    window.__DESKTOP_PLUS_RUNTIME__?.session || ''
  )
  const response = await fetch(path, { ...init, headers })
  const payload = (await response.json().catch(() => ({}))) as T & {
    error?: string
    code?: string
    bypassURL?: string
    hookFailure?: {
      hookName: string
      terminalOutput: string
    }
    stdout?: string
    stderr?: string
    exitCode?: number
    configLockScope?: 'local' | 'global'
  }
  if (!response.ok) {
    const error = new Error(
      companionErrorGuidance[payload.code || ''] ||
        payload.error ||
        `Companion request failed (${response.status})`
    )
    Object.assign(error, {
      code: payload.code,
      bypassURL: payload.bypassURL,
      hookFailure: payload.hookFailure,
      operationOutput:
        typeof payload.stdout === 'string' &&
        typeof payload.stderr === 'string' &&
        typeof payload.exitCode === 'number'
          ? {
              stdout: payload.stdout,
              stderr: payload.stderr,
              exitCode: payload.exitCode,
            }
          : null,
      configLockScope: payload.configLockScope,
    })
    throw error
  }
  return payload
}

export const webPlatform: WebPlatform = {
  async chooseDirectory() {
    const result = await request<{ path: string | null }>(
      '/api/dialog/show-open-dialog',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }
    )
    return result.path
  },

  async copy(text) {
    await navigator.clipboard.writeText(text)
  },

  async openPath(path, reveal = false) {
    await request('/api/os/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, reveal }),
    })
  },

  openRepositoryInNewWindow(path) {
    const url = new URL(window.location.href)
    url.searchParams.set('repository', path)
    window.open(url.toString(), '_blank', 'noopener,noreferrer')
  },

  async openIntegration(kind, path, selection) {
    await request('/api/integrations/launch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind,
        target: path,
        name: selection?.name || null,
        custom: selection?.custom || null,
      }),
    })
  },

  openExternal(url) {
    window.open(url, '_blank', 'noopener,noreferrer')
  },

  requestNotificationPermission() {
    if (!('Notification' in window)) return Promise.resolve('denied')
    return Notification.requestPermission()
  },

  notify(title, body, onClick) {
    if (localStorage.getItem('browser-notifications-enabled') === 'false')
      return
    if (!('Notification' in window)) {
      console.info(`${title}: ${body}`)
      return
    }
    if (Notification.permission === 'granted') {
      const notification = new Notification(title, { body })
      notification.onclick = () => {
        window.focus()
        onClick?.()
        notification.close()
      }
      return
    }
    console.info(`${title}: ${body}`)
  },

  async checkForUpdates(): Promise<WebUpdateStatus> {
    const result = await request<{ update: WebUpdateStatus }>('/api/updates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check' }),
    })
    return result.update
  },

  async downloadUpdate(): Promise<WebUpdateOperation> {
    const result = await request<{ operation: WebUpdateOperation }>(
      '/api/updates',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'download' }),
      }
    )
    return result.operation
  },

  async getUpdateOperation(id): Promise<WebUpdateOperation> {
    const result = await request<{ operation: WebUpdateOperation }>(
      `/api/updates/operations/${encodeURIComponent(id)}`
    )
    return result.operation
  },

  async cancelUpdateOperation(id): Promise<WebUpdateOperation> {
    const result = await request<{ operation: WebUpdateOperation }>(
      `/api/updates/operations/${encodeURIComponent(id)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      }
    )
    return result.operation
  },

  async openDownloadedUpdate(id, confirmed): Promise<WebUpdateOperation> {
    const result = await request<{ operation: WebUpdateOperation }>(
      '/api/updates',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'open', operationId: id, confirmed }),
      }
    )
    return result.operation
  },

  getIntegrations(): Promise<WebIntegrations> {
    return request('/api/integrations')
  },

  async launchIntegration(kind, target, name, custom) {
    await request('/api/integrations/launch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, target, name, custom: custom || null }),
    })
  },
}

export { request }
