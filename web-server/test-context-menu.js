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
    path.join(os.tmpdir(), 'desktop-plus-context-menu-')
  )
  const repository = path.join(root, 'repository')
  fs.mkdirSync(repository)
  git(repository, 'init', '-b', 'main')
  git(repository, 'config', 'user.name', 'Context Menu Test')
  git(repository, 'config', 'user.email', 'context-menu@example.com')
  fs.writeFileSync(path.join(repository, 'README.md'), '# Context menu\n')
  git(repository, 'add', '.')
  git(repository, 'commit', '-m', 'Tagged commit')

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
    await page
      .locator('#desktop-app-toolbar .branch-toolbar-button .title')
      .getByText('main', { exact: true })
      .waitFor()

    const branch = page
      .locator('.branch-toolbar-button')
      .getByRole('button')
      .last()
    const branchBounds = await branch.boundingBox()
    assert.ok(branchBounds, 'Expected the branch button to have visible bounds')

    const pointer = { x: 28, y: 16 }
    await branch.evaluate(
      (button, position) =>
        button.dispatchEvent(
          new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            button: 2,
            buttons: 2,
            clientX: position.x,
            clientY: position.y,
          })
        ),
      {
        x: branchBounds.x + pointer.x,
        y: branchBounds.y + pointer.y,
      }
    )
    const menu = page.locator('#web-context-menu')
    await menu.waitFor()
    await menu.getByRole('menuitem', { name: 'Copy Branch Name' }).waitFor()
    const menuBounds = await menu.boundingBox()
    assert.ok(menuBounds, 'Expected the context menu to have visible bounds')
    assert.ok(
      Math.abs(menuBounds.x - (branchBounds.x + pointer.x)) <= 2,
      `Expected menu x=${menuBounds.x} near pointer x=${
        branchBounds.x + pointer.x
      }`
    )
    assert.ok(
      Math.abs(menuBounds.y - (branchBounds.y + pointer.y)) <= 2,
      `Expected menu y=${menuBounds.y} near pointer y=${
        branchBounds.y + pointer.y
      }`
    )
    await page.keyboard.press('Escape')
    await menu.waitFor({ state: 'hidden' })
    console.log('Desktop context menu passed: anchored to right-click pointer')
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
