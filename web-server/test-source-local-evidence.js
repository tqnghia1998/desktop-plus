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
  }
  await page.getByLabel('Local path').fill(repository)
  await page.getByRole('button', { name: 'Add repository' }).click()
  await page.locator('.branch-toolbar-button').waitFor()
  await waitForBranch(page, 'main')
  await waitForNoBlockingDialog(page)
}

async function refresh(page) {
  await waitForNoBlockingDialog(page)
  await page.getByRole('tab', { name: 'Tools' }).click()
  const tools = page.getByRole('region', { name: 'Repository tools' })
  await tools.getByRole('button', { name: 'Refresh repository' }).click()
  await page.waitForFunction(
    () =>
      document.querySelector('.web-tools-panel')?.getAttribute('aria-busy') ===
        'false' &&
      Array.from(document.querySelectorAll('dialog[open]')).every(dialog => {
        const style = window.getComputedStyle(dialog)
        return (
          style.display === 'none' ||
          style.visibility === 'hidden' ||
          dialog.getBoundingClientRect().width === 0
        )
      })
  )
  return tools
}

async function openBranchMenu(page) {
  const branchButton = page
    .locator('.branch-toolbar-button')
    .getByRole('button')
    .last()
  await branchButton.focus()
  await branchButton.press('Enter')
  await page.getByRole('button', { name: 'Create branch' }).waitFor()
}

async function requestSwitch(page, branch) {
  await openBranchMenu(page)
  const actionMenu = page
    .locator('.branch-toolbar-button')
    .locator('.web-toolbar-menu')
    .first()
  await actionMenu
    .getByRole('button', { name: `Switch to ${branch}`, exact: true })
    .click()
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
  await requestSwitch(page, 'feature')
  const recovery = page.getByRole('alertdialog').filter({
    hasText: 'Changes prevent checkout',
  })
  await recovery.waitFor()
  await recovery.getByRole('button', { name: 'Cancel', exact: true }).click()
  await recovery.waitFor({ state: 'hidden' })
  assert.equal(git(repository, 'branch', '--show-current'), 'main')
  assert.equal(
    fs.readFileSync(path.join(repository, 'tracked.txt'), 'utf8'),
    'cancelled change\n'
  )

  await requestSwitch(page, 'feature')
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Leave changes here', exact: true })
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
  await requestSwitch(page, 'feature')
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Bring changes to branch', exact: true })
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
  const discardRecovery = page.getByRole('alertdialog').filter({
    hasText: 'Changes prevent checkout',
  })
  await discardRecovery.waitFor()
  const finalDiscardRecovery = page.getByRole('alertdialog').filter({
    hasText: 'Changes prevent checkout',
  })
  await finalDiscardRecovery
    .getByRole('button', { name: 'Discard and switch', exact: true })
    .click()
  const discardConfirmation = page.getByRole('alertdialog').filter({
    hasText: 'Discard all uncommitted changes',
  })
  try {
    await discardConfirmation.waitFor()
  } catch (error) {
    throw new Error(
      `${error.message}\nBody:\n${await page
        .locator('body')
        .innerText()}\nDialogs:\n${await page
        .getByRole('dialog')
        .allTextContents()}`
    )
  }
  await discardConfirmation
    .getByRole('button', {
      name: 'Cancel',
      exact: true,
    })
    .click()
  await discardConfirmation.waitFor({ state: 'hidden' })
  assert.equal(git(repository, 'branch', '--show-current'), 'feature')
  assert.equal(
    fs.readFileSync(path.join(repository, 'tracked.txt'), 'utf8'),
    'bring me\n'
  )

  await discardRecovery
    .getByRole('button', { name: 'Discard and switch', exact: true })
    .click()
  await page
    .getByRole('alertdialog')
    .filter({ hasText: 'Discard all uncommitted changes' })
    .getByRole('button', { name: 'Discard and switch', exact: true })
    .click()
  await waitForBranch(page, 'main')
  assert.equal(
    fs.readFileSync(path.join(repository, 'tracked.txt'), 'utf8'),
    'base\n'
  )
  assert.equal(fs.existsSync(path.join(repository, 'untracked.txt')), false)
  assert.ok(root)
}

