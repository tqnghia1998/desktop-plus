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
  await page.locator('#repository-sidebar').waitFor()
}

async function waitForChanges(page) {
  const sidebar = page.locator('#repository-sidebar')
  const changes = sidebar.getByRole('tab', { name: 'Changes' })
  await changes.click()
  await sidebar.getByRole('group', { name: 'Create commit' }).waitFor()
}

async function scrollAndPersist(page, selector, storageFragment) {
  const grid = page.locator(selector).first()
  await grid.waitFor()
  await page.waitForFunction(selector => {
    const element = document.querySelector(selector)
    return (
      element instanceof HTMLElement &&
      element.scrollHeight > element.clientHeight
    )
  }, selector)
  await grid.evaluate(element => {
    element.scrollTop = element.scrollHeight
    element.dispatchEvent(new Event('scroll', { bubbles: true }))
  })
  await page.waitForFunction(
    fragment =>
      Object.keys(localStorage).some(
        key => key.includes(fragment) && Number(localStorage.getItem(key)) > 0
      ),
    storageFragment
  )
  return grid.evaluate(element => element.scrollTop)
}

async function main() {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'desktop-plus-source-state-')
  )
  const repository = path.join(root, 'repository')
  fs.mkdirSync(repository)
  git(repository, 'init', '-b', 'main')
  git(repository, 'config', 'user.name', 'Source State')
  git(repository, 'config', 'user.email', 'source-state@example.com')
  fs.writeFileSync(path.join(repository, 'history.txt'), '0\n')
  fs.writeFileSync(path.join(repository, 'stash.txt'), 'base\n')
  git(repository, 'add', '.')
  git(repository, 'commit', '-m', 'base')

  for (let index = 1; index <= 36; index++) {
    fs.writeFileSync(path.join(repository, 'history.txt'), `${index}\n`)
    git(repository, 'commit', '-am', `history commit ${index}`)
  }
  git(repository, 'checkout', '-b', 'feature')
  for (let index = 1; index <= 28; index++) {
    fs.writeFileSync(
      path.join(repository, `feature-${index}.txt`),
      `feature ${index}\n`
    )
    git(repository, 'add', '.')
    git(repository, 'commit', '-m', `feature commit ${index}`)
  }
  git(repository, 'checkout', 'main')

  for (let index = 1; index <= 42; index++)
    fs.writeFileSync(
      path.join(repository, `changed-${index}.txt`),
      `changed ${index}\n`
    )

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
    await waitForChanges(page)

    const toolbar = page.locator('#desktop-app-toolbar')
    const branchButton = toolbar.locator('.branch-toolbar-button > button')
    const pushPullButton = toolbar.locator('.push-pull-button > button')
    assert.equal(
      await branchButton.evaluate(button => getComputedStyle(button).cursor),
      'pointer'
    )
    assert.equal(
      await pushPullButton.evaluate(button => getComputedStyle(button).cursor),
      'pointer'
    )
    const toolbarResizeHandles = toolbar.locator('.resize-handle')
    assert.equal(await toolbarResizeHandles.count(), 3)
    const resizeHandles = [
      toolbar.locator(
        '.resizable-component:has(.branch-toolbar-button) .resize-handle'
      ),
      toolbar.locator(
        '.resizable-component:has(.push-pull-button) .resize-handle'
      ),
    ]
    for (const handle of [
      ...resizeHandles,
      toolbar.locator(
        '.resizable-component:has(.worktree-button) .resize-handle'
      ),
    ])
      assert.equal(
        await handle.evaluate(element => getComputedStyle(element).cursor),
        'ew-resize'
      )
    for (const [index, key] of [
      'branch-dropdown-width',
      'push-pull-button-width',
    ].entries()) {
      const handle = resizeHandles[index]
      const resizeBox = await handle.boundingBox()
      assert.ok(resizeBox)
      await page.mouse.move(resizeBox.x + 2, resizeBox.y + 2)
      await page.mouse.down()
      await page.mouse.move(resizeBox.x + 52, resizeBox.y + 2)
      await page.mouse.up()
      await page.waitForFunction(
        key => Number(localStorage.getItem(key)) > 230,
        key
      )
    }
    await page.reload({ waitUntil: 'networkidle' })
    await waitForChanges(page)
    assert.equal(
      await page.evaluate(() => localStorage.getItem('branch-dropdown-width')),
      '280'
    )
    assert.equal(
      await page.evaluate(() => localStorage.getItem('push-pull-button-width')),
      '280'
    )

    const sidebar = page.locator('#repository-sidebar')
    await sidebar.getByRole('button', { name: /^Filter Options/ }).click()
    let newFilesFilter = sidebar.getByRole('checkbox', {
      name: /^New files \(/,
    })
    await newFilesFilter.evaluate(element => element.click())
    await sidebar
      .getByRole('button', { name: /^Filter Options \(1 applied\)$/ })
      .waitFor()
    await page.reload({ waitUntil: 'networkidle' })
    await waitForChanges(page)
    await sidebar
      .getByRole('button', { name: /^Filter Options \(1 applied\)$/ })
      .click()
    newFilesFilter = sidebar.getByRole('checkbox', {
      name: /^New files \(/,
    })
    assert.equal(await newFilesFilter.isChecked(), true)
    await newFilesFilter.evaluate(element => element.click())

    const changesScrollTop = await scrollAndPersist(
      page,
      '#repository-sidebar #changes-list .ReactVirtualized__Grid',
      'desktop-plus-web-changes-scroll'
    )
    assert.ok(changesScrollTop > 0)
    await page.reload({ waitUntil: 'networkidle' })
    await waitForChanges(page)
    await page.waitForFunction(() => {
      const element = document.querySelector(
        '#repository-sidebar #changes-list .ReactVirtualized__Grid'
      )
      return element instanceof HTMLElement && element.scrollTop > 0
    })

    fs.writeFileSync(path.join(repository, 'stash.txt'), 'stashed\n')
    git(repository, 'stash', 'push', '-m', 'state stash')
    const branchesRefresh = page.waitForResponse(
      response =>
        response.url().includes('/api/branches/current') &&
        response.status() === 200
    )
    await page.reload({ waitUntil: 'networkidle' })
    await branchesRefresh
    await waitForChanges(page)
    const stashButton = sidebar.getByRole('button', { name: /state stash/ })
    await stashButton.waitFor()

    await page.evaluate(() =>
      localStorage.setItem('show-stashed-changes', 'false')
    )
    await page.reload({ waitUntil: 'networkidle' })
    await waitForChanges(page)
    assert.equal(
      await page
        .locator('#repository-sidebar')
        .getByRole('button', { name: /state stash/ })
        .count(),
      0
    )
    await page.evaluate(() =>
      localStorage.setItem('show-stashed-changes', 'true')
    )
    await page.reload({ waitUntil: 'networkidle' })
    await waitForChanges(page)
    await sidebar.getByRole('button', { name: /state stash/ }).waitFor()

    const resizeHandle = sidebar.getByRole('button', { name: 'Resize handle' })
    assert.equal(
      await resizeHandle.evaluate(handle => getComputedStyle(handle).cursor),
      'ew-resize'
    )
    const resizeBox = await resizeHandle.boundingBox()
    assert.ok(resizeBox)
    await page.mouse.move(resizeBox.x + 2, resizeBox.y + 2)
    await page.mouse.down()
    await page.mouse.move(resizeBox.x + 72, resizeBox.y + 2)
    await page.mouse.up()
    const resizedWidth = await sidebar.evaluate(element =>
      Math.round(element.getBoundingClientRect().width)
    )
    assert.ok(resizedWidth >= 290)
    await page.reload({ waitUntil: 'networkidle' })
    const restoredWidth = await page
      .locator('#repository-sidebar')
      .evaluate(element => Math.round(element.getBoundingClientRect().width))
    assert.equal(restoredWidth, resizedWidth)

    await page
      .locator('#repository-sidebar')
      .getByRole('tab', {
        name: 'History',
      })
      .click()
    await page.locator('#repository-sidebar #commit-list').waitFor()
    const historyScrollTop = await scrollAndPersist(
      page,
      '#repository-sidebar #commit-list .ReactVirtualized__Grid',
      'desktop-plus-web-compare-scroll'
    )
    assert.ok(historyScrollTop > 0)
    await page.reload({ waitUntil: 'networkidle' })
    await page
      .locator('#repository-sidebar')
      .getByRole('tab', {
        name: 'History',
      })
      .click()
    await page.locator('#repository-sidebar #commit-list').waitFor()
    await page.waitForFunction(() => {
      const element = document.querySelector(
        '#repository-sidebar #commit-list .ReactVirtualized__Grid'
      )
      return element instanceof HTMLElement && element.scrollTop > 0
    })

    await page
      .locator('#repository-sidebar')
      .getByRole('tab', {
        name: 'Compare',
      })
      .click()
    const comparison = page.locator('#repository-sidebar #compare-view')
    await comparison.getByLabel('Branch filter').fill('feature')
    await comparison.getByRole('option', { name: 'feature' }).click()
    const comparisonCommits = comparison.getByRole('listbox', {
      name: 'Commits',
    })
    await comparisonCommits.getByRole('option').first().waitFor()
    await page.waitForFunction(() => {
      const element = document.querySelector(
        '#repository-sidebar [role="listbox"][aria-label="Commits"]'
      )
      return (
        element instanceof HTMLElement &&
        element.scrollHeight > element.clientHeight
      )
    })
    await comparisonCommits.evaluate(element => {
      element.scrollTop = element.scrollHeight
      element.dispatchEvent(new Event('scroll', { bubbles: true }))
    })
    await page.waitForFunction(() =>
      Object.keys(localStorage).some(
        key =>
          key.includes('desktop-plus-web-compare-scroll') &&
          Number(localStorage.getItem(key)) > 0
      )
    )
    const compareScrollTop = await comparisonCommits.evaluate(
      element => element.scrollTop
    )
    assert.ok(compareScrollTop > 0)
    await page.reload({ waitUntil: 'networkidle' })
    await page
      .locator('#repository-sidebar')
      .getByRole('tab', {
        name: 'Compare',
      })
      .click()
    const restoredComparisonCommits = page
      .locator('#repository-sidebar #compare-view')
      .getByRole('listbox', { name: 'Commits' })
    await restoredComparisonCommits.getByRole('option').first().waitFor()
    assert.ok(
      await restoredComparisonCommits.evaluate(element => element.scrollTop > 0)
    )

    assert.deepEqual(errors, [])
    console.log(
      'Source state persistence passed: Changes filters and stashes, Changes/history/Compare scroll positions, and sidebar width'
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
