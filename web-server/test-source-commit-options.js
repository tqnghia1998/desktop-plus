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

async function waitForGit(cwd, args, expected) {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (git(cwd, ...args) === expected) return
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  assert.equal(git(cwd, ...args), expected)
}

async function addRepository(page, repository) {
  await page
    .getByRole('button', {
      name: /Add an Existing Repository from your local drive…/i,
    })
    .click()
  await page.getByLabel('Local path').fill(repository)
  await page.getByRole('button', { name: 'Add repository' }).click()
}

async function waitForOption(page, name, state = 'visible') {
  await page.getByRole('option', { name: new RegExp(`^${name}`) }).waitFor({
    state,
  })
}

async function main() {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'desktop-plus-source-commit-options-')
  )
  const home = path.join(root, 'home')
  fs.mkdirSync(home)
  process.env.HOME = home
  process.env.GIT_CONFIG_NOSYSTEM = '1'
  const repository = path.join(root, 'repository')
  fs.mkdirSync(repository)
  git(repository, 'init', '-b', 'main')
  git(repository, 'config', 'user.name', 'Source Commit Options')
  git(repository, 'config', 'user.email', 'source-commit-options@example.com')
  fs.writeFileSync(path.join(repository, 'a.txt'), 'base a\n')
  fs.writeFileSync(path.join(repository, 'b.txt'), 'base b\n')
  git(repository, 'add', '.')
  git(repository, 'commit', '-m', 'initial')
  git(repository, 'config', '--unset-all', 'user.name')
  git(repository, 'config', '--unset-all', 'user.email')

  fs.writeFileSync(path.join(repository, 'a.txt'), 'changed a\n')
  fs.writeFileSync(path.join(repository, 'b.txt'), 'changed b\n')

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
    await addRepository(page, repository)
    await waitForOption(page, 'a.txt')
    await waitForOption(page, 'b.txt')

    await page
      .locator('.web-changes-actions')
      .getByRole('button', { name: 'Commit', exact: true })
      .click()
    const missingIdentityDialog = page.getByRole('dialog').filter({
      hasText: 'Commit changes',
    })
    await missingIdentityDialog.getByRole('alert').waitFor()
    assert.equal(
      await missingIdentityDialog
        .getByRole('button', { name: 'Commit changes', exact: true })
        .isEnabled(),
      false
    )
    await missingIdentityDialog
      .getByRole('button', { name: 'Configure Git user' })
      .click()
    const identityDialog = page.getByRole('dialog').filter({
      hasText: 'Configure Git user',
    })
    await identityDialog.getByLabel('Name').fill('Configured Source User')
    await identityDialog
      .getByLabel('Email')
      .fill('configured-source@example.com')
    const configLockPath = path.join(repository, '.git', 'config.lock')
    fs.writeFileSync(configLockPath, 'stale config lock\n')
    await identityDialog.getByRole('button', { name: 'Save Git user' }).click()
    const configLockError = page.locator('dialog.error')
    await configLockError
      .getByRole('button', { name: 'Recover stale config lock' })
      .waitFor()
    const staleTime = new Date(Date.now() - 10 * 60 * 1000)
    fs.utimesSync(configLockPath, staleTime, staleTime)
    await configLockError
      .getByRole('button', { name: 'Recover stale config lock' })
      .click()
    await configLockError.waitFor({ state: 'hidden' })
    await identityDialog.waitFor()
    await identityDialog.getByRole('button', { name: 'Cancel' }).click()
    await identityDialog.waitFor({ state: 'hidden' })
    const reopenedCommitDialog = page.getByRole('dialog').filter({
      hasText: 'Commit changes',
    })
    await page
      .locator('.web-changes-actions')
      .getByRole('button', { name: 'Commit', exact: true })
      .click()
    await reopenedCommitDialog.waitFor()
    await reopenedCommitDialog.getByRole('button', { name: 'Cancel' }).click()
    await reopenedCommitDialog.waitFor({ state: 'hidden' })

    await page
      .locator('.web-changes-actions')
      .getByRole('button', { name: 'Commit', exact: true })
      .click()
    const persistedCommitDialog = page.getByRole('dialog').filter({
      hasText: 'Commit changes',
    })
    await persistedCommitDialog
      .getByLabel('Commit message')
      .fill('draft survives section changes')
    await persistedCommitDialog
      .locator('#web-commit-coauthors')
      .fill('Reviewer <reviewer@example.com>')
    await persistedCommitDialog.getByLabel('Enable commit spellcheck').uncheck()
    await persistedCommitDialog.getByLabel('Add Signed-off-by trailer').check()
    await persistedCommitDialog.getByLabel('Skip commit hooks').check()
    await persistedCommitDialog.getByRole('button', { name: 'Cancel' }).click()
    await persistedCommitDialog.waitFor({ state: 'hidden' })

    await page.getByRole('tab', { name: 'History' }).click()
    await page.getByRole('tab', { name: 'Changes' }).click()
    await page
      .locator('.web-changes-actions')
      .getByRole('button', { name: 'Commit', exact: true })
      .click()
    const restoredCommitDialog = page.getByRole('dialog').filter({
      hasText: 'Commit changes',
    })
    assert.equal(
      await restoredCommitDialog.getByLabel('Commit message').inputValue(),
      'draft survives section changes'
    )
    assert.equal(
      await restoredCommitDialog.locator('#web-commit-coauthors').inputValue(),
      'Reviewer <reviewer@example.com>'
    )
    assert.equal(
      await restoredCommitDialog
        .getByLabel('Enable commit spellcheck')
        .isChecked(),
      false
    )
    assert.equal(
      await restoredCommitDialog
        .getByLabel('Add Signed-off-by trailer')
        .isChecked(),
      true
    )
    assert.equal(
      await restoredCommitDialog.getByLabel('Skip commit hooks').isChecked(),
      true
    )
    assert.equal(
      await restoredCommitDialog
        .getByLabel('Commit message')
        .getAttribute('spellcheck'),
      'false'
    )
    const commitMessage = restoredCommitDialog.getByLabel('Commit message')
    await commitMessage.fill(':hea')
    const heartSuggestion = page.getByRole('option', {
      name: '❤️, heart',
      exact: true,
    })
    await heartSuggestion.waitFor()
    await heartSuggestion.click()
    assert.match(await commitMessage.inputValue(), /❤️/)
    await restoredCommitDialog
      .locator('#web-commit-coauthors')
      .fill('not a trailer')
    await restoredCommitDialog
      .getByRole('button', { name: 'Commit changes', exact: true })
      .click()
    await restoredCommitDialog
      .getByRole('alert')
      .filter({ hasText: 'Name <email>' })
      .waitFor()
    await restoredCommitDialog
      .locator('#web-commit-coauthors')
      .fill('Reviewer <reviewer@example.com>')
    await restoredCommitDialog.getByRole('button', { name: 'Cancel' }).click()
    await restoredCommitDialog.waitFor({ state: 'hidden' })

    const filter = page.getByPlaceholder('Filter')
    await filter.fill('a.txt')
    await waitForOption(page, 'b.txt', 'hidden')
    await waitForOption(page, 'a.txt')

    await page
      .locator('.web-changes-actions')
      .getByRole('button', { name: 'Commit', exact: true })
      .click()
    const filteredCommitDialog = page.getByRole('dialog').filter({
      hasText: 'Commit changes',
    })
    await filteredCommitDialog
      .getByLabel('Commit message')
      .fill('filtered commit')
    await filteredCommitDialog
      .getByRole('button', { name: 'Commit changes', exact: true })
      .click()

    const filteredCommitConfirmation = page
      .getByRole('alertdialog')
      .filter({ hasText: 'Commit filtered changes?' })
    await filteredCommitConfirmation.waitFor()
    assert.match(
      await filteredCommitConfirmation.innerText(),
      /hides 1 included file/
    )
    await filteredCommitConfirmation
      .getByRole('button', { name: 'Commit hidden changes' })
      .click()
    await filteredCommitConfirmation.waitFor({ state: 'hidden' })
    const noVerifyConfirmation = page.getByRole('alertdialog')
    await noVerifyConfirmation
      .getByRole('button', { name: 'Skip commit hooks' })
      .click()
    await waitForGit(
      repository,
      ['log', '-1', '--format=%s'],
      'filtered commit'
    )
    await noVerifyConfirmation.waitFor({ state: 'hidden' })
    assert.match(
      git(repository, 'show', '--format=', '--name-only', 'HEAD'),
      /a\.txt/
    )
    assert.match(
      git(repository, 'show', '--format=', '--name-only', 'HEAD'),
      /b\.txt/
    )
    assert.match(
      git(repository, 'log', '-1', '--format=%B'),
      /Co-Authored-By: Reviewer <reviewer@example.com>/
    )
    assert.match(
      git(repository, 'log', '-1', '--format=%B'),
      /Signed-off-by: Configured Source User <configured-source@example.com>/
    )

    await page
      .locator('.web-changes-actions')
      .getByRole('button', { name: 'Commit', exact: true })
      .click()
    const emptyCommitDialog = page.getByRole('dialog').filter({
      hasText: 'Commit changes',
    })
    await emptyCommitDialog.getByLabel('Commit message').fill('empty commit')
    await emptyCommitDialog.getByLabel('Skip commit hooks').uncheck()
    const emptyCommitButton = emptyCommitDialog.getByRole('button', {
      name: 'Commit changes',
      exact: true,
    })
    assert.equal(await emptyCommitButton.isEnabled(), false)
    await emptyCommitDialog.getByLabel('Allow an empty commit').check()
    assert.equal(await emptyCommitButton.isEnabled(), true)
    await emptyCommitButton.click()
    await emptyCommitDialog.waitFor({ state: 'hidden' })
    await page
      .getByRole('region', { name: 'Git operation progress' })
      .getByText('Completed', { exact: true })
      .waitFor()
    assert.equal(git(repository, 'log', '-1', '--format=%s'), 'empty commit')
    assert.equal(
      git(repository, 'show', '--format=', '--name-only', 'HEAD'),
      ''
    )
    assert.deepEqual(
      errors.filter(error => !error.includes('The Git config is locked')),
      []
    )
    console.log(
      'Source commit options passed: missing identity recovery, draft and option persistence, spellcheck, co-author validation and trailers, filtered included-file warning, no-verify confirmation, and allow-empty commit'
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
