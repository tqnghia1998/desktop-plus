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

async function reloadRepository(page) {
  await page.reload({ waitUntil: 'networkidle' })
  await page.locator('.branch-toolbar-button').waitFor()
  await page.getByRole('tab', { name: 'Changes' }).waitFor()
}

async function stashAllChanges(page) {
  await page.getByRole('tab', { name: 'Changes' }).click()
  await page.locator('.filter-field-row').first().dispatchEvent('contextmenu')
  const menu = page.locator('#web-context-menu')
  await menu.waitFor()
  await menu.getByRole('menuitem', { name: /Stash all changes(?:…)?/i }).click()
}

async function openOnlyStash(page) {
  const stash = page.getByRole('button', { name: /^1 stash \(/ })
  await stash.waitFor()
  await stash.click()
  const viewer = page.locator('#stash-diff-viewer')
  await viewer.waitFor()
  return viewer
}

async function addRepository(page, repository) {
  const homeAdd = page.getByRole('button', {
    name: /Add an Existing Repository from your Local Drive…/i,
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
    () =>
      !document
        .querySelector('.branch-toolbar-button .title')
        ?.textContent?.includes('No branch')
  )
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

async function openBranchContextMenu(page, branch) {
  const picker = await openBranchMenu(page)
  await picker
    .getByRole('option', { name: new RegExp(`^${branch}(?:\\s|,|$)`) })
    .dispatchEvent('contextmenu')
  const menu = page.locator('#web-context-menu')
  await menu.waitFor()
  return menu
}

async function waitForBranch(page, branch) {
  await page.waitForFunction(
    expectedBranch =>
      document
        .querySelector('.branch-toolbar-button .title')
        ?.textContent?.includes(expectedBranch),
    branch
  )
}

async function confirm(page, buttonName) {
  const confirmation = page.getByRole('alertdialog')
  await confirmation.waitFor()
  await confirmation.getByRole('button', { name: buttonName }).click()
  await confirmation.waitFor({ state: 'hidden' })
}

async function waitForFile(file, contents) {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (fs.readFileSync(file, 'utf8') === contents) return
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  assert.equal(fs.readFileSync(file, 'utf8'), contents)
}

async function waitForGit(cwd, args, expected) {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (git(cwd, ...args) === expected) return
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  assert.equal(git(cwd, ...args), expected)
}

async function waitForBranchExists(repository, branch) {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (
      git(repository, 'branch')
        .split('\n')
        .some(line => line.trim() === branch)
    )
      return
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  assert.match(git(repository, 'branch'), new RegExp(`\\b${branch}\\b`))
}

async function main() {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'desktop-plus-source-local-')
  )
  const repository = path.join(root, 'repository')
  const worktree = path.join(root, 'worktree')
  fs.mkdirSync(repository)
  git(repository, 'init', '-b', 'main')
  git(repository, 'config', 'user.name', 'Source Local')
  git(repository, 'config', 'user.email', 'source-local@example.com')
  fs.writeFileSync(path.join(repository, 'README.md'), '# local workflows\n')
  git(repository, 'add', 'README.md')
  git(repository, 'commit', '-m', 'initial')

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
      () =>
        !document
          .querySelector('.branch-toolbar-button .title')
          ?.textContent?.includes('No branch')
    )

    let branchMenu = await openBranchMenu(page)
    await branchMenu.getByRole('button', { name: 'New Branch' }).click()
    const branchDialog = page
      .getByRole('dialog')
      .filter({ hasText: 'Create branch' })
    await branchDialog.getByLabel('Name').fill('feature')
    await branchDialog.getByRole('button', { name: 'Create Branch' }).click()
    await waitForBranchExists(repository, 'feature')
    await waitForGit(repository, ['branch', '--show-current'], 'feature')
    await waitForBranch(page, 'feature')
    branchMenu = await openBranchContextMenu(page, 'feature')
    await branchMenu
      .getByRole('menuitem', { name: 'Rename…', exact: true })
      .click()
    const renameDialog = page
      .getByRole('dialog')
      .filter({ hasText: 'Rename branch' })
    await renameDialog.getByLabel('Name').fill('renamed-feature')
    await renameDialog.getByRole('button', { name: 'Rename feature' }).click()
    await waitForBranchExists(repository, 'renamed-feature')
    await waitForBranch(page, 'renamed-feature')
    branchMenu = await openBranchMenu(page)
    await branchMenu.getByRole('option', { name: /^main(?:\s|,|$)/ }).click()
    await waitForGit(repository, ['branch', '--show-current'], 'main')
    await waitForBranch(page, 'main')
    branchMenu = await openBranchContextMenu(page, 'renamed-feature')
    await branchMenu
      .getByRole('menuitem', { name: 'Delete…', exact: true })
      .click()
    await confirm(page, 'Delete')
    assert.doesNotMatch(git(repository, 'branch'), /renamed-feature/)

    fs.writeFileSync(path.join(repository, 'README.md'), '# stashed work\n')
    await reloadRepository(page)
    await stashAllChanges(page)
    await waitForGit(repository, ['stash', 'list', '--format=%gd'], 'stash@{0}')
    const stashButton = page.getByRole('button', { name: /^1 stash \(/ })
    await stashButton.click({ button: 'right' })
    await page
      .locator('#web-context-menu')
      .getByRole('menuitem', { name: 'Rename…' })
      .click()
    const stashRenameDialog = page
      .getByRole('dialog')
      .filter({ hasText: /Rename stash/i })
    await stashRenameDialog.getByLabel('Name').fill('renamed stash')
    await stashRenameDialog
      .getByRole('button', { name: /Rename stash/i })
      .click()
    await page
      .getByRole('button', { name: '1 stash (renamed stash)' })
      .waitFor()
    await stashButton.click({ button: 'right' })
    await page
      .locator('#web-context-menu')
      .getByRole('menuitem', { name: 'Apply Changes', exact: true })
      .click()
    await waitForFile(path.join(repository, 'README.md'), '# stashed work\n')
    assert.match(git(repository, 'stash', 'list'), /renamed%20stash/)
    await reloadRepository(page)
    await page.locator('.filter-field-row').first().dispatchEvent('contextmenu')
    await page
      .locator('#web-context-menu')
      .getByRole('menuitem', { name: 'Discard All Changes…', exact: true })
      .click()
    await confirm(page, 'Discard changes')
    let stashViewer = await openOnlyStash(page)
    await stashViewer.getByRole('option', { name: 'README.md' }).waitFor()
    await stashViewer.getByRole('option', { name: 'README.md' }).click()
    await stashViewer.getByText('stashed work', { exact: false }).waitFor()
    await stashViewer.locator('.loading-indicator').waitFor({
      state: 'detached',
    })
    assert.match(await stashViewer.innerText(), /stashed work/)
    await stashViewer.getByRole('button', { name: 'Restore options' }).click()
    await page
      .getByRole('menuitem', { name: 'Apply Changes', exact: true })
      .click()
    await stashViewer.getByRole('button', { name: 'Apply Changes' }).click()
    await waitForFile(path.join(repository, 'README.md'), '# stashed work\n')
    assert.match(git(repository, 'stash', 'list'), /renamed%20stash/)
    await reloadRepository(page)
    await page.locator('.filter-field-row').first().dispatchEvent('contextmenu')
    await page
      .locator('#web-context-menu')
      .getByRole('menuitem', { name: 'Discard All Changes…', exact: true })
      .click()
    await confirm(page, 'Discard changes')
    stashViewer = await openOnlyStash(page)
    await stashViewer.getByRole('button', { name: 'Restore options' }).click()
    await page
      .getByRole('menuitem', { name: 'Restore Changes', exact: true })
      .click()
    await stashViewer.getByRole('button', { name: 'Restore Changes' }).click()
    await waitForFile(path.join(repository, 'README.md'), '# stashed work\n')
    assert.equal(git(repository, 'stash', 'list'), '')
    await reloadRepository(page)
    await page.locator('.filter-field-row').first().dispatchEvent('contextmenu')
    await page
      .locator('#web-context-menu')
      .getByRole('menuitem', { name: 'Discard All Changes…', exact: true })
      .click()
    await confirm(page, 'Discard changes')

    fs.writeFileSync(path.join(repository, 'README.md'), '# discard stash\n')
    await reloadRepository(page)
    await stashAllChanges(page)
    await page
      .getByRole('button', { name: /^1 stash \(/ })
      .click({ button: 'right' })
    await page
      .locator('#web-context-menu')
      .getByRole('menuitem', { name: 'Discard', exact: true })
      .click()
    await confirm(page, 'Discard')
    await waitForGit(repository, ['stash', 'list'], '')

    await page.getByRole('tab', { name: 'History' }).click()
    const initialCommit = page
      .locator('#commit-list .list-item')
      .filter({ has: page.getByText('initial', { exact: true }) })
      .first()
    await initialCommit.waitFor()
    await initialCommit.click()
    await initialCommit.click({ button: 'right' })
    await page
      .locator('#web-context-menu')
      .getByRole('menuitem', { name: 'Create Tag…' })
      .click()
    const tagDialog = page.locator('#create-tag')
    await tagDialog.waitFor()
    await tagDialog.getByLabel('Name').fill('v1.0.0')
    await tagDialog.getByRole('button', { name: /Create tag/i }).click()
    await tagDialog.waitFor({ state: 'hidden' })
    await waitForGit(repository, ['tag'], 'v1.0.0')
    assert.equal(git(repository, 'tag'), 'v1.0.0')

    git(repository, 'branch', 'worktree-branch')
    await reloadRepository(page)
    branchMenu = await openBranchContextMenu(page, 'worktree-branch')
    await branchMenu
      .getByRole('menuitem', {
        name: 'Checkout in New Worktree…',
        exact: true,
      })
      .click()
    const worktreeDialog = page
      .getByRole('dialog')
      .filter({ hasText: 'Add Worktree' })
    await worktreeDialog
      .getByLabel('Worktree Name')
      .fill(path.basename(worktree))
    await worktreeDialog.getByLabel('Local Path').fill(root)
    assert.equal(
      await worktreeDialog.getByLabel('Branch Name').inputValue(),
      'worktree-branch'
    )
    await worktreeDialog
      .getByRole('button', { name: 'Create Worktree' })
      .click()
    await worktreeDialog.waitFor({ state: 'hidden' })
    assert.equal(git(worktree, 'branch', '--show-current'), 'worktree-branch')
    assert.deepEqual(errors, [])
    console.log(
      'Source local workflows passed: branch, stash, tag, and worktree creation'
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
