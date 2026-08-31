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

async function request(base, sessionToken, pathname, options = {}) {
  const response = await fetch(`${base}${pathname}`, {
    ...options,
    headers: {
      'X-Desktop-Plus-Session': sessionToken,
      ...(options.headers || {}),
    },
  })
  const data = await response.json()
  return { response, data }
}

async function openAddDialog(page) {
  const blockingError = page.locator('dialog.error')
  if (await blockingError.isVisible().catch(() => false)) {
    throw new Error(
      `Unexpected web error before opening add dialog: ${await blockingError.textContent()}`
    )
  }
  const homeAdd = page.getByRole('button', {
    name: /Add an Existing Repository from your local drive…/i,
  })
  if (await homeAdd.isVisible().catch(() => false)) {
    await homeAdd.click()
  } else {
    await page.locator('.sidebar-section').getByRole('button').first().click()
    await page.getByRole('button', { name: 'Add', exact: true }).click()
  }
  return page.locator('dialog').filter({ hasText: 'Add repository' })
}

async function inspectPath(page, value) {
  const dialog = await openAddDialog(page)
  await dialog.getByLabel('Local path').fill(value)
  return dialog
}

function createRepository(root, name) {
  const repository = path.join(root, name)
  fs.mkdirSync(repository)
  git(repository, 'init', '-q', '-b', 'main')
  git(repository, 'config', 'user.name', 'Recovery Test')
  git(repository, 'config', 'user.email', 'recovery@example.com')
  fs.writeFileSync(path.join(repository, 'README.md'), 'recovery\n')
  git(repository, 'add', 'README.md')
  git(repository, 'commit', '-q', '-m', 'Initial commit')
  return repository
}

