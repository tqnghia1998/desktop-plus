const assert = require('assert/strict')
const { execFileSync, spawnSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')
const modifierKey = process.platform === 'darwin' ? 'Meta' : 'Control'
const { createServer } = require('./server')
const { launchBrowser } = require('./test-browser')

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
}

function gitStatus(cwd, ...args) {
  return spawnSync('git', args, { cwd, encoding: 'utf8' }).status
}

async function addRepository(page, repository) {
  const canonicalRepository = fs.realpathSync(repository)
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
  const repositoryInspection = page.waitForResponse(
    response =>
      response.url().includes('/api/repository/inspect') &&
      response.status() === 200
  )
  await page.getByLabel('Local path').fill(repository)
  await repositoryInspection
  await page.getByRole('button', { name: 'Add repository' }).click()
  await page.locator('.branch-toolbar-button').waitFor()
  await page.waitForFunction(
    expected => window.__DESKTOP_PLUS_WEB_REPOSITORY_PATH__ === expected,
    canonicalRepository
  )
}

async function selectRepository(page, repository) {
  const picker = page.locator('.repository-list')
  if (!(await picker.isVisible().catch(() => false))) {
    const button = page.getByRole('button', { name: /^Current repository/i })
    if ((await button.getAttribute('aria-expanded')) !== 'true')
      await button.click()
    await picker.waitFor()
  }
  const repositoryRow = page
    .locator('.repository-list-item')
    .filter({ hasText: path.basename(repository) })
    .first()
  await repositoryRow.waitFor()
  await repositoryRow.evaluate(element => element.click())
  await page.waitForFunction(
    expected => window.__DESKTOP_PLUS_WEB_REPOSITORY_PATH__ === expected,
    fs.realpathSync(repository)
  )
}

async function confirm(page, label) {
  const dialog = page
    .getByRole('alertdialog')
    .filter({ has: page.getByRole('button', { name: label, exact: true }) })
  await dialog.waitFor()
  await dialog.getByRole('button', { name: label, exact: true }).click()
  await dialog.waitFor({ state: 'hidden' })
}

function waitForTerminalOperation(page) {
  return page
    .waitForResponse(async response => {
      if (
        !/\/api\/git\/operations\/[^/]+$/.test(response.url()) ||
        response.request().method() !== 'GET' ||
        response.status() !== 200
      )
        return false
      const body = await response.json()
      return body.status === 'completed' || body.status === 'failed'
    })
    .then(response => response.json())
}

async function openBranchMenu(page) {
  const branchDropdown = page.locator('.branch-toolbar-button')
  const picker = page.locator('.branches-container')
  if (await picker.isVisible().catch(() => false)) return picker
  await branchDropdown
    .getByRole('button')
    .last()
    .evaluate(button => button.click())
  await picker.getByPlaceholder('Filter').waitFor()
  return picker
}

async function openBranchContextMenu(page, branch) {
  const picker = await openBranchMenu(page)
  await picker
    .getByRole('option', { name: new RegExp(`^${branch}(?:\\s|,|$)`) })
    .dispatchEvent('contextmenu')
  const menu = page.locator('#web-context-menu')
  await menu.waitFor()
  return menu
}

async function startMergeOperation(page, branch, operation) {
  const picker = await openBranchMenu(page)
  await picker
    .getByRole('button', { name: /Choose a branch to merge into/i })
    .click()
  let dialog = page.getByRole('dialog').filter({ hasText: /Merge into\s+\S+/i })
  await dialog
    .getByRole('option', { name: new RegExp(`^${branch}(?:\\s|,|$)`) })
    .click()

  if (operation !== 'Create a merge commit') {
    await dialog.getByRole('button', { name: 'Merge options' }).click()
    await page
      .locator('.dropdown-select-button-options')
      .getByText(operation, { exact: true })
      .click()
    if (operation === 'Rebase') {
      const rebaseDialog = page
        .getByRole('dialog')
        .filter({ hasText: /^Rebase\s+\S+/ })
      const start = rebaseDialog.getByRole('button', {
        name: 'Rebase',
        exact: true,
      })
      await start.waitFor()
      for (let attempt = 0; attempt < 100; attempt++) {
        if (await start.isEnabled()) break
        await page.waitForTimeout(100)
      }
      await start.click()
      return
    }
    dialog = page
      .getByRole('dialog')
      .filter({ hasText: /Squash and merge into\s+\S+/i })
  }

  const start = dialog.getByRole('button', { name: operation, exact: true })
  await start.waitFor()
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await start.isEnabled()) break
    await page.waitForTimeout(100)
  }
  await start.click()
}

