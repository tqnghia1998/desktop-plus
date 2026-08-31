const { spawnSync } = require('child_process')
const path = require('path')
const { selectedBrowserName } = require('./test-browser')

const suites = {
  integration: [
    'test-source-renderer.js',
    'test-source-commit-options.js',
    'test-source-history-workflows.js',
    'test-source-compare-workflows.js',
    'test-source-local-workflows.js',
    'test-source-sync-workflows.js',
    'test-source-advanced-workflows.js',
    'test-source-parity-round.js',
    'test-source-repository-recovery.js',
    'test-source-branch-gaps.js',
    'test-source-local-evidence.js',
    'test-source-preferences-history.js',
    'test-source-state-persistence.js',
    'test-source-trash-recovery.js',
    'test-source-tutorial.js',
    'test-source-platform-gaps.js',
  ],
  ui: [
    'test-gitlab-source-renderer.js',
    'test-dialogs.js',
    'test-create-repository-templates.js',
    'test-context-menu.js',
  ],
}

const selected = process.argv[2] || 'all'
const tests =
  selected === 'all' ? [...suites.integration, ...suites.ui] : suites[selected]

if (!tests) {
  console.error(`Unknown browser test suite: ${selected}`)
  process.exit(2)
}

console.log(`[web test] browser=${selectedBrowserName()}`)
const timeout = Number(process.env.WEB_TEST_TIMEOUT_MS || 180000)
for (const test of tests) {
  console.log(`\n[web test] ${test}`)
  const result = spawnSync(process.execPath, [path.join(__dirname, test)], {
    stdio: 'inherit',
    timeout,
  })
  if (result.error) {
    console.error(
      result.error.code === 'ETIMEDOUT'
        ? `${test} exceeded ${timeout}ms`
        : result.error
    )
    process.exit(1)
  }
  if (result.status !== 0) process.exit(result.status || 1)
}
