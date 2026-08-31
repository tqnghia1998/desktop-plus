const assert = require('assert/strict')
const { resolveServerPort } = require('./server')

assert.equal(resolveServerPort([], {}), 3000)
assert.equal(resolveServerPort([], { PORT: '4567' }), 4567)
assert.equal(resolveServerPort(['--port', '4000'], { PORT: '4567' }), 4000)
assert.equal(resolveServerPort(['--port=5000'], { PORT: '4567' }), 5000)
assert.equal(resolveServerPort(['--port', '0'], {}), 0)

assert.throws(
  () => resolveServerPort(['--port'], {}),
  /Invalid port: undefined/
)
assert.throws(
  () => resolveServerPort(['--port', 'abc'], {}),
  /Invalid port: abc/
)
assert.throws(
  () => resolveServerPort(['--port', '70000'], {}),
  /Invalid port: 70000/
)

console.log('Web start passed: port resolution handles CLI and env input')
