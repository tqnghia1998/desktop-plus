const assert = require('assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { createServer } = require('./server')
const { launchBrowser } = require('./test-browser')

async function main() {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'desktop-plus-source-tutorial-')
  )
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
      .getByRole('button', { name: /Create a tutorial repository/i })
      .click()
    const startDialog = page.getByRole('dialog').filter({
      hasText: 'Start local Git tutorial',
    })
    await startDialog.waitFor()
    await startDialog.getByLabel('Parent directory').fill(root)
    await startDialog
      .getByRole('button', { name: 'Create tutorial repository' })
      .click()

    await page.locator('[aria-label="Git tutorial"]').waitFor()
    const tutorial = page.locator('[aria-label="Git tutorial"]')
    await page.getByText('Create a branch', { exact: true }).waitFor()
    assert.equal(
      await tutorial.getAttribute('data-tutorial-step'),
      'CreateBranch'
    )

    await tutorial
      .getByRole('button', { name: 'Create tutorial branch' })
      .click()
    await page.waitForFunction(
      () =>
        document
          .querySelector('[aria-label="Git tutorial"]')
          ?.getAttribute('data-tutorial-step') === 'EditFile'
    )

    const repositoryPath = await page
      .locator('.branch-toolbar-button .title')
      .evaluate(element => element.textContent)
    assert.match(repositoryPath || '', /tutorial-work|main/)

    const repository = fs
      .readdirSync(root)
      .map(name => path.join(root, name))
      .find(candidate => fs.existsSync(path.join(candidate, '.git')))
    assert.ok(repository, 'Expected tutorial repository on disk')
    fs.appendFileSync(path.join(repository, 'README.md'), '\nTutorial edit.\n')

    await tutorial.getByRole('button', { name: 'Refresh changes' }).click()
    await page.waitForFunction(
      () =>
        document
          .querySelector('[aria-label="Git tutorial"]')
          ?.getAttribute('data-tutorial-step') === 'MakeCommit'
    )

    await tutorial.getByRole('button', { name: 'Commit README change' }).click()
    const commitDialog = page.getByRole('dialog').filter({
      hasText: 'Commit changes',
    })
    await commitDialog.getByLabel('Commit message').fill('Complete tutorial')
    await commitDialog
      .getByRole('button', { name: 'Commit changes', exact: true })
      .click()
    await page.waitForFunction(
      () =>
        document
          .querySelector('[aria-label="Git tutorial"]')
          ?.getAttribute('data-tutorial-step') === 'AllDone'
    )
    await tutorial.getByText("You're done!", { exact: true }).waitFor()

    await page.getByRole('button', { name: 'Pause', exact: true }).click()
    await page
      .getByRole('button', { name: /Return to in progress tutorial/i })
      .waitFor()
    await page
      .getByRole('button', { name: /Return to in progress tutorial/i })
      .click()
    await page.locator('[aria-label="Git tutorial"]').waitFor()
    await page.waitForFunction(
      () =>
        document
          .querySelector('[aria-label="Git tutorial"]')
          ?.getAttribute('data-tutorial-step') === 'AllDone'
    )
    assert.equal(
      await page
        .locator('[aria-label="Git tutorial"]')
        .getAttribute('data-tutorial-step'),
      'AllDone'
    )

    assert.deepEqual(errors, [])
    console.log(
      'Source tutorial workflow passed: local creation, step progression, completion, pause, and resume'
    )
  } finally {
    await browser.close()
    await new Promise(resolve => server.close(resolve))
    fs.rmSync(root, { recursive: true, force: true })
  }
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