async function waitForOperationConflict(page) {
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('button')].some(
        button =>
          button.textContent?.trim() === 'Close' ||
          button.getAttribute('aria-label') === 'File resolution options'
      ),
    undefined,
    { timeout: 60000 }
  )
  const error = page
    .getByRole('alertdialog')
    .filter({ has: page.getByRole('button', { name: 'Close', exact: true }) })
  if (await error.isVisible().catch(() => false)) {
    await page.waitForTimeout(350)
    await error.getByText('Close', { exact: true }).click()
    await error.waitFor({ state: 'hidden' })
  }
}

async function resolveOperationConflict(page, operation, resolutionIndex) {
  const dialog = page
    .getByRole('dialog')
    .filter({ hasText: `Resolve conflicts before ${operation}` })
  await dialog.waitFor()
  await dialog.getByRole('button', { name: 'File resolution options' }).click()
  await page
    .locator('#web-context-menu')
    .getByRole('menuitem')
    .filter({ hasText: /^(?:Use|Do not include)/ })
    .nth(resolutionIndex)
    .click()
  await dialog.getByText(/All conflicted files have been resolved/i).waitFor()
  await dialog.getByRole('button', { name: `Continue ${operation}` }).click()
  await dialog.waitFor({ state: 'hidden' })
}

async function startCherryPickFromCompare(page, branch, summary) {
  await page.getByRole('tab', { name: 'Compare' }).click()
  const comparison = page.locator('#compare-view')
  await comparison.getByLabel('Branch filter').click()
  await comparison
    .locator('.branches-list [role="option"]')
    .filter({ hasText: branch })
    .click()
  const commit = comparison
    .getByRole('listbox', { name: 'Commits' })
    .getByRole('option')
    .filter({ has: page.getByText(summary, { exact: true }) })
  await commit.waitFor()
  await commit.click()
  await commit.click({ button: 'right' })
  await page
    .locator('#web-context-menu')
    .getByRole('menuitem', { name: /Cherry-pick Commit/i })
    .click()
}

async function openSyncMenu(page) {
  await page.getByRole('button', { name: 'Push, pull, fetch options' }).click()
  const menu = page.locator('#foldout-container > .foldout')
  await menu.waitFor()
  return menu
}

async function refreshRepository(page) {
  await page.reload({ waitUntil: 'networkidle' })
  await page.locator('.branch-toolbar-button').waitFor()
  await page.waitForFunction(
    () =>
      !document
        .querySelector('.branch-toolbar-button .title')
        ?.textContent?.includes('No branch')
  )
}

async function waitForGit(cwd, args, expected) {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (git(cwd, ...args) === expected) return
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  assert.equal(git(cwd, ...args), expected)
}

async function waitForFile(file, expected) {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      if (fs.readFileSync(file, 'utf8') === expected) return
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
    }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  assert.equal(fs.readFileSync(file, 'utf8'), expected)
}

async function waitForPathState(file, expected) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (fs.existsSync(file) === expected) return
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  assert.equal(fs.existsSync(file), expected)
}

