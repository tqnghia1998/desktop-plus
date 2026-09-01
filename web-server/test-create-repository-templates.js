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

async function waitForFile(file) {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (fs.existsSync(file)) return
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  assert.ok(fs.existsSync(file), `Expected ${file} to exist`)
}

async function waitForGit(cwd, args, expected) {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      if (git(cwd, ...args) === expected) return
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  assert.equal(git(cwd, ...args), expected)
}

async function main() {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'desktop-plus-source-repository-tools-')
  )
  const createParent = path.join(root, 'created-parent')
  const existingParent = path.join(root, 'existing-parent')
  const readmeParent = path.join(root, 'readme-parent')
  const source = path.join(root, 'source')
  const clone = path.join(root, 'clone')
  fs.mkdirSync(createParent)
  fs.mkdirSync(existingParent)
  fs.mkdirSync(readmeParent)
  fs.mkdirSync(source)
  const existingRepository = path.join(existingParent, 'existing-repository')
  fs.mkdirSync(existingRepository)
  git(existingRepository, 'init', '-b', 'main')
  const readmeRepository = path.join(readmeParent, 'readme-repository')
  fs.mkdirSync(readmeRepository)
  fs.writeFileSync(path.join(readmeRepository, 'README.md'), 'keep me\n')
  git(source, 'init', '-b', 'main')
  git(source, 'config', 'user.name', 'Source Tools')
  git(source, 'config', 'user.email', 'source-tools@example.com')
  fs.writeFileSync(path.join(source, 'README.md'), '# source tools\n')
  git(source, 'add', 'README.md')
  git(source, 'commit', '-m', 'initial source')

  const server = createServer({ getDesktopRepositories: async () => [] })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const browser = await launchBrowser()
  try {
    const createContext = await browser.newContext()
    const createPage = await createContext.newPage()
    await createPage.goto(`http://127.0.0.1:${server.address().port}`, {
      waitUntil: 'networkidle',
    })
    await createPage
      .getByRole('button', {
        name: 'Create a New Repository on your Local Drive…',
      })
      .click()
    const createDialog = createPage
      .locator('dialog')
      .filter({ hasText: 'Create repository' })
    await createDialog.waitFor()
    await createDialog.getByLabel('Name').fill('created-repository')
    await createDialog.getByLabel('Local path').fill(createParent)
    await createDialog
      .getByText(
        `The repository will be created at ${path.join(
          createParent,
          'created-repository'
        )}`
      )
      .waitFor()
    await createDialog.getByLabel('Description').fill('A generated repository')
    await createDialog
      .getByLabel('Initialize this repository with a README')
      .check()
    await createDialog.getByLabel('Git ignore').selectOption('Python')
    await createDialog.getByLabel('License').selectOption('MIT License')
    await createDialog
      .getByRole('button', { name: 'Create repository' })
      .click()
    await createPage
      .locator('#desktop-app-toolbar .sidebar-section .title')
      .getByText('created-repository', { exact: true })
      .waitFor()
    await waitForFile(
      path.join(createParent, 'created-repository', 'README.md')
    )
    await waitForFile(
      path.join(createParent, 'created-repository', '.gitignore')
    )
    await waitForFile(path.join(createParent, 'created-repository', 'LICENSE'))
    await waitForGit(
      path.join(createParent, 'created-repository'),
      ['log', '-1', '--format=%s'],
      'Initial commit'
    )
    assert.equal(
      fs.readFileSync(
        path.join(createParent, 'created-repository', 'README.md'),
        'utf8'
      ),
      '# created-repository\nA generated repository\n'
    )
    assert.match(
      fs.readFileSync(
        path.join(createParent, 'created-repository', '.gitignore'),
        'utf8'
      ),
      /__pycache__/
    )
    assert.match(
      fs.readFileSync(
        path.join(createParent, 'created-repository', 'LICENSE'),
        'utf8'
      ),
      /MIT License|Permission is hereby granted/
    )
    assert.equal(
      fs.readFileSync(
        path.join(createParent, 'created-repository', '.gitattributes'),
        'utf8'
      ),
      '# Auto detect text files and perform LF normalization\n* text=auto\n'
    )
    assert.equal(
      fs.readFileSync(
        path.join(createParent, 'created-repository', '.git', 'description'),
        'utf8'
      ),
      'A generated repository'
    )
    assert.equal(
      git(
        path.join(createParent, 'created-repository'),
        'branch',
        '--show-current'
      ),
      'master'
    )
    assert.equal(
      git(
        path.join(createParent, 'created-repository'),
        'log',
        '-1',
        '--format=%s'
      ),
      'Initial commit'
    )
    assert.equal(
      git(
        path.join(createParent, 'created-repository'),
        'log',
        '-1',
        '--format=%D'
      ),
      'HEAD -> master'
    )
    await createContext.close()

    const warningContext = await browser.newContext()
    const warningPage = await warningContext.newPage()
    const warningErrors = []
    warningPage.on('pageerror', error => warningErrors.push(error.message))
    await warningPage.goto(`http://127.0.0.1:${server.address().port}`, {
      waitUntil: 'networkidle',
    })
    await warningPage
      .getByRole('button', {
        name: 'Create a New Repository on your Local Drive…',
      })
      .click()
    const warningDialog = warningPage
      .locator('dialog')
      .filter({ hasText: 'Create repository' })
    await warningDialog.getByLabel('Name').fill('existing-repository')
    await warningDialog.getByLabel('Local path').fill(existingParent)
    await warningDialog
      .locator('#existing-repository-path-error')
      .getByText(/appears to be a Git repository/)
      .waitFor()
    assert.equal(
      await warningDialog
        .getByRole('button', { name: 'Create repository' })
        .isDisabled(),
      true
    )
    await warningDialog.getByLabel('Name').fill('readme-repository')
    await warningDialog.getByLabel('Local path').fill(readmeParent)
    await warningDialog
      .getByLabel('Initialize this repository with a README')
      .check()
    await warningDialog
      .locator('#readme-overwrite-warning')
      .getByText(/This directory contains a README\.md file already/)
      .waitFor()
    assert.deepEqual(warningErrors, [])
    await warningContext.close()

    const page = await browser.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`http://127.0.0.1:${server.address().port}`, {
      waitUntil: 'networkidle',
    })

    await page
      .getByRole('button', {
        name: 'Clone a Repository from the Internet…',
      })
      .click()
    const cloneDialog = page
      .locator('dialog')
      .filter({ hasText: 'Clone a Repository' })
    await cloneDialog.waitFor()
    await cloneDialog
      .getByPlaceholder('URL or username/repository')
      .fill(source)
    await cloneDialog.getByLabel('Local Path').fill(clone)
    await cloneDialog.getByRole('button', { name: 'Clone' }).click()
    await page
      .locator('#desktop-app-toolbar .sidebar-section .title')
      .getByText('clone', { exact: true })
      .waitFor()

    assert.equal(git(clone, 'log', '-1', '--format=%s'), 'initial source')
    assert.deepEqual(errors, [])
    console.log('Source repository tools passed: clone repository creation')
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
