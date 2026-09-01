const { execFileSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { createServer } = require('./server')
const { launchBrowser } = require('./test-browser')

const modifierKey = process.platform === 'darwin' ? 'Meta' : 'Control'

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
}

async function main() {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'desktop-plus-changes-selection-')
  )
  const repository = path.join(root, 'repository')
  fs.mkdirSync(repository)
  git(repository, 'init', '-b', 'main')
  git(repository, 'config', 'user.name', 'Changes Selection')
  git(repository, 'config', 'user.email', 'changes-selection@example.com')

  for (const filename of ['one.txt', 'two.txt', 'three.txt']) {
    fs.writeFileSync(path.join(repository, filename), `${filename}\n`)
  }
  git(repository, 'add', '.')
  git(repository, 'commit', '-m', 'initial')
  fs.writeFileSync(path.join(repository, 'one.txt'), 'second commit\n')
  git(repository, 'add', 'one.txt')
  git(repository, 'commit', '-m', 'second')
  fs.writeFileSync(path.join(repository, 'two.txt'), 'third commit\n')
  git(repository, 'add', 'two.txt')
  git(repository, 'commit', '-m', 'third')
  for (const filename of ['one.txt', 'two.txt', 'three.txt']) {
    fs.writeFileSync(path.join(repository, filename), `changed ${filename}\n`)
  }

  const server = createServer({ getDesktopRepositories: async () => [] })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const browser = await launchBrowser()

  try {
    const page = await browser.newPage()
    await page.goto(`http://127.0.0.1:${server.address().port}`, {
      waitUntil: 'networkidle',
    })
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

    const files = page.locator('#changes-list [role="option"]')
    await files.nth(2).waitFor()
    await files.nth(0).click()
    await files.nth(1).click({ modifiers: [modifierKey] })
    await files.nth(2).click({ modifiers: [modifierKey] })
    await page.waitForFunction(
      () =>
        document.querySelectorAll(
          '#changes-list [role="option"][aria-selected="true"]'
        ).length === 3
    )

    await page
      .locator('#changes-list [role="listbox"]')
      .press(`${modifierKey}+A`)
    await page.waitForFunction(
      () =>
        document.querySelectorAll(
          '#changes-list [role="option"][aria-selected="true"]'
        ).length === 3
    )

    await page.getByRole('tab', { name: 'History' }).click()
    const commits = page.locator('#commit-list [role="option"]')
    await commits.nth(2).waitFor()
    await commits.nth(0).click()
    await commits.nth(1).click({ modifiers: [modifierKey] })
    await commits.nth(2).click({ modifiers: [modifierKey] })
    await page.waitForFunction(
      () =>
        document.querySelectorAll(
          '#commit-list [role="option"][aria-selected="true"]'
        ).length === 3
    )
    await page
      .locator('#commit-list [role="listbox"]')
      .press(`${modifierKey}+A`)
    await page.waitForFunction(
      () =>
        document.querySelectorAll(
          '#commit-list [role="option"][aria-selected="true"]'
        ).length === 3
    )
  } finally {
    await browser.close()
    await new Promise(resolve => server.close(resolve))
    fs.rmSync(root, { recursive: true, force: true })
  }

  console.log(
    'Web selection source test passed: Cmd/Ctrl multi-select and select-all retain every changed file and commit'
  )
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
