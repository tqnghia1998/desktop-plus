import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'

import { createWebApplicationStore } from '../../src/patches/web/store'
import type {
  WebGitClient,
  WebOperationOptions,
  WebOperationTask,
  WebPlatform,
} from '../../src/patches/web/contracts'

const storageKey = 'desktop-plus-web-source-state'
const repositoryPath = '/test/repository'
const account = {
  credentialId: 'saved-credential',
  login: 'saved-user',
  name: 'Saved User',
  endpoint: 'https://api.github.com',
  provider: 'github',
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem(
    storageKey,
    JSON.stringify({
      repositories: [{ path: repositoryPath }],
      selectedRepositoryPath: repositoryPath,
      hostingAccount: account,
    })
  )
})

function createStore(startOperation: WebGitClient['startOperation']) {
  const git = {
    startOperation,
    getStatus: async () => ({
      workingDirectory: { files: [] },
      operation: null,
    }),
    getBranches: async () => ({
      branch: null,
      defaultBranch: 'main',
      lastFetched: null,
      recentBranches: [],
      aheadBehind: null,
    }),
    getHistory: async () => ({ commits: [] }),
    getGitIdentity: async () => ({
      name: 'Test User',
      email: 'test@example.com',
      nameOrigin: null,
      emailOrigin: null,
      localName: null,
      localEmail: null,
      globalName: null,
      globalEmail: null,
    }),
  } as WebGitClient
  const platform = { notify: () => undefined } as unknown as WebPlatform
  return createWebApplicationStore(git, platform)
}

describe('browser application store', () => {
  it('preserves saved account metadata and drafts when updating local views', async () => {
    const store = createStore(async () => {
      throw new Error('This test must not start Git operations')
    })

    assert.deepEqual(store.getState().hostingAccount, account)
    store.dispatcher.setCommitDraft('Keep my draft')
    store.dispatcher.setCommitSpellcheckEnabled(false)
    await store.dispatcher.selectSection('history')

    const saved = JSON.parse(localStorage.getItem(storageKey)!)
    assert.deepEqual(saved.hostingAccount, account)
    assert.equal(saved.commitDrafts[repositoryPath], 'Keep my draft')
    assert.equal(store.getState().selectedSection, 'history')
  })

  it('retries Git authentication once without persisting credentials', async () => {
    const calls: WebOperationOptions[] = []
    const store = createStore(async (path, operation, options = {}) => {
      assert.equal(path, repositoryPath)
      assert.equal(operation, 'fetch')
      calls.push(options)
      if (calls.length === 1) {
        throw Object.assign(new Error('Authentication required'), {
          code: 'authentication-required',
        })
      }
      return {
        id: 'completed-operation',
        path,
        operation,
        status: 'completed',
        result: { stdout: '', stderr: '', exitCode: 0 },
      } as WebOperationTask
    })

    await store.dispatcher.runOperation('fetch')
    assert.equal(store.getState().errorCode, 'authentication-required')
    assert.equal(store.getState().canRetry, true)

    await store.dispatcher.retryLastActionWithCredentials(
      'retry-user',
      'one-time-password'
    )
    assert.deepEqual(calls[1].genericCredentials, {
      username: 'retry-user',
      password: 'one-time-password',
    })
    assert.equal(store.getState().error, null)
    assert.equal(store.getState().loading, false)

    await store.dispatcher.runOperation('fetch')
    assert.equal(calls[2].genericCredentials, undefined)
    assert.ok(!JSON.stringify(store.getState()).includes('one-time-password'))
    assert.ok(!localStorage.getItem(storageKey)!.includes('one-time-password'))
    assert.deepEqual(
      JSON.parse(localStorage.getItem(storageKey)!).hostingAccount,
      account
    )
  })
})
