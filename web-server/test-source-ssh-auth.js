const assert = require('assert/strict')
const { execFileSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { createServer } = require('./server')
const { launchBrowser } = require('./test-browser')

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
}

async function main() {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'desktop-plus-source-ssh-')
  )
  const repository = path.join(root, 'repository')
  const sshCommand = path.join(root, 'ssh-command.sh')
  const responsePath = path.join(root, 'ssh-response')
  const previousSSHCommand = process.env.GIT_SSH_COMMAND
  fs.mkdirSync(repository)
  git(repository, 'init', '-b', 'main')
  git(repository, 'config', 'user.name', 'Source SSH')
  git(repository, 'config', 'user.email', 'source-ssh@example.com')
  fs.writeFileSync(path.join(repository, 'README.md'), '# ssh\n')
  git(repository, 'add', 'README.md')
  git(repository, 'commit', '-m', 'initial')
  git(repository, 'remote', 'add', 'origin', 'ssh://git@git.example/repo.git')
  fs.writeFileSync(
    sshCommand,
    `#!/bin/sh\nprompt="The authenticity of host 'git.example (127.0.0.1)' can't be established.\nRSA key fingerprint is SHA256:test."\nresponse="$($SSH_ASKPASS "$prompt")"\nprintf '%s' "$response" > "${responsePath}"\nexit 1\n`
  )
  fs.chmodSync(sshCommand, 0o755)
  process.env.GIT_SSH_COMMAND = sshCommand

  const server = createServer({ getDesktopRepositories: async () => [] })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const browser = await launchBrowser()

  try {
    const page = await browser.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`http://127.0.0.1:${server.address().port}`, {
      waitUntil: 'networkidle',
    })
    await page
      .getByRole('button', {
        name: /Add an Existing Repository from your local drive…/i,
      })
      .click()
    const inspection = page.waitForResponse(
      response =>
        response.url().includes('/api/repository/inspect') &&
        response.status() === 200
    )
    await page.getByLabel('Local path').fill(repository)
    await inspection
    await page.getByRole('button', { name: 'Add repository' }).click()
    await page
      .getByRole('button', { name: 'Push, pull, fetch options' })
      .click()
    await page.getByText(/^Fetch origin$/).waitFor()
    await page.getByText(/^Fetch origin$/).click()

    const hostDialog = page.locator('#add-ssh-host')
    await hostDialog.waitFor()
    for (let attempt = 0; attempt < 4; attempt++) {
      await hostDialog.getByRole('button', { name: 'Yes', exact: true }).click()
      if (
        await page
          .locator('#app-error')
          .isVisible()
          .catch(() => false)
      )
        break
      await page.waitForTimeout(500)
      if (!(await hostDialog.isVisible().catch(() => false))) break
    }
    await page.locator('#app-error').waitFor()
    for (let attempt = 0; attempt < 50; attempt++) {
      if (fs.existsSync(responsePath)) break
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    assert.equal(fs.readFileSync(responsePath, 'utf8'), 'yes')
    assert.deepEqual(errors, [])
    console.log(
      'Source SSH authentication passed: host trust uses the shared dialog'
    )
  } finally {
    await browser.close()
    await new Promise(resolve => server.close(resolve))
    if (previousSSHCommand === undefined) delete process.env.GIT_SSH_COMMAND
    else process.env.GIT_SSH_COMMAND = previousSSHCommand
    fs.rmSync(root, { recursive: true, force: true })
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
