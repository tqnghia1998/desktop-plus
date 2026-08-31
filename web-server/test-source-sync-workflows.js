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
  const syncDropdown = page.locator('.push-pull-button')
  await syncDropdown.getByRole('button').evaluate(button => button.click())
  try {
    await syncDropdown
      .getByRole('button', { name: /^(?:Push|Publish branch)$/ })
      .waitFor()
  } catch (error) {
    throw new Error(
      `${error.message}\nSync DOM:\n${await syncDropdown.evaluate(
        element => element.outerHTML
      )}`
    )
  }
}

async function openBranchMenu(page) {
  const syncDropdown = page.locator('.push-pull-button')
  if (
    await syncDropdown
      .locator('.foldout')
      .isVisible()
      .catch(() => false)
  ) {
    await page.keyboard.press('Escape')
    await syncDropdown.locator('.foldout').waitFor({ state: 'hidden' })
  }
  const branchDropdown = page.locator('.branch-toolbar-button')
  await branchDropdown.getByRole('button').last().click()
  const branchMenu = branchDropdown.locator('.foldout')
  await branchMenu
    .getByRole('button', { name: 'Reset and pull', exact: true })
    .waitFor()
  return branchMenu
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
      // Some values, such as @{upstream}, do not exist until the operation
      // completes. Keep polling instead of treating that initial state as a
      // test failure.
    }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  assert.equal(git(cwd, ...args), expected)
}

async function waitForMissingGit(cwd, args) {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      git(cwd, ...args)
    } catch {
      return
    }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  assert.throws(() => git(cwd, ...args))
}

