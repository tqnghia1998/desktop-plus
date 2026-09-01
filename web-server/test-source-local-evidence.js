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

function gitWithEnv(cwd, env, ...args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  }).trim()
}

function hasRemoteTag(remote, tag) {
  return git(remote, 'show-ref', '--verify', `refs/tags/${tag}`)
}

async function waitForBranch(page, branch) {
  await page.waitForFunction(
    expected =>
      document
        .querySelector('.branch-toolbar-button .title')
        ?.textContent?.includes(expected),
    branch
  )
}

async function waitForNoBlockingDialog(page) {
  await page
    .locator('dialog[open]:visible:not(.tooltip-host)')
    .waitFor({ state: 'hidden' })
}

async function addRepository(page, repository) {
  const canonicalRepository = fs.realpathSync(repository)
  await page.waitForFunction(() =>
    Boolean(
      document.querySelector('[aria-label="Let\'s get started!"]') ||
        document.querySelector('.sidebar-section')
    )
  )
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
  await waitForBranch(page, 'main')
  await waitForNoBlockingDialog(page)
}

async function refresh(page) {
  await waitForNoBlockingDialog(page)
  await page.reload({ waitUntil: 'networkidle' })
  await page.locator('.branch-toolbar-button').waitFor()
  await waitForNoBlockingDialog(page)
}

async function openBranchMenu(page) {
  const branchButton = page
    .locator('.branch-toolbar-button')
    .getByRole('button')
    .last()
  const picker = page.locator('.branches-container')
  if (await picker.isVisible().catch(() => false)) return picker
  await branchButton.focus()
  await branchButton.press('Enter')
  await picker.getByPlaceholder('Filter').waitFor()
  return picker
}

async function requestSwitch(page, branch) {
  const picker = await openBranchMenu(page)
  await picker
    .getByRole('option', { name: new RegExp(`^${branch}(?:\\s|,|$)`) })
    .click()
}

async function openBranchContextMenu(page, branch) {
  const picker = await openBranchMenu(page)
  await picker
    .getByRole('option', { name: new RegExp(`^${branch}(?:\\s|,|$)`) })
    .click({ button: 'right', position: { x: 24, y: 16 } })
  const menu = page.locator('#web-context-menu')
  await menu.waitFor()
  return menu
}

async function openRepositoryPicker(page) {
  const picker = page.locator('.repository-list')
  if (await picker.isVisible().catch(() => false)) return picker
  await page.keyboard.press('Escape')
  await page.locator('#web-context-menu').waitFor({ state: 'hidden' })
  const button = page.getByRole('button', { name: /^Current repository/i })
  if ((await button.getAttribute('aria-expanded')) !== 'true')
    await button.click()
  await picker.waitFor()
  return picker
}

async function selectRepository(page, repository) {
  await openRepositoryPicker(page)
  await page
    .locator('.repository-list-item > .name')
    .filter({ hasText: new RegExp(`^${path.basename(repository)}$`) })
    .first()
    .click()
  await page.locator('.branch-toolbar-button').waitFor()
  await page.waitForFunction(
    expected => window.__DESKTOP_PLUS_WEB_REPOSITORY_PATH__ === expected,
    fs.realpathSync(repository)
  )
}

async function openPreferencesTab(page, tab) {
  await page.evaluate(() =>
    window.dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, ctrlKey: true, key: ',' })
    )
  )
  const preferences = page.getByRole('dialog').filter({
    hasText: /Preferences|Options|Settings/,
  })
  await preferences.waitFor()
  await preferences.getByRole('tab', { name: tab, exact: true }).click()
  return preferences
}

async function savePreferences(preferences) {
  await preferences
    .locator('.dialog-footer')
    .getByRole('button', { name: 'Save', exact: true })
    .click()
  await preferences.waitFor({ state: 'hidden' })
}

async function waitForStorageValue(page, key, expected) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (
      (await page.evaluate(
        storageKey => localStorage.getItem(storageKey),
        key
      )) === expected
    )
      return
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  assert.equal(
    await page.evaluate(storageKey => localStorage.getItem(storageKey), key),
    expected
  )
}

