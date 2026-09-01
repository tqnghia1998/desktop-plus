const assert = require('assert/strict')
const fs = require('fs')
const path = require('path')
const capabilities = require('./src/capabilities')
const { evidence, sourceSuites } = require('./src/source-evidence')

const matrix = fs.readFileSync(path.join(__dirname, 'CAPABILITIES.md'), 'utf8')
const parityGaps = fs.readFileSync(
  path.join(__dirname, 'PARITY-GAPS.md'),
  'utf8'
)

function documentedStatus(id) {
  const match = matrix.match(
    new RegExp(
      `^\\| ${id.replace(
        /[.*+?^${}()|[\\]\\\\]/g,
        '\\\\$&'
      )} \\| (Supported|Partial|Missing|Deferred) \\|`,
      'm'
    )
  )
  assert.ok(match, `Missing capability matrix row: ${id}`)
  return match[1]
}

const inventoryRows = [
  ...parityGaps.matchAll(
    /^\| ([A-Z]+-\d+) \| .*? \| (Supported|Partial|Missing|Deferred) \|/gm
  ),
].map(match => ({ id: match[1], status: match[2] }))

assert.equal(inventoryRows.length, 134, 'Parity inventory row count changed')
const inventoryCounts = Object.fromEntries(
  ['Supported', 'Partial', 'Missing', 'Deferred'].map(status => [
    status,
    inventoryRows.filter(row => row.status === status).length,
  ])
)
assert.deepEqual(inventoryCounts, {
  Supported: 99,
  Partial: 9,
  Missing: 1,
  Deferred: 25,
})

const integrationSuites = new Set([
  'test-source-renderer.js',
  'test-source-commit-options.js',
  'test-source-history-workflows.js',
  'test-source-compare-workflows.js',
  'test-source-local-workflows.js',
  'test-source-sync-workflows.js',
  'test-source-ssh-auth.js',
  'test-source-advanced-workflows.js',
  'test-source-parity-round.js',
  'test-source-repository-recovery.js',
  'test-source-branch-gaps.js',
  'test-source-local-evidence.js',
  'test-source-preferences-history.js',
  'test-source-state-persistence.js',
  'test-source-trash-recovery.js',
  'test-source-platform-gaps.js',
])
const evidenceOnlySuites = new Set(['test-docs.js'])

for (const row of inventoryRows.filter(row => row.status === 'Supported')) {
  const suiteKeys = evidence[row.id]
  assert.ok(
    suiteKeys?.length,
    `Supported inventory row ${row.id} has no source-renderer evidence`
  )
  for (const suiteKey of suiteKeys) {
    const suite = sourceSuites[suiteKey]
    assert.ok(
      suite,
      `${row.id} references an unknown evidence suite ${suiteKey}`
    )
    assert.ok(
      integrationSuites.has(suite) ||
        (row.id === 'EVID-01' && evidenceOnlySuites.has(suite)),
      `${row.id} evidence suite ${suite} is not an allowed source/evidence suite`
    )
    assert.ok(
      fs.existsSync(path.join(__dirname, suite)),
      `${row.id} evidence suite is missing: ${suite}`
    )
  }
}

for (const [id, suiteKeys] of Object.entries(evidence)) {
  const row = inventoryRows.find(candidate => candidate.id === id)
  assert.ok(row, `Evidence map references unknown inventory row: ${id}`)
  assert.equal(
    row.status,
    'Supported',
    `Evidence map may only reference Supported rows: ${id}`
  )
  assert.ok(suiteKeys.length, `Evidence map entry is empty: ${id}`)
}

for (const [id, status] of Object.entries(capabilities.features)) {
  const documented = documentedStatus(id)
  if (status === 'supported') assert.equal(documented, 'Supported')
  if (status === 'partial' || status === 'companion')
    assert.equal(documented, 'Partial')
  if (status === 'unavailable')
    assert.ok(
      documented === 'Missing' || documented === 'Deferred',
      `${id} must be documented as Missing or Deferred`
    )
}

for (const [id, provider] of Object.entries(capabilities.hostingProviders)) {
  const documented = documentedStatus(id)
  if (provider.status === 'supported') assert.equal(documented, 'Supported')
  if (provider.status === 'partial') assert.equal(documented, 'Partial')
  if (provider.status === 'unavailable') assert.equal(documented, 'Deferred')
}

for (const document of [
  'README.md',
  'RELEASE.md',
  'IMPLEMENTATION-PLAN.md',
  'PARITY-GAPS.md',
]) {
  assert.ok(
    fs.existsSync(path.join(__dirname, document)),
    `Missing web documentation: ${document}`
  )
}

console.log('Web documentation passed: capability matrix matches runtime flags')
