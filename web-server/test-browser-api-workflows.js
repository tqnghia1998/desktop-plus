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
    path.join(os.tmpdir(), 'desktop-plus-browser-flows-')
  )
  const source = path.join(root, 'source')
  const remote = path.join(root, 'remote.git')
  const branchFlow = path.join(root, 'branch-flow')
  const stashConflictFlow = path.join(root, 'stash-conflict-flow')
  const rewriteFlow = path.join(root, 'rewrite-flow')
  const worktreeFlow = path.join(root, 'worktree-flow')
  const linkedWorktree = path.join(root, 'linked-worktree')
  const movedLinkedWorktree = path.join(root, 'moved-linked-worktree')
  const dialogWorktree = path.join(root, 'dialog-worktree')
  const pullRebaseRemote = path.join(root, 'pull-rebase.git')
  const pullRebaseLocal = path.join(root, 'pull-rebase-local')
  const pullRebaseWriter = path.join(root, 'pull-rebase-writer')
  const pullMergeRemote = path.join(root, 'pull-merge.git')
  const pullMergeLocal = path.join(root, 'pull-merge-local')
  const pullMergeWriter = path.join(root, 'pull-merge-writer')
  const cherryPickFlow = path.join(root, 'cherry-pick-flow')
  const lfsFlow = path.join(root, 'lfs-flow')
  const submoduleSource = path.join(root, 'submodule-source')
  const submoduleFlow = path.join(root, 'submodule-flow')
  fs.mkdirSync(source)
  git(source, 'init', '-b', 'main')
  git(source, 'config', 'user.name', 'Browser Test')
  git(source, 'config', 'user.email', 'browser@example.com')
  fs.writeFileSync(path.join(source, 'file.txt'), 'base\n')
  git(source, 'add', '.')
  git(source, 'commit', '-m', 'base')
  git(root, 'init', '--bare', remote)
  git(source, 'remote', 'add', 'origin', remote)
  git(source, 'push', '-u', 'origin', 'main')
  fs.writeFileSync(path.join(source, 'file.txt'), 'base\nstashed\n')
  fs.mkdirSync(branchFlow)
  git(branchFlow, 'init', '-b', 'main')
  git(branchFlow, 'config', 'user.name', 'Branch Flow Test')
  git(branchFlow, 'config', 'user.email', 'branch-flow@example.com')
  fs.writeFileSync(path.join(branchFlow, 'shared.txt'), 'one\ntwo\nthree\n')
  git(branchFlow, 'add', 'shared.txt')
  git(branchFlow, 'commit', '-m', 'base')
  git(branchFlow, 'checkout', '-b', 'feature')
  fs.writeFileSync(path.join(branchFlow, 'shared.txt'), 'feature\ntwo\nthree\n')
  git(branchFlow, 'add', 'shared.txt')
  git(branchFlow, 'commit', '-m', 'feature')
  git(branchFlow, 'checkout', 'main')
  fs.mkdirSync(stashConflictFlow)
  git(stashConflictFlow, 'init', '-b', 'main')
  git(stashConflictFlow, 'config', 'user.name', 'Stash Conflict Flow Test')
  git(
    stashConflictFlow,
    'config',
    'user.email',
    'stash-conflict-flow@example.com'
  )
  fs.writeFileSync(path.join(stashConflictFlow, 'shared.txt'), 'base\n')
  git(stashConflictFlow, 'add', 'shared.txt')
  git(stashConflictFlow, 'commit', '-m', 'base')
  fs.writeFileSync(path.join(stashConflictFlow, 'shared.txt'), 'stash\n')
  git(stashConflictFlow, 'stash', 'push', '-m', 'stash conflict')
  fs.writeFileSync(path.join(stashConflictFlow, 'shared.txt'), 'committed\n')
  git(stashConflictFlow, 'add', 'shared.txt')
  git(stashConflictFlow, 'commit', '-m', 'conflicting change')
  fs.mkdirSync(rewriteFlow)
  git(rewriteFlow, 'init', '-b', 'main')
  git(rewriteFlow, 'config', 'user.name', 'Rewrite Flow Test')
  git(rewriteFlow, 'config', 'user.email', 'rewrite-flow@example.com')
  for (const name of ['root-one', 'root-two', 'root-three']) {
    fs.writeFileSync(path.join(rewriteFlow, `${name}.txt`), `${name}\n`)
    git(rewriteFlow, 'add', `${name}.txt`)
    git(rewriteFlow, 'commit', '-m', name)
  }
  fs.mkdirSync(worktreeFlow)
  git(worktreeFlow, 'init', '-b', 'main')
  git(worktreeFlow, 'config', 'user.name', 'Worktree Flow Test')
  git(worktreeFlow, 'config', 'user.email', 'worktree-flow@example.com')
  fs.writeFileSync(path.join(worktreeFlow, 'worktree.txt'), 'base\n')
  git(worktreeFlow, 'add', 'worktree.txt')
  git(worktreeFlow, 'commit', '-m', 'base')
  fs.writeFileSync(path.join(worktreeFlow, '.gitignore'), 'local/*.json\n')
  fs.mkdirSync(path.join(worktreeFlow, 'local'))
  fs.writeFileSync(
    path.join(worktreeFlow, 'local', 'settings.json'),
    '{"from":"worktree dialog"}\n'
  )
  fs.writeFileSync(path.join(worktreeFlow, '.worktreeinclude'), 'local/**\n')
  git(root, 'init', '--bare', pullRebaseRemote)
  fs.mkdirSync(pullRebaseLocal)
  git(pullRebaseLocal, 'init', '-b', 'main')
  git(pullRebaseLocal, 'config', 'user.name', 'Pull Rebase Local')
  git(pullRebaseLocal, 'config', 'user.email', 'pull-rebase-local@example.com')
  git(pullRebaseLocal, 'remote', 'add', 'origin', pullRebaseRemote)
  fs.writeFileSync(path.join(pullRebaseLocal, 'shared.txt'), 'base\n')
  git(pullRebaseLocal, 'add', 'shared.txt')
  git(pullRebaseLocal, 'commit', '-m', 'base')
  git(pullRebaseLocal, 'push', '-u', 'origin', 'main')
  git(
    root,
    '--git-dir',
    pullRebaseRemote,
    'symbolic-ref',
    'HEAD',
    'refs/heads/main'
  )
  git(root, 'clone', pullRebaseRemote, pullRebaseWriter)
  git(pullRebaseWriter, 'config', 'user.name', 'Pull Rebase Writer')
  git(
    pullRebaseWriter,
    'config',
    'user.email',
    'pull-rebase-writer@example.com'
  )
  fs.writeFileSync(path.join(pullRebaseLocal, 'shared.txt'), 'local\n')
  git(pullRebaseLocal, 'add', 'shared.txt')
  git(pullRebaseLocal, 'commit', '-m', 'local change')
  git(pullRebaseLocal, 'config', 'pull.rebase', 'true')
  fs.writeFileSync(path.join(pullRebaseWriter, 'shared.txt'), 'remote\n')
  git(pullRebaseWriter, 'add', 'shared.txt')
  git(pullRebaseWriter, 'commit', '-m', 'remote change')
  git(pullRebaseWriter, 'push', 'origin', 'main')
  git(root, 'init', '--bare', pullMergeRemote)
  fs.mkdirSync(pullMergeLocal)
  git(pullMergeLocal, 'init', '-b', 'main')
  git(pullMergeLocal, 'config', 'user.name', 'Pull Merge Local')
  git(pullMergeLocal, 'config', 'user.email', 'pull-merge-local@example.com')
  git(pullMergeLocal, 'remote', 'add', 'origin', pullMergeRemote)
  fs.writeFileSync(path.join(pullMergeLocal, 'shared.txt'), 'base\n')
  git(pullMergeLocal, 'add', 'shared.txt')
  git(pullMergeLocal, 'commit', '-m', 'base')
  git(pullMergeLocal, 'push', '-u', 'origin', 'main')
  git(
    root,
    '--git-dir',
    pullMergeRemote,
    'symbolic-ref',
    'HEAD',
    'refs/heads/main'
  )
  git(root, 'clone', pullMergeRemote, pullMergeWriter)
  git(pullMergeWriter, 'config', 'user.name', 'Pull Merge Writer')
  git(pullMergeWriter, 'config', 'user.email', 'pull-merge-writer@example.com')
  fs.writeFileSync(path.join(pullMergeLocal, 'shared.txt'), 'local\n')
  git(pullMergeLocal, 'add', 'shared.txt')
  git(pullMergeLocal, 'commit', '-m', 'local change')
  git(pullMergeLocal, 'config', 'pull.rebase', 'false')
  fs.writeFileSync(path.join(pullMergeWriter, 'shared.txt'), 'remote\n')
  git(pullMergeWriter, 'add', 'shared.txt')
  git(pullMergeWriter, 'commit', '-m', 'remote change')
  git(pullMergeWriter, 'push', 'origin', 'main')
  fs.mkdirSync(cherryPickFlow)
  git(cherryPickFlow, 'init', '-b', 'main')
  git(cherryPickFlow, 'config', 'user.name', 'Cherry-pick Flow Test')
  git(cherryPickFlow, 'config', 'user.email', 'cherry-pick-flow@example.com')
  fs.writeFileSync(path.join(cherryPickFlow, 'shared.txt'), 'base\n')
  git(cherryPickFlow, 'add', 'shared.txt')
  git(cherryPickFlow, 'commit', '-m', 'base')
  git(cherryPickFlow, 'checkout', '-b', 'source')
  fs.writeFileSync(path.join(cherryPickFlow, 'shared.txt'), 'source\n')
  git(cherryPickFlow, 'add', 'shared.txt')
  git(cherryPickFlow, 'commit', '-m', 'source change')
  git(cherryPickFlow, 'checkout', 'main')
  fs.writeFileSync(path.join(cherryPickFlow, 'shared.txt'), 'target\n')
  git(cherryPickFlow, 'add', 'shared.txt')
  git(cherryPickFlow, 'commit', '-m', 'target change')
  git(cherryPickFlow, 'checkout', 'source')
  fs.mkdirSync(lfsFlow)
  git(lfsFlow, 'init', '-b', 'main')
  git(lfsFlow, 'config', 'user.name', 'LFS Flow Test')
  git(lfsFlow, 'config', 'user.email', 'lfs-flow@example.com')
  fs.writeFileSync(path.join(lfsFlow, '.gitattributes'), '*.bin filter=lfs\n')
  fs.writeFileSync(path.join(lfsFlow, 'tracked.txt'), 'base\n')
  git(lfsFlow, 'add', '.')
  git(lfsFlow, 'commit', '-m', 'base')
  fs.mkdirSync(submoduleSource)
  git(submoduleSource, 'init', '-b', 'main')
  git(submoduleSource, 'config', 'user.name', 'Submodule Source')
  git(submoduleSource, 'config', 'user.email', 'submodule-source@example.com')
  fs.writeFileSync(path.join(submoduleSource, 'module.txt'), 'base\n')
  git(submoduleSource, 'add', 'module.txt')
  git(submoduleSource, 'commit', '-m', 'base')
  fs.mkdirSync(submoduleFlow)
  git(submoduleFlow, 'init', '-b', 'main')
  git(submoduleFlow, 'config', 'user.name', 'Submodule Parent')
  git(submoduleFlow, 'config', 'user.email', 'submodule-parent@example.com')
  git(submoduleFlow, 'config', 'protocol.file.allow', 'always')
  git(
    submoduleFlow,
    '-c',
    'protocol.file.allow=always',
    'submodule',
    'add',
    submoduleSource,
    'vendor/module'
  )
  git(submoduleFlow, 'commit', '-m', 'add submodule')
  fs.writeFileSync(
    path.join(submoduleFlow, 'vendor', 'module', 'module.txt'),
    'dirty\n'
  )

  const credentials = new Map()
  const hostingCalls = []
  const presetRuns = []
  const lfsRequests = []
  const server = createServer({
    keytar: {
      getPassword: async (service, account) =>
        credentials.get(`${service}:${account}`) || null,
      setPassword: async (service, account, password) =>
        credentials.set(`${service}:${account}`, password),
      deletePassword: async (service, account) =>
        credentials.delete(`${service}:${account}`),
    },
    runIntegrationForOutput: async options => {
      presetRuns.push(options)
      return 'feature Feature branch\nfix Fix branch\n'
    },
    hostingRequest: async (endpoint, token, method, pathname, body) => {
      hostingCalls.push({ endpoint, token, method, pathname, body })
      if (pathname === 'user') return { login: 'web-user', id: 7 }
      if (method === 'GET') return [{ number: 1, title: 'Mock PR' }]
      return {
        number: 2,
        html_url: 'https://example.test/pr/2',
        clone_url: remote,
        name: body?.name,
      }
    },
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  const browser = await launchBrowser()
  try {
    const page = await browser.newPage()
    const browserDialogs = []
    page.on('dialog', async dialog => {
      browserDialogs.push({
        type: dialog.type(),
        message: dialog.message(),
      })
      await dialog.dismiss()
    })
    await page.goto(base)
    await page.waitForFunction(
      () =>
        typeof window.__desktopPlusDispatcher?.addRepositories === 'function' &&
        typeof window.__desktopPlusState === 'function'
    )
    await page.route('**/api/lfs**', async route => {
      const request = route.request()
      const url = new URL(request.url())
      if (request.method() === 'GET') {
        const isLfsFixture = url.searchParams.get('path') === lfsFlow
        return route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            available: true,
            version: '3.6.1',
            filtersConfigured: true,
            hooksInstalled: !isLfsFixture,
            trackedPatterns: isLfsFixture ? ['*.bin'] : [],
            mismatches: isLfsFixture ? [{ kind: 'pre-push-hook-missing' }] : [],
          }),
        })
      }
      const body = request.postDataJSON()
      lfsRequests.push(body)
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          status: {
            available: true,
            version: '3.6.1',
            filtersConfigured: true,
            hooksInstalled: true,
            trackedPatterns: ['*.bin'],
            mismatches: [],
          },
        }),
      })
    })
    const paths = {
      source,
      clone: path.join(root, 'clone'),
      initialized: path.join(root, 'initialized'),
      worktree: path.join(root, 'worktree'),
      remote,
      branchFlow,
      stashConflictFlow,
      rewriteFlow,
      worktreeFlow,
      linkedWorktree,
      movedLinkedWorktree,
      dialogWorktree,
      pullRebaseLocal,
      pullMergeLocal,
      cherryPickFlow,
      lfsFlow,
      submoduleFlow,
    }
    const results = await page.evaluate(async paths => {
      const post = async (url, body) => {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data = await response.json()
        if (!response.ok)
          throw new Error(`${body.operation || url}: ${data.error}`)
        return data
      }
      const op = (path, operation, values = [], extra = {}) =>
        post('/api/git/operation', { path, operation, values, ...extra })
      await op(paths.clone, 'clone', [], { url: paths.source })
      await op(paths.initialized, 'init', [], { initialBranch: 'main' })
      await op(paths.source, 'stash', ['file.txt'], {
        message: 'selected-file',
      })
      await op(paths.source, 'stash-apply')
      await op(paths.source, 'worktree-add', [paths.worktree], {})
      await op(paths.source, 'worktree-remove', [paths.worktree])
      await op(paths.source, 'push', [], { force: true })
      const auth = await post('/api/hosting/auth', {
        endpoint: 'https://api.example.test',
        token: 'mock-token',
      })
      const prs = await post('/api/hosting/pull-requests', {
        endpoint: 'https://api.example.test',
        login: auth.user.login,
        credentialId: auth.credentialId,
        action: 'list',
        owner: 'web-user',
        repository: 'source',
      })
      const created = await post('/api/hosting/pull-requests', {
        endpoint: 'https://api.example.test',
        login: auth.user.login,
        credentialId: auth.credentialId,
        action: 'create',
        owner: 'web-user',
        repository: 'source',
        title: 'Browser PR',
        head: 'main',
        base: 'main',
      })
      return { auth, prs, created }
    }, paths)
    assert.equal(git(paths.clone, 'log', '-1', '--format=%s'), 'base')
    assert.equal(git(paths.initialized, 'branch', '--show-current'), 'main')
    assert.equal(fs.existsSync(paths.worktree), false)
    assert.match(git(source, 'stash', 'list'), /selected-file/)
    assert.equal(results.auth.user.login, 'web-user')
    assert.equal(results.prs.pullRequests[0].number, 1)
    assert.equal(results.created.pullRequest.number, 2)
    assert.ok(hostingCalls.every(call => call.token === 'mock-token'))

    fs.writeFileSync(
      path.join(branchFlow, 'shared.txt'),
      'one\ntwo\nstash this change\n'
    )
    await page.evaluate(async paths => {
      const dispatcher = window.__desktopPlusDispatcher
      const [repo] = await dispatcher.addRepositories([paths.branchFlow])
      const branch = name =>
        window
          .__desktopPlusState()
          .selectedState.state.branchesState.allBranches.find(
            candidate => candidate.name === name
          )
      window.confirm = () => true
      await dispatcher.setUncommittedChangesStrategySetting(
        'StashOnCurrentBranch'
      )
      await dispatcher.checkoutBranch(repo, branch('feature'))
    }, paths)
    assert.equal(git(branchFlow, 'branch', '--show-current'), 'feature')
    assert.match(git(branchFlow, 'stash', 'list'), /!!GitHub_Desktop<main>/)

    await page.evaluate(async paths => {
      const dispatcher = window.__desktopPlusDispatcher
      const [repo] = await dispatcher.addRepositories([paths.stashConflictFlow])
      await dispatcher.popStash(repo, { name: 'stash@{0}' })
      const state = window.__desktopPlusState().selectedState.state
      const file = state.changesState.workingDirectory.files.find(
        candidate => candidate.path === 'shared.txt'
      )
      if (file?.status?.kind !== 'Conflicted')
        throw new Error(
          'Stash conflict did not remain in the native Changes resolver'
        )
      if (state.multiCommitOperationState !== null)
        throw new Error('Stash conflict incorrectly opened a merge operation')
    }, paths)
    await page.getByText('shared.txt', { exact: true }).last().waitFor()
    await page.evaluate(async paths => {
      const dispatcher = window.__desktopPlusDispatcher
      const repo = window
        .__desktopPlusState()
        .repositories.find(repository => repository.path === paths.branchFlow)
      await dispatcher.selectRepository(repo)
      await dispatcher.refreshRepository(repo)
    }, paths)

    await page.evaluate(() => {
      const dispatcher = window.__desktopPlusDispatcher
      const state = window.__desktopPlusState().selectedState.state
      const commit = state.commitLookup.get(
        state.compareState.allHistoryCommitSHAs[0]
      )
      if (!commit) throw new Error('A loaded commit is required for drag state')
      const dragElement = {
        type: 'commit',
        commit,
        selectedCommits: [commit],
        gitHubRepository: null,
      }
      dispatcher.setDragElement(dragElement)
      if (window.__desktopPlusState().currentDragElement !== dragElement)
        throw new Error('Commit drag state was not stored for the Desktop UI')
      dispatcher.clearDragElement()
      if (window.__desktopPlusState().currentDragElement !== null)
        throw new Error('Commit drag state was not cleared for the Desktop UI')
    })

    git(branchFlow, 'checkout', 'main')
    fs.writeFileSync(
      path.join(branchFlow, 'shared.txt'),
      'one\ntwo\nlocal changes\n'
    )
    await page.evaluate(async paths => {
      const dispatcher = window.__desktopPlusDispatcher
      const repo = window
        .__desktopPlusState()
        .repositories.find(repository => repository.path === paths.branchFlow)
      await dispatcher.refreshRepository(repo)
      const branch = window
        .__desktopPlusState()
        .selectedState.state.branchesState.allBranches.find(
          candidate => candidate.name === 'feature'
        )
      await dispatcher.setUncommittedChangesStrategySetting('MoveToNewBranch')
      await dispatcher.checkoutBranch(repo, branch)
    }, paths)
    assert.equal(git(branchFlow, 'branch', '--show-current'), 'feature')
    assert.equal(
      fs.readFileSync(path.join(branchFlow, 'shared.txt'), 'utf8'),
      'feature\ntwo\nlocal changes\n'
    )
    git(branchFlow, 'reset', '--hard')

    await page.evaluate(async paths => {
      const dispatcher = window.__desktopPlusDispatcher
      const repo = window
        .__desktopPlusState()
        .repositories.find(repository => repository.path === paths.branchFlow)
      await dispatcher.selectRepository(repo)
      await dispatcher.refreshRepository(repo)
      const branch = window
        .__desktopPlusState()
        .selectedState.state.branchesState.allBranches.find(
          candidate => candidate.name === 'feature'
        )
      await dispatcher.deleteLocalBranch(repo, branch)
    }, paths)
    assert.equal(git(branchFlow, 'branch', '--show-current'), 'main')
    assert.doesNotMatch(git(branchFlow, 'branch', '--list'), /feature/)

    await page.evaluate(async paths => {
      const dispatcher = window.__desktopPlusDispatcher
      const [repo] = await dispatcher.addRepositories([paths.rewriteFlow])
      await dispatcher.changeRepositorySection(repo, 1)
    }, paths)

    const commitList = page.getByLabel('Commits')
    const rootOne = commitList.getByText('root-one', { exact: true })
    await rootOne.waitFor()
    const rootOneRow = commitList
      .locator('.draggable')
      .filter({ hasText: 'root-one' })
      .first()
    const rootOneBox = await rootOneRow.boundingBox()
    if (!rootOneBox)
      throw new Error(
        'Could not locate the Desktop history row for drag reorder'
      )
    const dragStart = {
      x: rootOneBox.x + rootOneBox.width / 2,
      y: rootOneBox.y + rootOneBox.height / 2,
    }
    await page.mouse.move(dragStart.x, dragStart.y)
    await page.mouse.down()
    await page.waitForTimeout(120)
    await page.mouse.move(dragStart.x, dragStart.y - 12, { steps: 3 })
    await page.waitForFunction(
      () => window.__desktopPlusState().currentDragElement?.type === 0
    )
    const topInsertionPoint = page.locator('.list-insertion-point.top').first()
    await topInsertionPoint.waitFor()
    const topInsertionBox = await topInsertionPoint.boundingBox()
    if (!topInsertionBox)
      throw new Error('Could not locate a Desktop history insertion target')
    await page.mouse.move(
      topInsertionBox.x + topInsertionBox.width / 2,
      topInsertionBox.y + topInsertionBox.height / 2,
      { steps: 5 }
    )
    await page.waitForSelector('.list-item-insertion-indicator.top')
    await page.mouse.up()
    try {
      await page.waitForFunction(
        () => {
          const state = window.__desktopPlusState().selectedState?.state
          return (
            state?.historyRewriteUndo !== null &&
            state?.historyRewriteUndo !== undefined
          )
        },
        null,
        { timeout: 5_000 }
      )
    } catch {
      const state = await page.evaluate(() => {
        const selected = window.__desktopPlusState().selectedState?.state
        return {
          historyRewriteUndo: selected?.historyRewriteUndo,
          operationDetail: selected?.multiCommitOperationDetail,
          operationState: selected?.multiCommitOperationState,
          popup: window.__desktopPlusState().currentPopup?.type,
          banner: window.__desktopPlusState().currentBanner?.type,
        }
      })
      throw new Error(
        `Desktop history drag did not complete: ${JSON.stringify(state)}`
      )
    }
    const rewriteUndo = await page.evaluate(() => {
      const state = window.__desktopPlusState().selectedState.state
      return {
        undoSha: state.historyRewriteUndo?.undoSha,
        tip: state.branchesState.tip.branch?.tip.sha,
      }
    })
    if (!rewriteUndo.undoSha || rewriteUndo.undoSha === rewriteUndo.tip)
      throw new Error(
        'A drag reorder did not preserve the Desktop history-rewrite undo state'
      )
    assert.equal(
      git(rewriteFlow, 'log', '--reverse', '--format=%s'),
      'root-two\nroot-three\nroot-one'
    )
    await page.evaluate(async () => {
      const banner = window.__desktopPlusState().currentBanner
      if (banner?.type !== 'SuccessfulReorder' || !banner.onUndo)
        throw new Error('Desktop reorder did not expose its native undo action')
      window.confirm = () => {
        throw new Error(
          'History rewrite undo must use the Desktop banner action'
        )
      }
      await banner.onUndo()
    })
    await page.waitForFunction(
      () =>
        window.__desktopPlusState().selectedState?.state?.historyRewriteUndo ===
        null
    )
    assert.equal(
      git(rewriteFlow, 'log', '--reverse', '--format=%s'),
      'root-one\nroot-two\nroot-three'
    )

    await page.evaluate(async paths => {
      const post = body =>
        fetch('/api/git/operation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: paths.worktreeFlow, ...body }),
        }).then(async response => {
          if (!response.ok) throw new Error((await response.json()).error)
        })
      await post({
        operation: 'worktree-add',
        values: [paths.linkedWorktree],
        createBranch: 'linked',
      })
      const dispatcher = window.__desktopPlusDispatcher
      const [repo] = await dispatcher.addRepositories([paths.worktreeFlow])
      window.confirm = () => true
      await dispatcher.refreshRepository(repo)
      const linked = window
        .__desktopPlusState()
        .selectedState.state.worktrees.find(
          worktree => worktree.path === paths.linkedWorktree
        )
      await dispatcher.switchWorktree(repo, linked)
      const linkedRepository = window.__desktopPlusState().selectedRepository
      const moved = await dispatcher.moveWorktree(
        linkedRepository,
        paths.linkedWorktree,
        paths.movedLinkedWorktree
      )
      if (!moved)
        throw new Error('Moving a linked worktree did not report success')
      const afterMove = window.__desktopPlusState()
      if (afterMove.selectedRepository.path !== paths.movedLinkedWorktree)
        throw new Error('Moving a selected worktree did not update selection')
      if (
        afterMove.repositories.some(
          repository => repository.path === paths.linkedWorktree
        )
      )
        throw new Error('Moving a worktree left its old repository path saved')
      await dispatcher.deleteWorktree(
        afterMove.selectedRepository,
        paths.movedLinkedWorktree,
        true
      )
      if (
        window
          .__desktopPlusState()
          .repositories.some(
            repository => repository.path === paths.movedLinkedWorktree
          )
      )
        throw new Error('Deleting a worktree left its repository path saved')
    }, paths)
    assert.equal(fs.existsSync(linkedWorktree), false)
    assert.equal(fs.existsSync(movedLinkedWorktree), false)
    assert.equal(
      await page.evaluate(
        () => window.__desktopPlusState().selectedRepository.path
      ),
      worktreeFlow
    )

    await page.evaluate(async paths => {
      const dispatcher = window.__desktopPlusDispatcher
      const repo = window
        .__desktopPlusState()
        .repositories.find(repository => repository.path === paths.worktreeFlow)
      await dispatcher.selectRepository(repo)
      await dispatcher.refreshRepository(repo)
      dispatcher.showPopup({
        type: 'AddWorktree',
        repository: repo,
        initialBranchName: 'dialog-worktree-branch',
        initialWorktreeName: 'dialog-worktree',
      })
    }, paths)
    await page.waitForSelector('#add-worktree')
    const dialogInputs = await page
      .locator('#add-worktree input')
      .evaluateAll(inputs =>
        inputs.map(input => ({
          id: input.id,
          name: input.name,
          value: input.value,
          placeholder: input.placeholder,
          type: input.type,
        }))
      )
    const worktreePathInput = dialogInputs.find(
      input =>
        input.placeholder === 'worktree path' ||
        input.name === 'path' ||
        input.id.includes('path')
    )
    if (!worktreePathInput?.id)
      throw new Error(
        `Could not find the Desktop Add Worktree path input: ${JSON.stringify(
          dialogInputs
        )}`
      )
    await page.locator(`#${worktreePathInput.id}`).fill(root)
    const createWorktreeButton = page.getByRole('button', {
      name: 'Create Worktree',
      exact: true,
    })
    if (await createWorktreeButton.isDisabled())
      throw new Error(
        `Desktop Add Worktree dialog stayed disabled: ${JSON.stringify(
          await page.locator('#add-worktree input').evaluateAll(inputs =>
            inputs.map(input => ({
              placeholder: input.placeholder,
              value: input.value,
            }))
          )
        )}`
      )
    await createWorktreeButton.click()
    await page.waitForFunction(
      worktreePath =>
        !document.querySelector('#add-worktree') &&
        window.__desktopPlusState().selectedRepository.path === worktreePath,
      dialogWorktree
    )
    assert.equal(
      git(dialogWorktree, 'branch', '--show-current'),
      'dialog-worktree-branch'
    )
    assert.equal(
      fs.readFileSync(
        path.join(dialogWorktree, 'local', 'settings.json'),
        'utf8'
      ),
      '{"from":"worktree dialog"}\n'
    )
    fs.writeFileSync(
      path.join(dialogWorktree, 'worktree.txt'),
      'dirty worktree\n'
    )
    await page.evaluate(async paths => {
      const dispatcher = window.__desktopPlusDispatcher
      const repo = window.__desktopPlusState().selectedRepository
      window.confirm = () => {
        throw new Error('Worktree deletion must use the Desktop dialog')
      }
      dispatcher.requestDeleteWorktree(repo, paths.dialogWorktree)
    }, paths)
    const deleteWorktreeDialog = page.locator('#delete-worktree')
    await deleteWorktreeDialog.waitFor()
    await deleteWorktreeDialog
      .getByRole('button', { name: 'Delete', exact: true })
      .click()
    const deleteWorktreeFailedDialog = page.locator('#delete-worktree-failed')
    await deleteWorktreeFailedDialog.waitFor()
    await deleteWorktreeFailedDialog
      .getByRole('button', { name: 'Forcefully delete', exact: true })
      .click()
    await deleteWorktreeFailedDialog.waitFor({ state: 'hidden' })
    assert.equal(fs.existsSync(dialogWorktree), false)
    assert.deepEqual(
      browserDialogs,
      [],
      'Worktree deletion must not open a browser confirmation dialog'
    )

    await page.evaluate(async paths => {
      const dispatcher = window.__desktopPlusDispatcher
      const [repo] = await dispatcher.addRepositories([paths.pullRebaseLocal])
      await dispatcher.pull(repo)
      const state = window.__desktopPlusState().selectedState.state
      if (state.changesState.conflictState?.kind !== 'rebase')
        throw new Error(
          'Pull rebase conflict did not enter the Desktop rebase flow'
        )
      if (state.multiCommitOperationState?.step?.kind !== 'ShowConflicts')
        throw new Error(
          'Pull rebase conflict did not show the Desktop conflict dialog'
        )
      if (state.branchesState.pullWithRebase !== true)
        throw new Error(
          'Pull rebase configuration did not reach the Desktop state'
        )
    }, paths)
    await page.waitForFunction(() =>
      window
        .__desktopPlusState()
        .selectedState?.state?.changesState?.workingDirectory?.files?.some(
          file => file.status?.kind === 'Conflicted'
        )
    )
    const rebaseConflicts = page.locator('#conflicts-dialog')
    await rebaseConflicts.waitFor()
    const rebaseResolutionButton = rebaseConflicts.getByRole('button', {
      name: 'File resolution options',
    })
    await rebaseResolutionButton.waitFor()
    await rebaseResolutionButton.click()
    const rebaseResolutionMenu = page.locator('#web-context-menu')
    await rebaseResolutionMenu.waitFor()
    await rebaseResolutionMenu
      .getByRole('menuitem', { name: /^Use the modified file/i })
      .first()
      .click()
    await rebaseResolutionMenu.waitFor({ state: 'hidden' })
    await rebaseConflicts.locator('.unmerged-file-status-resolved').waitFor()
    await rebaseConflicts
      .getByRole('button', { name: /^Abort rebase$/i })
      .click()
    const abortWarning = page.locator('#abort-warning')
    await abortWarning.waitFor()
    await page.waitForTimeout(300)
    await abortWarning.getByRole('button', { name: 'Cancel' }).click()
    await abortWarning.waitFor({ state: 'hidden' })
    await rebaseConflicts.waitFor()
    await rebaseConflicts
      .getByRole('button', { name: /^Abort rebase$/i })
      .click()
    await abortWarning.waitFor()
    await abortWarning.getByRole('button', { name: /^Abort rebase$/i }).click()
    await abortWarning.waitFor({ state: 'hidden' })
    await rebaseConflicts.waitFor({ state: 'hidden' })
    await page.waitForFunction(async repoPath => {
      const response = await fetch(
        `/api/status?path=${encodeURIComponent(repoPath)}`
      )
      const status = await response.json()
      return status.operation !== 'rebase'
    }, pullRebaseLocal)
    assert.equal(
      fs.existsSync(path.join(pullRebaseLocal, '.git', 'rebase-merge')),
      false
    )

    await page.evaluate(async paths => {
      const dispatcher = window.__desktopPlusDispatcher
      const [repo] = await dispatcher.addRepositories([paths.pullMergeLocal])
      await dispatcher.pull(repo)
      const state = window.__desktopPlusState().selectedState.state
      if (state.changesState.conflictState?.kind !== 'merge')
        throw new Error(
          'Pull merge conflict did not enter the Desktop merge flow'
        )
      if (state.multiCommitOperationState?.step?.kind !== 'ShowConflicts')
        throw new Error(
          'Pull merge conflict did not show the Desktop conflict dialog'
        )
      if (state.branchesState.pullWithRebase !== false)
        throw new Error(
          'Pull merge configuration did not reach the Desktop state'
        )
    }, paths)
    await page.waitForFunction(() =>
      window
        .__desktopPlusState()
        .selectedState?.state?.changesState?.workingDirectory?.files?.some(
          file => file.status?.kind === 'Conflicted'
        )
    )
    const mergeConflicts = page.locator('#conflicts-dialog')
    await mergeConflicts.waitFor()
    const mergeResolutionButton = mergeConflicts.getByRole('button', {
      name: 'File resolution options',
    })
    await mergeResolutionButton.waitFor()
    await mergeResolutionButton.click()
    const mergeResolutionMenu = page.locator('#web-context-menu')
    await mergeResolutionMenu.waitFor()
    await mergeResolutionMenu
      .getByRole('menuitem', { name: /^Use the modified file/i })
      .first()
      .click()
    await mergeResolutionMenu.waitFor({ state: 'hidden' })
    await mergeConflicts
      .getByRole('button', { name: /^Continue merge$/i })
      .click()
    await mergeConflicts.waitFor({ state: 'hidden' })
    assert.equal(
      fs.existsSync(path.join(pullMergeLocal, '.git', 'MERGE_HEAD')),
      false
    )
    assert.equal(git(pullMergeLocal, 'status', '--porcelain'), '')
    assert.match(
      git(pullMergeLocal, 'log', '-1', '--format=%s'),
      /^Merge branch/
    )

    await page.evaluate(async paths => {
      const dispatcher = window.__desktopPlusDispatcher
      const [repo] = await dispatcher.addRepositories([paths.cherryPickFlow])
      const state = window.__desktopPlusState().selectedState.state
      const target = state.branchesState.allBranches.find(
        branch => branch.name === 'main'
      )
      const commit = state.commitLookup.get(
        state.compareState.allHistoryCommitSHAs[0]
      )
      if (!target || !commit)
        throw new Error(
          'Cherry-pick test did not load its target branch and source commit'
        )
      await dispatcher.cherryPick(repo, target, [commit])
      const conflict = window.__desktopPlusState().selectedState.state
      if (
        conflict.changesState.conflictState?.kind !== 'cherryPick' ||
        conflict.multiCommitOperationState?.step?.kind !== 'ShowConflicts'
      )
        throw new Error(
          'Cherry-pick conflict did not enter the Desktop conflict dialog'
        )
    }, paths)
    await page.waitForFunction(() =>
      window
        .__desktopPlusState()
        .selectedState?.state?.changesState?.workingDirectory?.files?.some(
          file => file.status?.kind === 'Conflicted'
        )
    )
    const cherryPickConflicts = page.locator('#conflicts-dialog')
    await cherryPickConflicts.waitFor()
    const cherryPickResolutionButton = cherryPickConflicts.getByRole('button', {
      name: 'File resolution options',
    })
    await cherryPickResolutionButton.waitFor()
    await cherryPickResolutionButton.click()
    const cherryPickResolutionMenu = page.locator('#web-context-menu')
    await cherryPickResolutionMenu.waitFor()
    await cherryPickResolutionMenu
      .getByRole('menuitem', { name: /^Use the modified file/i })
      .last()
      .click()
    await cherryPickResolutionMenu.waitFor({ state: 'hidden' })
    await cherryPickConflicts
      .getByRole('button', { name: /^Continue cherry-pick$/i })
      .click()
    await cherryPickConflicts.waitFor({ state: 'hidden' })
    await page.waitForFunction(() => {
      const state = window.__desktopPlusState().selectedState?.state
      return (
        state?.changesState?.conflictState?.kind !== 'cherryPick' &&
        state?.multiCommitOperationState === null
      )
    })
    assert.equal(
      fs.existsSync(path.join(cherryPickFlow, '.git', 'CHERRY_PICK_HEAD')),
      false
    )
    assert.equal(git(cherryPickFlow, 'branch', '--show-current'), 'main')
    assert.equal(
      fs.readFileSync(path.join(cherryPickFlow, 'shared.txt'), 'utf8'),
      'source\n'
    )
    assert.match(
      git(cherryPickFlow, 'log', '-1', '--format=%s'),
      /source change/
    )
    const presets = await page.evaluate(async paths => {
      const dispatcher = window.__desktopPlusDispatcher
      const repo = window
        .__desktopPlusState()
        .repositories.find(repository => repository.path === paths.branchFlow)
      await dispatcher.setBranchPresetScript({
        path: '/test/branch-presets',
        arguments: '%TARGET_PATH%',
      })
      return dispatcher.getBranchNamePresets(repo)
    }, paths)
    assert.deepEqual(presets, [
      { name: 'feature', description: 'Feature branch' },
      { name: 'fix', description: 'Fix branch' },
    ])
    assert.equal(presetRuns.length, 1)
    assert.equal(presetRuns[0].target, branchFlow)

    await page.evaluate(async paths => {
      const dispatcher = window.__desktopPlusDispatcher
      const [repo] = await dispatcher.addRepositories([paths.lfsFlow])
      const popup = window.__desktopPlusState().currentPopup
      if (popup?.type !== 'InitializeLFS')
        throw new Error(
          'LFS repository did not open the Desktop Initialize LFS dialog'
        )
      if (
        popup.repositories.length !== 1 ||
        popup.repositories[0].path !== repo.path
      )
        throw new Error(
          'Initialize LFS dialog did not receive the repository list'
        )
      await dispatcher.installLFSHooks(popup.repositories)
      await dispatcher.installGlobalLFSFilters(true)
    }, paths)
    assert.deepEqual(lfsRequests, [
      {
        action: 'install',
        path: lfsFlow,
        scope: 'local',
        confirmed: true,
        force: true,
      },
      {
        action: 'install',
        scope: 'global',
        confirmed: true,
        force: true,
      },
    ])

    await page.evaluate(async paths => {
      const dispatcher = window.__desktopPlusDispatcher
      const [repo] = await dispatcher.addRepositories([paths.submoduleFlow])
      const file = window
        .__desktopPlusState()
        .selectedState.state.changesState.workingDirectory.files.find(
          candidate => candidate.path === 'vendor/module'
        )
      if (
        !file?.status.submoduleStatus ||
        file.status.submoduleStatus.commitChanged ||
        !file.status.submoduleStatus.modifiedChanges
      )
        throw new Error('Submodule status did not reach the Desktop state')

      await dispatcher.selectWorkingDirectoryFiles(repo, [file])
      const diff =
        window.__desktopPlusState().selectedState.state.changesState.selection
          .diff
      if (
        diff?.kind !== 3 ||
        !diff.fullPath.endsWith('/submodule-flow/vendor/module') ||
        !diff.url.endsWith('/submodule-source') ||
        !diff.status.modifiedChanges ||
        diff.oldSHA !== null ||
        diff.newSHA !== null
      )
        throw new Error(
          `Submodule selection did not build the Desktop SubmoduleDiff: ${JSON.stringify(
            diff
          )}`
        )

      await dispatcher.openOrAddRepository(diff.fullPath)
      if (window.__desktopPlusState().currentPopup?.type !== 'AddRepository')
        throw new Error(
          'Submodule diff did not open the Desktop add-repository dialog'
        )
      dispatcher.closePopup()
    }, paths)

    git(source, 'checkout', '-b', 'delete-me')
    git(source, 'push', '-u', 'origin', 'delete-me')
    git(source, 'checkout', 'main')
    await page.evaluate(async paths => {
      const post = body =>
        fetch('/api/git/operation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: paths.source, ...body }),
        }).then(async response => {
          if (!response.ok) throw new Error((await response.json()).error)
        })
      await post({
        operation: 'delete-remote-branch',
        values: ['origin', 'delete-me'],
      })
      await post({ operation: 'reset-upstream', confirmed: true })
    }, paths)
    assert.doesNotMatch(git(remote, 'branch', '--list'), /delete-me/)

    console.log(
      'Browser API workflows passed: clone/init, branch switching, active branch deletion, native history drag reorder, native merge/rebase/cherry-pick conflict controls, selected worktree removal, pull recovery, branch presets, Desktop LFS initialization, Desktop submodule diff and open flow, auth/PR mocks, stash selection, worktree, reset, force-push, remote deletion'
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
