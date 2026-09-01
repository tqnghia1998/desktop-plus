const assert = require('assert/strict')
const http = require('http')
const path = require('path')
const { createServer } = require('./server')

function rawRequest(base, pathname, options = {}) {
  const target = new URL(pathname, base)
  return new Promise((resolve, reject) => {
    const request = http.request(
      target,
      {
        method: options.method || 'GET',
        headers: options.headers || {},
      },
      response => {
        const chunks = []
        response.on('data', chunk => chunks.push(chunk))
        response.on('end', () =>
          resolve({
            status: response.statusCode,
            headers: response.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          })
        )
      }
    )
    request.on('error', reject)
    if (options.body !== undefined) request.write(options.body)
    request.end()
  })
}

async function main() {
  const server = createServer({ sessionToken: 'phase-five-security-token' })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  const token = server.sessionToken
  const apiHeaders = {
    'X-Desktop-Plus-Session': token,
    Origin: base,
  }
  const jsonHeaders = {
    ...apiHeaders,
    'Content-Type': 'application/json',
  }

  try {
    let result = await rawRequest(base, '/')
    assert.equal(result.status, 200)
    assert.match(
      result.headers['content-security-policy'],
      /default-src 'self'/
    )
    const contentSecurityPolicy =
      result.headers['content-security-policy'].split('; ')
    assert.ok(
      contentSecurityPolicy.includes("script-src 'self'"),
      'script execution must remain same-origin without inline exceptions'
    )
    assert.ok(
      contentSecurityPolicy.includes("style-src 'self' 'unsafe-inline'"),
      'shared desktop React geometry styles must remain available in Chromium'
    )
    assert.ok(
      contentSecurityPolicy.includes("style-src-attr 'unsafe-inline'"),
      'dynamic source-renderer style attributes must be explicitly scoped'
    )
    assert.doesNotMatch(
      result.headers['content-security-policy'],
      /unsafe-eval/
    )
    assert.equal(result.headers['x-content-type-options'], 'nosniff')
    assert.equal(result.headers['x-frame-options'], 'DENY')
    assert.equal(result.headers['referrer-policy'], 'no-referrer')
    assert.equal(result.headers['access-control-allow-origin'], undefined)

    result = await rawRequest(base, '/static/empty-no-repo.svg')
    assert.equal(result.status, 200)
    assert.match(result.headers['content-security-policy'], /^sandbox;/)

    result = await rawRequest(base, '/api/health', {
      headers: { Host: 'evil.example', ...apiHeaders },
    })
    assert.equal(result.status, 403)
    result = await rawRequest(base, '/api/health')
    assert.equal(result.status, 403)
    result = await rawRequest(base, '/api/health', {
      headers: {
        ...apiHeaders,
        'X-Desktop-Plus-Session': 'incorrect',
      },
    })
    assert.equal(result.status, 403)
    result = await rawRequest(base, '/api/health', {
      headers: { ...apiHeaders, Origin: 'https://evil.example' },
    })
    assert.equal(result.status, 403)
    result = await rawRequest(base, '/api/health', {
      headers: { ...apiHeaders, Origin: `${base}/not-an-origin` },
    })
    assert.equal(result.status, 403)
    result = await rawRequest(base, '/api/health', { headers: apiHeaders })
    assert.equal(result.status, 200)
    assert.equal(result.headers['access-control-allow-origin'], undefined)

    result = await rawRequest(base, '/../server.js')
    assert.equal(result.status, 404)
    result = await rawRequest(base, '/static/index.html')
    assert.equal(result.status, 404)

    result = await rawRequest(base, '/api/fs/stat', {
      method: 'POST',
      headers: apiHeaders,
      body: '{}',
    })
    assert.equal(result.status, 415)
    result = await rawRequest(base, '/api/fs/stat', {
      method: 'POST',
      headers: jsonHeaders,
      body: '[]',
    })
    assert.equal(result.status, 400)
    result = await rawRequest(base, '/api/fs/stat', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ path: 'relative/path' }),
    })
    assert.equal(result.status, 400)
    result = await rawRequest(base, '/api/fs/stat', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ path: '/tmp/invalid\0path' }),
    })
    assert.equal(result.status, 400)

    result = await rawRequest(base, '/api/fs/stat', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ value: 'x'.repeat(10 * 1024 * 1024) }),
    })
    assert.equal(result.status, 413)

    for (const args of [
      ['-c', 'core.fsmonitor=!touch /tmp/desktop-plus-pwned', 'status'],
      ['--config-env', 'core.fsmonitor=ATTACK', 'status'],
    ]) {
      result = await rawRequest(base, '/api/git/query', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({
          path: path.resolve(__dirname, '..'),
          args,
        }),
      })
      assert.equal(result.status, 400)
    }

    result = await rawRequest(base, '/api/git/operation', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        path: path.resolve(__dirname, '..'),
        operation: 'checkout',
        values: ['--help'],
      }),
    })
    assert.equal(result.status, 400)
    result = await rawRequest(base, '/api/git/operation', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        path: path.resolve(__dirname, '..'),
        operation: 'remote-add',
        values: ['upstream', '--upload-pack=attack'],
      }),
    })
    assert.equal(result.status, 400)

    console.log('Web security passed: companion boundary and input validation')
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
