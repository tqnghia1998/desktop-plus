const assert = require('assert/strict')
const { execFileSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { createServer } = require('./server')
const { launchBrowser } = require('./test-browser')

function git(cwd, ...args) {
  execFileSync('git', args, { cwd, stdio: 'ignore' })
}

async function main() {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'desktop-plus-source-application-menu-')
  )
  const repository = path.join(root, 'repository')
  fs.mkdirSync(repository)
  git(repository, 'init', '-b', 'main')
  git(repository, 'config', 'user.name', 'Application Menu')
  git(repository, 'config', 'user.email', 'application-menu@example.com')
  fs.writeFileSync(path.join(repository, 'README.md'), '# menu\n')
  fs.writeFileSync(path.join(repository, '.gitignore'), 'node_modules\n')
  git(repository, 'add', '.')
  git(repository, 'commit', '-m', 'initial')
  git(repository, 'remote', 'add', 'origin', 'https://example.invalid/repo.git')

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
    await page.locator('.branch-toolbar-button').waitFor()

    const appMenu = page.locator('#app-menu-bar')
    await appMenu
      .getByRole('menuitem', { name: 'Repository', exact: true })
      .click()
    const repositoryMenu = page.locator('#foldout-container').getByRole('menu')
    for (const label of [
      'View in your browser',
      'Open With…',
      'New Worktree…',
      'Repository Settings…',
    ])
      await repositoryMenu
        .getByRole('menuitem', { name: label, exact: true })
        .waitFor()

    await repositoryMenu
      .getByRole('menuitem', { name: 'Repository Settings…', exact: true })
      .click()
    const settings = page.locator('#repository-settings')
    await settings.waitFor()
    await page.getByText('Ignored Files', { exact: true }).click()
    const ignoredFiles = page.getByLabel('Ignored files')
    await ignoredFiles.fill('node_modules\ndist\n')
    await settings.getByRole('button', { name: 'Save', exact: true }).click()
    for (let attempt = 0; attempt < 50; attempt++) {
      if (
        fs.readFileSync(path.join(repository, '.gitignore'), 'utf8') ===
        'node_modules\ndist\n'
      )
        break
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    assert.equal(
      fs.readFileSync(path.join(repository, '.gitignore'), 'utf8'),
      'node_modules\ndist\n'
    )

    await appMenu.getByRole('menuitem', { name: 'Branch', exact: true }).click()
    const branchMenu = page.locator('#foldout-container').getByRole('menu')
    for (const label of [
      'Discard All Changes…',
      'Permanently Discard All Changes…',
      'Stash All Changes',
      'Delete Unused Local Branches…',
      'Update from Default Branch',
      'Rebase Current Branch…',
    ])
      await branchMenu
        .getByRole('menuitem', { name: label, exact: true })
        .waitFor()
    assert.deepEqual(errors, [])
    console.log(
      'Source application menu passed: shared menu and settings flows'
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
