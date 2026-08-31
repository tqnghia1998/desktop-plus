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
  if (await homeAdd.isVisible().catch(() => false)) {
    await homeAdd.click()
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

    const comparison = page.getByRole('region', { name: 'Compare' })
    await comparison.getByLabel('Branch').selectOption('feature')
    await comparison.getByText('1 ahead, 2 behind').waitFor()
    const commits = comparison.getByRole('listbox', {
      name: 'Comparison commits',
    })
    const firstFeatureCommit = commits.getByRole('option', {
      name: /^feature commit [0-9a-f]+$/,
    })
    await firstFeatureCommit.waitFor()
    await firstFeatureCommit.click()

    const details = page.getByRole('region', { name: 'Commit details' })
    await details.getByRole('option', { name: 'feature.txt' }).waitFor()
    await details.getByRole('option', { name: 'feature.txt' }).click()
    await page.waitForFunction(() =>
      document
        .querySelector('.web-history-diff')
        ?.textContent?.includes('feature')
    )
    assert.match(await details.innerText(), /feature commit/)
    assert.match(await page.locator('.web-history-diff').innerText(), /feature/)

    await comparison.getByRole('button', { name: 'Ahead' }).click()
    await commits.getByRole('option', { name: /main commit/ }).waitFor()
    await commits.getByRole('option', { name: /main commit/ }).click()
    await details.getByRole('option', { name: 'main.txt' }).waitFor()
    await comparison.getByRole('button', { name: 'Behind' }).click()
    await comparison.getByText('1 ahead, 2 behind').waitFor()
    await firstFeatureCommit.click()
    await firstFeatureCommit.getAttribute('aria-selected').then(value => {
      assert.equal(value, 'true')
    })
    const secondFeatureCommit = commits.getByRole('option', {
      name: /^feature commit two [0-9a-f]+$/,
    })
    await secondFeatureCommit.waitFor()
    await secondFeatureCommit.click({
      modifiers: ['Meta'],
    })
    await page.waitForFunction(
      () =>
        document.querySelectorAll(
          '[aria-label="Comparison commits"] [aria-selected="true"]'
        ).length === 2
    )
    const cherryPickMany = comparison.getByRole('button', {
      name: 'Cherry-pick selected commits',
    })
    await cherryPickMany.waitFor()
    await cherryPickMany.click()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Cancel' })
      .click()
    assert.equal(fs.existsSync(path.join(repository, 'feature.txt')), false)
    await cherryPickMany.click()
    const cherryPickDialog = page.getByRole('alertdialog')
    await cherryPickDialog
      .getByRole('button', { name: 'Cherry-pick 2 commits' })
      .click()
    await cherryPickDialog.waitFor({ state: 'hidden' })
    assert.equal(
      fs.readFileSync(path.join(repository, 'feature.txt'), 'utf8'),
      'feature\n'
    )
    assert.equal(
      fs.readFileSync(path.join(repository, 'feature-two.txt'), 'utf8'),
      'feature two\n'
    )
    assert.equal(
      git(repository, 'log', '-1', '--format=%s'),
      'feature commit two'
    )
    const undoCherryPick = comparison.getByRole('button', {
      name: 'Undo cherry-pick',
    })
    await undoCherryPick.waitFor()
    await undoCherryPick.click()
    const undoDialog = page.getByRole('alertdialog')
    await undoDialog.getByRole('button', { name: 'Undo cherry-pick' }).click()
    await undoDialog.waitFor({ state: 'hidden' })
    await undoCherryPick.waitFor({ state: 'hidden' })
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
