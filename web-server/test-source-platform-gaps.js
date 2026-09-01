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
    path.join(os.tmpdir(), 'desktop-plus-source-platform-')
  )
  const repository = path.join(root, 'repository')
  const cloneDestination = path.join(root, 'clone-destination')
  fs.mkdirSync(repository)
  fs.mkdirSync(cloneDestination)
  git(repository, 'init', '-q', '-b', 'main')
  git(repository, 'config', 'user.name', 'Source Platform')
  git(repository, 'config', 'user.email', 'source-platform@example.com')
  fs.writeFileSync(path.join(repository, 'README.md'), '# platform controls\n')
  git(repository, 'add', 'README.md')
  git(repository, 'commit', '-q', '-m', 'Initial platform fixture')

  const selections = [cloneDestination, root, repository]
  const server = createServer({
    getDesktopRepositories: async () => [],
    selectDirectory: async () => selections.shift() || null,
    selectSavePath: async () => selections.shift() || null,
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
      .getByRole('button', { name: /Clone a Repository from the Internet/i })
      .click()
    const cloneDialog = page.locator('dialog').filter({
      hasText: 'Clone a Repository',
    })
    await page.waitForFunction(
      input => input.value.length > 0,
      await cloneDialog
        .locator('input[placeholder="repository path"]')
        .elementHandle()
    )
    await cloneDialog.getByRole('button', { name: 'Choose…' }).click()
    await page.waitForFunction(
      expected =>
        document.querySelector('dialog input[placeholder="repository path"]')
          ?.value === expected,
      cloneDestination
    )
    assert.equal(
      await cloneDialog
        .locator('input[placeholder="repository path"]')
        .inputValue(),
      cloneDestination
    )
    await page.waitForTimeout(400)
    await cloneDialog.getByRole('button', { name: 'Cancel' }).click()
    await cloneDialog.waitFor({ state: 'hidden' })

    await page
      .getByRole('button', {
        name: /Create a New Repository on your Local Drive/i,
      })
      .click()
    const createDialog = page.locator('dialog').filter({
      hasText: 'Create a New Repository',
    })
    await page.waitForFunction(
      input => input.value.length > 0,
      await createDialog
        .locator('input[placeholder="repository path"]')
        .elementHandle()
    )
    await createDialog.getByRole('button', { name: 'Choose…' }).click()
    await page.waitForFunction(
      expected =>
        document.querySelector('dialog input[placeholder="repository path"]')
          ?.value === expected,
      root
    )
    assert.equal(
      await createDialog
        .locator('input[placeholder="repository path"]')
        .inputValue(),
      root
    )
    await page.waitForTimeout(400)
    await createDialog.getByRole('button', { name: 'Cancel' }).click()
    await createDialog.waitFor({ state: 'hidden' })

    await page
      .getByRole('button', {
        name: /Add an Existing Repository from your Local Drive/i,
      })
      .click()
    const addDialog = page.locator('dialog').filter({
      hasText: 'Add Local Repository',
    })
    await addDialog.getByRole('button', { name: 'Choose…' }).click()
    await page.waitForFunction(
      expected =>
        document.querySelector('dialog input[placeholder="repository path"]')
          ?.value === expected,
      repository
    )
    assert.equal(
      await addDialog
        .locator('input[placeholder="repository path"]')
        .inputValue(),
      repository
    )
    await addDialog.getByRole('button', { name: 'Add Repository' }).click()
    await page.getByRole('tab', { name: 'Changes' }).waitFor()

    assert.deepEqual(errors, [])
    console.log(
      'Source platform controls passed: desktop add, clone, and create dialogs use the browser folder-picker adapter'
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
