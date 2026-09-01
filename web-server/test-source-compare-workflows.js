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
  for (let attempt = 0; attempt < 100; attempt++) {
    if (git(cwd, ...args) === expected) return
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  assert.equal(git(cwd, ...args), expected)
}

async function waitForFile(file, expected) {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      if (fs.readFileSync(file, 'utf8') === expected) return
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
    }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  assert.equal(fs.readFileSync(file, 'utf8'), expected)
}

async function addRepository(page, repository) {
  const homeAdd = page.getByRole('button', {
    name: /Add an Existing Repository from your local drive…/i,
  })
  if (await homeAdd.isVisible().catch(() => false)) {
    await homeAdd.click()
  } else {
    await page
      .locator('.sidebar-section')
      .getByRole('button')
      .first()
      .evaluate(button => button.click())
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await page
      .getByRole('menuitem', { name: 'Add Existing Repository…' })
      .click()
  }
  const repositoryInspection = page.waitForResponse(
    response =>
      response.url().includes('/api/repository/inspect') &&
      response.status() === 200
  )
  await page.getByLabel('Local path').fill(repository)
  await repositoryInspection
  await page.getByRole('button', { name: 'Add repository' }).click()
}

async function main() {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'desktop-plus-source-compare-')
  )
  const repository = path.join(root, 'repository')
  fs.mkdirSync(repository)
  git(repository, 'init', '-b', 'main')
  git(repository, 'config', 'user.name', 'Source Compare')
  git(repository, 'config', 'user.email', 'source-compare@example.com')
  fs.writeFileSync(path.join(repository, 'base.txt'), 'base\n')
  git(repository, 'add', 'base.txt')
  git(repository, 'commit', '-m', 'base')
  git(repository, 'checkout', '-b', 'feature')
  fs.writeFileSync(path.join(repository, 'feature.txt'), 'feature\n')
  git(repository, 'add', 'feature.txt')
  git(repository, 'commit', '-m', 'feature commit')
  fs.writeFileSync(path.join(repository, 'feature-two.txt'), 'feature two\n')
  git(repository, 'add', 'feature-two.txt')
  git(repository, 'commit', '-m', 'feature commit two')
  git(repository, 'checkout', 'main')
  fs.writeFileSync(path.join(repository, 'main.txt'), 'main\n')
  git(repository, 'add', 'main.txt')
  git(repository, 'commit', '-m', 'main commit')

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
    await page.getByRole('tab', { name: 'Compare' }).click()

    const comparison = page.locator('#compare-view')
    const branchFilter = comparison.getByLabel('Branch filter')
    await branchFilter.click()
    await comparison
      .locator('.branches-list [role="option"]')
      .filter({ hasText: 'feature' })
      .click()
    await comparison.getByRole('tab', { name: 'Behind (2)' }).waitFor()
    const commits = comparison.getByRole('listbox', { name: 'Commits' })
    const firstFeatureCommit = commits.getByRole('option').filter({
      has: page.getByText('feature commit', { exact: true }),
    })
    await firstFeatureCommit.waitFor()
    await firstFeatureCommit.click()

    const details = page.locator('#history')
    await details.getByRole('option', { name: 'feature.txt New' }).waitFor()
    await details.getByRole('option', { name: 'feature.txt New' }).click()
    const historyDiff = page.locator('#history .side-by-side-diff')
    await historyDiff.filter({ hasText: 'feature' }).waitFor()
    assert.match(await details.innerText(), /feature commit/)
    assert.match(await historyDiff.innerText(), /feature/)

    await comparison.getByRole('tab', { name: 'Ahead (1)' }).click()
    const mainCommit = commits.getByRole('option').filter({
      has: page.getByText('main commit', { exact: true }),
    })
    await mainCommit.waitFor()
    await mainCommit.click()
    await details.getByRole('option', { name: 'main.txt New' }).waitFor()
    await comparison.getByRole('tab', { name: 'Behind (2)' }).click()
    await comparison.getByRole('tab', { name: 'Ahead (1)' }).waitFor()
    await firstFeatureCommit.click()
    await firstFeatureCommit.getAttribute('aria-selected').then(value => {
      assert.equal(value, 'true')
    })
    const secondFeatureCommit = commits.getByRole('option').filter({
      has: page.getByText('feature commit two', { exact: true }),
    })
    await secondFeatureCommit.waitFor()
    await secondFeatureCommit.click({
      modifiers: ['Meta'],
    })
    await commits
      .locator('[role="option"][aria-selected="true"]')
      .nth(1)
      .waitFor()
    await secondFeatureCommit.click({ button: 'right' })
    const commitMenu = page.getByRole('menu')
    const cherryPickMany = commitMenu.getByRole('menuitem', {
      name: 'Cherry-pick 2 Commits…',
    })
    await cherryPickMany.click()
    await Promise.all([
      waitForFile(path.join(repository, 'feature.txt'), 'feature\n'),
      waitForFile(path.join(repository, 'feature-two.txt'), 'feature two\n'),
      waitForGit(
        repository,
        ['log', '-1', '--format=%s'],
        'feature commit two'
      ),
    ])
    const undoCherryPick = page.getByRole('button', { name: 'Undo' })
    await undoCherryPick.waitFor()
    assert.equal(
      git(repository, 'log', '-1', '--format=%s'),
      'feature commit two'
    )
    await undoCherryPick.click()
    await undoCherryPick.waitFor({ state: 'hidden' })
    await waitForGit(repository, ['log', '-1', '--format=%s'], 'main commit')
    assert.equal(git(repository, 'log', '-1', '--format=%s'), 'main commit')
    assert.equal(fs.existsSync(path.join(repository, 'feature.txt')), false)
    assert.equal(fs.existsSync(path.join(repository, 'feature-two.txt')), false)
    assert.deepEqual(errors, [])
  } finally {
    await browser.close()
    await new Promise(resolve => server.close(resolve))
    fs.rmSync(root, { recursive: true, force: true })
  }
}

main()
  .then(() =>
    console.log(
      'Source compare workflows passed: branch selection, ahead/behind commits, multi-commit cherry-pick, guarded undo, and comparison diff inspection'
    )
  )
  .catch(error => {
    console.error(error)
    process.exitCode = 1
  })
