const assert = require('assert/strict')
const fs = require('fs')
const path = require('path')
const { operations } = require('./src/web-operation-contract')

const root = path.join(__dirname, '..')
const contracts = fs.readFileSync(
  path.join(root, 'app/src/ui/web/contracts.ts'),
  'utf8'
)
const client = fs.readFileSync(
  path.join(root, 'app/src/ui/web/client.ts'),
  'utf8'
)
const store = fs.readFileSync(
  path.join(root, 'app/src/ui/web/store.ts'),
  'utf8'
)

const sourceMatch = contracts.match(
  /export const webOperationNames = \[([\s\S]*?)\] as const/
)
assert.ok(sourceMatch, 'Missing typed web operation list')
const sourceOperations = [...sourceMatch[1].matchAll(/'([^']+)'/g)].map(
  match => match[1]
)

assert.deepEqual(
  sourceOperations,
  operations,
  'Typed source operations differ from the companion allowlist'
)

assert.match(client, /runOperation\(/)
assert.match(client, /request\(['"]\/api\/git\/operation['"]/)
assert.match(client, /startOperation\(/)
assert.match(client, /request\(['"]\/api\/git\/operations['"]/)
assert.match(client, /getOperation\(/)
assert.match(client, /cancelOperation\(/)
assert.match(store, /async runOperation\(/)
assert.match(store, /git\.startOperation\(path, operation, options\)/)
assert.match(store, /git\.getOperation\(current\.id\)/)
assert.match(store, /git\.cancelOperation\(task\.id\)/)
assert.doesNotMatch(store, /git\.runOperation\(path, operation, options\)/)

console.log(`Web operation parity passed: ${operations.length} operations`)
