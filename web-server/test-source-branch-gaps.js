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

async function waitForGit(cwd, args, expected) {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      if (git(cwd, ...args) === expected) return
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  assert.equal(git(cwd, ...args), expected)
}

async function addRepository(page, repository) {
  const canonicalRepository = fs.realpathSync(repository)
  await closeError(page)
  await closeBranchMenu(page)
  const homeAdd = page.getByRole('button', {
    name: /Add an Existing Repository from your local drive…/i,
  })
  if (await homeAdd.isVisible().catch(() => false)) {
    await homeAdd.click()
  } else {
    await page
      .locator('.sidebar-section')
      .getByRole('button')
      .first()
      .evaluate(button => button.click())
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await page
      .getByRole('menuitem', { name: 'Add Existing Repository…' })
      .click()
  }
  await page.getByLabel('Local path').fill(repository)
  await page.waitForResponse(
    response =>
      response.url().includes('/api/repository/inspect') &&
      response.status() === 200
  )
  await page.getByRole('button', { name: 'Add repository' }).click()
  await page.waitForFunction(expectedPath => {
    const state = JSON.parse(
      localStorage.getItem('desktop-plus-web-source-state') || '{}'
    )
    return state.selectedRepositoryPath === expectedPath
  }, canonicalRepository)
  await page.locator('.branch-toolbar-button').waitFor()
  await page.waitForFunction(() => {
    const title = document
      .querySelector('.branch-toolbar-button .title')
      ?.textContent?.trim()
    return Boolean(title && !title.includes('No branch'))
  })
  await page.waitForFunction(() => {
    const title = document.querySelector(
      '.push-pull-button .title'
    )?.textContent
    return Boolean(title && !title.includes('Publish repository'))
  })
}

async function openBranchMenu(page) {
  await closeError(page)
  const branchDropdown = page.locator('.branch-toolbar-button')
  const picker = page.locator('.branches-container')
  if (await picker.isVisible().catch(() => false)) return picker
  await branchDropdown.locator('> button').click()
  await picker.getByPlaceholder('Filter').waitFor()
  return picker
}

async function openBranchContextMenu(page, branch) {
  const picker = await openBranchMenu(page)
  const branchRow = picker.getByRole('option', {
    name: new RegExp(`^${branch}(?:\\s|,|$)`),
  })
  await branchRow.click({ button: 'right', position: { x: 24, y: 16 } })
  const menu = page.locator('#web-context-menu')
  await menu.waitFor()
  return menu
}

async function openSyncMenu(page) {
  const syncDropdown = page.locator('.push-pull-button')
  await syncDropdown.getByRole('button').click()
  await page.getByText(/^Fetch /).waitFor()
  return page.locator('.push-pull-dropdown')
}

async function fetchOrigin(page) {
  const directFetch = page
    .getByRole('button', { name: /^Fetch origin/ })
    .first()
  if (await directFetch.isVisible().catch(() => false)) {
    await directFetch.click()
    return
  }
  await openSyncMenu(page)
  await page.getByText(/^Fetch /).click()
}

async function closeError(page) {
  const errorDialog = page.locator('dialog.error')
  if (await errorDialog.isVisible().catch(() => false)) {
    await errorDialog
      .getByRole('button', { name: 'Close', exact: true })
      .last()
      .click()
    await errorDialog.waitFor({ state: 'hidden' })
  }
}

