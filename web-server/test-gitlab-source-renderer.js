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

async function main() {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'desktop-plus-gitlab-source-')
  )
  const repository = path.join(root, 'repository')
  fs.mkdirSync(repository)
  git(repository, 'init', '-b', 'main')
  git(repository, 'config', 'user.name', 'GitLab Source')
  git(repository, 'config', 'user.email', 'gitlab-source@example.com')
  git(
    repository,
    'remote',
    'add',
    'origin',
    'https://gitlab.example/group/subgroup/web-source-repository.git'
  )
  fs.writeFileSync(path.join(repository, 'README.md'), '# GitLab source\n')
  git(repository, 'add', 'README.md')
  git(repository, 'commit', '-m', 'Initial commit')

  const server = createServer({ getDesktopRepositories: async () => [] })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  const browser = await launchBrowser()
  try {
    const page = await browser.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(base, { waitUntil: 'networkidle' })
    await page
      .getByRole('button', {
        name: /Add an Existing Repository from your local drive…/i,
      })
      .click()
    await page.getByLabel('Local path').fill(repository)
    await page.getByRole('button', { name: 'Add repository' }).click()
    await page.waitForFunction(() =>
      document
        .querySelector('#desktop-app-toolbar .branch-toolbar-button .title')
        ?.textContent?.includes('main')
    )
    assert.match(
      await page.locator('#desktop-app-toolbar').innerText(),
      /Current Branch\s*main/
    )
    assert.deepEqual(errors, [])
    console.log(
      'GitLab native renderer passed: self-hosted remote repository renders in the Desktop UI'
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