async function testForcePushAndRemoteDeletion(page, root) {
  const repository = path.join(root, 'force-repository')
  const remote = path.join(root, 'force-origin.git')
  const writer = path.join(root, 'force-writer')
  fs.mkdirSync(repository)
  git(repository, 'init', '-b', 'main')
  git(repository, 'config', 'user.name', 'Source Advanced')
  git(repository, 'config', 'user.email', 'source-advanced@example.com')
  fs.writeFileSync(path.join(repository, 'file.txt'), 'base\n')
  git(repository, 'add', 'file.txt')
  git(repository, 'commit', '-m', 'base')
  const base = git(repository, 'rev-parse', 'HEAD')
  git(root, 'init', '--bare', remote)
  git(remote, 'symbolic-ref', 'HEAD', 'refs/heads/main')
  git(repository, 'remote', 'add', 'origin', remote)
  git(repository, 'push', '-u', 'origin', 'main')
  git(root, 'clone', remote, writer)
  git(writer, 'config', 'user.name', 'Source Writer')
  git(writer, 'config', 'user.email', 'source-writer@example.com')
  fs.writeFileSync(path.join(writer, 'file.txt'), 'remote\n')
  git(writer, 'commit', '-am', 'remote change')
  const remoteTip = git(writer, 'rev-parse', 'HEAD')
  git(writer, 'push', 'origin', 'main')
  git(repository, 'fetch', 'origin')
  git(repository, 'reset', '--hard', base)
  fs.writeFileSync(path.join(repository, 'file.txt'), 'rewritten\n')
  git(repository, 'commit', '-am', 'rewritten local history')
  const rewrittenTip = git(repository, 'rev-parse', 'HEAD')

  await addRepository(page, repository)
  let syncMenu = await openSyncMenu(page)
  await syncMenu.getByRole('button', { name: 'Force push origin' }).click()
  let forcePushDialog = page
    .getByRole('dialog')
    .filter({ hasText: 'Are you sure you want to force push?' })
  await page.waitForTimeout(300)
  await forcePushDialog.getByRole('button', { name: 'Cancel' }).click()
  await forcePushDialog.waitFor({ state: 'hidden' })
  assert.equal(git(remote, 'rev-parse', 'refs/heads/main'), remoteTip)
  syncMenu = await openSyncMenu(page)
  await syncMenu.getByRole('button', { name: 'Force push origin' }).click()
  forcePushDialog = page
    .getByRole('dialog')
    .filter({ hasText: 'Are you sure you want to force push?' })
  await forcePushDialog.getByRole('button', { name: "I'm sure" }).click()
  await forcePushDialog.waitFor({ state: 'hidden' })
  await waitForGit(remote, ['rev-parse', 'refs/heads/main'], rewrittenTip)

  git(repository, 'checkout', '-b', 'remote-feature')
  fs.writeFileSync(path.join(repository, 'remote.txt'), 'remote branch\n')
  git(repository, 'add', 'remote.txt')
  git(repository, 'commit', '-m', 'remote branch')
  git(repository, 'push', '-u', 'origin', 'remote-feature')
  git(repository, 'checkout', 'main')
  await page.getByRole('button', { name: 'Fetch origin' }).click()
  let branchMenu = await openBranchContextMenu(page, 'origin/remote-feature')
  await branchMenu
    .getByRole('menuitem', {
      name: 'Delete…',
      exact: true,
    })
    .click()
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Cancel' })
    .click()
  assert.equal(
    gitStatus(remote, 'show-ref', '--verify', 'refs/heads/remote-feature'),
    0
  )
  branchMenu = await openBranchContextMenu(page, 'origin/remote-feature')
  await branchMenu
    .getByRole('menuitem', {
      name: 'Delete…',
      exact: true,
    })
    .click()
  await confirm(page, 'Delete')
  assert.notEqual(
    gitStatus(remote, 'show-ref', '--verify', 'refs/heads/remote-feature'),
    0
  )
}

function createConflictRepository(
  repository,
  branchName,
  sourceMessage,
  mainMessage
) {
  fs.mkdirSync(repository)
  git(repository, 'init', '-b', 'main')
  git(repository, 'config', 'user.name', 'Source Conflict')
  git(repository, 'config', 'user.email', 'source-conflict@example.com')
  fs.writeFileSync(path.join(repository, 'shared.txt'), 'base\n')
  git(repository, 'add', 'shared.txt')
  git(repository, 'commit', '-m', 'base')
  git(repository, 'checkout', '-b', branchName)
  fs.writeFileSync(path.join(repository, 'shared.txt'), `${sourceMessage}\n`)
  git(repository, 'commit', '-am', branchName)
  git(repository, 'checkout', 'main')
  fs.writeFileSync(path.join(repository, 'shared.txt'), `${mainMessage}\n`)
  git(repository, 'commit', '-am', 'main change')
}

