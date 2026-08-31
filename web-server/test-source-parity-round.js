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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function addRepositoryFromHome(page, repository) {
  await page
    .getByRole('button', {
      name: /Add an Existing Repository from your local drive…/i,
    })
    .click()
  await page.getByLabel('Local path').fill(repository)
  await page.getByRole('button', { name: 'Add repository' }).click()
}

async function openRepositoryPicker(page) {
  const button = page.locator('.sidebar-section').getByRole('button').first()
  await button.click()
  await page.getByLabel('Filter repositories').waitFor()
}

async function visibleRepositoryNames(page) {
  return page
    .locator('.repository-list-item')
    .evaluateAll(items =>
      items
        .map(item => item.querySelector('.name')?.textContent?.trim())
        .filter(name => name)
    )
}

async function waitForRepository(page, repository) {
  await page.waitForFunction(
    expected =>
      document
        .querySelector('.repository-list')
        ?.textContent?.includes(expected),
    path.basename(repository)
  )
}

async function waitForVisibleOption(page, name, visible = true) {
  await page.getByRole('option', { name: new RegExp(`^${name}`) }).waitFor({
    state: visible ? 'visible' : 'hidden',
  })
}

async function waitForHistory(page, summary, visible = true) {
  await page
    .getByLabel('Commits')
    .getByText(summary, { exact: true })
    .waitFor({ state: visible ? 'visible' : 'hidden' })
}

