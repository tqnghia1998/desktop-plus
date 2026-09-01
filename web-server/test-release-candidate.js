const assert = require('assert/strict')
const { execFileSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { createServer } = require('./server')
const { launchBrowser, selectedBrowserName } = require('./test-browser')

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
}

async function main() {
  assert.equal(
    process.platform,
    'darwin',
    'Release-candidate evidence targets macOS only.'
  )
  assert.equal(
    selectedBrowserName(),
    'chrome',
    'Release-candidate evidence requires branded Google Chrome.'
  )
  if (typeof process.getuid === 'function')
    assert.notEqual(process.getuid(), 0, 'The companion must run unprivileged.')

  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'desktop-plus-release-candidate-')
  )
  const repository = path.join(root, 'repository')
  fs.mkdirSync(repository)
  git(repository, 'init', '-b', 'main')
  git(repository, 'config', 'user.name', 'Release Candidate')
  git(repository, 'config', 'user.email', 'release-candidate@example.com')
  fs.writeFileSync(path.join(repository, 'tracked.txt'), 'history 000\n')
  git(repository, 'add', 'tracked.txt')
  git(repository, 'commit', '-m', 'history 000')
  for (let index = 1; index <= 105; index++) {
    fs.writeFileSync(path.join(repository, 'tracked.txt'), `history ${index}\n`)
    git(
      repository,
      'commit',
      '-am',
      `history ${String(index).padStart(3, '0')}`
    )
  }
  fs.writeFileSync(path.join(repository, 'changed.txt'), 'working change\n')

  const server = createServer({ getDesktopRepositories: async () => [] })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  assert.equal(address.address, '127.0.0.1')
  const browser = await launchBrowser()

  try {
    const page = await browser.newPage()
    const consoleErrors = []
    const pageErrors = []
    page.on('console', message => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })
    page.on('pageerror', error => pageErrors.push(error.message))

    await page.goto(`http://127.0.0.1:${address.port}`, {
      waitUntil: 'networkidle',
    })
    await addRepository(page, repository)
    await page.getByRole('tab', { name: 'Changes' }).waitFor()
    await page.getByRole('option', { name: /^changed\.txt/ }).waitFor()
    await page.getByRole('tab', { name: 'History' }).click()
    const commits = page.getByRole('listbox', { name: 'Commits' })
    await commits.getByText('history 105', { exact: true }).waitFor()
    const initialScrollHeight = await commits.evaluate(
      element => element.scrollHeight
    )
    await commits.evaluate(element => {
      element.scrollTop = element.scrollHeight
    })
    await page.waitForTimeout(100)
    await commits.evaluate(element => {
      element.dispatchEvent(new Event('scroll', { bubbles: true }))
    })
    await page.waitForTimeout(100)
    await page.waitForFunction(
      ({ height }) => {
        const element = document.querySelector('[aria-label="Commits"]')
        return (
          (element?.scrollTop || 0) > 0 && (element?.scrollHeight || 0) > height
        )
      },
      { height: initialScrollHeight }
    )
    await commits.evaluate(element => {
      element.scrollTo({ top: element.scrollHeight, behavior: 'instant' })
    })
    await commits.getByText('history 000', { exact: true }).waitFor()
    assert.ok(
      (await commits.getByText('history 000', { exact: true }).count()) > 0
    )

    assert.deepEqual(consoleErrors, [])
    assert.deepEqual(pageErrors, [])
    console.log(
      'Release candidate passed: branded Chrome on unprivileged macOS companion, changed repository, paginated history, and clean console'
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
