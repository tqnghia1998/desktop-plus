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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-plus-tools-'))
  const repository = path.join(root, 'repository')
  fs.mkdirSync(repository)
  git(repository, 'init', '-b', 'main')
  git(repository, 'config', 'user.name', 'Tools Test')
  git(repository, 'config', 'user.email', 'tools@example.com')
  fs.writeFileSync(path.join(repository, 'README.md'), '# Tools\n')
  git(repository, 'add', '.')
  git(repository, 'commit', '-m', 'Tagged commit')
  git(repository, 'tag', 'first-tag')
  git(repository, 'tag', 'second-tag')

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
    await page.getByLabel('Local path').fill(repository)
    await page.getByRole('button', { name: 'Add repository' }).click()
    await page.getByRole('tab', { name: 'Tools' }).click()

    const tools = page.locator('.web-tools-panel')
    await tools.getByRole('button', { name: 'Delete' }).first().click()
    const confirmation = page.getByRole('alertdialog')
    await confirmation.waitFor()
    await confirmation.getByRole('button', { name: 'Cancel' }).click()
    await confirmation.waitFor({ state: 'hidden' })
    assert.match(git(repository, 'tag'), /first-tag/)

    await tools.getByRole('button', { name: 'Delete' }).first().click()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Delete local tag' })
      .click()
    for (
      let attempt = 0;
      attempt < 50 && hasTag(repository, 'first-tag');
      attempt++
    )
      await new Promise(resolve => setTimeout(resolve, 100))
    assert.doesNotMatch(git(repository, 'tag'), /first-tag/)
    assert.match(git(repository, 'tag'), /second-tag/)
    console.log('Source tools passed: tag deletion confirmation and lifecycle')
  } finally {
    await browser.close()
    await new Promise(resolve => server.close(resolve))
    fs.rmSync(root, { recursive: true, force: true })
  }
}

function hasTag(repository, tag) {
  try {
    execFileSync('git', ['rev-parse', '--verify', `refs/tags/${tag}`], {
      cwd: repository,
      stdio: ['ignore', 'ignore', 'ignore'],
    })
    return true
  } catch {
    return false
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
