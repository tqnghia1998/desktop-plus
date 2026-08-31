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
    path.join(os.tmpdir(), 'desktop-plus-source-platform-')
  )
  const repository = path.join(root, 'repository')
  const relocatedRepository = path.join(root, 'relocated-repository')
  const worktree = path.join(root, 'linked-worktree')
  fs.mkdirSync(repository)
  git(repository, 'init', '-b', 'main')
  git(repository, 'config', 'user.name', 'Source Platform')
  git(repository, 'config', 'user.email', 'source-platform@example.com')
  fs.writeFileSync(path.join(repository, 'README.md'), '# platform controls\n')
  git(repository, 'add', 'README.md')
  git(repository, 'commit', '-m', 'Initial platform fixture')
  fs.writeFileSync(path.join(repository, 'notes.txt'), 'platform file\n')

  const launches = []
  const lfsCalls = []
  const openedPaths = []
  const directorySelections = [
    root,
    root,
    root,
    repository,
    relocatedRepository,
    worktree,
  ]
  let directorySelectionIndex = 0
  let installerOpened = false
  let updateOperation
  const lfsStatus = {
    available: true,
    version: '3.5.0',
    filtersConfigured: true,
    hooksInstalled: true,
    trackedPatterns: ['*.bin'],
    mismatches: [],
  }
  const integrations = {
    platform: 'darwin',
    editors: [{ name: 'Test Editor', path: '/Applications/Test Editor.app' }],
    shells: [{ name: 'Test Shell', path: '/Applications/Test Shell.app' }],
    dependencies: {},
    guidance: null,
  }
  const updates = {
    async check() {
      return {
        status: 'available',
        currentVersion: '1.0.0',
        platform: 'darwin',
        availableVersion: '2.0.0',
        releaseNotes: 'Signed platform fixture update',
        message: 'Version 2.0.0 is ready to download.',
      }
    },
    async startDownload() {
      updateOperation = {
        id: 'update-platform-fixture',
        status: updateOperation ? 'downloading' : 'downloaded',
        downloadedBytes: updateOperation ? 0 : 128,
        totalBytes: 128,
        artifactName: 'Desktop Plus 2.0.0.pkg',
        error: null,
      }
      return updateOperation
    },
    getOperation() {
      return updateOperation
    },
    cancel() {
      updateOperation = { ...updateOperation, status: 'cancelled' }
      return updateOperation
    },
    async openDownloaded(id, confirmed) {
      assert.equal(id, 'update-platform-fixture')
      assert.equal(confirmed, true)
      installerOpened = true
      updateOperation = { ...updateOperation, status: 'opened' }
      return updateOperation
    },
    cancelAll() {},
  }
  const lfsTasks = {
    tasks: new Map(),
    start(_repositoryPath, command) {
      const task = {
        id: `lfs-${command}`,
        command,
        status: command === 'fetch' ? 'completed' : 'running',
        output:
          command === 'fetch'
            ? `git lfs ${command} completed`
            : `git lfs ${command} running`,
        progress: command === 'fetch' ? 100 : 25,
      }
      this.tasks.set(task.id, task)
      return task
    },
    get(id) {
      return this.tasks.get(id)
    },
    cancel(id) {
      const task = this.tasks.get(id)
      const cancelled = {
        ...task,
        status: 'cancelled',
        output: 'cancelled',
        progress: null,
      }
      this.tasks.set(id, cancelled)
      return cancelled
    },
    cancelAll() {},
  }
  const server = createServer({
    getDesktopRepositories: async () => [],
    selectDirectory: async () => {
      const selected = directorySelections[directorySelectionIndex]
      directorySelectionIndex += 1
      return selected
    },
    openPath: async (target, reveal) => openedPaths.push({ target, reveal }),
    discoverIntegrations: async () => integrations,
    launchIntegration: async body => launches.push(body),
    getLfsStatus: async () => ({ ...lfsStatus }),
    installLfs: async (_path, scope, confirmed) => {
      assert.equal(confirmed, true)
      lfsCalls.push({ action: 'install', scope })
      return { ...lfsStatus }
    },
    repairLfs: async (_path, confirmed) => {
      assert.equal(confirmed, true)
      lfsCalls.push({ action: 'repair' })
      return { ...lfsStatus }
    },
    lfsTasks,
    updates,
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const browser = await launchBrowser()

  try {
    const page = await browser.newPage()
    await page.context().grantPermissions(['notifications'], {
      origin: `http://127.0.0.1:${server.address().port}`,
    })
    await page.addInitScript(() => {
      window.__desktopPlusSecurityPolicyViolations = []
      document.addEventListener('securitypolicyviolation', event => {
        window.__desktopPlusSecurityPolicyViolations.push({
          blockedURI: event.blockedURI,
          effectiveDirective: event.effectiveDirective,
          lineNumber: event.lineNumber,
          sourceFile: event.sourceFile,
        })
      })
    })
    const pageErrors = []
    page.on('pageerror', error => pageErrors.push(error.message))
    await page.goto(`http://127.0.0.1:${server.address().port}`, {
      waitUntil: 'networkidle',
    })

    const applicationMenu = page.getByRole('navigation', {
      name: 'Application menu',
    })
    await applicationMenu.getByRole('button', { name: 'File' }).waitFor()
    await applicationMenu.getByRole('button', { name: 'File' }).click()
    await applicationMenu
      .getByRole('menuitem', { name: 'New repository' })
      .click()
    await page
      .getByRole('dialog')
      .filter({ hasText: 'Create repository' })
      .waitFor()
    await page.getByRole('button', { name: 'Cancel' }).click()

    await page
      .getByRole('button', { name: /Clone a repository from the Internet/i })
      .click()
    const cloneDialog = page.getByRole('dialog').filter({
      hasText: 'Clone repository',
    })
    await cloneDialog.getByRole('button', { name: 'Choose folder' }).click()
    await page.waitForFunction(expected => {
      const input = document.querySelector('#repository-setup-path')
      return input instanceof HTMLInputElement && input.value === expected
    }, root)
    assert.equal(
      await cloneDialog.getByLabel('Destination path').inputValue(),
      root
    )
    await cloneDialog.getByRole('button', { name: 'Cancel' }).click()

    await page
      .getByRole('button', {
        name: /Create a New Repository on your local drive/i,
      })
      .click()
    const initDialog = page.getByRole('dialog').filter({
      hasText: 'Create repository',
    })
    await initDialog.getByRole('button', { name: 'Choose folder' }).click()
    await page.waitForFunction(expected => {
      const input = document.querySelector('#repository-setup-parent-path')
      return input instanceof HTMLInputElement && input.value === expected
    }, root)
    assert.equal(
      await initDialog.getByLabel('Parent directory').inputValue(),
      root
    )
    await initDialog.getByRole('button', { name: 'Cancel' }).click()

    await page
      .getByRole('button', { name: /Create a tutorial repository/i })
      .click()
    const tutorialDialog = page.getByRole('dialog').filter({
      hasText: 'Start local Git tutorial',
    })
    await tutorialDialog.getByRole('button', { name: 'Choose folder' }).click()
    await page.waitForFunction(expected => {
      const input = document.querySelector('#web-tutorial-parent-path')
      return input instanceof HTMLInputElement && input.value === expected
    }, root)
    assert.equal(
      await tutorialDialog.getByLabel('Parent directory').inputValue(),
      root
    )
    await tutorialDialog.getByRole('button', { name: 'Cancel' }).click()

    await page
      .getByRole('button', {
        name: /Add an Existing Repository from your local drive…/i,
      })
      .click()
    const repositoryDialog = page
      .getByRole('dialog')
      .filter({ hasText: 'Add repository' })
    await repositoryDialog
      .getByRole('button', { name: 'Choose folder' })
      .click()
    await page.waitForFunction(expected => {
      const input = document.querySelector('#repository-path')
      return input instanceof HTMLInputElement && input.value === expected
    }, repository)
    assert.equal(
      await repositoryDialog.getByLabel('Local path').inputValue(),
      repository
    )
    await repositoryDialog
      .getByRole('button', { name: 'Add repository' })
      .click()
    await applicationMenu.getByRole('button', { name: 'Edit' }).click()
    for (const label of [
      'Undo',
      'Redo',
      'Cut',
      'Copy',
      'Paste',
      'Select all',
      'Find',
    ])
      await applicationMenu.getByRole('menuitem', { name: label }).waitFor()
    await page.keyboard.press('Escape')
    await page.getByRole('tab', { name: 'Changes' }).click()
    await page.getByRole('option', { name: /^notes\.txt/ }).click()
    const fileActions = page.getByRole('group', {
      name: 'notes.txt file actions',
    })
    await fileActions
      .getByRole('button', { name: 'Open in default app' })
      .click()
    await fileActions.getByRole('button', { name: 'Reveal in Finder' }).click()
    assert.deepEqual(openedPaths, [
      { target: path.join(repository, 'notes.txt'), reveal: false },
      { target: path.join(repository, 'notes.txt'), reveal: true },
    ])
    await applicationMenu.getByRole('button', { name: 'View' }).click()
    await applicationMenu.getByRole('menuitem', { name: 'History' }).click()
    await page.getByRole('tab', { name: 'History' }).waitFor()
    await page.keyboard.press('Meta+2')
    await page.getByRole('tab', { name: 'History' }).waitFor()
    await page.keyboard.press('Meta+1')
    await page.getByRole('tab', { name: 'Changes' }).waitFor()
    await applicationMenu.getByRole('button', { name: 'View' }).click()
    for (const label of [
      /^Changes .*⌘1$/,
      /^History .*⌘2$/,
      /^Compare .*⌘3$/,
      /^Repository tools .*⌘4$/,
      'Refresh repository',
      /(?:Show|Hide) Changes filters/,
      /(?:Show|Hide) stashed changes/,
      /^Zoom in .*⌘\+$/,
      /^Zoom out .*⌘-$/,
      /^Reset zoom/,
      'Toggle full screen',
      /^Expand active resizable .*⌘9$/,
      /^Contract active resizable .*⌘8$/,
      /^Preferences .*⌘,$/,
    ])
      await applicationMenu
        .getByRole('menuitem', {
          name: label,
          ...(typeof label === 'string' ? { exact: true } : {}),
        })
        .waitFor()
    await page.keyboard.press('Escape')
    await applicationMenu.getByRole('button', { name: 'Repository' }).click()
    for (const label of [
      'Commit included changes',
      'Fetch',
      'Pull',
      'Push',
      'Remove repository',
      'Open in shell',
      'Open in editor',
      'Show in Finder',
      'Repository settings',
      'Manage remotes',
    ])
      await applicationMenu.getByRole('menuitem', { name: label }).waitFor()
    await page.keyboard.press('Escape')
    await applicationMenu.getByRole('button', { name: 'Branch' }).click()
    for (const label of [
      /^New branch .*⇧⌘N$/,
      /^Rename current branch .*⇧⌘R$/,
      /^Delete current branch .*⇧⌘D$/,
      'Discard all changes',
      /^Stash all changes .*⇧⌘S$/,
      /^Update from default branch .*⇧⌘U$/,
      /^Merge into current branch .*⇧⌘M$/,
      /^Squash merge into current branch .*⇧⌘H$/,
      /^Rebase current branch .*⇧⌘E$/,
    ])
      await applicationMenu.getByRole('menuitem', { name: label }).waitFor()
    await page.keyboard.press('Escape')
    await applicationMenu.getByRole('button', { name: 'View' }).click()
    await applicationMenu.getByRole('menuitem', { name: 'Zoom in' }).click()
    await page
      .getByRole('status', { name: 'Browser zoom' })
      .getByText('Zoom 105%')
      .waitFor()
    assert.equal(
      await page.evaluate(() =>
        localStorage.getItem('desktop-plus-web-zoom-factor')
      ),
      '1.05'
    )
    await applicationMenu.getByRole('button', { name: 'View' }).click()
    await applicationMenu.getByRole('menuitem', { name: 'Zoom out' }).click()
    await page.waitForFunction(
      () => localStorage.getItem('desktop-plus-web-zoom-factor') === '1'
    )
    await applicationMenu.getByRole('button', { name: 'View' }).click()
    await applicationMenu.getByRole('menuitem', { name: 'Zoom in' }).click()
    await page.waitForFunction(
      () => localStorage.getItem('desktop-plus-web-zoom-factor') === '1.05'
    )
    await applicationMenu.getByRole('button', { name: 'View' }).click()
    await applicationMenu.getByRole('menuitem', { name: /^Reset zoom/ }).click()
    await page.waitForFunction(
      () => localStorage.getItem('desktop-plus-web-zoom-factor') === '1'
    )
    await page.reload({ waitUntil: 'networkidle' })
    assert.equal(
      await page.evaluate(() =>
        localStorage.getItem('desktop-plus-web-zoom-factor')
      ),
      '1'
    )
    await page.keyboard.press('Meta+,')
    await page.getByRole('dialog').filter({ hasText: 'Preferences' }).waitFor()
    await page
      .getByRole('dialog')
      .filter({ hasText: 'Preferences' })
      .locator('.dialog-footer')
      .getByRole('button', { name: 'Close', exact: true })
      .click()

    await applicationMenu.getByRole('button', { name: 'File' }).click()
    await applicationMenu
      .getByRole('menuitem', { name: 'Clone repository' })
      .click()
    const shortcutPathDialog = page
      .getByRole('dialog')
      .filter({ hasText: 'Clone repository' })
    await shortcutPathDialog
      .getByLabel('Destination path')
      .fill('/tmp/shortcut')
    await page.keyboard.press('Meta+o')
    await page.waitForTimeout(100)
    assert.equal(await shortcutPathDialog.isVisible(), true)
    await shortcutPathDialog.getByRole('button', { name: 'Cancel' }).click()
    const repositoryPickerButton = page
      .locator('.sidebar-section')
      .getByRole('button')
      .first()
    await repositoryPickerButton.click()
    const revealRepository = page.getByRole('button', {
      name: /Reveal .* in Finder/,
    })
    await revealRepository.waitFor()
    openedPaths.length = 0
    await revealRepository.click()
    assert.deepEqual(openedPaths, [{ target: repository, reveal: true }])
    await page.keyboard.press('Escape')
    await page.getByRole('tab', { name: 'Tools' }).click()

    await page.getByRole('button', { name: 'Open preferences' }).click()
    const preferences = page.getByRole('dialog').filter({
      hasText: 'Preferences',
    })
    await preferences.getByLabel('Enable browser notifications').uncheck()
    await preferences
      .getByText('Browser notifications are disabled in Desktop Plus.', {
        exact: true,
      })
      .waitFor()
    await preferences
      .locator('.dialog-footer')
      .getByRole('button', { name: 'Close', exact: true })
      .click()
    await page.reload({ waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Open preferences' }).click()
    const reloadedPreferences = page.getByRole('dialog').filter({
      hasText: 'Preferences',
    })
    assert.equal(
      await reloadedPreferences
        .getByLabel('Enable browser notifications')
        .isChecked(),
      false
    )
    await reloadedPreferences.getByLabel('Enable browser notifications').check()
    const allowNotifications = reloadedPreferences.getByRole('button', {
      name: 'Allow browser notifications',
    })
    if (await allowNotifications.isVisible().catch(() => false))
      await allowNotifications.click()
    await reloadedPreferences
      .getByText('Browser notifications are allowed for this browser.', {
        exact: true,
      })
      .waitFor()
    await reloadedPreferences
      .locator('.dialog-footer')
      .getByRole('button', { name: 'Close', exact: true })
      .click()

    await page.getByRole('tab', { name: 'Tools' }).click()
    const tools = page.getByRole('region', { name: 'Repository tools' })
    const integrationsSection = page.getByRole('region', {
      name: 'Platform integrations',
    })
    await integrationsSection
      .getByText('Test Editor', { exact: true })
      .waitFor()
    await integrationsSection
      .getByRole('button', { name: 'Open repository' })
      .first()
      .click()
    await integrationsSection
      .getByRole('button', { name: 'Open repository' })
      .nth(1)
      .click()
    assert.deepEqual(
      launches.map(launch => ({ kind: launch.kind, target: launch.target })),
      [
        { kind: 'editor', target: repository },
        { kind: 'shell', target: repository },
      ]
    )
    await page.getByRole('button', { name: 'Open preferences' }).click()
    const integrationPreferences = page.getByRole('dialog').filter({
      hasText: 'Preferences',
    })
    await integrationPreferences
      .getByLabel('Repository editor')
      .selectOption({ label: 'Test Editor' })
    await integrationPreferences
      .getByLabel('Repository shell')
      .selectOption({ label: 'Test Shell' })
    await integrationPreferences
      .locator('.dialog-footer')
      .getByRole('button', { name: 'Close', exact: true })
      .click()
    await integrationsSection
      .getByRole('button', { name: 'Open selected editor' })
      .click()
    await integrationsSection
      .getByRole('button', { name: 'Open selected shell' })
      .click()
    assert.deepEqual(
      launches.slice(-2).map(launch => ({
        kind: launch.kind,
        name: launch.name,
        custom: launch.custom,
      })),
      [
        { kind: 'editor', name: 'Test Editor', custom: null },
        { kind: 'shell', name: 'Test Shell', custom: null },
      ]
    )
    await page.getByRole('button', { name: 'Open preferences' }).click()
    const customPreferences = page.getByRole('dialog').filter({
      hasText: 'Preferences',
    })
    await customPreferences
      .getByLabel('Repository editor')
      .selectOption({ label: 'Custom executable' })
    await customPreferences
      .getByLabel('Custom editor executable')
      .fill('/bin/echo')
    await customPreferences
      .getByLabel('Custom editor arguments')
      .fill('--target %TARGET_PATH%')
    await customPreferences
      .getByLabel('Repository shell')
      .selectOption({ label: 'Custom executable' })
    await customPreferences
      .getByLabel('Custom shell executable')
      .fill('/bin/echo')
    await customPreferences
      .getByLabel('Custom shell arguments')
      .fill('--cwd %TARGET_PATH%')
    await customPreferences
      .locator('.dialog-footer')
      .getByRole('button', { name: 'Close', exact: true })
      .click()
    await integrationsSection
      .getByRole('button', { name: 'Open selected editor' })
      .click()
    await integrationsSection
      .getByRole('button', { name: 'Open selected shell' })
      .click()
    assert.deepEqual(
      launches.slice(-2).map(launch => ({
        kind: launch.kind,
        name: launch.name,
        custom: launch.custom,
      })),
      [
        {
          kind: 'editor',
          name: null,
          custom: { path: '/bin/echo', arguments: '--target %TARGET_PATH%' },
        },
        {
          kind: 'shell',
          name: null,
          custom: { path: '/bin/echo', arguments: '--cwd %TARGET_PATH%' },
        },
      ]
    )
    await page.getByRole('button', { name: 'Open preferences' }).click()
    const invalidPreferences = page.getByRole('dialog').filter({
      hasText: 'Preferences',
    })
    await invalidPreferences
      .getByLabel('Custom editor arguments')
      .fill('--target')
    await invalidPreferences
      .getByText('Custom editor arguments must contain %TARGET_PATH%.', {
        exact: true,
      })
      .waitFor()
    await invalidPreferences
      .locator('.dialog-footer')
      .getByRole('button', { name: 'Close', exact: true })
      .click()
    assert.equal(
      await integrationsSection
        .getByRole('button', { name: 'Open selected editor' })
        .isDisabled(),
      true
    )
    await page.getByRole('button', { name: 'Open preferences' }).click()
    const restorePreferences = page.getByRole('dialog').filter({
      hasText: 'Preferences',
    })
    await restorePreferences
      .getByLabel('Custom editor arguments')
      .fill('--target %TARGET_PATH%')
    await restorePreferences
      .locator('.dialog-footer')
      .getByRole('button', { name: 'Close', exact: true })
      .click()

    const updatesSection = page.getByRole('region', {
      name: 'Application updates',
    })
    await updatesSection
      .getByRole('button', { name: 'Check for updates' })
      .click()
    await updatesSection
      .getByText('Version 2.0.0 is ready to download.', { exact: false })
      .waitFor()
    await updatesSection
      .getByRole('button', { name: 'Download and verify update' })
      .click()
    await updatesSection.getByText('Verified Desktop Plus 2.0.0.pkg.').waitFor()
    await updatesSection
      .getByRole('button', { name: 'Open verified installer' })
      .click()
    const updateConfirmation = page.getByRole('alertdialog')
    await updateConfirmation
      .getByRole('button', { name: 'Open verified installer' })
      .click()
    assert.equal(installerOpened, true)
    await updatesSection
      .getByRole('button', { name: 'Check for updates' })
      .click()
    await updatesSection
      .getByRole('button', { name: 'Download and verify update' })
      .click()
    await updatesSection.getByText(/Downloading/).waitFor()
    await updatesSection
      .getByRole('button', { name: 'Cancel download' })
      .click()
    await updatesSection.getByText('Update download cancelled.').waitFor()

    const lfsSection = page.getByRole('region', { name: 'Git LFS' })
    await lfsSection.getByText('Git LFS 3.5.0 is available.').waitFor()
    await lfsSection
      .getByRole('button', { name: 'Install repository filters' })
      .click()
    const lfsConfirmation = page.getByRole('alertdialog')
    await lfsConfirmation
      .getByRole('button', { name: 'Install for repository' })
      .click()
    await lfsSection
      .getByRole('button', { name: 'Install global filters' })
      .click()
    const globalLfsConfirmation = page.getByRole('alertdialog')
    await globalLfsConfirmation
      .getByRole('button', { name: 'Install globally' })
      .click()
    await lfsSection
      .getByRole('button', { name: 'Repair repository hooks' })
      .click()
    const repairLfsConfirmation = page.getByRole('alertdialog')
    await repairLfsConfirmation
      .getByRole('button', { name: 'Repair hooks' })
      .click()
    await lfsSection.getByRole('button', { name: 'LFS fetch' }).click()
    await lfsSection
      .getByText('LFS fetch completed.', { exact: false })
      .waitFor()
    assert.deepEqual(lfsCalls, [
      { action: 'install', scope: 'local' },
      { action: 'install', scope: 'global' },
      { action: 'repair' },
    ])
    await lfsSection.getByRole('button', { name: 'LFS pull' }).click()
    await lfsSection
      .getByText('LFS pull running. 25%', { exact: false })
      .waitFor()
    await lfsSection
      .getByRole('button', { name: 'Cancel LFS transfer' })
      .click()
    await lfsSection
      .getByText('LFS pull cancelled.', { exact: false })
      .waitFor()

    fs.renameSync(repository, relocatedRepository)
    await tools.getByRole('button', { name: 'Refresh repository' }).click()
    await page.getByRole('button', { name: 'Relocate repository' }).waitFor()
    await page.getByRole('button', { name: 'Relocate repository' }).click()
    const relocationDialog = page
      .getByRole('dialog')
      .filter({ hasText: 'Relocate repository' })
    await relocationDialog
      .getByRole('button', { name: 'Choose folder' })
      .click()
    await page.waitForFunction(expected => {
      const input = document.querySelector('#repository-path')
      return input instanceof HTMLInputElement && input.value === expected
    }, relocatedRepository)
    await relocationDialog
      .getByRole('button', { name: 'Relocate repository' })
      .click()
    await page.getByRole('tab', { name: 'Tools' }).waitFor()
    await page.waitForFunction(
      expected => document.body.textContent?.includes(expected),
      relocatedRepository
    )

    await tools.getByRole('button', { name: 'Create worktree' }).click()
    const worktreeDialog = page
      .getByRole('dialog')
      .filter({ hasText: 'Create a linked worktree' })
    await worktreeDialog.getByRole('button', { name: 'Choose folder' }).click()
    await page.waitForFunction(expected => {
      const input = document.querySelector('#web-worktree-path')
      return input instanceof HTMLInputElement && input.value === expected
    }, worktree)
    assert.equal(
      await worktreeDialog.getByLabel('Worktree path').inputValue(),
      worktree
    )
    await worktreeDialog.getByLabel('New branch').fill('picker-worktree')
    await worktreeDialog
      .getByRole('button', { name: 'Create worktree' })
      .click()
    for (let attempt = 0; attempt < 50 && !fs.existsSync(worktree); attempt++)
      await new Promise(resolve => setTimeout(resolve, 100))
    assert.ok(
      fs.existsSync(worktree),
      'worktree picker did not create a worktree'
    )
    assert.deepEqual(
      await page.evaluate(
        () => window.__desktopPlusSecurityPolicyViolations || []
      ),
      []
    )
    assert.deepEqual(pageErrors, [])

    console.log(
      'Source platform controls passed: application menu, shortcuts, folder pickers, integrations, verified updates, and Git LFS'
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