async function testRebaseAndCherryPickRecovery(page, root) {
  const rebaseRepository = path.join(root, 'rebase-repository')
  createConflictRepository(rebaseRepository, 'feature', 'feature', 'main')
  await addRepository(page, rebaseRepository)
  await startMergeOperation(page, 'feature', 'Rebase')
  await waitForOperationConflict(page)
  await resolveOperationConflict(page, 'Rebase', 0)
  await waitForPathState(
    path.join(rebaseRepository, '.git', 'rebase-merge'),
    false
  )
  assert.equal(
    fs.existsSync(path.join(rebaseRepository, '.git', 'rebase-merge')),
    false
  )
  assert.equal(
    fs.readFileSync(path.join(rebaseRepository, 'shared.txt'), 'utf8'),
    'feature\n'
  )

  const skipRepository = path.join(root, 'skip-repository')
  createConflictRepository(skipRepository, 'feature', 'feature', 'main')
  await addRepository(page, skipRepository)
  await startMergeOperation(page, 'feature', 'Rebase')
  await waitForOperationConflict(page)
  await resolveOperationConflict(page, 'Rebase', 0)
  await waitForPathState(
    path.join(skipRepository, '.git', 'rebase-merge'),
    false
  )
  assert.equal(
    fs.existsSync(path.join(skipRepository, '.git', 'rebase-merge')),
    false
  )
  assert.equal(git(skipRepository, 'log', '-1', '--format=%s'), 'feature')

  const abortRepository = path.join(root, 'abort-repository')
  createConflictRepository(abortRepository, 'feature', 'feature', 'main')
  await addRepository(page, abortRepository)
  await startMergeOperation(page, 'feature', 'Create a merge commit')
  await waitForOperationConflict(page)
  const mergeConflictDialog = page
    .getByRole('dialog')
    .filter({ hasText: 'Resolve conflicts before Merge' })
  await mergeConflictDialog.getByRole('button', { name: 'Abort Merge' }).click()
  await mergeConflictDialog.waitFor({ state: 'hidden' })
  assert.equal(
    fs.existsSync(path.join(abortRepository, '.git', 'MERGE_HEAD')),
    false
  )

  const cherryRepository = path.join(root, 'cherry-repository')
  createConflictRepository(cherryRepository, 'source', 'source', 'main')
  await addRepository(page, cherryRepository)
  await startCherryPickFromCompare(page, 'source', 'source')
  await waitForOperationConflict(page)
  await resolveOperationConflict(page, 'Cherry-pick', 1)
  await waitForPathState(
    path.join(cherryRepository, '.git', 'CHERRY_PICK_HEAD'),
    false
  )
  assert.equal(
    fs.existsSync(path.join(cherryRepository, '.git', 'CHERRY_PICK_HEAD')),
    false
  )
  assert.equal(
    fs.readFileSync(path.join(cherryRepository, 'shared.txt'), 'utf8'),
    'source\n'
  )
}

async function testSquashMerge(page, root) {
  const cleanRepository = path.join(root, 'clean-squash-repository')
  fs.mkdirSync(cleanRepository)
  git(cleanRepository, 'init', '-b', 'main')
  git(cleanRepository, 'config', 'user.name', 'Source Squash')
  git(cleanRepository, 'config', 'user.email', 'source-squash@example.com')
  fs.writeFileSync(path.join(cleanRepository, 'base.txt'), 'base\n')
  git(cleanRepository, 'add', 'base.txt')
  git(cleanRepository, 'commit', '-m', 'base')
  git(cleanRepository, 'checkout', '-b', 'feature')
  fs.writeFileSync(path.join(cleanRepository, 'feature.txt'), 'feature\n')
  git(cleanRepository, 'add', 'feature.txt')
  git(cleanRepository, 'commit', '-m', 'feature change')
  git(cleanRepository, 'checkout', 'main')

  await addRepository(page, cleanRepository)
  await startMergeOperation(page, 'feature', 'Squash and merge')
  await waitForFile(path.join(cleanRepository, 'feature.txt'), 'feature\n')
  await waitForGit(cleanRepository, ['rev-list', '--count', 'HEAD'], '2')
  assert.equal(
    git(cleanRepository, 'rev-list', '--parents', '-n', '1', 'HEAD').split(
      /\s+/
    ).length,
    2,
    'a clean squash merge must create a normal one-parent commit'
  )

  const conflictRepository = path.join(root, 'conflict-squash-repository')
  createConflictRepository(
    conflictRepository,
    'feature',
    'feature squash',
    'main squash'
  )
  await addRepository(page, conflictRepository)
  await startMergeOperation(page, 'feature', 'Squash and merge')
  await waitForOperationConflict(page)
  await resolveOperationConflict(page, 'Squash', 1)
  assert.equal(
    git(conflictRepository, 'status', '--porcelain'),
    '',
    'resolving a squash conflict must leave a clean worktree'
  )
  assert.equal(
    fs.readFileSync(path.join(conflictRepository, 'shared.txt'), 'utf8'),
    'feature squash\n'
  )
  assert.equal(
    git(conflictRepository, 'rev-list', '--parents', '-n', '1', 'HEAD').split(
      /\s+/
    ).length,
    2,
    'a resolved squash merge must create a normal one-parent commit'
  )
}

