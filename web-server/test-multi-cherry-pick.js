const assert = require('assert/strict')
const path = require('path')
const vm = require('vm')
const { buildSync } = require('esbuild')

const { text } = buildSync({
  entryPoints: [path.join(__dirname, '../app/src/patches/web/store.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  write: false,
  define: {
    __DARWIN__: 'true',
    __WIN32__: 'false',
    __LINUX__: 'false',
    __DEV__: 'false',
  },
}).outputFiles[0]

async function scenario(stopAt, stopStatus) {
  const repo = '/test/repository'
  const storage = new Map([
    [
      'desktop-plus-web-source-state',
      JSON.stringify({
        repositories: [{ path: repo }],
        selectedRepositoryPath: repo,
      }),
    ],
  ])
  const module = { exports: {} }
  vm.runInNewContext(text, {
    module,
    exports: module.exports,
    require,
    console,
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
    document: { visibilityState: 'visible' },
    window: { setTimeout, clearTimeout },
  })
  const branches = { main: [], first: [], second: [] }
  let branch = 'main'
  let operations = 0
  const store = module.exports.createWebApplicationStore(
    {
      async startOperation(target, operation, options) {
        assert.equal(target, repo)
        const status = ++operations === stopAt ? stopStatus : 'completed'
        if (status === 'completed') {
          if (operation === 'checkout') branch = options.values[0]
          if (operation === 'cherry-pick')
            branches[branch].push(...options.values)
        }
        return {
          id: String(operations),
          operation,
          status,
          result:
            status === 'completed'
              ? { exitCode: 0, stdout: '', stderr: '' }
              : null,
          error: status === 'failed' ? 'Conflicting commit' : null,
        }
      },
      async getStatus() {
        return { workingDirectory: { files: [] } }
      },
      async getBranches() {
        return {
          branch: { name: branch },
          branches: [],
          remotes: [],
          worktrees: [],
          tags: [],
        }
      },
      async getHistory() {
        return { commits: [] }
      },
      async getGitIdentity() {
        return {}
      },
    },
    {}
  )
  await store.dispatcher.cherryPickToBranches(
    ['first', 'second'],
    ['commit-one', 'commit-two']
  )
  return {
    branches,
    branch,
    error: store.getState().error,
    loading: store.getState().loading,
    operations,
  }
}

async function main() {
  const success = await scenario()
  assert.deepEqual(success.branches, {
    main: [],
    first: ['commit-one', 'commit-two'],
    second: ['commit-one', 'commit-two'],
  })
  assert.equal(success.branch, 'second')
  assert.equal(success.error, null)
  assert.equal(success.loading, false)

  for (const status of ['failed', 'cancelled']) {
    for (const stopAt of [1, 2, 3, 4]) {
      const stopped = await scenario(stopAt, status)
      assert.equal(stopped.operations, stopAt, `${status} must stop the batch`)
      assert.equal(stopped.loading, false)
      assert.equal(stopped.branches.second.length, 0)
      if (stopAt <= 2) assert.equal(stopped.branches.first.length, 0)
      assert.equal(
        stopped.error,
        status === 'failed' ? 'Conflicting commit' : null
      )
    }
  }
  console.log(
    'Multi-branch cherry-pick passed: both branches updated; failures and cancellations stop the batch'
  )
}
main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
