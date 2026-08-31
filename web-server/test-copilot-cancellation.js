const assert = require('assert/strict')
const fs = require('fs')
const http = require('http')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')
const { createServer } = require('./server')
const { githubCredentialId, githubCredentialService } = require('./hosting')

async function main() {
  const endpoint = 'https://api.github.com'
  const login = 'copilot-user'
  const credentialId = githubCredentialId(endpoint, login)
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'desktop-plus-copilot-cancellation-')
  )
  const repositoryPath = path.join(root, 'repository')
  fs.mkdirSync(repositoryPath)
  execFileSync('git', ['init', '-b', 'main'], {
    cwd: repositoryPath,
    stdio: 'ignore',
  })
  execFileSync('git', ['config', 'user.name', 'Copilot Test'], {
    cwd: repositoryPath,
  })
  execFileSync('git', ['config', 'user.email', 'copilot@example.com'], {
    cwd: repositoryPath,
  })
  fs.writeFileSync(path.join(repositoryPath, 'file.txt'), 'before\n')
  execFileSync('git', ['add', 'file.txt'], { cwd: repositoryPath })
  execFileSync('git', ['commit', '-m', 'Initial'], {
    cwd: repositoryPath,
    stdio: 'ignore',
  })
  fs.writeFileSync(path.join(repositoryPath, 'file.txt'), 'after\n')
  const credentials = new Map([
    [`${githubCredentialService}:${credentialId}`, 'copilot-token'],
  ])
  let disconnects = 0
  let started
  const generationStarted = new Promise(resolve => {
    started = resolve
  })
  const server = createServer({
    keytar: {
      getPassword: async (service, account) =>
        credentials.get(`${service}:${account}`) || null,
    },
    withCopilotClient: async (token, workingDirectory, callback, signal) =>
      callback(
        {
          createSession: async () => ({
            sendAndWait: async () => {
              started()
              return new Promise(() => {})
            },
            disconnect: async () => {
              disconnects += 1
            },
          }),
        },
        signal
      ),
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const payload = JSON.stringify({
    endpoint,
    login,
    credentialId,
    action: 'generate-commit-message',
    path: repositoryPath,
  })

  try {
    const request = http.request({
      host: '127.0.0.1',
      port: server.address().port,
      path: '/api/copilot',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'X-Desktop-Plus-Session': server.sessionToken,
      },
    })
    request.on('error', () => {})
    request.end(payload)
    await generationStarted
    request.destroy()
    await new Promise(resolve => setTimeout(resolve, 20))
    assert.ok(disconnects >= 1)
    console.log(
      'Copilot cancellation passed: browser abort disconnects the SDK session'
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
