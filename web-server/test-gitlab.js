const assert = require('assert/strict')
const fs = require('fs')
const http = require('http')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')
const { createServer } = require('./server')
const {
  authenticatedGitLabEnvironment,
  gitLabCredentialId,
  gitLabCredentialService,
  normalizeGitLabEndpoint,
} = require('./gitlab')

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
          resolve({
            statusCode: res.statusCode,
            body: response ? JSON.parse(response) : {},
          })
        })
      }
    )
    req.once('error', reject)
    req.end(payload)
  })
}

async function main() {
  assert.equal(
    normalizeGitLabEndpoint('https://gitlab.example'),
    'https://gitlab.example/api/v4'
  )
  assert.equal(
    normalizeGitLabEndpoint('https://gitlab.example/gitlab'),
    'https://gitlab.example/gitlab/api/v4'
  )
  assert.equal(
    normalizeGitLabEndpoint('https://gitlab.example/gitlab/api/v4'),
    'https://gitlab.example/gitlab/api/v4'
  )
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-plus-gitlab-'))
  const repositoryPath = path.join(root, 'repository')
  fs.mkdirSync(repositoryPath)
  execFileSync('git', ['init'], { cwd: repositoryPath, stdio: 'ignore' })

  const endpoint = 'https://gitlab.example/api/v4'
  const credentials = new Map()
  const calls = []
  const server = createServer({
    keytar: {
      getPassword: async (service, account) =>
        credentials.get(`${service}:${account}`) || null,
      setPassword: async (service, account, password) =>
        credentials.set(`${service}:${account}`, password),
      deletePassword: async (service, account) =>
        credentials.delete(`${service}:${account}`),
    },
    gitLabRequest: async (url, token, method, pathname, body) => {
      assert.equal(url, endpoint)
      assert.equal(token, 'gitlab-token')
      calls.push({ method, pathname, body })
      if (pathname === 'user')
        return { username: 'desktop-plus', name: 'Desktop Plus' }
      if (pathname === 'namespaces?search=group%2Fsubgroup&per_page=100')
        return [{ id: 42, full_path: 'group/subgroup' }]
      if (method === 'POST' && pathname === 'projects')
        return {
          id: 22,
          path_with_namespace: 'group/subgroup/web-repository',
          http_url_to_repo:
            'https://gitlab.example/group/subgroup/web-repository.git',
        }
      if (pathname.includes('/merge_requests?state=opened'))
        return [
          {
            iid: 9,
            title: 'GitLab merge request',
            state: 'opened',
            author: { username: 'desktop-plus' },
            source_branch: 'feature',
            sha: 'feature-sha',
          },
        ]
      if (pathname.endsWith('/merge_requests/9'))
        return {
          iid: 9,
          title: 'GitLab merge request',
          state: 'opened',
          author: { username: 'desktop-plus' },
          source_branch: 'feature',
          sha: 'feature-sha',
          diff_refs: { base_sha: 'base-sha' },
        }
      if (pathname.endsWith('/merge_requests/9/changes'))
        return {
          changes: [
            {
              old_path: 'old.txt',
              new_path: 'new.txt',
              renamed_file: true,
              diff: '@@ -1 +1 @@\n-before\n+after',
            },
          ],
        }
      if (pathname.endsWith('/merge_requests/9/commits'))
        return [{ id: 'feature-sha' }]
      if (pathname.includes('/pipelines?sha=feature-sha'))
        return [
          { id: 71, status: 'failed', web_url: 'https://gitlab.example/71' },
          { id: 72, status: 'running', web_url: 'https://gitlab.example/72' },
        ]
      if (method === 'POST' && pathname.endsWith('/pipelines/71/retry'))
        return { id: 73, status: 'pending' }
      throw new Error(`Unexpected GitLab request: ${method} ${pathname}`)
    },
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`

  try {
    const signedIn = await request(
      base,
      server.sessionToken,
      '/api/gitlab/auth',
      {
        endpoint,
        token: 'gitlab-token',
      }
    )
    assert.equal(signedIn.statusCode, 200)
    assert.equal(signedIn.body.user.login, 'desktop-plus')
    const credentialId = gitLabCredentialId(endpoint, 'desktop-plus')
    assert.equal(signedIn.body.credentialId, credentialId)
    assert.equal(
      credentials.get(`${gitLabCredentialService}:${credentialId}`),
      'gitlab-token'
    )

    const account = {
      endpoint,
      login: 'desktop-plus',
      credentialId,
    }
    const published = await request(
      base,
      server.sessionToken,
      '/api/gitlab/projects',
      {
        ...account,
        action: 'create',
        path: repositoryPath,
        name: 'web-repository',
        organization: 'group/subgroup',
        private: true,
      }
    )
    assert.equal(published.statusCode, 200, JSON.stringify(published.body))
    assert.equal(
      execFileSync('git', ['remote', 'get-url', 'origin'], {
        cwd: repositoryPath,
        encoding: 'utf8',
      }).trim(),
      'https://gitlab.example/group/subgroup/web-repository.git'
    )
    assert.deepEqual(
      calls.find(call => call.method === 'POST' && call.pathname === 'projects')
        .body,
      {
        name: 'web-repository',
        namespace_id: 42,
        description: '',
        visibility: 'private',
      }
    )

    const listed = await request(
      base,
      server.sessionToken,
      '/api/gitlab/merge-requests',
      {
        ...account,
        action: 'list',
        owner: 'group/subgroup',
        repository: 'web-repository',
      }
    )
    assert.equal(listed.statusCode, 200)
    assert.equal(listed.body.pullRequests[0].number, 9)
    assert.equal(listed.body.pullRequests[0].head.repo, undefined)

    const details = await request(
      base,
      server.sessionToken,
      '/api/gitlab/merge-requests',
      {
        ...account,
        action: 'details',
        owner: 'group/subgroup',
        repository: 'web-repository',
        pullRequestNumber: 9,
      }
    )
    assert.equal(details.statusCode, 200)
    assert.deepEqual(details.body.commitSHAs, ['feature-sha'])
    assert.deepEqual(details.body.files[0], {
      path: 'new.txt',
      oldPath: 'old.txt',
      status: { kind: 'Renamed' },
      additions: 1,
      deletions: 1,
      patch: '@@ -1 +1 @@\n-before\n+after',
    })

    const pipelines = await request(
      base,
      server.sessionToken,
      '/api/gitlab/pipelines',
      {
        ...account,
        action: 'get',
        owner: 'group/subgroup',
        repository: 'web-repository',
        ref: 'feature-sha',
      }
    )
    assert.equal(pipelines.statusCode, 200)
    assert.equal(pipelines.body.check.conclusion, 'failure')
    assert.equal(pipelines.body.check.checks[0].checkSuiteId, 71)
    assert.equal(pipelines.body.check.checks[1].checkSuiteId, null)

    const rerun = await request(
      base,
      server.sessionToken,
      '/api/gitlab/pipelines',
      {
        ...account,
        action: 'rerun',
        owner: 'group/subgroup',
        repository: 'web-repository',
        checkSuiteIds: [71],
      }
    )
    assert.equal(rerun.statusCode, 200)

    const gitEnvironment = authenticatedGitLabEnvironment(
      'https://gitlab.example/group/web-repository.git',
      'gitlab-token'
    )
    assert.equal(
      gitEnvironment.GIT_CONFIG_VALUE_0,
      `Authorization: Basic ${Buffer.from('oauth2:gitlab-token').toString(
        'base64'
      )}`
    )

    const signedOut = await request(
      base,
      server.sessionToken,
      '/api/gitlab/logout',
      { credentialId }
    )
    assert.equal(signedOut.statusCode, 200)
    assert.equal(
      credentials.has(`${gitLabCredentialService}:${credentialId}`),
      false
    )
    console.log(
      'GitLab contract passed: credentials, namespace publishing, merge requests, pipelines, and logout'
    )
  } finally {
    await new Promise(resolve => server.close(resolve))
    fs.rmSync(root, { recursive: true, force: true })
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
