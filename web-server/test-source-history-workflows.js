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

async function selectCommit(page, summary) {
  const commit = page.locator('#commit-list .list-item').filter({
    has: page.getByText(summary, { exact: true }),
  })
  await commit.first().waitFor()
  await commit.first().click()
  await page.getByRole('button', { name: 'Revert selected commit' }).waitFor()
  const details = page.getByRole('region', { name: 'Commit details' })
  await details.waitFor()
  await page.waitForFunction(
    () =>
      document
        .querySelector('[aria-label="Commit details"]')
        ?.getAttribute('aria-busy') === 'false'
  )
  await details.getByRole('option').first().waitFor()
  return commit
}

async function confirm(page, buttonName) {
  const confirmation = page.getByRole('alertdialog')
  await confirmation.waitFor()
  await confirmation.getByRole('button', { name: buttonName }).click()
  await confirmation.waitFor({ state: 'hidden' })
}

async function closeError(page) {
  const error = page
    .getByRole('dialog')
    .filter({ has: page.getByRole('button', { name: 'Close', exact: true }) })
  await error.waitFor()
  await error.getByText('Close', { exact: true }).click()
  await error.waitFor({ state: 'hidden' })
}

async function addRepository(page, repository) {
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
  }
  await page.getByLabel('Local path').fill(repository)
  await page.getByRole('button', { name: 'Add repository' }).click()
}

