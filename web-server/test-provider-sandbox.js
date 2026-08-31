const assert = require('assert/strict')
const { execFileSync } = require('child_process')
const fs = require('fs')
const http = require('http')
const os = require('os')
const path = require('path')
const { createServer } = require('./server')
const { hostingRequest, normalizeGitHubEndpoint } = require('./hosting')
const { gitLabRequest, normalizeGitLabEndpoint } = require('./gitlab')

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
}

function uniqueName(provider) {
  return `desktop-plus-web-${provider}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`
}

function request(base, session, pathname, body) {
  return new Promise((resolve, reject) => {
    const target = new URL(pathname, base)
    const payload = JSON.stringify(body)
    const req = http.request(
      target,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'X-Desktop-Plus-Session': session,
        },
      },
      res => {
        let response = ''
        res.setEncoding('utf8')
        res.on('data', chunk => {
          response += chunk
        })
        res.on('end', () => {
          try {
            resolve({
              statusCode: res.statusCode,
              body: response ? JSON.parse(response) : {},
            })
          } catch (error) {
            reject(error)
          }
        })
      }
    )
    req.once('error', reject)
    req.end(payload)
  })
}

function createRepository(root, name) {
  const repository = path.join(root, name)
  fs.mkdirSync(repository)
  git(repository, 'init', '-b', 'main')
  git(repository, 'config', 'user.name', 'Desktop Plus Provider Sandbox')
  git(
    repository,
    'config',
    'user.email',
    'desktop-plus-sandbox@example.invalid'
  )
  fs.writeFileSync(path.join(repository, 'README.md'), '# Provider sandbox\n')
  git(repository, 'add', 'README.md')
  git(repository, 'commit', '-m', 'Initial sandbox commit')
  return repository
}

function createCredentialStore() {
  const credentials = new Map()
  return {
    getPassword: async (service, account) =>
      credentials.get(`${service}:${account}`) || null,
    setPassword: async (service, account, value) =>
      credentials.set(`${service}:${account}`, value),
    deletePassword: async (service, account) =>
      credentials.delete(`${service}:${account}`),
  }
}

async function withServer(options, callback) {
  const server = createServer(options)
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  try {
    return await callback(
      `http://127.0.0.1:${server.address().port}`,
      server.sessionToken
    )
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
}

async function runGitHubSandbox(token, endpoint) {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'desktop-plus-github-sandbox-')
  )
  const name = uniqueName('github')
  const repository = createRepository(root, name)
  const credentialStore = createCredentialStore()
  let owner = null
  try {
    await withServer({ keytar: credentialStore }, async (base, session) => {
      const signedIn = await request(base, session, '/api/hosting/auth', {
        endpoint,
        token,
      })
      assert.equal(signedIn.statusCode, 200, JSON.stringify(signedIn.body))
      owner = signedIn.body.user.login
      const account = {
        endpoint: signedIn.body.user.endpoint,
        login: owner,
        credentialId: signedIn.body.credentialId,
      }
      const published = await request(base, session, '/api/hosting/publish', {
        ...account,
        path: repository,
        name,
        description: 'Temporary Desktop Plus web sandbox repository',
        private: true,
      })
      assert.equal(published.statusCode, 200, JSON.stringify(published.body))
      assert.equal(
        git(repository, 'remote', 'get-url', 'origin').includes(name),
        true
      )

      git(repository, 'checkout', '-b', 'sandbox-feature')
      fs.writeFileSync(path.join(repository, 'FEATURE.md'), '# Feature\n')
      git(repository, 'add', 'FEATURE.md')
      git(repository, 'commit', '-m', 'Sandbox feature')
      const pushed = await request(base, session, '/api/hosting/push', {
        ...account,
        path: repository,
        owner,
        repository: name,
        branch: 'sandbox-feature',
      })
      assert.equal(pushed.statusCode, 200, JSON.stringify(pushed.body))
      const pullRequest = await request(
        base,
        session,
        '/api/hosting/pull-requests',
        {
          ...account,
          action: 'create',
          owner,
          repository: name,
          title: 'Desktop Plus provider sandbox',
          head: 'sandbox-feature',
          base: 'main',
          body: 'Temporary sandbox validation.',
        }
      )
      assert.equal(
        pullRequest.statusCode,
        200,
        JSON.stringify(pullRequest.body)
      )
      const listed = await request(
        base,
        session,
        '/api/hosting/pull-requests',
        {
          ...account,
          action: 'list',
          owner,
          repository: name,
        }
      )
      assert.equal(listed.statusCode, 200, JSON.stringify(listed.body))
      assert.ok(
        listed.body.pullRequests.some(
          item => item.number === pullRequest.body.pullRequest.number
        )
      )
    })
  } finally {
    if (owner)
      await hostingRequest(
        normalizeGitHubEndpoint(endpoint),
        token,
        'DELETE',
        `repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`
      ).catch(error => {
        console.error(
          `GitHub sandbox cleanup failed for ${owner}/${name}`,
          error
        )
        process.exitCode = 1
      })
    fs.rmSync(root, { recursive: true, force: true })
  }
}

