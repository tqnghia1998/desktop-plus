const assert = require('assert/strict')
const { createServer } = require('./server')
const { launchBrowser } = require('./test-browser')

async function main() {
  const server = createServer({
    selectDirectory: async () => null,
    getDesktopRepositories: async () => [],
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  const browser = await launchBrowser()
  try {
    const page = await browser.newPage()
    await page.goto(base, { waitUntil: 'networkidle' })
    await page
      .getByRole('button', {
        name: /Add an Existing Repository from your local drive…/i,
      })
      .click()
    const dialog = page.locator('dialog').filter({ hasText: 'Add repository' })
    await dialog.waitFor()
    assert.equal(await dialog.getByLabel('Local path').inputValue(), '')
    await page.waitForTimeout(250)
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await dialog.waitFor({ state: 'hidden' })
    assert.equal(await dialog.isVisible(), false)
    console.log(
      'Source renderer dialog passed: repository path dialog and cancellation'
    )
  } finally {
    await browser.close()
    await new Promise(resolve => server.close(resolve))
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