async function main() {
  const root = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), 'desktop-plus-recovery-')
  )
  const repository = createRepository(root, 'regular-repository')
  const staleRepository = createRepository(root, 'stale-repository')
  const nestedRepositoryPath = path.join(repository, 'nested')
  await fs.promises.mkdir(nestedRepositoryPath)
  const bareRepository = path.join(root, 'bare-repository.git')
  git(root, 'init', '-q', '--bare', bareRepository)
  const nonGitDirectory = path.join(root, 'not-a-repository')
  await fs.promises.mkdir(nonGitDirectory)
  const missingPath = path.join(root, 'missing-repository')
  const unsafeRepository = createRepository(root, 'unsafe-repository')
  const deleteRepository = createRepository(root, 'delete-repository')
  const globalGitConfig = path.join(root, 'global.gitconfig')
  const previousGlobalGitConfig = process.env.GIT_CONFIG_GLOBAL
  const previousAssumeDifferentOwner =
    process.env.GIT_TEST_ASSUME_DIFFERENT_OWNER
  process.env.GIT_CONFIG_GLOBAL = globalGitConfig

  const server = createServer({ getDesktopRepositories: async () => [] })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  const browser = await launchBrowser()

  try {
    const apiRegular = await request(
      base,
      server.sessionToken,
      '/api/repository/inspect',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: nestedRepositoryPath }),
      }
    )
    assert.equal(apiRegular.response.status, 200)
    assert.equal(apiRegular.data.kind, 'regular')
    assert.equal(
      await fs.promises.realpath(apiRegular.data.repositoryPath),
      await fs.promises.realpath(repository)
    )

    const apiBare = await request(
      base,
      server.sessionToken,
      '/api/repository/inspect',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: bareRepository }),
      }
    )
    assert.equal(apiBare.response.status, 200)
    assert.equal(apiBare.data.kind, 'bare')

    const apiMissing = await request(
      base,
      server.sessionToken,
      '/api/repository/inspect',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: missingPath }),
      }
    )
    assert.equal(apiMissing.response.status, 200)
    assert.equal(apiMissing.data.kind, 'missing')
    assert.equal(apiMissing.data.exists, false)

    const apiTilde = await request(
      base,
      server.sessionToken,
      '/api/repository/inspect',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: `~/${path.relative(os.homedir(), repository)}`,
        }),
      }
    )
    assert.equal(apiTilde.response.status, 200)
    assert.equal(apiTilde.data.kind, 'regular')
    assert.equal(
      await fs.promises.realpath(apiTilde.data.repositoryPath),
      await fs.promises.realpath(repository)
    )

    process.env.GIT_TEST_ASSUME_DIFFERENT_OWNER = '1'
    const apiUnsafe = await request(
      base,
      server.sessionToken,
      '/api/repository/inspect',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: unsafeRepository }),
      }
    )
    assert.equal(apiUnsafe.response.status, 200)
    assert.equal(apiUnsafe.data.kind, 'unsafe')
    assert.equal(
      await fs.promises.realpath(apiUnsafe.data.unsafePath),
      await fs.promises.realpath(unsafeRepository)
    )
    if (previousAssumeDifferentOwner === undefined)
      delete process.env.GIT_TEST_ASSUME_DIFFERENT_OWNER
    else
      process.env.GIT_TEST_ASSUME_DIFFERENT_OWNER = previousAssumeDifferentOwner

    const page = await browser.newPage()
    page.on('pageerror', error => console.error(`pageerror: ${error.message}`))
    await page.goto(base, { waitUntil: 'networkidle' })

    let dialog = await inspectPath(page, repository)
    await dialog.getByText('Git repository found.').waitFor()
    await dialog.getByRole('button', { name: 'Add repository' }).click()
    await page.getByRole('tab', { name: 'Changes' }).waitFor()
    await page.waitForTimeout(250)
    const initialError = page.locator('dialog.error')
    if (await initialError.isVisible().catch(() => false))
      throw new Error(
        `Unexpected error after adding regular repository: ${await initialError.textContent()}`
      )

    dialog = await inspectPath(page, bareRepository)
    await dialog.getByText(/bare Git repository/i).waitFor()
    assert.equal(
      await dialog.getByRole('button', { name: 'Add repository' }).isDisabled(),
      true
    )
    await dialog.getByRole('button', { name: 'Cancel' }).click()

    process.env.GIT_TEST_ASSUME_DIFFERENT_OWNER = '1'
    dialog = await inspectPath(page, unsafeRepository)
    await dialog.getByText(/owned by another user/i).waitFor()
    await dialog.getByRole('button', { name: 'Trust repository' }).click()
    await dialog.getByText('Git repository found.').waitFor()
    await dialog.getByRole('button', { name: 'Cancel' }).click()

    if (previousAssumeDifferentOwner === undefined)
      delete process.env.GIT_TEST_ASSUME_DIFFERENT_OWNER
    else
      process.env.GIT_TEST_ASSUME_DIFFERENT_OWNER = previousAssumeDifferentOwner
    await inspectPath(page, staleRepository).then(async staleDialog => {
      await staleDialog.getByText('Git repository found.').waitFor()
      await staleDialog.getByRole('button', { name: 'Add repository' }).click()
    })
    await page.getByRole('tab', { name: 'Changes' }).waitFor()
    await page.locator('.sidebar-section').getByRole('button').first().click()
    await page.getByLabel('Filter repositories').fill('stale-repository')
    await page
      .locator('.repository-list-item')
      .filter({ hasText: 'stale-repository' })
      .click()
    await fs.promises.rm(staleRepository, { recursive: true, force: true })
    await page.reload({ waitUntil: 'networkidle' })
    await page.getByText(/Can't find "stale-repository"/i).waitFor()
    await page.getByRole('button', { name: 'Check again' }).click()
    await page.getByText(/Can't find "stale-repository"/i).waitFor()

    dialog = await inspectPath(page, nonGitDirectory)
    await dialog.getByText(/does not appear to be a Git repository/i).waitFor()
    await dialog.getByRole('button', { name: 'Create repository here' }).click()
    const setupDialog = page.locator('dialog').filter({
      hasText: 'Create repository',
    })
    await setupDialog.waitFor()
    assert.equal(
      await setupDialog.getByLabel('Repository name').inputValue(),
      'not-a-repository'
    )
    assert.equal(
      await setupDialog.getByLabel('Parent directory').inputValue(),
      root
    )
    await setupDialog.getByRole('button', { name: 'Cancel' }).click()

    dialog = await inspectPath(page, missingPath)
    await dialog
      .getByText(/selected path does not contain a Git repository/i)
      .waitFor()
    assert.equal(
      await dialog.getByRole('button', { name: 'Add repository' }).isDisabled(),
      true
    )
    await dialog.getByRole('button', { name: 'Cancel' }).click()

    dialog = await inspectPath(page, repository)
    await dialog.getByText('Git repository found.').waitFor()
    await dialog.getByRole('button', { name: 'Add repository' }).click()
    await page.getByRole('tab', { name: 'Changes' }).waitFor()
    await page.getByRole('button', { name: /Current repository/i }).waitFor()

    await page.locator('.sidebar-section').getByRole('button').first().click()
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    const deleteAddDialog = page.locator('dialog').filter({
      hasText: 'Add repository',
    })
    await deleteAddDialog.getByLabel('Local path').fill(deleteRepository)
    await deleteAddDialog
      .getByRole('button', { name: 'Add repository' })
      .click()
    await page.getByRole('tab', { name: 'Changes' }).waitFor()
    await page.locator('.sidebar-section').getByRole('button').first().click()
    await page.getByLabel('Filter repositories').fill('delete-repository')
    const deleteButton = page.getByRole('button', {
      name: 'Delete delete-repository from disk',
    })
    await deleteButton.click()
    const deleteDialog = page.getByRole('alertdialog')
    await deleteDialog.getByText(
      /Move to Trash keeps the repository recoverable/i
    )
    assert.equal(
      await deleteDialog.getByLabel('Move to Trash').isChecked(),
      true
    )
    await deleteDialog.getByRole('button', { name: 'Cancel' }).click()
    assert.equal(
      await fs.promises.stat(deleteRepository).then(() => true),
      true
    )

    await deleteButton.click()
    await deleteDialog.getByLabel('Delete permanently').check()
    await deleteDialog
      .getByText(/Permanent deletion cannot be undone/i)
      .waitFor()
    await deleteDialog
      .getByRole('button', { name: 'Delete permanently' })
      .click()
    await page
      .locator('.repository-list-item')
      .filter({ hasText: 'delete-repository' })
      .waitFor({ state: 'hidden' })
    assert.equal(fs.existsSync(deleteRepository), false)

    console.log(
      'Source repository recovery passed: API classification, path normalization, bare/non-Git/missing states, initialize recovery, and regular add'
    )
  } finally {
    if (previousGlobalGitConfig === undefined)
      delete process.env.GIT_CONFIG_GLOBAL
    else process.env.GIT_CONFIG_GLOBAL = previousGlobalGitConfig
    if (previousAssumeDifferentOwner === undefined)
      delete process.env.GIT_TEST_ASSUME_DIFFERENT_OWNER
    else
      process.env.GIT_TEST_ASSUME_DIFFERENT_OWNER = previousAssumeDifferentOwner
    await browser.close()
    await new Promise(resolve => server.close(resolve))
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