async function main() {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'desktop-plus-source-history-')
  )
  const repository = path.join(root, 'repository')
  fs.mkdirSync(repository)
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
    await graphViewButton.click()
    await page.getByRole('complementary', { name: 'History refs' }).waitFor()
    await page.getByText('Local branches (1)', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Collapse Local branches' }).click()
    await page.getByRole('button', { name: 'Expand Local branches' }).waitFor()
    await listViewButton.click()
    await page.getByRole('button', { name: 'List view' }).waitFor()
    await waitForHistory(page, 'change')
    await graphViewButton.click()
    await page.getByRole('button', { name: 'Expand Local branches' }).waitFor()
    await waitForHistory(page, 'change')

    await selectCommit(page, 'change')
    const changeSHA = git(repository, 'rev-parse', 'HEAD')
    await page.getByRole('button', { name: 'Copy SHA' }).click()
    assert.equal(
      await page.evaluate(() => navigator.clipboard.readText()),
      changeSHA
    )
    const commitDetails = page.getByRole('region', {
      name: 'Commit details',
    })
    await commitDetails.getByRole('option', { name: 'file.txt' }).waitFor()
    await commitDetails.getByRole('option', { name: 'file.txt' }).click()
    await commitDetails
      .getByRole('option', { name: 'other.txt' })
      .click({ modifiers: ['Meta'] })
    await commitDetails
      .getByRole('button', { name: 'Copy selected paths' })
      .click()
    assert.equal(
      await page.evaluate(() => navigator.clipboard.readText()),
      `${path.join(repository, 'file.txt')}\n${path.join(
        repository,
        'other.txt'
      )}`
    )
    await commitDetails
      .getByRole('button', { name: 'Copy selected relative paths' })
      .click()
    assert.equal(
      await page.evaluate(() => navigator.clipboard.readText()),
      'file.txt\nother.txt'
    )
    await page.waitForFunction(() =>
      document
        .querySelector('.web-history-diff')
        ?.textContent?.includes('changed')
    )
    assert.match(await commitDetails.innerText(), /2 additions, 2 deletions/)
    assert.match(await page.locator('.web-history-diff').innerText(), /changed/)
    assert.equal(
      await page
        .getByRole('button', { name: 'Revert selected commit' })
        .isEnabled(),
      true
    )
    await page.getByRole('button', { name: 'Revert selected commit' }).click()
    await confirm(page, 'Revert commit')
    assert.match(git(repository, 'log', '-1', '--format=%s'), /^Revert /)
    assert.equal(
      fs.readFileSync(path.join(repository, 'file.txt'), 'utf8'),
      'base\n'
    )

    await page.getByRole('tab', { name: 'Tools' }).click()
    await page
      .getByRole('region', { name: 'Repository tools' })
      .getByRole('button', { name: 'Refresh repository' })
      .click()
    await page.waitForFunction(
      () =>
        document
          .querySelector('[aria-label="Repository tools"]')
          ?.getAttribute('aria-busy') === 'false'
    )
    await page.getByRole('tab', { name: 'History' }).click()
    await waitForHistory(page, 'base')
    await selectCommit(page, 'base')
    assert.equal(
      await page
        .getByRole('button', { name: 'Reset selected commit' })
        .isEnabled(),
      true
    )
    await page.getByRole('button', { name: 'Reset selected commit' }).click()
    const resetDialog = page.getByRole('alertdialog')
    await resetDialog.waitFor()
    assert.equal(
      await resetDialog
        .getByLabel('Mixed reset: keep file changes in the working directory')
        .isChecked(),
      true
    )
    await resetDialog.getByRole('button', { name: 'Mixed reset' }).click()
    await resetDialog.waitFor({ state: 'hidden' })
    assert.equal(git(repository, 'log', '-1', '--format=%s'), 'base')
    assert.equal(
      fs.readFileSync(path.join(repository, 'file.txt'), 'utf8'),
      'base\n'
    )

    fs.writeFileSync(path.join(repository, 'file.txt'), 'post-base\n')
    git(repository, 'commit', '-am', 'post-base')
    const postBaseSHA = git(repository, 'rev-parse', 'HEAD')
    fs.writeFileSync(path.join(repository, 'file.txt'), 'hard reset me\n')
    await page.getByRole('tab', { name: 'Tools' }).click()
    await page
      .getByRole('region', { name: 'Repository tools' })
      .getByRole('button', { name: 'Refresh repository' })
      .click()
    await page.getByRole('tab', { name: 'History' }).click()
    await waitForHistory(page, 'post-base')
    await selectCommit(page, 'base')
    await page.getByRole('button', { name: 'Reset selected commit' }).click()
    const hardResetDialog = page.getByRole('alertdialog')
    await hardResetDialog
      .getByLabel('Hard reset: discard tracked file changes')
      .check()
    await hardResetDialog.getByRole('button', { name: 'Hard reset' }).click()
    await hardResetDialog.waitFor({ state: 'hidden' })
    assert.notEqual(git(repository, 'rev-parse', 'HEAD'), postBaseSHA)
    assert.equal(
      fs.readFileSync(path.join(repository, 'file.txt'), 'utf8'),
      'base\n'
    )

    fs.writeFileSync(path.join(repository, 'file.txt'), 'undo me\n')
    git(repository, 'add', 'file.txt')
    git(repository, 'commit', '-m', 'undo me')
    await page.getByRole('tab', { name: 'Tools' }).click()
    await page
      .getByRole('region', { name: 'Repository tools' })
      .getByRole('button', { name: 'Refresh repository' })
      .click()
    await page.getByRole('tab', { name: 'History' }).click()
    await waitForHistory(page, 'undo me')
    await selectCommit(page, 'undo me')
    assert.equal(
      await page
        .getByRole('button', { name: 'Undo latest commit' })
        .isEnabled(),
      true
    )
    await page.getByRole('button', { name: 'Undo latest commit' }).click()
    await confirm(page, 'Undo commit')
    assert.equal(git(repository, 'log', '-1', '--format=%s'), 'base')
    assert.equal(
      fs.readFileSync(path.join(repository, 'file.txt'), 'utf8'),
      'undo me\n'
    )

    await selectCommit(page, 'base')
    const baseSHA = git(repository, 'rev-parse', 'HEAD')
    await page
      .getByRole('button', { name: 'Create branch at selected commit' })
      .click()
    const branchDialog = page
      .getByRole('dialog')
      .filter({ hasText: 'Create branch at selected commit' })
    await branchDialog.getByLabel('Branch name').fill('history-branch')
    await branchDialog.getByRole('button', { name: 'Create branch' }).click()
    await branchDialog.waitFor({ state: 'hidden' })
    assert.equal(git(repository, 'branch', '--show-current'), 'history-branch')
    assert.equal(git(repository, 'rev-parse', 'HEAD'), baseSHA)

    await waitForHistory(page, 'base')
    await selectCommit(page, 'base')
    await page
      .getByRole('button', { name: 'Create tag at selected commit' })
      .click()
    const tagDialog = page
      .getByRole('dialog')
      .filter({ hasText: 'Create tag at selected commit' })
    await tagDialog.getByLabel('Tag name').fill('history-v1')
    await tagDialog.getByRole('button', { name: 'Create tag' }).click()
    await tagDialog.waitFor({ state: 'hidden' })
    assert.equal(git(repository, 'rev-parse', 'history-v1^{}'), baseSHA)

    await waitForHistory(page, 'base')
    await selectCommit(page, 'base')
    await page.getByRole('button', { name: 'Copy tag' }).click()
    assert.equal(
      await page.evaluate(() => navigator.clipboard.readText()),
      'history-v1'
    )
    await page.getByRole('button', { name: 'Checkout selected commit' }).click()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Cancel' })
      .click()
    assert.equal(git(repository, 'branch', '--show-current'), 'history-branch')
    await page.getByRole('button', { name: 'Checkout selected commit' }).click()
    await confirm(page, 'Checkout commit')
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
    await selectCommit(page, 'change')
    await page.getByRole('button', { name: 'Revert selected commit' }).click()
    await confirm(page, 'Revert commit')
    await closeError(page)
    await page.getByRole('tab', { name: 'Tools' }).click()
    await page
      .getByRole('region', { name: 'Repository tools' })
      .getByRole('button', { name: 'Refresh repository' })
      .click()
    await page.getByRole('tab', { name: 'Changes' }).click()
    await page.getByRole('button', { name: 'Use theirs' }).click()
    await page
      .getByRole('button', { name: 'Use theirs' })
      .waitFor({ state: 'hidden' })
    await page.getByRole('button', { name: 'Continue operation' }).click()
    await page
      .getByRole('button', { name: 'Continue operation' })
      .waitFor({ state: 'hidden' })
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
