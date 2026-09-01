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
  const root = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), 'desktop-plus-trash-recovery-')
  )
  const repository = path.join(root, 'trash-failure-repository')
  fs.mkdirSync(repository)
  git(repository, 'init', '-q', '-b', 'main')
  git(repository, 'config', 'user.name', 'Trash Recovery')
  git(repository, 'config', 'user.email', 'trash-recovery@example.com')
  fs.writeFileSync(path.join(repository, 'tracked.txt'), 'tracked\n')
  git(repository, 'add', 'tracked.txt')
  git(repository, 'commit', '-q', '-m', 'Initial commit')

  const server = createServer({
    getDesktopRepositories: async () => [],
    moveToTrash: async () => {
      throw new Error('Trash unavailable')
    },
  })
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
    const repositoryInspection = page.waitForResponse(
      response =>
        response.url().includes('/api/repository/inspect') &&
        response.status() === 200
    )
    await page.getByLabel('Local path').fill(repository)
    await repositoryInspection
    await page.getByRole('button', { name: 'Add repository' }).click()
    await page.locator('.branch-toolbar-button').waitFor()

    await page.getByRole('button', { name: /Current repository/i }).click()
    const row = page
      .getByRole('option', { name: /trash-failure-repository/i })
      .first()
    await row.click({ button: 'right' })
    await page
      .locator('#web-context-menu')
      .getByRole('menuitem', { name: 'Remove…' })
      .click()

    const removeDialog = page.locator('dialog').filter({
      hasText: 'Remove Repository',
    })
    await removeDialog.getByLabel(/Also move this repository to Trash/i).check()
    await removeDialog.getByRole('button', { name: 'Remove' }).click()

    await page
      .locator('dialog')
      .filter({ hasText: /could not be moved to the macOS Trash/i })
      .waitFor()
    await page.getByText(/could not be moved to the macOS Trash/i).waitFor()
    assert.equal(fs.existsSync(repository), true)
    assert.deepEqual(errors, [])
    console.log(
      'Source Trash recovery passed: the desktop remove dialog uses the browser Trash adapter and preserves the repository after a failed move'
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