async function waitForOperationDialog(page, title) {
  const operationDialog = page.getByRole('dialog').filter({ hasText: title })
  const errorDialog = page.getByRole('dialog').filter({ hasText: 'Error' })
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await errorDialog.isVisible().catch(() => false)) {
      throw new Error(
        `${title} failed:\n${await errorDialog.innerText()}\nDialogs:\n${await page
          .getByRole('dialog')
          .allTextContents()}`
      )
    }
    if (!(await operationDialog.isVisible().catch(() => false))) return
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error(`${title} did not settle`)
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
    await page.getByLabel('Local path').fill(repository)
    await page.getByRole('button', { name: 'Add repository' }).click()

    await openSyncMenu(page)
    await page.getByRole('button', { name: 'Push', exact: true }).click()
    const pushError = page.getByRole('dialog').filter({
      hasText: /push rejected for test/i,
    })
    try {
      await pushError.waitFor()
    } catch (error) {
      throw new Error(
        `${error.message}\nDialogs:\n${await page
          .getByRole('dialog')
          .allTextContents()}\nRemote:\n${git(
          remote,
          'rev-parse',
          'refs/heads/main'
        )}`
      )
    }
    await pushError.getByText('Close', { exact: true }).click()
    await pushError.waitFor({ state: 'hidden' })
    assert.notEqual(git(remote, 'rev-parse', 'refs/heads/main'), pushedCommit)

    fs.rmSync(hook)
    await openSyncMenu(page)
    await page.getByRole('button', { name: 'Push', exact: true }).click()
    await waitForRemoteCommit(remote, pushedCommit)

    git(writer, 'fetch', 'origin')
    git(writer, 'reset', '--hard', 'origin/main')
    fs.writeFileSync(path.join(writer, 'README.md'), '# browser pull\n')
    git(writer, 'commit', '-am', 'writer pull')
    const pulledCommit = git(writer, 'rev-parse', 'HEAD')
    git(writer, 'push', 'origin', 'main')
    await openSyncMenu(page)
    await page
      .getByRole('button', { name: 'Pull (merge)', exact: true })
      .click()
    await waitForRemoteCommit(repository, pulledCommit)
    assert.equal(
      fs.readFileSync(path.join(repository, 'README.md'), 'utf8'),
      '# browser pull\n'
    )
    await openSyncMenu(page)
    await page.getByRole('button', { name: 'Pull strategy' }).click()
    const fastForwardOnlyDialog = page
      .getByRole('dialog')
      .filter({ hasText: 'Pull strategy' })
    await fastForwardOnlyDialog
      .getByRole('radio', { name: 'Fast-forward only' })
      .check()
    await fastForwardOnlyDialog
      .getByRole('button', { name: 'Close', exact: true })
      .last()
      .click()
    await openSyncMenu(page)
    await page
      .getByRole('button', { name: /Pull \(.*fast-forward only.*\)/ })
      .click()
    await page.waitForTimeout(100)

    git(writer, 'checkout', 'main')
    git(writer, 'pull', '--ff-only')
    git(writer, 'checkout', '-b', 'refspec-source')
    fs.writeFileSync(
      path.join(writer, 'refspec.txt'),
      'fetched by explicit refspec\n'
    )
    git(writer, 'add', 'refspec.txt')
    git(writer, 'commit', '-m', 'refspec source')
    git(writer, 'push', '-u', 'origin', 'refspec-source')
    await openSyncMenu(page)
    await page.getByRole('button', { name: 'Fetch refspec' }).click()
    const refspecDialog = page
      .getByRole('dialog')
      .filter({ hasText: 'Fetch refspec' })
    await refspecDialog
      .getByLabel('Refspec')
      .fill('refs/heads/refspec-source:refs/remotes/origin/refspec-fetched')
    await refspecDialog.getByRole('button', { name: 'Fetch refspec' }).click()
    await waitForOperationDialog(page, 'Fetch refspec')
    await waitForGit(
      repository,
      ['rev-parse', 'refs/remotes/origin/refspec-fetched'],
      git(writer, 'rev-parse', 'refspec-source')
    )

    git(writer, 'checkout', 'main')
    git(writer, 'pull', '--ff-only')
    fs.writeFileSync(path.join(writer, 'README.md'), '# writer rebase\n')
    git(writer, 'commit', '-am', 'writer rebase')
    const writerRebaseTip = git(writer, 'rev-parse', 'HEAD')
    git(writer, 'push', 'origin', 'main')
    fs.writeFileSync(path.join(repository, 'local-rebase.txt'), 'local\n')
    git(repository, 'add', 'local-rebase.txt')
    git(repository, 'commit', '-m', 'local rebase')
    const localRebaseTip = git(repository, 'rev-parse', 'HEAD')
    await openSyncMenu(page)
    await page.getByRole('button', { name: 'Pull strategy' }).click()
    const pullStrategyDialog = page
      .getByRole('dialog')
      .filter({ hasText: 'Pull strategy' })
    await pullStrategyDialog.getByRole('radio', { name: 'Rebase' }).check()
    await pullStrategyDialog
      .getByRole('button', { name: 'Close', exact: true })
      .last()
      .click()
    await openSyncMenu(page)
    await page.getByRole('button', { name: /Pull \(rebase\)/ }).click()
    await waitForGit(repository, ['rev-parse', 'HEAD^'], writerRebaseTip)
    assert.equal(git(repository, 'log', '-1', '--format=%s'), 'local rebase')
    assert.notEqual(git(repository, 'rev-parse', 'HEAD'), localRebaseTip)

    fs.writeFileSync(path.join(repository, 'local-only.txt'), 'local commit\n')
    git(repository, 'add', 'local-only.txt')
    git(repository, 'commit', '-m', 'local commit to discard')
    const localCommit = git(repository, 'rev-parse', 'HEAD')
    fs.writeFileSync(path.join(repository, 'README.md'), '# dirty reset\n')
    await openSyncMenu(page)
    await page.getByRole('button', { name: 'Refresh status' }).click()
    await page
      .locator('.changes-list')
      .getByText('README.md', { exact: true })
      .waitFor()

    await openBranchMenu(page)
    await page
      .getByRole('button', { name: 'Reset and pull', exact: true })
      .click()
    const resetConfirmation = page.getByRole('alertdialog')
    await resetConfirmation.waitFor()
    assert.match(
      await resetConfirmation.innerText(),
      /uncommitted changes will be stashed/i
    )
    await resetConfirmation.getByRole('button', { name: 'Cancel' }).click()
    await resetConfirmation.waitFor({ state: 'hidden' })
    assert.equal(git(repository, 'rev-parse', 'HEAD'), localCommit)
    assert.equal(
      fs.readFileSync(path.join(repository, 'README.md'), 'utf8'),
      '# dirty reset\n'
    )

    await openBranchMenu(page)
    await page
      .getByRole('button', { name: 'Reset and pull', exact: true })
      .click()
    const cancelResetRadio = page
      .getByRole('alertdialog')
      .getByLabel('Leave changes untouched and cancel')
    await cancelResetRadio.check()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Cancel reset' })
      .waitFor()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Cancel reset' })
      .click()
    await page.getByRole('alertdialog').waitFor({ state: 'hidden' })
    await page.reload({ waitUntil: 'networkidle' })
    await openBranchMenu(page)
    await page
      .getByRole('button', { name: 'Reset and pull', exact: true })
      .click()
    assert.equal(
      await page
        .getByRole('alertdialog')
        .getByLabel('Leave changes untouched and cancel')
        .isChecked(),
      true
    )
    await page
      .getByRole('alertdialog')
      .getByLabel('Stash changes before resetting')
      .check()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Stash changes and reset' })
      .click()
    await page.getByRole('alertdialog').waitFor({ state: 'hidden' })
    await waitForRemoteCommit(repository, writerRebaseTip)
    assert.equal(
      fs.readFileSync(path.join(repository, 'README.md'), 'utf8'),
      '# writer rebase\n'
    )
    assert.equal(fs.existsSync(path.join(repository, 'local-only.txt')), false)
    assert.match(
      git(repository, 'stash', 'list'),
      /Changes%20before%20reset%20and%20pull/
    )

    await openBranchMenu(page)
    await page.getByRole('button', { name: 'Create branch' }).click()
    const publishBranchDialog = page
      .getByRole('dialog')
      .filter({ hasText: 'Create branch' })
    await publishBranchDialog.getByLabel('Branch name').fill('publish-me')
    await publishBranchDialog
      .getByRole('button', { name: 'Create branch' })
      .click()
    await waitForGit(repository, ['branch', '--show-current'], 'publish-me')
    await openSyncMenu(page)
    await page.getByRole('button', { name: 'Publish branch' }).click()
    const publishDialog = page
      .getByRole('dialog')
      .filter({ hasText: 'Publish branch' })
    await publishDialog.getByRole('button', { name: 'Publish branch' }).click()
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
    await openSyncMenu(page)
    await page.getByRole('button', { name: 'Fetch', exact: true }).click()
    await openBranchMenu(page)
    await page
      .getByRole('button', {
        name: 'Checkout origin/remote-only',
        exact: true,
      })
      .click()
    const checkoutDialog = page
      .getByRole('dialog')
      .filter({ hasText: 'Checkout remote branch' })
    await checkoutDialog.getByLabel('Local branch name').fill('remote-local')
    await checkoutDialog
      .getByRole('button', { name: 'Checkout branch' })
      .click()
    await waitForGit(repository, ['branch', '--show-current'], 'remote-local')
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
    await openSyncMenu(page)
    await page.getByRole('button', { name: 'Refresh status' }).click()
    await openBranchMenu(page)
    await page
      .getByRole('button', { name: 'Pull stale-main', exact: true })
      .click()
    await waitForGit(repository, ['rev-parse', 'stale-main'], advancedMainTip)
    assert.equal(
      git(repository, 'rev-parse', 'HEAD'),
      currentBeforeFastForward,
      'fast-forwarding a non-current branch must not move the checked-out branch'
    )

    git(writer, 'checkout', 'main')
    git(writer, 'pull', '--ff-only')
    git(writer, 'checkout', '-b', 'prune-me')
    fs.writeFileSync(path.join(writer, 'prune-me.txt'), 'prune me\n')
    git(writer, 'add', 'prune-me.txt')
    git(writer, 'commit', '-m', 'prune me')
    git(writer, 'push', '-u', 'origin', 'prune-me')
    const pruneTip = git(writer, 'rev-parse', 'prune-me')
    git(writer, 'checkout', 'main')
    git(writer, 'pull', '--ff-only')
    git(writer, 'merge', '--ff-only', 'prune-me')
    git(writer, 'push', 'origin', 'main')
    git(repository, 'fetch', 'origin')
    git(repository, 'remote', 'set-head', 'origin', 'main')
    git(repository, 'branch', '--force', 'main', 'origin/main')
    git(repository, 'branch', '--track', 'prune-me', 'origin/prune-me')
    git(writer, 'push', 'origin', '--delete', 'prune-me')
    git(repository, 'fetch', '--prune', 'origin')
    assert.equal(git(repository, 'rev-parse', 'origin/main'), pruneTip)
    await openSyncMenu(page)
    await page.getByRole('button', { name: 'Prune stale branches' }).click()
    const pruneDialog = page.getByRole('alertdialog')
    await pruneDialog.getByText('prune-me', { exact: false }).waitFor()
    await pruneDialog.getByRole('button', { name: 'Cancel' }).click()
    assert.equal(
      git(repository, 'show-ref', '--verify', 'refs/heads/prune-me').length > 0,
      true
    )
    await openSyncMenu(page)
    await page.getByRole('button', { name: 'Prune stale branches' }).click()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Prune branches' })
      .click()
    await waitForMissingGit(repository, [
      'show-ref',
      '--verify',
      'refs/heads/prune-me',
    ])

    assert.deepEqual(errors, [])
    console.log(
      'Source sync workflows passed: push rejection recovery, pull strategies, refspec fetch, reset and pull, publish, remote checkout, branch fast-forward, and stale-branch pruning'
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
