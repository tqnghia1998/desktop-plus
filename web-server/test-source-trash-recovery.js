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

function createRepository(root) {
  const repository = path.join(root, 'trash-failure-repository')
  fs.mkdirSync(repository)
  git(repository, 'init', '-q', '-b', 'main')
  git(repository, 'config', 'user.name', 'Trash Recovery')
  git(repository, 'config', 'user.email', 'trash-recovery@example.com')
  fs.writeFileSync(path.join(repository, 'tracked.txt'), 'tracked\n')
  git(repository, 'add', 'tracked.txt')
  git(repository, 'commit', '-q', '-m', 'Initial commit')
  return repository
}

async function main() {
  const root = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), 'desktop-plus-trash-recovery-')
  )
  const repository = createRepository(root)
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
    await page.getByLabel('Local path').fill(repository)
    await page.getByRole('button', { name: 'Add repository' }).click()
    await page.getByRole('tab', { name: 'Changes' }).waitFor()

    await page.locator('.sidebar-section').getByRole('button').first().click()
    await page
      .getByRole('button', {
        name: 'Delete trash-failure-repository from disk',
      })
      .click()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Move to Trash' })
      .click()

    const errorDialog = page.getByRole('dialog').filter({
      hasText: 'could not be moved to the macOS Trash',
    })
    await errorDialog.waitFor()
    await errorDialog
      .getByRole('button', { name: 'Delete permanently' })
      .click()

    const recoveryDialog = page.getByRole('alertdialog').filter({
      hasText: 'Moving it to the macOS Trash failed',
    })
    await recoveryDialog.waitFor()
    await recoveryDialog
      .getByRole('button', { name: 'Delete permanently' })
      .click()
    await page
      .locator('.repository-list-item')
      .filter({ hasText: 'trash-failure-repository' })
      .waitFor({ state: 'hidden' })
    assert.equal(fs.existsSync(repository), false)
    assert.deepEqual(errors, [])
    console.log(
      'Source Trash recovery passed: failed macOS Trash move offers guarded permanent deletion'
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
