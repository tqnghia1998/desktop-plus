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

async function waitForHistory(page, summary) {
  await page
    .locator('#commit-list .list-item')
    .filter({ has: page.getByText(summary, { exact: true }) })
    .first()
    .waitFor()
}

async function changeHistoryMode(page, button) {
  if ((await button.getAttribute('aria-pressed')) !== 'true') {
    await button.click()
  }
  await page.waitForFunction(
    element => element?.getAttribute('aria-pressed') === 'true',
    await button.elementHandle()
  )
}

async function selectCommit(page, summary, waitForFiles = true) {
  const commit = page.locator('#commit-list .list-item').filter({
    has: page.getByText(summary, { exact: true }),
  })
  await commit.first().waitFor()
  await commit.first().click()
  await page.waitForFunction(
    element => element?.getAttribute('aria-selected') === 'true',
    await commit.first().elementHandle()
  )
  if (waitForFiles)
    await page.locator('#commit-list .list-item').first().waitFor()
  return commit.first()
}

async function openCommitMenu(page, commit) {
  await commit.click({ button: 'right' })
  const menu = page.locator('#web-context-menu')
  await menu.waitFor()
  return menu
}

function waitForTerminalOperation(page) {
  return page.waitForResponse(async response => {
    if (
      !/\/api\/git\/operations\/[^/]+$/.test(response.url()) ||
      response.request().method() !== 'GET' ||
      response.status() !== 200
    )
      return false
    const body = await response.json()
    return body.status === 'completed' || body.status === 'failed'
  })
}

async function runCommitAction(page, commit, name) {
  const operation = waitForTerminalOperation(page)
  const menu = await openCommitMenu(page, commit)
  await menu.getByRole('menuitem', { name }).click()
  await operation
  await page.waitForLoadState('networkidle')
}

async function resetToCommit(page, commit) {
  const operation = waitForTerminalOperation(page)
  const menu = await openCommitMenu(page, commit)
  await menu.getByRole('menuitem', { name: /Reset to commit/i }).click()
  const resetDialog = page.getByRole('alertdialog')
  const outcome = await Promise.race([
    resetDialog.waitFor().then(() => 'dialog'),
    operation.then(() => 'operation'),
  ])
  if (outcome === 'dialog') {
    await resetDialog.getByRole('button', { name: /Reset/i }).click()
    await operation
    await resetDialog.waitFor({ state: 'hidden' })
  }
  await page.waitForLoadState('networkidle')
}

async function confirm(page, buttonName) {
  const confirmation = page.getByRole('alertdialog')
  await confirmation.waitFor()
  await confirmation.getByRole('button', { name: buttonName }).click()
  await confirmation.waitFor({ state: 'hidden' })
}

async function waitForConflictRecovery(page) {
  await page.waitForFunction(() =>
    [...document.querySelectorAll('button')].some(
      button =>
        button.textContent?.trim() === 'Close' ||
        button.getAttribute('aria-label') === 'File resolution options'
    )
  )
  const error = page
    .getByRole('alertdialog')
    .filter({ has: page.getByRole('button', { name: 'Close', exact: true }) })
  if (await error.isVisible().catch(() => false)) {
    await page.waitForTimeout(300)
    await error.getByText('Close', { exact: true }).click()
    await error.waitFor({ state: 'hidden' })
  }
  const conflicts = page.locator('#conflicts-dialog')
  await conflicts.waitFor()
  return conflicts
}