async function testBulkUnusedBranchDeletion(page, root) {
  const repository = path.join(root, 'bulk-unused-branches')
  const worktree = path.join(root, 'bulk-unused-worktree')
  fs.mkdirSync(repository)
  git(repository, 'init', '-b', 'main')
  git(repository, 'config', 'user.name', 'Source Bulk Delete')
  git(repository, 'config', 'user.email', 'source-bulk-delete@example.com')
  fs.writeFileSync(path.join(repository, 'base.txt'), 'base\n')
  git(repository, 'add', 'base.txt')
  git(repository, 'commit', '-m', 'base')
  git(repository, 'checkout', '-b', 'merged-branch')
  fs.writeFileSync(path.join(repository, 'merged.txt'), 'merged\n')
  git(repository, 'add', 'merged.txt')
  git(repository, 'commit', '-m', 'merged branch change')
  git(repository, 'checkout', 'main')
  git(repository, 'merge', '--no-ff', 'merged-branch', '-m', 'merge branch')
  git(repository, 'branch', 'worktree-branch', 'merged-branch')
  git(repository, 'worktree', 'add', worktree, 'worktree-branch')

  await addRepository(page, repository)
  let branchMenu = await openBranchContextMenu(page, 'merged-branch')
  await branchMenu
    .getByRole('menuitem', { name: 'Delete Unused Local Branches…' })
    .click()
  const deleteDialog = page
    .getByRole('alertdialog')
    .filter({ hasText: 'Delete Unused Local Branches' })
  await deleteDialog.waitFor()
  assert.match(await deleteDialog.innerText(), /merged-branch/)
  assert.doesNotMatch(await deleteDialog.innerText(), /worktree-branch/)
  await page.waitForTimeout(300)
  await deleteDialog.getByRole('button', { name: 'Cancel' }).click()
  await deleteDialog.waitFor({ state: 'hidden' })
  assert.match(git(repository, 'branch'), /merged-branch/)

  branchMenu = await openBranchContextMenu(page, 'merged-branch')
  await branchMenu
    .getByRole('menuitem', { name: 'Delete Unused Local Branches…' })
    .click()
  await confirm(page, 'Delete')
  assert.doesNotMatch(git(repository, 'branch'), /merged-branch/)
  assert.match(git(repository, 'branch'), /worktree-branch/)
  assert.equal(git(worktree, 'branch', '--show-current'), 'worktree-branch')
}

