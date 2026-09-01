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
  const inspection = page.waitForResponse(
    response =>
      response.url().includes('/api/repository/inspect') &&
      response.status() === 200
  )
  await page.getByLabel('Local path').fill(repository)
  await inspection
  await page.getByRole('button', { name: 'Add repository' }).click()
  await page.waitForFunction(
    expected => window.__DESKTOP_PLUS_WEB_REPOSITORY_PATH__ === expected,
    fs.realpathSync(repository)
  )
}

function waitForCompletedOperation(page) {
  return page.waitForResponse(async response => {
    if (
      !/\/api\/git\/operations\/[^/]+$/.test(response.url()) ||
      response.request().method() !== 'GET' ||
      response.status() !== 200
    )
      return false
    const operation = await response.json()
    return operation.status === 'completed'
  })
}

async function main() {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'desktop-plus-toolbar-actions-')
  )
  const remote = path.join(root, 'remote.git')
  const repository = path.join(root, 'repository')
  fs.mkdirSync(repository)
  git(root, 'init', '--bare', remote)
  git(repository, 'init', '-b', 'main')
  git(repository, 'config', 'user.name', 'Toolbar Source')
  git(repository, 'config', 'user.email', 'toolbar-source@example.com')
  fs.writeFileSync(path.join(repository, 'README.md'), 'main\n')
  git(repository, 'add', 'README.md')
  git(repository, 'commit', '-m', 'main')
  git(repository, 'remote', 'add', 'origin', remote)
  git(repository, 'checkout', '-b', 'feature')
  fs.writeFileSync(path.join(repository, 'feature.txt'), 'feature\n')
  git(repository, 'add', 'feature.txt')
  git(repository, 'commit', '-m', 'feature')

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

    await page.getByRole('button', { name: 'Repository', exact: true }).click()
    const publishRequest = page.waitForRequest(
      request =>
        request.url().endsWith('/api/git/operations') &&
        request.method() === 'POST' &&
        request.postDataJSON().operation === 'publish-branch'
    )
    const publishCompleted = waitForCompletedOperation(page)
    await page
      .locator('#web-repository-actions')
      .getByRole('menuitem', { name: 'Push', exact: true })
      .click()
    await publishRequest
    await publishCompleted
    await page.waitForFunction(
      repositoryPath =>
        window.__DESKTOP_PLUS_WEB_REPOSITORY_PATH__ === repositoryPath,
      fs.realpathSync(repository)
    )
    assert.equal(
      git(repository, 'config', '--get', 'branch.feature.remote'),
      'origin'
    )

    await page.getByRole('button', { name: 'Branch', exact: true }).click()
    assert.equal(
      await page.evaluate(() => document.activeElement?.textContent?.trim()),
      'New Branch…'
    )
    await page.keyboard.press('ArrowDown')
    assert.equal(
      await page.evaluate(() => document.activeElement?.textContent?.trim()),
      'Rename…'
    )
    await page
      .locator('#web-branch-actions')
      .getByRole('menuitem', { name: 'Rebase Current Branch…' })
      .click()
    await page
      .getByRole('dialog')
      .filter({ hasText: /^Rebase\s+feature/ })
      .waitFor()

    assert.deepEqual(errors, [])
    console.log(
      'Toolbar action workflows passed: publish, menu keyboard navigation, and rebase dialog'
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
