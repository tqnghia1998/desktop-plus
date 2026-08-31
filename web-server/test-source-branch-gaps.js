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
  }
  await page.getByLabel('Local path').fill(repository)
  await page.getByRole('button', { name: 'Add repository' }).click()
}

async function openBranchMenu(page) {
  await closeError(page)
  const branchDropdown = page.locator('.branch-toolbar-button')
  await branchDropdown.getByRole('button').last().click()
  const menu = branchDropdown.locator('.foldout')
  await menu.getByRole('button', { name: 'Reset and pull' }).waitFor()
  return menu
}

async function openSyncMenu(page) {
  const syncDropdown = page.locator('.push-pull-button')
  await syncDropdown.getByRole('button').click()
  await syncDropdown
    .locator('.foldout')
    .getByRole('button', { name: 'Fetch', exact: true })
    .waitFor()
  return syncDropdown.locator('.foldout')
}

async function closeError(page) {
  const errorDialog = page.locator('dialog.error')
  if (await errorDialog.isVisible().catch(() => false)) {
    await errorDialog
      .getByRole('button', { name: 'Close', exact: true })
      .click()
    await errorDialog.waitFor({ state: 'hidden' })
  }
}

async function closeBranchMenu(page) {
  const branchDropdown = page.locator('.branch-toolbar-button')
  const menu = branchDropdown.locator('.foldout')
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

    let branchMenu = await openBranchMenu(page)
    await branchMenu
      .getByRole('button', {
        name: 'Set default-target as default branch',
        exact: true,
      })
      .click()
    branchMenu = await openBranchMenu(page)
    await branchMenu
      .getByRole('button', {
        name: 'Switch to default-target, default branch',
        exact: true,
      })
      .waitFor()
    await page.keyboard.press('Escape')
    await page.reload({ waitUntil: 'networkidle' })
    branchMenu = await openBranchMenu(page)
    await branchMenu
      .getByRole('button', {
        name: 'Switch to default-target, default branch',
        exact: true,
      })
      .waitFor()
    await page.keyboard.press('Escape')

    await openBranchMenu(page)
    await page.getByRole('button', { name: 'Create branch' }).click()
    const invalidBranchDialog = page.getByRole('dialog').filter({
      hasText: 'Create branch',
    })
    await invalidBranchDialog.getByLabel('Branch name').fill('bad..branch')
    await invalidBranchDialog
      .getByRole('alert')
      .filter({ hasText: 'Branch name' })
      .waitFor()
    assert.equal(
      await invalidBranchDialog
        .getByRole('button', { name: 'Create branch', exact: true })
        .isDisabled(),
      true
    )
    await invalidBranchDialog.getByRole('button', { name: 'Cancel' }).click()
    await invalidBranchDialog.waitFor({ state: 'hidden' })

    await openBranchMenu(page)
    const contextBranch = branchMenu
      .locator('button')
      .filter({ hasText: /^Switch to default-target/ })
      .first()
    await contextBranch.waitFor()
    await contextBranch.dispatchEvent('contextmenu')
    const branchContextMenu = page.locator('#web-context-menu')
    await branchContextMenu
      .getByRole('menuitem', {
        name: 'Copy branch name',
      })
      .waitFor()
    await branchContextMenu
      .getByRole('menuitem', { name: 'Checkout in new worktree' })
      .waitFor()
    await branchContextMenu
      .getByRole('menuitem', {
        name: 'Copy branch name',
      })
      .click()
    await page.keyboard.press('Escape')
    await branchContextMenu.waitFor({ state: 'hidden' })

    const syncMenu = await openSyncMenu(page)
    await syncMenu.getByRole('button', { name: 'Fetch', exact: true }).click()
    branchMenu = await openBranchMenu(page)
    await branchMenu
      .getByRole('button', { name: 'Pull pull-target', exact: true })
      .click()
    await waitForGit(repository, ['rev-parse', 'pull-target'], advancedMainTip)
    assert.equal(git(repository, 'branch', '--show-current'), 'main')

    branchMenu = await openBranchMenu(page)
    await branchMenu
      .getByRole('button', {
        name: 'Checkout default-target in new worktree',
        exact: true,
      })
      .click()
    const localDialog = page
      .getByRole('dialog')
      .filter({ hasText: 'Create a linked worktree from default-target' })
    await localDialog.getByLabel('Worktree path').fill(localWorktree)
    assert.equal(await localDialog.getByLabel('Branch').isEditable(), false)
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
    const remoteSyncMenu = await openSyncMenu(page)
    await remoteSyncMenu
      .getByRole('button', { name: 'Fetch', exact: true })
      .click()
    branchMenu = await openBranchMenu(page)
    await branchMenu
      .getByRole('button', {
        name: 'Checkout origin/remote-worktree in new worktree',
        exact: true,
      })
      .click()
    const remoteDialog = page.getByRole('dialog').filter({
      hasText: 'Create a linked worktree from origin/remote-worktree',
    })
    await remoteDialog.getByLabel('Worktree path').fill(remoteWorktree)
    assert.equal(
      await remoteDialog.getByLabel('Branch').inputValue(),
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