async function addRepository(page, repository) {
  const canonicalRepository = fs.realpathSync(repository)
  const addButton = page.getByRole('button', {
    name: /Add an Existing Repository from your local drive…/i,
  })
  if (await addButton.isVisible().catch(() => false)) {
    await addButton.click()
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
  await page.waitForFunction(
    expected => window.__DESKTOP_PLUS_WEB_REPOSITORY_PATH__ === expected,
    canonicalRepository
  )
}

async function main() {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'desktop-plus-source-history-')
  )
  const repository = path.join(root, 'repository')
  fs.mkdirSync(repository)
  const canonicalRepository = fs.realpathSync(repository)
  git(repository, 'init', '-b', 'main')
  git(repository, 'config', 'user.name', 'Source History')
  git(repository, 'config', 'user.email', 'source-history@example.com')
  fs.writeFileSync(path.join(repository, 'file.txt'), 'base\n')
  fs.writeFileSync(path.join(repository, 'other.txt'), 'base other\n')
  git(repository, 'add', 'file.txt')
  git(repository, 'add', 'other.txt')
  git(repository, 'commit', '-m', 'base')
  fs.writeFileSync(path.join(repository, 'file.txt'), 'changed\n')
  fs.writeFileSync(path.join(repository, 'other.txt'), 'changed other\n')
  git(repository, 'add', 'file.txt', 'other.txt')
  git(repository, 'commit', '-m', 'change')

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
    await page.getByRole('tab', { name: 'History' }).click()
    await waitForHistory(page, 'change')

    const graphViewButton = page.getByRole('button', { name: 'Graph view' })
    const listViewButton = page.getByRole('button', { name: 'List view' })
    await changeHistoryMode(page, graphViewButton)
    const historyRefs = page.locator('#commitGraph-branches-pane')
    await historyRefs.waitFor()
    await historyRefs.getByRole('group', { name: 'Local branches' }).waitFor()
    await page.getByRole('button', { name: 'Collapse Local branches' }).click()
    await page.getByRole('button', { name: 'Expand Local branches' }).waitFor()
    await changeHistoryMode(page, listViewButton)
    await page.getByRole('button', { name: 'List view' }).waitFor()
    await waitForHistory(page, 'change')
    await changeHistoryMode(page, graphViewButton)
    await historyRefs.waitFor()
    await page.getByRole('button', { name: 'Expand Local branches' }).waitFor()
    await waitForHistory(page, 'change')
    await changeHistoryMode(page, listViewButton)
    await waitForHistory(page, 'change')

    const changeCommit = await selectCommit(page, 'change')
    const changeSHA = git(repository, 'rev-parse', 'HEAD')
    let commitMenu = await openCommitMenu(page, changeCommit)
    await commitMenu.getByRole('menuitem', { name: 'Copy SHA' }).click()
    assert.equal(
      await page.evaluate(() => navigator.clipboard.readText()),
      changeSHA
    )
    const commitDetails = page.locator('#history')
    const file = commitDetails.getByRole('option', {
      name: 'file.txt Modified',
    })
    const otherFile = commitDetails.getByRole('option', {
      name: 'other.txt Modified',
    })
    await file.waitFor()
    await file.click()
    await otherFile.click({ modifiers: ['Meta'] })
    await otherFile.click({ button: 'right' })
    const contextMenu = page.getByRole('menu')
    await contextMenu.getByRole('menuitem', { name: 'Copy Paths' }).click()
    assert.equal(
      await page.evaluate(() => navigator.clipboard.readText()),
      `${path.join(canonicalRepository, 'file.txt')}\n${path.join(
        canonicalRepository,
        'other.txt'
      )}`
    )
    await otherFile.click({ button: 'right' })
    await contextMenu
      .getByRole('menuitem', { name: 'Copy Relative Paths' })
      .click()
    assert.equal(
      await page.evaluate(() => navigator.clipboard.readText()),
      'file.txt\nother.txt'
    )
    const historyDiff = page.locator('#history .side-by-side-diff')
    await historyDiff.filter({ hasText: 'changed' }).waitFor()
    const commitDetailsText = await commitDetails.innerText()
    assert.match(commitDetailsText, /(?:^|\n)\+2(?:\n|$)/)
    assert.match(commitDetailsText, /(?:^|\n)-2(?:\n|$)/)
    assert.match(await historyDiff.innerText(), /changed/)
    await runCommitAction(page, changeCommit, /Revert changes in commit/i)
    assert.match(git(repository, 'log', '-1', '--format=%s'), /^Revert /)
    assert.equal(
      fs.readFileSync(path.join(repository, 'file.txt'), 'utf8'),
      'base\n'
    )

    await page.reload({ waitUntil: 'networkidle' })
    await page.getByRole('tab', { name: 'History' }).click()
    await waitForHistory(page, 'base')
    const baseCommit = await selectCommit(page, 'base', false)
    await resetToCommit(page, baseCommit)
    assert.equal(git(repository, 'log', '-1', '--format=%s'), 'base')
    assert.equal(
      fs.readFileSync(path.join(repository, 'file.txt'), 'utf8'),
      'base\n'
    )

    fs.writeFileSync(path.join(repository, 'file.txt'), 'post-base\n')
    git(repository, 'commit', '-am', 'post-base')
    const postBaseSHA = git(repository, 'rev-parse', 'HEAD')
    fs.writeFileSync(path.join(repository, 'file.txt'), 'hard reset me\n')
    await page.reload({ waitUntil: 'networkidle' })
    await page.getByRole('tab', { name: 'History' }).click()
    await waitForHistory(page, 'post-base')
    const hardResetCommit = await selectCommit(page, 'base', false)
    await resetToCommit(page, hardResetCommit)
    assert.notEqual(git(repository, 'rev-parse', 'HEAD'), postBaseSHA)
    assert.equal(
      fs.readFileSync(path.join(repository, 'file.txt'), 'utf8'),
      'hard reset me\n'
    )

    fs.writeFileSync(path.join(repository, 'file.txt'), 'undo me\n')
    git(repository, 'add', 'file.txt')
    git(repository, 'commit', '-m', 'undo me')
    await page.reload({ waitUntil: 'networkidle' })
    await page.getByRole('tab', { name: 'History' }).click()
    await waitForHistory(page, 'undo me')
    const undoCommit = await selectCommit(page, 'undo me')
    await runCommitAction(page, undoCommit, /Undo commit/i)
    assert.equal(git(repository, 'log', '-1', '--format=%s'), 'base')
    assert.equal(
      fs.readFileSync(path.join(repository, 'file.txt'), 'utf8'),
      'undo me\n'
    )

    const branchCommit = await selectCommit(page, 'base', false)
    const baseSHA = git(repository, 'rev-parse', 'HEAD')
    commitMenu = await openCommitMenu(page, branchCommit)
    await commitMenu
      .getByRole('menuitem', { name: /Create branch from commit/i })
      .click()
    const branchDialog = page.locator('#create-branch')
    await branchDialog.waitFor()
    await branchDialog.getByLabel('Name').fill('history-branch')
    await branchDialog.getByRole('button', { name: /Create branch/i }).click()
    await branchDialog.waitFor({ state: 'hidden' })
    assert.equal(git(repository, 'branch', '--show-current'), 'history-branch')
    assert.equal(git(repository, 'rev-parse', 'HEAD'), baseSHA)

    await waitForHistory(page, 'base')
    const tagCommit = await selectCommit(page, 'base', false)
    commitMenu = await openCommitMenu(page, tagCommit)
    await commitMenu.getByRole('menuitem', { name: /Create tag/i }).click()
    const tagDialog = page.locator('#create-tag')
    await tagDialog.waitFor()
    await tagDialog.getByLabel('Name').fill('history-v1')
    await tagDialog.getByRole('button', { name: /Create tag/i }).click()
    await tagDialog.waitFor({ state: 'hidden' })
    assert.equal(git(repository, 'rev-parse', 'history-v1^{}'), baseSHA)

    fs.writeFileSync(path.join(repository, 'file.txt'), 'checkout source\n')
    git(repository, 'commit', '-am', 'checkout source')
    git(repository, 'branch', '-f', 'main', 'HEAD')
    await page.reload({ waitUntil: 'networkidle' })
    await page.getByRole('tab', { name: 'History' }).click()
    await waitForHistory(page, 'checkout source')
    const taggedCommit = await selectCommit(page, 'base', false)
    commitMenu = await openCommitMenu(page, taggedCommit)
    await commitMenu.getByRole('menuitem', { name: /Copy tag/i }).click()
    assert.equal(
      await page.evaluate(() => navigator.clipboard.readText()),
      'history-v1'
    )
    commitMenu = await openCommitMenu(page, taggedCommit)
    await commitMenu.getByRole('menuitem', { name: /Checkout commit/i }).click()
    const checkoutDialog = page.locator('#checkout-commit')
    await page.waitForTimeout(300)
    await checkoutDialog.getByRole('button', { name: 'Cancel' }).click()
    await checkoutDialog.waitFor({ state: 'hidden' })
    assert.equal(git(repository, 'branch', '--show-current'), 'history-branch')
    commitMenu = await openCommitMenu(page, taggedCommit)
    await commitMenu.getByRole('menuitem', { name: /Checkout commit/i }).click()
    await confirm(page, 'Checkout')
    assert.equal(git(repository, 'rev-parse', 'HEAD'), baseSHA)
    assert.equal(git(repository, 'branch', '--show-current'), '')

    const revertRepository = path.join(root, 'revert-conflict-repository')
    fs.mkdirSync(revertRepository)
    git(revertRepository, 'init', '-b', 'main')
    git(revertRepository, 'config', 'user.name', 'Source Revert')
    git(revertRepository, 'config', 'user.email', 'source-revert@example.com')
    fs.writeFileSync(path.join(revertRepository, 'file.txt'), 'base\n')
    git(revertRepository, 'add', 'file.txt')
    git(revertRepository, 'commit', '-m', 'base')
    fs.writeFileSync(path.join(revertRepository, 'file.txt'), 'change\n')
    git(revertRepository, 'commit', '-am', 'change')
    fs.writeFileSync(path.join(revertRepository, 'file.txt'), 'followup\n')
    git(revertRepository, 'commit', '-am', 'followup')

    await addRepository(page, revertRepository)
    await page.getByRole('tab', { name: 'History' }).click()
    await waitForHistory(page, 'change')
    const conflictingCommit = await selectCommit(page, 'change')
    await runCommitAction(page, conflictingCommit, /Revert changes in commit/i)
    assert.equal(
      fs.existsSync(path.join(revertRepository, '.git', 'REVERT_HEAD')),
      true
    )
    const conflicts = await waitForConflictRecovery(page)
    await conflicts
      .getByRole('button', { name: 'File resolution options' })
      .click()
    await page
      .locator('#web-context-menu')
      .getByRole('menuitem')
      .filter({ hasText: /^Use/ })
      .last()
      .click()
    await conflicts
      .getByText(/All conflicted files have been resolved/i)
      .waitFor()
    await conflicts.getByRole('button', { name: /Continue/ }).click()
    await conflicts.waitFor({ state: 'hidden' })
    assert.match(git(revertRepository, 'log', '-1', '--format=%s'), /^Revert /)
    assert.equal(
      fs.readFileSync(path.join(revertRepository, 'file.txt'), 'utf8'),
      'base\n'
    )

    assert.deepEqual(errors, [])
    console.log(
      'Source history workflows passed: commit inspection, copy SHA/tag actions, branch/tag/checkout actions, revert, revert conflict recovery, mixed reset, and undo confirmations'
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