async function createWorktree(page, branch, worktreePath, worktreeBranch) {
  const menu = await openBranchContextMenu(page, branch)
  await menu
    .getByRole('menuitem', {
      name: 'Checkout in New Worktree…',
      exact: true,
    })
    .click()
  const dialog = page.getByRole('dialog').filter({ hasText: 'Add worktree' })
  await dialog.getByLabel('Worktree name').fill(path.basename(worktreePath))
  await dialog.getByLabel('Local path').fill(path.dirname(worktreePath))
  await dialog.getByLabel('Branch name').fill(worktreeBranch)
  await dialog.getByRole('button', { name: 'Create worktree' }).click()
  await dialog.waitFor({ state: 'hidden' })
}

async function openWorktreeContextMenu(page, worktreePath) {
  await openRepositoryPicker(page)
  const worktreeRow = page
    .locator('.repository-worktree-item')
    .filter({
      hasText: path.basename(worktreePath),
    })
    .first()
  await worktreeRow.waitFor()
  await worktreeRow.click({ button: 'right', position: { x: 24, y: 16 } })
  const menu = page.locator('#web-context-menu')
  await menu.waitFor()
  return { menu, worktreeRow }
}

async function waitForText(page, text, state = 'visible') {
  await page.getByText(text, { exact: false }).waitFor({ state })
}

async function waitForGitText(cwd, args, pattern) {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (pattern.test(git(cwd, ...args))) return
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  assert.match(git(cwd, ...args), pattern)
}

async function waitForFile(filePath) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (fs.existsSync(filePath)) return
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  assert.fail(`Timed out waiting for ${filePath}`)
}

async function waitForPathAbsent(filePath) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (!fs.existsSync(filePath)) return
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  assert.fail(`Timed out waiting for ${filePath} to be removed`)
}

async function waitForProcessExit(pid) {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      process.kill(pid, 0)
    } catch {
      return
    }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  assert.fail(`Process ${pid} did not exit`)
}

function shellQuote(value) {
  return `'${value.replaceAll("'", "'\\''")}'`
}

async function confirm(page, name) {
  const dialog = page.getByRole('alertdialog')
  await dialog.waitFor()
  await dialog.getByRole('button', { name, exact: true }).click()
  await dialog.waitFor({ state: 'hidden' })
}

async function grantClipboard(page, origin) {
  await page
    .context()
    .grantPermissions(['clipboard-read', 'clipboard-write'], { origin })
}

function createRepository(root, name) {
  const repository = path.join(root, name)
  fs.mkdirSync(repository)
  git(repository, 'init', '-b', 'main')
  git(repository, 'config', 'user.name', 'Source Local Evidence')
  git(repository, 'config', 'user.email', 'source-local-evidence@example.com')
  fs.writeFileSync(path.join(repository, 'tracked.txt'), 'base\n')
  git(repository, 'add', 'tracked.txt')
  git(repository, 'commit', '-m', 'initial')
  return repository
}

