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

async function openBranchMenu(page) {
  const branchButton = page
    .locator('.branch-toolbar-button')
    .getByRole('button')
    .last()
  await branchButton.focus()
  await branchButton.press('Enter')
  await page.getByRole('button', { name: 'Create branch' }).waitFor()
  return branchButton
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
  const backup = path.join(root, 'backup.git')
  const replacementBackup = path.join(root, 'replacement-backup.git')
  const worktree = path.join(root, 'worktree')
  const movedWorktree = path.join(root, 'moved-worktree')
  const stashConflictRepository = path.join(root, 'stash-conflict')
  fs.mkdirSync(repository)
  git(repository, 'init', '-b', 'main')
  git(repository, 'config', 'user.name', 'Source Local')
  git(repository, 'config', 'user.email', 'source-local@example.com')
  fs.writeFileSync(path.join(repository, 'README.md'), '# local workflows\n')
  git(repository, 'add', 'README.md')
  git(repository, 'commit', '-m', 'initial')
  git(repository, 'clone', '--bare', repository, backup)
  git(repository, 'clone', '--bare', repository, replacementBackup)

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
    await page.getByLabel('Local path').fill(repository)
    await page.getByRole('button', { name: 'Add repository' }).click()
    await page.locator('.branch-toolbar-button').waitFor()
    await page.waitForFunction(
      () =>
        !document
          .querySelector('.branch-toolbar-button .title')
          ?.textContent?.includes('No branch')
    )

    await openBranchMenu(page)
    await page.getByRole('button', { name: 'Create branch' }).click()
    const branchDialog = page
      .getByRole('dialog')
      .filter({ hasText: 'Create branch' })
    await branchDialog.getByLabel('Branch name').fill('feature')
    await branchDialog.getByRole('button', { name: 'Create branch' }).click()
    await waitForBranchExists(repository, 'feature')
    await waitForGit(repository, ['branch', '--show-current'], 'feature')
    await waitForBranch(page, 'feature')
    await openBranchMenu(page)
    await page
      .getByRole('button', { name: 'Rename current branch' })
      .first()
      .click()
    const renameDialog = page
      .getByRole('dialog')
      .filter({ hasText: 'Rename branch' })
    await renameDialog.getByLabel('Branch name').fill('renamed-feature')
    await renameDialog.getByRole('button', { name: 'Rename branch' }).click()
    await waitForBranchExists(repository, 'renamed-feature')
    await refreshTools(page)
    await waitForBranch(page, 'renamed-feature')
    await openBranchMenu(page)
    await page.getByRole('button', { name: 'Switch to main' }).first().click()
    await waitForGit(repository, ['branch', '--show-current'], 'main')
    await waitForBranch(page, 'main')
    await refreshTools(page)
    await waitForBranch(page, 'main')
    await openBranchMenu(page)
    await page
      .getByRole('button', { name: 'Delete renamed-feature' })
      .first()
      .click()
    await page.getByRole('alertdialog').waitFor()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Cancel' })
      .click()
    await page.getByRole('alertdialog').waitFor({ state: 'hidden' })
    assert.match(git(repository, 'branch'), /renamed-feature/)
    await page
      .getByRole('button', { name: 'Delete renamed-feature' })
      .first()
      .click()
    await confirm(page, 'Delete branch')
    assert.doesNotMatch(git(repository, 'branch'), /renamed-feature/)

    await refreshTools(page)
    const tools = page.getByRole('region', { name: 'Repository tools' })

    fs.writeFileSync(path.join(repository, 'README.md'), '# stashed work\n')
    await refreshTools(page)
    await tools.getByRole('button', { name: 'Create stash' }).click()
    const stashDialog = page
      .getByRole('dialog')
      .filter({ hasText: 'Create stash' })
    await stashDialog.getByLabel('Message').fill('saved work')
    await stashDialog.getByRole('button', { name: 'Create stash' }).click()
    await tools.getByText(/saved work on main/).waitFor()
    assert.match(git(repository, 'stash', 'list'), /saved%20work/)
    await tools.getByRole('button', { name: 'Inspect' }).click()
    const stashInspection = page.getByRole('region', {
      name: 'Stash inspection',
    })
    await stashInspection.getByRole('option', { name: 'README.md' }).waitFor()
    await stashInspection.getByRole('option', { name: 'README.md' }).click()
    await page.waitForFunction(() =>
      document
        .querySelector('.web-stash-diff')
        ?.textContent?.includes('stashed work')
    )
    assert.match(await stashInspection.innerText(), /stashed work/)
    await stashInspection.getByRole('button', { name: 'Close' }).click()
    await tools.getByRole('button', { name: 'Rename' }).click()
    const stashRenameDialog = page
      .getByRole('dialog')
      .filter({ hasText: 'Rename stash' })
    await stashRenameDialog.getByLabel('Stash name').fill('renamed stash')
    await stashRenameDialog
      .getByRole('button', { name: 'Rename stash' })
      .click()
    await tools.getByText(/renamed stash on main/).waitFor()
    const applyDialog = page.getByRole('alertdialog')
    await tools.getByRole('button', { name: 'Apply' }).click()
    await applyDialog.waitFor()
    assert.equal(await applyDialog.count(), 1)
    await applyDialog.getByRole('button', { name: 'Cancel' }).click()
    await applyDialog.waitFor({ state: 'hidden' })
    assert.equal(
      fs.readFileSync(path.join(repository, 'README.md'), 'utf8'),
      '# local workflows\n'
    )
    await tools.getByRole('button', { name: 'Apply' }).click()
    await confirm(page, 'Apply stash')
    await waitForFile(path.join(repository, 'README.md'), '# stashed work\n')
    await page.getByRole('tab', { name: 'Changes' }).click()
    await page
      .locator('.web-changes-actions')
      .getByRole('button', { name: 'Discard' })
      .click()
    await confirm(page, 'Discard changes')
    await refreshTools(page)
    await tools.getByRole('button', { name: 'Drop' }).click()
    await confirm(page, 'Drop stash')
    assert.doesNotMatch(git(repository, 'stash', 'list'), /renamed%20stash/)

    fs.mkdirSync(stashConflictRepository)
    git(stashConflictRepository, 'init', '-b', 'main')
    git(stashConflictRepository, 'config', 'user.name', 'Stash Conflict')
    git(
      stashConflictRepository,
      'config',
      'user.email',
      'stash-conflict@example.com'
    )
    fs.writeFileSync(path.join(stashConflictRepository, 'shared.txt'), 'base\n')
    git(stashConflictRepository, 'add', 'shared.txt')
    git(stashConflictRepository, 'commit', '-m', 'base')
    fs.writeFileSync(
      path.join(stashConflictRepository, 'shared.txt'),
      'stashed version\n'
    )
    await addRepository(page, stashConflictRepository)
    await refreshTools(page)
    const conflictTools = page.getByRole('region', {
      name: 'Repository tools',
    })
    await conflictTools.getByRole('button', { name: 'Create stash' }).click()
    const conflictStashDialog = page
      .getByRole('dialog')
      .filter({ hasText: 'Create stash' })
    await conflictStashDialog.getByLabel('Message').fill('conflict stash')
    await conflictStashDialog
      .getByRole('button', { name: 'Create stash' })
      .click()
    await conflictTools.getByText(/conflict stash on main/).waitFor()
    fs.writeFileSync(
      path.join(stashConflictRepository, 'shared.txt'),
      'committed version\n'
    )
    git(stashConflictRepository, 'add', 'shared.txt')
    git(stashConflictRepository, 'commit', '-m', 'conflicting change')
    await conflictTools.getByRole('button', { name: 'Pop' }).click()
    await confirm(page, 'Pop stash')
    await page.getByRole('tab', { name: 'Changes' }).click()
    await page.getByRole('button', { name: 'Use ours' }).waitFor()
    await page.getByRole('button', { name: 'Use ours' }).click()
    await page.getByRole('button', { name: 'Use ours' }).waitFor({
      state: 'hidden',
    })
    assert.equal(
      fs.readFileSync(path.join(stashConflictRepository, 'shared.txt'), 'utf8'),
      'committed version\n'
    )
    await refreshTools(page)
    await conflictTools.getByRole('button', { name: 'Drop' }).click()
    await confirm(page, 'Drop stash')
    assert.doesNotMatch(
      git(stashConflictRepository, 'stash', 'list'),
      /conflict%20stash/
    )

    await addRepository(page, repository)
    await refreshTools(page)

    await tools.getByRole('button', { name: 'Add remote' }).click()
    const remoteDialog = page
      .getByRole('dialog')
      .filter({ hasText: 'Add remote' })
    await remoteDialog.getByLabel('Remote name').fill('backup')
    await remoteDialog.getByLabel('Remote URL').fill(backup)
    await remoteDialog.getByRole('button', { name: 'Add remote' }).click()
    await tools
      .getByText(
        new RegExp(`backup: ${backup.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
      )
      .waitFor()
    assert.equal(git(repository, 'remote', 'get-url', 'backup'), backup)
    await tools.getByRole('button', { name: 'Set URL' }).click()
    const setRemoteDialog = page
      .getByRole('dialog')
      .filter({ hasText: 'Set remote URL' })
    await setRemoteDialog.getByLabel('Remote name').fill('backup')
    await setRemoteDialog.getByLabel('Remote URL').fill(replacementBackup)
    await setRemoteDialog.getByRole('button', { name: 'Set URL' }).click()
    await tools
      .getByText(
        new RegExp(
          `backup: ${replacementBackup.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`
        )
      )
      .waitFor()
    assert.equal(
      git(repository, 'remote', 'get-url', 'backup'),
      replacementBackup
    )
    await tools.getByRole('button', { name: 'Remove' }).click()
    await page.getByRole('alertdialog').waitFor()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Cancel' })
      .click()
    await page.getByRole('alertdialog').waitFor({ state: 'hidden' })
    assert.equal(git(repository, 'remote'), 'backup')
    await tools.getByRole('button', { name: 'Remove' }).click()
    await confirm(page, 'Remove remote')
    assert.equal(git(repository, 'remote'), '')

    await tools.getByRole('button', { name: 'Create tag' }).click()
    const tagDialog = page.getByRole('dialog').filter({ hasText: 'Create tag' })
    await tagDialog.getByLabel('Tag name').fill('v1.0.0')
    await tagDialog.getByRole('button', { name: 'Create tag' }).click()
    await waitForGit(repository, ['tag'], 'v1.0.0')
    await refreshTools(page)
    await tools.getByText(/v1\.0\.0 \(local only\)/).waitFor()
    assert.equal(git(repository, 'tag'), 'v1.0.0')

    await tools.getByRole('button', { name: 'Create worktree' }).click()
    const worktreeDialog = page
      .getByRole('dialog')
      .filter({ hasText: 'Create a linked worktree' })
    await worktreeDialog.getByLabel('Worktree path').fill(worktree)
    await worktreeDialog.getByLabel('New branch').fill('worktree-branch')
    await worktreeDialog
      .getByRole('button', { name: 'Create worktree' })
      .click()
    await tools.getByText(worktree, { exact: false }).waitFor()
    assert.equal(git(worktree, 'branch', '--show-current'), 'worktree-branch')

    await tools.getByRole('button', { name: 'Rename', exact: true }).click()
    const moveDialog = page
      .getByRole('dialog')
      .filter({ hasText: 'Rename worktree' })
    await moveDialog
      .getByLabel('New worktree path')
      .fill(path.basename(movedWorktree))
    await moveDialog.getByRole('button', { name: 'Rename worktree' }).click()
    await tools.getByText(movedWorktree, { exact: false }).waitFor()
    assert.equal(
      git(movedWorktree, 'branch', '--show-current'),
      'worktree-branch'
    )
    await tools
      .getByRole('region', { name: 'Worktrees' })
      .locator('.web-tool-row')
      .filter({ hasText: movedWorktree })
      .getByRole('button', { name: 'Open', exact: true })
      .click()
    await page.waitForFunction(() =>
      document.title.startsWith('moved-worktree -')
    )
    await addRepository(page, repository)
    await refreshTools(page)
    await page
      .getByRole('region', { name: 'Repository tools' })
      .getByText(movedWorktree, { exact: false })
      .waitFor()
    const reopenedTools = page.getByRole('region', {
      name: 'Repository tools',
    })
    await reopenedTools.getByRole('button', { name: 'Remove' }).click()
    await confirm(page, 'Remove worktree')
    assert.equal(fs.existsSync(movedWorktree), false)
    assert.doesNotMatch(git(repository, 'worktree', 'list'), /worktree-branch/)

    const dirtyWorktree = path.join(root, 'dirty-worktree')
    const dirtyWorktreeBranch = 'dirty-worktree-branch'
    git(repository, 'worktree', 'add', '-b', dirtyWorktreeBranch, dirtyWorktree)
    fs.writeFileSync(path.join(dirtyWorktree, 'dirty.txt'), 'uncommitted\n')
    await refreshTools(page)
    await tools.getByText(/dirty-worktree-branch.*has changes/).waitFor()
    await tools.getByRole('button', { name: 'Force remove' }).click()
    await confirm(page, 'Force remove worktree')
    assert.equal(fs.existsSync(dirtyWorktree), false)
    assert.doesNotMatch(
      git(repository, 'worktree', 'list'),
      /dirty-worktree-branch/
    )

    const staleWorktree = path.join(root, 'stale-worktree')
    git(
      repository,
      'worktree',
      'add',
      '-b',
      'stale-worktree-branch',
      staleWorktree
    )
    fs.rmSync(staleWorktree, { recursive: true, force: true })
    await refreshTools(page)
    await tools.getByText(/stale-worktree-branch.*prunable/).waitFor()
    await tools.getByRole('button', { name: 'Prune' }).click()
    await confirm(page, 'Prune worktree')
    assert.doesNotMatch(
      git(repository, 'worktree', 'list'),
      /stale-worktree-branch/
    )
    assert.deepEqual(errors, [])
    console.log(
      'Source local workflows passed: branch, stash, remote, tag, and worktree lifecycle'
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
