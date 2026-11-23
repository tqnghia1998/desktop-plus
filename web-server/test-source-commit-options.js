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
  const repositoryInspection = page.waitForResponse(
    response =>
      response.url().includes('/api/repository/inspect') &&
      response.status() === 200
  )
  await page.getByLabel('Local path').fill(repository)
  await repositoryInspection
  await page.getByRole('button', { name: 'Add repository' }).click()
}

async function waitForOption(page, name, state = 'visible') {
  await page.getByRole('option', { name: new RegExp(`^${name}`) }).waitFor({
    state,
  })
}

function getCommitForm(page) {
  return page.getByRole('group', { name: 'Create commit' })
}

async function setCommitOption(page, commitForm, name, checked) {
  await commitForm
    .getByRole('button', { name: 'Configure commit options' })
    .click()
  const option = page.getByRole('menuitemradio', { name })
  await option.waitFor()
  const currentValue = (await option.getAttribute('aria-checked')) === 'true'
  if (currentValue === checked) {
    await page.keyboard.press('Escape')
  } else {
    await option.click()
  }
}

async function assertCommitOption(page, commitForm, name, checked) {
  await commitForm
    .getByRole('button', { name: 'Configure commit options' })
    .click()
  const option = page.getByRole('menuitemradio', { name })
  await option.waitFor()
  assert.equal((await option.getAttribute('aria-checked')) === 'true', checked)
  await page.keyboard.press('Escape')
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

    let commitForm = getCommitForm(page)
    const commitSummary = commitForm.getByLabel('Commit summary')
    await commitSummary.fill('draft survives section changes')
    await commitSummary.click({ button: 'right' })
    await page
      .getByRole('menuitem', { name: 'Disable Commit Spellcheck' })
      .click()
    await setCommitOption(page, commitForm, /Add Signed-off-by Trailer/i, true)
    await setCommitOption(page, commitForm, /Bypass Commit Hooks/i, true)

    await page.getByRole('tab', { name: 'History' }).click()
    await page.getByRole('tab', { name: 'Changes' }).click()
    commitForm = getCommitForm(page)
    assert.equal(
      await commitForm.getByLabel('Commit summary').inputValue(),
      'draft survives section changes'
    )
    await assertCommitOption(
      page,
      commitForm,
      /Add Signed-off-by Trailer/i,
      true
    )
    await assertCommitOption(page, commitForm, /Bypass Commit Hooks/i, true)
    assert.equal(
      await commitForm.getByLabel('Commit summary').getAttribute('spellcheck'),
      'false'
    )
    const restoredCommitSummary = commitForm.getByLabel('Commit summary')
    await restoredCommitSummary.fill(':hea')
    const heartSuggestion = page.getByRole('option', {
      name: '❤️, heart',
      exact: true,
    })
    await heartSuggestion.waitFor()
    await heartSuggestion.click()
    assert.match(await restoredCommitSummary.inputValue(), /❤️/)

    const filter = page.getByPlaceholder('Filter')
    await filter.fill('a.txt')
    await waitForOption(page, 'b.txt', 'hidden')
    await waitForOption(page, 'a.txt')

    await commitForm.getByLabel('Commit summary').fill('filtered commit')
    await commitForm
      .getByRole('button', { name: /^Commit .* to main$/ })
      .click()

    const filteredCommitConfirmation = page
      .getByRole('alertdialog')
      .filter({ hasText: 'Commit filtered changes?' })
    await filteredCommitConfirmation.waitFor()
    assert.match(await filteredCommitConfirmation.innerText(), /hidden changes/)
    await filteredCommitConfirmation
      .getByRole('button', { name: 'Commit anyway' })
      .click()
    await filteredCommitConfirmation.waitFor({ state: 'hidden' })
    await waitForGit(
      repository,
      ['log', '-1', '--format=%s'],
      'filtered commit'
    )
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
      /Signed-off-by: Source Commit Options <source-commit-options@example.com>/
    )

    await page.getByPlaceholder('Filter').fill('')
    commitForm = getCommitForm(page)
    await commitForm.getByLabel('Commit summary').fill('empty commit')
    await setCommitOption(page, commitForm, /Bypass Commit Hooks/i, false)
    const emptyCommitButton = commitForm.getByRole('button', {
      name: 'Commit to main',
    })
    assert.equal(await emptyCommitButton.isEnabled(), false)
    await setCommitOption(page, commitForm, /Allow Empty Commit/i, true)
    await commitForm.getByLabel('Commit summary').fill('empty commit')
    assert.equal(await emptyCommitButton.isEnabled(), true)
    await emptyCommitButton.click()
    await waitForGit(repository, ['log', '-1', '--format=%s'], 'empty commit')
    assert.equal(
      git(repository, 'show', '--format=', '--name-only', 'HEAD'),
      ''
    )
    assert.deepEqual(
      errors.filter(error => !error.includes('The Git config is locked')),
      []
    )
    console.log(
      'Source commit options passed: draft and option persistence, spellcheck, sign-off, bypass-hooks, filtered changes confirmation, and allow-empty commit'
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