async function testCheckoutRecovery(page, repository, root) {
  git(repository, 'branch', 'feature')
  fs.writeFileSync(path.join(repository, 'tracked.txt'), 'cancelled change\n')
  await refresh(page)
  await page.getByRole('tab', { name: 'Changes' }).click()
  await page.getByRole('option', { name: /^tracked\.txt\b/ }).waitFor()
  await requestSwitch(page, 'feature')
  const recovery = page.locator('#stash-changes')
  await recovery.waitFor()
  await page.waitForTimeout(300)
  await page.keyboard.press('Escape')
  await recovery.waitFor({ state: 'hidden' })
  assert.equal(git(repository, 'branch', '--show-current'), 'main')
  assert.equal(
    fs.readFileSync(path.join(repository, 'tracked.txt'), 'utf8'),
    'cancelled change\n'
  )

  await page.waitForTimeout(300)
  await requestSwitch(page, 'feature')
  const leaveDialog = page.locator('#stash-changes')
  await leaveDialog.waitFor()
  await leaveDialog
    .getByRole('button', { name: 'Switch Branch', exact: true })
    .click()
  await waitForBranch(page, 'feature')
  await waitForGitText(
    repository,
    ['stash', 'list'],
    /Changes(?:%20| )before(?:%20| )switching/
  )
  assert.equal(
    fs.readFileSync(path.join(repository, 'tracked.txt'), 'utf8'),
    'base\n'
  )

  await requestSwitch(page, 'main')
  await waitForBranch(page, 'main')
  fs.writeFileSync(path.join(repository, 'tracked.txt'), 'bring me\n')
  fs.writeFileSync(path.join(repository, 'untracked.txt'), 'untracked\n')
  await refresh(page)
  await page.getByRole('tab', { name: 'Changes' }).click()
  await page.getByRole('option', { name: /^tracked\.txt\b/ }).waitFor()
  await page.getByRole('option', { name: /^untracked\.txt\b/ }).waitFor()
  await requestSwitch(page, 'feature')
  const bringDialog = page.locator('#stash-changes')
  await bringDialog
    .getByRole('radio', { name: /Bring my changes to feature/ })
    .click()
  await bringDialog
    .getByRole('button', { name: 'Switch Branch', exact: true })
    .click()
  await waitForBranch(page, 'feature')
  assert.equal(
    fs.readFileSync(path.join(repository, 'tracked.txt'), 'utf8'),
    'bring me\n'
  )
  assert.equal(
    fs.readFileSync(path.join(repository, 'untracked.txt'), 'utf8'),
    'untracked\n'
  )

  await requestSwitch(page, 'main')
  const discardRecovery = page.locator('#stash-changes')
  await discardRecovery.waitFor()
  await page.waitForTimeout(300)
  await page.keyboard.press('Escape')
  await discardRecovery.waitFor({ state: 'hidden' })
  assert.equal(git(repository, 'branch', '--show-current'), 'feature')
  assert.equal(
    fs.readFileSync(path.join(repository, 'tracked.txt'), 'utf8'),
    'bring me\n'
  )

  await page
    .locator('.filter-field-row')
    .click({ button: 'right', position: { x: 24, y: 16 } })
  await page
    .locator('#web-context-menu')
    .getByRole('menuitem', { name: 'Discard All Changes…', exact: true })
    .click()
  const discardConfirmation = page
    .getByRole('alertdialog')
    .filter({ hasText: 'Confirm Discard All Changes' })
  await discardConfirmation
    .getByRole('button', { name: 'Discard All', exact: true })
    .click()
  await discardConfirmation.waitFor({ state: 'hidden' })
  await requestSwitch(page, 'main')
  await waitForBranch(page, 'main')
  assert.equal(
    fs.readFileSync(path.join(repository, 'tracked.txt'), 'utf8'),
    'base\n'
  )
  assert.equal(fs.existsSync(path.join(repository, 'untracked.txt')), false)
  assert.ok(root)
}

async function testStashContextMenu(page) {
  const stashRow = page
    .locator('.stashed-changes-button')
    .filter({ hasText: 'option stash' })
  await stashRow.waitFor()
  await stashRow.click({ button: 'right', position: { x: 24, y: 16 } })
  const menu = page.locator('#web-context-menu')
  await menu.waitFor()
  for (const label of ['Rename…', 'Restore Changes', 'Discard'])
    await menu.getByRole('menuitem', { name: label, exact: true }).waitFor()
  await page.keyboard.press('Escape')
  await menu.waitFor({ state: 'hidden' })

  await stashRow.click()
  const stashViewer = page.locator('#stash-diff-viewer')
  await stashViewer.waitFor()
  await stashViewer.getByRole('option').first().waitFor()
  await stashViewer.getByRole('button', { name: 'Close' }).click()
  await stashViewer.waitFor({ state: 'hidden' })
}

