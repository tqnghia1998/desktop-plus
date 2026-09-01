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

async function waitForChecked(locator, expected) {
  for (let attempt = 0; attempt < 50; attempt++) {
    if ((await locator.isChecked()) === expected) return
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  assert.equal(await locator.isChecked(), expected)
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
    const repositoryInspection = page.waitForResponse(
      response =>
        response.url().includes('/api/repository/inspect') &&
        response.status() === 200
    )
    await page.getByLabel('Local path').fill(repository)
    await repositoryInspection
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
    const commitForm = page.getByRole('group', { name: 'Create commit' })
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
    const bFileCheckbox = bFile.locator('input[type="checkbox"]')
    await selectedLine.evaluate(element => element.click())
    await bFileCheckbox.evaluate(element => element.click())
    await page.waitForFunction(
      () =>
        document.querySelector('.diff-container input[id="3-after"]')
          ?.checked === false
    )
    await waitForChecked(bFileCheckbox, false)
    assert.equal(
      await page.locator('.diff-container input[id="3-after"]').isChecked(),
      false,
      'Expected the third line in a.txt to be excluded'
    )
    assert.equal(
      await page
        .getByRole('option', { name: /^b\.txt/ })
        .locator('input[type="checkbox"]')
        .isChecked(),
      false,
      'Expected b.txt to be excluded'
    )
    await commitForm.getByLabel('Commit summary').fill('Partial commit')
    await commitForm
      .getByRole('button', { name: 'Configure commit options' })
      .click()
    await page
      .getByRole('menuitemradio', { name: 'Add Signed-off-by Trailer' })
      .click()
    await commitForm
      .getByRole('button', { name: 'Configure commit options' })
      .click()
    await page
      .getByRole('menuitemradio', { name: 'Bypass Commit Hooks' })
      .click()
    const commitButton = commitForm.getByRole('button', {
      name: /^Commit .* to main$/,
    })
    assert.equal(
      await commitForm.getByLabel('Commit summary').inputValue(),
      'Partial commit'
    )
    assert.equal(
      await page
        .getByRole('option', { name: /^b\.txt/ })
        .locator('input[type="checkbox"]')
        .isChecked(),
      false,
      'Expected b.txt to remain excluded after changing commit options'
    )
    assert.equal(
      await commitButton.isEnabled(),
      true,
      `Commit unexpectedly disabled: ${await commitButton.getAttribute(
        'data-tooltip'
      )}`
    )
    await commitButton.click()
    await waitForGit(repository, ['log', '-1', '--format=%s'], 'Partial commit')
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
    await page.reload({ waitUntil: 'networkidle' })
    const refreshedAFile = page.getByRole('option', { name: /^a\.txt/ })
    await refreshedAFile.waitFor()
    await refreshedAFile.click()
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
    const partialDiscardConfirmation = page
      .getByRole('dialog')
      .filter({ hasText: /Confirm discard changes/i })
    await partialDiscardConfirmation.waitFor()
    await partialDiscardConfirmation
      .getByRole('button', { name: 'Cancel' })
      .waitFor()
    await page.waitForTimeout(350)
    await partialDiscardConfirmation
      .getByRole('button', { name: 'Cancel' })
      .click()
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
      .getByRole('dialog')
      .filter({ hasText: /Confirm discard changes/i })
      .getByRole('button', { name: /Discard changes/i })
      .click()
    await page.waitForFunction(
      () =>
        !document
          .querySelector('.diff-container')
          ?.textContent?.includes('fourth a')
    )
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
    const refreshedBFile = page.getByRole('option', { name: /^b\.txt/ })
    await refreshedBFile.dispatchEvent('contextmenu')
    await page
      .locator('#web-context-menu')
      .getByRole('menuitem', { name: /Discard Changes/i })
      .click()
    const discardConfirmation = page.getByRole('alertdialog')
    await discardConfirmation.waitFor()
    await page.waitForTimeout(350)
    await discardConfirmation.getByRole('button', { name: 'Cancel' }).click()
    await discardConfirmation.waitFor({ state: 'hidden' })
    assert.equal(
      fs.readFileSync(path.join(repository, 'b.txt'), 'utf8'),
      'changed b\n'
    )
    await page
      .getByRole('option', { name: /^b\.txt/ })
      .dispatchEvent('contextmenu')
    await page
      .locator('#web-context-menu')
      .getByRole('menuitem', { name: /Discard Changes/i })
      .click()
    await page.waitForTimeout(350)
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
    const branchPicker = page.locator('.branches-container')
    await branchPicker
      .getByRole('button', { name: /Choose a branch to merge into/i })
      .click()
    const mergeDialog = page
      .getByRole('dialog')
      .filter({ hasText: /Merge into\s*main/i })
    await mergeDialog
      .getByRole('option', { name: /^feature(?:\s|,|$)/ })
      .click()
    await mergeDialog
      .getByRole('button', { name: 'Create a merge commit' })
      .click()
    const mergeErrorDialog = page
      .getByRole('alertdialog')
      .filter({ has: page.getByRole('button', { name: 'Close', exact: true }) })
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll('button')].some(
          button =>
            button.textContent?.trim() === 'Close' ||
            button.textContent?.trim() === 'Use ours'
        ),
      undefined,
      { timeout: 60000 }
    )
    if (await mergeErrorDialog.isVisible()) {
      await page.waitForTimeout(350)
      await mergeErrorDialog.getByText('Close', { exact: true }).click()
      await mergeErrorDialog.waitFor({ state: 'hidden' })
    }
    const conflictsDialog = page
      .getByRole('dialog')
      .filter({ hasText: /Resolve conflicts before Merge/i })
    await conflictsDialog.waitFor()
    await conflictsDialog
      .getByRole('button', { name: 'File resolution options' })
      .click()
    await page
      .locator('#web-context-menu')
      .getByRole('menuitem', { name: /Use the modified file from main/i })
      .click()
    await conflictsDialog
      .getByText(/All conflicted files have been resolved/i)
      .waitFor()
    await conflictsDialog
      .getByRole('button', { name: 'Continue Merge' })
      .click()
    await conflictsDialog.waitFor({
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
    await page.reload({ waitUntil: 'networkidle' })
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
