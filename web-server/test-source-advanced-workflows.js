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
  await page.locator('.branch-toolbar-button').waitFor()
  await page.waitForFunction(
    () =>
      !document
        .querySelector('.branch-toolbar-button .title')
        ?.textContent?.includes('No branch')
  )
}

async function selectRepository(page, repositoryName) {
  await page.locator('.sidebar-section').getByRole('button').first().click()
  const repository = page
    .locator('.repository-list-item')
    .filter({ hasText: repositoryName })
    .first()
  await repository.waitFor()
  await repository.evaluate(element => element.click())
}

async function confirm(page, label) {
  const dialog = page
    .getByRole('alertdialog')
    .filter({ has: page.getByRole('button', { name: label, exact: true }) })
  await dialog.waitFor()
  await dialog.getByRole('button', { name: label, exact: true }).click()
  await dialog.waitFor({ state: 'hidden' })
}

async function closeError(page) {
  const error = page
    .getByRole('dialog')
    .filter({ has: page.getByRole('button', { name: 'Close', exact: true }) })
  await error.waitFor()
  await error.getByText('Close', { exact: true }).click()
  await error.waitFor({ state: 'hidden' })
}

async function openBranchMenu(page) {
  const branchDropdown = page.locator('.branch-toolbar-button')
  await branchDropdown
    .getByRole('button')
    .last()
    .evaluate(button => button.click())
  await page
    .getByRole('button', { name: 'Create branch', exact: true })
    .waitFor()
}

async function openSyncMenu(page) {
  const syncDropdown = page.locator('.push-pull-button')
  await syncDropdown.getByRole('button').evaluate(button => button.click())
  await page.getByRole('button', { name: 'Push', exact: true }).waitFor()
}