async function testStashContextMenu(page, repository) {
  const tools = page.getByRole('region', { name: 'Repository tools' })
  const stashRow = tools
    .locator('.web-tool-row')
    .filter({ hasText: 'option stash on main' })
  await stashRow.waitFor()
  await stashRow.dispatchEvent('contextmenu')
  const menu = page.locator('#web-context-menu')
  await menu.waitFor()
  for (const label of [
    'Inspect stash',
    'Copy stash SHA',
    'Copy stash name',
    'Copy branch name',
    'Apply stash',
    'Pop stash',
    'Rename stash',
    'Drop stash',
  ])
    await menu.getByRole('menuitem', { name: label, exact: true }).waitFor()
  await menu.getByRole('menuitem', { name: 'Copy stash SHA' }).click()
  assert.equal(
    await page.evaluate(() => navigator.clipboard.readText()),
    git(repository, 'rev-parse', 'refs/stash')
  )

  await stashRow.dispatchEvent('contextmenu')
  await page
    .locator('#web-context-menu')
    .getByRole('menuitem', { name: 'Inspect stash' })
    .click()
  await page.getByRole('region', { name: 'Stash inspection' }).waitFor()
  await page
    .getByRole('region', { name: 'Stash inspection' })
    .getByRole('button', { name: 'Close' })
    .click()
}

