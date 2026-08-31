const crypto = require('crypto')

const gitLabCredentialService = 'desktop-plus-web-gitlab'

function normalizeGitLabEndpoint(endpoint) {
  let base
  try {
    base = new URL(endpoint)
  } catch {
    throw Object.assign(new Error('GitLab API endpoint must be a valid URL'), {
      statusCode: 400,
    })
  }
  if (
    !['http:', 'https:'].includes(base.protocol) ||
    base.username ||
    base.password ||
    base.search ||
    base.hash
  )
    throw Object.assign(
      new Error(
        'GitLab API endpoint must be an HTTP(S) URL without credentials, query, or fragment'
      ),
      { statusCode: 400 }
    )
  if (
    base.protocol === 'http:' &&
    !['127.0.0.1', '::1', 'localhost'].includes(base.hostname)
  )
    throw Object.assign(
      new Error('GitLab API endpoints must use HTTPS unless they are loopback'),
      { statusCode: 400 }
    )
  const pathname = base.pathname.replace(/\/+$/, '')
  base.pathname = pathname.endsWith('/api/v4') ? pathname : `${pathname}/api/v4`
  return base.toString().replace(/\/$/, '')
}

function gitLabCredentialId(endpoint, username) {
  return crypto
    .createHash('sha256')
    .update(`${normalizeGitLabEndpoint(endpoint)}\0${username}`)
    .digest('base64url')
}

function authenticatedGitLabEnvironment(remoteURL, token) {
  const remote = new URL(remoteURL)
  if (remote.protocol !== 'https:') return undefined
  const authorization = Buffer.from(`oauth2:${token}`).toString('base64')
  return {
    ...process.env,
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: `http.${remote.origin}/.extraHeader`,
    GIT_CONFIG_VALUE_0: `Authorization: Basic ${authorization}`,
    GIT_TERMINAL_PROMPT: '0',
  }
}

function gitLabErrorCode(status, message) {
  if (status === 401) return 'credentials-invalid'
  if (status === 403) return 'insufficient-permission'
  if (status === 404) return 'resource-not-found'
  if (status === 409) return 'repository-name-collision'
  if (status === 429) return 'rate-limited'
  if (status >= 500) return 'provider-unavailable'
  if (status === 400 || status === 422) return 'validation-failed'
  return 'hosting-request-failed'
}

async function gitLabRequest(endpoint, token, method, pathname, body) {
  let response
  try {
    response = await fetch(
      new URL(
        pathname.replace(/^\//, ''),
        `${normalizeGitLabEndpoint(endpoint)}/`
      ),
      {
        method,
        signal: AbortSignal.timeout(30_000),
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'PRIVATE-TOKEN': token,
          'User-Agent': 'Desktop-Plus-Web',
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
    const message =
      typeof data?.message === 'string'
        ? data.message
        : data?.message
        ? JSON.stringify(data.message)
        : `GitLab API returned ${response.status}`
    const code = gitLabErrorCode(response.status, message)
    throw Object.assign(new Error(message), {
      code,
      statusCode:
        response.status === 401 || response.status === 403
          ? response.status
          : response.status >= 500
          ? 502
          : 400,
    })
  }
  return data
}

module.exports = {
  authenticatedGitLabEnvironment,
  gitLabCredentialId,
  gitLabCredentialService,
  gitLabErrorCode,
  gitLabRequest,
  normalizeGitLabEndpoint,
}
