const crypto = require('crypto')

const githubCredentialService = 'desktop-plus-web-github'

function normalizeGitHubEndpoint(endpoint) {
  let base
  try {
    base = new URL(endpoint)
  } catch {
    throw Object.assign(new Error('GitHub API endpoint must be a valid URL'), {
      statusCode: 400,
    })
  }
  if (
    !endpoint ||
    !['http:', 'https:'].includes(base.protocol) ||
    base.username ||
    base.password ||
    base.search ||
    base.hash
  ) {
    throw Object.assign(
      new Error(
        'GitHub API endpoint must be an HTTP(S) URL without credentials, query, or fragment'
      ),
      { statusCode: 400 }
    )
  }
  if (
    base.protocol === 'http:' &&
    !['127.0.0.1', '::1', 'localhost'].includes(base.hostname)
  ) {
    throw Object.assign(
      new Error('GitHub API endpoints must use HTTPS unless they are loopback'),
      { statusCode: 400 }
    )
  }
  const pathname = base.pathname.replace(/\/+$/, '')
  if (pathname && pathname !== '/api/v3') {
    throw Object.assign(
      new Error(
        'GitHub API endpoint path must be empty or /api/v3 for GitHub Enterprise'
      ),
      { statusCode: 400 }
    )
  }
  base.pathname = pathname || '/'
  return base.toString().replace(/\/$/, '')
}

function githubCredentialId(endpoint, login) {
  return crypto
    .createHash('sha256')
    .update(`${normalizeGitHubEndpoint(endpoint)}\0${login}`)
    .digest('base64url')
}

function authenticatedGitEnvironment(remoteURL, token) {
  const remote = new URL(remoteURL)
  if (remote.protocol !== 'https:') return undefined
  const authorization = Buffer.from(`x-access-token:${token}`).toString(
    'base64'
  )
  return {
    ...process.env,
    GIT_CONFIG_PARAMETERS: '',
    GIT_CONFIG_COUNT: '3',
    GIT_CONFIG_KEY_0: 'credential.helper',
    GIT_CONFIG_VALUE_0: '',
    GIT_CONFIG_KEY_1: 'core.askPass',
    GIT_CONFIG_VALUE_1: '',
    GIT_CONFIG_KEY_2: `http.${remote.origin}/.extraHeader`,
    GIT_CONFIG_VALUE_2: `Authorization: Basic ${authorization}`,
    GIT_TERMINAL_PROMPT: '0',
    GIT_ASKPASS: process.execPath,
    SSH_ASKPASS: process.execPath,
  }
}

async function hostingRequest(endpoint, token, method, pathname, body) {
  const normalizedEndpoint = normalizeGitHubEndpoint(endpoint)
  if (!token) {
    throw Object.assign(new Error('GitHub token is required'), {
      statusCode: 400,
    })
  }
  let response
  try {
    response = await fetch(
      new URL(pathname.replace(/^\//, ''), `${normalizedEndpoint}/`),
      {
        method,
        signal: AbortSignal.timeout(30_000),
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Desktop-Plus-Web',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const cause =
      error && typeof error === 'object' && 'cause' in error
        ? String(error.cause)
        : ''
    const detail = `${message}\n${cause}`
    const code = /certificate|self signed|unable to verify|cert_/i.test(detail)
      ? 'certificate-error'
      : /proxy/i.test(detail)
      ? 'proxy-failure'
      : 'network-unavailable'
    throw Object.assign(new Error(message), { code, statusCode: 502 })
  }
  const text = await response.text()
  let data
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { message: text }
  }
  if (!response.ok) {
    const message = data?.message || `Hosting API returned ${response.status}`
    let code = 'hosting-request-failed'
    if (response.status === 401) code = 'credentials-invalid'
    else if (response.status === 403)
      code = /rate limit/i.test(message)
        ? 'rate-limited'
        : 'insufficient-permission'
    else if (response.status === 404) code = 'resource-not-found'
    else if (response.status === 409) code = 'repository-name-collision'
    else if (response.status === 422) code = 'validation-failed'
    else if (response.status >= 500) code = 'provider-unavailable'
    throw Object.assign(new Error(message), {
      code,
      statusCode:
        response.status === 401 || response.status === 403
          ? response.status
          : response.status < 500
          ? 400
          : 502,
    })
  }
  return data
}

module.exports = {
  authenticatedGitEnvironment,
  githubCredentialId,
  githubCredentialService,
  hostingRequest,
  normalizeGitHubEndpoint,
}