async function testSubmoduleAndHistoryRewrite(page, root) {
  const module = path.join(root, 'module')
  const parent = path.join(root, 'submodule-parent')
  fs.mkdirSync(module)
  git(module, 'init', '-b', 'main')
  git(module, 'config', 'user.name', 'Source Module')
  git(module, 'config', 'user.email', 'source-module@example.com')
  fs.writeFileSync(path.join(module, 'module.txt'), 'one\n')
  git(module, 'add', 'module.txt')
  git(module, 'commit', '-m', 'module one')
  fs.mkdirSync(parent)
  git(parent, 'init', '-b', 'main')
  git(parent, 'config', 'user.name', 'Source Parent')
  git(parent, 'config', 'user.email', 'source-parent@example.com')
  git(parent, 'config', 'protocol.file.allow', 'always')
  git(
    parent,
    '-c',
    'protocol.file.allow=always',
    'submodule',
    'add',
    module,
    'vendor/module'
  )
  git(parent, 'commit', '-m', 'add submodule')
  fs.writeFileSync(path.join(module, 'module.txt'), 'two\n')
  git(module, 'commit', '-am', 'module two')
  const moduleTwo = git(module, 'rev-parse', 'HEAD')
  git(path.join(parent, 'vendor/module'), 'fetch')
  git(path.join(parent, 'vendor/module'), 'checkout', moduleTwo)

  await addRepository(page, parent)
  await page.getByRole('tab', { name: 'Changes' }).click()
  await page.getByRole('option', { name: /^vendor\/module/ }).click()
  const submoduleDiff = page.locator('.submodule-diff')
  await submoduleDiff
    .getByRole('heading', { name: 'Submodule changes' })
    .waitFor()
  const openSubmodule = () =>
    submoduleDiff.getByRole('button', { name: 'Open Repository' })
  await openSubmodule().waitFor({ state: 'visible' })
  for (let attempt = 0; attempt < 300; attempt++) {
    if (await openSubmodule().isEnabled()) break
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  if (!(await openSubmodule().isEnabled()))
    throw new Error(
      `Submodule open control did not enable:\n${await page
        .locator('body')
        .innerText()}`
    )
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      await openSubmodule().click({ timeout: 3000 })
      break
    } catch (error) {
      if (attempt === 9) throw error
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
  await page.waitForFunction(() => document.title.startsWith('module -'))

  await addRepository(page, parent)
  await refreshRepository(page)
  await page.getByRole('tab', { name: 'History' }).click()
  await page
    .getByLabel('Commits')
    .getByText('add submodule', { exact: true })
    .click()
  await page.getByRole('option', { name: /^vendor\/module/ }).click()
  await page.getByRole('button', { name: 'Open Repository' }).waitFor()

  const historyRepository = path.join(root, 'history-rewrite-repository')
  fs.mkdirSync(historyRepository)
  git(historyRepository, 'init', '-b', 'main')
  git(historyRepository, 'config', 'user.name', 'Source Rewrite')
  git(historyRepository, 'config', 'user.email', 'source-rewrite@example.com')
  for (const message of ['one', 'two', 'three']) {
    fs.writeFileSync(
      path.join(historyRepository, `${message}.txt`),
      `${message}\n`
    )
    git(historyRepository, 'add', `${message}.txt`)
    git(historyRepository, 'commit', '-m', message)
  }
  const originalTip = git(historyRepository, 'rev-parse', 'HEAD')
  await addRepository(page, historyRepository)
  await page.getByRole('tab', { name: 'History' }).click()
  const listViewButton = page.getByRole('button', { name: 'List view' })
  if ((await listViewButton.getAttribute('aria-pressed')) !== 'true')
    await listViewButton.click()
  await page.waitForFunction(
    element => element?.getAttribute('aria-pressed') === 'true',
    await listViewButton.elementHandle()
  )
  const commitList = page.getByLabel('Commits')
  const twoCommit = commitList
    .getByRole('option')
    .filter({ has: page.getByText('two', { exact: true }) })
  await twoCommit.click()
  await twoCommit.click({ button: 'right' })
  const reorderAction = page
    .locator('#web-context-menu')
    .getByRole('menuitem', { name: /Reorder Commit/i })
  await page.waitForFunction(
    element => !element?.classList.contains('disabled'),
    await reorderAction.elementHandle()
  )
  await reorderAction.click()
  await page.locator('.reorder-commits-hint-popover').waitFor()
  await commitList.press('ArrowDown')
  await commitList.press('ArrowDown')
  const reorderOperation = waitForTerminalOperation(page)
  await commitList.press('Enter')
  await reorderOperation
  await page.getByRole('button', { name: 'Undo', exact: true }).waitFor()
  assert.equal(
    git(historyRepository, 'log', '--reverse', '--format=%s', 'HEAD'),
    'two\none\nthree'
  )
  assert.notEqual(git(historyRepository, 'rev-parse', 'HEAD'), originalTip)
  const oldOneRow = await commitList
    .getByRole('option')
    .filter({ has: page.getByText('one', { exact: true }) })
    .elementHandle()
  const undoReorderOperation = waitForTerminalOperation(page)
  const undoHistoryRefresh = page.waitForResponse(async response => {
    if (
      !response.url().includes('/api/history') ||
      response.request().method() !== 'GET' ||
      response.status() !== 200
    )
      return false
    const body = await response.json()
    return body.commits?.some(commit => commit.sha === originalTip)
  })
  const undoButton = page.getByRole('button', { name: 'Undo', exact: true })
  await undoButton.click()
  await undoReorderOperation
  await undoHistoryRefresh
  await page.waitForFunction(element => !element?.isConnected, oldOneRow)
  await undoButton.waitFor({ state: 'hidden' })
  assert.equal(git(historyRepository, 'rev-parse', 'HEAD'), originalTip)

  await page.getByRole('tab', { name: 'History' }).click()
  const oneCommit = commitList
    .getByRole('option')
    .filter({ has: page.getByText('one', { exact: true }) })
  await oneCommit.click()
  await commitList
    .getByRole('option')
    .filter({ has: page.getByText('two', { exact: true }) })
    .click({ modifiers: [modifierKey] })
  await oneCommit.click({ button: 'right' })
  const squashAction = page
    .locator('#web-context-menu')
    .getByRole('menuitem', { name: /Squash 2 Commits/i })
  await page.waitForFunction(
    element => !element?.classList.contains('disabled'),
    await squashAction.elementHandle()
  )
  await squashAction.click()
  const squashDialog = page.locator('#commit-message-dialog')
  await squashDialog.waitFor()
  const squashMessage = 'Custom rewrite title\n\nRetain this body.'
  await squashDialog.getByLabel('Summary').fill('Custom rewrite title')
  await squashDialog.getByLabel('Description').fill('Retain this body.')
  const squashRequest = page.waitForRequest(
    request =>
      request.url().endsWith('/api/git/operations') &&
      request.method() === 'POST' &&
      request.postDataJSON().operation === 'squash-commits'
  )
  const squashOperation = waitForTerminalOperation(page)
  await squashDialog
    .getByRole('button', { name: 'Squash 2 Commits', exact: true })
    .click()
  const squashRequestBody = (await squashRequest).postDataJSON()
  const squashResult = await squashOperation
  assert.equal(
    squashResult.status,
    'completed',
    `squash operation failed: ${JSON.stringify({
      request: squashRequestBody,
      result: squashResult,
      history: git(historyRepository, 'log', '--format=%H %s'),
    })}`
  )
  assert.ok(
    squashResult.result?.undo,
    `squash operation did not return undo metadata: ${JSON.stringify(
      squashResult
    )}`
  )
  await page.getByRole('button', { name: 'Undo', exact: true }).waitFor()
  assert.ok(
    git(historyRepository, 'log', '--format=%B').includes(squashMessage),
    'the rewritten history must retain the user-provided squash message'
  )
  const undoSquashOperation = waitForTerminalOperation(page)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await undoSquashOperation
  assert.equal(git(historyRepository, 'rev-list', '--count', 'HEAD'), '3')
}

async function testNestedSubmoduleAndFailureRecovery(page, root) {
  const nested = path.join(root, 'nested-submodule')
  const module = path.join(root, 'nested-module')
  const parent = path.join(root, 'nested-parent')

  for (const repository of [nested, module, parent]) fs.mkdirSync(repository)

  git(nested, 'init', '-b', 'main')
  git(nested, 'config', 'user.name', 'Nested Source')
  git(nested, 'config', 'user.email', 'nested-source@example.com')
  fs.writeFileSync(path.join(nested, 'nested.txt'), 'one\n')
  git(nested, 'add', 'nested.txt')
  git(nested, 'commit', '-m', 'nested one')
  const nestedOne = git(nested, 'rev-parse', 'HEAD')

  git(module, 'init', '-b', 'main')
  git(module, 'config', 'user.name', 'Nested Module')
  git(module, 'config', 'user.email', 'nested-module@example.com')
  git(module, 'config', 'protocol.file.allow', 'always')
  git(
    module,
    '-c',
    'protocol.file.allow=always',
    'submodule',
    'add',
    nested,
    'nested/dependency'
  )
  git(module, 'commit', '-m', 'add nested dependency')
  fs.writeFileSync(path.join(nested, 'nested.txt'), 'two\n')
  git(nested, 'commit', '-am', 'nested two')
  const nestedTwo = git(nested, 'rev-parse', 'HEAD')
  git(path.join(module, 'nested/dependency'), 'fetch')
  git(
    module,
    '-c',
    'protocol.file.allow=always',
    'submodule',
    'update',
    '--init',
    '--recursive'
  )
  git(path.join(module, 'nested/dependency'), 'checkout', nestedTwo)
  git(module, 'add', 'nested/dependency')
  git(module, 'commit', '-m', 'update nested dependency')
  const moduleTwo = git(module, 'rev-parse', 'HEAD')

  git(parent, 'init', '-b', 'main')
  git(parent, 'config', 'user.name', 'Nested Parent')
  git(parent, 'config', 'user.email', 'nested-parent@example.com')
  git(parent, 'config', 'protocol.file.allow', 'always')
  git(
    parent,
    '-c',
    'protocol.file.allow=always',
    'submodule',
    'add',
    module,
    'vendor/module'
  )
  git(parent, 'commit', '-m', 'add nested module')
  git(
    path.join(parent, 'vendor/module'),
    '-c',
    'protocol.file.allow=always',
    'submodule',
    'update',
    '--init',
    '--recursive'
  )

  const nestedPath = path.join(parent, 'vendor/module/nested/dependency')
  git(parent, 'submodule', 'update', '--init', '--recursive')
  git(path.join(parent, 'vendor/module'), 'fetch')
  git(path.join(parent, 'vendor/module'), 'checkout', moduleTwo)
  git(
    path.join(parent, 'vendor/module'),
    '-c',
    'protocol.file.allow=always',
    'submodule',
    'update',
    '--init',
    '--recursive'
  )
  git(nestedPath, 'checkout', nestedOne)
  assert.equal(git(nestedPath, 'rev-parse', 'HEAD'), nestedOne)
  assert.equal(
    git(path.join(parent, 'vendor/module'), 'rev-parse', 'HEAD'),
    moduleTwo
  )

  await addRepository(page, parent)
  await page.getByRole('tab', { name: 'Changes' }).click()
  await page.getByRole('option', { name: /^vendor\/module/ }).click()
  const submoduleDiff = page.locator('.submodule-diff')
  await submoduleDiff
    .getByRole('heading', { name: 'Submodule changes' })
    .waitFor()
  await submoduleDiff.getByRole('button', { name: 'Open Repository' }).click()
  await page.waitForFunction(() => document.title.startsWith('module -'))
  await page.getByRole('tab', { name: 'Changes' }).click()
  await page.getByRole('option', { name: /^nested\/dependency/ }).click()
  await submoduleDiff
    .getByRole('heading', { name: 'Submodule changes' })
    .waitFor()
  await submoduleDiff.getByRole('button', { name: 'Open Repository' }).click()
  await page.waitForFunction(() => document.title.startsWith('dependency -'))
  await selectRepository(page, parent)
  await page.getByRole('tab', { name: 'Changes' }).click()
  await page.getByRole('option', { name: /^vendor\/module/ }).click()
  await submoduleDiff
    .getByRole('heading', { name: 'Submodule changes' })
    .waitFor()

  const broken = path.join(root, 'broken-submodule')
  fs.mkdirSync(broken)
  git(broken, 'init', '-b', 'main')
  git(broken, 'config', 'user.name', 'Broken Source')
  git(broken, 'config', 'user.email', 'broken-source@example.com')
  fs.writeFileSync(path.join(broken, 'broken.txt'), 'broken\n')
  git(broken, 'add', 'broken.txt')
  git(broken, 'commit', '-m', 'broken module')

  const brokenParent = path.join(root, 'broken-parent')
  fs.mkdirSync(brokenParent)
  git(brokenParent, 'init', '-b', 'main')
  git(brokenParent, 'config', 'user.name', 'Broken Parent')
  git(brokenParent, 'config', 'user.email', 'broken-parent@example.com')
  git(brokenParent, 'config', 'protocol.file.allow', 'always')
  git(
    brokenParent,
    '-c',
    'protocol.file.allow=always',
    'submodule',
    'add',
    broken,
    'vendor/broken'
  )
  git(brokenParent, 'commit', '-m', 'add broken module')
  fs.rmSync(path.join(brokenParent, 'vendor/broken'), {
    recursive: true,
    force: true,
  })
  fs.rmSync(path.join(brokenParent, '.git/modules/vendor/broken'), {
    recursive: true,
    force: true,
  })

  await addRepository(page, brokenParent)
  await page.getByRole('tab', { name: 'Changes' }).waitFor()
  await page.getByRole('option', { name: /^vendor\/broken/ }).click()
  await submoduleDiff
    .getByRole('heading', { name: 'Submodule changes' })
    .waitFor()
  await submoduleDiff.getByRole('button', { name: 'Open Repository' }).click()
  const missingRepository = page.locator('#missing-repository-view')
  await missingRepository.getByText(/Can't find "/).waitFor()
  await missingRepository
    .getByRole('button', { name: 'Remove', exact: true })
    .click()
  await page.locator('.repository-list').waitFor()
  assert.equal(
    await page
      .locator('.repository-list-item')
      .filter({ hasText: /^broken$/ })
      .count(),
    0
  )
  await page.keyboard.press('Escape')
  assert.equal(fs.existsSync(path.join(brokenParent, 'vendor/broken')), false)

  assert.equal(nestedOne.length, 40)
}

async function main() {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'desktop-plus-source-advanced-')
  )
  const server = createServer({ getDesktopRepositories: async () => [] })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const browser = await launchBrowser()

  try {
    const page = await browser.newPage()
    const errors = []
    page.on('pageerror', error =>
      errors.push(`${error.message}\n${error.stack || ''}`)
    )
    await page.goto(`http://127.0.0.1:${server.address().port}`, {
      waitUntil: 'networkidle',
    })
    await testForcePushAndRemoteDeletion(page, root)
    await testRebaseAndCherryPickRecovery(page, root)
    await testSquashMerge(page, root)
    await testBulkUnusedBranchDeletion(page, root)
    await testSubmoduleAndHistoryRewrite(page, root)
    await testNestedSubmoduleAndFailureRecovery(page, root)
    assert.deepEqual(errors, [])
    console.log(
      'Source advanced workflows passed: force push, remote deletion, squash merge, unused branch deletion, submodule controls, conflict recovery, and configured guarded history rewrites'
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