async function refreshTools(page) {
  await page.getByRole('tab', { name: 'Tools' }).click()
  const tools = page.getByRole('region', { name: 'Repository tools' })
  await tools.getByRole('button', { name: 'Refresh repository' }).click()
  await tools.waitFor({ state: 'visible' })
  await page.waitForFunction(
    () =>
      document.querySelector('.web-tools-panel')?.getAttribute('aria-busy') ===
      'false'
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
  await openSyncMenu(page)
  await page.getByRole('button', { name: 'Force-push with lease' }).click()
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Cancel' })
    .click()
  assert.equal(git(remote, 'rev-parse', 'refs/heads/main'), remoteTip)
  await openSyncMenu(page)
  await page.getByRole('button', { name: 'Force-push with lease' }).click()
  await confirm(page, 'Force-push with lease')
  await waitForGit(remote, ['rev-parse', 'refs/heads/main'], rewrittenTip)

  git(repository, 'checkout', '-b', 'remote-feature')
  fs.writeFileSync(path.join(repository, 'remote.txt'), 'remote branch\n')
  git(repository, 'add', 'remote.txt')
  git(repository, 'commit', '-m', 'remote branch')
  git(repository, 'push', '-u', 'origin', 'remote-feature')
  git(repository, 'checkout', 'main')
  await openSyncMenu(page)
  await page.getByRole('button', { name: 'Fetch', exact: true }).click()
  await openBranchMenu(page)
  await page
    .getByRole('button', {
      name: 'Delete remote origin/remote-feature',
      exact: true,
    })
    .waitFor()
  await page
    .getByRole('button', {
      name: 'Delete remote origin/remote-feature',
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
  await page
    .getByRole('button', {
      name: 'Delete remote origin/remote-feature',
      exact: true,
    })
    .click()
  await confirm(page, 'Delete remote branch')
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
  await openBranchMenu(page)
  await page.getByRole('button', { name: 'Rebase onto branch' }).click()
  await page
    .getByRole('dialog')
    .filter({ hasText: 'Rebase onto branch' })
    .getByRole('button', { name: 'Continue' })
    .click()
  await closeError(page)
  await page.getByRole('button', { name: 'Use ours' }).click()
  await page
    .getByRole('button', { name: 'Use ours' })
    .waitFor({ state: 'hidden' })
  await page.getByRole('button', { name: 'Continue operation' }).waitFor()
  await page.getByRole('button', { name: 'Continue operation' }).click()
  await page
    .getByRole('button', { name: 'Continue operation' })
    .waitFor({ state: 'hidden' })
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
  await openBranchMenu(page)
  await page.getByRole('button', { name: 'Rebase onto branch' }).click()
  await page
    .getByRole('dialog')
    .filter({ hasText: 'Rebase onto branch' })
    .getByRole('button', { name: 'Continue' })
    .click()
  await closeError(page)
  await page.getByRole('button', { name: 'Skip current commit' }).click()
  await page
    .getByRole('button', { name: 'Skip current commit' })
    .waitFor({ state: 'hidden' })
  assert.equal(
    fs.existsSync(path.join(skipRepository, '.git', 'rebase-merge')),
    false
  )

  const abortRepository = path.join(root, 'abort-repository')
  createConflictRepository(abortRepository, 'feature', 'feature', 'main')
  await addRepository(page, abortRepository)
  await openBranchMenu(page)
  await page.getByRole('button', { name: 'Merge branch', exact: true }).click()
  await page
    .getByRole('dialog')
    .filter({ hasText: 'Merge branch' })
    .getByRole('button', { name: 'Continue' })
    .click()
  await closeError(page)
  await page.getByRole('button', { name: 'Abort operation' }).click()
  await page
    .getByRole('button', { name: 'Abort operation' })
    .waitFor({ state: 'hidden' })
  assert.equal(
    fs.existsSync(path.join(abortRepository, '.git', 'MERGE_HEAD')),
    false
  )

  const cherryRepository = path.join(root, 'cherry-repository')
  createConflictRepository(cherryRepository, 'source', 'source', 'main')
  await addRepository(page, cherryRepository)
  await openBranchMenu(page)
  await page.getByRole('button', { name: 'Cherry-pick branch tip' }).click()
  await page
    .getByRole('dialog')
    .filter({ hasText: 'Cherry-pick branch tip' })
    .getByRole('button', { name: 'Continue' })
    .click()
  await closeError(page)
  await page.getByRole('button', { name: 'Use theirs' }).click()
  await page
    .getByRole('button', { name: 'Use theirs' })
    .waitFor({ state: 'hidden' })
  await page.getByRole('button', { name: 'Continue operation' }).waitFor()
  await page.getByRole('button', { name: 'Continue operation' }).click()
  await page
    .getByRole('button', { name: 'Continue operation' })
    .waitFor({ state: 'hidden' })
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
  await openBranchMenu(page)
  await page.getByRole('button', { name: 'Squash merge branch' }).click()
  await page
    .getByRole('dialog')
    .filter({ hasText: 'Squash merge branch' })
    .getByRole('button', { name: 'Continue' })
    .click()
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
  await openBranchMenu(page)
  await page.getByRole('button', { name: 'Squash merge branch' }).click()
  await page
    .getByRole('dialog')
    .filter({ hasText: 'Squash merge branch' })
    .getByRole('button', { name: 'Continue' })
    .click()
  await closeError(page)
  await page.getByRole('button', { name: 'Use theirs' }).click()
  await page
    .getByRole('button', { name: 'Use theirs' })
    .waitFor({ state: 'hidden' })
  await page.getByRole('button', { name: 'Continue operation' }).click()
  await page
    .getByRole('button', { name: 'Continue operation' })
    .waitFor({ state: 'hidden' })
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
  await openBranchMenu(page)
  await page
    .getByRole('button', { name: 'Delete unused local branches' })
    .click()
  const deleteDialog = page
    .getByRole('alertdialog')
    .filter({ hasText: 'Delete unused local branches?' })
  await deleteDialog.waitFor()
  assert.match(await deleteDialog.innerText(), /merged-branch/)
  assert.doesNotMatch(await deleteDialog.innerText(), /worktree-branch/)
  await deleteDialog.getByRole('button', { name: 'Cancel' }).click()
  await deleteDialog.waitFor({ state: 'hidden' })
  assert.match(git(repository, 'branch'), /merged-branch/)

  await page
    .getByRole('button', { name: 'Delete unused local branches' })
    .click()
  await confirm(page, 'Delete branches')
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
  const moduleOne = git(module, 'rev-parse', 'HEAD')
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
  await page
    .locator('.web-submodule-actions')
    .getByRole('button', { name: 'Open submodule repository' })
    .waitFor()
  await page.getByRole('button', { name: 'Update submodule' }).click()
  await waitForGit(
    path.join(parent, 'vendor/module'),
    ['rev-parse', 'HEAD'],
    moduleOne
  )
  git(path.join(parent, 'vendor/module'), 'checkout', moduleTwo)
  await refreshTools(page)
  await page.getByRole('tab', { name: 'Changes' }).click()
  await page.getByRole('option', { name: /^vendor\/module/ }).click()
  const openSubmodule = () =>
    page.getByRole('button', { name: 'Open submodule repository' })
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
  await refreshTools(page)
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
  const oneSHA = git(historyRepository, 'rev-parse', 'HEAD~2')
  await addRepository(page, historyRepository)
  await page.getByRole('tab', { name: 'History' }).click()
  await page.getByLabel('Commits').getByText('two', { exact: true }).click()
  await page.getByRole('button', { name: 'Reorder selected' }).click()
  const reorderDialog = page
    .getByRole('dialog')
    .filter({ hasText: 'Reorder selected commits' })
  await reorderDialog.getByLabel('Insert before').selectOption(oneSHA)
  await reorderDialog.getByRole('button', { name: 'Continue' }).click()
  await confirm(page, 'Reorder commits')
  const operationProgress = page.getByRole('region', {
    name: 'Git operation progress',
  })
  await operationProgress.waitFor()
  const operationText = await operationProgress.innerText()
  assert.match(operationText, /Reorder commits/i)
  assert.match(operationText, /progress: \d+ of \d+/i)
  await page.getByRole('button', { name: 'Undo history rewrite' }).waitFor()
  assert.equal(
    git(historyRepository, 'log', '--reverse', '--format=%s', 'HEAD'),
    'two\none\nthree'
  )
  assert.notEqual(git(historyRepository, 'rev-parse', 'HEAD'), originalTip)
  await page.getByRole('button', { name: 'Undo history rewrite' }).click()
  await confirm(page, 'Undo history rewrite')
  assert.equal(git(historyRepository, 'rev-parse', 'HEAD'), originalTip)

  await page.getByRole('tab', { name: 'History' }).click()
  await page.getByLabel('Commits').getByText('one', { exact: true }).click()
  await page
    .getByLabel('Commits')
    .getByText('two', { exact: true })
    .click({ modifiers: [modifierKey] })
  await page.getByRole('button', { name: 'Squash selected' }).click()
  const squashDialog = page
    .getByRole('dialog')
    .filter({ hasText: 'Squash selected commits' })
  const squashMessage = 'Custom rewrite title\n\nRetain this body.'
  await squashDialog.getByLabel('Commit message').fill(squashMessage)
  await squashDialog.getByRole('button', { name: 'Continue' }).click()
  await confirm(page, 'Squash commits')
  await page
    .getByRole('region', { name: 'Git operation progress' })
    .getByText(/Squash Commits progress:/i)
    .waitFor()
  await page.getByRole('button', { name: 'Undo history rewrite' }).waitFor()
  assert.ok(
    git(historyRepository, 'log', '--format=%B').includes(squashMessage),
    'the rewritten history must retain the user-provided squash message'
  )
  await page.getByRole('button', { name: 'Undo history rewrite' }).click()
  await confirm(page, 'Undo history rewrite')
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
  const nestedActions = page.locator('.web-submodule-actions')
  await nestedActions.getByText('Nested submodules', { exact: true }).waitFor()
  await nestedActions
    .getByRole('button', { name: 'Open nested submodule nested/dependency' })
    .click()
  await page.waitForFunction(() => document.title.startsWith('dependency -'))
  await selectRepository(page, 'nested-parent')
  await page.getByRole('tab', { name: 'Changes' }).click()
  await page.getByRole('option', { name: /^vendor\/module/ }).click()
  await nestedActions.getByText('Nested submodules', { exact: true }).waitFor()

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
  git(
    brokenParent,
    'config',
    'submodule.vendor/broken.url',
    '/path/that/does/not/exist'
  )
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
  await page.waitForFunction(() =>
    document
      .querySelector('[aria-label="Changed files"]')
      ?.textContent?.includes('vendor/broken')
  )
  await page.getByRole('option', { name: /^vendor\/broken/ }).click()
  const updateSubmodule = page.getByRole('button', {
    name: 'Update submodule',
  })
  await updateSubmodule.waitFor()
  await page.waitForFunction(() =>
    [...document.querySelectorAll('button')].some(
      button =>
        button.textContent?.trim() === 'Update submodule' &&
        button.getAttribute('aria-disabled') !== 'true'
    )
  )
  await updateSubmodule.click()
  const errorDialog = page.getByRole('dialog').filter({
    hasText: 'The submodule could not be updated',
  })
  await errorDialog.waitFor()
  await errorDialog
    .getByText('Submodule command output', { exact: true })
    .waitFor()
  await errorDialog.getByRole('button', { name: 'Refresh repository' }).click()
  await errorDialog.waitFor({ state: 'hidden' })
  await page.getByRole('option', { name: /^vendor\/broken/ }).click()
  await page.getByRole('button', { name: 'Update submodule' }).waitFor()
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
    page.on('pageerror', error => errors.push(error.message))
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
