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

async function inspect(base, session, repositoryPath) {
  const response = await fetch(`${base}/api/repository/inspect`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Desktop-Plus-Session': session,
    },
    body: JSON.stringify({ path: repositoryPath }),
  })
  return { response, payload: await response.json() }
}

async function main() {
  const root = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), 'desktop-plus-recovery-')
  )
  const repository = path.join(root, 'regular-repository')
  const bareRepository = path.join(root, 'bare-repository.git')
  const missingRepository = path.join(root, 'missing-repository')
  fs.mkdirSync(repository)
  git(repository, 'init', '-q', '-b', 'main')
  git(repository, 'config', 'user.name', 'Recovery Test')
  git(repository, 'config', 'user.email', 'recovery@example.com')
  fs.writeFileSync(path.join(repository, 'README.md'), 'recovery\n')
  git(repository, 'add', 'README.md')
  git(repository, 'commit', '-q', '-m', 'Initial commit')
  git(root, 'init', '-q', '--bare', bareRepository)

  const server = createServer({ getDesktopRepositories: async () => [] })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  const browser = await launchBrowser()

  try {
    const regular = await inspect(base, server.sessionToken, repository)
    const bare = await inspect(base, server.sessionToken, bareRepository)
    const missing = await inspect(base, server.sessionToken, missingRepository)
    assert.equal(regular.response.status, 200)
    assert.equal(regular.payload.kind, 'regular')
    assert.equal(bare.payload.kind, 'bare')
    assert.equal(missing.payload.kind, 'missing')

    const page = await browser.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(base, { waitUntil: 'networkidle' })
    await page
      .getByRole('button', {
        name: /Add an Existing Repository from your Local Drive/i,
      })
      .click()
    const dialog = page.locator('dialog').filter({
      hasText: 'Add Local Repository',
    })
    await dialog
      .locator('input[placeholder="repository path"]')
      .fill(bareRepository)
    await dialog.getByText(/bare repository/i).waitFor()
    await new Promise(resolve => setTimeout(resolve, 400))
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await dialog.waitFor({ state: 'hidden' })

    await page
      .getByRole('button', {
        name: /Add an Existing Repository from your Local Drive/i,
      })
      .click()
    const addDialog = page.locator('dialog').filter({
      hasText: 'Add Local Repository',
    })
    await addDialog
      .locator('input[placeholder="repository path"]')
      .fill(repository)
    await new Promise(resolve => setTimeout(resolve, 400))
    await addDialog.getByRole('button', { name: 'Add Repository' }).click()
    await addDialog.waitFor({ state: 'hidden' })
    await page.getByRole('tab', { name: 'Changes' }).waitFor()

    assert.deepEqual(errors, [])
    console.log(
      'Source repository recovery passed: API classification and the desktop Add Local Repository dialog handle regular and bare paths'
    )
  } finally {
    await browser.close()
    await new Promise(resolve => server.close(resolve))
    fs.rmSync(root, { recursive: true, force: true })
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
