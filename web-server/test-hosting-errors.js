const assert = require('assert/strict')
const { hostingRequest } = require('./hosting')
const { gitLabRequest } = require('./gitlab')

async function main() {
  const originalFetch = global.fetch
  try {
    for (const [status, message, expected] of [
      [401, 'Bad credentials', 'credentials-invalid'],
      [403, 'API rate limit exceeded', 'rate-limited'],
      [
        403,
        'Resource not accessible by integration',
        'insufficient-permission',
      ],
      [404, 'Not Found', 'resource-not-found'],
      [409, 'Repository already exists', 'repository-name-collision'],
      [422, 'Validation Failed', 'validation-failed'],
      [503, 'Service unavailable', 'provider-unavailable'],
    ]) {
      global.fetch = async () =>
        new Response(JSON.stringify({ message }), {
          status,
          headers: { 'Content-Type': 'application/json' },
        })
      await assert.rejects(
        hostingRequest('https://api.github.com', 'token', 'GET', 'user'),
        error => error.code === expected
      )
    }
    for (const [status, message, expected] of [
      [401, 'Unauthorized', 'credentials-invalid'],
      [403, 'Forbidden', 'insufficient-permission'],
      [404, '404 Project Not Found', 'resource-not-found'],
      [409, 'Project already exists', 'repository-name-collision'],
      [422, 'Validation failed', 'validation-failed'],
      [429, 'Too many requests', 'rate-limited'],
      [503, 'Service unavailable', 'provider-unavailable'],
    ]) {
      global.fetch = async () =>
        new Response(JSON.stringify({ message }), {
          status,
          headers: { 'Content-Type': 'application/json' },
        })
      await assert.rejects(
        gitLabRequest('https://gitlab.example/api/v4', 'token', 'GET', 'user'),
        error => error.code === expected
      )
    }
    for (const [message, expected] of [
      [
        'fetch failed: unable to verify the first certificate',
        'certificate-error',
      ],
      ['fetch failed: proxy connection refused', 'proxy-failure'],
      ['fetch failed: connection timed out', 'network-unavailable'],
    ]) {
      global.fetch = async () => {
        throw new Error(message)
      }
      await assert.rejects(
        hostingRequest('https://api.github.com', 'token', 'GET', 'user'),
        error => error.code === expected && error.statusCode === 502
      )
      await assert.rejects(
        gitLabRequest('https://gitlab.example/api/v4', 'token', 'GET', 'user'),
        error => error.code === expected && error.statusCode === 502
      )
    }
    console.log(
      'Hosting errors passed: GitHub and GitLab provider failures have stable codes'
    )
  } finally {
    global.fetch = originalFetch
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
