const assert = require('assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')
const { createServer } = require('./server')
const { launchBrowser } = require('./test-browser')

const git = (cwd, ...args) =>
  execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()

async function main() {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'desktop-plus-stale-branch-')
  )
  const remote = path.join(root, 'remote.git')
  const repository = path.join(root, 'repository')
  const server = createServer()
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  const browser = await launchBrowser()

  try {
    git(root, 'init', '--bare', remote)
    fs.mkdirSync(repository)
    git(repository, 'init', '-b', 'main')
    git(repository, 'config', 'user.name', 'Stale Branch Test')
    git(repository, 'config', 'user.email', 'stale-branch@example.com')
    fs.writeFileSync(path.join(repository, 'file.txt'), 'base\n')
    git(repository, 'add', 'file.txt')
    git(repository, 'commit', '-m', 'base')
    git(repository, 'remote', 'add', 'origin', remote)
    git(repository, 'push', '-u', 'origin', 'main')
    git(root, '--git-dir', remote, 'symbolic-ref', 'HEAD', 'refs/heads/main')
    git(repository, 'checkout', '-b', 'stale')
    fs.writeFileSync(path.join(repository, 'file.txt'), 'stale\n')
    git(repository, 'add', 'file.txt')
    git(repository, 'commit', '-m', 'stale')
    git(repository, 'push', '-u', 'origin', 'stale')

    const page = await browser.newPage()
    await page.goto(base)
    await page.waitForFunction(
      () =>
        typeof window.__desktopPlusDispatcher?.addRepositories === 'function'
    )
    await page.evaluate(async repositoryPath => {
      const dispatcher = window.__desktopPlusDispatcher
      const [repository] = await dispatcher.addRepositories([repositoryPath])
      await dispatcher.switchToDefaultBranchAndPull(repository, 'stale')
    }, repository)

    assert.equal(git(repository, 'branch', '--show-current'), 'main')
    assert.doesNotMatch(
      git(repository, 'branch', '--list'),
      /\bstale\b/,
      'switch-to-default recovery must remove the requested stale local branch'
    )
    console.log('Browser stale-branch recovery passed')
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