async function testHookFailureAndAmend(page, repository) {
  fs.writeFileSync(path.join(repository, 'tracked.txt'), 'hook change\n')
  await refresh(page)
  await page.getByRole('tab', { name: 'Changes' }).click()
  const hook = path.join(repository, '.git', 'hooks', 'pre-commit')
  fs.writeFileSync(hook, '#!/bin/sh\nprintf "hook says no\\n" >&2\nexit 1\n')
  fs.chmodSync(hook, 0o755)

  let commitForm = page.getByRole('group', { name: 'Create commit' })
  await commitForm.getByLabel('Commit summary').fill('hook commit')
  await commitForm.getByRole('button', { name: /Commit .*to main/ }).click()
  const errorDialog = page.locator('#hook-failed-dialog')
  await errorDialog.waitFor()
  assert.match(await errorDialog.innerText(), /hook says no/)
  fs.rmSync(hook)
  await errorDialog
    .getByRole('button', { name: 'Ignore and Continue', exact: true })
    .click()
  await errorDialog.waitFor({ state: 'hidden' })
  await waitForGitText(
    repository,
    ['log', '-1', '--format=%s'],
    /^hook commit$/
  )

  await refresh(page)
  await waitForBranch(page, 'main')
  await page.getByRole('tab', { name: 'History' }).click()
  const commitRow = page.locator('#commit-list .list-item').filter({
    has: page.getByText('hook commit', { exact: true }),
  })
  await commitRow.waitFor()
  await commitRow.click({ button: 'right' })
  const contextMenu = page.locator('#web-context-menu')
  await contextMenu.waitFor()
  const amendAction = contextMenu.getByRole('menuitem', { name: /^Amend/i })
  await amendAction.waitFor()
  await amendAction.click()
  await page.getByRole('tab', { name: 'Changes' }).waitFor()
  commitForm = page.getByRole('group', { name: 'Create commit' })
  await commitForm.getByText(/modify your most recent commit/i).waitFor()
  assert.equal(
    await commitForm.getByLabel('Commit summary').inputValue(),
    'hook commit'
  )
  await commitForm.getByRole('button', { name: 'Stop amending' }).click()
  await commitForm
    .getByText(/modify your most recent commit/i)
    .waitFor({ state: 'hidden' })

  fs.writeFileSync(path.join(repository, 'tracked.txt'), 'amended content\n')
  await refresh(page)
  await page.getByRole('tab', { name: 'History' }).click()
  await commitRow.click({ button: 'right' })
  await page
    .locator('#web-context-menu')
    .getByRole('menuitem', { name: /^Amend/i })
    .click()
  commitForm = page.getByRole('group', { name: 'Create commit' })
  await commitForm.getByLabel('Commit summary').fill('amended hook commit')
  await commitForm
    .getByRole('button', { name: 'Amend last commit', exact: true })
    .click()
  await waitForGitText(
    repository,
    ['log', '-1', '--format=%s'],
    /^amended hook commit$/
  )
  assert.equal(git(repository, 'show', 'HEAD:tracked.txt'), 'amended content')
  await waitForNoBlockingDialog(page)
}

async function testOperationProgressAndCancellation(page, repository) {
  const hookPidPath = path.join(repository, '.git', 'cancel-hook.pid')
  const hook = path.join(repository, '.git', 'hooks', 'pre-commit')
  fs.writeFileSync(path.join(repository, 'tracked.txt'), 'cancelled commit\n')
  await refresh(page)
  await page.getByRole('tab', { name: 'Changes' }).click()
  fs.writeFileSync(
    hook,
    [
      '#!/bin/sh',
      `printf '%s\\n' "$$" > ${shellQuote(hookPidPath)}`,
      'trap "exit 0" TERM INT',
      'while :; do sleep 1; done',
      '',
    ].join('\n')
  )
  fs.chmodSync(hook, 0o755)

  const commitForm = page.getByRole('group', { name: 'Create commit' })
  await commitForm.getByLabel('Commit summary').fill('cancelled commit')
  await commitForm.getByRole('button', { name: /Commit .*to main/ }).click()

  const progress = page.locator('#commit-progress-dialog')
  await progress.waitFor()
  await waitForFile(hookPidPath)
  const hookPid = Number(fs.readFileSync(hookPidPath, 'utf8').trim())
  assert.ok(Number.isInteger(hookPid) && hookPid > 0)
  await progress
    .getByRole('button', { name: 'Close', exact: true })
    .last()
    .click()
  await progress.waitFor({ state: 'hidden' })
  await waitForProcessExit(hookPid)
  assert.notEqual(
    git(repository, 'log', '-1', '--format=%s'),
    'cancelled commit'
  )
  assert.equal(
    fs.readFileSync(path.join(repository, 'tracked.txt'), 'utf8'),
    'cancelled commit\n'
  )
  fs.rmSync(hook, { force: true })
  fs.rmSync(hookPidPath, { force: true })
}

