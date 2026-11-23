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

async function openSyncMenu(page) {
  await page.getByRole('button', { name: 'Push, pull, fetch options' }).click()
  await page.getByText(/^Fetch origin$/).waitFor()
}

async function openBranchMenu(page) {
  const foldout = page.locator('#foldout-container > .foldout')
  if (await foldout.isVisible().catch(() => false)) {
    await page.keyboard.press('Escape')
    await foldout.waitFor({ state: 'hidden' })
  }
  const branchDropdown = page.locator('.branch-toolbar-button')
  const picker = page.locator('.branches-container')
  if (await picker.isVisible().catch(() => false)) return picker
  await branchDropdown.getByRole('button').last().click()
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

async function waitForRemoteCommit(remote, expected) {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (git(remote, 'rev-parse', 'refs/heads/main') === expected) return
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  assert.equal(git(remote, 'rev-parse', 'refs/heads/main'), expected)
}

async function waitForGit(cwd, args, expected) {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      if (git(cwd, ...args) === expected) return
    } catch {
      // @{upstream} may not exist while the operation is running.
    }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  assert.equal(git(cwd, ...args), expected)
}

async function main() {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'desktop-plus-source-sync-')
  )
  const repository = path.join(root, 'repository')
  const remote = path.join(root, 'origin.git')
  const writer = path.join(root, 'writer')
  fs.mkdirSync(repository)
  git(repository, 'init', '--bare', remote)
  git(repository, 'init', '-b', 'main')
  git(repository, 'config', 'user.name', 'Source Sync')
  git(repository, 'config', 'user.email', 'source-sync@example.com')
  fs.writeFileSync(path.join(repository, 'README.md'), '# sync\n')
  git(repository, 'add', 'README.md')
  git(repository, 'commit', '-m', 'initial')
  git(repository, 'remote', 'add', 'origin', remote)
  git(repository, 'push', '-u', 'origin', 'main')
  git(remote, 'symbolic-ref', 'HEAD', 'refs/heads/main')
  git(repository, 'clone', remote, writer)
  git(writer, 'config', 'user.name', 'Source Sync Writer')
  git(writer, 'config', 'user.email', 'source-sync-writer@example.com')
  git(repository, 'branch', 'default-target')

  fs.writeFileSync(path.join(repository, 'README.md'), '# browser push\n')
  git(repository, 'commit', '-am', 'browser push')
  const pushedCommit = git(repository, 'rev-parse', 'HEAD')
  const hook = path.join(remote, 'hooks', 'pre-receive')
  fs.writeFileSync(
    hook,
    '#!/bin/sh\nprintf "push rejected for test\\n" >&2\nexit 1\n'
  )
  fs.chmodSync(hook, 0o755)

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

    const remoteBeforeRejectedPush = git(remote, 'rev-parse', 'refs/heads/main')
    await openSyncMenu(page)
    await page.getByRole('button', { name: /^Push / }).click()
    await page.waitForTimeout(1000)
    const pushError = page.locator('#app-error')
    await pushError.waitFor()
    await pushError
      .getByRole('button', { name: 'Close', exact: true })
      .last()
      .click()
    await pushError.waitFor({ state: 'hidden' })
    assert.equal(
      git(remote, 'rev-parse', 'refs/heads/main'),
      remoteBeforeRejectedPush
    )

    fs.rmSync(hook)
    await openSyncMenu(page)
    await page.getByRole('button', { name: /^Push / }).click()
    await waitForRemoteCommit(remote, pushedCommit)

    git(writer, 'fetch', 'origin')
    git(writer, 'reset', '--hard', 'origin/main')
    fs.writeFileSync(path.join(writer, 'README.md'), '# browser pull\n')
    git(writer, 'commit', '-am', 'writer pull')
    const pulledCommit = git(writer, 'rev-parse', 'HEAD')
    git(writer, 'push', 'origin', 'main')
    await openSyncMenu(page)
    await page.getByRole('button', { name: /^Fetch origin/ }).click()
    await page.waitForTimeout(1000)
    await openSyncMenu(page)
    await page.getByRole('button', { name: /^Pull / }).click()
    await waitForRemoteCommit(repository, pulledCommit)
    assert.equal(
      fs.readFileSync(path.join(repository, 'README.md'), 'utf8'),
      '# browser pull\n'
    )
    git(writer, 'checkout', 'main')
    git(writer, 'pull', '--ff-only')
    fs.writeFileSync(path.join(writer, 'README.md'), '# writer reset\n')
    git(writer, 'commit', '-am', 'writer reset')
    const writerResetTip = git(writer, 'rev-parse', 'HEAD')
    git(writer, 'push', 'origin', 'main')

    fs.writeFileSync(path.join(repository, 'local-only.txt'), 'local commit\n')
    git(repository, 'add', 'local-only.txt')
    git(repository, 'commit', '-m', 'local commit to discard')
    const localCommit = git(repository, 'rev-parse', 'HEAD')
    fs.writeFileSync(path.join(repository, 'README.md'), '# dirty reset\n')
    await page.reload({ waitUntil: 'networkidle' })

    let branchMenu
    await openSyncMenu(page)
    await page.getByRole('button', { name: /^Fetch origin/ }).click()
    await page.waitForTimeout(1000)
    await openSyncMenu(page)
    await page.getByRole('button', { name: 'Reset and pull' }).click()
    const resetError = page.locator('#app-error')
    await resetError.waitFor()
    assert.match(
      await resetError.innerText(),
      /Cannot reset and pull while uncommitted changes exist/i
    )
    await resetError
      .getByRole('button', { name: 'Close', exact: true })
      .last()
      .click()
    await resetError.waitFor({ state: 'hidden' })
    assert.equal(git(repository, 'rev-parse', 'HEAD'), localCommit)
    assert.equal(
      fs.readFileSync(path.join(repository, 'README.md'), 'utf8'),
      '# dirty reset\n'
    )

    git(repository, 'restore', 'README.md')
    await page.reload({ waitUntil: 'networkidle' })
    await openSyncMenu(page)
    await page.getByRole('button', { name: 'Reset and pull' }).click()
    await waitForGit(repository, ['rev-parse', 'HEAD'], writerResetTip)
    assert.equal(
      fs.readFileSync(path.join(repository, 'README.md'), 'utf8'),
      '# writer reset\n'
    )
    assert.equal(fs.existsSync(path.join(repository, 'local-only.txt')), false)

    branchMenu = await openBranchMenu(page)
    await branchMenu.getByRole('button', { name: 'New Branch' }).click()
    const publishBranchDialog = page
      .getByRole('dialog')
      .filter({ hasText: 'Create branch' })
    await publishBranchDialog.getByLabel('Name').fill('publish-me')
    await publishBranchDialog
      .getByRole('button', { name: 'Create Branch' })
      .click()
    await waitForGit(repository, ['branch', '--show-current'], 'publish-me')
    await openSyncMenu(page)
    await page.getByRole('button', { name: 'Publish branch' }).click()
    await waitForGit(
      repository,
      ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'],
      'origin/publish-me'
    )
    assert.equal(
      git(remote, 'rev-parse', 'refs/heads/publish-me'),
      git(repository, 'rev-parse', 'publish-me')
    )

    git(writer, 'fetch', 'origin')
    git(writer, 'checkout', '-B', 'remote-only', 'origin/main')
    fs.writeFileSync(
      path.join(writer, 'remote-only.txt'),
      'remote-only branch\n'
    )
    git(writer, 'add', 'remote-only.txt')
    git(writer, 'commit', '-m', 'remote-only branch')
    const remoteOnlyTip = git(writer, 'rev-parse', 'HEAD')
    git(writer, 'push', '-u', 'origin', 'remote-only')
    await page.getByRole('button', { name: 'Fetch origin' }).click()
    branchMenu = await openBranchMenu(page)
    await branchMenu
      .getByRole('option', { name: /^origin\/remote-only(?:\s|,|$)/ })
      .click()
    await waitForGit(repository, ['branch', '--show-current'], 'remote-only')
    await waitForGit(
      repository,
      ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'],
      'origin/remote-only'
    )
    assert.equal(git(repository, 'rev-parse', 'HEAD'), remoteOnlyTip)

    git(repository, 'branch', '--track', 'stale-main', 'origin/main')
    const staleMainBefore = git(repository, 'rev-parse', 'stale-main')
    const currentBeforeFastForward = git(repository, 'rev-parse', 'HEAD')
    git(writer, 'checkout', 'main')
    git(writer, 'pull', '--ff-only')
    fs.writeFileSync(path.join(writer, 'README.md'), '# advance stale branch\n')
    git(writer, 'commit', '-am', 'advance stale branch')
    const advancedMainTip = git(writer, 'rev-parse', 'HEAD')
    git(writer, 'push', 'origin', 'main')
    git(repository, 'fetch', 'origin')
    assert.notEqual(staleMainBefore, advancedMainTip)
    await page.getByRole('button', { name: 'Fetch origin' }).click()
    branchMenu = await openBranchContextMenu(page, 'stale-main')
    await branchMenu
      .getByRole('menuitem', { name: 'Pull Branch', exact: true })
      .click()
    await waitForGit(repository, ['rev-parse', 'stale-main'], advancedMainTip)
    assert.equal(
      git(repository, 'rev-parse', 'HEAD'),
      currentBeforeFastForward,
      'fast-forwarding a non-current branch must not move the checked-out branch'
    )

    assert.deepEqual(errors, [])
    console.log(
      'Source sync workflows passed: push rejection recovery, fetch and pull, reset and pull, publish, remote checkout, and branch fast-forward'
    )
  } finally {
    await browser.close()
    await new Promise(resolve => server.close(resolve))
    fs.rmSync(root, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 100,
    })
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