async function runGitLabSandbox(token, endpoint) {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'desktop-plus-gitlab-sandbox-')
  )
  const name = uniqueName('gitlab')
  const repository = createRepository(root, name)
  const credentialStore = createCredentialStore()
  let projectPath = null
  try {
    await withServer({ keytar: credentialStore }, async (base, session) => {
      const signedIn = await request(base, session, '/api/gitlab/auth', {
        endpoint,
        token,
      })
      assert.equal(signedIn.statusCode, 200, JSON.stringify(signedIn.body))
      const account = {
        endpoint: signedIn.body.user.endpoint,
        login: signedIn.body.user.login,
        credentialId: signedIn.body.credentialId,
      }
      const published = await request(base, session, '/api/gitlab/projects', {
        ...account,
        action: 'create',
        path: repository,
        name,
        description: 'Temporary Desktop Plus web sandbox project',
        private: true,
      })
      assert.equal(published.statusCode, 200, JSON.stringify(published.body))
      projectPath = published.body.project.path_with_namespace
      assert.ok(projectPath)

      git(repository, 'checkout', '-b', 'sandbox-feature')
      fs.writeFileSync(path.join(repository, 'FEATURE.md'), '# Feature\n')
      git(repository, 'add', 'FEATURE.md')
      git(repository, 'commit', '-m', 'Sandbox feature')
      const pushed = await request(base, session, '/api/gitlab/projects', {
        ...account,
        action: 'push',
        path: repository,
        owner: signedIn.body.user.login,
        repository: name,
        branch: 'sandbox-feature',
      })
      assert.equal(pushed.statusCode, 200, JSON.stringify(pushed.body))
      const mergeRequest = await request(
        base,
        session,
        '/api/gitlab/merge-requests',
        {
          ...account,
          action: 'create',
          owner: signedIn.body.user.login,
          repository: name,
          title: 'Desktop Plus provider sandbox',
          head: 'sandbox-feature',
          base: 'main',
          body: 'Temporary sandbox validation.',
        }
      )
      assert.equal(
        mergeRequest.statusCode,
        200,
        JSON.stringify(mergeRequest.body)
      )
      const listed = await request(
        base,
        session,
        '/api/gitlab/merge-requests',
        {
          ...account,
          action: 'list',
          owner: signedIn.body.user.login,
          repository: name,
        }
      )
      assert.equal(listed.statusCode, 200, JSON.stringify(listed.body))
      assert.ok(
        listed.body.pullRequests.some(
          item => item.number === mergeRequest.body.pullRequest.number
        )
      )
    })
  } finally {
    if (projectPath)
      await gitLabRequest(
        normalizeGitLabEndpoint(endpoint),
        token,
        'DELETE',
        `projects/${encodeURIComponent(projectPath)}`
      ).catch(error => {
        console.error(`GitLab sandbox cleanup failed for ${projectPath}`, error)
        process.exitCode = 1
      })
    fs.rmSync(root, { recursive: true, force: true })
  }
}

async function main() {
  if (process.env.DESKTOP_PLUS_RUN_PROVIDER_SANDBOX !== '1') {
    console.log(
      'Provider sandbox skipped: set DESKTOP_PLUS_RUN_PROVIDER_SANDBOX=1 with sandbox credentials to run it'
    )
    return
  }
  const githubToken = process.env.DESKTOP_PLUS_GITHUB_SANDBOX_TOKEN
  const gitlabToken = process.env.DESKTOP_PLUS_GITLAB_SANDBOX_TOKEN
  if (!githubToken && !gitlabToken)
    throw new Error(
      'Provider sandbox requires DESKTOP_PLUS_GITHUB_SANDBOX_TOKEN and/or DESKTOP_PLUS_GITLAB_SANDBOX_TOKEN'
    )

  const results = []
  if (githubToken) {
    await runGitHubSandbox(
      githubToken,
      process.env.DESKTOP_PLUS_GITHUB_SANDBOX_ENDPOINT ||
        'https://api.github.com'
    )
    results.push('GitHub')
  }
  if (gitlabToken) {
    await runGitLabSandbox(
      gitlabToken,
      process.env.DESKTOP_PLUS_GITLAB_SANDBOX_ENDPOINT ||
        'https://gitlab.com/api/v4'
    )
    results.push('GitLab')
  }
  console.log(`Provider sandbox passed: ${results.join(', ')}`)
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