function createRepository(root, name) {
  const repository = path.join(root, name)
  fs.mkdirSync(repository)
  git(repository, 'init', '-b', 'main')
  git(repository, 'config', 'user.name', 'Parity Round')
  git(repository, 'config', 'user.email', 'parity-round@example.com')
  fs.writeFileSync(path.join(repository, 'README.md'), `${name}\n`)
  git(repository, 'add', 'README.md')
  git(repository, 'commit', '-m', `${name} initial`)
  return repository
}

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-plus-parity-'))
  const repository = createRepository(root, 'repository')
  const secondRepository = createRepository(root, 'second-repository')
  const repositoryRemote = path.join(root, 'repository-remote.git')
  fs.mkdirSync(repositoryRemote)
  git(repositoryRemote, 'init', '--bare')
  git(repository, 'remote', 'add', 'origin', repositoryRemote)
  git(repository, 'push', '-u', 'origin', 'main')
  git(repository, 'branch', 'feature/search-target')
  git(repository, 'branch', 'other-branch')
  git(repository, 'checkout', 'feature/search-target')
  git(repository, 'checkout', 'main')

  fs.writeFileSync(path.join(repository, 'modified.txt'), 'base\n')
  fs.writeFileSync(
    path.join(repository, 'syntax.ts'),
    'const answer: number = 1\n'
  )
  fs.writeFileSync(path.join(repository, 'deleted.txt'), 'delete me\n')
  fs.writeFileSync(
    path.join(repository, 'whole-file.txt'),
    Array.from({ length: 60 }, (_, index) => `line ${index + 1}`).join('\n') +
      '\n'
  )
  git(repository, 'add', '.')
  git(repository, 'commit', '-m', 'status fixtures')
  fs.writeFileSync(path.join(repository, 'history.txt'), 'base\n')
  git(repository, 'add', 'history.txt')
  git(repository, 'commit', '-m', 'summary search target')
  fs.writeFileSync(path.join(repository, 'history.txt'), 'body search target\n')
  git(
    repository,
    '-c',
    'user.name=Author Search Target',
    '-c',
    'user.email=author-search@example.com',
    'commit',
    '-am',
    'ordinary summary\n\nbody search target'
  )
  fs.writeFileSync(path.join(repository, 'history.txt'), 'tagged change\n')
  git(repository, 'commit', '-am', 'ordinary tagged commit')
  git(repository, 'tag', '-a', 'history-search-tag', '-m', 'tag message')

  fs.writeFileSync(path.join(repository, 'modified.txt'), 'changed\n')
  fs.writeFileSync(
    path.join(repository, 'syntax.ts'),
    'const answer: string = "highlighted"\n'
  )
  fs.unlinkSync(path.join(repository, 'deleted.txt'))
  fs.writeFileSync(path.join(repository, 'new.txt'), 'new\n')
  fs.writeFileSync(
    path.join(repository, 'whole-file.txt'),
    Array.from({ length: 60 }, (_, index) =>
      index === 29 ? 'changed line 30' : `line ${index + 1}`
    ).join('\n') + '\n'
  )
  fs.writeFileSync(path.join(repository, 'ignore-me.log'), 'ignore me\n')
  fs.writeFileSync(path.join(repository, 'pattern-match.cfg'), 'pattern\n')

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

    await addRepositoryFromHome(page, repository)
    const branchButton = page.locator(
      '.branch-toolbar-button > .toolbar-button > button'
    )
    await branchButton.focus()
    await branchButton.click()
    const branchPicker = page.locator('.web-branch-picker')
    await branchPicker.getByText('Default branch', { exact: true }).waitFor()
    await branchPicker.getByText('Recent branches', { exact: true }).waitFor()
    await branchPicker.getByText('Local branches', { exact: true }).waitFor()
    await branchPicker
      .getByRole('button', { name: /Switch to main, default branch/ })
      .waitFor()
    const branchFilter = branchPicker.getByLabel('Filter branches')
    await branchFilter.fill('search-target')
    await branchPicker
      .getByRole('button', { name: 'Switch to feature/search-target' })
      .waitFor()
    assert.equal(
      await branchPicker
        .getByRole('button', { name: 'Switch to other-branch' })
        .count(),
      0
    )
    await branchButton.press('Escape')
    await page.getByRole('tab', { name: 'Changes' }).waitFor()
    await waitForVisibleOption(page, 'modified.txt')
    await waitForVisibleOption(page, 'deleted.txt')
    await waitForVisibleOption(page, 'new.txt')
    await page.getByRole('option', { name: /^modified\.txt/ }).click()
    await page.waitForFunction(() =>
      document
        .querySelector('.diff-container')
        ?.textContent?.includes('changed')
    )
    const diffOptions = page.getByRole('button', {
      name: /Diff (Options|Settings)/,
    })
    await diffOptions.click()
    const diffPopover = page.getByRole('dialog').filter({
      hasText: /Diff (Options|Settings)/,
    })
    await diffPopover.getByLabel('Split').check()
    await diffPopover.getByLabel(/Wrap lines/i).uncheck()
    await diffPopover.getByLabel(/Show minimap/i).check()
    await diffPopover.getByLabel(/Hide whitespace changes/i).check()
    await diffOptions.click()
    await page.getByRole('tab', { name: 'History' }).click()
    await waitForHistory(page, 'ordinary tagged commit')
    await page.getByRole('tab', { name: 'Changes' }).click()
    await page.getByRole('option', { name: /^modified\.txt/ }).click()
    await page.getByRole('button', { name: /Diff (Options|Settings)/ }).click()
    const persistedDiffPopover = page.getByRole('dialog').filter({
      hasText: /Diff (Options|Settings)/,
    })
    assert.equal(
      await persistedDiffPopover.getByLabel('Split').isChecked(),
      true
    )
    assert.equal(
      await persistedDiffPopover.getByLabel(/Wrap lines/i).isChecked(),
      false
    )
    assert.equal(
      await persistedDiffPopover.getByLabel(/Show minimap/i).isChecked(),
      true
    )
    assert.equal(
      await persistedDiffPopover
        .getByLabel(/Hide whitespace changes/i)
        .isChecked(),
      true
    )
    await page.getByRole('button', { name: /Diff (Options|Settings)/ }).click()
    await page.getByRole('option', { name: /^whole-file\.txt/ }).click()
    await page.waitForFunction(() =>
      document
        .querySelector('.diff-container')
        ?.textContent?.includes('changed line 30')
    )
    await page.getByRole('button', { name: 'Show whole file' }).click()
    await page.getByRole('button', { name: 'Show compact diff' }).waitFor()
    const wholeFileDiff = page.locator('.diff-container')
    await wholeFileDiff
      .locator('.content-text')
      .filter({ hasText: 'line 1' })
      .first()
      .waitFor()
    const diffList = wholeFileDiff.locator('.side-by-side-diff-list')
    await diffList.locator('.ReactVirtualized__Grid').evaluate(element => {
      const scrollable = element
      scrollable.scrollTop = scrollable.scrollHeight
      scrollable.dispatchEvent(new Event('scroll', { bubbles: true }))
    })
    await wholeFileDiff
      .locator('.content-text')
      .filter({ hasText: 'line 60' })
      .first()
      .waitFor()
    await page.keyboard.press('Meta+f')
    const diffSearch = page.locator('.diff-search input').first()
    await diffSearch.waitFor()
    await diffSearch.fill('changed')
    await diffSearch.press('Enter')
    assert.equal(await diffSearch.getAttribute('placeholder'), 'Search…')
    await diffSearch.press('Escape')
    await diffSearch.waitFor({ state: 'hidden' })

    await page.getByRole('option', { name: /^syntax\.ts/ }).click()
    await page.waitForFunction(
      () => document.querySelectorAll('.diff-container .cm-keyword').length > 0
    )

    const filters = page.getByRole('group', { name: 'Changes filters' })
    await filters.getByRole('button', { name: 'New', exact: true }).click()
    await waitForVisibleOption(page, 'new.txt')
    await waitForVisibleOption(page, 'modified.txt', false)
    await waitForVisibleOption(page, 'deleted.txt', false)

    await page.getByRole('button', { name: 'Exclude visible' }).click()
    await filters.getByRole('button', { name: 'Excluded', exact: true }).click()
    await waitForVisibleOption(page, 'new.txt')
    await filters.getByRole('button', { name: 'Clear filters' }).click()
    await waitForVisibleOption(page, 'modified.txt')
    await waitForVisibleOption(page, 'deleted.txt')

    const ignoreActions = pathName =>
      page.getByRole('group', { name: `${pathName} actions` })
    await page.getByRole('option', { name: /^ignore-me\.log/ }).click()
    try {
      await ignoreActions('ignore-me.log')
        .getByRole('button', { name: 'Ignore file' })
        .click()
    } catch (error) {
      throw new Error(
        `${error.message}\nGroups: ${await page
          .locator('[aria-label="ignore-me.log actions"]')
          .count()}\nHTML: ${await page
          .locator('[aria-label="ignore-me.log actions"]')
          .allTextContents()}\nBody:\n${await page.locator('body').innerText()}`
      )
    }
    await page.getByRole('option', { name: /^ignore-me\.log/ }).waitFor({
      state: 'hidden',
    })
    assert.match(
      fs.readFileSync(path.join(repository, '.gitignore'), 'utf8'),
      /ignore-me\.log/
    )

    await page.getByRole('option', { name: /^pattern-match\.cfg/ }).click()
    await ignoreActions('pattern-match.cfg')
      .getByRole('button', { name: /Ignore \.cfg files/ })
      .click()
    await page
      .getByRole('option', { name: /^pattern-match\.cfg/ })
      .waitFor({ state: 'hidden' })
    assert.match(
      fs.readFileSync(path.join(repository, '.gitignore'), 'utf8'),
      /\*\.cfg/
    )

    await page.getByRole('option', { name: /^modified\.txt/ }).click()
    const modifiedActions = ignoreActions('modified.txt')
    await modifiedActions.getByRole('button', { name: 'Copy path' }).click()
    assert.equal(
      await page.evaluate(() => navigator.clipboard.readText()),
      path.join(repository, 'modified.txt')
    )
    await modifiedActions
      .getByRole('button', { name: 'Copy relative path' })
      .click()
    assert.equal(
      await page.evaluate(() => navigator.clipboard.readText()),
      'modified.txt'
    )

    await page.getByRole('option', { name: /^new\.txt/ }).click()
    try {
      await ignoreActions('new.txt')
        .getByRole('button', { name: 'Copy included paths' })
        .click()
    } catch (error) {
      throw new Error(
        `${error.message}\nnew actions:\n${await ignoreActions(
          'new.txt'
        ).innerText()}\noptions:\n${await page
          .getByRole('option')
          .allTextContents()}`
      )
    }
    assert.deepEqual(
      new Set(
        (await page.evaluate(() => navigator.clipboard.readText())).split('\n')
      ),
      new Set([
        path.join(repository, 'deleted.txt'),
        path.join(repository, 'modified.txt'),
        path.join(repository, '.gitignore'),
        path.join(repository, 'new.txt'),
        path.join(repository, 'syntax.ts'),
        path.join(repository, 'whole-file.txt'),
      ])
    )

    await openRepositoryPicker(page)
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await page.getByLabel('Local path').fill(secondRepository)
    await page.getByRole('button', { name: 'Add repository' }).click()

    await openRepositoryPicker(page)
    await page
      .getByRole('button', {
        name: `Edit ${path.basename(secondRepository)}`,
      })
      .click()
    const repositorySettings = page
      .getByRole('dialog')
      .filter({ hasText: 'Repository settings' })
    await repositorySettings.getByLabel('Group').fill('Parity group')
    await repositorySettings
      .getByRole('button', {
        name: 'Save repository',
      })
      .click()
    await page.getByText('Parity group', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Rename Parity group' }).click()
    const renameGroupDialog = page
      .getByRole('dialog')
      .filter({ hasText: 'Rename group: Parity group' })
    await renameGroupDialog.getByLabel('Group name').fill('Renamed group')
    await renameGroupDialog
      .getByRole('button', { name: 'Rename group' })
      .click()
    await page.getByText('Renamed group', { exact: true }).waitFor()
    await page.reload({ waitUntil: 'networkidle' })
    await openRepositoryPicker(page)
    await page.getByText('Renamed group', { exact: true }).waitFor()
    await page.getByText('Parity group', { exact: true }).waitFor({
      state: 'hidden',
    })
    const repositoryNames = await visibleRepositoryNames(page)
    assert.equal(
      repositoryNames.filter(name => name === path.basename(repository)).length,
      1
    )
    assert.equal(
      repositoryNames.filter(name => name === path.basename(secondRepository))
        .length,
      1
    )
    const repositoryFilter = page.getByLabel('Filter repositories')
    await repositoryFilter.fill('second')
    await waitForRepository(page, secondRepository)
    assert.equal(
      await page
        .locator('.repository-list-item')
        .filter({
          hasText: new RegExp(`^${escapeRegExp(path.basename(repository))}$`),
        })
        .count(),
      0
    )
    await repositoryFilter.fill('')
    const pinButton = page.getByRole('button', {
      name: `Pin ${path.basename(repository)}`,
    })
    // The repository picker can be taller than the headless viewport when
    // indicators and worktree rows are enabled. Trigger the same DOM click
    // after Playwright has resolved the visible control.
    await pinButton.evaluate(button => button.click())
    await page.getByText('Pinned', { exact: true }).waitFor()
    assert.equal(
      await page
        .getByRole('button', {
          name: `Unpin ${path.basename(repository)}`,
        })
        .count(),
      1
    )
    await page.reload({ waitUntil: 'networkidle' })
    await openRepositoryPicker(page)
    assert.equal(
      await page
        .getByRole('button', {
          name: `Unpin ${path.basename(repository)}`,
        })
        .count(),
      1
    )
    await page
      .getByRole('button', {
        name: `Unpin ${path.basename(repository)}`,
      })
      .click()
    await page
      .getByRole('button', { name: 'Pull Repositories' })
      .evaluate(button => button.click())
    await page.keyboard.press('Escape')
    await page
      .getByRole('tab', { name: 'Tools' })
      .evaluate(button => button.click())
    await page.waitForFunction(
      () =>
        document
          .querySelector('.web-tools-panel')
          ?.getAttribute('aria-busy') === 'false'
    )
    const removeRepositoryButton = page.getByRole('button', {
      name: `Remove ${path.basename(secondRepository)}`,
    })
    await removeRepositoryButton.evaluate(button => button.click())
    const removeDialog = page.getByRole('alertdialog')
    await removeDialog
      .getByRole('button', { name: 'Remove repository' })
      .click()
    assert.equal(
      await page
        .locator('.repository-list-item')
        .filter({ hasText: path.basename(secondRepository) })
        .count(),
      0
    )

    fs.writeFileSync(path.join(repository, 'inline-stash.txt'), 'changed\n')
    git(repository, 'add', 'inline-stash.txt')
    git(repository, 'stash', 'push', '-m', 'inline stash')
    await page.reload({ waitUntil: 'networkidle' })
    await page.getByRole('tab', { name: 'Changes' }).click()
    const inlineStashes = page.getByRole('region', { name: 'Stashes' })
    await inlineStashes.getByText(/inline stash on main/).waitFor()
    await inlineStashes
      .getByRole('button', { name: /inline stash on main/ })
      .click()
    const stashInspection = page.getByRole('region', {
      name: 'Stash inspection',
    })
    await stashInspection.getByRole('option').first().waitFor()
    await stashInspection
      .getByRole('option', { name: 'inline-stash.txt' })
      .click()
    await page.waitForFunction(() =>
      document
        .querySelector('.web-stash-diff')
        ?.textContent?.includes('changed')
    )
    await stashInspection.getByRole('button', { name: 'Close' }).click()
    await inlineStashes.getByRole('button', { name: 'Rename' }).click()
    const inlineRenameDialog = page
      .getByRole('dialog')
      .filter({ hasText: 'Rename stash' })
    await inlineRenameDialog
      .getByLabel('Stash name')
      .fill('renamed inline stash')
    await inlineRenameDialog
      .getByRole('button', { name: 'Rename stash' })
      .click()
    await inlineStashes.getByText(/renamed inline stash on main/).waitFor()
    await inlineStashes.getByRole('button', { name: 'Drop' }).click()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Drop stash' })
      .click()
    await inlineStashes
      .getByText(/renamed inline stash on main/)
      .waitFor({ state: 'hidden' })
    assert.doesNotMatch(
      git(repository, 'stash', 'list'),
      /renamed%20inline%20stash/
    )

    await page.getByRole('tab', { name: 'History' }).click()
    await waitForHistory(page, 'ordinary tagged commit')
    const historyFilter = page.getByLabel('Search commits')

    await historyFilter.fill('summary search target')
    await waitForHistory(page, 'summary search target')
    await waitForHistory(page, 'ordinary tagged commit', false)

    await historyFilter.fill('body search target')
    await waitForHistory(page, 'ordinary summary')

    await historyFilter.fill('author-search@example.com')
    await waitForHistory(page, 'ordinary summary')

    const taggedSHA = git(repository, 'rev-parse', 'history-search-tag^{}')
    await historyFilter.fill(taggedSHA.slice(0, 12))
    await waitForHistory(page, 'ordinary tagged commit')

    await historyFilter.fill('history-search-tag')
    await waitForHistory(page, 'ordinary tagged commit')

    assert.deepEqual(errors, [])
    console.log(
      'Source parity round passed: changes status filters and bulk scope, repository search/removal, and history search'
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