async function closeBranchMenu(page) {
  const branchDropdown = page.locator('.branch-toolbar-button')
  const menu = page.locator('#foldout-container > .foldout')
  if (await menu.isVisible().catch(() => false)) {
    await branchDropdown
      .getByRole('button')
      .last()
      .evaluate(button => button.click())
    await menu.waitFor({ state: 'hidden' })
  }
}

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-plus-branches-'))
  const repository = path.join(root, 'repository')
  const remote = path.join(root, 'origin.git')
  const writer = path.join(root, 'writer')
  const localWorktree = path.join(root, 'local-worktree')
  const remoteWorktree = path.join(root, 'remote-worktree')
  fs.mkdirSync(repository)
  git(repository, 'init', '-b', 'main')
  git(repository, 'config', 'user.name', 'Branch Gaps')
  git(repository, 'config', 'user.email', 'branch-gaps@example.com')
  fs.writeFileSync(path.join(repository, 'README.md'), 'base\n')
  git(repository, 'add', 'README.md')
  git(repository, 'commit', '-m', 'initial')
  git(root, 'init', '--bare', remote)
  git(repository, 'remote', 'add', 'origin', remote)
  git(repository, 'push', '-u', 'origin', 'main')
  git(remote, 'symbolic-ref', 'HEAD', 'refs/heads/main')
  git(root, 'clone', remote, writer)
  git(writer, 'config', 'user.name', 'Branch Writer')
  git(writer, 'config', 'user.email', 'branch-writer@example.com')

  git(repository, 'branch', 'default-target')
  git(repository, 'branch', '--track', 'pull-target', 'origin/main')
  git(writer, 'checkout', '-b', 'remote-worktree')
  fs.writeFileSync(path.join(writer, 'remote.txt'), 'remote\n')
  git(writer, 'add', 'remote.txt')
  git(writer, 'commit', '-m', 'remote worktree branch')
  git(writer, 'push', '-u', 'origin', 'remote-worktree')
  git(writer, 'checkout', 'main')
  fs.writeFileSync(path.join(writer, 'README.md'), 'advanced\n')
  git(writer, 'commit', '-am', 'advance main')
  const advancedMainTip = git(writer, 'rev-parse', 'HEAD')
  git(writer, 'push', 'origin', 'main')

  const server = createServer({ getDesktopRepositories: async () => [] })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const browser = await launchBrowser()

  try {
    const page = await browser.newPage()
    await page
      .context()
      .grantPermissions(['clipboard-read', 'clipboard-write'], {
        origin: `http://127.0.0.1:${server.address().port}`,
      })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`http://127.0.0.1:${server.address().port}`, {
      waitUntil: 'networkidle',
    })
    await addRepository(page, repository)

    let branchMenu = await openBranchContextMenu(page, 'default-target')
    await branchMenu
      .getByRole('menuitem', {
        name: 'Set as Default Branch',
        exact: true,
      })
      .click()
    branchMenu = await openBranchMenu(page)
    await branchMenu
      .getByRole('option', { name: /^default-target(?:\s|,|$)/ })
      .waitFor()
    await page.keyboard.press('Escape')
    await page.reload({ waitUntil: 'networkidle' })
    branchMenu = await openBranchMenu(page)
    await branchMenu
      .getByRole('option', { name: /^default-target(?:\s|,|$)/ })
      .waitFor()
    await page.keyboard.press('Escape')

    branchMenu = await openBranchMenu(page)
    await branchMenu.getByRole('button', { name: 'New Branch' }).click()
    const invalidBranchDialog = page.getByRole('dialog').filter({
      hasText: 'Create branch',
    })
    await invalidBranchDialog.getByLabel('Name').fill('bad..branch')
    await invalidBranchDialog
      .getByText(/Will be created as bad-branch/i)
      .waitFor()
    await new Promise(resolve => setTimeout(resolve, 400))
    await invalidBranchDialog.getByRole('button', { name: 'Cancel' }).click()
    await invalidBranchDialog.waitFor({ state: 'hidden' })

    const branchContextMenu = await openBranchContextMenu(
      page,
      'default-target'
    )
    await branchContextMenu
      .getByRole('menuitem', {
        name: 'Copy Branch Name',
      })
      .waitFor()
    await branchContextMenu
      .getByRole('menuitem', { name: 'Checkout in New Worktree…' })
      .waitFor()
    await branchContextMenu
      .getByRole('menuitem', {
        name: 'Copy Branch Name',
      })
      .click()
    await page.keyboard.press('Escape')
    await branchContextMenu.waitFor({ state: 'hidden' })

    await fetchOrigin(page)
    branchMenu = await openBranchContextMenu(page, 'pull-target')
    await branchMenu
      .getByRole('menuitem', { name: 'Pull Branch', exact: true })
      .click()
    await waitForGit(repository, ['rev-parse', 'pull-target'], advancedMainTip)
    assert.equal(git(repository, 'branch', '--show-current'), 'main')

    branchMenu = await openBranchContextMenu(page, 'default-target')
    await branchMenu
      .getByRole('menuitem', {
        name: 'Checkout in New Worktree…',
        exact: true,
      })
      .click()
    const localDialog = page.locator('#add-worktree')
    await localDialog
      .getByLabel('Worktree name')
      .fill(path.basename(localWorktree))
    await localDialog.getByLabel('Local path').fill(path.dirname(localWorktree))
    await localDialog.getByRole('button', { name: 'Create worktree' }).click()
    await closeError(page)
    await localDialog.waitFor({ state: 'hidden' })
    await page.keyboard.press('Escape')
    await waitForGit(
      localWorktree,
      ['branch', '--show-current'],
      'default-target'
    )

    await addRepository(page, repository)
    await fetchOrigin(page)
    branchMenu = await openBranchContextMenu(page, 'origin/remote-worktree')
    await branchMenu
      .getByRole('menuitem', {
        name: 'Checkout in New Worktree…',
        exact: true,
      })
      .click()
    const remoteDialog = page.locator('#add-worktree')
    await remoteDialog
      .getByLabel('Worktree name')
      .fill(path.basename(remoteWorktree))
    await remoteDialog
      .getByLabel('Local path')
      .fill(path.dirname(remoteWorktree))
    assert.equal(
      await remoteDialog.getByLabel('Branch name').inputValue(),
      'remote-worktree'
    )
    await remoteDialog.getByRole('button', { name: 'Create worktree' }).click()
    await closeError(page)
    await remoteDialog.waitFor({ state: 'hidden' })
    await waitForGit(
      remoteWorktree,
      ['branch', '--show-current'],
      'remote-worktree'
    )

    assert.deepEqual(errors, [])
    console.log(
      'Source branch gaps passed: default branch persistence, non-current pull, and local/remote branch worktrees'
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
