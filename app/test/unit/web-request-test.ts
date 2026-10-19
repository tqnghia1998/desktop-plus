import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'

import { postJSON } from '../../src/patches/web/platform'

beforeEach(() => {
  window.__DESKTOP_PLUS_RUNTIME__ = { session: 'test-session' }
})

afterEach(() => {
  mock.restoreAll()
  delete window.__DESKTOP_PLUS_RUNTIME__
})

describe('browser JSON requests', () => {
  it('sends authenticated JSON and returns the companion response', async () => {
    const fetch = mock.method(
      globalThis,
      'fetch',
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        assert.equal(init?.method, 'POST')
        assert.deepEqual(JSON.parse(init?.body as string), {
          path: '/test/repository',
          operation: 'fetch',
        })
        const headers = new Headers(init?.headers)
        assert.equal(headers.get('Content-Type'), 'application/json')
        assert.equal(headers.get('X-Desktop-Plus-Session'), 'test-session')
        return new Response(JSON.stringify({ id: 'operation' }), {
          status: 200,
        })
      }
    )

    const result = await postJSON('/api/git/operations', {
      path: '/test/repository',
      operation: 'fetch',
    })
    assert.deepEqual(result, { id: 'operation' })
    assert.equal(fetch.mock.calls.length, 1)
    assert.equal(fetch.mock.calls[0].arguments[0], '/api/git/operations')
  })

  it('preserves structured Git failures for recovery and retry UI', async () => {
    mock.method(
      globalThis,
      'fetch',
      async () =>
        new Response(
          JSON.stringify({
            error: 'Git hook failed',
            code: 'hook-failed',
            hookFailure: { hookName: 'pre-commit', terminalOutput: 'Run lint' },
            stdout: '',
            stderr: 'Run lint',
            exitCode: 1,
            configLockScope: 'local',
          }),
          { status: 400 }
        )
    )

    await assert.rejects(postJSON('/api/git/operations', {}), error => {
      assert.ok(error instanceof Error)
      assert.equal(error.message, 'Git hook failed')
      assert.deepEqual(
        { ...error },
        {
          code: 'hook-failed',
          bypassURL: undefined,
          hookFailure: { hookName: 'pre-commit', terminalOutput: 'Run lint' },
          operationOutput: { stdout: '', stderr: 'Run lint', exitCode: 1 },
          configLockScope: 'local',
        }
      )
      return true
    })
  })
})