async function testHookFailureAndAmend(page, repository) {
  fs.writeFileSync(path.join(repository, 'tracked.txt'), 'hook change\n')
  await refresh(page)
  await page.getByRole('tab', { name: 'Changes' }).click()
  const hook = path.join(repository, '.git', 'hooks', 'pre-commit')
  fs.writeFileSync(hook, '#!/bin/sh\nprintf "hook says no\\n" >&2\nexit 1\n')
  fs.chmodSync(hook, 0o755)

  await page
    .locator('.web-changes-actions')
    .getByRole('button', { name: 'Commit', exact: true })
    .click()
  const commitDialog = page.getByRole('dialog').filter({
    hasText: 'Commit changes',
  })
  await commitDialog.getByLabel('Commit message').fill('hook commit')
  await commitDialog
    .getByRole('button', {
      name: 'Commit changes',
      exact: true,
    })
    .click()
  const errorDialog = page.getByRole('dialog').filter({
    hasText: 'hook says no',
  })
  await errorDialog.waitFor()
  await errorDialog
    .getByText('pre-commit hook output', {
      exact: true,
    })
    .waitFor()
  assert.match(await errorDialog.innerText(), /hook says no/)
  fs.rmSync(hook)
  await errorDialog.getByRole('button', { name: 'Retry', exact: true }).click()
  await errorDialog.waitFor({ state: 'hidden' })
  await waitForGitText(
    repository,
    ['log', '-1', '--format=%s'],
    /^hook commit$/
  )

  await page.getByRole('tab', { name: 'Tools' }).click()
  const refreshedTools = page.locator('.web-tools-panel')
  await refreshedTools
    .getByRole('button', { name: 'Refresh repository' })
    .click()
  await page.waitForFunction(
    () =>
      document.querySelector('.web-tools-panel')?.getAttribute('aria-busy') ===
        'false' &&
      document.querySelector('.branch-toolbar-button .title')?.textContent ===
        'main'
  )
  await page.getByRole('tab', { name: 'History' }).click()
  const commitRow = page.locator('#commit-list .list-item').filter({
    has: page.getByText('hook commit', { exact: true }),
  })
  await commitRow.waitFor()
  await commitRow.click({ button: 'right' })
  const contextMenu = page.locator('#web-context-menu')
  await contextMenu.waitFor()
  const amendAction = contextMenu
    .locator('button')
    .filter({ hasText: /^Amend/i })
  await amendAction.waitFor()
  await amendAction.click()
  const amendDialog = page.getByRole('dialog').filter({
    hasText: 'Commit changes',
  })
  try {
    await amendDialog.getByText(/Amending .*hook commit/).waitFor()
  } catch (error) {
    throw new Error(
      `${error.message}\nBody:\n${await page
        .locator('body')
        .innerText()}\nDialogs:\n${await page
        .getByRole('dialog')
        .allTextContents()}`
    )
  }
  assert.equal(
    await amendDialog.getByLabel('Commit message').inputValue(),
    'hook commit'
  )
  await amendDialog.getByRole('button', { name: 'Stop amending' }).click()
  await amendDialog.getByText(/Amending /).waitFor({ state: 'hidden' })
  await amendDialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await amendDialog.waitFor({ state: 'hidden' })

  fs.writeFileSync(path.join(repository, 'tracked.txt'), 'amended content\n')
  await refresh(page)
  await page.getByRole('tab', { name: 'History' }).click()
  await commitRow.click({ button: 'right' })
  await page
    .locator('#web-context-menu')
    .locator('button')
    .filter({ hasText: /^Amend/i })
    .click()
  const actualAmendDialog = page.getByRole('dialog').filter({
    hasText: 'Commit changes',
  })
  await actualAmendDialog
    .getByLabel('Commit message')
    .fill('amended hook commit')
  await actualAmendDialog.getByRole('button', { name: 'Amend commit' }).click()
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

  await page
    .locator('.web-changes-actions')
    .getByRole('button', { name: 'Commit', exact: true })
    .click()
  const commitDialog = page.getByRole('dialog').filter({
    hasText: 'Commit changes',
  })
  await commitDialog.getByLabel('Commit message').fill('cancelled commit')
  await commitDialog
    .getByRole('button', { name: 'Commit changes', exact: true })
    .click()

  const progress = page.getByRole('region', {
    name: 'Git operation progress',
  })
  await progress.waitFor()
  await progress.getByRole('button', { name: 'Cancel Git operation' }).waitFor()
  await waitForFile(hookPidPath)
  const hookPid = Number(fs.readFileSync(hookPidPath, 'utf8').trim())
  assert.ok(Number.isInteger(hookPid) && hookPid > 0)
  await progress.getByRole('button', { name: 'Cancel Git operation' }).click()
  await progress.getByText(/commit cancelled/i).waitFor()
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
  const tools = await refresh(page)
  await tools.getByRole('button', { name: 'Create stash', exact: true }).click()
  const stashDialog = page.getByRole('dialog').filter({
    hasText: 'Create stash',
  })
  await stashDialog.getByLabel('Message').fill('option stash')
  await stashDialog.getByLabel('Include untracked files').check()
  await stashDialog.getByLabel('Keep staged changes staged').check()
  await stashDialog.getByRole('button', { name: 'Create stash' }).click()
  await waitForText(page, 'option stash on main')
  assert.match(git(repository, 'status', '--short'), /^M  staged\.txt$/m)
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
  await testStashContextMenu(page, repository)

  const preferencesButton = page.getByRole('button', {
    name: 'Open preferences',
  })
  await preferencesButton.click()
  const preferences = page
    .getByRole('dialog')
    .filter({ hasText: 'Preferences' })
  await preferences.getByLabel('Confirm stash apply, pop, and drop').uncheck()
  await preferences
    .getByRole('button', { name: 'Close', exact: true })
    .last()
    .click()
  await preferences.waitFor({ state: 'hidden' })

  const stashRow = tools
    .locator('.web-tool-row')
    .filter({ hasText: 'option stash on main' })
  await stashRow.getByRole('button', { name: 'Drop' }).click()
  await waitForText(page, 'option stash on main', 'hidden')
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
  const details = page.getByRole('region', { name: 'Commit details' })
  await details.waitFor()
  const metadata = details.locator('[aria-label="Commit metadata"]')
  await metadata
    .getByText(/Author: Metadata Author <author@example\.com>/)
    .waitFor()
  await metadata
    .getByText(/Committer: Metadata Committer <committer@example\.com>/)
    .waitFor()
  await metadata.getByText('Tags: metadata-v1').waitFor()
  await metadata.getByText('Commit body', { exact: true }).click()
  await metadata.getByText('body line one').waitFor()
  await metadata.getByText('body line two').waitFor()
  await metadata.getByText('Commit trailers', { exact: true }).click()
  const trailers = metadata.locator('details').filter({
    hasText: 'Commit trailers',
  })
  await trailers
    .locator('li')
    .getByText('Reviewed-by: Reviewer <reviewer@example.com>', { exact: true })
    .waitFor()
  await trailers
    .locator('li')
    .getByText('Co-authored-by: Co Author <co-author@example.com>', {
      exact: true,
    })
    .waitFor()
  await page
    .locator('#history')
    .getByRole('button', { name: 'Expand commit details' })
    .click()
  const expandedAuthors = page.locator(
    '#history #expandable-commit-summary .author'
  )
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

async function testRemoteContextMenu(page, repository, remoteName) {
  const tools = page.getByRole('region', { name: 'Repository tools' })
  const remotes = tools.getByRole('region', { name: 'Remotes and tags' })
  const remoteRow = remotes
    .locator('.web-tool-row')
    .filter({ hasText: `${remoteName}:` })
  await remoteRow.waitFor()
  await remoteRow.dispatchEvent('contextmenu')
  const menu = page.locator('#web-context-menu')
  await menu.waitFor()
  await menu.getByRole('menuitem', { name: 'Copy remote URL' }).waitFor()
  await menu.getByRole('menuitem', { name: 'Open remote in browser' }).waitFor()
  await menu.getByRole('menuitem', { name: 'Set remote URL' }).waitFor()
  await menu.getByRole('menuitem', { name: 'Remove remote' }).waitFor()
  assert.equal(
    await menu
      .getByRole('menuitem', { name: 'Open remote in browser' })
      .isDisabled(),
    true
  )
  await menu.getByRole('menuitem', { name: 'Copy remote URL' }).click()
  assert.equal(
    await page.evaluate(() => navigator.clipboard.readText()),
    git(repository, 'remote', 'get-url', remoteName)
  )

  await remoteRow.dispatchEvent('contextmenu')
  await page
    .locator('#web-context-menu')
    .getByRole('menuitem', { name: 'Set remote URL' })
    .click()
  const setDialog = page
    .getByRole('dialog')
    .filter({ hasText: 'Set remote URL' })
  await setDialog.waitFor()
  await setDialog.getByLabel('Remote name').fill(remoteName)
  await setDialog
    .getByLabel('Remote URL')
    .fill(git(repository, 'remote', 'get-url', remoteName))
  await setDialog.getByRole('button', { name: 'Set URL' }).click()
  await setDialog.waitFor({ state: 'hidden' })

  await remoteRow.dispatchEvent('contextmenu')
  await page
    .locator('#web-context-menu')
    .getByRole('menuitem', { name: 'Remove remote' })
    .click()
  const removeDialog = page.getByRole('alertdialog').filter({
    hasText: 'Remove this remote configuration',
  })
  await removeDialog.waitFor()
  await removeDialog.getByRole('button', { name: 'Remove remote' }).click()
  await remoteRow.waitFor({ state: 'hidden' })
  assert.doesNotMatch(
    git(repository, 'remote'),
    new RegExp(`^${remoteName}$`, 'm')
  )
}

async function testWorktreeContextAndPreferences(page, repository, root) {
  const worktreePath = path.join(root, 'context-worktree')
  const tools = await refresh(page)
  await tools.getByRole('button', { name: 'Create worktree' }).click()
  const createDialog = page
    .getByRole('dialog')
    .filter({ hasText: 'Create a linked worktree' })
  await createDialog.getByLabel('Worktree path').fill(worktreePath)
  await createDialog.getByLabel('New branch').fill('context-worktree-branch')
  await createDialog.getByRole('button', { name: 'Create worktree' }).click()
  await tools.getByText(worktreePath, { exact: false }).waitFor()

  const worktreeRow = tools
    .locator('.web-tool-row')
    .filter({ hasText: worktreePath })
  await worktreeRow.dispatchEvent('contextmenu')
  const menu = page.locator('#web-context-menu')
  await menu.waitFor()
  for (const label of [
    'Open worktree in new window',
    'Copy worktree name',
    'Copy worktree path',
    'Rename worktree',
    'Remove worktree',
  ])
    await menu.getByRole('menuitem', { name: label, exact: true }).waitFor()
  await menu.getByRole('menuitem', { name: 'Copy worktree path' }).click()
  assert.equal(
    await page.evaluate(() => navigator.clipboard.readText()),
    worktreePath
  )

  const preferencesButton = page.getByRole('button', {
    name: 'Open preferences',
  })
  await preferencesButton.click()
  const preferences = page
    .getByRole('dialog')
    .filter({ hasText: 'Preferences' })
  const confirmRemoval = preferences.getByLabel('Confirm worktree removal')
  await confirmRemoval.uncheck()
  await preferences
    .getByRole('button', { name: 'Close', exact: true })
    .last()
    .click()
  await preferences.waitFor({ state: 'hidden' })

  await worktreeRow.getByRole('button', { name: 'Remove' }).click()
  await worktreeRow.waitFor({ state: 'hidden' })
  assert.equal(fs.existsSync(worktreePath), false)
  assert.doesNotMatch(
    git(repository, 'worktree', 'list'),
    /context-worktree-branch/
  )
}

async function testWorktreeInclude(page, repository, root) {
  const tools = await refresh(page)
  await tools.getByRole('button', { name: 'Create worktree' }).click()
  const createDialog = page
    .getByRole('dialog')
    .filter({ hasText: 'Create a linked worktree' })
  await createDialog
    .getByRole('status')
    .getByText(/This repository has 1 .*\.worktreeinclude.*pattern/)
    .waitFor()
  const worktreePath = path.join(root, 'included-worktree')
  await createDialog.getByLabel('Worktree path').fill(worktreePath)
  await createDialog.getByLabel('New branch').fill('included-worktree-branch')
  await createDialog.getByRole('button', { name: 'Create worktree' }).click()
  await tools.getByText(worktreePath, { exact: false }).waitFor()
  await waitForGitText(
    worktreePath,
    ['branch', '--show-current'],
    /^included-worktree-branch$/
  )
  assert.equal(
    fs.readFileSync(path.join(worktreePath, 'local', 'settings.json'), 'utf8'),
    '{"included":true}\n'
  )
  await tools
    .locator('.web-tool-row')
    .filter({ hasText: worktreePath })
    .getByRole('button', { name: 'Remove' })
    .click()
  await confirm(page, 'Remove worktree')
  assert.equal(fs.existsSync(worktreePath), false)
  assert.doesNotMatch(
    git(repository, 'worktree', 'list'),
    /included-worktree-branch/
  )
}

async function testPushedTagDeletion(page, repository, remote) {
  git(repository, 'remote', 'add', 'origin', remote)
  git(repository, 'remote', 'add', 'backup', remote)
  git(repository, 'push', '-u', 'origin', 'main')
  git(repository, 'tag', '-a', 'release-v1', '-m', 'release v1')
  const tools = await refresh(page)
  await testRemoteContextMenu(page, repository, 'backup')
  await tools.getByRole('button', { name: 'Create tag', exact: true }).click()
  const tagDialog = page.getByRole('dialog').filter({ hasText: 'Create tag' })
  await tagDialog.getByLabel('Tag name').fill('release-v2')
  await tagDialog.getByLabel('Tag message').fill('release v2')
  await tagDialog.getByRole('button', { name: 'Create tag' }).click()
  const tagRow = tools
    .locator('.web-tool-row')
    .filter({ hasText: 'release-v2' })
  await tagRow.getByText(/release-v2 \(local only\)/).waitFor()
  await tagRow.getByRole('button', { name: 'Push tag' }).click()
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      if (hasRemoteTag(remote, 'release-v2')) break
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  assert.ok(hasRemoteTag(remote, 'release-v2'))
  await tools.getByRole('button', { name: 'Refresh repository' }).click()
  await tagRow.getByText(/release-v2 \(pushed to origin\)/).waitFor()
  await tagRow.getByRole('button', { name: 'Delete' }).click()
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Delete local tag' })
    .click()
  const remoteDelete = page.getByRole('alertdialog').filter({
    hasText: 'Delete pushed tag remotely',
  })
  await remoteDelete.waitFor()
  await remoteDelete.getByRole('button', { name: 'Delete remote tag' }).click()
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      hasRemoteTag(remote, 'release-v2')
    } catch {
      return
    }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  assert.throws(() => hasRemoteTag(remote, 'release-v2'))
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