async function testStashOptions(page, repository) {
  fs.writeFileSync(path.join(repository, 'staged.txt'), 'base\n')
  fs.writeFileSync(path.join(repository, 'unstaged.txt'), 'base\n')
  git(repository, 'add', '.')
  git(repository, 'commit', '-m', 'stash base')
  fs.writeFileSync(path.join(repository, 'staged.txt'), 'staged\n')
  git(repository, 'add', 'staged.txt')
  fs.writeFileSync(path.join(repository, 'unstaged.txt'), 'unstaged\n')
  fs.writeFileSync(path.join(repository, 'untracked.txt'), 'untracked\n')
  await refresh(page)
  await page.getByRole('tab', { name: 'Changes' }).click()
  await page
    .locator('.filter-field-row')
    .click({ button: 'right', position: { x: 24, y: 16 } })
  await page
    .locator('#web-context-menu')
    .getByRole('menuitem', { name: 'Stash All Changes', exact: true })
    .click()
  await waitForText(page, '1 stash')
  assert.equal(git(repository, 'status', '--short'), '')
  assert.equal(
    fs.readFileSync(path.join(repository, 'unstaged.txt'), 'utf8'),
    'base\n'
  )
  assert.equal(fs.existsSync(path.join(repository, 'untracked.txt')), false)
  assert.match(
    git(repository, 'stash', 'show', '--include-untracked', '--name-only'),
    /staged\.txt/
  )
  assert.match(
    git(repository, 'stash', 'show', '--include-untracked', '--name-only'),
    /unstaged\.txt/
  )
  assert.match(
    git(repository, 'stash', 'show', '--include-untracked', '--name-only'),
    /untracked\.txt/
  )
  const stashRow = page.locator('.stashed-changes-button')
  await stashRow.click()
  const stashViewer = page.locator('#stash-diff-viewer:visible')
  await stashViewer.getByRole('button', { name: 'Rename stash' }).click()
  const renameDialog = page.locator('#rename-stash:visible')
  await renameDialog.waitFor({ state: 'visible', timeout: 30000 })
  await renameDialog.getByLabel('Name').fill('option stash')
  await renameDialog.getByRole('button', { name: 'Rename Stash' }).click()
  await renameDialog.waitFor({ state: 'hidden' })
  await waitForText(page, 'option stash')
  await testStashContextMenu(page)

  await page
    .locator('.stashed-changes-button')
    .filter({ hasText: 'option stash' })
    .click()
  await stashViewer.getByRole('button', { name: 'Discard' }).click()
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Discard', exact: true })
    .click()
  await page
    .locator('.stashed-changes-button')
    .filter({ hasText: 'option stash' })
    .waitFor({ state: 'hidden' })
  assert.doesNotMatch(git(repository, 'stash', 'list'), /option%20stash/)
}

async function testCommitMetadata(page, repository) {
  await page.getByRole('tab', { name: 'History' }).click()
  await page.getByText('metadata summary', { exact: true }).waitFor()
  const row = page.locator('#commit-list .list-item').filter({
    has: page.getByText('metadata summary', { exact: true }),
  })
  await row.click()
  const rowAvatars = row.locator('.AvatarStack .avatar-container')
  await rowAvatars.first().waitFor()
  assert.ok(
    (await rowAvatars.count()) >= 3,
    'history rows must render author, co-author, and committer avatars'
  )
  await row
    .locator('.commit-attribution-component')
    .getByText('3 people', { exact: true })
    .waitFor()
  await row.dispatchEvent('contextmenu')
  const commitMenu = page.locator('#web-context-menu')
  await commitMenu.waitFor()
  await commitMenu.getByRole('menuitem', { name: 'Copy SHA' }).waitFor()
  await commitMenu.getByRole('menuitem', { name: 'Copy tag' }).waitFor()
  await commitMenu.getByRole('menuitem', { name: 'Copy SHA' }).click()
  assert.equal(
    await page.evaluate(() => navigator.clipboard.readText()),
    git(repository, 'rev-parse', 'HEAD')
  )
  await row.dispatchEvent('contextmenu')
  await page
    .locator('#web-context-menu')
    .getByRole('menuitem', { name: 'Copy tag' })
    .click()
  assert.equal(
    await page.evaluate(() => navigator.clipboard.readText()),
    'metadata-v1'
  )
  await page.getByRole('button', { name: 'Expand commit details' }).click()
  const summary = page.locator('#expandable-commit-summary')
  await summary.getByText('body line one').waitFor()
  await summary.getByText('body line two').waitFor()
  await summary.getByText('metadata-v1', { exact: true }).waitFor()
  const expandedAuthors = summary.locator('.author')
  await expandedAuthors
    .getByText(/Metadata Author <author@example\.com>/)
    .waitFor()
  await expandedAuthors
    .getByText(/Co Author <co-author@example\.com>/)
    .waitFor()
  await expandedAuthors
    .getByText(/Metadata Committer <committer@example\.com>/)
    .waitFor()
}

