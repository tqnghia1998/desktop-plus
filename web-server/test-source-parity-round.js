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
  const canonicalRepository = fs.realpathSync(repository)
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
  await page.waitForFunction(
    expected => window.__DESKTOP_PLUS_WEB_REPOSITORY_PATH__ === expected,
    canonicalRepository
  )
}

async function openRepositoryPicker(page) {
  const picker = page.locator('.repository-list')
  if (await picker.isVisible().catch(() => false)) return picker
  await page.keyboard.press('Escape')
  await page.locator('#web-context-menu').waitFor({ state: 'hidden' })
  const button = page.getByRole('button', { name: /^Current repository/i })
  if ((await button.getAttribute('aria-expanded')) !== 'true')
    await button.click()
  await picker.waitFor()
  return picker
}

async function openRepositoryActions(page, name) {
  await page
    .locator('.repository-list-item > .name')
    .filter({ hasText: new RegExp(`^${escapeRegExp(name)}$`) })
    .locator('..')
    .click({ button: 'right', position: { x: 24, y: 16 } })
  const menu = page.locator('#web-context-menu')
  await menu.waitFor()
  return menu
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
    const branchButton = page.locator('.branch-toolbar-button > button')
    await branchButton.focus()
    await branchButton.click()
    const branchPicker = page.locator('.branches-container')
    await branchPicker.getByText('Default Branch', { exact: true }).waitFor()
    await branchPicker.getByText('Other Branches', { exact: true }).waitFor()
    await branchPicker
      .getByRole('button', { name: 'New Branch', exact: true })
      .waitFor()
    await waitForVisibleOption(page, 'main')
    const branchToolbarBounds = await branchButton.boundingBox()
    const branchMenuBounds = await page
      .locator('#foldout-container > .foldout')
      .boundingBox()
    assert.ok(branchToolbarBounds)
    assert.ok(branchMenuBounds)
    assert.equal(
      Math.round(branchMenuBounds.x),
      Math.round(branchToolbarBounds.x)
    )
    assert.equal(
      Math.round(branchMenuBounds.y),
      Math.round(branchToolbarBounds.y + branchToolbarBounds.height)
    )
    assert.ok(branchMenuBounds.width >= 365)
    assert.ok(branchMenuBounds.height > 640)
    const newBranchButton = branchPicker.getByRole('button', {
      name: 'New Branch',
      exact: true,
    })
    const branchFilterBounds = await branchPicker
      .getByPlaceholder('Filter')
      .boundingBox()
    const newBranchBounds = await newBranchButton.boundingBox()
    assert.ok(branchFilterBounds)
    assert.ok(newBranchBounds)
    assert.ok(
      Math.abs(
        Math.round(branchFilterBounds.y) - Math.round(newBranchBounds.y)
      ) <= 2
    )
    assert.ok(newBranchBounds.x > branchFilterBounds.x)
    const branchFilter = branchPicker.getByPlaceholder('Filter')
    await branchFilter.fill('search-target')
    await waitForVisibleOption(page, 'feature/search-target')
    assert.equal(
      await branchPicker.getByRole('option', { name: /^other-branch/ }).count(),
      0
    )
    await branchButton.press('Escape')
    await page.locator('#foldout-container').waitFor({ state: 'hidden' })
    const syncButton = page.getByRole('button', {
      name: 'Push, pull, fetch options',
    })
    await syncButton.click()
    const syncToolbarBounds = await syncButton.boundingBox()
    const syncMenuBounds = await page
      .locator('#foldout-container > .foldout')
      .boundingBox()
    assert.ok(syncToolbarBounds)
    assert.ok(syncMenuBounds)
    assert.ok(syncMenuBounds.x <= syncToolbarBounds.x)
    assert.ok(
      syncMenuBounds.x + syncMenuBounds.width >=
        syncToolbarBounds.x + syncToolbarBounds.width
    )
    assert.equal(
      Math.round(syncMenuBounds.y),
      Math.round(syncToolbarBounds.y + syncToolbarBounds.height)
    )
    assert.ok(syncMenuBounds.width >= 230)
    assert.ok(syncMenuBounds.height > 0)
    assert.ok(
      syncMenuBounds.y + syncMenuBounds.height <= page.viewportSize().height
    )
    await syncButton.press('Escape')
    await page.locator('#foldout-container').waitFor({ state: 'hidden' })
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

    const filters = page.getByRole('button', { name: /^Filter Options/ })
    await filters.click()
    await page
      .getByRole('checkbox', { name: /^New files \(/ })
      .evaluate(element => element.click())
    await page
      .getByRole('button', { name: /^Filter Options \(1 applied\)$/ })
      .waitFor()
    await waitForVisibleOption(page, 'new.txt')
    await waitForVisibleOption(page, 'modified.txt', false)
    await waitForVisibleOption(page, 'deleted.txt', false)

    const newFile = page.getByRole('option', { name: /^new\.txt/ })
    const secondNewFile = page.getByRole('option', {
      name: /^ignore-me\.log/,
    })
    await newFile.click()
    await secondNewFile.click({ modifiers: ['Meta'] })
    await secondNewFile.click({ button: 'right' })
    await page
      .locator('#web-context-menu')
      .getByRole('menuitem', { name: 'Exclude Selected Files' })
      .click()
    await filters.click()
    await page
      .getByRole('checkbox', { name: /^Excluded from commit \(/ })
      .evaluate(element => element.click())
    await waitForVisibleOption(page, 'new.txt')
    await filters.click()
    await page.getByRole('button', { name: 'Clear filters' }).click()
    await waitForVisibleOption(page, 'modified.txt')
    await waitForVisibleOption(page, 'deleted.txt')

    const openFileMenu = async pathPattern => {
      await page
        .getByRole('option', { name: pathPattern })
        .click({ button: 'right' })
      const menu = page.locator('#web-context-menu')
      await menu.waitFor()
      return menu
    }
    let fileMenu = await openFileMenu(/^ignore-me\.log/)
    await fileMenu
      .getByRole('menuitem', {
        name: 'Ignore File (Add to .gitignore)',
      })
      .click()
    await page.getByRole('option', { name: /^ignore-me\.log/ }).waitFor({
      state: 'hidden',
    })
    assert.match(
      fs.readFileSync(path.join(repository, '.gitignore'), 'utf8'),
      /ignore-me\.log/
    )

    fileMenu = await openFileMenu(/^pattern-match\.cfg/)
    await fileMenu
      .getByRole('menuitem', {
        name: 'Ignore All .cfg Files (Add to .gitignore)',
      })
      .click()
    await page
      .getByRole('option', { name: /^pattern-match\.cfg/ })
      .waitFor({ state: 'hidden' })
    assert.match(
      fs.readFileSync(path.join(repository, '.gitignore'), 'utf8'),
      /\*\.cfg/
    )

    fileMenu = await openFileMenu(/^modified\.txt/)
    await fileMenu.getByRole('menuitem', { name: 'Copy File Path' }).click()
    assert.equal(
      await page.evaluate(() => navigator.clipboard.readText()),
      path.join(fs.realpathSync(repository), 'modified.txt')
    )
    fileMenu = await openFileMenu(/^modified\.txt/)
    await fileMenu
      .getByRole('menuitem', { name: 'Copy Relative File Path' })
      .click()
    assert.equal(
      await page.evaluate(() => navigator.clipboard.readText()),
      'modified.txt'
    )

    const includedFiles = page
      .getByRole('option')
      .filter({ hasText: / included$/ })
    await includedFiles.first().click()
    for (let index = 1; index < (await includedFiles.count()); index++)
      await includedFiles.nth(index).click({ modifiers: ['Meta'] })
    await includedFiles.last().click({ button: 'right' })
    await page
      .locator('#web-context-menu')
      .getByRole('menuitem', { name: 'Copy Paths' })
      .click()
    assert.deepEqual(
      new Set(
        (await page.evaluate(() => navigator.clipboard.readText())).split('\n')
      ),
      new Set([
        path.join(fs.realpathSync(repository), 'deleted.txt'),
        path.join(fs.realpathSync(repository), 'modified.txt'),
        path.join(fs.realpathSync(repository), '.gitignore'),
        path.join(fs.realpathSync(repository), 'new.txt'),
        path.join(fs.realpathSync(repository), 'syntax.ts'),
        path.join(fs.realpathSync(repository), 'whole-file.txt'),
      ])
    )

    await openRepositoryPicker(page)
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await page
      .getByRole('menuitem', { name: 'Add Existing Repository…' })
      .click()
    const secondRepositoryInspection = page.waitForResponse(
      response =>
        response.url().includes('/api/repository/inspect') &&
        response.status() === 200
    )
    await page.getByLabel('Local path').fill(secondRepository)
    await secondRepositoryInspection
    await page.getByRole('button', { name: 'Add repository' }).click()
    await page.locator('#add-existing-repository').waitFor({ state: 'hidden' })

    await openRepositoryPicker(page)
    await waitForRepository(page, secondRepository)
    await page.reload({ waitUntil: 'networkidle' })
    await openRepositoryPicker(page)
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
    const repositoryFilter = page
      .locator('.repository-list')
      .getByPlaceholder('Filter')
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
    const repositoryRow = page
      .locator('.repository-list-item > .name')
      .filter({
        hasText: new RegExp(`^${escapeRegExp(path.basename(repository))}$`),
      })
      .locator('..')
    const repositoryRowBounds = await repositoryRow.boundingBox()
    assert.ok(repositoryRowBounds)
    await repositoryRow.click({
      button: 'right',
      position: { x: 24, y: 16 },
    })
    const contextMenuBounds = await page
      .locator('#web-context-menu')
      .boundingBox()
    assert.ok(contextMenuBounds)
    assert.equal(
      Math.round(contextMenuBounds.x),
      Math.round(repositoryRowBounds.x + 24)
    )
    assert.ok(
      Math.abs(
        Math.round(contextMenuBounds.y) - Math.round(repositoryRowBounds.y + 16)
      ) <= 1
    )
    await page.reload({ waitUntil: 'networkidle' })
    await openRepositoryPicker(page)
    await (await openRepositoryActions(page, path.basename(secondRepository)))
      .getByRole('menuitem', { name: /^Remove/ })
      .click()
    const removeDialog = page
      .getByRole('dialog')
      .filter({ hasText: 'Remove repository' })
    await removeDialog
      .getByRole('button', { name: 'Remove', exact: true })
      .click()
    assert.equal(
      await page
        .locator('.repository-list-item')
        .filter({ hasText: path.basename(secondRepository) })
        .count(),
      0
    )

    await openRepositoryPicker(page)
    await page
      .locator('.repository-list-item > .name')
      .filter({
        hasText: new RegExp(`^${escapeRegExp(path.basename(repository))}$`),
      })
      .click()
    await page.locator('.branch-toolbar-button').waitFor()
    fs.writeFileSync(path.join(repository, 'inline-stash.txt'), 'changed\n')
    git(repository, 'add', 'inline-stash.txt')
    git(repository, 'stash', 'push', '-m', 'inline stash')
    await page.reload({ waitUntil: 'networkidle' })
    await page.getByRole('tab', { name: 'Changes' }).click()
    const inlineStashes = page.locator('.stashed-changes-button')
    await inlineStashes.getByText(/1 stash \(inline stash/).waitFor()
    await inlineStashes.click()
    const stashInspection = page.locator('#stash-diff-viewer')
    await stashInspection.getByRole('option').first().waitFor()
    await stashInspection
      .getByRole('option', { name: 'inline-stash.txt' })
      .click()
    await stashInspection.getByRole('button', { name: 'Rename stash' }).click()
    const inlineRenameDialog = page.locator('#rename-stash:visible')
    await inlineRenameDialog.getByLabel('Name').fill('renamed inline stash')
    await inlineRenameDialog
      .getByRole('button', { name: 'Rename stash' })
      .click()
    await page.getByText(/1 stash \(renamed inline stash/).waitFor()
    await inlineStashes.click()
    await page.getByRole('button', { name: 'Discard', exact: true }).click()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Discard', exact: true })
      .click()
    await inlineStashes.waitFor({ state: 'hidden' })
    assert.doesNotMatch(
      git(repository, 'stash', 'list'),
      /renamed%20inline%20stash/
    )

    await page.getByRole('tab', { name: 'History' }).click()
    await waitForHistory(page, 'ordinary tagged commit')
    const historyFilter = page.getByLabel('Commit filter')

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
