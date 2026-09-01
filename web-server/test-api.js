const assert = require('assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')
const { createServer } = require('./server')
const {
  authenticatedGitEnvironment,
  githubCredentialService,
  normalizeGitHubEndpoint,
} = require('./hosting')

function git(repo, ...args) {
  execFileSync('git', args, { cwd: repo, stdio: 'pipe' })
}

let sessionToken
async function request(base, pathname, options = {}) {
  const response = await fetch(`${base}${pathname}`, {
    ...options,
    headers: {
      'X-Desktop-Plus-Session': sessionToken,
      ...(options.headers || {}),
    },
  })
  const contentType = response.headers.get('content-type') || ''
  const data = contentType.includes('application/json')
    ? await response.json()
    : await response.text()
  return { response, data }
}

async function main() {
  const root = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), 'desktop-plus-api-')
  )
  const repo = path.join(root, 'repo')
  await fs.promises.mkdir(repo)
  git(repo, 'init', '-b', 'main')
  git(repo, 'config', 'user.name', 'API Test')
  git(repo, 'config', 'user.email', 'api-test@example.com')
  await fs.promises.writeFile(path.join(repo, 'tracked.txt'), 'first\n')
  git(repo, 'add', 'tracked.txt')
  git(repo, 'commit', '-m', 'Initial commit')
  const remote = path.join(root, 'remote.git')
  git(root, 'init', '--bare', remote)
  git(repo, 'remote', 'add', 'origin', remote)
  git(repo, 'push', '-u', 'origin', 'main')
  git(repo, 'checkout', '-b', 'feature')
  await fs.promises.writeFile(path.join(repo, 'branch.txt'), 'feature\n')
  git(repo, 'add', 'branch.txt')
  git(repo, 'commit', '-m', 'Feature commit')
  git(repo, 'push', 'origin', 'feature')
  const featureSha = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: repo,
    encoding: 'utf8',
  }).trim()
  git(repo, 'checkout', 'main')
  const mainSha = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: repo,
    encoding: 'utf8',
  }).trim()
  const pruneRepo = path.join(root, 'prune-repo')
  const pruneRemote = path.join(root, 'prune-remote.git')
  await fs.promises.mkdir(pruneRepo)
  git(pruneRepo, 'init', '-b', 'main')
  git(pruneRepo, 'config', 'user.name', 'Prune API Test')
  git(pruneRepo, 'config', 'user.email', 'prune-api-test@example.com')
  await fs.promises.writeFile(path.join(pruneRepo, 'tracked.txt'), 'base\n')
  git(pruneRepo, 'add', 'tracked.txt')
  git(pruneRepo, 'commit', '-m', 'Initial prune commit')
  git(root, 'init', '--bare', pruneRemote)
  git(pruneRepo, 'remote', 'add', 'origin', pruneRemote)
  git(pruneRepo, 'push', '-u', 'origin', 'main')
  git(pruneRepo, 'checkout', '-b', 'stale-source')
  await fs.promises.writeFile(
    path.join(pruneRepo, 'stale.txt'),
    'merged stale branch\n'
  )
  git(pruneRepo, 'add', 'stale.txt')
  git(pruneRepo, 'commit', '-m', 'Stale source commit')
  git(pruneRepo, 'push', '-u', 'origin', 'stale-source')
  const staleSha = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: pruneRepo,
    encoding: 'utf8',
  }).trim()
  git(pruneRepo, 'checkout', 'main')
  git(pruneRepo, 'merge', '--ff-only', 'stale-source')
  git(pruneRepo, 'push', 'origin', 'main')
  git(pruneRepo, 'branch', '-D', 'stale-source')
  git(pruneRepo, 'branch', 'stale-prune', 'origin/main')
  git(pruneRepo, 'config', 'branch.stale-prune.remote', 'origin')
  git(
    pruneRepo,
    'config',
    'branch.stale-prune.merge',
    'refs/heads/stale-source'
  )
  git(pruneRepo, 'push', 'origin', '--delete', 'stale-source')
  git(pruneRepo, 'fetch', '--prune', 'origin')
  git(pruneRepo, 'reflog', 'expire', '--expire=now', '--all')
  const pullRequestRepo = path.join(root, 'pull-request-repo')
  git(root, 'clone', '--branch', 'main', remote, pullRequestRepo)
  git(pullRequestRepo, 'config', 'user.name', 'PR Test')
  git(pullRequestRepo, 'config', 'user.email', 'pr-test@example.com')
  await fs.promises.writeFile(path.join(repo, 'tracked.txt'), 'first\nsecond\n')
  await fs.promises.writeFile(path.join(repo, 'untracked.txt'), 'new\n')

  const opened = []
  const trashed = []
  const integrationLaunches = []
  const integrationOutputCalls = []
  const credentials = new Map()
  const hostingCalls = []
  const pullRequest = {
    number: 1,
    title: 'Feature pull request',
    body: 'Adds the feature branch',
    created_at: '2026-08-25T00:00:00Z',
    updated_at: '2026-08-25T01:00:00Z',
    user: { login: 'octocat' },
    draft: false,
    head: {
      ref: 'feature',
      sha: featureSha,
      repo: {
        id: 20,
        name: 'repo',
        html_url: 'https://example/octocat/repo',
        clone_url: remote,
        private: false,
        owner: { id: 1, login: 'octocat' },
      },
    },
    base: {
      ref: 'main',
      sha: mainSha,
      repo: {
        id: 20,
        name: 'repo',
        html_url: 'https://example/octocat/repo',
        clone_url: remote,
        private: false,
        owner: { id: 1, login: 'octocat' },
      },
    },
  }
  const server = createServer({
    selectDirectory: async () => repo,
    selectSavePath: async () => path.join(repo, 'saved.txt'),
    openPath: async (target, reveal) => opened.push({ target, reveal }),
    moveToTrash: async target => trashed.push(target),
    discoverIntegrations: async () => ({
      platform: 'test',
      editors: [{ name: 'Test Editor', path: '/test/editor' }],
      shells: [{ name: 'Test Shell', path: '/test/shell' }],
      dependencies: {},
    }),
    launchIntegration: async options => integrationLaunches.push(options),
    runIntegrationForOutput: async options => {
      integrationOutputCalls.push(options)
      return 'feature Feature branch\nfix Fix branch\n'
    },
    keytar: {
      getPassword: async (service, account) =>
        credentials.get(`${service}:${account}`) || null,
      setPassword: async (service, account, password) =>
        credentials.set(`${service}:${account}`, password),
      deletePassword: async (service, account) =>
        credentials.delete(`${service}:${account}`),
    },
    hostingRequest: async (endpoint, token, method, pathname, body) => {
      hostingCalls.push({ endpoint, token, method, pathname, body })
      if (pathname === 'user')
        return {
          login: 'octocat',
          id: 1,
          name: 'Octo Cat',
          avatar_url: 'https://example/avatar',
        }
      if (pathname === 'repos/octocat/repo' && method === 'GET')
        return {
          id: 10,
          name: 'repo',
          html_url: 'https://example/octocat/repo',
          clone_url: remote,
          owner: { id: 1, login: 'octocat' },
          private: false,
          fork: true,
          parent: {
            id: 11,
            name: 'parent-repo',
            html_url: 'https://example/upstream/parent-repo',
            clone_url: `${remote}-parent`,
            owner: { id: 2, login: 'upstream' },
            private: false,
          },
        }
      if (pathname === 'repos/octocat/repo/forks' && method === 'POST')
        return {
          id: 12,
          name: 'repo',
          html_url: 'https://example/octocat/repo-fork',
          clone_url: `${remote}-fork`,
          owner: { id: 1, login: 'octocat' },
          private: false,
          parent: {
            id: 10,
            name: 'repo',
            html_url: 'https://example/upstream/repo',
            clone_url: remote,
            owner: { id: 2, login: 'upstream' },
            private: false,
          },
        }
      if (method === 'GET' && pathname.startsWith('user/repos'))
        return [
          {
            id: 10,
            name: 'hosted-repository',
            html_url: 'https://example/octocat/hosted-repository',
            clone_url: remote,
            owner: { login: 'octocat' },
            private: false,
            fork: false,
            archived: false,
          },
        ]
      if (pathname.endsWith('/pulls') && method === 'GET') return [pullRequest]
      if (pathname.endsWith('/pulls'))
        return { number: 2, html_url: 'https://example/pull/2' }
      if (pathname.endsWith('/pulls/1')) return pullRequest
      if (pathname.includes('/pulls/1/files'))
        return [
          {
            filename: 'branch.txt',
            status: 'added',
            additions: 1,
            deletions: 0,
            patch: '@@ -0,0 +1 @@\n+feature',
          },
        ]
      if (pathname.includes('/pulls/1/commits')) return [{ sha: featureSha }]
      if (pathname.includes('/commits/') && pathname.endsWith('/check-runs'))
        return {
          total_count: 1,
          check_runs: [
            {
              id: 30,
              name: 'build',
              status: 'completed',
              conclusion: 'success',
              app: { name: 'GitHub Actions' },
              check_suite: { id: 40 },
              html_url: 'https://example/check/30',
            },
          ],
        }
      if (pathname.includes('/commits/') && pathname.endsWith('/status'))
        return { state: 'success', total_count: 0, statuses: [] }
      if (pathname.endsWith('/check-suites/40') && method === 'GET')
        return {
          id: 40,
          rerequestable: true,
          runs_rerequestable: true,
          status: 'completed',
          created_at: '2026-08-25T00:00:00Z',
        }
      if (pathname.endsWith('/check-suites/40/rerequest') && method === 'POST')
        return null
      return {
        name: body.name,
        clone_url: remote,
        html_url: `https://example/octocat/${body.name}`,
      }
    },
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  sessionToken = server.sessionToken
  const query = `?path=${encodeURIComponent(repo)}`
  const initializedRepository = path.join(root, 'initialized')
  const emptyRepository = path.join(root, 'empty-repository')
  await fs.promises.mkdir(emptyRepository)
  git(emptyRepository, 'init', '-b', 'main')
  const deleteTrashRepository = path.join(root, 'delete-trash-repository')
  const deletePermanentRepository = path.join(
    root,
    'delete-permanent-repository'
  )
  const deleteTrashFailureRepository = path.join(
    root,
    'delete-trash-failure-repository'
  )
  for (const repositoryPath of [
    deleteTrashRepository,
    deletePermanentRepository,
    deleteTrashFailureRepository,
  ]) {
    await fs.promises.mkdir(repositoryPath)
    git(repositoryPath, 'init', '-b', 'main')
    git(repositoryPath, 'config', 'user.name', 'Delete API Test')
    git(repositoryPath, 'config', 'user.email', 'delete-api@example.com')
    await fs.promises.writeFile(
      path.join(repositoryPath, 'tracked.txt'),
      'delete me\n'
    )
    git(repositoryPath, 'add', 'tracked.txt')
    git(repositoryPath, 'commit', '-m', 'Delete API fixture')
  }

  try {
    let result = await request(base, '/api/health')
    assert.equal(result.response.status, 200)
    assert.equal(result.data.status, 'ok')
    assert.ok(!Number.isNaN(Date.parse(result.data.time)))

    result = await request(base, `/api/git/identity${query}`)
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    assert.equal(result.data.name, 'API Test')
    assert.equal(result.data.email, 'api-test@example.com')
    assert.equal(result.data.nameOrigin.scope, 'local')
    assert.equal(result.data.emailOrigin.scope, 'local')
    assert.equal(result.data.localName, 'API Test')
    assert.equal(result.data.localEmail, 'api-test@example.com')

    result = await request(base, '/api/git/identity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: repo,
        scope: 'local',
        name: 'API Configured',
        email: 'api-configured@example.com',
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    assert.equal(result.data.name, 'API Configured')
    assert.equal(result.data.email, 'api-configured@example.com')
    assert.equal(
      execFileSync('git', ['config', '--local', '--get', 'user.name'], {
        cwd: repo,
        encoding: 'utf8',
      }).trim(),
      'API Configured'
    )

    const configLockPath = path.join(repo, '.git', 'config.lock')
    await fs.promises.writeFile(configLockPath, 'stale config lock\n')
    result = await request(base, '/api/git/config-lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: repo,
        scope: 'local',
        confirmed: true,
      }),
    })
    assert.equal(result.response.status, 409)
    assert.equal(result.data.code, 'git-config-lock-active')
    assert.equal(fs.existsSync(configLockPath), true)

    const staleTime = new Date(Date.now() - 10 * 60 * 1000)
    await fs.promises.utimes(configLockPath, staleTime, staleTime)
    result = await request(base, '/api/git/config-lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: repo,
        scope: 'local',
        confirmed: true,
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    assert.equal(result.data.scope, 'local')
    assert.equal(result.data.removedPath, configLockPath)
    assert.equal(fs.existsSync(configLockPath), false)

    result = await request(base, '/api/git/config-lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: repo,
        scope: 'local',
        confirmed: true,
      }),
    })
    assert.equal(result.response.status, 404)
    assert.equal(result.data.code, 'git-config-lock-missing')

    result = await request(base, '/api/git/identity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: repo,
        scope: 'worktree',
        name: 'Invalid',
        email: 'invalid@example.com',
      }),
    })
    assert.equal(result.response.status, 400)

    result = await request(base, `/api/status${query}`)
    assert.equal(result.response.status, 200)
    assert.deepEqual(
      result.data.workingDirectory.files
        .map(file => [file.path, file.status.kind])
        .sort(),
      [
        ['tracked.txt', 'Modified'],
        ['untracked.txt', 'Untracked'],
      ]
    )

    result = await request(base, `/api/repository/indicators${query}`)
    assert.equal(result.response.status, 200)
    assert.equal(result.data.currentBranch, 'main')
    assert.equal(result.data.defaultBranch, 'main')
    assert.equal(result.data.changedFilesCount, 2)
    assert.deepEqual(result.data.aheadBehind, { ahead: 0, behind: 0 })
    assert.equal(result.data.remoteURL, remote)

    result = await request(base, `/api/branches/current${query}`)
    assert.equal(result.response.status, 200)
    assert.equal(result.data.branch.name, 'main')
    assert.equal(result.data.branch.type, 'Local')
    assert.match(result.data.tip, /^[0-9a-f]{40}$/)
    assert.ok(result.data.branches.some(branch => branch.name === 'main'))
    assert.equal(
      result.data.branches.find(branch => branch.name === 'main').isGone,
      false
    )
    assert.equal(
      result.data.worktrees.every(worktree => worktree.isDirty === undefined),
      true,
      'ordinary branch refreshes must not scan every worktree for changes'
    )

    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: repo,
        operation: 'pull',
        pullStrategy: 'octopus',
      }),
    })
    assert.equal(result.response.status, 400, JSON.stringify(result.data))
    assert.match(
      result.data.error,
      /pullStrategy must be merge, rebase, or ff-only/
    )

    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: pruneRepo,
        operation: 'prune-branches',
        dryRun: true,
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    assert.deepEqual(
      result.data.candidates.map(candidate => candidate.name),
      ['stale-prune']
    )
    assert.equal(result.data.candidates[0].sha, staleSha)

    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: pruneRepo,
        operation: 'prune-branches',
      }),
    })
    assert.equal(result.response.status, 400, JSON.stringify(result.data))
    assert.match(result.data.error, /Confirm pruning stale branches/)
    assert.equal(
      execFileSync('git', ['show-ref', '--verify', 'refs/heads/stale-prune'], {
        cwd: pruneRepo,
        encoding: 'utf8',
      }).trim().length > 0,
      true
    )

    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: pruneRepo,
        operation: 'prune-branches',
        confirmed: true,
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    assert.deepEqual(
      result.data.pruned.map(candidate => candidate.name),
      ['stale-prune']
    )
    assert.throws(() =>
      execFileSync('git', ['show-ref', '--verify', 'refs/heads/stale-prune'], {
        cwd: pruneRepo,
        stdio: 'pipe',
      })
    )

    result = await request(base, `/api/history${query}&limit=10`)
    assert.equal(result.response.status, 200)
    assert.equal(result.data.commits.length, 1)
    assert.equal(result.data.commits[0].summary, 'Initial commit')
    assert.equal(result.data.commits[0].author.name, 'API Test')
    const sha = result.data.commits[0].sha

    result = await request(base, `/api/commit${query}&sha=${sha}`)
    assert.equal(result.response.status, 200)
    assert.equal(result.data.files.length, 1)
    assert.equal(result.data.files[0].path, 'tracked.txt')
    assert.equal(result.data.files[0].status.kind, 'New')
    assert.equal(result.data.linesAdded, 1)

    result = await request(
      base,
      `/api/diff${query}&file=${encodeURIComponent('tracked.txt')}`
    )
    assert.equal(result.response.status, 200)
    assert.match(result.data.patch, /^diff --git/m)
    assert.match(result.data.patch, /^\+second$/m)
    assert.deepEqual(result.data.fileContents, {
      oldContents: ['first', ''],
      newContents: ['first', 'second', ''],
      canBeExpanded: true,
    })

    result = await request(
      base,
      `/api/diff${query}&file=${encodeURIComponent('tracked.txt')}&sha=${sha}`
    )
    assert.equal(result.response.status, 200)
    assert.match(result.data.patch, /^\+first$/m)
    assert.deepEqual(result.data.fileContents, {
      oldContents: [],
      newContents: ['first', ''],
      canBeExpanded: true,
    })

    result = await request(
      base,
      `/api/compare${query}&branch=feature&mode=Behind`
    )
    assert.equal(result.response.status, 200)
    assert.equal(result.data.behind, 1)
    assert.equal(result.data.ahead, 0)
    assert.equal(result.data.commits[0].summary, 'Feature commit')

    result = await request(base, '/api/git/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        args: ['rev-parse', '--show-toplevel'],
        workingDirectory: repo,
      }),
    })
    assert.equal(result.response.status, 200)
    assert.equal(result.data.exitCode, 0)
    assert.equal(
      await fs.promises.realpath(result.data.stdout.trim()),
      await fs.promises.realpath(repo)
    )

    result = await request(base, '/api/git/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    assert.equal(result.response.status, 400)
    result = await request(base, '/api/git/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        args: ['-c', 'alias.run=!touch /tmp/pwned', 'run'],
        workingDirectory: repo,
      }),
    })
    assert.equal(result.response.status, 400)

    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: initializedRepository,
        operation: 'init',
        initialBranch: 'main',
      }),
    })
    assert.equal(result.response.status, 200)
    git(initializedRepository, 'config', 'user.name', 'Initialized Repository')
    git(
      initializedRepository,
      'config',
      'user.email',
      'initialized@example.com'
    )
    await fs.promises.writeFile(
      path.join(initializedRepository, 'first.txt'),
      'first\n'
    )
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: initializedRepository,
        operation: 'commit',
        files: ['first.txt'],
        message: 'Initial web commit',
      }),
    })
    assert.equal(result.response.status, 200)
    assert.equal(
      execFileSync('git', ['log', '-1', '--format=%s'], {
        cwd: initializedRepository,
        encoding: 'utf8',
      }).trim(),
      'Initial web commit'
    )
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: initializedRepository,
        operation: 'commit',
        amend: true,
        message: 'Renamed initial web commit',
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    assert.equal(
      execFileSync('git', ['log', '-1', '--format=%s'], {
        cwd: initializedRepository,
        encoding: 'utf8',
      }).trim(),
      'Renamed initial web commit',
      'a message-only amend must work for an initial commit'
    )
    assert.equal(
      await fs.promises.readFile(
        path.join(initializedRepository, 'first.txt'),
        'utf8'
      ),
      'first\n',
      'a message-only amend must preserve the amended commit tree'
    )
    await fs.promises.writeFile(
      path.join(initializedRepository, 'second.txt'),
      'second\n'
    )
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: initializedRepository,
        operation: 'commit',
        files: ['second.txt'],
        message: 'Add second file',
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    await fs.promises.writeFile(
      path.join(initializedRepository, 'first.txt'),
      'amended first\n'
    )
    await fs.promises.writeFile(
      path.join(initializedRepository, 'second.txt'),
      'unamended second\n'
    )
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: initializedRepository,
        operation: 'commit',
        amend: true,
        files: ['first.txt'],
        message: 'Amend only first file',
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    assert.equal(
      execFileSync('git', ['show', 'HEAD:first.txt'], {
        cwd: initializedRepository,
        encoding: 'utf8',
      }),
      'amended first\n'
    )
    assert.equal(
      execFileSync('git', ['show', 'HEAD:second.txt'], {
        cwd: initializedRepository,
        encoding: 'utf8',
      }),
      'second\n',
      'an amend must preserve unchanged paths from the amended commit'
    )
    assert.equal(
      await fs.promises.readFile(
        path.join(initializedRepository, 'second.txt'),
        'utf8'
      ),
      'unamended second\n',
      'an amend must leave unselected working changes untouched'
    )

    result = await request(base, '/api/repository/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: deleteTrashRepository,
        mode: 'trash',
      }),
    })
    assert.equal(result.response.status, 400)
    assert.equal(result.data.code, 'confirmation-required')
    assert.equal(fs.existsSync(deleteTrashRepository), true)

    result = await request(base, '/api/repository/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: deleteTrashRepository,
        mode: 'trash',
        confirmed: true,
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    assert.equal(result.data.mode, 'trash')
    assert.equal(
      await fs.promises.realpath(trashed.at(-1)),
      await fs.promises.realpath(deleteTrashRepository)
    )
    assert.equal(fs.existsSync(deleteTrashRepository), true)

    result = await request(base, '/api/repository/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: deletePermanentRepository,
        mode: 'permanent',
        confirmed: true,
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    assert.equal(result.data.mode, 'permanent')
    assert.equal(fs.existsSync(deletePermanentRepository), false)

    const deleteFile = path.join(root, 'delete-file')
    await fs.promises.writeFile(deleteFile, 'not a repository\n')
    result = await request(base, '/api/repository/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: deleteFile,
        mode: 'permanent',
        confirmed: true,
      }),
    })
    assert.equal(result.response.status, 400)
    assert.equal(result.data.code, 'invalid-repository-delete-target')
    assert.equal(fs.existsSync(deleteFile), true)

    const deleteSymlink = path.join(root, 'delete-symlink')
    await fs.promises.symlink(deleteTrashRepository, deleteSymlink)
    result = await request(base, '/api/repository/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: deleteSymlink,
        mode: 'permanent',
        confirmed: true,
      }),
    })
    assert.equal(result.response.status, 400)
    assert.equal(result.data.code, 'invalid-repository-delete-target')
    assert.equal(fs.existsSync(deleteTrashRepository), true)

    result = await request(base, '/api/repository/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: deleteTrashRepository,
        mode: 'invalid',
        confirmed: true,
      }),
    })
    assert.equal(result.response.status, 400)
    assert.equal(result.data.code, 'invalid-repository-delete-mode')

    const deleteNested = path.join(deleteTrashRepository, 'nested')
    await fs.promises.mkdir(deleteNested)
    result = await request(base, '/api/repository/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: deleteNested,
        mode: 'permanent',
        confirmed: true,
      }),
    })
    assert.equal(result.response.status, 400)
    assert.equal(result.data.code, 'invalid-repository-delete-target')
    assert.equal(fs.existsSync(deleteTrashRepository), true)

    const trashFailureServer = createServer({
      moveToTrash: async () => {
        throw new Error('Trash unavailable')
      },
    })
    await new Promise(resolve =>
      trashFailureServer.listen(0, '127.0.0.1', resolve)
    )
    try {
      const failureBase = `http://127.0.0.1:${
        trashFailureServer.address().port
      }`
      const failureResult = await request(
        failureBase,
        '/api/repository/delete',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Desktop-Plus-Session': trashFailureServer.sessionToken,
          },
          body: JSON.stringify({
            path: deleteTrashFailureRepository,
            mode: 'trash',
            confirmed: true,
          }),
        }
      )
      assert.equal(failureResult.response.status, 409)
      assert.equal(failureResult.data.code, 'trash-failed')
      assert.equal(fs.existsSync(deleteTrashFailureRepository), true)
    } finally {
      await new Promise(resolve => trashFailureServer.close(resolve))
    }

    const undoInitialRepo = path.join(root, 'undo-initial-repo')
    await fs.promises.mkdir(undoInitialRepo)
    git(undoInitialRepo, 'init', '-b', 'main')
    git(undoInitialRepo, 'config', 'user.name', 'Undo Initial Test')
    git(undoInitialRepo, 'config', 'user.email', 'undo-initial@example.com')
    await fs.promises.writeFile(
      path.join(undoInitialRepo, 'kept.txt'),
      'kept\n'
    )
    await fs.promises.writeFile(
      path.join(undoInitialRepo, 'deleted.txt'),
      'deleted\n'
    )
    git(undoInitialRepo, 'add', 'kept.txt', 'deleted.txt')
    git(undoInitialRepo, 'commit', '-m', 'Initial commit')
    await fs.promises.rm(path.join(undoInitialRepo, 'deleted.txt'))
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: undoInitialRepo, operation: 'undo' }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    assert.throws(
      () =>
        execFileSync('git', ['rev-parse', '--verify', 'HEAD'], {
          cwd: undoInitialRepo,
          stdio: 'pipe',
        }),
      error => error.status === 128,
      'undoing the initial commit must leave the current branch unborn'
    )
    assert.equal(
      await fs.promises.readFile(
        path.join(undoInitialRepo, 'deleted.txt'),
        'utf8'
      ),
      'deleted\n',
      'undoing the initial commit must restore files deleted after it'
    )
    assert.equal(
      execFileSync('git', ['status', '--short'], {
        cwd: undoInitialRepo,
        encoding: 'utf8',
      })
        .trim()
        .split('\n')
        .sort()
        .join(','),
      '?? deleted.txt,?? kept.txt',
      'undoing the initial commit must leave its files unstaged'
    )

    const undoCommitRepo = path.join(root, 'undo-commit-repo')
    await fs.promises.mkdir(undoCommitRepo)
    git(undoCommitRepo, 'init', '-b', 'main')
    git(undoCommitRepo, 'config', 'user.name', 'Undo Commit Test')
    git(undoCommitRepo, 'config', 'user.email', 'undo-commit@example.com')
    await fs.promises.writeFile(path.join(undoCommitRepo, 'file.txt'), 'one\n')
    git(undoCommitRepo, 'add', 'file.txt')
    git(undoCommitRepo, 'commit', '-m', 'first')
    await fs.promises.writeFile(path.join(undoCommitRepo, 'file.txt'), 'two\n')
    git(undoCommitRepo, 'commit', '-am', 'second')
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: undoCommitRepo, operation: 'undo' }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    assert.equal(
      execFileSync('git', ['log', '-1', '--format=%s'], {
        cwd: undoCommitRepo,
        encoding: 'utf8',
      }).trim(),
      'first'
    )
    assert.equal(
      await fs.promises.readFile(path.join(undoCommitRepo, 'file.txt'), 'utf8'),
      'two\n',
      'undoing a normal commit must preserve its file changes'
    )

    result = await request(base, '/api/fs/read-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: path.join(repo, 'tracked.txt'),
        encoding: 'utf8',
      }),
    })
    assert.equal(result.response.status, 200)
    assert.equal(result.data.content, 'first\nsecond\n')

    result = await request(base, '/api/fs/read-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: path.join(repo, 'tracked.txt') }),
    })
    assert.equal(result.response.status, 200)
    assert.equal(
      Buffer.from(result.data.content, 'base64').toString(),
      'first\nsecond\n'
    )

    result = await request(base, '/api/fs/read-dir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: repo }),
    })
    assert.equal(result.response.status, 200)
    assert.ok(
      result.data.entries.some(
        entry => entry.name === '.git' && entry.isDirectory
      )
    )
    assert.ok(
      result.data.entries.some(
        entry => entry.name === 'tracked.txt' && entry.isFile
      )
    )

    result = await request(base, '/api/fs/stat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: repo }),
    })
    assert.equal(result.response.status, 200)
    assert.equal(result.data.isDirectory, true)

    const createdDirectory = path.join(repo, 'created')
    result = await request(base, '/api/fs/mkdir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: createdDirectory }),
    })
    assert.equal(result.response.status, 200)
    const writtenFile = path.join(createdDirectory, 'written.txt')
    result = await request(base, '/api/fs/write-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: writtenFile, content: 'written' }),
    })
    assert.equal(result.response.status, 200)
    const copiedFile = path.join(createdDirectory, 'copied.txt')
    result = await request(base, '/api/fs/copy-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: writtenFile, to: copiedFile }),
    })
    assert.equal(result.response.status, 200)
    assert.equal(await fs.promises.readFile(copiedFile, 'utf8'), 'written')
    result = await request(base, '/api/fs/unlink', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: writtenFile }),
    })
    assert.equal(result.response.status, 200)
    assert.equal(fs.existsSync(writtenFile), false)

    result = await request(base, '/api/os/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: copiedFile, reveal: true }),
    })
    assert.equal(result.response.status, 200)
    assert.deepEqual(opened, [{ target: copiedFile, reveal: true }])
    result = await request(base, '/api/os/trash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: copiedFile }),
    })
    assert.equal(result.response.status, 200)
    assert.deepEqual(
      await Promise.all(trashed.map(value => fs.promises.realpath(value))),
      await Promise.all(
        [deleteTrashRepository, copiedFile].map(value =>
          fs.promises.realpath(value)
        )
      )
    )

    result = await request(base, '/api/integrations')
    assert.equal(result.response.status, 200)
    assert.equal(result.data.editors[0].name, 'Test Editor')
    assert.equal(result.data.shells[0].name, 'Test Shell')
    result = await request(base, '/api/integrations/launch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'editor',
        target: repo,
        name: 'Test Editor',
      }),
    })
    assert.equal(result.response.status, 200)
    result = await request(base, '/api/integrations/launch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'shell',
        target: repo,
        custom: {
          path: '/test/custom-shell',
          arguments: '--cwd %TARGET_PATH%',
        },
      }),
    })
    assert.equal(result.response.status, 200)
    assert.deepEqual(integrationLaunches, [
      {
        kind: 'editor',
        target: repo,
        name: 'Test Editor',
        custom: null,
      },
      {
        kind: 'shell',
        target: repo,
        name: null,
        custom: {
          path: '/test/custom-shell',
          arguments: '--cwd %TARGET_PATH%',
        },
      },
    ])
    result = await request(base, '/api/integrations/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: repo,
        custom: {
          path: '/test/branch-presets',
          arguments: '%TARGET_PATH%',
        },
      }),
    })
    assert.equal(result.response.status, 200)
    assert.equal(result.data.output, 'feature Feature branch\nfix Fix branch\n')
    assert.deepEqual(integrationOutputCalls, [
      {
        target: repo,
        custom: {
          path: '/test/branch-presets',
          arguments: '%TARGET_PATH%',
        },
      },
    ])

    result = await request(base, '/api/credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get', service: 'test', account: 'user' }),
    })
    assert.equal(result.response.status, 404)

    result = await request(base, '/api/hosting/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'https://api.example.test',
        token: 'secret-token',
      }),
    })
    assert.equal(result.response.status, 200)
    assert.equal(result.data.user.login, 'octocat')
    const hostingCredentialId = result.data.credentialId
    assert.ok(hostingCredentialId)
    assert.equal(
      credentials.get(`${githubCredentialService}:${hostingCredentialId}`),
      'secret-token'
    )
    credentials.delete(`${githubCredentialService}:${hostingCredentialId}`)
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: repo,
        operation: 'fetch',
        hostingAccount: {
          endpoint: 'https://api.example.test',
          login: 'octocat',
          credentialId: hostingCredentialId,
        },
      }),
    })
    assert.equal(
      result.response.status,
      200,
      'a GitHub credential must not be used for an unrelated local remote'
    )
    git(
      repo,
      'remote',
      'set-url',
      'origin',
      'https://api.example.test/repo.git'
    )
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: repo,
        operation: 'fetch',
        hostingAccount: {
          endpoint: 'https://api.example.test',
          login: 'octocat',
          credentialId: hostingCredentialId,
        },
      }),
    })
    assert.equal(
      result.response.status,
      401,
      'a matching signed-in remote must retrieve its token from the keychain'
    )
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: path.join(root, 'authenticated-clone'),
        operation: 'clone',
        url: 'https://api.example.test/octocat/private-repository.git',
        hostingAccount: {
          endpoint: 'https://api.example.test',
          login: 'octocat',
          credentialId: hostingCredentialId,
        },
      }),
    })
    assert.equal(
      result.response.status,
      401,
      'a matching private clone must retrieve its token from the keychain'
    )
    git(repo, 'remote', 'set-url', 'origin', remote)
    credentials.set(
      `${githubCredentialService}:${hostingCredentialId}`,
      'secret-token'
    )
    result = await request(base, '/api/hosting/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'https://enterprise.example.test/api/v3/',
        token: 'enterprise-token',
      }),
    })
    assert.equal(result.response.status, 200)
    const enterpriseCredentialId = result.data.credentialId
    assert.notEqual(enterpriseCredentialId, hostingCredentialId)
    assert.equal(
      result.data.user.endpoint,
      'https://enterprise.example.test/api/v3'
    )
    result = await request(base, '/api/hosting/pull-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'https://api.example.test',
        login: 'octocat',
        credentialId: hostingCredentialId,
        action: 'list',
        owner: 'octocat',
        repository: 'repo',
      }),
    })
    assert.equal(result.data.pullRequests[0].number, 1)
    result = await request(base, '/api/hosting/pull-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'https://api.example.test',
        login: 'octocat',
        credentialId: hostingCredentialId,
        action: 'create',
        owner: 'octocat',
        repository: 'repo',
        title: 'Web PR',
        head: 'feature',
        base: 'main',
      }),
    })
    assert.equal(result.data.pullRequest.number, 2)
    result = await request(base, '/api/hosting/pull-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'https://api.example.test',
        login: 'octocat',
        credentialId: hostingCredentialId,
        action: 'details',
        owner: 'octocat',
        repository: 'repo',
        pullRequestNumber: 1,
      }),
    })
    assert.equal(result.response.status, 200)
    assert.deepEqual(result.data.commitSHAs, [featureSha])
    assert.equal(result.data.files[0].path, 'branch.txt')
    assert.equal(result.data.files[0].status.kind, 'New')

    result = await request(base, '/api/hosting/checks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'https://api.example.test',
        login: 'octocat',
        credentialId: hostingCredentialId,
        action: 'get',
        owner: 'octocat',
        repository: 'repo',
        ref: 'refs/pull/1/head',
      }),
    })
    assert.equal(result.response.status, 200)
    assert.equal(result.data.check.conclusion, 'success')
    assert.equal(result.data.check.checks[0].checkSuiteId, 40)

    result = await request(base, '/api/hosting/checks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'https://api.example.test',
        login: 'octocat',
        credentialId: hostingCredentialId,
        action: 'suite',
        owner: 'octocat',
        repository: 'repo',
        checkSuiteId: 40,
      }),
    })
    assert.equal(result.response.status, 200)
    assert.equal(result.data.checkSuite.rerequestable, true)

    result = await request(base, '/api/hosting/checks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'https://api.example.test',
        login: 'octocat',
        credentialId: hostingCredentialId,
        action: 'rerun',
        owner: 'octocat',
        repository: 'repo',
        checkSuiteIds: [40],
      }),
    })
    assert.equal(result.response.status, 200)
    assert.deepEqual(result.data.results, [true])

    result = await request(base, '/api/hosting/checkout-pull-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: pullRequestRepo,
        endpoint: 'https://api.example.test',
        login: 'octocat',
        credentialId: hostingCredentialId,
        pullRequestNumber: 1,
        owner: 'octocat',
        cloneURL: remote,
        headRef: 'feature',
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    assert.equal(
      execFileSync('git', ['branch', '--show-current'], {
        cwd: pullRequestRepo,
        encoding: 'utf8',
      }).trim(),
      'pr/1'
    )
    assert.equal(
      await fs.promises.readFile(
        path.join(pullRequestRepo, 'branch.txt'),
        'utf8'
      ),
      'feature\n'
    )
    result = await request(base, '/api/hosting/prepare-pull-request-branch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: pullRequestRepo,
        endpoint: 'https://api.example.test',
        login: 'octocat',
        credentialId: hostingCredentialId,
        pullRequestNumber: 1,
        owner: 'octocat',
        cloneURL: remote,
        headRef: 'feature',
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    assert.equal(result.data.branchName, 'pr/1')
    assert.equal(result.data.branchType, 'Local')
    result = await request(base, '/api/hosting/repositories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'https://api.example.test',
        login: 'octocat',
        credentialId: hostingCredentialId,
      }),
    })
    assert.equal(result.response.status, 200)
    assert.equal(result.data.repositories[0].name, 'hosted-repository')
    result = await request(base, '/api/hosting/repository', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'https://api.example.test',
        login: 'octocat',
        credentialId: hostingCredentialId,
        owner: 'octocat',
        repository: 'repo',
      }),
    })
    assert.equal(result.response.status, 200)
    assert.equal(result.data.repository.parent.name, 'parent-repo')
    result = await request(base, '/api/hosting/fork', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'https://api.example.test',
        login: 'octocat',
        credentialId: hostingCredentialId,
        owner: 'octocat',
        repository: 'repo',
      }),
    })
    assert.equal(result.response.status, 200)
    assert.equal(result.data.fork.clone_url, `${remote}-fork`)
    result = await request(base, '/api/hosting/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: repo,
        endpoint: 'https://api.example.test',
        login: 'octocat',
        credentialId: hostingCredentialId,
        name: 'published-repo',
        description: 'Published from the web companion',
        private: true,
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    assert.equal(result.data.repository.name, 'published-repo')
    assert.ok(
      hostingCalls
        .filter(call => call.endpoint === 'https://api.example.test')
        .every(call => call.token === 'secret-token')
    )
    result = await request(base, '/api/hosting/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: emptyRepository,
        endpoint: 'https://api.example.test',
        login: 'octocat',
        credentialId: hostingCredentialId,
        name: 'empty-published-repo',
        private: true,
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    assert.equal(
      execFileSync('git', ['remote', 'get-url', 'origin'], {
        cwd: emptyRepository,
        encoding: 'utf8',
      }).trim(),
      remote
    )
    result = await request(base, '/api/hosting/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credentialId: hostingCredentialId }),
    })
    assert.equal(result.response.status, 200)
    assert.equal(result.data.deleted, true)
    assert.equal(
      credentials.has(`${githubCredentialService}:${hostingCredentialId}`),
      false
    )
    result = await request(base, '/api/hosting/pull-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'https://api.example.test',
        login: 'octocat',
        credentialId: hostingCredentialId,
        action: 'list',
        owner: 'octocat',
        repository: 'repo',
      }),
    })
    assert.equal(result.response.status, 401)

    assert.equal(
      normalizeGitHubEndpoint('https://github.example/api/v3/'),
      'https://github.example/api/v3'
    )
    assert.throws(
      () => normalizeGitHubEndpoint('https://github.example/custom/path'),
      /path must be empty or \/api\/v3/
    )
    const authenticatedEnv = authenticatedGitEnvironment(
      'https://github.example/owner/repo.git',
      'push-token'
    )
    assert.equal(
      authenticatedEnv.GIT_CONFIG_KEY_0,
      'http.https://github.example/.extraHeader'
    )
    assert.equal(authenticatedEnv.GIT_TERMINAL_PROMPT, '0')
    assert.doesNotMatch(authenticatedEnv.GIT_CONFIG_VALUE_0, /push-token/)

    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: repo, operation: 'lfs-install' }),
    })
    assert.equal(result.response.status, 501)
    result = await request(base, '/api/lfs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'install',
        scope: 'global',
        confirmed: false,
      }),
    })
    assert.equal(result.response.status, 400)
    assert.equal(result.data.code, 'confirmation-required')

    result = await request(base, '/api/dialog/show-open-dialog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test picker', defaultPath: repo }),
    })
    assert.equal(result.response.status, 200)
    assert.deepEqual(result.data, { path: repo, filePaths: [repo] })

    result = await request(base, '/api/dialog/show-save-dialog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Save test' }),
    })
    assert.equal(result.response.status, 200)
    assert.equal(result.data.path, path.join(repo, 'saved.txt'))

    await fs.promises.writeFile(path.join(repo, 'staged.txt'), 'keep staged\n')
    git(repo, 'add', 'staged.txt')
    const stagedBeforeCommit = git(repo, 'diff', '--cached', '--binary')
    await fs.promises.writeFile(
      path.join(repo, 'tracked.txt'),
      'first\nsecond\nthird\n'
    )
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: repo,
        operation: 'commit',
        message: 'Partial web commit\n',
        patches: [
          '--- a/tracked.txt\n+++ b/tracked.txt\n@@ -1 +1,2 @@\n first\n+second\n',
        ],
      }),
    })
    assert.equal(result.response.status, 200)
    assert.equal(
      execFileSync('git', ['show', 'HEAD:tracked.txt'], {
        cwd: repo,
        encoding: 'utf8',
      }),
      'first\nsecond\n'
    )
    assert.equal(
      await fs.promises.readFile(path.join(repo, 'tracked.txt'), 'utf8'),
      'first\nsecond\nthird\n'
    )
    assert.equal(git(repo, 'diff', '--cached', '--binary'), stagedBeforeCommit)

    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: repo,
        operation: 'discard-patch',
        patch:
          '--- a/tracked.txt\n+++ b/tracked.txt\n@@ -2,2 +2 @@\n second\n-third\n',
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    assert.equal(
      await fs.promises.readFile(path.join(repo, 'tracked.txt'), 'utf8'),
      'first\nsecond\n'
    )
    await fs.promises.writeFile(
      path.join(repo, 'tracked.txt'),
      'first\nsecond\nthird\n'
    )

    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: repo, operation: 'fetch' }),
    })
    assert.equal(result.response.status, 200)
    assert.equal(result.data.exitCode, 0)
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: repo,
        operation: 'fetch-refspec',
        values: ['refs/heads/feature:refs/remotes/origin/fetched-feature'],
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    assert.equal(
      execFileSync(
        'git',
        ['rev-parse', '--verify', 'refs/remotes/origin/fetched-feature'],
        { cwd: repo, encoding: 'utf8' }
      ).trim(),
      featureSha
    )

    const branchOperationName = 'no-track-branch'
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: repo,
        operation: 'create-branch',
        values: [branchOperationName, 'origin/feature'],
        noTrack: true,
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    assert.equal(
      execFileSync('git', ['branch', '--show-current'], {
        cwd: repo,
        encoding: 'utf8',
      }).trim(),
      'main',
      'branch creation must not change the checked out branch'
    )
    assert.throws(
      () =>
        execFileSync(
          'git',
          ['config', '--get', `branch.${branchOperationName}.remote`],
          { cwd: repo, encoding: 'utf8', stdio: 'pipe' }
        ),
      error => error.status === 1,
      'a no-track branch must not receive an upstream remote'
    )

    const fastForwardRemote = path.join(root, 'fast-forward-remote.git')
    const fastForwardSource = path.join(root, 'fast-forward-source')
    const fastForwardLocal = path.join(root, 'fast-forward-local')
    await fs.promises.mkdir(fastForwardSource)
    git(fastForwardSource, 'init', '-b', 'main')
    git(fastForwardSource, 'config', 'user.name', 'Fast Forward Test')
    git(fastForwardSource, 'config', 'user.email', 'fast-forward@example.com')
    await fs.promises.writeFile(
      path.join(fastForwardSource, 'base.txt'),
      'base\n'
    )
    git(fastForwardSource, 'add', 'base.txt')
    git(fastForwardSource, 'commit', '-m', 'base')
    git(root, 'init', '--bare', fastForwardRemote)
    git(fastForwardSource, 'remote', 'add', 'origin', fastForwardRemote)
    git(fastForwardSource, 'push', '-u', 'origin', 'main')
    git(root, 'clone', '--branch', 'main', fastForwardRemote, fastForwardLocal)
    git(fastForwardLocal, 'config', 'user.name', 'Fast Forward Local')
    git(
      fastForwardLocal,
      'config',
      'user.email',
      'fast-forward-local@example.com'
    )
    git(fastForwardLocal, 'branch', 'stale', 'origin/main')
    const staleBefore = execFileSync('git', ['rev-parse', 'stale'], {
      cwd: fastForwardLocal,
      encoding: 'utf8',
    }).trim()
    await fs.promises.writeFile(
      path.join(fastForwardSource, 'advanced.txt'),
      'advanced\n'
    )
    git(fastForwardSource, 'add', 'advanced.txt')
    git(fastForwardSource, 'commit', '-m', 'advance remote branch')
    git(fastForwardSource, 'push', 'origin', 'main')
    const advancedSha = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: fastForwardSource,
      encoding: 'utf8',
    }).trim()
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: fastForwardLocal,
        operation: 'fast-forward',
        values: ['stale'],
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    assert.equal(
      execFileSync('git', ['rev-parse', 'stale'], {
        cwd: fastForwardLocal,
        encoding: 'utf8',
      }).trim(),
      advancedSha
    )
    assert.equal(
      execFileSync('git', ['rev-parse', 'main'], {
        cwd: fastForwardLocal,
        encoding: 'utf8',
      }).trim(),
      staleBefore,
      'fast-forwarding another branch must not move the current branch'
    )

    const squashRepo = path.join(root, 'clean-squash-repo')
    await fs.promises.mkdir(squashRepo)
    git(squashRepo, 'init', '-b', 'main')
    git(squashRepo, 'config', 'user.name', 'Squash Test')
    git(squashRepo, 'config', 'user.email', 'squash@example.com')
    await fs.promises.writeFile(path.join(squashRepo, 'base.txt'), 'base\n')
    git(squashRepo, 'add', 'base.txt')
    git(squashRepo, 'commit', '-m', 'base')
    git(squashRepo, 'checkout', '-b', 'feature')
    await fs.promises.writeFile(
      path.join(squashRepo, 'feature.txt'),
      'feature\n'
    )
    git(squashRepo, 'add', 'feature.txt')
    git(squashRepo, 'commit', '-m', 'feature change')
    git(squashRepo, 'checkout', 'main')
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: squashRepo,
        operation: 'squash-merge',
        values: ['feature'],
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    assert.equal(
      await fs.promises.readFile(path.join(squashRepo, 'feature.txt'), 'utf8'),
      'feature\n'
    )
    assert.equal(
      execFileSync('git', ['rev-list', '--parents', '-n', '1', 'HEAD'], {
        cwd: squashRepo,
        encoding: 'utf8',
      })
        .trim()
        .split(/\s+/).length,
      2,
      'a clean squash merge must create a normal one-parent commit'
    )

    const conflictedSquashRepo = path.join(root, 'conflicted-squash-repo')
    await fs.promises.mkdir(conflictedSquashRepo)
    git(conflictedSquashRepo, 'init', '-b', 'main')
    git(conflictedSquashRepo, 'config', 'user.name', 'Squash Conflict Test')
    git(
      conflictedSquashRepo,
      'config',
      'user.email',
      'squash-conflict@example.com'
    )
    await fs.promises.writeFile(
      path.join(conflictedSquashRepo, 'conflict.txt'),
      'base\n'
    )
    git(conflictedSquashRepo, 'add', 'conflict.txt')
    git(conflictedSquashRepo, 'commit', '-m', 'base')
    git(conflictedSquashRepo, 'checkout', '-b', 'feature')
    await fs.promises.writeFile(
      path.join(conflictedSquashRepo, 'conflict.txt'),
      'feature\n'
    )
    git(conflictedSquashRepo, 'commit', '-am', 'feature change')
    git(conflictedSquashRepo, 'checkout', 'main')
    await fs.promises.writeFile(
      path.join(conflictedSquashRepo, 'conflict.txt'),
      'main\n'
    )
    git(conflictedSquashRepo, 'commit', '-am', 'main change')
    const conflictedSquashTip = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: conflictedSquashRepo,
      encoding: 'utf8',
    }).trim()
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: conflictedSquashRepo,
        operation: 'squash-merge',
        values: ['feature'],
      }),
    })
    assert.equal(result.response.status, 400)
    result = await request(
      base,
      `/api/status?path=${encodeURIComponent(conflictedSquashRepo)}`
    )
    assert.equal(result.data.operation, 'squash')
    assert.equal(
      result.data.workingDirectory.files[0].status.kind,
      'Conflicted'
    )
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: conflictedSquashRepo,
        operation: 'abort-squash',
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    assert.equal(
      execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: conflictedSquashRepo,
        encoding: 'utf8',
      }).trim(),
      conflictedSquashTip,
      'aborting a conflicted squash merge must preserve the pre-merge tip'
    )
    assert.equal(
      await fs.promises.readFile(
        path.join(conflictedSquashRepo, 'conflict.txt'),
        'utf8'
      ),
      'main\n'
    )
    result = await request(
      base,
      `/api/status?path=${encodeURIComponent(conflictedSquashRepo)}`
    )
    assert.equal(result.data.operation, null)
    assert.equal(result.data.workingDirectory.files.length, 0)

    const cherryEmptyRepo = path.join(root, 'cherry-empty-repo')
    await fs.promises.mkdir(cherryEmptyRepo)
    git(cherryEmptyRepo, 'init', '-b', 'main')
    git(cherryEmptyRepo, 'config', 'user.name', 'Cherry Empty Test')
    git(cherryEmptyRepo, 'config', 'user.email', 'cherry-empty@example.com')
    await fs.promises.writeFile(
      path.join(cherryEmptyRepo, 'base.txt'),
      'base\n'
    )
    git(cherryEmptyRepo, 'add', 'base.txt')
    git(cherryEmptyRepo, 'commit', '-m', 'base')
    git(cherryEmptyRepo, 'checkout', '-b', 'source')
    await fs.promises.writeFile(
      path.join(cherryEmptyRepo, 'already-applied.txt'),
      'same change\n'
    )
    git(cherryEmptyRepo, 'add', 'already-applied.txt')
    git(cherryEmptyRepo, 'commit', '-m', 'source change')
    const emptyCherrySha = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: cherryEmptyRepo,
      encoding: 'utf8',
    }).trim()
    git(cherryEmptyRepo, 'checkout', 'main')
    git(cherryEmptyRepo, 'checkout', 'source', '--', 'already-applied.txt')
    git(cherryEmptyRepo, 'add', 'already-applied.txt')
    git(cherryEmptyRepo, 'commit', '-m', 'equivalent change')
    const emptyCherryCount = Number(
      execFileSync('git', ['rev-list', '--count', 'HEAD'], {
        cwd: cherryEmptyRepo,
        encoding: 'utf8',
      }).trim()
    )
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: cherryEmptyRepo,
        operation: 'cherry-pick',
        values: [emptyCherrySha],
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    assert.equal(
      Number(
        execFileSync('git', ['rev-list', '--count', 'HEAD'], {
          cwd: cherryEmptyRepo,
          encoding: 'utf8',
        }).trim()
      ),
      emptyCherryCount + 1,
      'an already-applied cherry-pick must preserve an empty commit'
    )
    assert.equal(
      execFileSync('git', ['log', '-1', '--format=%s'], {
        cwd: cherryEmptyRepo,
        encoding: 'utf8',
      }).trim(),
      'source change'
    )

    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: repo,
        operation: 'stash',
        message: 'web-test',
      }),
    })
    assert.equal(result.response.status, 200)
    assert.equal(
      await fs.promises.readFile(path.join(repo, 'tracked.txt'), 'utf8'),
      'first\nsecond\n'
    )
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: repo, operation: 'stash-apply' }),
    })
    assert.equal(result.response.status, 200)
    assert.equal(
      await fs.promises.readFile(path.join(repo, 'tracked.txt'), 'utf8'),
      'first\nsecond\nthird\n'
    )
    git(repo, 'checkout', '--', 'tracked.txt')
    assert.equal(
      execFileSync('git', ['stash', 'list'], { cwd: repo, encoding: 'utf8' })
        .split('\n')
        .filter(Boolean).length,
      1
    )
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: repo,
        operation: 'stash-rename',
        message: 'renamed-web-test',
      }),
    })
    assert.equal(result.response.status, 200)
    assert.match(
      execFileSync('git', ['stash', 'list'], { cwd: repo, encoding: 'utf8' }),
      /!!Name<renamed-web-test>!!GitHub_Desktop<main>/
    )
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: repo,
        operation: 'stash-rename',
        customName: null,
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    const clearedStashList = execFileSync('git', ['stash', 'list'], {
      cwd: repo,
      encoding: 'utf8',
    })
    assert.doesNotMatch(clearedStashList, /renamed-web-test/)
    assert.match(clearedStashList, /!!GitHub_Desktop<main>/)
    for (const untracked of ['created', 'untracked.txt'])
      await fs.promises.rm(path.join(repo, untracked), {
        recursive: true,
        force: true,
      })
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: repo, operation: 'stash-pop' }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    assert.equal(
      await fs.promises.readFile(path.join(repo, 'tracked.txt'), 'utf8'),
      'first\nsecond\nthird\n'
    )

    await fs.promises.writeFile(
      path.join(repo, 'selected-stash.txt'),
      'selected\n'
    )
    await fs.promises.writeFile(
      path.join(repo, 'unselected-stash.txt'),
      'unselected\n'
    )
    git(repo, 'add', 'unselected-stash.txt')
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: repo,
        operation: 'stash',
        values: ['selected-stash.txt'],
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    assert.equal(fs.existsSync(path.join(repo, 'selected-stash.txt')), false)
    assert.equal(fs.existsSync(path.join(repo, 'unselected-stash.txt')), true)
    assert.equal(
      execFileSync('git', ['diff', '--cached', '--name-only'], {
        cwd: repo,
        encoding: 'utf8',
      }).trim(),
      ''
    )
    assert.match(
      execFileSync('git', ['stash', 'list'], { cwd: repo, encoding: 'utf8' }),
      /!!GitHub_Desktop<main>/
    )
    await fs.promises.rm(path.join(repo, 'unselected-stash.txt'))
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: repo, operation: 'stash-drop' }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))

    for (const body of [
      { operation: 'tag-create', values: ['web-v1'], message: '' },
      { operation: 'create-branch', values: ['rename-me'] },
      { operation: 'remote-add', values: ['backup', remote] },
      { operation: 'remote-set-url', values: ['backup', remote] },
      { operation: 'remote-remove', values: ['backup'] },
    ]) {
      result = await request(base, '/api/git/operation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: repo, ...body }),
      })
      assert.equal(
        result.response.status,
        200,
        `${body.operation}: ${JSON.stringify(result.data)}`
      )
    }
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: repo,
        operation: 'checkout',
        values: ['rename-me'],
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    await fs.promises.writeFile(
      path.join(repo, 'renamed-branch-stash.txt'),
      'rename this stash association\n'
    )
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: repo,
        operation: 'stash',
        values: ['renamed-branch-stash.txt'],
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: repo,
        operation: 'rename-branch',
        values: ['rename-me', 'renamed'],
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    const renamedBranchStashes = execFileSync('git', ['stash', 'list'], {
      cwd: repo,
      encoding: 'utf8',
    })
    assert.match(renamedBranchStashes, /!!GitHub_Desktop<renamed>/)
    assert.doesNotMatch(renamedBranchStashes, /!!GitHub_Desktop<rename-me>/)
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: repo,
        operation: 'checkout',
        values: ['main'],
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: repo,
        operation: 'delete-branch',
        values: ['renamed'],
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: repo,
        operation: 'remote-add',
        values: ['fetched-backup', remote],
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    assert.equal(
      execFileSync(
        'git',
        ['show-ref', '--verify', 'refs/remotes/fetched-backup/feature'],
        { cwd: repo, encoding: 'utf8' }
      ).length > 0,
      true,
      'adding a remote must fetch its branches so Desktop can show them'
    )
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: repo,
        operation: 'remote-remove',
        values: ['fetched-backup'],
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    assert.match(
      execFileSync('git', ['tag', '--list'], { cwd: repo, encoding: 'utf8' }),
      /web-v1/
    )
    assert.equal(
      execFileSync('git', ['cat-file', '-t', 'web-v1'], {
        cwd: repo,
        encoding: 'utf8',
      }).trim(),
      'tag',
      'Desktop-created tags are annotated tags'
    )
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: repo,
        operation: 'push',
        tagsToPush: ['web-v1'],
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    assert.equal(
      execFileSync('git', ['show-ref', '--verify', 'refs/tags/web-v1'], {
        cwd: remote,
        encoding: 'utf8',
      }).length > 0,
      true,
      'push must include the explicitly selected tag'
    )
    const localTagState = await request(
      base,
      `/api/branches/current?path=${encodeURIComponent(repo)}`
    )
    assert.equal(
      localTagState.data.tags.find(tag => tag.name === 'web-v1').pushedRemotes,
      undefined,
      'ordinary branch refreshes must not query remote tags'
    )
    const tagState = await request(
      base,
      `/api/branches/current?path=${encodeURIComponent(repo)}&remoteTags=1`
    )
    const pushedTag = tagState.data.tags.find(tag => tag.name === 'web-v1')
    assert.deepEqual(
      pushedTag.pushedRemotes,
      ['origin'],
      'branch metadata must mark tags pushed to configured remotes'
    )
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: repo,
        operation: 'tag-delete',
        values: ['web-v1'],
      }),
    })
    assert.equal(result.response.status, 200)

    const stashOptionsRepo = path.join(root, 'stash-options-repo')
    await fs.promises.mkdir(stashOptionsRepo)
    git(stashOptionsRepo, 'init', '-b', 'main')
    git(stashOptionsRepo, 'config', 'user.name', 'Stash Options Test')
    git(stashOptionsRepo, 'config', 'user.email', 'stash-options@example.com')
    await fs.promises.writeFile(
      path.join(stashOptionsRepo, 'tracked.txt'),
      'base\n'
    )
    git(stashOptionsRepo, 'add', 'tracked.txt')
    git(stashOptionsRepo, 'commit', '-m', 'base')
    await fs.promises.writeFile(
      path.join(stashOptionsRepo, 'tracked.txt'),
      'changed\n'
    )
    await fs.promises.writeFile(
      path.join(stashOptionsRepo, 'untracked.txt'),
      'untracked\n'
    )
    git(stashOptionsRepo, 'add', 'tracked.txt')
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: stashOptionsRepo,
        operation: 'stash',
        message: 'without untracked',
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    assert.equal(
      fs.existsSync(path.join(stashOptionsRepo, 'untracked.txt')),
      true,
      'stash must leave untracked files alone unless explicitly included'
    )
    assert.equal(
      execFileSync('git', ['diff', '--cached', '--name-only'], {
        cwd: stashOptionsRepo,
        encoding: 'utf8',
      }).trim(),
      '',
      'stash without keep-index must clear staged changes after stashing'
    )
    await fs.promises.writeFile(
      path.join(stashOptionsRepo, 'tracked.txt'),
      'changed again\n'
    )
    await fs.promises.writeFile(
      path.join(stashOptionsRepo, 'untracked.txt'),
      'untracked again\n'
    )
    git(stashOptionsRepo, 'add', 'tracked.txt')
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: stashOptionsRepo,
        operation: 'stash',
        message: 'with untracked',
        includeUntracked: true,
        keepIndex: true,
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    assert.equal(
      fs.existsSync(path.join(stashOptionsRepo, 'untracked.txt')),
      false,
      'stash includeUntracked must save untracked files'
    )
    assert.equal(
      execFileSync('git', ['diff', '--cached', '--name-only'], {
        cwd: stashOptionsRepo,
        encoding: 'utf8',
      }).trim(),
      'tracked.txt',
      'stash keepIndex must preserve staged changes'
    )

    const checkoutRecoveryRepo = path.join(root, 'checkout-recovery-repo')
    await fs.promises.mkdir(checkoutRecoveryRepo)
    git(checkoutRecoveryRepo, 'init', '-b', 'main')
    git(checkoutRecoveryRepo, 'config', 'user.name', 'Checkout Recovery')
    git(
      checkoutRecoveryRepo,
      'config',
      'user.email',
      'checkout-recovery@example.com'
    )
    await fs.promises.writeFile(
      path.join(checkoutRecoveryRepo, 'shared.txt'),
      'base\n'
    )
    git(checkoutRecoveryRepo, 'add', 'shared.txt')
    git(checkoutRecoveryRepo, 'commit', '-m', 'checkout base')
    git(checkoutRecoveryRepo, 'checkout', '-b', 'destination')
    await fs.promises.writeFile(
      path.join(checkoutRecoveryRepo, 'shared.txt'),
      'destination version\n'
    )
    git(checkoutRecoveryRepo, 'add', 'shared.txt')
    git(checkoutRecoveryRepo, 'commit', '-m', 'destination shared change')
    await fs.promises.writeFile(
      path.join(checkoutRecoveryRepo, 'destination.txt'),
      'destination\n'
    )
    git(checkoutRecoveryRepo, 'add', 'destination.txt')
    git(checkoutRecoveryRepo, 'commit', '-m', 'destination')
    git(checkoutRecoveryRepo, 'checkout', 'main')
    await fs.promises.writeFile(
      path.join(checkoutRecoveryRepo, 'existing-stash.txt'),
      'existing stash\n'
    )
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: checkoutRecoveryRepo,
        operation: 'stash',
        message: 'existing stash',
        includeUntracked: true,
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    const existingStashTip = execFileSync('git', ['rev-parse', 'refs/stash'], {
      cwd: checkoutRecoveryRepo,
      encoding: 'utf8',
    }).trim()
    await fs.promises.writeFile(
      path.join(checkoutRecoveryRepo, 'shared.txt'),
      'dirty before checkout\n'
    )
    await fs.promises.writeFile(
      path.join(checkoutRecoveryRepo, 'temporary-stash.txt'),
      'temporary stash\n'
    )
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: checkoutRecoveryRepo,
        operation: 'checkout',
        values: ['destination'],
        stashChanges: true,
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    assert.equal(
      execFileSync('git', ['branch', '--show-current'], {
        cwd: checkoutRecoveryRepo,
        encoding: 'utf8',
      }).trim(),
      'destination'
    )
    assert.equal(
      execFileSync('git', ['rev-parse', 'refs/stash@{1}'], {
        cwd: checkoutRecoveryRepo,
        encoding: 'utf8',
      }).trim(),
      existingStashTip,
      'checkout recovery must preserve the existing stash tip'
    )
    const checkoutStashes = execFileSync(
      'git',
      ['stash', 'list', '--format=%H %s'],
      { cwd: checkoutRecoveryRepo, encoding: 'utf8' }
    )
    assert.match(
      checkoutStashes,
      /!!Name<Changes%20before%20switching%20branches%20.*!!GitHub_Desktop<main>/
    )
    assert.match(checkoutStashes, /!!GitHub_Desktop<main>/)

    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: checkoutRecoveryRepo,
        operation: 'checkout',
        values: ['main'],
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: checkoutRecoveryRepo,
        operation: 'stash-pop',
        values: ['stash@{0}'],
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    assert.equal(
      fs.readFileSync(
        path.join(checkoutRecoveryRepo, 'temporary-stash.txt'),
        'utf8'
      ),
      'temporary stash\n'
    )
    assert.match(
      execFileSync('git', ['stash', 'list', '--format=%s'], {
        cwd: checkoutRecoveryRepo,
        encoding: 'utf8',
      }),
      /!!Name<existing%20stash>!!GitHub_Desktop<main>/,
      'checkout recovery must leave the pre-existing stash untouched'
    )

    const submoduleFailureRepo = path.join(root, 'checkout-submodule-failure')
    await fs.promises.mkdir(submoduleFailureRepo)
    git(submoduleFailureRepo, 'init', '-b', 'main')
    git(submoduleFailureRepo, 'config', 'user.name', 'Submodule Recovery')
    git(
      submoduleFailureRepo,
      'config',
      'user.email',
      'submodule-recovery@example.com'
    )
    await fs.promises.writeFile(
      path.join(submoduleFailureRepo, 'shared.txt'),
      'base\n'
    )
    git(submoduleFailureRepo, 'add', 'shared.txt')
    git(submoduleFailureRepo, 'commit', '-m', 'submodule recovery base')
    git(submoduleFailureRepo, 'checkout', '-b', 'broken-destination')
    await fs.promises.writeFile(
      path.join(submoduleFailureRepo, '.gitmodules'),
      '[submodule "broken"]\n\tpath = broken\n\turl = /path/that/does/not/exist\n'
    )
    git(submoduleFailureRepo, 'add', '.gitmodules')
    git(
      submoduleFailureRepo,
      'update-index',
      '--add',
      '--cacheinfo',
      '160000,1111111111111111111111111111111111111111,broken'
    )
    git(submoduleFailureRepo, 'commit', '-m', 'broken submodule')
    git(submoduleFailureRepo, 'checkout', 'main')
    await fs.promises.writeFile(
      path.join(submoduleFailureRepo, 'shared.txt'),
      'keep this dirty change\n'
    )
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: submoduleFailureRepo,
        operation: 'checkout',
        values: ['broken-destination'],
        moveChanges: true,
      }),
    })
    assert.equal(result.response.status, 400, JSON.stringify(result.data))
    assert.equal(
      execFileSync('git', ['branch', '--show-current'], {
        cwd: submoduleFailureRepo,
        encoding: 'utf8',
      }).trim(),
      'main',
      'failed checkout recovery must return to the source branch'
    )
    assert.equal(
      fs.readFileSync(path.join(submoduleFailureRepo, 'shared.txt'), 'utf8'),
      'keep this dirty change\n',
      'failed checkout recovery must restore the dirty worktree'
    )

    const discardRepo = path.join(root, 'discard-repo')
    await fs.promises.mkdir(discardRepo)
    git(discardRepo, 'init', '-b', 'main')
    git(discardRepo, 'config', 'user.name', 'Discard Test')
    git(discardRepo, 'config', 'user.email', 'discard@example.com')
    await fs.promises.writeFile(path.join(discardRepo, 'tracked.txt'), 'base\n')
    git(discardRepo, 'add', 'tracked.txt')
    git(discardRepo, 'commit', '-m', 'base')
    await fs.promises.writeFile(
      path.join(discardRepo, 'tracked.txt'),
      'changed\n'
    )
    await fs.promises.writeFile(
      path.join(discardRepo, 'untracked.txt'),
      'leave me\n'
    )
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: discardRepo,
        operation: 'discard',
        values: ['tracked.txt'],
        moveToTrash: false,
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    assert.equal(
      await fs.promises.readFile(path.join(discardRepo, 'tracked.txt'), 'utf8'),
      'base\n'
    )
    assert.equal(
      await fs.promises.readFile(
        path.join(discardRepo, 'untracked.txt'),
        'utf8'
      ),
      'leave me\n',
      'discarding one tracked file must not clean unrelated untracked files'
    )
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: discardRepo,
        operation: 'discard',
        values: ['untracked.txt'],
        moveToTrash: false,
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    assert.equal(fs.existsSync(path.join(discardRepo, 'untracked.txt')), false)
    await fs.promises.writeFile(
      path.join(discardRepo, 'untracked-again.txt'),
      'remove every untracked file\n'
    )
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: discardRepo,
        operation: 'discard',
        values: ['tracked.txt'],
        moveToTrash: false,
        cleanUntracked: true,
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    assert.equal(
      fs.existsSync(path.join(discardRepo, 'untracked-again.txt')),
      false,
      'permanent discard-all cleans remaining untracked files'
    )

    const stashConflictRepo = path.join(root, 'stash-conflict-repo')
    await fs.promises.mkdir(stashConflictRepo)
    git(stashConflictRepo, 'init', '-b', 'main')
    git(stashConflictRepo, 'config', 'user.name', 'Stash Conflict Test')
    git(stashConflictRepo, 'config', 'user.email', 'stash-conflict@example.com')
    await fs.promises.writeFile(
      path.join(stashConflictRepo, 'shared.txt'),
      'base\n'
    )
    git(stashConflictRepo, 'add', 'shared.txt')
    git(stashConflictRepo, 'commit', '-m', 'base')
    await fs.promises.writeFile(
      path.join(stashConflictRepo, 'shared.txt'),
      'stash version\n'
    )
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: stashConflictRepo, operation: 'stash' }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    await fs.promises.writeFile(
      path.join(stashConflictRepo, 'shared.txt'),
      'committed version\n'
    )
    git(stashConflictRepo, 'add', 'shared.txt')
    git(stashConflictRepo, 'commit', '-m', 'conflicting change')
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: stashConflictRepo,
        operation: 'stash-pop',
      }),
    })
    assert.equal(
      result.response.status,
      200,
      'a stash conflict must return a recoverable operation result'
    )
    result = await request(
      base,
      `/api/status?path=${encodeURIComponent(stashConflictRepo)}`
    )
    assert.equal(
      result.data.workingDirectory.files[0].status.kind,
      'Conflicted',
      'stash conflicts must remain visible in the Changes workflow'
    )
    assert.deepEqual(result.data.workingDirectory.files[0].status.entry, {
      kind: 'conflicted',
      action: 'both-modified',
      us: 'U',
      them: 'U',
    })
    assert.equal(
      result.data.workingDirectory.files[0].status.conflictMarkerCount,
      1,
      'text conflicts must expose marker metadata for the native Desktop resolver'
    )
    assert.match(
      execFileSync('git', ['stash', 'list'], {
        cwd: stashConflictRepo,
        encoding: 'utf8',
      }),
      /GitHub_Desktop/,
      'a conflicted stash pop must retain the stash for recovery'
    )
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: stashConflictRepo,
        operation: 'commit',
        files: ['shared.txt'],
        message: 'must not commit unresolved conflict',
      }),
    })
    assert.equal(
      result.response.status,
      409,
      'normal commits must not accept unresolved conflicts'
    )
    await fs.promises.writeFile(
      path.join(stashConflictRepo, 'shared.txt'),
      'manual resolution\n'
    )
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: stashConflictRepo,
        operation: 'commit',
        files: ['shared.txt'],
        resolutions: [['shared.txt', 'manual']],
        message: 'resolve stash manually',
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    assert.equal(
      await fs.promises.readFile(
        path.join(stashConflictRepo, 'shared.txt'),
        'utf8'
      ),
      'manual resolution\n',
      'manual resolutions must stage the edited working tree content'
    )

    const bulkDeleteRepo = path.join(root, 'bulk-delete-repo')
    const bulkDeleteWorktree = path.join(root, 'bulk-delete-worktree')
    await fs.promises.mkdir(bulkDeleteRepo)
    git(bulkDeleteRepo, 'init', '-b', 'main')
    git(bulkDeleteRepo, 'config', 'user.name', 'Bulk Delete Test')
    git(bulkDeleteRepo, 'config', 'user.email', 'bulk-delete@example.com')
    await fs.promises.writeFile(path.join(bulkDeleteRepo, 'base.txt'), 'base\n')
    git(bulkDeleteRepo, 'add', 'base.txt')
    git(bulkDeleteRepo, 'commit', '-m', 'base')
    git(bulkDeleteRepo, 'branch', 'other')
    git(bulkDeleteRepo, 'worktree', 'add', '-b', 'in-use', bulkDeleteWorktree)
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: bulkDeleteRepo,
        operation: 'delete-branches',
        values: ['other', 'in-use'],
      }),
    })
    assert.equal(
      result.response.status,
      409,
      'bulk deletion must reject branches checked out in another worktree'
    )
    assert.match(
      execFileSync('git', ['branch', '--list'], {
        cwd: bulkDeleteRepo,
        encoding: 'utf8',
      }),
      /other/,
      'bulk deletion must not partially delete branches before validation'
    )

    await fs.promises.writeFile(path.join(repo, 'tracked.txt'), 'reset-me\n')
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: repo, operation: 'reset-upstream' }),
    })
    assert.equal(result.response.status, 400)
    assert.equal(result.data.code, 'confirmation-required')
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: repo,
        operation: 'reset-upstream',
        confirmed: true,
      }),
    })
    assert.equal(result.response.status, 409)
    assert.equal(result.data.code, 'local-changes-overwritten')
    assert.equal(
      await fs.promises.readFile(path.join(repo, 'tracked.txt'), 'utf8'),
      'reset-me\n'
    )

    git(repo, 'reset', '--hard')
    git(repo, 'clean', '-f', '-d')
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: repo,
        operation: 'reset-upstream',
        confirmed: true,
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    const makeCommit = message => {
      fs.appendFileSync(path.join(repo, 'tracked.txt'), `${message}\n`)
      git(repo, 'add', 'tracked.txt')
      git(repo, 'commit', '-m', message)
      return execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: repo,
        encoding: 'utf8',
      }).trim()
    }
    const reorderBase = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repo,
      encoding: 'utf8',
    }).trim()
    const makeIndependentCommit = message => {
      fs.writeFileSync(path.join(repo, `${message}.txt`), `${message}\n`)
      git(repo, 'add', `${message}.txt`)
      git(repo, 'commit', '-m', message)
      return execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: repo,
        encoding: 'utf8',
      }).trim()
    }
    const orderOne = makeIndependentCommit('order-one')
    const orderTwo = makeIndependentCommit('order-two')
    const orderThree = makeIndependentCommit('order-three')
    const orderFour = makeIndependentCommit('order-four')
    const reorderUndoSha = orderFour
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: repo,
        operation: 'reorder-commits',
        base: reorderBase,
        commits: [orderThree],
        before: orderOne,
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    assert.equal(
      execFileSync(
        'git',
        ['log', '--reverse', '--format=%s', `${reorderBase}..HEAD`],
        { cwd: repo, encoding: 'utf8' }
      )
        .trim()
        .split('\n')
        .join(','),
      'order-three,order-one,order-two,order-four'
    )
    const reorderedTip = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repo,
      encoding: 'utf8',
    }).trim()
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: repo,
        operation: 'undo-history-rewrite',
        values: ['main', reorderUndoSha, reorderedTip],
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    assert.equal(
      execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: repo,
        encoding: 'utf8',
      }).trim(),
      reorderUndoSha,
      'undoing a rewrite must restore the pre-rewrite branch tip'
    )
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: repo,
        operation: 'undo-history-rewrite',
        values: ['main', reorderUndoSha, reorderedTip],
      }),
    })
    assert.equal(
      result.response.status,
      409,
      'undo must refuse to overwrite branch changes made after the rewrite'
    )

    const squashBase = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repo,
      encoding: 'utf8',
    }).trim()
    const squashOne = makeIndependentCommit('squash-one')
    const squashTwo = makeIndependentCommit('squash-two')
    const squashThree = makeIndependentCommit('squash-three')
    const squashFour = makeIndependentCommit('squash-four')
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: repo,
        operation: 'squash-commits',
        base: squashBase,
        commits: [squashOne, squashFour],
        squashOnto: squashThree,
        message: 'Combined squash\n\nPreserve this message.',
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    assert.equal(
      execFileSync(
        'git',
        ['log', '--reverse', '--format=%s', `${squashBase}..HEAD`],
        { cwd: repo, encoding: 'utf8' }
      )
        .trim()
        .split('\n')
        .join(','),
      'squash-two,Combined squash'
    )
    assert.equal(
      execFileSync('git', ['log', '-1', '--format=%B'], {
        cwd: repo,
        encoding: 'utf8',
      }).trim(),
      'Combined squash\n\nPreserve this message.'
    )

    const conflictBase = execFileSync('git', ['branch', '--show-current'], {
      cwd: repo,
      encoding: 'utf8',
    }).trim()
    git(repo, 'checkout', '-b', 'conflict-side')
    fs.writeFileSync(path.join(repo, 'conflict.txt'), 'side\n')
    git(repo, 'add', 'conflict.txt')
    git(repo, 'commit', '-m', 'conflict side')
    git(repo, 'checkout', conflictBase)
    fs.writeFileSync(path.join(repo, 'conflict.txt'), 'main\n')
    git(repo, 'add', 'conflict.txt')
    git(repo, 'commit', '-m', 'conflict main')
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: repo,
        operation: 'merge',
        values: ['conflict-side'],
      }),
    })
    assert.equal(result.response.status, 400)
    result = await request(base, `/api/status${query}`)
    assert.equal(result.data.operation, 'merge')
    fs.writeFileSync(path.join(repo, 'conflict.txt'), 'resolved\n')
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: repo,
        operation: 'finish-merge',
        resolutions: [['conflict.txt', 'manual']],
      }),
    })
    assert.equal(result.response.status, 200)
    result = await request(base, `/api/status${query}`)
    assert.equal(result.data.operation, null)

    git(repo, 'checkout', '-b', 'rebase-side')
    fs.writeFileSync(path.join(repo, 'rebase-conflict.txt'), 'side\n')
    git(repo, 'add', 'rebase-conflict.txt')
    git(repo, 'commit', '-m', 'rebase side')
    git(repo, 'checkout', conflictBase)
    fs.writeFileSync(path.join(repo, 'rebase-conflict.txt'), 'main\n')
    git(repo, 'add', 'rebase-conflict.txt')
    git(repo, 'commit', '-m', 'rebase main')
    git(repo, 'checkout', 'rebase-side')
    git(repo, 'config', 'rebase.backend', 'apply')
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: repo,
        operation: 'rebase',
        values: [conflictBase],
      }),
    })
    assert.equal(result.response.status, 400)
    result = await request(base, `/api/status${query}`)
    assert.equal(result.data.operation, 'rebase')
    assert.equal(
      fs.existsSync(path.join(repo, '.git', 'rebase-merge')),
      true,
      'the Desktop merge rebase backend should override the Git config'
    )
    assert.equal(result.data.operationState.targetBranch, 'rebase-side')
    assert.ok(result.data.operationState.originalBranchTip)
    assert.ok(result.data.operationState.baseBranchTip)
    fs.writeFileSync(
      path.join(repo, 'rebase-conflict.txt'),
      'resolved rebase\n'
    )
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: repo,
        operation: 'continue-rebase',
        resolutions: [['rebase-conflict.txt', 'manual']],
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    result = await request(base, `/api/status${query}`)
    assert.equal(result.data.operation, null)

    const squashConflictRepo = path.join(root, 'squash-conflict-repo')
    await fs.promises.mkdir(squashConflictRepo)
    git(squashConflictRepo, 'init', '-b', 'main')
    git(squashConflictRepo, 'config', 'user.name', 'Squash Conflict Test')
    git(
      squashConflictRepo,
      'config',
      'user.email',
      'squash-conflict@example.com'
    )
    await fs.promises.writeFile(
      path.join(squashConflictRepo, 'shared.txt'),
      'base\n'
    )
    git(squashConflictRepo, 'add', 'shared.txt')
    git(squashConflictRepo, 'commit', '-m', 'base')
    git(squashConflictRepo, 'checkout', '-b', 'feature')
    await fs.promises.writeFile(
      path.join(squashConflictRepo, 'shared.txt'),
      'feature\n'
    )
    git(squashConflictRepo, 'add', 'shared.txt')
    git(squashConflictRepo, 'commit', '-m', 'feature change')
    const squashTargetSha = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: squashConflictRepo,
      encoding: 'utf8',
    }).trim()
    await fs.promises.writeFile(
      path.join(squashConflictRepo, 'second.txt'),
      'second\n'
    )
    git(squashConflictRepo, 'add', 'second.txt')
    git(squashConflictRepo, 'commit', '-m', 'second change')
    const squashCommitSha = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: squashConflictRepo,
      encoding: 'utf8',
    }).trim()
    git(squashConflictRepo, 'checkout', 'main')
    await fs.promises.writeFile(
      path.join(squashConflictRepo, 'shared.txt'),
      'main\n'
    )
    git(squashConflictRepo, 'add', 'shared.txt')
    git(squashConflictRepo, 'commit', '-m', 'main change')
    git(squashConflictRepo, 'checkout', 'feature')
    const recoveredSquashMessage =
      'Recovered squash message\n\nThis must survive a rebase conflict.'
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: squashConflictRepo,
        operation: 'squash-commits',
        base: 'main',
        commits: [squashCommitSha],
        squashOnto: squashTargetSha,
        message: recoveredSquashMessage,
      }),
    })
    assert.equal(result.response.status, 400)
    result = await request(
      base,
      `/api/status?path=${encodeURIComponent(squashConflictRepo)}`
    )
    assert.equal(result.data.operation, 'rebase')
    await fs.promises.writeFile(
      path.join(squashConflictRepo, 'shared.txt'),
      'resolved\n'
    )
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: squashConflictRepo,
        operation: 'continue-rebase',
        resolutions: [['shared.txt', 'manual']],
        message: recoveredSquashMessage,
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    assert.equal(
      execFileSync('git', ['log', '-1', '--format=%B'], {
        cwd: squashConflictRepo,
        encoding: 'utf8',
      }).trim(),
      recoveredSquashMessage
    )

    git(repo, 'checkout', conflictBase)
    git(repo, 'checkout', '-b', 'cherry-pick-side')
    fs.writeFileSync(path.join(repo, 'cherry-pick-conflict.txt'), 'side\n')
    git(repo, 'add', 'cherry-pick-conflict.txt')
    git(repo, 'commit', '-m', 'cherry-pick side')
    const cherryPickSha = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repo,
      encoding: 'utf8',
    }).trim()
    git(repo, 'checkout', conflictBase)
    fs.writeFileSync(path.join(repo, 'cherry-pick-conflict.txt'), 'main\n')
    git(repo, 'add', 'cherry-pick-conflict.txt')
    git(repo, 'commit', '-m', 'cherry-pick main')
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: repo,
        operation: 'cherry-pick',
        values: [cherryPickSha],
      }),
    })
    assert.equal(result.response.status, 400)
    result = await request(base, `/api/status${query}`)
    assert.equal(result.data.operation, 'cherryPick')
    fs.writeFileSync(
      path.join(repo, 'cherry-pick-conflict.txt'),
      'resolved cherry-pick\n'
    )
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: repo,
        operation: 'continue-cherry-pick',
        resolutions: [['cherry-pick-conflict.txt', 'manual']],
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    result = await request(base, `/api/status${query}`)
    assert.equal(result.data.operation, null)

    await fs.promises.writeFile(path.join(repo, '.gitignore'), 'local/*.json\n')
    await fs.promises.mkdir(path.join(repo, 'local'))
    await fs.promises.writeFile(
      path.join(repo, 'local', 'settings.json'),
      '{"local":true}\n'
    )
    await fs.promises.writeFile(
      path.join(repo, '.worktreeinclude'),
      '# Local worktree files\nlocal/**\n'
    )
    result = await request(base, `/api/branches/current${query}`)
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    assert.deepEqual(
      result.data.worktreeInclude,
      {
        configured: true,
        patterns: ['local/**'],
      },
      'branch metadata must expose the configured worktree include patterns'
    )

    const worktreePath = path.join(root, 'worktree')
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: repo,
        operation: 'worktree-add',
        worktreePath,
        commitish: 'feature',
      }),
    })
    assert.equal(result.response.status, 200)
    assert.equal((await fs.promises.stat(worktreePath)).isDirectory(), true)
    assert.equal(
      execFileSync('git', ['branch', '--show-current'], {
        cwd: worktreePath,
        encoding: 'utf8',
      }).trim(),
      'feature'
    )
    assert.equal(
      await fs.promises.readFile(
        path.join(worktreePath, 'local', 'settings.json'),
        'utf8'
      ),
      '{"local":true}\n'
    )

    const newBranchWorktreePath = path.join(root, 'new-branch-worktree')
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: repo,
        operation: 'worktree-add',
        worktreePath: newBranchWorktreePath,
        createBranch: 'new-worktree-branch',
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    assert.equal(
      execFileSync('git', ['branch', '--show-current'], {
        cwd: newBranchWorktreePath,
        encoding: 'utf8',
      }).trim(),
      'new-worktree-branch'
    )

    git(repo, 'checkout', '-b', 'remote-worktree-branch')
    git(repo, 'push', '-u', 'origin', 'remote-worktree-branch')
    git(repo, 'checkout', 'main')
    git(repo, 'branch', '-D', 'remote-worktree-branch')
    const remoteWorktreePath = path.join(root, 'remote-branch-worktree')
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: repo,
        operation: 'worktree-add',
        worktreePath: remoteWorktreePath,
        createBranch: 'remote-worktree-branch',
        commitish: 'refs/remotes/origin/remote-worktree-branch',
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    assert.equal(
      execFileSync('git', ['branch', '--show-current'], {
        cwd: remoteWorktreePath,
        encoding: 'utf8',
      }).trim(),
      'remote-worktree-branch'
    )

    for (const pathToRemove of [
      worktreePath,
      newBranchWorktreePath,
      remoteWorktreePath,
    ]) {
      result = await request(base, '/api/git/operation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: repo,
          operation: 'worktree-remove',
          values: [pathToRemove],
          force: true,
        }),
      })
      assert.equal(result.response.status, 200, JSON.stringify(result.data))
    }

    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: repo,
        operation: 'checkout',
        values: ['origin/feature'],
        createLocalBranch: 'feature-checkout',
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    assert.equal(
      execFileSync('git', ['branch', '--show-current'], {
        cwd: repo,
        encoding: 'utf8',
      }).trim(),
      'feature-checkout'
    )
    git(repo, 'checkout', 'main')

    git(repo, 'checkout', '-b', 'merge-parent')
    await fs.promises.writeFile(path.join(repo, 'merge-parent.txt'), 'parent\n')
    git(repo, 'add', 'merge-parent.txt')
    git(repo, 'commit', '-m', 'merge parent')
    git(repo, 'checkout', '-b', 'merge-child')
    await fs.promises.writeFile(path.join(repo, 'merge-child.txt'), 'child\n')
    git(repo, 'add', 'merge-child.txt')
    git(repo, 'commit', '-m', 'merge child')
    git(repo, 'checkout', 'merge-parent')
    git(repo, 'merge', '--no-ff', 'merge-child', '-m', 'merge child branch')
    const mergeSha = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repo,
      encoding: 'utf8',
    }).trim()
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: repo,
        operation: 'revert',
        values: [mergeSha],
        mainline: true,
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    assert.equal(fs.existsSync(path.join(repo, 'merge-child.txt')), false)
    git(repo, 'checkout', 'main')

    const revertConflictRepo = path.join(root, 'revert-conflict-repo')
    await fs.promises.mkdir(revertConflictRepo)
    git(revertConflictRepo, 'init', '-b', 'main')
    git(revertConflictRepo, 'config', 'user.name', 'Revert Conflict Test')
    git(
      revertConflictRepo,
      'config',
      'user.email',
      'revert-conflict@example.com'
    )
    await fs.promises.writeFile(
      path.join(revertConflictRepo, 'shared.txt'),
      'base\n'
    )
    git(revertConflictRepo, 'add', 'shared.txt')
    git(revertConflictRepo, 'commit', '-m', 'base')
    await fs.promises.writeFile(
      path.join(revertConflictRepo, 'shared.txt'),
      'change to revert\n'
    )
    git(revertConflictRepo, 'add', 'shared.txt')
    git(revertConflictRepo, 'commit', '-m', 'change to revert')
    const commitToRevert = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: revertConflictRepo,
      encoding: 'utf8',
    }).trim()
    await fs.promises.writeFile(
      path.join(revertConflictRepo, 'shared.txt'),
      'conflicting later change\n'
    )
    git(revertConflictRepo, 'add', 'shared.txt')
    git(revertConflictRepo, 'commit', '-m', 'later change')
    const beforeRevertAbort = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: revertConflictRepo,
      encoding: 'utf8',
    }).trim()
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: revertConflictRepo,
        operation: 'revert',
        values: [commitToRevert],
      }),
    })
    assert.equal(result.response.status, 400)
    assert.equal(
      fs.existsSync(path.join(revertConflictRepo, '.git', 'REVERT_HEAD')),
      true,
      'a conflicting revert must remain recoverable'
    )
    await fs.promises.writeFile(
      path.join(revertConflictRepo, 'shared.txt'),
      'resolved revert\n'
    )
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: revertConflictRepo,
        operation: 'finish-merge',
        resolutions: [['shared.txt', 'manual']],
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    assert.equal(
      fs.existsSync(path.join(revertConflictRepo, '.git', 'REVERT_HEAD')),
      false,
      'finishing a conflicting revert must clear the in-progress revert state'
    )
    assert.equal(
      execFileSync('git', ['log', '-1', '--format=%s'], {
        cwd: revertConflictRepo,
        encoding: 'utf8',
      }).trim(),
      'Revert "change to revert"',
      'finishing a conflicting revert must create the revert commit'
    )
    git(revertConflictRepo, 'reset', '--hard', beforeRevertAbort)
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: revertConflictRepo,
        operation: 'revert',
        values: [commitToRevert],
      }),
    })
    assert.equal(result.response.status, 400)
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: revertConflictRepo,
        operation: 'abort-merge',
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    assert.equal(
      fs.existsSync(path.join(revertConflictRepo, '.git', 'REVERT_HEAD')),
      false,
      'abort merge must abort an in-progress revert'
    )
    assert.equal(
      execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: revertConflictRepo,
        encoding: 'utf8',
      }).trim(),
      beforeRevertAbort,
      'aborting a revert restores the pre-revert commit'
    )

    const submoduleSource = path.join(root, 'submodule-source')
    const submoduleParent = path.join(root, 'submodule-parent')
    await fs.promises.mkdir(submoduleSource)
    git(submoduleSource, 'init', '-b', 'main')
    git(submoduleSource, 'config', 'user.name', 'Submodule Test')
    git(submoduleSource, 'config', 'user.email', 'submodule@example.com')
    await fs.promises.writeFile(
      path.join(submoduleSource, 'module.txt'),
      'one\n'
    )
    git(submoduleSource, 'add', 'module.txt')
    git(submoduleSource, 'commit', '-m', 'module one')
    const moduleOne = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: submoduleSource,
      encoding: 'utf8',
    }).trim()
    await fs.promises.mkdir(submoduleParent)
    git(submoduleParent, 'init', '-b', 'main')
    git(submoduleParent, 'config', 'user.name', 'Parent Test')
    git(submoduleParent, 'config', 'user.email', 'parent@example.com')
    git(submoduleParent, 'config', 'protocol.file.allow', 'always')
    await fs.promises.writeFile(
      path.join(submoduleParent, 'README.md'),
      'parent\n'
    )
    git(submoduleParent, 'add', 'README.md')
    git(submoduleParent, 'commit', '-m', 'parent base')
    git(
      submoduleParent,
      '-c',
      'protocol.file.allow=always',
      'submodule',
      'add',
      submoduleSource,
      'vendor/module'
    )
    git(submoduleParent, 'commit', '-m', 'add module')
    await fs.promises.writeFile(
      path.join(submoduleSource, 'module.txt'),
      'two\n'
    )
    git(submoduleSource, 'add', 'module.txt')
    git(submoduleSource, 'commit', '-m', 'module two')
    const moduleTwo = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: submoduleSource,
      encoding: 'utf8',
    }).trim()
    git(submoduleParent, 'checkout', '-b', 'module-two')
    git(path.join(submoduleParent, 'vendor', 'module'), 'fetch')
    git(path.join(submoduleParent, 'vendor', 'module'), 'checkout', moduleTwo)
    git(submoduleParent, 'add', 'vendor/module')
    git(submoduleParent, 'commit', '-m', 'update module')
    const moduleUpdateSha = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: submoduleParent,
      encoding: 'utf8',
    }).trim()
    git(submoduleParent, 'checkout', 'main')
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: submoduleParent,
        operation: 'checkout',
        values: ['module-two'],
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    assert.equal(
      execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: path.join(submoduleParent, 'vendor', 'module'),
        encoding: 'utf8',
      }).trim(),
      moduleTwo
    )
    await fs.promises.writeFile(
      path.join(submoduleParent, 'vendor', 'module', 'module.txt'),
      'modified\n'
    )
    result = await request(
      base,
      `/api/status?path=${encodeURIComponent(submoduleParent)}`
    )
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    assert.deepEqual(result.data.workingDirectory.files, [
      {
        path: 'vendor/module',
        status: {
          kind: 'Modified',
          submoduleStatus: {
            commitChanged: false,
            modifiedChanges: true,
            untrackedChanges: false,
            recordedCommit: moduleTwo,
            currentCommit: moduleTwo,
          },
        },
      },
    ])
    result = await request(
      base,
      `/api/diff?path=${encodeURIComponent(
        submoduleParent
      )}&file=${encodeURIComponent('vendor/module')}`
    )
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    assert.equal(result.data.submoduleUrl, submoduleSource)
    assert.equal(
      result.data.fullPath,
      path.join(submoduleParent, 'vendor', 'module')
    )
    assert.match(result.data.patch, /Subproject commit [0-9a-f]+-dirty/)
    result = await request(
      base,
      `/api/commit?path=${encodeURIComponent(
        submoduleParent
      )}&sha=${moduleUpdateSha}`
    )
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    assert.deepEqual(result.data.files, [
      {
        path: 'vendor/module',
        status: {
          kind: 'Modified',
          submoduleStatus: {
            commitChanged: true,
            modifiedChanges: false,
            untrackedChanges: false,
          },
        },
        commitish: moduleUpdateSha,
        parentCommitish: result.data.files[0].parentCommitish,
      },
    ])
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: submoduleParent,
        operation: 'discard',
        values: ['vendor/module'],
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    assert.equal(
      execFileSync('git', ['status', '--porcelain'], {
        cwd: path.join(submoduleParent, 'vendor', 'module'),
        encoding: 'utf8',
      }).trim(),
      ''
    )

    const cherryUndoRepo = path.join(root, 'cherry-undo-repo')
    await fs.promises.mkdir(cherryUndoRepo)
    git(cherryUndoRepo, 'init', '-b', 'main')
    git(cherryUndoRepo, 'config', 'user.name', 'Cherry Undo Test')
    git(cherryUndoRepo, 'config', 'user.email', 'cherry-undo@example.com')
    await fs.promises.writeFile(path.join(cherryUndoRepo, 'base.txt'), 'base\n')
    git(cherryUndoRepo, 'add', 'base.txt')
    git(cherryUndoRepo, 'commit', '-m', 'base')
    git(cherryUndoRepo, 'checkout', '-b', 'source')
    await fs.promises.writeFile(
      path.join(cherryUndoRepo, 'source.txt'),
      'source\n'
    )
    git(cherryUndoRepo, 'add', 'source.txt')
    git(cherryUndoRepo, 'commit', '-m', 'source commit')
    const cherryUndoSourceSha = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: cherryUndoRepo,
      encoding: 'utf8',
    }).trim()
    git(cherryUndoRepo, 'checkout', 'main')
    const cherryUndoBefore = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: cherryUndoRepo,
      encoding: 'utf8',
    }).trim()
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: cherryUndoRepo,
        operation: 'cherry-pick',
        values: [cherryUndoSourceSha],
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    const cherryUndoTip = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: cherryUndoRepo,
      encoding: 'utf8',
    }).trim()
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: cherryUndoRepo,
        operation: 'undo-cherry-pick',
        values: ['main', cherryUndoBefore, cherryUndoTip, 'source'],
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    assert.equal(
      execFileSync('git', ['branch', '--show-current'], {
        cwd: cherryUndoRepo,
        encoding: 'utf8',
      }).trim(),
      'source',
      'undoing a cherry-pick returns to the source branch'
    )
    assert.equal(
      execFileSync('git', ['rev-parse', 'main'], {
        cwd: cherryUndoRepo,
        encoding: 'utf8',
      }).trim(),
      cherryUndoBefore,
      'undoing a cherry-pick restores the target branch tip'
    )

    const cherryUndoGuardRepo = path.join(root, 'cherry-undo-guard-repo')
    await fs.promises.mkdir(cherryUndoGuardRepo)
    git(cherryUndoGuardRepo, 'init', '-b', 'main')
    git(cherryUndoGuardRepo, 'config', 'user.name', 'Cherry Undo Guard Test')
    git(
      cherryUndoGuardRepo,
      'config',
      'user.email',
      'cherry-undo-guard@example.com'
    )
    await fs.promises.writeFile(
      path.join(cherryUndoGuardRepo, 'base.txt'),
      'base\n'
    )
    git(cherryUndoGuardRepo, 'add', 'base.txt')
    git(cherryUndoGuardRepo, 'commit', '-m', 'base')
    git(cherryUndoGuardRepo, 'checkout', '-b', 'source')
    await fs.promises.writeFile(
      path.join(cherryUndoGuardRepo, 'source.txt'),
      'source\n'
    )
    git(cherryUndoGuardRepo, 'add', 'source.txt')
    git(cherryUndoGuardRepo, 'commit', '-m', 'source commit')
    const cherryUndoGuardSourceSha = execFileSync(
      'git',
      ['rev-parse', 'HEAD'],
      {
        cwd: cherryUndoGuardRepo,
        encoding: 'utf8',
      }
    ).trim()
    git(cherryUndoGuardRepo, 'checkout', 'main')
    const cherryUndoGuardBefore = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: cherryUndoGuardRepo,
      encoding: 'utf8',
    }).trim()
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: cherryUndoGuardRepo,
        operation: 'cherry-pick',
        values: [cherryUndoGuardSourceSha],
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    const cherryUndoGuardTip = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: cherryUndoGuardRepo,
      encoding: 'utf8',
    }).trim()
    await fs.promises.writeFile(
      path.join(cherryUndoGuardRepo, 'later.txt'),
      'later\n'
    )
    git(cherryUndoGuardRepo, 'add', 'later.txt')
    git(cherryUndoGuardRepo, 'commit', '-m', 'later commit')
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: cherryUndoGuardRepo,
        operation: 'undo-cherry-pick',
        values: ['main', cherryUndoGuardBefore, cherryUndoGuardTip, 'source'],
      }),
    })
    assert.equal(
      result.response.status,
      409,
      'undo must refuse to overwrite commits made after a cherry-pick'
    )

    const cherryNewBranchRepo = path.join(root, 'cherry-new-branch-repo')
    await fs.promises.mkdir(cherryNewBranchRepo)
    git(cherryNewBranchRepo, 'init', '-b', 'main')
    git(cherryNewBranchRepo, 'config', 'user.name', 'Cherry New Branch Test')
    git(
      cherryNewBranchRepo,
      'config',
      'user.email',
      'cherry-new-branch@example.com'
    )
    await fs.promises.writeFile(
      path.join(cherryNewBranchRepo, 'base.txt'),
      'base\n'
    )
    git(cherryNewBranchRepo, 'add', 'base.txt')
    git(cherryNewBranchRepo, 'commit', '-m', 'base')
    git(cherryNewBranchRepo, 'checkout', '-b', 'source')
    await fs.promises.writeFile(
      path.join(cherryNewBranchRepo, 'source.txt'),
      'source\n'
    )
    git(cherryNewBranchRepo, 'add', 'source.txt')
    git(cherryNewBranchRepo, 'commit', '-m', 'source commit')
    const cherryNewBranchSourceSha = execFileSync(
      'git',
      ['rev-parse', 'HEAD'],
      {
        cwd: cherryNewBranchRepo,
        encoding: 'utf8',
      }
    ).trim()
    git(cherryNewBranchRepo, 'checkout', 'main')
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: cherryNewBranchRepo,
        operation: 'create-branch',
        values: ['copied-branch'],
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: cherryNewBranchRepo,
        operation: 'checkout',
        values: ['copied-branch'],
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    const cherryNewBranchBefore = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: cherryNewBranchRepo,
      encoding: 'utf8',
    }).trim()
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: cherryNewBranchRepo,
        operation: 'cherry-pick',
        values: [cherryNewBranchSourceSha],
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    const cherryNewBranchTip = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: cherryNewBranchRepo,
      encoding: 'utf8',
    }).trim()
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: cherryNewBranchRepo,
        operation: 'undo-cherry-pick',
        values: [
          'copied-branch',
          cherryNewBranchBefore,
          cherryNewBranchTip,
          'source',
        ],
        branchCreated: true,
      }),
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.data))
    assert.equal(
      execFileSync('git', ['branch', '--show-current'], {
        cwd: cherryNewBranchRepo,
        encoding: 'utf8',
      }).trim(),
      'source'
    )
    assert.throws(
      () =>
        execFileSync(
          'git',
          ['show-ref', '--verify', '--quiet', 'refs/heads/copied-branch'],
          { cwd: cherryNewBranchRepo, stdio: 'pipe' }
        ),
      error => error.status === 1,
      'undoing a new-branch cherry-pick removes the created target branch'
    )

    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: repo,
        operation: 'checkout',
        values: ['--help'],
      }),
    })
    assert.equal(result.response.status, 400)
    result = await request(base, '/api/git/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: repo, operation: 'invalid' }),
    })
    assert.equal(result.response.status, 400)
    result = await request(base, '/api/git/exec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ args: ['status'] }),
    })
    assert.equal(result.response.status, 404)

    result = await request(base, '/api/fs/stat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{broken',
    })
    assert.equal(result.response.status, 400)

    result = await request(base, '/api/missing')
    assert.equal(result.response.status, 404)

    result = await request(base, '/')
    assert.equal(result.response.status, 200)
    assert.equal(
      result.response.headers.get('content-type'),
      'text/html; charset=utf-8'
    )

    result = await request(base, '/../server.js')
    assert.equal(result.response.status, 404)

    result = await request(base, '/api/health', {
      headers: { 'X-Desktop-Plus-Session': 'wrong' },
    })
    assert.equal(result.response.status, 403)
    result = await request(base, '/api/health', {
      headers: { Origin: 'https://evil.example' },
    })
    assert.equal(result.response.status, 403)
    const hostStatus = await new Promise((resolve, reject) => {
      const request = require('http').get(
        `${base}/api/health`,
        {
          headers: {
            Host: 'evil.example',
            'X-Desktop-Plus-Session': sessionToken,
          },
        },
        response => resolve(response.statusCode)
      )
      request.on('error', reject)
    })
    assert.equal(hostStatus, 403)
    const optionsResponse = await fetch(`${base}/api/status`, {
      method: 'OPTIONS',
    })
    assert.equal(optionsResponse.status, 403)
    assert.equal(
      optionsResponse.headers.get('access-control-allow-origin'),
      null
    )
    assert.equal(
      (await request(base, '/api/health', { headers: { Origin: base } }))
        .response.status,
      200
    )
    result = await request(base, '/')
    assert.match(
      result.data,
      /<script id="desktop-plus-runtime" type="application\/json">/
    )
    assert.ok(result.data.includes(sessionToken))
    assert.doesNotMatch(result.data, /__DESKTOP_PLUS_RUNTIME__/)
    assert.doesNotMatch(result.data, /window\.__DESKTOP_SESSION__/)

    console.log('Backend API tests passed')
  } finally {
    await new Promise(resolve => server.close(resolve))
    await fs.promises.rm(root, { recursive: true, force: true })
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