async function testManageRemotesEntry(page, repository, root) {
  const temporaryRemote = path.join(root, 'managed-remote.git')
  fs.mkdirSync(temporaryRemote)
  git(temporaryRemote, 'init', '--bare')

  await page
    .locator('.branch-toolbar-button')
    .click({ button: 'right', position: { x: 24, y: 16 } })
  const menu = page.locator('#web-context-menu')
  await menu.waitFor()
  await menu
    .getByRole('menuitem', { name: 'Manage Remotes…', exact: true })
    .click()
  const manageRemotes = page.locator('#manage-remotes')
  await manageRemotes.waitFor()
  await manageRemotes
    .getByRole('button', { name: 'New Remote', exact: true })
    .click()

  const addRemote = page.locator('#add-remote')
  await addRemote.waitFor()
  await addRemote.getByLabel('Name').fill('managed')
  await addRemote.getByLabel('URL').fill(temporaryRemote)
  await addRemote
    .getByRole('button', { name: 'Add Remote', exact: true })
    .click()
  await addRemote.waitFor({ state: 'hidden' })
  await manageRemotes.getByText('managed', { exact: true }).waitFor()
  assert.equal(git(repository, 'remote', 'get-url', 'managed'), temporaryRemote)

  await manageRemotes
    .getByRole('button', { name: 'Remove the "managed" remote' })
    .click()
  await manageRemotes.getByText('managed', { exact: true }).waitFor({
    state: 'hidden',
  })
  assert.throws(() => git(repository, 'remote', 'get-url', 'managed'))
  await manageRemotes
    .locator('.dialog-footer')
    .getByRole('button', { name: 'Close', exact: true })
    .click()
  await manageRemotes.waitFor({ state: 'hidden' })
}

async function testWorktreeContextAndPreferences(page, repository, root) {
  const worktreePath = path.join(root, 'context-worktree')
  let preferences = await openPreferencesTab(page, 'Appearance')
  await preferences.getByLabel('Show worktrees in repository list').check()
  await savePreferences(preferences)

  await createWorktree(page, 'main', worktreePath, 'context-worktree-branch')
  await selectRepository(page, repository)
  const { menu } = await openWorktreeContextMenu(page, worktreePath)
  for (const label of [
    'New Worktree…',
    'Rename Worktree…',
    'Copy Worktree Name',
    'Copy Worktree Path',
    'Open Worktree in New Window',
    'Delete Worktree…',
  ])
    await menu.getByRole('menuitem', { name: label, exact: true }).waitFor()
  await menu.getByRole('menuitem', { name: 'Copy Worktree Path' }).click()
  assert.equal(
    await page.evaluate(() => navigator.clipboard.readText()),
    fs.realpathSync(worktreePath)
  )

  preferences = await openPreferencesTab(page, 'Prompts')
  const removingWorktrees = preferences.getByLabel('Removing worktrees')
  assert.equal(await removingWorktrees.isChecked(), true)
  await removingWorktrees.uncheck()
  await page.waitForTimeout(50)
  assert.equal(await removingWorktrees.isChecked(), false)
  await savePreferences(preferences)
  await waitForStorageValue(page, 'confirm-worktree-removal', '0')

  const worktree = await openWorktreeContextMenu(page, worktreePath)
  await worktree.menu
    .getByRole('menuitem', { name: 'Delete Worktree…', exact: true })
    .click()
  await worktree.worktreeRow.waitFor({ state: 'hidden' })
  await waitForPathAbsent(worktreePath)
  assert.doesNotMatch(
    git(repository, 'worktree', 'list'),
    /context-worktree-branch/
  )
}

