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

async function addRepository(page, repository) {
  const homeAdd = page.getByRole('button', {
    name: /Add an Existing Repository from your local drive…/i,
  })
  if (await homeAdd.isVisible().catch(() => false)) await homeAdd.click()
  else {
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
}

async function openPreferences(page) {
  await page.getByRole('button', { name: 'Open preferences' }).click()
  const dialog = page.getByRole('dialog').filter({ hasText: 'Preferences' })
  await dialog.waitFor()
  return dialog
}

async function openHistory(page) {
  await page.getByRole('tab', { name: 'History' }).click()
  await page.getByRole('button', { name: 'List view' }).waitFor()
  await page
    .locator('#commit-list')
    .getByText('second commit', { exact: true })
    .waitFor()
}

async function selectListCommit(page) {
  const row = page.locator('#commit-list .list-item').filter({
    has: page.getByText('second commit', { exact: true }),
  })
  await row.click()
  await page.getByRole('button', { name: 'Revert selected commit' }).waitFor()
  return row
}

async function main() {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'desktop-plus-source-preferences-history-')
  )
  const repository = path.join(root, 'repository')
  fs.mkdirSync(repository)
  git(repository, 'init', '-b', 'main')
  git(repository, 'config', 'user.name', 'Preferences History')
  git(repository, 'config', 'user.email', 'preferences-history@example.com')
  fs.writeFileSync(path.join(repository, 'file.txt'), 'one\n')
  git(repository, 'add', 'file.txt')
  git(repository, 'commit', '-m', 'first commit')
  fs.writeFileSync(path.join(repository, 'file.txt'), 'two\n')
  git(repository, 'commit', '-am', 'second commit')
  const secondCommitSHA = git(repository, 'rev-parse', 'HEAD')

  const server = createServer({ getDesktopRepositories: async () => [] })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const browser = await launchBrowser()

  try {
    const page = await browser.newPage()
    await page.goto(`http://127.0.0.1:${server.address().port}`, {
      waitUntil: 'networkidle',
    })
    await addRepository(page, repository)

    let preferences = await openPreferences(page)
    const threshold = preferences.getByLabel('Commit summary warning length')
    await threshold.fill('60')
    await preferences
      .getByLabel('Always bring my changes to my new branch')
      .check()
    await preferences
      .locator('.dialog-footer')
      .getByRole('button', { name: 'Close', exact: true })
      .click()
    await preferences.waitFor({ state: 'hidden' })

    await page.reload({ waitUntil: 'networkidle' })
    preferences = await openPreferences(page)
    assert.equal(await threshold.inputValue(), '60')
    assert.equal(
      await preferences
        .getByLabel('Always bring my changes to my new branch')
        .isChecked(),
      true
    )
    await preferences
      .locator('.dialog-footer')
      .getByRole('button', { name: 'Close', exact: true })
      .click()
    await preferences.waitFor({ state: 'hidden' })

    await openHistory(page)
    const listRow = await selectListCommit(page)
    assert.equal(await listRow.getAttribute('aria-selected'), 'true')

    await page.reload({ waitUntil: 'networkidle' })
    await openHistory(page)
    const restoredListRow = page.locator('#commit-list .list-item').filter({
      has: page.getByText('second commit', { exact: true }),
    })
    assert.equal(await restoredListRow.getAttribute('aria-selected'), 'true')
    await page.getByRole('button', { name: 'Graph view' }).click()
    await page.getByRole('complementary', { name: 'History refs' }).waitFor()

    const graphCommit = page
      .locator('[aria-label="Commits"] [aria-selected]')
      .filter({ hasText: 'second commit' })
    await graphCommit.click()
    await page.getByRole('button', { name: 'Revert selected commit' }).waitFor()
    assert.equal(await graphCommit.getAttribute('aria-selected'), 'true')

    await page.getByRole('button', { name: 'List view' }).click()
    await page
      .locator('#commit-list')
      .getByText('second commit', { exact: true })
      .waitFor()
    assert.equal(
      await page
        .locator('#commit-list .list-item')
        .filter({ has: page.getByText('second commit', { exact: true }) })
        .getAttribute('aria-selected'),
      'true'
    )

    await page.getByRole('button', { name: 'Graph view' }).click()
    await page.getByRole('complementary', { name: 'History refs' }).waitFor()
    const restoredGraphCommit = page
      .locator('[aria-label="Commits"] [aria-selected]')
      .filter({ hasText: 'second commit' })
    assert.equal(
      await restoredGraphCommit.getAttribute('aria-selected'),
      'true'
    )
    assert.equal(
      await page
        .evaluate(() => {
          const values = Object.keys(localStorage)
            .filter(key => key.includes('desktop-plus-history-selection'))
            .map(key => [key, localStorage.getItem(key)])
          return values
        })
        .then(values =>
          values.some(
            ([key, value]) =>
              key.endsWith(':main:list') &&
              value === JSON.stringify([secondCommitSHA])
          )
        ),
      true
    )
    console.log(
      'Source preferences/history evidence passed: persisted commit threshold, checkout strategy, and list/graph history selection'
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
