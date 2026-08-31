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

async function main() {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'desktop-plus-web-source-')
  )
  const repository = path.join(root, 'repository')
  fs.mkdirSync(repository)
  git(repository, 'init', '-b', 'main')
  git(repository, 'config', 'user.name', 'Web Source')
  git(repository, 'config', 'user.email', 'source@example.com')
  fs.writeFileSync(path.join(repository, 'a.txt'), 'base a\n')
  fs.writeFileSync(path.join(repository, 'b.txt'), 'base b\n')
  fs.writeFileSync(path.join(repository, 'conflict.txt'), 'base\n')
  git(repository, 'add', '.')
  git(repository, 'commit', '-m', 'Initial commit')
  git(repository, 'checkout', '-b', 'feature')
  fs.writeFileSync(path.join(repository, 'conflict.txt'), 'feature\n')
  git(repository, 'commit', '-am', 'Feature conflict')
  git(repository, 'checkout', 'main')
  fs.writeFileSync(path.join(repository, 'conflict.txt'), 'main\n')
  git(repository, 'commit', '-am', 'Main conflict')
  fs.writeFileSync(
    path.join(repository, 'a.txt'),
    'base a\nsecond a\nthird a\n'
  )
  fs.writeFileSync(path.join(repository, 'b.txt'), 'changed b\n')

  const server = createServer({ getDesktopRepositories: async () => [] })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  const browser = await launchBrowser()
  try {
    const page = await browser.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(base, { waitUntil: 'networkidle' })
    await page
      .getByRole('button', {
        name: /Add an Existing Repository from your local drive…/i,
      })
      .click()
    await page.getByLabel('Local path').fill(repository)
    await page.getByRole('button', { name: 'Add repository' }).click()
    await page.getByRole('tab', { name: 'Changes' }).waitFor()
    const aFile = page.getByRole('option', { name: /^a\.txt/ })
    const bFile = page.getByRole('option', { name: /^b\.txt/ })
    await aFile.waitFor()
    await bFile.waitFor()
    await aFile.click()
    await page.waitForFunction(() =>
      document
        .querySelector('.diff-container')
        ?.textContent?.includes('second a')
    )
    const diffInputIds = await page
      .locator('.diff-container input')
      .evaluateAll(inputs => inputs.map(input => input.id))
    assert.ok(
      diffInputIds.includes('3-after'),
      `Expected a selectable added-line checkbox. Found: ${diffInputIds.join(
        ', '
      )}`
    )
    const selectedLine = page.locator('.diff-container input[id="3-after"]')
    await selectedLine.click({ force: true })
    await bFile.locator('input[type="checkbox"]').click()
    await page
      .locator('.web-changes-actions')
      .getByRole('button', {
        name: 'Commit',
      })
      .click()
    const commitDialog = page.getByRole('dialog').filter({
      hasText: 'Commit changes',
    })
    await commitDialog.getByLabel('Commit message').fill('Partial commit')
    await commitDialog.getByLabel('Add Signed-off-by trailer').check()
    await commitDialog.getByLabel('Skip commit hooks').check()
    await commitDialog.getByRole('button', { name: 'Commit changes' }).click()
    const noVerifyConfirmation = page.getByRole('alertdialog')
    await noVerifyConfirmation.waitFor()
    await noVerifyConfirmation
      .getByRole('button', {
        name: 'Skip commit hooks',
      })
      .click()
    await noVerifyConfirmation.waitFor({ state: 'hidden' })
    await page
      .getByRole('region', { name: 'Git operation progress' })
      .getByText('Completed', { exact: true })
      .waitFor()
    assert.equal(git(repository, 'log', '-1', '--format=%s'), 'Partial commit')
    assert.equal(
      git(repository, 'show', '--format=', '--name-only', 'HEAD'),
      'a.txt'
    )
    assert.doesNotMatch(
      git(repository, 'show', '--format=', '--name-only', 'HEAD'),
      /b\.txt/
    )
    assert.equal(git(repository, 'show', 'HEAD:a.txt'), 'base a\nsecond a')
    assert.equal(
      fs.readFileSync(path.join(repository, 'a.txt'), 'utf8'),
      'base a\nsecond a\nthird a\n'
    )

    fs.writeFileSync(
      path.join(repository, 'a.txt'),
      'base a\nsecond a\nthird a\nfourth a\n'
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
    await page.getByRole('tab', { name: 'Changes' }).click()
    const refreshedAFile = page.getByRole('option', { name: /^a\.txt/ })
    await refreshedAFile.waitFor()
    await refreshedAFile.click()
    await page.getByRole('group', { name: 'a.txt actions' }).waitFor()
    await page.waitForFunction(() =>
      document
        .querySelector('.diff-container')
        ?.textContent?.includes('fourth a')
    )
    const partialDiscardLine = page
      .getByRole('checkbox', { name: 'Line 4 added', exact: true })
      .locator('xpath=..')
    await partialDiscardLine.waitFor()
    await partialDiscardLine.dispatchEvent('contextmenu')
    const partialDiscardMenu = page.locator('#web-context-menu')
    await partialDiscardMenu.waitFor()
    await partialDiscardMenu
      .getByRole('menuitem', { name: /Discard .*line/i })
      .click()
    const partialDiscardConfirmation = page.getByRole('alertdialog')
    await partialDiscardConfirmation.waitFor()
    await partialDiscardConfirmation
      .getByRole('button', { name: 'Cancel' })
      .waitFor()
    await partialDiscardConfirmation
      .getByRole('button', { name: 'Cancel' })
      .click({ force: true })
    await partialDiscardConfirmation.waitFor({ state: 'hidden' })
    const refreshedPartialDiscardLine = page
      .getByRole('checkbox', { name: 'Line 4 added', exact: true })
      .locator('xpath=..')
    await refreshedPartialDiscardLine.waitFor()
    assert.equal(
      fs.readFileSync(path.join(repository, 'a.txt'), 'utf8'),
      'base a\nsecond a\nthird a\nfourth a\n'
    )
    await refreshedPartialDiscardLine.dispatchEvent('contextmenu')
    await page
      .locator('#web-context-menu')
      .getByRole('menuitem', { name: /Discard .*line/i })
      .click()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Discard selected lines' })
      .click({ force: true })
    await page.waitForFunction(
      () =>
        !document
          .querySelector('.diff-container')
          ?.textContent?.includes('fourth a')
    )
    await page
      .getByRole('region', { name: 'Git operation progress' })
      .getByText('Completed', { exact: true })
      .waitFor()
    for (
      let attempt = 0;
      attempt < 50 &&
      fs.readFileSync(path.join(repository, 'a.txt'), 'utf8') !==
        'base a\nsecond a\nthird a\n';
      attempt++
    )
      await new Promise(resolve => setTimeout(resolve, 100))
    assert.equal(
      fs.readFileSync(path.join(repository, 'a.txt'), 'utf8'),
      'base a\nsecond a\nthird a\n'
    )

    const branchToolbarButton = page
      .locator('.branch-toolbar-button')
      .getByRole('button')
      .last()
    try {
      await page
        .locator('.web-changes-actions')
        .getByRole('button', {
          name: 'Discard',
        })
        .click()
    } catch (error) {
      const dialogs = await page.getByRole('dialog').allTextContents()
      throw new Error(
        `${error.message}\nVisible dialogs:\n${dialogs.join('\n---\n')}`
      )
    }
    const discardConfirmation = page.getByRole('alertdialog')
    await discardConfirmation.waitFor()
    await discardConfirmation.getByRole('button', { name: 'Cancel' }).click()
    await discardConfirmation.waitFor({ state: 'hidden' })
    assert.equal(
      fs.readFileSync(path.join(repository, 'b.txt'), 'utf8'),
      'changed b\n'
    )
    await page
      .locator('.web-changes-actions')
      .getByRole('button', {
        name: 'Discard',
      })
      .click()
    await page
      .getByRole('alertdialog')
      .getByRole('button', {
        name: 'Discard changes',
      })
      .click()
    await page.getByRole('option', { name: /^b\.txt/ }).waitFor({
      state: 'hidden',
    })
    assert.equal(
      fs.readFileSync(path.join(repository, 'b.txt'), 'utf8'),
      'base b\n'
    )

    await branchToolbarButton.focus()
    await branchToolbarButton.press('Enter')
    await page
      .getByRole('button', { name: 'Merge branch', exact: true })
      .click()
    const mergeDialog = page
      .getByRole('dialog')
      .filter({ hasText: 'Merge branch' })
    await mergeDialog.getByRole('button', { name: 'Continue' }).click()
    const mergeErrorDialog = page
      .getByRole('dialog')
      .filter({ hasText: 'git merge exited with 1' })
    await mergeErrorDialog.waitFor()
    await page.waitForTimeout(350)
    await mergeErrorDialog.getByText('Close', { exact: true }).click()
    await mergeErrorDialog.waitFor({ state: 'hidden' })
    try {
      await page.getByRole('button', { name: 'Use ours' }).waitFor()
    } catch {
      throw new Error(
        `Merge did not expose conflict controls:\n${await page
          .locator('body')
          .innerText()}`
      )
    }
    await page.getByRole('button', { name: 'Use ours' }).click()
    await page.getByRole('button', { name: 'Continue operation' }).click()
    await page.getByRole('button', { name: 'Continue operation' }).waitFor({
      state: 'hidden',
    })
    assert.equal(
      fs.existsSync(path.join(repository, '.git', 'MERGE_HEAD')),
      false
    )
    assert.match(
      git(repository, 'log', '-1', '--format=%s'),
      /^Merge (?:branch|commit)/
    )
    assert.equal(
      fs.readFileSync(path.join(repository, 'conflict.txt'), 'utf8'),
      'main\n'
    )

    fs.writeFileSync(path.join(repository, 'a.txt'), 'changed a again\n')
    await page.getByRole('tab', { name: 'Tools' }).click()
    await page
      .getByRole('region', { name: 'Repository tools' })
      .getByRole('button', { name: 'Refresh repository' })
      .click()
    await page.getByRole('tab', { name: 'Changes' }).click()
    await page.getByRole('option', { name: /^a\.txt/ }).click()
    await page.waitForFunction(() =>
      document
        .querySelector('.diff-container')
        ?.textContent?.includes('changed a again')
    )
    assert.match(
      await page.locator('.diff-container').innerText(),
      /changed a again/
    )
    await page.getByRole('tab', { name: 'History' }).click()
    await page
      .getByLabel('Commits')
      .getByText('Initial commit', { exact: true })
      .waitFor()
    assert.match(
      await page.locator('#repository-sidebar').innerText(),
      /Initial commit/
    )
    assert.deepEqual(errors, [])
    console.log(
      'Desktop source renderer passed: partial commit, discard confirmation, conflict recovery, diff, and history'
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