async function testWorktreeInclude(page, repository, root) {
  const worktreePath = path.join(root, 'included-worktree')
  const preferences = await openPreferencesTab(page, 'Appearance')
  await preferences.getByLabel('Show worktrees in repository list').check()
  await savePreferences(preferences)
  const promptPreferences = await openPreferencesTab(page, 'Prompts')
  await promptPreferences.getByLabel('Removing worktrees').check()
  await savePreferences(promptPreferences)
  await waitForStorageValue(page, 'confirm-worktree-removal', '1')
  const menu = await openBranchContextMenu(page, 'main')
  await menu
    .getByRole('menuitem', {
      name: 'Checkout in New Worktree…',
      exact: true,
    })
    .click()
  const createDialog = page
    .getByRole('dialog')
    .filter({ hasText: 'Add worktree' })
  await createDialog
    .getByLabel('Worktree name')
    .fill(path.basename(worktreePath))
  await createDialog.getByLabel('Local path').fill(path.dirname(worktreePath))
  await createDialog.getByLabel('Branch name').fill('included-worktree-branch')
  await createDialog.getByRole('button', { name: 'Create worktree' }).click()
  await createDialog.waitFor({ state: 'hidden' })
  await waitForGitText(
    worktreePath,
    ['branch', '--show-current'],
    /^included-worktree-branch$/
  )
  assert.equal(
    fs.readFileSync(path.join(worktreePath, 'local', 'settings.json'), 'utf8'),
    '{"included":true}\n'
  )
  await selectRepository(page, repository)
  const worktree = await openWorktreeContextMenu(page, worktreePath)
  await worktree.menu
    .getByRole('menuitem', { name: 'Delete Worktree…', exact: true })
    .click()
  const deleteConfirmation = page
    .getByRole('alertdialog')
    .filter({ hasText: 'Delete worktree' })
  if (await deleteConfirmation.isVisible().catch(() => false))
    await deleteConfirmation
      .getByRole('button', { name: 'Delete', exact: true })
      .click()
  await waitForPathAbsent(worktreePath)
  assert.doesNotMatch(
    git(repository, 'worktree', 'list'),
    /included-worktree-branch/
  )
}

async function testPushedTagDeletion(page, repository, remote) {
  git(repository, 'remote', 'add', 'origin', remote)
  git(repository, 'push', '-u', 'origin', 'main')
  git(repository, 'tag', '-a', 'release-v1', '-m', 'release v1')
  await refresh(page)
  await testManageRemotesEntry(page, repository, path.dirname(remote))
  await page.getByRole('tab', { name: 'History' }).click()
  const commitRow = page.locator('#commit-list .list-item').filter({
    has: page.getByText('initial', { exact: true }),
  })
  await commitRow.click({ button: 'right', position: { x: 24, y: 16 } })
  await page
    .locator('#web-context-menu')
    .getByRole('menuitem', { name: 'Create Tag…', exact: true })
    .click()
  const tagDialog = page.getByRole('dialog').filter({ hasText: 'Create a tag' })
  await tagDialog.getByLabel('Name').fill('release-v2')
  await tagDialog.getByRole('button', { name: 'Create tag' }).click()
  await tagDialog.waitFor({ state: 'hidden' })
  git(repository, 'push', 'origin', 'refs/tags/release-v2')
  assert.ok(hasRemoteTag(remote, 'release-v2'))
  await refresh(page)
  await page.getByRole('tab', { name: 'History' }).click()
  const taggedRow = page.locator('#commit-list .list-item').filter({
    has: page.getByText('initial', { exact: true }),
  })
  await taggedRow.click({ button: 'right', position: { x: 24, y: 16 } })
  await page
    .locator('#web-context-menu')
    .getByRole('menuitem', { name: 'Delete tag release-v2', exact: true })
    .click()
  const deleteDialog = page.getByRole('alertdialog').filter({
    hasText: 'This tag has already been pushed to the remote',
  })
  await deleteDialog.waitFor({ state: 'visible', timeout: 5000 })
  await deleteDialog.getByRole('button', { name: 'Delete' }).click()
  await deleteDialog.waitFor({ state: 'hidden' })
  assert.throws(() =>
    git(repository, 'show-ref', '--verify', 'refs/tags/release-v2')
  )
  assert.ok(hasRemoteTag(remote, 'release-v2'))
}

async function main() {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'desktop-plus-local-evidence-')
  )
  const repository = createRepository(root, 'repository')
  const stashRepository = createRepository(root, 'stash-repository')
  const metadataRepository = createRepository(root, 'metadata-repository')
  const worktreeIncludeRepository = createRepository(
    root,
    'worktree-include-repository'
  )
  const tagRemote = path.join(root, 'tag-remote.git')
  git(repository, 'config', 'user.name', 'Source Local Evidence')
  git(stashRepository, 'config', 'user.name', 'Source Local Evidence')
  git(metadataRepository, 'config', 'user.name', 'Source Local Evidence')
  git(
    metadataRepository,
    'config',
    'user.email',
    'source-local-evidence@example.com'
  )
  fs.writeFileSync(path.join(metadataRepository, 'metadata.txt'), 'metadata\n')
  git(metadataRepository, 'add', 'metadata.txt')
  gitWithEnv(
    metadataRepository,
    {
      GIT_AUTHOR_NAME: 'Metadata Author',
      GIT_AUTHOR_EMAIL: 'author@example.com',
      GIT_COMMITTER_NAME: 'Metadata Committer',
      GIT_COMMITTER_EMAIL: 'committer@example.com',
    },
    'commit',
    '-m',
    'metadata summary\n\nbody line one\nbody line two\n\nReviewed-by: Reviewer <reviewer@example.com>\nCo-authored-by: Co Author <co-author@example.com>'
  )
  git(metadataRepository, 'tag', '-a', 'metadata-v1', '-m', 'metadata tag')
  fs.writeFileSync(
    path.join(worktreeIncludeRepository, '.gitignore'),
    'local/*.json\n'
  )
  fs.writeFileSync(
    path.join(worktreeIncludeRepository, '.worktreeinclude'),
    '# Included local files\nlocal/**\n'
  )
  fs.mkdirSync(path.join(worktreeIncludeRepository, 'local'))
  fs.writeFileSync(
    path.join(worktreeIncludeRepository, 'local', 'settings.json'),
    '{"included":true}\n'
  )
  git(worktreeIncludeRepository, 'add', '.gitignore', '.worktreeinclude')
  git(worktreeIncludeRepository, 'commit', '-m', 'configure worktree include')
  fs.mkdirSync(tagRemote)
  git(tagRemote, 'init', '--bare')

  const server = createServer({
    getDesktopRepositories: async () => [],
    moveToTrash: async target => {
      await fs.promises.rm(target, { recursive: true, force: true })
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
    await addRepository(page, repository)
    await testCheckoutRecovery(page, repository, root)
    await testHookFailureAndAmend(page, repository)
    const operationPage = await browser.newPage()
    try {
      await operationPage.goto(`http://127.0.0.1:${server.address().port}`, {
        waitUntil: 'networkidle',
      })
      await addRepository(operationPage, repository)
      await testOperationProgressAndCancellation(operationPage, repository)
    } finally {
      await operationPage.close()
    }

    const stashPage = await browser.newPage()
    await stashPage.goto(`http://127.0.0.1:${server.address().port}`, {
      waitUntil: 'networkidle',
    })
    await addRepository(stashPage, stashRepository)
    await grantClipboard(stashPage, `http://127.0.0.1:${server.address().port}`)
    await testStashOptions(stashPage, stashRepository)

    const metadataPage = await browser.newPage()
    await metadataPage.goto(`http://127.0.0.1:${server.address().port}`, {
      waitUntil: 'networkidle',
    })
    await addRepository(metadataPage, metadataRepository)
    await grantClipboard(
      metadataPage,
      `http://127.0.0.1:${server.address().port}`
    )
    await testCommitMetadata(metadataPage, metadataRepository)

    const tagPage = await browser.newPage()
    await tagPage.goto(`http://127.0.0.1:${server.address().port}`, {
      waitUntil: 'networkidle',
    })
    await addRepository(tagPage, repository)
    await grantClipboard(tagPage, `http://127.0.0.1:${server.address().port}`)
    await testPushedTagDeletion(tagPage, repository, tagRemote)
    await testWorktreeContextAndPreferences(tagPage, repository, root)

    const includePage = await browser.newPage()
    await includePage.goto(`http://127.0.0.1:${server.address().port}`, {
      waitUntil: 'networkidle',
    })
    await addRepository(includePage, worktreeIncludeRepository)
    await testWorktreeInclude(includePage, worktreeIncludeRepository, root)

    assert.deepEqual(errors, [])
    console.log(
      'Source local evidence passed: checkout recovery, hook failure output, amend/stop-amending, operation progress cancellation, history attribution, stash options, and pushed-tag deletion'
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
