const http = require('http')
const path = require('path')
const fs = require('fs')
const os = require('os')
const crypto = require('crypto')
const { execFile, execFileSync, spawn } = require('child_process')
const { AsyncLocalStorage } = require('async_hooks')
const ignore = require('ignore')
const platform = require('./platform')
const { createUpdateManager } = require('./updates')
const {
  authenticatedGitEnvironment,
  githubCredentialId,
  githubCredentialService,
  hostingRequest,
  normalizeGitHubEndpoint,
} = require('./hosting')
const {
  authenticatedGitLabEnvironment,
  gitLabCredentialId,
  gitLabCredentialService,
  gitLabRequest,
  normalizeGitLabEndpoint,
} = require('./gitlab')
const { getDesktopRepositories } = require('./desktop-data')
const { applyEmbedding } = require('./src/embedding')
const {
  operations: webOperationNames,
} = require('./src/web-operation-contract')

let dugite
try {
  dugite = require('../app/node_modules/dugite')
} catch {
  dugite = require('dugite')
}

const publicDir = path.join(__dirname, 'public')
const MAX_REQUEST_BYTES = 10 * 1024 * 1024
const MAX_RESPONSE_BYTES = 50 * 1024 * 1024
const MAX_FILE_CONTENT_BYTES = 1024 * 1024
const { Router } = require('./src/http')
const { registerRepositoryRoutes } = require('./routes/repository')
const { registerFsRoutes } = require('./routes/fs')
const { registerHostingRoutes } = require('./routes/hosting')
const { registerSystemRoutes } = require('./routes/system')
const {
  MAX_ARGUMENT_LENGTH,
  MAX_PATH_LENGTH,
  requireString,
  requireText,
  requireGitValue,
  requireAbsolutePath,
  requireArray,
  requireBoolean,
  requireInteger,
} = require('./src/validation')
const {
  DESKTOP_STASH_ENTRY_MARKER,
  DESKTOP_STASH_ENTRY_MESSAGE_RE,
  parseDesktopStashMessage,
} = require('./src/git-stash-parser')
const STALE_GIT_CONFIG_LOCK_AGE_MS = 5 * 60 * 1000
const SSH_AUTH_PROMPT_TIMEOUT_MS = 120_000
const SSH_ASKPASS_SCRIPT_PATH = path.join(__dirname, 'ssh-askpass.js')
const SSH_CREDENTIAL_SERVICE = 'desktop-plus-web-ssh'
let macOSCredentialHelperExecPath
let resolvedMacOSCredentialHelperExecPath = false
const EMPTY_TREE_SHA = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'
const operationContext = new AsyncLocalStorage()
const IMAGE_MEDIA_TYPES = Object.freeze({
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.jpeg': 'image/jpg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.dds': 'image/vnd-ms.dds',
})
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'none'",
  "connect-src 'self'",
  "font-src 'self' data:",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "img-src 'self' data: https:",
  "object-src 'none'",
  "script-src 'self'",
  // The shared desktop React components calculate geometry through style
  // properties. Chromium applies those CSSOM mutations to style-src in the
  // release browser, so inline styles must be allowed for the reused UI.
  "style-src 'self' 'unsafe-inline'",
  "style-src-attr 'unsafe-inline'",
  "worker-src 'self'",
].join('; ')
let keytar
try {
  keytar = require('../app/node_modules/keytar')
} catch {}

function resolveServerPort(argv = process.argv.slice(2), env = process.env) {
  let configuredPort
  let portProvided = false

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--port') {
      portProvided = true
      configuredPort = argv[i + 1]
      break
    }
    if (arg.startsWith('--port=')) {
      portProvided = true
      configuredPort = arg.slice('--port='.length)
      break
    }
  }

  const rawPort = portProvided
    ? configuredPort
    : env.PORT !== undefined
    ? env.PORT
    : '3000'
  const port = Number(rawPort)

  if (
    !Number.isInteger(port) ||
    String(rawPort).trim() === '' ||
    port < 0 ||
    port > 65535
  ) {
    throw new Error(
      `Invalid port: ${rawPort}. Use an integer between 0 and 65535.`
    )
  }

  return port
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    const contentType = String(req.headers['content-type'] || '')
      .split(';', 1)[0]
      .trim()
      .toLowerCase()
    if (contentType !== 'application/json') {
      req.resume()
      return reject(
        Object.assign(new Error('Content-Type must be application/json'), {
          statusCode: 415,
        })
      )
    }
    const declaredLength = Number(req.headers['content-length'])
    if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
      req.resume()
      return reject(
        Object.assign(new Error('Request body too large'), { statusCode: 413 })
      )
    }
    let body = ''
    let bodyBytes = 0
    let tooLarge = false
    req.setEncoding('utf8')
    req.on('data', chunk => {
      if (tooLarge) return
      bodyBytes += Buffer.byteLength(chunk)
      if (bodyBytes > MAX_REQUEST_BYTES) {
        tooLarge = true
        body = ''
        return
      }
      body += chunk
    })
    req.on('end', () => {
      if (tooLarge)
        return reject(
          Object.assign(new Error('Request body too large'), {
            statusCode: 413,
          })
        )
      if (!body) return resolve({})
      try {
        const parsed = JSON.parse(body)
        if (
          parsed === null ||
          typeof parsed !== 'object' ||
          Array.isArray(parsed)
        )
          throw Object.assign(new Error('JSON body must be an object'), {
            statusCode: 400,
          })
        resolve(parsed)
      } catch {
        reject(
          Object.assign(new Error('Invalid JSON body'), { statusCode: 400 })
        )
      }
    })
    req.on('error', reject)
  })
}

function securityHeaders(extra = {}) {
  return applyEmbedding({
    'Content-Security-Policy': CONTENT_SECURITY_POLICY,
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Permissions-Policy':
      'camera=(), display-capture=(), geolocation=(), microphone=(), payment=(), usb=()',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    ...extra,
  })
}

function sendJson(res, statusCode, data) {
  const structuredData =
    data &&
    typeof data === 'object' &&
    typeof data.error === 'string' &&
    !data.code
      ? data.error === 'Hosting credentials were not found'
        ? { ...data, code: 'credentials-invalid' }
        : data.error === 'OS credential store is unavailable'
        ? { ...data, code: 'credential-store-unavailable' }
        : data
      : data
  const body = JSON.stringify(structuredData)
  res.writeHead(
    statusCode,
    securityHeaders({
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Length': Buffer.byteLength(body),
    })
  )
  res.end(body)
}

function requireCommitTrailers(value) {
  if (value === undefined) return []
  if (!Array.isArray(value))
    throw Object.assign(new Error('trailers must be an array'), {
      statusCode: 400,
    })
  return value.map((trailer, index) => {
    if (!trailer || typeof trailer !== 'object' || Array.isArray(trailer))
      throw Object.assign(
        new Error(`trailer ${index + 1} must contain a token and value`),
        { statusCode: 400 }
      )
    const token = requireGitValue(trailer.token, `trailer ${index + 1} token`)
    const trailerValue = requireGitValue(
      trailer.value,
      `trailer ${index + 1} value`
    )
    if (token.toLowerCase() !== 'co-authored-by')
      throw Object.assign(
        new Error('Only Co-Authored-By trailers are supported'),
        { statusCode: 400 }
      )
    if (!/^.+\s+<[^<>\r\n]+>$/.test(trailerValue))
      throw Object.assign(
        new Error(`trailer ${index + 1} must use the format Name <email>`),
        { statusCode: 400 }
      )
    return { token: 'Co-Authored-By', value: trailerValue }
  })
}

async function mergeCommitTrailers(repoPath, message, trailers) {
  if (!trailers.length) return message
  const args = ['interpret-trailers', '--no-divider']
  for (const trailer of trailers)
    args.push('--trailer', `${trailer.token}=${trailer.value}`)
  return (await git(args, repoPath, [0], message)).stdout
}

async function repositoryDeletionTarget(value) {
  const requestedPath = requireAbsolutePath(value, 'repository path')
  const stats = await fs.promises.lstat(requestedPath).catch(error => {
    if (error.code === 'ENOENT')
      throw Object.assign(new Error('The repository path no longer exists.'), {
        statusCode: 404,
        code: 'missing-repository',
      })
    throw error
  })
  if (!stats.isDirectory() || stats.isSymbolicLink())
    throw Object.assign(
      new Error('Only a real repository directory can be deleted.'),
      { statusCode: 400, code: 'invalid-repository-delete-target' }
    )

  const resolvedPath = await fs.promises.realpath(requestedPath)
  if (path.parse(resolvedPath).root === resolvedPath)
    throw Object.assign(new Error('Refusing to delete a filesystem root.'), {
      statusCode: 400,
      code: 'invalid-repository-delete-target',
    })

  const inspection = await inspectRepository(resolvedPath)
  if (
    inspection.kind !== 'regular' ||
    inspection.repositoryPath !== resolvedPath
  )
    throw Object.assign(
      new Error(
        'Delete the repository from its top-level directory after confirming it is a regular Git repository.'
      ),
      { statusCode: 400, code: 'invalid-repository-delete-target' }
    )
  return resolvedPath
}

async function deleteRepositoryFromDisk(repoPath, mode, confirmed, services) {
  if (confirmed !== true)
    throw Object.assign(
      new Error('Confirm deleting this repository before continuing.'),
      { statusCode: 400, code: 'confirmation-required' }
    )
  if (mode !== 'trash' && mode !== 'permanent')
    throw Object.assign(new Error('Repository deletion mode is invalid.'), {
      statusCode: 400,
      code: 'invalid-repository-delete-mode',
    })

  const target = await repositoryDeletionTarget(repoPath)
  if (mode === 'trash') {
    try {
      await services.moveToTrash(target)
    } catch (error) {
      throw Object.assign(
        new Error(
          'The repository could not be moved to the macOS Trash. Choose permanent deletion only if you understand that it cannot be recovered.'
        ),
        {
          statusCode: 409,
          code: 'trash-failed',
          cause: error,
        }
      )
    }
  } else {
    await fs.promises.rm(target, {
      recursive: true,
      force: false,
      maxRetries: 0,
    })
  }
  return { deletedPath: target, mode }
}

function requireGitHubCredential(body) {
  const endpoint = normalizeGitHubEndpoint(
    requireString(body.endpoint, 'endpoint')
  )
  const login = requireString(body.login, 'login')
  const credentialId = requireString(body.credentialId, 'credentialId')
  if (credentialId !== githubCredentialId(endpoint, login)) {
    throw Object.assign(
      new Error('Credential does not match the GitHub endpoint and login'),
      { statusCode: 400 }
    )
  }
  return { credentialId, endpoint }
}

function requireGitLabCredential(body) {
  const endpoint = normalizeGitLabEndpoint(
    requireString(body.endpoint, 'endpoint')
  )
  const login = requireString(body.login, 'login')
  const credentialId = requireString(body.credentialId, 'credentialId')
  if (credentialId !== gitLabCredentialId(endpoint, login))
    throw Object.assign(
      new Error('Credential does not match the GitLab endpoint and login'),
      { statusCode: 400 }
    )
  return { credentialId, endpoint }
}

function gitLabProjectPath(owner, repository) {
  return encodeURIComponent(`${owner}/${repository}`)
}

async function gitLabNamespaceId(request, endpoint, token, namespace) {
  if (!namespace) return undefined
  const namespaces = await request(
    endpoint,
    token,
    'GET',
    `namespaces?search=${encodeURIComponent(namespace)}&per_page=100`
  )
  const match = Array.isArray(namespaces)
    ? namespaces.find(
        item => item.full_path === namespace || item.path === namespace
      )
    : null
  if (!match || !Number.isInteger(Number(match.id))) {
    throw Object.assign(
      new Error(
        `GitLab namespace "${namespace}" was not found or is not available to this account`
      ),
      { code: 'resource-not-found', statusCode: 400 }
    )
  }
  return Number(match.id)
}

function gitLabChangeStatus(change) {
  if (change.deleted_file) return 'Deleted'
  if (change.new_file) return 'New'
  if (change.renamed_file) return 'Renamed'
  return 'Modified'
}

function gitLabDiffStats(diff) {
  if (typeof diff !== 'string') return { additions: 0, deletions: 0 }
  return diff.split('\n').reduce(
    (stats, line) => ({
      additions:
        stats.additions +
        (line.startsWith('+') && !line.startsWith('+++') ? 1 : 0),
      deletions:
        stats.deletions +
        (line.startsWith('-') && !line.startsWith('---') ? 1 : 0),
    }),
    { additions: 0, deletions: 0 }
  )
}

function gitLabPipelineCheck(pipeline) {
  const running = [
    'created',
    'waiting_for_resource',
    'preparing',
    'pending',
    'running',
    'manual',
    'scheduled',
  ].includes(pipeline.status)
  const conclusion =
    pipeline.status === 'success'
      ? 'success'
      : running
      ? null
      : pipeline.status === 'skipped'
      ? 'neutral'
      : pipeline.status === 'canceled'
      ? 'cancelled'
      : 'failure'
  return {
    id: pipeline.id,
    name: `Pipeline #${pipeline.id}`,
    description: String(pipeline.status || 'unknown'),
    status: running ? 'in_progress' : 'completed',
    conclusion,
    appName: 'GitLab CI',
    htmlUrl: pipeline.web_url || null,
    checkSuiteId: ['failed', 'canceled'].includes(pipeline.status)
      ? pipeline.id
      : null,
  }
}

function gitLabRemoteMatchesEndpoint(remoteURL, endpoint) {
  const api = new URL(normalizeGitLabEndpoint(endpoint))
  try {
    const remote = new URL(remoteURL)
    if (remote.protocol === 'https:') return remote.origin === api.origin
    if (remote.protocol === 'ssh:') return remote.hostname === api.hostname
  } catch {
    const scp = String(remoteURL).match(/^[^@\s]+@([^:\s]+):/)
    return Boolean(scp && scp[1].toLowerCase() === api.hostname.toLowerCase())
  }
  return false
}

function requireGitLabRemote(remoteURL, endpoint) {
  if (!gitLabRemoteMatchesEndpoint(remoteURL, endpoint))
    throw Object.assign(
      new Error(
        'The origin remote does not match the signed-in GitLab endpoint'
      ),
      { code: 'resource-not-found', statusCode: 400 }
    )
}

function normalizeRemoteURL(value) {
  return String(value || '')
    .replace(/\.git$/, '')
    .replace(/\/$/, '')
    .toLowerCase()
}

function safeRemoteURL(value) {
  const remoteURL = String(value || '')
  try {
    const parsed = new URL(remoteURL)
    parsed.username = ''
    parsed.password = ''
    return parsed.toString().replace(/\/$/, '')
  } catch {
    return remoteURL
  }
}

function remoteWebURL(value) {
  const remoteURL = safeRemoteURL(value)
  const scp = /^([^@:\s]+@)?([^:\s]+):(.+)$/.exec(remoteURL)
  if (scp && !remoteURL.includes('://'))
    return `https://${scp[2]}/${scp[3]}`.replace(/\.git$/, '')
  try {
    const parsed = new URL(remoteURL)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    parsed.username = ''
    parsed.password = ''
    parsed.pathname = parsed.pathname.replace(/\/+$/, '').replace(/\.git$/, '')
    parsed.search = ''
    parsed.hash = ''
    return parsed.toString().replace(/\/$/, '')
  } catch {
    return null
  }
}

function githubFileStatus(status) {
  switch (status) {
    case 'added':
      return 'New'
    case 'removed':
      return 'Deleted'
    case 'renamed':
      return 'Renamed'
    case 'copied':
      return 'Copied'
    default:
      return 'Modified'
  }
}

function githubCheckDescription(check) {
  if (check.status !== 'completed' || !check.conclusion) return 'In progress'
  switch (check.conclusion) {
    case 'success':
      return 'Successful'
    case 'failure':
      return 'Failed'
    case 'cancelled':
      return 'Canceled'
    case 'timed_out':
      return 'Timed out'
    case 'action_required':
      return 'Action required'
    case 'skipped':
      return 'Skipped'
    case 'stale':
      return 'Marked as stale'
    default:
      return 'Neutral'
  }
}

function githubNotificationTarget(notification) {
  const subjectURL = String(notification.subject?.url || '')
  const match = /^\/?repos\/([^/]+)\/([^/]+)\/pulls\/(\d+)$/.exec(
    subjectURL.replace(/^https?:\/\/[^/]+\//, '')
  )
  if (!match) return null
  const [, owner, repository, pullRequestNumber] = match
  return {
    owner,
    repository,
    pullRequestNumber: Number(pullRequestNumber),
  }
}

function classifyGitHostingError(error) {
  if (error?.code === 'hook-failed') return error
  const result =
    error && typeof error === 'object' && 'result' in error
      ? error.result
      : null
  const detail = [
    error instanceof Error ? error.message : String(error),
    result?.stdout || '',
    result?.stderr || '',
  ].join('\n')
  const code = /push protection|secret scanning|gh009/i.test(detail)
    ? 'push-protection-blocked'
    : /bypass request|approval required|waiting for approval/i.test(detail)
    ? 'approval-required'
    : /repository ruleset|push rule|policy.*forbid/i.test(detail)
    ? 'policy-forbidden'
    : /protected branch|gh006|protected.*push/i.test(detail)
    ? 'protected-branch'
    : /host key verification failed|remote host identification has changed/i.test(
        detail
      )
    ? 'ssh-host-key'
    : /could not read username|credential helper|askpass|terminal prompts disabled|no such device or address/i.test(
        detail
      )
    ? 'credential-helper-failed'
    : /authentication failed|invalid username or password|permission denied \(publickey\)|publickey/i.test(
        detail
      )
    ? 'authentication-required'
    : /remote rejected|pre-receive hook declined|failed to push|permission denied|denied to/i.test(
        detail
      )
    ? 'push-rejected'
    : /certificate|self signed|unable to verify|ssl.*cert/i.test(detail)
    ? 'certificate-error'
    : /proxy/i.test(detail)
    ? 'proxy-failure'
    : /could not resolve host|failed to connect|network is unreachable|connection timed out/i.test(
        detail
      )
    ? 'network-unavailable'
    : 'push-rejected'
  const bypassURL =
    code === 'push-protection-blocked'
      ? /https?:\/\/[^\s"'`]+/.exec(detail)?.[0] || null
      : null
  return Object.assign(
    new Error(error instanceof Error ? error.message : detail),
    {
      code,
      statusCode: 400,
      ...(bypassURL ? { bypassURL } : {}),
      ...(result ? { result } : {}),
    }
  )
}

function classifyGitRemoteError(error, operation) {
  if (error?.code && error.code !== 'push-rejected') return error
  const result =
    error && typeof error === 'object' && 'result' in error
      ? error.result
      : null
  const detail = [
    error instanceof Error ? error.message : String(error),
    result?.stdout || '',
    result?.stderr || '',
  ].join('\n')
  const code =
    /host key verification failed|remote host identification has changed/i.test(
      detail
    )
      ? 'ssh-host-key'
      : /could not read username|credential helper|askpass|terminal prompts disabled|no such device or address/i.test(
          detail
        )
      ? 'credential-helper-failed'
      : /authentication failed|invalid username or password|permission denied \(publickey\)|publickey/i.test(
          detail
        )
      ? 'authentication-required'
      : /certificate|self signed|unable to verify|ssl.*cert/i.test(detail)
      ? 'certificate-error'
      : /proxy/i.test(detail)
      ? 'proxy-failure'
      : /could not resolve host|failed to connect|network is unreachable|connection timed out/i.test(
          detail
        )
      ? 'network-unavailable'
      : operation === 'push' || operation === 'publish-branch'
      ? 'push-rejected'
      : 'git-remote-failed'
  return Object.assign(
    new Error(error instanceof Error ? error.message : detail),
    {
      code,
      statusCode: error?.statusCode || 400,
      ...(result ? { result } : {}),
    }
  )
}

function classifySubmoduleError(error) {
  if (error?.code) return error
  const result =
    error && typeof error === 'object' && 'result' in error
      ? error.result
      : null
  return Object.assign(
    new Error(
      'The submodule could not be updated. Check its remote and nested repository state, then retry.'
    ),
    {
      code: 'submodule-update-failed',
      statusCode: error?.statusCode || 400,
      ...(result ? { result } : {}),
    }
  )
}

function lfsProgress(output) {
  const matches = [...output.matchAll(/(\d{1,3})%/g)]
  if (matches.length === 0) return null
  const progress = Number(matches[matches.length - 1][1])
  return Number.isFinite(progress) ? Math.min(progress, 100) : null
}

async function getLfsStatus(repoPath) {
  const versionResult = await git(['lfs', 'version'], repoPath, [0, 1, 128])
  const available = versionResult.exitCode === 0
  const versionMatch = available
    ? /git-lfs\/([^\s]+)/.exec(versionResult.stdout)
    : null
  const attributesPath = path.join(repoPath, '.gitattributes')
  let trackedPatterns = []
  try {
    const attributes = await fs.promises.readFile(attributesPath, 'utf8')
    trackedPatterns = attributes.split(/\r?\n/).flatMap(line => {
      const match = /^\s*([^\s#]+).*?\bfilter=lfs\b/.exec(line)
      return match ? [match[1]] : []
    })
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  const filterResult = await git(
    ['config', '--get-regexp', '^filter\\.lfs\\.(clean|smudge|process)$'],
    repoPath,
    [0, 1]
  )
  const filtersConfigured = filterResult.exitCode === 0
  const hookPath = (
    await git(['rev-parse', '--git-path', 'hooks/pre-push'], repoPath)
  ).stdout.trim()
  let hooksInstalled = false
  try {
    hooksInstalled = /git lfs pre-push/.test(
      await fs.promises.readFile(path.resolve(repoPath, hookPath), 'utf8')
    )
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  const mismatches = []
  if (trackedPatterns.length > 0 && !available)
    mismatches.push({
      kind: 'lfs-unavailable',
      message:
        'This repository tracks LFS files, but Git LFS is not available on this computer.',
    })
  if (available && trackedPatterns.length > 0 && !filtersConfigured)
    mismatches.push({
      kind: 'filters-unconfigured',
      message:
        'LFS attributes are present, but this repository does not have the LFS filters configured.',
    })
  if (available && trackedPatterns.length > 0 && !hooksInstalled)
    mismatches.push({
      kind: 'pre-push-hook-missing',
      message:
        'LFS attributes are present, but the repository pre-push hook is missing.',
    })
  return {
    available,
    version: versionMatch ? versionMatch[1] : null,
    filtersConfigured,
    hooksInstalled,
    trackedPatterns,
    mismatches,
  }
}

async function installLfs(repoPath, scope, confirmed, force = false) {
  if (!confirmed)
    throw Object.assign(
      new Error(
        'Confirm Git LFS installation before changing Git configuration'
      ),
      { statusCode: 400, code: 'confirmation-required' }
    )
  const versionResult = await git(['lfs', 'version'], repoPath, [0, 1, 128])
  if (versionResult.exitCode !== 0)
    throw Object.assign(
      new Error('Git LFS is not installed on this computer'),
      {
        statusCode: 501,
        code: 'lfs-unavailable',
      }
    )
  await git(
    [
      'lfs',
      'install',
      ...(scope === 'global' ? ['--skip-repo'] : []),
      ...(force ? ['--force'] : []),
    ],
    repoPath
  )
  return getLfsStatus(repoPath)
}

async function repairLfs(repoPath, confirmed) {
  if (!confirmed)
    throw Object.assign(
      new Error('Confirm Git LFS repair before changing repository hooks'),
      { statusCode: 400, code: 'confirmation-required' }
    )
  const status = await getLfsStatus(repoPath)
  if (!status.available)
    throw Object.assign(
      new Error('Git LFS is not installed on this computer'),
      {
        statusCode: 501,
        code: 'lfs-unavailable',
      }
    )
  await git(['lfs', 'install', '--local', '--force'], repoPath)
  return getLfsStatus(repoPath)
}

const TASK_RETENTION_MS = 5 * 60 * 1000

function createLfsTaskManager() {
  const tasks = new Map()
  const appendOutput = (task, chunk) => {
    task.output = `${task.output}${chunk}`.slice(-MAX_RESPONSE_BYTES)
    task.progress = lfsProgress(task.output)
  }
  // Fixed TTL eviction (not last-seen/LRU); fine for the handful of
  // concurrent LFS tasks a companion process handles.
  const scheduleEviction = id => {
    const timer = setTimeout(() => tasks.delete(id), TASK_RETENTION_MS)
    timer.unref?.()
  }
  return {
    start(repoPath, command) {
      if (!['pull', 'push', 'fetch'].includes(command))
        throw Object.assign(new Error('Unsupported Git LFS transfer'), {
          statusCode: 400,
        })
      const id = crypto.randomBytes(16).toString('base64url')
      const task = {
        id,
        command,
        status: 'running',
        output: '',
        progress: null,
        child: spawn('git', ['lfs', command], {
          cwd: repoPath,
          shell: false,
          windowsHide: true,
        }),
      }
      task.child.stdout.on('data', chunk => appendOutput(task, String(chunk)))
      task.child.stderr.on('data', chunk => appendOutput(task, String(chunk)))
      task.child.on('error', error => {
        appendOutput(task, `${error.message}\n`)
        task.status = 'failed'
        scheduleEviction(id)
      })
      task.child.on('close', (code, signal) => {
        if (task.status !== 'cancelled') {
          if (signal || code !== 0) task.status = 'failed'
          else task.status = 'completed'
          if (task.progress === null && task.status === 'completed')
            task.progress = 100
        }
        scheduleEviction(id)
      })
      tasks.set(id, task)
      return this.get(id)
    },
    get(id) {
      const task = tasks.get(id)
      if (!task)
        throw Object.assign(new Error('Git LFS operation was not found'), {
          statusCode: 404,
        })
      return {
        id: task.id,
        command: task.command,
        status: task.status,
        output: task.output,
        progress: task.progress,
      }
    },
    cancel(id) {
      const task = tasks.get(id)
      if (!task)
        throw Object.assign(new Error('Git LFS operation was not found'), {
          statusCode: 404,
        })
      if (task.status === 'running') {
        task.status = 'cancelled'
        task.child.kill('SIGTERM')
      }
      return this.get(id)
    },
    cancelAll() {
      for (const task of tasks.values()) {
        if (task.status !== 'running') continue
        task.status = 'cancelled'
        task.child.kill('SIGTERM')
      }
    },
  }
}

function abortError() {
  return Object.assign(new Error('Copilot request was cancelled'), {
    code: 'copilot-cancelled',
    statusCode: 499,
  })
}

function raceWithAbort(promise, signal) {
  if (!signal) return promise
  if (signal.aborted) return Promise.reject(abortError())
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(abortError())
    signal.addEventListener('abort', onAbort, { once: true })
    promise.then(
      value => {
        signal.removeEventListener('abort', onAbort)
        resolve(value)
      },
      error => {
        signal.removeEventListener('abort', onAbort)
        reject(error)
      }
    )
  })
}

function requestAbortSignal(req, res) {
  const controller = new AbortController()
  const abort = () => {
    if (!res.writableEnded) controller.abort()
  }
  req.once('aborted', abort)
  res.once('close', abort)
  return {
    signal: controller.signal,
    dispose() {
      req.removeListener('aborted', abort)
      res.removeListener('close', abort)
    },
  }
}

async function withCopilotClient(token, workingDirectory, callback, signal) {
  let sdk
  try {
    sdk = await import('../app/node_modules/@github/copilot-sdk/dist/index.js')
  } catch {
    throw Object.assign(new Error('GitHub Copilot SDK is unavailable'), {
      statusCode: 501,
      code: 'copilot-unavailable',
    })
  }
  const client = new sdk.CopilotClient({
    gitHubToken: token,
    useLoggedInUser: false,
    workingDirectory,
    logLevel: 'error',
  })
  try {
    const stopOnAbort = () => {
      void client.stop().catch(() => {})
    }
    signal?.addEventListener('abort', stopOnAbort, { once: true })
    try {
      await raceWithAbort(client.start(), signal)
      return await callback(client, signal)
    } finally {
      signal?.removeEventListener('abort', stopOnAbort)
    }
  } finally {
    await client.stop().catch(() => {})
  }
}

function copilotError(error) {
  const message = error instanceof Error ? error.message : String(error)
  const code = /rate.?limit/i.test(message)
    ? 'copilot-rate-limited'
    : /quota|billing|payment required/i.test(message)
    ? 'copilot-quota-exhausted'
    : /content.?filter|content policy/i.test(message)
    ? 'copilot-content-filtered'
    : /auth|credential|401|403/i.test(message)
    ? 'credentials-invalid'
    : /network|connect|timeout|fetch/i.test(message)
    ? 'network-unavailable'
    : 'copilot-generation-failed'
  return Object.assign(new Error(message), { code, statusCode: 502 })
}

async function loadRepositoryPolicies(
  hostingRequestForAccount,
  endpoint,
  token,
  owner,
  repository,
  branch
) {
  const encodedBranch = encodeURIComponent(branch)
  const [user, rulesets, branchRules, ruleSuites] = await Promise.all([
    hostingRequestForAccount(endpoint, token, 'GET', 'user'),
    hostingRequestForAccount(
      endpoint,
      token,
      'GET',
      `repos/${owner}/${repository}/rulesets?includes_parents=true`
    ),
    hostingRequestForAccount(
      endpoint,
      token,
      'GET',
      `repos/${owner}/${repository}/rules/branches/${encodedBranch}`
    ).catch(error =>
      error.code === 'resource-not-found' ? null : Promise.reject(error)
    ),
    hostingRequestForAccount(
      endpoint,
      token,
      'GET',
      `repos/${owner}/${repository}/rulesets/rule-suites?ref=refs/heads/${encodedBranch}&per_page=100`
    ).catch(error =>
      error.code === 'resource-not-found' ? [] : Promise.reject(error)
    ),
  ])
  const normalizedRulesets = (Array.isArray(rulesets) ? rulesets : []).map(
    ruleset => {
      const bypassActor = Array.isArray(ruleset.bypass_actors)
        ? ruleset.bypass_actors.find(
            actor =>
              (actor.actor_type === 'User' && actor.actor_id === user.id) ||
              actor.actor_type === 'OrganizationAdmin'
          )
        : null
      return {
        id: Number(ruleset.id),
        name: String(ruleset.name || `Ruleset ${ruleset.id}`),
        target: String(ruleset.target || 'branch'),
        enforcement: String(ruleset.enforcement || 'active'),
        ruleTypes: Array.isArray(ruleset.rules)
          ? ruleset.rules.map(rule => String(rule.type || 'unknown'))
          : [],
        bypassEligible: Boolean(bypassActor),
        bypassMode: bypassActor?.bypass_mode || null,
        source: String(ruleset.source_type || 'repository'),
      }
    }
  )
  const effectiveRules = Array.isArray(branchRules?.rules)
    ? branchRules.rules.map(rule => String(rule.type || 'unknown'))
    : []
  return {
    branch,
    rulesets: normalizedRulesets,
    effectiveRuleTypes: effectiveRules,
    bypassRequests: (Array.isArray(ruleSuites) ? ruleSuites : [])
      .filter(
        suite =>
          suite.result === 'bypass' || suite.evaluation_result === 'bypass'
      )
      .map(suite => ({
        number: Number(suite.id),
        status: String(suite.result || suite.evaluation_result || 'bypass'),
        comment: String(suite.actor?.login || ''),
        htmlURL: suite.html_url || null,
        violations: Array.isArray(suite.rule_runs)
          ? suite.rule_runs
              .filter(run => run.result === 'fail')
              .map(run => String(run.rule_type || 'repository rule'))
          : [],
      })),
  }
}

function combineGitHubChecks(checkRuns, statuses) {
  const checks = [
    ...checkRuns.map(check => ({
      id: check.id,
      name: check.name,
      description: githubCheckDescription(check),
      status: check.status,
      conclusion: check.conclusion || null,
      appName: check.app?.name || '',
      htmlUrl: check.html_url || null,
      checkSuiteId: check.check_suite?.id || null,
    })),
    ...statuses.map(status => {
      const pending = status.state === 'pending'
      const successful = status.state === 'success'
      return {
        id: status.id,
        name: status.context,
        description: pending
          ? 'In progress'
          : successful
          ? 'Successful'
          : 'Failed',
        status: pending ? 'in_progress' : 'completed',
        conclusion: pending ? null : successful ? 'success' : 'failure',
        appName: '',
        htmlUrl: status.target_url || null,
        checkSuiteId: null,
      }
    }),
  ]
  if (checks.length === 0) return null
  const pending = checks.some(check => check.status !== 'completed')
  const failed = checks.some(
    check =>
      check.status === 'completed' &&
      check.conclusion !== null &&
      check.conclusion !== 'success' &&
      check.conclusion !== 'neutral' &&
      check.conclusion !== 'skipped'
  )
  return {
    status: pending ? 'in_progress' : 'completed',
    conclusion: pending ? null : failed ? 'failure' : 'success',
    checks,
  }
}

function repoPathFrom(url, body = {}) {
  return requireAbsolutePath(
    body.path ||
      body.repoPath ||
      body.workingDirectory ||
      url.searchParams.get('path'),
    'repository path'
  )
}

function requireRepositoryInspectionPath(value) {
  const input = requireString(value, 'repository path', MAX_PATH_LENGTH)
  const expanded =
    input === '~'
      ? os.homedir()
      : input.startsWith(`~${path.sep}`) || input.startsWith('~/')
      ? path.join(os.homedir(), input.slice(2))
      : input
  return requireAbsolutePath(expanded, 'repository path')
}

function repositoryInspectionPathParts(repositoryPath) {
  const normalized =
    repositoryPath.replace(/[\\/]+$/, '') || path.parse(repositoryPath).root
  const separator = Math.max(
    normalized.lastIndexOf('/'),
    normalized.lastIndexOf('\\')
  )
  return {
    repositoryName: path.basename(normalized),
    parentPath:
      separator > 0
        ? normalized.slice(0, separator)
        : path.parse(normalized).root,
  }
}

async function inspectRepository(repositoryPath) {
  const parts = repositoryInspectionPathParts(repositoryPath)
  let stats
  try {
    stats = await fs.promises.stat(repositoryPath)
  } catch (error) {
    if (error.code === 'ENOENT')
      return {
        path: repositoryPath,
        repositoryPath,
        kind: 'missing',
        exists: false,
        isDirectory: false,
        ...parts,
      }
    throw error
  }
  if (!stats.isDirectory())
    return {
      path: repositoryPath,
      repositoryPath,
      kind: 'missing',
      exists: true,
      isDirectory: false,
      ...parts,
    }

  const result = await git(
    ['rev-parse', '--is-bare-repository', '--show-cdup', '--git-dir'],
    repositoryPath,
    [0, 128]
  )
  if (result.exitCode === 0) {
    if (result.stdout.startsWith('true\n'))
      return {
        path: repositoryPath,
        repositoryPath,
        kind: 'bare',
        exists: true,
        isDirectory: true,
        ...parts,
      }
    const topLevel = await git(['rev-parse', '--show-toplevel'], repositoryPath)
    const resolvedPath = path.resolve(topLevel.stdout.trim() || repositoryPath)
    const [requestedRealPath, topLevelRealPath] = await Promise.all([
      fs.promises.realpath(repositoryPath),
      fs.promises.realpath(resolvedPath),
    ])
    return {
      path: repositoryPath,
      repositoryPath: resolvedPath,
      kind: 'regular',
      exists: true,
      isDirectory: true,
      isRepositoryRoot: requestedRealPath === topLevelRealPath,
      ...repositoryInspectionPathParts(resolvedPath),
    }
  }

  const unsafeMatch =
    /fatal: detected dubious ownership in repository at ['"](.+?)['"]/.exec(
      result.stderr
    )
  if (unsafeMatch)
    return {
      path: repositoryPath,
      repositoryPath,
      kind: 'unsafe',
      exists: true,
      isDirectory: true,
      unsafePath: unsafeMatch[1],
      ...parts,
    }
  return {
    path: repositoryPath,
    repositoryPath,
    kind: 'missing',
    exists: true,
    isDirectory: true,
    ...parts,
  }
}

async function trustRepository(repositoryPath) {
  const inspection = await inspectRepository(repositoryPath)
  if (inspection.kind !== 'unsafe')
    throw Object.assign(
      new Error('The selected path is not an unsafe Git repository.'),
      { statusCode: 409 }
    )
  const trustedPath = inspection.unsafePath || repositoryPath
  const existing = await git(
    ['config', '--global', '-z', '--get-all', 'safe.directory'],
    process.cwd(),
    [0, 1]
  )
  const values = existing.stdout.split('\0').filter(Boolean)
  if (values.includes(trustedPath)) return
  await git(
    ['config', '--global', '--add', 'safe.directory', trustedPath],
    process.cwd()
  )
}

function sanitizeRepositoryName(value) {
  const name = value.trim()
  return process.platform === 'win32'
    ? name.replace(/[<>:"|?*]/g, '-').replace(/\s+$/, '')
    : name
}

function repositoryPathFromName(name, parentPath) {
  const sanitizedName = sanitizeRepositoryName(requireString(name, 'name'))
  const normalizedParentPath = requireAbsolutePath(parentPath, 'parent path')
  if (
    sanitizedName.length === 0 ||
    sanitizedName === '.' ||
    sanitizedName === '..' ||
    path.isAbsolute(sanitizedName)
  )
    return {
      repositoryPath: path.join(normalizedParentPath, sanitizedName),
      repositoryName: sanitizedName,
      error:
        'Repository name must identify a directory inside the parent path.',
    }

  const repositoryPath = path.resolve(normalizedParentPath, sanitizedName)
  const relative = path.relative(normalizedParentPath, repositoryPath)
  if (relative === '..' || relative.startsWith(`..${path.sep}`))
    return {
      repositoryPath,
      repositoryName: sanitizedName,
      error:
        'Repository name must identify a directory inside the parent path.',
    }
  return { repositoryPath, repositoryName: sanitizedName, error: null }
}

async function nearestExistingDirectory(directory) {
  let current = path.resolve(directory)
  while (true) {
    try {
      const stats = await fs.promises.stat(current)
      return stats.isDirectory() ? current : path.dirname(current)
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      const parent = path.dirname(current)
      if (parent === current) return current
      current = parent
    }
  }
}

async function inspectRepositoryInitialization(repositoryPath) {
  const warnings = []
  let targetExists = false
  let targetIsDirectory = true
  try {
    const stats = await fs.promises.stat(repositoryPath)
    targetExists = true
    targetIsDirectory = stats.isDirectory()
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }

  let isRepository = false
  let isSubfolderOfRepository = false
  if (targetExists && !targetIsDirectory) {
    warnings.push({
      code: 'invalid-path',
      message: 'The repository path is an existing file.',
    })
  } else {
    const targetGitMetadata = await fs.promises
      .stat(path.join(repositoryPath, '.git'))
      .then(() => true)
      .catch(() => false)
    isRepository = targetExists && targetGitMetadata

    const inspectionPath = await nearestExistingDirectory(repositoryPath)
    const canonicalInspectionPath = await fs.promises.realpath(inspectionPath)
    const canonicalTarget = targetExists
      ? await fs.promises.realpath(repositoryPath)
      : path.resolve(
          canonicalInspectionPath,
          path.relative(inspectionPath, repositoryPath)
        )
    const gitRoot = await git(
      ['rev-parse', '--show-toplevel'],
      inspectionPath,
      [0, 128]
    )
    if (gitRoot.exitCode === 0) {
      const root = await fs.promises
        .realpath(path.resolve(gitRoot.stdout.trim()))
        .catch(() => path.resolve(gitRoot.stdout.trim()))
      isRepository = isRepository || canonicalTarget === root
      isSubfolderOfRepository =
        !isRepository &&
        (canonicalTarget.startsWith(`${root}${path.sep}`) ||
          canonicalInspectionPath.startsWith(`${root}${path.sep}`))
    }
  }

  if (isRepository)
    warnings.push({
      code: 'existing-repository',
      message:
        'This directory is already a Git repository. Add it instead of creating a new one.',
    })
  if (isSubfolderOfRepository)
    warnings.push({
      code: 'subfolder-of-repository',
      message:
        'This directory is inside another Git repository. It will create a nested repository.',
    })

  const readmeExists = targetExists
    ? await fs.promises
        .access(path.join(repositoryPath, 'README.md'))
        .then(() => true)
        .catch(() => false)
    : false
  if (readmeExists)
    warnings.push({
      code: 'readme-overwrite',
      message: 'README.md already exists and will be overwritten.',
    })

  const writablePath = await nearestExistingDirectory(repositoryPath)
  try {
    await fs.promises.access(
      writablePath,
      fs.constants.W_OK | fs.constants.X_OK
    )
  } catch {
    warnings.push({
      code: 'invalid-path',
      message: 'The repository directory cannot be created here.',
    })
  }

  return {
    repositoryPath,
    readmeExists,
    isRepository,
    isSubfolderOfRepository,
    warnings,
    canCreate:
      targetIsDirectory &&
      !warnings.some(warning => warning.code === 'invalid-path') &&
      !isRepository,
  }
}

function repositorySetupOptions() {
  const gitignoreDirectory = path.join(publicDir, 'static', 'gitignore')
  const licensesPath = path.join(publicDir, 'static', 'available-licenses.json')
  const gitignoreNames = fs
    .readdirSync(gitignoreDirectory)
    .filter(file => file.endsWith('.gitignore'))
    .map(file => file.slice(0, -'.gitignore'.length))
    .sort((a, b) => a.localeCompare(b))
  const licenses = JSON.parse(fs.readFileSync(licensesPath, 'utf8'))
    .filter(license => !license.hidden)
    .map(license => ({
      name: license.name,
      featured: license.featured === true,
    }))
    .sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  const home = os.homedir()
  return {
    defaultParentPath: path.join(home, 'Documents', 'GitHub'),
    gitignoreNames,
    licenses,
  }
}

async function previewRepositoryInitialization(body) {
  const name = requireString(body.name, 'name')
  const parentPath = requireAbsolutePath(body.parentPath, 'parent path')
  const resolved = repositoryPathFromName(name, parentPath)
  if (resolved.error)
    return {
      repositoryPath: resolved.repositoryPath,
      repositoryName: resolved.repositoryName,
      canCreate: false,
      readmeExists: false,
      isRepository: false,
      isSubfolderOfRepository: false,
      warnings: [{ code: 'invalid-path', message: resolved.error }],
    }
  const inspection = await inspectRepositoryInitialization(
    resolved.repositoryPath
  )
  return {
    repositoryPath: inspection.repositoryPath,
    repositoryName: resolved.repositoryName,
    canCreate: inspection.canCreate,
    readmeExists: inspection.readmeExists,
    isRepository: inspection.isRepository,
    isSubfolderOfRepository: inspection.isSubfolderOfRepository,
    warnings: inspection.warnings.filter(
      warning =>
        body.createReadme !== false || warning.code !== 'readme-overwrite'
    ),
  }
}

function cloneRepositoryName(repositoryURL) {
  const value = repositoryURL.trim()
  if (path.isAbsolute(value)) {
    const localName = path.basename(value.replace(/[\\/]+$/, ''))
    return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(localName) ? localName : null
  }
  const scpLike = /^(?:[^@/\s]+@)?[^:/\s]+:(.+)$/.exec(value)
  let candidate = scpLike ? scpLike[1] : ''
  if (!candidate) {
    try {
      const parsed = new URL(value)
      if (!['http:', 'https:', 'ssh:', 'git:'].includes(parsed.protocol))
        return null
      candidate = parsed.pathname
    } catch {
      return null
    }
  }
  const name =
    candidate
      .replace(/[\\/]+$/, '')
      .split(/[\\/]/)
      .pop() || ''
  const withoutGit = name.replace(/\.git$/i, '')
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(withoutGit) ? withoutGit : null
}

function validateCloneURL(repositoryURL) {
  const value = requireGitValue(repositoryURL, 'URL')
  if (path.isAbsolute(value)) return path.normalize(value)
  const scpLike = /^(?:[^@/\s]+@)?[^:/\s]+:[^\s]+$/.test(value)
  if (scpLike) return value
  let parsed
  try {
    parsed = new URL(value)
  } catch {
    throw Object.assign(new Error('The repository URL is invalid.'), {
      statusCode: 400,
      code: 'invalid-url',
    })
  }
  if (!['http:', 'https:', 'ssh:', 'git:'].includes(parsed.protocol)) {
    throw Object.assign(
      new Error('The repository URL must use HTTPS, SSH, or the Git protocol.'),
      { statusCode: 400, code: 'invalid-url' }
    )
  }
  if (!parsed.hostname) {
    throw Object.assign(new Error('The repository URL is invalid.'), {
      statusCode: 400,
      code: 'invalid-url',
    })
  }
  return value
}

async function previewCloneRepository(body) {
  const warnings = []
  let repositoryURL = ''
  try {
    repositoryURL = validateCloneURL(body.url)
  } catch (error) {
    warnings.push({ code: 'invalid-url', message: error.message })
    repositoryURL = typeof body.url === 'string' ? body.url.trim() : ''
  }

  let destinationPath = ''
  try {
    destinationPath = requireAbsolutePath(body.path, 'destination path')
  } catch (error) {
    warnings.push({ code: 'invalid-path', message: error.message })
  }

  if (destinationPath) {
    try {
      const stats = await fs.promises.stat(destinationPath)
      if (!stats.isDirectory()) {
        warnings.push({
          code: 'existing-file',
          message: 'The clone destination is an existing file.',
        })
      } else if ((await fs.promises.readdir(destinationPath)).length > 0) {
        warnings.push({
          code: 'destination-not-empty',
          message: 'The clone destination must be an empty directory.',
        })
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      const parentPath = await nearestExistingDirectory(destinationPath)
      try {
        await fs.promises.access(
          parentPath,
          fs.constants.W_OK | fs.constants.X_OK
        )
      } catch {
        warnings.push({
          code: 'invalid-path',
          message: 'The clone destination cannot be created here.',
        })
      }
    }
  }

  return {
    repositoryURL,
    destinationPath,
    repositoryName: cloneRepositoryName(repositoryURL) || 'repository',
    canClone: warnings.length === 0,
    warnings,
  }
}

function replaceLicenseTokens(body, fields) {
  let result = body
  for (const [token, value] of Object.entries(fields)) {
    result = result
      .replace(new RegExp(`\\[${token}\\]`, 'g'), `{${token}}`)
      .replace(new RegExp(`\\{${token}\\}`, 'g'), value)
  }
  return result
}

async function createRepositoryFiles(repositoryPath, repositoryName, body) {
  const description =
    body.description === undefined
      ? ''
      : requireText(body.description, 'description')
  if (body.createReadme === true)
    await fs.promises.writeFile(
      path.join(repositoryPath, 'README.md'),
      `# ${repositoryName}\n${description}\n`,
      'utf8'
    )

  const gitignoreName =
    body.gitignore === null || body.gitignore === undefined
      ? null
      : requireString(body.gitignore, 'gitignore')
  if (gitignoreName) {
    const gitignorePath = path.join(
      publicDir,
      'static',
      'gitignore',
      `${gitignoreName}.gitignore`
    )
    const gitignoreRoot = path.resolve(
      path.join(publicDir, 'static', 'gitignore')
    )
    if (!path.resolve(gitignorePath).startsWith(`${gitignoreRoot}${path.sep}`))
      throw Object.assign(new Error('gitignore selection is invalid'), {
        statusCode: 400,
      })
    await fs.promises.access(gitignorePath)
    await fs.promises.copyFile(
      gitignorePath,
      path.join(repositoryPath, '.gitignore')
    )
  }

  if (description)
    await fs.promises.writeFile(
      path.join(repositoryPath, '.git', 'description'),
      description,
      'utf8'
    )

  const licenseName =
    body.license === null || body.license === undefined
      ? null
      : requireString(body.license, 'license')
  if (licenseName) {
    const licenses = JSON.parse(
      await fs.promises.readFile(
        path.join(publicDir, 'static', 'available-licenses.json'),
        'utf8'
      )
    )
    const license = licenses.find(item => item.name === licenseName)
    if (!license)
      throw Object.assign(new Error('license selection is invalid'), {
        statusCode: 400,
      })
    const authorName = (
      await git(['config', '--get', 'user.name'], repositoryPath, [0, 1])
    ).stdout.trim()
    const authorEmail = (
      await git(['config', '--get', 'user.email'], repositoryPath, [0, 1])
    ).stdout.trim()
    await fs.promises.writeFile(
      path.join(repositoryPath, 'LICENSE'),
      replaceLicenseTokens(license.body, {
        fullname: authorName,
        email: authorEmail,
        project: repositoryName,
        description: '',
        year: String(new Date().getFullYear()),
      }),
      'utf8'
    )
  }

  const attributesPath = path.join(repositoryPath, '.gitattributes')
  if (
    !(await fs.promises
      .access(attributesPath)
      .then(() => true)
      .catch(() => false))
  )
    await fs.promises.writeFile(
      attributesPath,
      '# Auto detect text files and perform LF normalization\n* text=auto\n',
      'utf8'
    )
}

function escapeGitIgnorePath(value) {
  return value.replace(/[\[\]!\*\#\?]/g, match => `\\${match}`)
}

function repositoryFilePath(repoPath, filePath) {
  const normalized = String(filePath).replaceAll('\\', '/')
  const absolute = path.resolve(repoPath, normalized)
  const root = path.resolve(repoPath)
  if (
    path.isAbsolute(normalized) ||
    (absolute !== root && !absolute.startsWith(`${root}${path.sep}`))
  )
    throw Object.assign(
      new Error(`file path is outside the repository: ${filePath}`),
      { statusCode: 400 }
    )
  return absolute
}

function textLines(contents) {
  if (contents.includes('\0')) return null
  return contents.split(/\r?\n/)
}

async function readGitTextFile(repoPath, commitish, filePath) {
  const sizeResult = await git(
    ['cat-file', '-s', `${commitish}:${filePath}`],
    repoPath,
    [0, 1, 128]
  )
  if (sizeResult.exitCode !== 0) return null
  const size = Number(sizeResult.stdout.trim())
  if (!Number.isSafeInteger(size) || size > MAX_FILE_CONTENT_BYTES)
    return { lines: [], canBeExpanded: false }
  const result = await git(
    ['show', `${commitish}:${filePath}`],
    repoPath,
    [0, 1]
  )
  const lines = textLines(result.stdout)
  return {
    lines: lines || [],
    canBeExpanded: lines !== null && size <= MAX_FILE_CONTENT_BYTES - 1,
  }
}

async function readWorkingTextFile(repoPath, filePath) {
  const file = repositoryFilePath(repoPath, filePath)
  let stats
  try {
    stats = await fs.promises.stat(file)
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
  if (!stats.isFile()) return null
  if (stats.size > MAX_FILE_CONTENT_BYTES)
    return { lines: [], canBeExpanded: false }
  const contents = await fs.promises.readFile(file, 'utf8')
  const lines = textLines(contents)
  return {
    lines: lines || [],
    canBeExpanded: lines !== null && stats.size <= MAX_FILE_CONTENT_BYTES - 1,
  }
}

function imageMediaType(filePath) {
  return IMAGE_MEDIA_TYPES[path.extname(filePath).toLowerCase()] || null
}

async function readGitBinaryFile(repoPath, commitish, filePath) {
  const result = await dugite.exec(
    ['show', `${commitish}:${filePath}`],
    repoPath,
    {
      encoding: 'buffer',
      maxBuffer: MAX_FILE_CONTENT_BYTES + 1,
    }
  )
  if (result.exitCode !== 0 || result.stdout.length > MAX_FILE_CONTENT_BYTES)
    return null
  return result.stdout
}

async function readWorkingBinaryFile(repoPath, filePath) {
  const file = repositoryFilePath(repoPath, filePath)
  let stats
  try {
    stats = await fs.promises.stat(file)
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
  if (!stats.isFile() || stats.size > MAX_FILE_CONTENT_BYTES) return null
  return fs.promises.readFile(file)
}

async function getDiffImage(
  repoPath,
  filePath,
  oldCommitish,
  newCommitish,
  workingPath = null,
  oldPath = filePath
) {
  const mediaType = imageMediaType(filePath)
  if (!mediaType) return null
  const [oldContents, newContents] = await Promise.all([
    oldCommitish ? readGitBinaryFile(repoPath, oldCommitish, oldPath) : null,
    newCommitish
      ? readGitBinaryFile(repoPath, newCommitish, filePath)
      : readWorkingBinaryFile(repoPath, workingPath || filePath),
  ])
  if (!oldContents && !newContents) return null
  return {
    ...(oldContents
      ? {
          previous: {
            contents: oldContents.toString('base64'),
            mediaType,
            bytes: oldContents.length,
          },
        }
      : {}),
    ...(newContents
      ? {
          current: {
            contents: newContents.toString('base64'),
            mediaType,
            bytes: newContents.length,
          },
        }
      : {}),
  }
}

async function getDiffFileContents(
  repoPath,
  filePath,
  oldCommitish,
  newCommitish,
  oldPath = filePath,
  workingPath = null
) {
  const [oldContents, newContents] = await Promise.all([
    readGitTextFile(repoPath, oldCommitish, oldPath),
    newCommitish
      ? readGitTextFile(repoPath, newCommitish, filePath)
      : readWorkingTextFile(repoPath, workingPath || filePath),
  ])
  return {
    oldContents: oldContents?.lines || [],
    newContents: newContents?.lines || [],
    canBeExpanded: Boolean(newContents?.canBeExpanded),
  }
}

function requireGitIgnoreEntry(value) {
  const result = requireString(value, 'gitignore path')
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\r\n]/u.test(result))
    throw Object.assign(
      new Error('gitignore path contains invalid characters'),
      {
        statusCode: 400,
      }
    )
  return result
}

async function appendGitIgnore(repoPath, body) {
  if (body.kind !== 'file' && body.kind !== 'pattern')
    throw Object.assign(new Error('gitignore kind must be file or pattern'), {
      statusCode: 400,
    })
  if (!Array.isArray(body.paths) || body.paths.length === 0)
    throw Object.assign(new Error('gitignore paths are required'), {
      statusCode: 400,
    })
  if (body.paths.length > 100)
    throw Object.assign(new Error('Too many gitignore paths'), {
      statusCode: 400,
    })

  const paths = body.paths.map(requireGitIgnoreEntry)
  const entries = paths.map(value => {
    if (body.kind === 'pattern') return value
    const normalized = value.replaceAll('\\', '/')
    const absolute = path.resolve(repoPath, normalized)
    const root = path.resolve(repoPath)
    if (
      path.isAbsolute(normalized) ||
      (absolute !== root && !absolute.startsWith(`${root}${path.sep}`))
    )
      throw Object.assign(
        new Error(`gitignore file is outside the repository: ${value}`),
        { statusCode: 400 }
      )
    return escapeGitIgnorePath(normalized)
  })

  const ignorePath = path.join(repoPath, '.gitignore')
  let current = ''
  try {
    current = await fs.promises.readFile(ignorePath, 'utf8')
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  const prefix =
    current === '' || current.endsWith('\n') ? current : `${current}\n`
  await fs.promises.writeFile(
    ignorePath,
    `${prefix}${entries.join('\n')}\n`,
    'utf8'
  )
  return getStatus(repoPath)
}

async function readGitIgnore(repoPath) {
  try {
    return {
      text: await fs.promises.readFile(
        path.join(repoPath, '.gitignore'),
        'utf8'
      ),
    }
  } catch (error) {
    if (error.code === 'ENOENT') return { text: null }
    throw error
  }
}

async function saveGitIgnore(repoPath, text) {
  const ignorePath = path.join(repoPath, '.gitignore')
  if (text === '') {
    await fs.promises.unlink(ignorePath).catch(error => {
      if (error.code !== 'ENOENT') throw error
    })
  } else {
    await fs.promises.writeFile(ignorePath, text, 'utf8')
  }
  return getStatus(repoPath)
}

async function git(
  args,
  repoPath,
  successExitCodes = [0],
  stdin,
  env,
  timeoutMs
) {
  if (!dugite) throw new Error('dugite is unavailable')
  const task = operationContext.getStore()
  if (task) task.beginCommand(args)
  let timedOut = false
  let timeout = null
  const options = {
    ...(stdin === undefined ? {} : { stdin }),
    ...(env === undefined ? {} : { env }),
    ...(task || timeoutMs
      ? {
          processCallback: process => {
            task?.attachProcess(process)
            if (timeoutMs)
              timeout = setTimeout(() => {
                timedOut = true
                void terminateProcessTree(process).catch(() => undefined)
              }, timeoutMs)
          },
        }
      : {}),
  }
  let result
  try {
    result = await dugite.exec(
      args,
      repoPath,
      Object.keys(options).length ? options : undefined
    )
  } catch (error) {
    if (timedOut)
      throw Object.assign(new Error(`git ${args[0]} timed out`), {
        statusCode: 504,
        code: 'git-timeout',
      })
    if (
      (error.code === 'ENOENT' || error.cause?.code === 'ENOENT') &&
      !(await fs.promises
        .stat(repoPath)
        .then(stats => stats.isDirectory())
        .catch(() => false))
    )
      throw Object.assign(new Error('The repository path no longer exists.'), {
        statusCode: 404,
        code: 'missing-repository',
      })
    if (error.code === 'ENOENT' || error.cause?.code === 'ENOENT')
      throw Object.assign(
        new Error(
          'Git could not be started. Install Git with the Xcode Command Line Tools, then restart Desktop Plus.'
        ),
        {
          statusCode: 503,
          code: 'missing-git',
        }
      )
    throw error
  } finally {
    if (timeout !== null) clearTimeout(timeout)
  }
  if (timedOut)
    throw Object.assign(new Error(`git ${args[0]} timed out`), {
      statusCode: 504,
      code: 'git-timeout',
    })
  if (result.stdout.length + result.stderr.length > MAX_RESPONSE_BYTES) {
    throw Object.assign(new Error('Git output is too large'), {
      statusCode: 413,
    })
  }
  if (!successExitCodes.includes(result.exitCode)) {
    const detail = `${result.stdout || ''}\n${result.stderr || ''}`
    const configLockScope =
      args[0] === 'config'
        ? args.includes('--local')
          ? 'local'
          : args.includes('--global')
          ? 'global'
          : null
        : null
    if (
      configLockScope &&
      /(?:unable to|could not|cannot) (?:lock|write) config file\b/i.test(
        detail
      ) &&
      /(?:file exists|another process|permission denied|access is denied)/i.test(
        detail
      )
    ) {
      throw Object.assign(
        new Error(
          `The ${configLockScope} Git config is locked. Close other Git configuration editors, then recover the stale lock before retrying.`
        ),
        {
          statusCode: 409,
          code: 'git-config-locked',
          configLockScope,
          result,
        }
      )
    }
    const hookMatch =
      /\b((?:pre|post|prepare)-[a-z0-9-]+|commit-msg)\s+hook\s+(?:failed|declined)\b/i.exec(
        detail
      )
    let hookName = hookMatch?.[1]?.toLowerCase() || null
    if (!hookName && args.includes('commit')) {
      const hooksDirectory = path.join(repoPath, '.git', 'hooks')
      for (const candidate of [
        'pre-commit',
        'commit-msg',
        'prepare-commit-msg',
      ]) {
        const candidatePath = path.join(hooksDirectory, candidate)
        if (
          await fs.promises
            .stat(candidatePath)
            .then(stats => stats.isFile())
            .catch(() => false)
        ) {
          hookName = candidate
          break
        }
      }
    }
    const remoteHookFailure =
      /(?:^|\n)\s*remote:\s*(?:[^\n]*\n\s*remote:\s*)*(?:pre-receive|update|post-receive)\s+hook\s+(?:failed|declined)\b/i.test(
        detail
      )
    throw Object.assign(
      new Error(
        result.stderr.trim() || `git ${args[0]} exited with ${result.exitCode}`
      ),
      {
        statusCode: 400,
        result,
        ...(hookName &&
        !['pre-receive', 'update', 'post-receive'].includes(hookName) &&
        !remoteHookFailure
          ? {
              code: 'hook-failed',
              hookFailure: {
                hookName,
                terminalOutput: detail.trim().slice(-256 * 1024),
              },
            }
          : {}),
      }
    )
  }
  return result
}

function sanitizeOperationText(value) {
  return String(value || '')
    .replace(
      /(https?:\/\/)([^@\s/:]+):([^@\s]+)@/gi,
      '$1[credentials redacted]@'
    )
    .replace(
      /\b(?:ghp|gho|ghu|ghs|ghr|glpat|github_pat)_[A-Za-z0-9_]+/g,
      '[token redacted]'
    )
    .replace(
      /(\b(?:authorization|password|token|oauth_token)\s*[:=]\s*)(\S+)/gi,
      '$1[redacted]'
    )
    .slice(-MAX_RESPONSE_BYTES)
}

function listProcessDescendants(rootPid) {
  return new Promise(resolve => {
    execFile(
      'ps',
      ['-axo', 'pid=,ppid='],
      { encoding: 'utf8' },
      (error, stdout) => {
        if (error) return resolve([])
        const children = new Map()
        for (const line of stdout.split(/\r?\n/)) {
          const match = /^\s*(\d+)\s+(\d+)\s*$/.exec(line)
          if (!match) continue
          const pid = Number(match[1])
          const parentPid = Number(match[2])
          if (!children.has(parentPid)) children.set(parentPid, [])
          children.get(parentPid).push(pid)
        }
        const descendants = []
        const pending = [rootPid]
        while (pending.length) {
          const parentPid = pending.shift()
          for (const childPid of children.get(parentPid) || []) {
            descendants.push(childPid)
            pending.push(childPid)
          }
        }
        resolve(descendants.reverse())
      }
    )
  })
}

async function terminateProcessTree(child) {
  const descendants = await listProcessDescendants(child.pid)
  for (const pid of descendants) {
    try {
      process.kill(pid, 'SIGTERM')
    } catch {}
  }
  try {
    child.kill('SIGTERM')
  } catch {}
  await new Promise(resolve => setTimeout(resolve, 250))
  for (const pid of [child.pid, ...descendants]) {
    try {
      process.kill(pid, 'SIGKILL')
    } catch {}
  }
}

function operationTaskError(error) {
  const result =
    error && typeof error === 'object' && error.result ? error.result : null
  return {
    error: sanitizeOperationText(
      error instanceof Error ? error.message : String(error)
    ),
    errorCode:
      error && typeof error === 'object' && typeof error.code === 'string'
        ? error.code
        : null,
    hookFailure:
      error && typeof error === 'object' && error.hookFailure
        ? {
            ...error.hookFailure,
            terminalOutput: sanitizeOperationText(
              error.hookFailure.terminalOutput
            ),
          }
        : null,
    configLockScope:
      error && typeof error === 'object' && error.configLockScope
        ? error.configLockScope
        : null,
    bypassURL:
      error && typeof error === 'object' && error.bypassURL
        ? error.bypassURL
        : null,
    result: result
      ? {
          ...result,
          stdout: sanitizeOperationText(result.stdout),
          stderr: sanitizeOperationText(result.stderr),
        }
      : null,
  }
}

function parseSSHAuthPrompt(prompt) {
  const text = String(prompt || '')
  const host =
    /^The authenticity of host '([^ ]+) \(([^)]+)\)' can't be established[^.]*\.\s*([^ ]+) key fingerprint is ([^.]+)\./s.exec(
      text
    )
  if (host)
    return {
      type: 'host',
      host: host[1],
      ip: host[2],
      keyType: host[3],
      fingerprint: host[4],
    }
  const passphrase = /^Enter passphrase for key '(.+?)':\s*$/s.exec(text)
  if (passphrase) return { type: 'passphrase', keyPath: passphrase[1] }
  const password = /^(.+@.+)'s password:\s*$/s.exec(text)
  if (password) return { type: 'password', username: password[1] }
  return null
}

function sshCredentialAccount(prompt) {
  if (prompt.type === 'passphrase') return `passphrase:${prompt.keyPath}`
  if (prompt.type === 'password') return `password:${prompt.username}`
  return null
}

function createOperationTaskManager(services) {
  const tasks = new Map()
  const retentionMs = 5 * 60 * 1000
  const scheduleEviction = id => {
    const timer = setTimeout(() => tasks.delete(id), retentionMs)
    timer.unref?.()
  }
  const snapshot = task => ({
    id: task.id,
    operation: task.operation,
    status: task.status,
    phase: task.phase,
    output: sanitizeOperationText(task.output),
    progress: task.progress,
    position: task.position,
    totalCommitCount: task.totalCommitCount,
    currentCommit: task.currentCommit,
    currentCommitSummary: task.currentCommitSummary,
    result: task.result
      ? {
          ...task.result,
          stdout: sanitizeOperationText(task.result.stdout),
          stderr: sanitizeOperationText(task.result.stderr),
        }
      : null,
    error: task.error,
    errorCode: task.errorCode,
    hookFailure: task.hookFailure
      ? {
          ...task.hookFailure,
          terminalOutput: sanitizeOperationText(
            task.hookFailure.terminalOutput
          ),
        }
      : null,
    configLockScope: task.configLockScope,
    bypassURL: task.bypassURL,
    authPrompt: task.authPrompt,
  })
  const get = id => {
    const task = tasks.get(id)
    if (!task)
      throw Object.assign(new Error('Git operation was not found'), {
        statusCode: 404,
      })
    return snapshot(task)
  }
  const start = (repoPath, body) => {
    const id = crypto.randomBytes(16).toString('base64url')
    const requestedCommits = (
      Array.isArray(body.values) && body.values.length
        ? body.values
        : Array.isArray(body.commits)
        ? body.commits
        : []
    ).filter(value => typeof value === 'string' && value)
    const initialCommitProgress =
      ['cherry-pick', 'reorder-commits', 'squash-commits'].includes(
        body.operation
      ) && requestedCommits.length
        ? {
            position: 1,
            totalCommitCount: requestedCommits.length,
            currentCommit: requestedCommits[0],
            progress: Math.round(100 / requestedCommits.length),
          }
        : {
            position: null,
            totalCommitCount: null,
            currentCommit: null,
            progress: null,
          }
    const task = {
      id,
      operation: body.operation,
      status: 'running',
      phase: `Starting ${body.operation}`,
      output: '',
      progress: initialCommitProgress.progress,
      position: initialCommitProgress.position,
      totalCommitCount: initialCommitProgress.totalCommitCount,
      currentCommit: initialCommitProgress.currentCommit,
      currentCommitSummary: null,
      result: null,
      error: null,
      errorCode: null,
      hookFailure: null,
      configLockScope: null,
      bypassURL: null,
      authToken: crypto.randomBytes(24).toString('base64url'),
      authPrompt: null,
      authWaiter: null,
      authStoredAccounts: new Set(),
      processes: new Set(),
      cancelled: false,
      beginCommand(args) {
        const command = args.filter(arg => arg !== '--').join(' ')
        task.phase = command ? `Running git ${command}` : 'Running Git'
        const percent = /(?:^|\s)(\d{1,3})%/.exec(task.output)
        task.progress = percent
          ? Math.min(Number(percent[1]), 100)
          : task.progress
      },
      setCommitProgress(position, totalCommitCount, currentCommit = null) {
        if (
          Number.isInteger(position) &&
          position > 0 &&
          Number.isInteger(totalCommitCount) &&
          totalCommitCount > 0
        ) {
          task.position = Math.min(position, totalCommitCount)
          task.totalCommitCount = totalCommitCount
          task.progress = Math.round(
            (task.position / task.totalCommitCount) * 100
          )
        }
        if (currentCommit) task.currentCommit = currentCommit
      },
      async requestAuth(prompt) {
        const parsed = parseSSHAuthPrompt(prompt)
        if (!parsed) return Promise.resolve('')
        const account = sshCredentialAccount(parsed)
        if (account && typeof services?.keytar?.getPassword === 'function') {
          try {
            const stored = await services.keytar.getPassword(
              SSH_CREDENTIAL_SERVICE,
              account
            )
            if (stored) {
              task.authStoredAccounts.add(account)
              return stored
            }
          } catch {}
        }
        if (task.authWaiter) return Promise.resolve('')
        task.authPrompt = parsed
        task.phase = 'Waiting for SSH credentials'
        return new Promise(resolve => {
          const timeout = setTimeout(() => {
            if (!task.authWaiter) return
            task.authWaiter = null
            task.authPrompt = null
            resolve('')
          }, SSH_AUTH_PROMPT_TIMEOUT_MS)
          timeout.unref?.()
          task.authWaiter = response => {
            clearTimeout(timeout)
            task.authWaiter = null
            task.authPrompt = null
            resolve(response)
          }
        })
      },
      async respondAuth(token, response, remember = false) {
        if (token !== task.authToken)
          throw Object.assign(new Error('Invalid SSH authentication token'), {
            statusCode: 403,
          })
        if (!task.authWaiter || !task.authPrompt)
          throw Object.assign(
            new Error('No SSH authentication prompt is pending'),
            {
              statusCode: 409,
            }
          )
        const answer = typeof response === 'string' ? response : ''
        const account = sshCredentialAccount(task.authPrompt)
        if (
          remember &&
          account &&
          answer &&
          typeof services?.keytar?.setPassword === 'function'
        ) {
          try {
            await services.keytar.setPassword(
              SSH_CREDENTIAL_SERVICE,
              account,
              answer
            )
          } catch {}
        }
        task.authWaiter(answer)
        return snapshot(task)
      },
      attachProcess(child) {
        task.processes.add(child)
        const append = chunk => {
          task.output = `${task.output}${String(chunk)}`.slice(
            -MAX_RESPONSE_BYTES
          )
          const matches = [...task.output.matchAll(/(?:^|\s)(\d{1,3})%/g)]
          if (matches.length)
            task.progress = Math.min(
              Number(matches[matches.length - 1][1]),
              100
            )
          const rebaseProgress =
            /(?:Rebasing|Applying)\s+\((\d+)\s*\/\s*(\d+)\)/i.exec(task.output)
          if (rebaseProgress)
            task.setCommitProgress(
              Number(rebaseProgress[1]),
              Number(rebaseProgress[2])
            )
        }
        child.stdout?.on('data', append)
        child.stderr?.on('data', append)
        child.once('close', () => task.processes.delete(child))
        child.once('error', () => task.processes.delete(child))
        if (task.cancelled) void terminateProcessTree(child)
      },
    }
    tasks.set(id, task)
    const monitor = setInterval(() => {
      if (task.status !== 'running') {
        clearInterval(monitor)
        return
      }
      void operationContext.run(null, async () => {
        try {
          const status = await getStatus(repoPath, { noOptionalLocks: true })
          const operationState = status.operationState
          if (operationState?.position && operationState.totalCommitCount)
            task.setCommitProgress(
              operationState.position,
              operationState.totalCommitCount,
              operationState.currentCommit
            )
        } catch {}
      })
    }, 250)
    monitor.unref?.()
    Promise.resolve()
      .then(() =>
        operationContext.run(task, () =>
          runOperationWithClassification(repoPath, body, services)
        )
      )
      .then(result => {
        if (task.cancelled) {
          task.status = 'cancelled'
          task.phase = 'Cancelled'
        } else {
          task.status = 'completed'
          task.phase = 'Completed'
          task.progress = 100
          task.result = result
        }
        for (const child of task.processes) task.processes.delete(child)
        clearInterval(monitor)
        scheduleEviction(id)
      })
      .catch(async error => {
        if (task.authWaiter) task.authWaiter('')
        const details = operationTaskError(error)
        if (
          details.errorCode === 'authentication-required' &&
          typeof services?.keytar?.deletePassword === 'function'
        ) {
          await Promise.all(
            [...task.authStoredAccounts].map(account =>
              services.keytar
                .deletePassword(SSH_CREDENTIAL_SERVICE, account)
                .catch(() => false)
            )
          )
        }
        task.status = task.cancelled ? 'cancelled' : 'failed'
        task.phase = task.cancelled ? 'Cancelled' : 'Failed'
        task.error = task.cancelled ? null : details.error
        task.errorCode = task.cancelled
          ? 'operation-cancelled'
          : details.errorCode
        task.hookFailure = task.cancelled ? null : details.hookFailure
        task.configLockScope = task.cancelled ? null : details.configLockScope
        task.bypassURL = task.cancelled ? null : details.bypassURL
        task.result = task.cancelled ? null : details.result
        clearInterval(monitor)
        scheduleEviction(id)
      })
    return get(id)
  }
  const cancel = id => {
    const task = tasks.get(id)
    if (!task)
      throw Object.assign(new Error('Git operation was not found'), {
        statusCode: 404,
      })
    if (task.status === 'running') {
      task.cancelled = true
      task.phase = 'Cancelling'
      for (const child of task.processes) void terminateProcessTree(child)
    }
    return get(id)
  }
  const requestAuth = async (id, token, prompt) => {
    const task = tasks.get(id)
    if (!task)
      throw Object.assign(new Error('Git operation was not found'), {
        statusCode: 404,
      })
    if (token !== task.authToken)
      throw Object.assign(new Error('Invalid SSH authentication token'), {
        statusCode: 403,
      })
    return task.requestAuth(prompt)
  }
  const respondAuth = (id, response, remember = false) => {
    const task = tasks.get(id)
    if (!task)
      throw Object.assign(new Error('Git operation was not found'), {
        statusCode: 404,
      })
    return task.respondAuth(task.authToken, response, remember)
  }
  return {
    start,
    get,
    cancel,
    requestAuth,
    respondAuth,
    cancelAll: () => {
      for (const task of tasks.values()) {
        if (task.status !== 'running') continue
        task.cancelled = true
        for (const child of task.processes) void terminateProcessTree(child)
      }
    },
  }
}

async function runOperationWithClassification(repoPath, body, services) {
  try {
    return await runOperation(repoPath, body, services)
  } catch (error) {
    if (
      [
        'fetch',
        'fetch-refspec',
        'pull',
        'push',
        'publish-branch',
        'delete-remote-branch',
        'delete-remote-tag',
        'remote-add',
      ].includes(body.operation)
    )
      throw classifyGitRemoteError(error, body.operation)
    if (body.operation === 'submodule-update')
      throw classifySubmoduleError(error)
    throw error
  }
}

async function configuredOriginURL(repoPath) {
  const configured = await git(
    ['config', '--get', 'remote.origin.url'],
    repoPath,
    [0, 1]
  )
  if (configured.exitCode === 0 && configured.stdout.trim())
    return configured.stdout.trim()
  return (await git(['remote', 'get-url', 'origin'], repoPath)).stdout.trim()
}

async function configuredRemoteURL(repoPath, remoteName = null) {
  let name = remoteName
  if (!name) {
    const branch = (
      await git(['branch', '--show-current'], repoPath)
    ).stdout.trim()
    if (branch) {
      const configured = await git(
        ['config', '--get', `branch.${branch}.remote`],
        repoPath,
        [0, 1]
      )
      if (configured.exitCode === 0 && configured.stdout.trim())
        name = configured.stdout.trim()
    }
  }
  if (!name) {
    const remotes = (await git(['remote'], repoPath)).stdout
      .split(/\r?\n/)
      .filter(Boolean)
    name = remotes.includes('origin') ? 'origin' : remotes[0] || null
  }
  if (!name) return null
  return name === 'origin' || !name
    ? configuredOriginURL(repoPath)
    : (await git(['remote', 'get-url', name], repoPath)).stdout.trim()
}

async function configuredBranchRemoteURL(repoPath, branchName) {
  const configured = await git(
    ['config', '--get', `branch.${branchName}.remote`],
    repoPath,
    [0, 1]
  )
  if (configured.exitCode !== 0 || !configured.stdout.trim()) return null
  return configuredRemoteURL(repoPath, configured.stdout.trim())
}

function gitHubRemoteMatchesEndpoint(remoteURL, endpoint) {
  let remote
  let api
  try {
    remote = new URL(remoteURL)
    api = new URL(normalizeGitHubEndpoint(endpoint))
  } catch {
    return false
  }
  if (!['http:', 'https:'].includes(remote.protocol)) return false
  const apiHost =
    api.hostname.toLowerCase() === 'api.github.com'
      ? 'github.com'
      : api.hostname.toLowerCase()
  return (
    remote.hostname.toLowerCase() === apiHost &&
    (api.port === '' || remote.port === api.port)
  )
}

async function getRecentBranchNames(repoPath, limit = 6) {
  const result = await git(
    [
      'log',
      '-g',
      '--no-abbrev-commit',
      '--pretty=oneline',
      'HEAD',
      '-n',
      '2500',
      '--',
    ],
    repoPath,
    [0, 128]
  )
  if (result.exitCode === 128) return []

  const regex =
    /.*?\s(renamed|checkout)(?:: moving from|\s*)\s(?:refs\/heads\/|\s*)(.*?)\s+to\s+(?:refs\/heads\/|\s*)(.*?)$/i
  const names = new Set()
  const excludedNames = new Set()

  for (const line of result.stdout.split(/\r?\n/)) {
    const match = regex.exec(line)
    if (!match) continue
    const [, operationType, oldName, newName] = match
    const from = oldName.trim()
    const to = newName.trim()
    if (!to) continue
    if (operationType.toLowerCase() === 'renamed' && from) {
      excludedNames.add(from)
    }
    if (!excludedNames.has(to)) names.add(to)
    if (names.size >= limit) break
  }
  return [...names]
}

async function getDefaultBranchName(repoPath, branches, current) {
  const symbolicHead = await git(
    ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD'],
    repoPath,
    [0, 1, 128]
  )
  if (symbolicHead.exitCode === 0) {
    const name = symbolicHead.stdout.trim().replace(/^origin\//, '')
    if (
      branches.some(branch => branch.type === 'Local' && branch.name === name)
    )
      return name
  }

  for (const candidate of ['main', 'master']) {
    if (
      branches.some(
        branch => branch.type === 'Local' && branch.name === candidate
      )
    )
      return candidate
  }

  return null
}

async function gitOperationRemoteURL(repoPath, body, operation, values) {
  if (operation === 'clone') return body.url ? String(body.url) : null
  if (operation === 'remote-add') return values[1] || null
  if (operation === 'publish-branch' || operation === 'delete-remote-branch')
    return configuredRemoteURL(repoPath, values[0] || null)
  if (operation === 'submodule-update') return configuredRemoteURL(repoPath)
  if (operation === 'fast-forward')
    return configuredBranchRemoteURL(repoPath, values[0])
  if (
    ['fetch', 'fetch-refspec', 'pull', 'push', 'reset-upstream'].includes(
      operation
    )
  )
    return configuredRemoteURL(repoPath)
  return null
}

async function gitOperationAuthenticationEnvironment(
  repoPath,
  body,
  services,
  operation,
  values
) {
  const account =
    body.hostingAccount &&
    typeof body.hostingAccount === 'object' &&
    !Array.isArray(body.hostingAccount)
      ? body.hostingAccount
      : null
  const remoteURL = await gitOperationRemoteURL(
    repoPath,
    body,
    operation,
    values
  )
  if (!remoteURL) return undefined

  const genericEnvironment = credentials => {
    const username = requireString(credentials.username, 'username')
    const password = requireString(credentials.password, 'password')
    let remote
    try {
      remote = new URL(remoteURL)
    } catch {
      throw Object.assign(new Error('The repository URL is invalid.'), {
        statusCode: 400,
        code: 'invalid-url',
      })
    }
    if (!['http:', 'https:'].includes(remote.protocol))
      throw Object.assign(
        new Error(
          'Username and password authentication is only available for HTTP(S) remotes.'
        ),
        { statusCode: 400, code: 'authentication-required' }
      )
    const authorization = Buffer.from(`${username}:${password}`).toString(
      'base64'
    )
    return {
      ...nonInteractiveGitEnvironment(),
      GIT_CONFIG_COUNT: '3',
      GIT_CONFIG_KEY_2: `http.${remote.origin}/.extraHeader`,
      GIT_CONFIG_VALUE_2: `Authorization: Basic ${authorization}`,
    }
  }

  // Do not inherit an editor's askpass handler. In particular, VS Code would
  // otherwise show its credential prompt outside the web application.
  const genericCredentials = body.genericCredentials
  if (genericCredentials) {
    if (
      typeof genericCredentials !== 'object' ||
      Array.isArray(genericCredentials)
    )
      throw Object.assign(
        new Error('Credentials must include a username and password.'),
        { statusCode: 400 }
      )
    return genericEnvironment(genericCredentials)
  }

  // Git's configured credential helper is the user's source of truth for
  // repository authentication. Check it before considering a signed-in
  // hosting account, which may contain a different or expired token.
  const storedCredentials = await readStoredGitCredential(repoPath, remoteURL)
  if (storedCredentials) return credentialLookupEnvironment()

  // Keep the helper available to the Git operation itself. This matters for
  // `fetch --all`, where additional remotes may need their own credentials,
  // and lets helpers handle their native authentication flow without opening
  // a terminal or editor prompt.
  if (!account) return credentialLookupEnvironment()

  if (account.provider === 'gitlab') {
    const { credentialId, endpoint } = requireGitLabCredential(account)
    if (!gitLabRemoteMatchesEndpoint(remoteURL, endpoint))
      return credentialLookupEnvironment()
    if (!services?.keytar)
      throw Object.assign(new Error('OS credential store is unavailable'), {
        statusCode: 501,
      })
    const token = await services.keytar.getPassword(
      gitLabCredentialService,
      credentialId
    )
    if (!token)
      throw Object.assign(new Error('Hosting credentials were not found'), {
        statusCode: 401,
      })
    try {
      return authenticatedGitLabEnvironment(remoteURL, token)
    } catch {
      return nonInteractiveGitEnvironment()
    }
  }

  const { credentialId, endpoint } = requireGitHubCredential(account)
  if (!gitHubRemoteMatchesEndpoint(remoteURL, endpoint))
    return credentialLookupEnvironment()
  if (!services?.keytar)
    throw Object.assign(new Error('OS credential store is unavailable'), {
      statusCode: 501,
    })
  const token = await services.keytar.getPassword(
    githubCredentialService,
    credentialId
  )
  if (!token)
    throw Object.assign(new Error('Hosting credentials were not found'), {
      statusCode: 401,
    })
  return authenticatedGitEnvironment(remoteURL, token)
}

async function readStoredGitCredential(repoPath, remoteURL) {
  let remote
  try {
    remote = new URL(remoteURL)
  } catch {
    return null
  }
  if (!['http:', 'https:'].includes(remote.protocol)) return null

  const input = [
    `protocol=${remote.protocol.slice(0, -1)}`,
    `host=${remote.host}`,
    ...(remote.pathname === '/' ? [] : [`path=${remote.pathname.slice(1)}`]),
    ...(remote.username
      ? [`username=${decodeURIComponent(remote.username)}`]
      : []),
    '',
  ].join('\n')
  let result
  try {
    result = await operationContext.run(null, () =>
      git(
        ['credential', 'fill'],
        repoPath,
        [0, 1, 128],
        input,
        credentialLookupEnvironment(),
        5_000
      )
    )
  } catch {
    return null
  }
  if (result.exitCode !== 0) return null

  const values = new Map(
    result.stdout.split(/\r?\n/).flatMap(line => {
      const separator = line.indexOf('=')
      return separator > 0
        ? [[line.slice(0, separator), line.slice(separator + 1)]]
        : []
    })
  )
  const username = values.get('username')
  const password = values.get('password')
  return username && password ? { username, password } : null
}

function credentialLookupEnvironment() {
  return {
    ...process.env,
    // Drop transient config inherited from an editor, while retaining helpers
    // configured in the user's Git config (such as osxkeychain or GCM).
    GIT_CONFIG_PARAMETERS: '',
    GIT_TERMINAL_PROMPT: '0',
    GIT_ASKPASS: process.execPath,
    SSH_ASKPASS: process.execPath,
    GCM_INTERACTIVE: 'never',
    GIT_CONFIG_COUNT: '2',
    GIT_CONFIG_KEY_0: 'credential.interactive',
    GIT_CONFIG_VALUE_0: 'false',
    GIT_CONFIG_KEY_1: 'core.askPass',
    GIT_CONFIG_VALUE_1: '',
    ...macOSCredentialHelperEnvironment(),
  }
}

function macOSCredentialHelperEnvironment() {
  if (process.platform !== 'darwin') return {}

  // Dugite's macOS Git intentionally does not bundle the Keychain helper. If
  // the user selected `credential.helper=osxkeychain`, point Git at a system
  // Git exec directory that does include it. This preserves the user's helper
  // configuration instead of replacing it with an app-specific credential.
  if (!resolvedMacOSCredentialHelperExecPath) {
    resolvedMacOSCredentialHelperExecPath = true
    try {
      const execPath = execFileSync('git', ['--exec-path'], {
        encoding: 'utf8',
        env: { ...process.env, GIT_EXEC_PATH: '' },
        timeout: 5_000,
      }).trim()
      if (fs.existsSync(path.join(execPath, 'git-credential-osxkeychain')))
        macOSCredentialHelperExecPath = execPath
    } catch {}
  }
  if (macOSCredentialHelperExecPath)
    return { GIT_EXEC_PATH: macOSCredentialHelperExecPath }

  for (const execPath of [
    '/opt/homebrew/opt/git/libexec/git-core',
    '/usr/local/opt/git/libexec/git-core',
    '/Library/Developer/CommandLineTools/usr/libexec/git-core',
    '/Applications/Xcode.app/Contents/Developer/usr/libexec/git-core',
  ]) {
    if (fs.existsSync(path.join(execPath, 'git-credential-osxkeychain'))) {
      macOSCredentialHelperExecPath = execPath
      return { GIT_EXEC_PATH: execPath }
    }
  }
  return {}
}

function nonInteractiveGitEnvironment() {
  return {
    ...process.env,
    GIT_CONFIG_PARAMETERS: '',
    GIT_TERMINAL_PROMPT: '0',
    // Do not inherit an editor's configured credential or askpass helper.
    // Git exits non-zero and the renderer can collect credentials in its own
    // modal instead.
    GIT_ASKPASS: process.execPath,
    SSH_ASKPASS: process.execPath,
    GIT_CONFIG_COUNT: '2',
    GIT_CONFIG_KEY_0: 'credential.helper',
    GIT_CONFIG_VALUE_0: '',
    GIT_CONFIG_KEY_1: 'core.askPass',
    GIT_CONFIG_VALUE_1: '',
  }
}

function interactiveSSHEnvironment(environment, task, services) {
  if (!task || !services?.getServerURL) return environment
  const serverURL = services.getServerURL()
  if (!serverURL) return environment
  return {
    ...environment,
    SSH_ASKPASS: SSH_ASKPASS_SCRIPT_PATH,
    SSH_ASKPASS_REQUIRE: 'force',
    DISPLAY: '.',
    DESKTOP_PLUS_AUTH_URL: serverURL,
    DESKTOP_PLUS_AUTH_OPERATION: task.id,
    DESKTOP_PLUS_AUTH_TOKEN: task.authToken,
    DESKTOP_PLUS_SESSION_TOKEN: services.sessionToken,
  }
}

function withGitEnvironment(base, additional) {
  return base ? { ...base, ...additional } : additional
}

function statusKind(xy) {
  if (xy.includes('U') || xy === 'AA' || xy === 'DD') return 'Conflicted'
  if (xy.includes('?')) return 'Untracked'
  if (xy.includes('A')) return 'New'
  if (xy.includes('D')) return 'Deleted'
  if (xy.includes('R')) return 'Renamed'
  if (xy.includes('C')) return 'Copied'
  return 'Modified'
}

function submoduleStatus(statusCode) {
  if (!statusCode.startsWith('S')) return undefined
  return {
    commitChanged: statusCode[1] === 'C',
    modifiedChanges: statusCode[2] === 'M',
    untrackedChanges: statusCode[3] === 'U',
  }
}

async function submoduleCommitMetadata(repoPath, filePath) {
  const recorded = await git(
    ['ls-files', '--stage', '-z', '--', filePath],
    repoPath,
    [0, 1]
  )
  const recordedCommit =
    recorded.stdout
      .split('\0')
      .map(value => /^160000 ([0-9a-f]+) \d+\t/.exec(value))
      .find(Boolean)?.[1] || null
  const currentResult = await git(
    ['rev-parse', '--verify', 'HEAD'],
    path.join(repoPath, filePath),
    [0, 128]
  ).catch(() => ({ exitCode: 128, stdout: '', stderr: '' }))
  return {
    recordedCommit,
    currentCommit:
      currentResult.exitCode === 0 ? currentResult.stdout.trim() || null : null,
  }
}

async function nestedSubmoduleStatuses(repoPath, depth = 0) {
  if (depth >= 8) return []
  const tracked = await git(
    ['ls-files', '--stage', '-z'],
    repoPath,
    [0, 1]
  ).catch(() => null)
  if (!tracked) return []
  const paths = tracked.stdout.split('\0').flatMap(record => {
    const match = /^160000 [0-9a-f]+ \d+\t([\s\S]+)$/.exec(record)
    return match ? [match[1]] : []
  })
  return Promise.all(
    paths.map(async filePath => {
      const statusResult = await git(
        [
          'status',
          '--porcelain=v2',
          '-z',
          '-uall',
          '--ignore-submodules=none',
          '--',
          filePath,
        ],
        repoPath,
        [0, 1]
      ).catch(() => null)
      const record = statusResult?.stdout.split('\0').find(Boolean)
      const statusRecordValue = record ? statusRecord(record) : null
      const status = statusRecordValue?.status.submoduleStatus || {
        commitChanged: false,
        modifiedChanges: false,
        untrackedChanges: false,
      }
      const details = await submoduleStatusDetails(
        repoPath,
        filePath,
        status,
        depth + 1
      )
      return { path: filePath, status: details }
    })
  )
}

async function submoduleStatusDetails(repoPath, filePath, status, depth = 0) {
  const metadata = await submoduleCommitMetadata(repoPath, filePath).catch(
    () => ({
      recordedCommit: null,
      currentCommit: null,
    })
  )
  const nested =
    depth >= 8
      ? []
      : await nestedSubmoduleStatuses(path.join(repoPath, filePath), depth + 1)
  return {
    ...status,
    ...metadata,
    ...(nested.length ? { nested } : {}),
  }
}

function statusRecord(record, followingRecord) {
  const entryType = record.slice(0, 1)
  if (entryType === '?') {
    return {
      path: record.slice(2),
      xy: '??',
      status: { kind: 'Untracked' },
    }
  }

  const fields = record.split(' ')
  let xy
  let submodule
  let filePath
  let oldPath

  if (entryType === '1') {
    ;[xy, submodule, , , , , , ...filePath] = fields.slice(1)
  } else if (entryType === '2') {
    ;[xy, submodule, , , , , , , ...filePath] = fields.slice(1)
    oldPath = followingRecord
  } else if (entryType === 'u') {
    xy = fields[1]
    submodule = fields[2]
    filePath = fields.slice(10)
  } else {
    return null
  }

  const nestedRepository = submoduleStatus(submodule)
  return {
    path: filePath.join(' '),
    oldPath,
    xy,
    status: {
      kind: statusKind(xy),
      ...(nestedRepository ? { submoduleStatus: nestedRepository } : {}),
    },
  }
}

function conflictEntry(xy) {
  switch (xy) {
    case 'AA':
      return {
        kind: 'conflicted',
        action: 'both-added',
        us: 'A',
        them: 'A',
        hasTextMarkers: true,
      }
    case 'UU':
      return {
        kind: 'conflicted',
        action: 'both-modified',
        us: 'U',
        them: 'U',
        hasTextMarkers: true,
      }
    case 'AU':
      return {
        kind: 'conflicted',
        action: 'added-by-us',
        us: 'A',
        them: 'U',
      }
    case 'UD':
      return {
        kind: 'conflicted',
        action: 'deleted-by-them',
        us: 'U',
        them: 'D',
      }
    case 'UA':
      return {
        kind: 'conflicted',
        action: 'added-by-them',
        us: 'U',
        them: 'A',
      }
    case 'DU':
      return {
        kind: 'conflicted',
        action: 'deleted-by-us',
        us: 'D',
        them: 'U',
      }
    case 'DD':
      return {
        kind: 'conflicted',
        action: 'both-deleted',
        us: 'D',
        them: 'D',
      }
    default:
      return null
  }
}

async function getConflictStatus(repoPath, filePath, xy) {
  const entry = conflictEntry(xy)
  if (!entry) return { kind: 'Conflicted' }
  const status = { kind: 'Conflicted', entry: { ...entry } }
  delete status.entry.hasTextMarkers

  if (!entry.hasTextMarkers) return status
  try {
    const contents = await fs.promises.readFile(path.join(repoPath, filePath))
    if (contents.includes(0)) return status
    status.conflictMarkerCount = (
      contents.toString('utf8').match(/^<{7}(?: |$)/gm) || []
    ).length
  } catch {
    // Fall back to a manual conflict when the working tree entry cannot be
    // inspected, such as a file/directory conflict.
  }
  return status
}

async function gitPath(repoPath, name) {
  const result = await git(['rev-parse', '--git-path', name], repoPath)
  return path.resolve(repoPath, result.stdout.trim())
}

async function gitPathExists(repoPath, name) {
  try {
    await fs.promises.access(await gitPath(repoPath, name))
    return true
  } catch {
    return false
  }
}

async function readGitPath(repoPath, name) {
  try {
    return (
      await fs.promises.readFile(await gitPath(repoPath, name), 'utf8')
    ).trim()
  } catch {
    return null
  }
}

async function readFirstGitPath(repoPath, names) {
  for (const name of names) {
    const value = await readGitPath(repoPath, name)
    if (value !== null) return value
  }
  return null
}

function rebaseBranchName(ref) {
  return ref?.startsWith('refs/heads/') ? ref.slice('refs/heads/'.length) : ref
}

function normalizeWorktreePath(repoPath, worktreePath) {
  const normalizedRepositoryPath = path.normalize(repoPath)
  const normalizedWorktreePath = path.normalize(worktreePath)
  if (
    process.platform === 'darwin' &&
    normalizedRepositoryPath.startsWith(`/var${path.sep}`) &&
    normalizedWorktreePath.startsWith(`/private/var${path.sep}`)
  ) {
    return normalizedWorktreePath.slice('/private'.length)
  }
  return normalizedWorktreePath
}

async function getRebaseState(repoPath, rebaseMerge, rebaseApply) {
  if (!rebaseMerge && !rebaseApply) return null
  const directory = rebaseMerge ? 'rebase-merge' : 'rebase-apply'
  const [
    originalBranchTip,
    targetBranch,
    baseBranchTip,
    currentCommit,
    position,
    total,
  ] = await Promise.all([
    readGitPath(repoPath, `${directory}/orig-head`),
    readGitPath(repoPath, `${directory}/head-name`),
    readGitPath(repoPath, `${directory}/onto`),
    readGitPath(repoPath, 'REBASE_HEAD'),
    readFirstGitPath(repoPath, [`${directory}/msgnum`, `${directory}/next`]),
    readFirstGitPath(repoPath, [`${directory}/end`, `${directory}/last`]),
  ])
  const parseProgressValue = value => {
    const parsed = Number.parseInt(value || '', 10)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null
  }
  return {
    originalBranchTip,
    targetBranch: rebaseBranchName(targetBranch),
    baseBranchTip,
    currentCommit,
    position: parseProgressValue(position),
    totalCommitCount: parseProgressValue(total),
  }
}

async function getCherryPickState(repoPath) {
  if (!(await gitPathExists(repoPath, 'CHERRY_PICK_HEAD'))) return null

  const cherryPickHead = await readGitPath(repoPath, 'CHERRY_PICK_HEAD')
  let abortSafety = null
  let head = null
  let todo = null
  try {
    ;[abortSafety, head, todo] = await Promise.all([
      readGitPath(repoPath, 'sequencer/abort-safety'),
      readGitPath(repoPath, 'sequencer/head'),
      readGitPath(repoPath, 'sequencer/todo'),
    ])
  } catch {}

  if (abortSafety && head && todo) {
    const remainingCommits = todo
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        const match = /^(?:pick|revert|edit)\s+([0-9a-f]+)(?:\s+(.*))?$/i.exec(
          line
        )
        return match
          ? { sha: match[1], summary: (match[2] || '').trim() }
          : null
      })
      .filter(Boolean)
    if (remainingCommits.length > 0) {
      const picked = await git(
        ['rev-list', '--reverse', `${head}..${abortSafety}`],
        repoPath,
        [0, 128]
      )
      const pickedCount = picked.stdout.split(/\r?\n/).filter(Boolean).length
      const totalCommitCount = pickedCount + remainingCommits.length
      const position = Math.min(pickedCount + 1, totalCommitCount)
      return {
        position,
        totalCommitCount,
        currentCommit: remainingCommits[0].sha,
      }
    }
  }

  if (!cherryPickHead) return null
  return {
    position: 1,
    totalCommitCount: 1,
    currentCommit: cherryPickHead,
  }
}

async function getStatus(repoPath, options = {}) {
  const result = await git(
    ['status', '--porcelain=v2', '-z', '-uall', '--ignore-submodules=none'],
    repoPath,
    [0],
    undefined,
    options.noOptionalLocks
      ? { ...process.env, GIT_OPTIONAL_LOCKS: '0' }
      : undefined
  )
  const records = result.stdout.split('\0')
  const files = []
  for (let i = 0; i < records.length - 1; i++) {
    const record = records[i]
    if (!record) continue
    const file = statusRecord(record, records[i + 1])
    if (!file) continue
    if (record.startsWith('2 ')) i++
    files.push(file)
  }
  await Promise.all(
    files.map(async file => {
      if (file.status.submoduleStatus) {
        file.status = {
          ...file.status,
          submoduleStatus: await submoduleStatusDetails(
            repoPath,
            file.path,
            file.status.submoduleStatus
          ),
        }
      }
      if (file.status.kind !== 'Conflicted') return
      file.status = await getConflictStatus(repoPath, file.path, file.xy)
      delete file.xy
    })
  )
  for (const file of files) delete file.xy
  const [rebaseMerge, rebaseApply, cherryPick, merge, revert, squash] =
    await Promise.all([
      gitPathExists(repoPath, 'rebase-merge'),
      gitPathExists(repoPath, 'rebase-apply'),
      gitPathExists(repoPath, 'CHERRY_PICK_HEAD'),
      gitPathExists(repoPath, 'MERGE_HEAD'),
      gitPathExists(repoPath, 'REVERT_HEAD'),
      gitPathExists(repoPath, 'SQUASH_MSG'),
    ])
  let operation = null
  if (rebaseMerge || rebaseApply) operation = 'rebase'
  else if (cherryPick) operation = 'cherryPick'
  else if (merge) operation = 'merge'
  else if (revert) operation = 'revert'
  else if (squash) operation = 'squash'
  return {
    workingDirectory: { files },
    operation,
    operationState:
      operation === 'rebase'
        ? await getRebaseState(repoPath, rebaseMerge, rebaseApply)
        : operation === 'cherryPick'
        ? await getCherryPickState(repoPath)
        : null,
  }
}

function desktopStashMessage(branchName, customName = null) {
  return `${
    customName ? `!!Name<${encodeURIComponent(customName)}>` : ''
  }${DESKTOP_STASH_ENTRY_MARKER}<${branchName}>`
}

async function getStashEntries(repoPath) {
  const result = await git(
    [
      'log',
      '-g',
      '--format=%gD%x00%H%x00%gs%x00%T%x00%P%x00%aI%x1e',
      'refs/stash',
      '--',
    ],
    repoPath,
    [0, 128]
  )
  if (result.exitCode === 128) return []

  return result.stdout.split('\x1e').flatMap(raw => {
    const values = raw.replace(/^\n+|\n+$/g, '').split('\0')
    if (values.length < 6) return []
    const [name, stashSha, message, tree, parentText, createdAt] = values
    const desktopStash = parseDesktopStashMessage(message)
    const genericMatch = /^(?:WIP on|On) ([^:]+):\s*(.*)$/.exec(message)
    let customName = desktopStash?.customStashMessage || null
    if (!customName && genericMatch?.[2] && !message.startsWith('WIP on ')) {
      customName = genericMatch[2] || null
    }
    const branchName = desktopStash?.branchName || genericMatch?.[1] || 'HEAD'
    return [
      {
        name,
        branchName,
        customName,
        stashSha,
        createdAt,
        files: { kind: 'NotLoaded' },
        tree,
        parents: parentText ? parentText.split(' ') : [],
        isDesktop: desktopStash !== null,
      },
    ]
  })
}

async function getStashEntry(repoPath, ref) {
  const sha = (await git(['rev-parse', ref], repoPath)).stdout.trim()
  const entry = (await getStashEntries(repoPath)).find(
    candidate => candidate.stashSha === sha
  )
  if (!entry)
    throw Object.assign(new Error(`Stash '${ref}' was not found`), {
      statusCode: 404,
    })
  return entry
}

async function replaceStashEntry(repoPath, entry, branchName, customName) {
  const current = (await getStashEntries(repoPath)).find(
    candidate => candidate.stashSha === entry.stashSha
  )
  if (!current)
    throw Object.assign(
      new Error('The stash changed before it could be updated'),
      {
        statusCode: 409,
      }
    )
  const message = `On ${branchName}: ${desktopStashMessage(
    branchName,
    customName
  )}`
  return combinedResult([
    await git(['stash', 'drop', current.name], repoPath),
    await git(['stash', 'store', '-m', message, entry.stashSha], repoPath),
  ])
}

async function renameDesktopStashesForBranch(repoPath, oldName, newName) {
  const stashes = (await getStashEntries(repoPath)).filter(
    entry => entry.isDesktop && entry.branchName === oldName
  )
  const results = []
  for (const stash of stashes)
    results.push(
      await replaceStashEntry(repoPath, stash, newName, stash.customName)
    )
  return results
}

async function getRepositoryIndicators(repoPath) {
  const [status, currentResult, branchResult, remoteResult] = await Promise.all(
    [
      getStatus(repoPath),
      git(['branch', '--show-current'], repoPath),
      git(
        ['for-each-ref', '--format=%(refname:short)', 'refs/heads'],
        repoPath
      ),
      git(['config', '--get-regexp', '^remote\\..*\\.url$'], repoPath, [0, 1]),
    ]
  )
  const currentBranch = currentResult.stdout.trim() || null
  const localBranches = branchResult.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map(name => ({ name, type: 'Local' }))
  const defaultBranch = await getDefaultBranchName(
    repoPath,
    localBranches,
    currentBranch
  )
  let aheadBehind = null
  if (currentBranch) {
    const upstream = await git(
      ['rev-parse', '--abbrev-ref', `${currentBranch}@{upstream}`],
      repoPath,
      [0, 128]
    )
    if (upstream.exitCode === 0) {
      const count = await git(
        [
          'rev-list',
          '--left-right',
          '--count',
          `HEAD...${upstream.stdout.trim()}`,
        ],
        repoPath,
        [0, 128]
      )
      if (count.exitCode === 0) {
        const [ahead, behind] = count.stdout.trim().split(/\s+/).map(Number)
        aheadBehind = { ahead, behind }
      }
    }
  }
  const origin = remoteResult.stdout
    .split('\n')
    .filter(Boolean)
    .map(row => {
      const separator = row.indexOf(' ')
      return {
        name: row.slice('remote.'.length, separator - '.url'.length),
        url: row.slice(separator + 1),
      }
    })
    .find(remote => remote.name === 'origin')
  return {
    currentBranch,
    defaultBranch,
    changedFilesCount: status.workingDirectory.files.length,
    aheadBehind,
    remoteURL: origin ? safeRemoteURL(origin.url) : null,
    remoteWebURL: origin ? remoteWebURL(origin.url) : null,
  }
}

async function getBranches(repoPath, includeRemoteTags = false) {
  const current = (
    await git(['branch', '--show-current'], repoPath)
  ).stdout.trim()
  const pullRebaseResult = await git(
    ['config', '--get', 'pull.rebase'],
    repoPath,
    [0, 1, 128]
  )
  const pullRebase =
    pullRebaseResult.exitCode === 0 ? pullRebaseResult.stdout.trim() : null
  const pullWithRebase =
    pullRebase === 'true' ? true : pullRebase === 'false' ? false : undefined
  const headResult = await git(
    ['rev-parse', '--verify', 'HEAD'],
    repoPath,
    [0, 128]
  )
  const head = headResult.exitCode === 0 ? headResult.stdout.trim() : ''
  const rows = (
    await git(
      [
        'for-each-ref',
        '--format=%(refname)%00%(refname:short)%00%(upstream:short)%00%(upstream:track)%00%(objectname)%00%(authordate:unix)',
        'refs/heads',
        'refs/remotes',
      ],
      repoPath
    )
  ).stdout
    .split('\n')
    .filter(Boolean)

  const branches = rows.map(row => {
    const [ref, name, upstream, upstreamTrack, sha, date] = row.split('\0')
    return {
      name,
      upstream: upstream || null,
      isGone: upstreamTrack === '[gone]' || upstreamTrack === '(gone)',
      tip: {
        sha,
        author: { date: new Date(Number(date) * 1000).toISOString() },
      },
      type: ref.startsWith('refs/remotes/') ? 'Remote' : 'Local',
      ref,
    }
  })
  const branch =
    branches.find(item => item.type === 'Local' && item.name === current) ||
    null
  let aheadBehind = null
  if (branch && branch.upstream) {
    const count = await git(
      ['rev-list', '--left-right', '--count', `HEAD...${branch.upstream}`],
      repoPath,
      [0, 128]
    )
    if (count.exitCode === 0) {
      const [ahead, behind] = count.stdout.trim().split(/\s+/).map(Number)
      aheadBehind = { ahead, behind }
    }
  }
  const remoteRows = (
    await git(
      ['config', '--get-regexp', '^remote\\..*\\.url$'],
      repoPath,
      [0, 1]
    )
  ).stdout
    .split('\n')
    .filter(Boolean)
  const remotes = remoteRows.map(row => {
    const separator = row.indexOf(' ')
    const key = row.slice(0, separator)
    const url = row.slice(separator + 1)
    return {
      name: key.slice('remote.'.length, -'.url'.length),
      url: safeRemoteURL(url),
      webURL: remoteWebURL(url),
    }
  })
  const worktreeRows = (
    await git(['worktree', 'list', '--porcelain', '-z'], repoPath)
  ).stdout
    .replace(/\0$/, '')
    .split('\0\0')
    .filter(Boolean)
  const worktrees = await Promise.all(
    worktreeRows.map(async (row, index) => {
      const lines = row.split('\0')
      const worktreePath =
        lines.find(line => line.startsWith('worktree '))?.slice(9) || ''
      const head = lines.find(line => line.startsWith('HEAD '))?.slice(5) || ''
      const branchRef =
        lines.find(line => line.startsWith('branch '))?.slice(7) || null
      const normalizedPath = normalizeWorktreePath(repoPath, worktreePath)
      const worktreeStatus =
        includeRemoteTags && worktreePath
          ? await getStatus(normalizedPath).catch(() => null)
          : null
      return {
        path: normalizedPath,
        head,
        branch: branchRef,
        isDetached: lines.includes('detached'),
        type: index === 0 ? 'main' : 'linked',
        isLocked: lines.some(line => line.startsWith('locked')),
        isPrunable: lines.some(line => line.startsWith('prunable')),
        ...(includeRemoteTags
          ? { isDirty: Boolean(worktreeStatus?.workingDirectory.files.length) }
          : {}),
      }
    })
  )
  const [stashes, worktreeInclude] = await Promise.all([
    getStashEntries(repoPath),
    getWorktreeInclude(repoPath),
  ])
  const tagRows = await Promise.all(
    (
      await git(
        [
          'for-each-ref',
          '--format=%(refname:short)%00%(objectname)%00%(objecttype)',
          'refs/tags',
        ],
        repoPath,
        [0, 1]
      )
    ).stdout
      .split('\n')
      .filter(Boolean)
      .map(async row => {
        const [name, sha, objectType] = row.split('\0')
        const peeled =
          objectType === 'tag'
            ? (
                await git(['rev-parse', `${name}^{}`], repoPath, [0, 128])
              ).stdout.trim()
            : sha
        return {
          name,
          sha: peeled || sha,
          ...(includeRemoteTags ? { pushedRemotes: [] } : {}),
        }
      })
  )
  const remoteTagRows = includeRemoteTags
    ? (
        await Promise.all(
          remotes.map(async remote => {
            const result = await git(
              ['ls-remote', '--tags', remote.name],
              repoPath,
              [0, 1, 128],
              undefined,
              undefined,
              15_000
            ).catch(() => ({ stdout: '' }))
            const remoteTags = new Map()
            for (const row of result.stdout.split('\n').filter(Boolean)) {
              const [sha, ref] = row.split(/\s+/)
              const prefix = 'refs/tags/'
              if (!ref || !ref.startsWith(prefix)) continue
              const remoteTagName = ref.slice(prefix.length)
              const peeled = remoteTagName.endsWith('^{}')
              const name = peeled ? remoteTagName.slice(0, -3) : remoteTagName
              const existing = remoteTags.get(name)
              if (!existing || peeled)
                remoteTags.set(name, {
                  remote: remote.name,
                  name,
                  sha,
                  peeled,
                })
            }
            return [...remoteTags.values()].map(tag => ({
              remote: tag.remote,
              name: tag.name,
              sha: tag.sha,
            }))
          })
        )
      ).flat()
    : []
  const remoteTagsByName = new Map()
  for (const tag of remoteTagRows) {
    const current = remoteTagsByName.get(tag.name) || []
    current.push(tag)
    remoteTagsByName.set(tag.name, current)
  }
  if (includeRemoteTags)
    for (const tag of tagRows) {
      tag.pushedRemotes = (remoteTagsByName.get(tag.name) || [])
        .filter(remote => remote.sha === tag.sha)
        .map(remote => remote.remote)
        .sort()
    }
  const recentBranches = await getRecentBranchNames(repoPath)
  const defaultBranch = await getDefaultBranchName(repoPath, branches, current)
  const mergedBranchRefs = current
    ? await getBranchesMergedInto(repoPath, current)
    : new Map()
  const worktreeRefs = new Set(
    worktrees.map(worktree => worktree.branch).filter(Boolean)
  )
  const mergedBranches = branches.filter(
    branch =>
      branch.type === 'Local' &&
      branch.name !== current &&
      mergedBranchRefs.has(branch.ref) &&
      !worktreeRefs.has(branch.ref)
  )
  let localCommitSHAs = []
  if (branch) {
    const localRange = branch.upstream
      ? `${branch.upstream}..${branch.name}`
      : `${branch.name} --not --remotes`
    const localArgs = branch.upstream
      ? ['rev-list', localRange]
      : ['rev-list', branch.name, '--not', '--remotes']
    const localResult = await git(localArgs, repoPath, [0, 128])
    if (localResult.exitCode === 0)
      localCommitSHAs = localResult.stdout.split(/\r?\n/).filter(Boolean)
  }
  const tagsToPush = includeRemoteTags
    ? tagRows.filter(tag => tag.pushedRemotes.length === 0).map(tag => tag.name)
    : []
  const lastFetched = await getLastFetchedAt(repoPath)
  return {
    branch,
    defaultBranch,
    lastFetched,
    recentBranches,
    tip: head,
    aheadBehind,
    branches,
    mergedBranches,
    remotes,
    tags: tagRows,
    worktrees,
    worktreeInclude,
    stashes,
    recentBranches,
    pullWithRebase,
    localCommitSHAs,
    ...(includeRemoteTags ? { tagsToPush } : {}),
  }
}

async function getLastFetchedAt(repoPath) {
  const fetchHeadPath = await gitPath(repoPath, 'FETCH_HEAD')
  try {
    return (await fs.promises.stat(fetchHeadPath)).mtime.toISOString()
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}

const branchPruneReservedRefs = new Set([
  'refs/heads/HEAD',
  'refs/heads/main',
  'refs/heads/master',
  'refs/heads/gh-pages',
  'refs/heads/develop',
  'refs/heads/dev',
  'refs/heads/development',
  'refs/heads/trunk',
  'refs/heads/devel',
  'refs/heads/release',
])

async function getBranchCheckoutDates(repoPath, afterDate) {
  const result = await git(
    [
      'reflog',
      '--date=iso',
      `--after=${afterDate.toISOString()}`,
      '--pretty=%H %gd %gs',
      '--grep-reflog=checkout: moving from .* to .*$',
      '--',
    ],
    repoPath,
    [0, 128]
  )
  if (
    result.exitCode === 128 &&
    /does not have any commits yet/i.test(result.stderr)
  )
    return new Map()

  const checkouts = new Map()
  const regex =
    /^[a-f0-9]{40}\sHEAD@{(.*)}\scheckout: moving from\s.*\sto\s(.*)$/i
  for (const line of result.stdout.split(/\r?\n/)) {
    const match = regex.exec(line)
    if (!match) continue
    const date = new Date(match[1])
    const branchName = match[2].trim()
    if (Number.isNaN(date.getTime()) || !branchName) continue
    if (!checkouts.has(branchName)) checkouts.set(branchName, date)
  }
  return checkouts
}

async function getBranchesMergedInto(repoPath, branchName) {
  const result = await git(
    [
      'for-each-ref',
      '--format=%(refname)%00%(objectname)',
      '--merged',
      branchName,
      'refs/heads',
    ],
    repoPath
  )
  const merged = new Map()
  for (const row of result.stdout.split(/\r?\n/).filter(Boolean)) {
    const [ref, sha] = row.split('\0')
    if (ref && ref !== `refs/heads/${branchName}`) merged.set(ref, sha)
  }
  return merged
}

async function getBranchPruneCandidates(repoPath, defaultBranchName) {
  const branchData = await getBranches(repoPath)
  const defaultBranch =
    branchData.branches.find(
      branch => branch.type === 'Local' && branch.name === defaultBranchName
    ) ||
    branchData.branches.find(
      branch =>
        branch.type === 'Local' &&
        (branch.name === 'main' || branch.name === 'master')
    )
  if (!defaultBranch) return []

  const mergedBranches = await getBranchesMergedInto(
    repoPath,
    defaultBranch.name
  )
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
  const recentCheckouts = await getBranchCheckoutDates(repoPath, twoWeeksAgo)
  const recentCheckoutRefs = new Set(
    [...recentCheckouts.keys()].map(name => `refs/heads/${name}`)
  )
  const remoteRefs = new Set(
    branchData.branches
      .filter(branch => branch.type === 'Remote')
      .map(branch => branch.ref)
  )
  const worktreeRefs = new Set(
    branchData.worktrees.map(worktree => worktree.branch).filter(Boolean)
  )
  const branchesByRef = new Map(
    branchData.branches
      .filter(branch => branch.type === 'Local')
      .map(branch => [branch.ref, branch])
  )

  return [...mergedBranches.keys()]
    .filter(ref => !branchPruneReservedRefs.has(ref))
    .filter(ref => ref !== defaultBranch.ref)
    .filter(ref => ref !== branchData.branch?.ref)
    .filter(ref => !recentCheckoutRefs.has(ref))
    .filter(ref => !worktreeRefs.has(ref))
    .flatMap(ref => {
      const branch = branchesByRef.get(ref)
      if (
        !branch?.upstream ||
        (!branch.isGone && remoteRefs.has(branch.upstream))
      )
        return []
      return [
        {
          name: branch.name,
          ref,
          sha: mergedBranches.get(ref),
          upstream: branch.upstream,
        },
      ]
    })
}

async function pruneBranches(repoPath, body) {
  const branchData = await getBranches(repoPath)
  const requestedDefault = body.defaultBranch
    ? requireGitValue(body.defaultBranch, 'default branch')
    : null
  const defaultBranchName =
    requestedDefault ||
    branchData.branch?.name ||
    branchData.branches.find(
      branch =>
        branch.type === 'Local' &&
        (branch.name === 'main' || branch.name === 'master')
    )?.name ||
    'main'
  const candidates = await getBranchPruneCandidates(repoPath, defaultBranchName)
  if (body.dryRun === true)
    return {
      stdout: '',
      stderr: '',
      exitCode: 0,
      candidates,
      pruned: [],
    }

  if (body.confirmed !== true)
    throw Object.assign(
      new Error('Confirm pruning stale branches before continuing.'),
      { statusCode: 400 }
    )

  const results = []
  const pruned = []
  for (const candidate of candidates) {
    results.push(await git(['branch', '-D', candidate.name], repoPath))
    pruned.push(candidate)
  }
  return {
    ...combinedResult(results),
    candidates,
    pruned,
  }
}

async function getGlobalGitConfigPath() {
  const result = await git(
    ['config', '--edit', '--global'],
    process.cwd(),
    [0],
    undefined,
    { GIT_EDITOR: 'printf %s' }
  )
  const configPath = path.resolve(result.stdout.trim())
  return { path: configPath }
}

async function getGitConfigPath(repoPath, scope) {
  if (scope === 'global') return (await getGlobalGitConfigPath()).path
  if (scope === 'local') return gitPath(repoPath, 'config')
  throw Object.assign(new Error('Git config scope is invalid'), {
    statusCode: 400,
  })
}

async function recoverGitConfigLock(repoPath, scope, confirmed) {
  if (confirmed !== true)
    throw Object.assign(
      new Error(
        'Confirm removing the stale Git config lock before continuing.'
      ),
      { statusCode: 400, code: 'confirmation-required' }
    )

  const configPath = await getGitConfigPath(repoPath, scope)
  const lockPath = `${configPath}.lock`
  const lockStats = await fs.promises.lstat(lockPath).catch(error => {
    if (error.code === 'ENOENT')
      throw Object.assign(new Error('The Git config lock no longer exists.'), {
        statusCode: 404,
        code: 'git-config-lock-missing',
      })
    throw error
  })
  if (!lockStats.isFile() || lockStats.isSymbolicLink())
    throw Object.assign(
      new Error(
        'The Git config lock is not a regular file. Refusing to remove it.'
      ),
      { statusCode: 400, code: 'git-config-lock-invalid' }
    )
  if (Date.now() - lockStats.mtimeMs < STALE_GIT_CONFIG_LOCK_AGE_MS)
    throw Object.assign(
      new Error(
        'The Git config lock is recent and may belong to an active editor. Close the editor and wait before trying stale-lock recovery.'
      ),
      { statusCode: 409, code: 'git-config-lock-active' }
    )

  await fs.promises.unlink(lockPath)
  return { removedPath: lockPath, scope }
}

function parseGitConfigOrigin(output) {
  const parts = output.split('\0')
  if (parts.length < 3 || !parts[0] || !parts[1]) return null
  return {
    scope: parts[0],
    origin: parts[1],
    value: parts[2] || '',
  }
}

async function getGitConfigValue(repoPath, scope, name) {
  const args = ['config']
  if (scope === 'local') args.push('--local')
  else if (scope === 'global') args.push('--global')
  args.push('--get', name)
  const result = await git(args, repoPath, [0, 1])
  return result.exitCode === 0 ? result.stdout.trim() || null : null
}

async function getGitConfigIdentityValue(repoPath, name) {
  const result = await git(
    ['config', '--show-origin', '--show-scope', '-z', '--get', name],
    repoPath,
    [0, 1]
  )
  return result.exitCode === 0 ? parseGitConfigOrigin(result.stdout) : null
}

async function editGitConfigValue(repoPath, scope, name, value, operation) {
  if (!['local', 'global', 'effective', 'origin'].includes(scope))
    throw Object.assign(new Error('Git config scope is invalid'), {
      statusCode: 400,
    })
  if (!['get', 'set', 'remove'].includes(operation))
    throw Object.assign(new Error('Git config operation is invalid'), {
      statusCode: 400,
    })
  if (operation !== 'get' && !['local', 'global'].includes(scope))
    throw Object.assign(new Error('Git config scope does not support writes'), {
      statusCode: 400,
    })

  if (operation === 'get') {
    if (scope === 'origin') {
      const origin = await getGitConfigIdentityValue(repoPath, name)
      return { origin }
    }
    return {
      value: await getGitConfigValue(
        repoPath,
        scope === 'effective' ? 'effective' : scope,
        name
      ),
    }
  }

  const configScope = scope === 'local' ? '--local' : '--global'
  if (operation === 'set') {
    await git(
      [
        'config',
        configScope,
        '--replace-all',
        name,
        requireGitValue(value, 'Git config value'),
      ],
      repoPath
    )
  } else {
    await git(['config', configScope, '--unset-all', name], repoPath, [0, 1])
  }
  return { ok: true }
}

async function getGitIdentity(repoPath) {
  const [
    nameOrigin,
    emailOrigin,
    localName,
    localEmail,
    globalName,
    globalEmail,
  ] = await Promise.all([
    getGitConfigIdentityValue(repoPath, 'user.name'),
    getGitConfigIdentityValue(repoPath, 'user.email'),
    getGitConfigValue(repoPath, 'local', 'user.name'),
    getGitConfigValue(repoPath, 'local', 'user.email'),
    getGitConfigValue(repoPath, 'global', 'user.name'),
    getGitConfigValue(repoPath, 'global', 'user.email'),
  ])
  return {
    name: nameOrigin?.value || '',
    email: emailOrigin?.value || '',
    nameOrigin: nameOrigin
      ? { scope: nameOrigin.scope, origin: nameOrigin.origin }
      : null,
    emailOrigin: emailOrigin
      ? { scope: emailOrigin.scope, origin: emailOrigin.origin }
      : null,
    localName,
    localEmail,
    globalName,
    globalEmail,
  }
}

async function setGitIdentity(repoPath, scope, name, email) {
  if (scope !== 'local' && scope !== 'global')
    throw Object.assign(new Error('Git identity scope is invalid'), {
      statusCode: 400,
    })
  const configScope = scope === 'local' ? '--local' : '--global'
  await git(
    ['config', configScope, '--replace-all', 'user.name', name],
    repoPath
  )
  await git(
    ['config', configScope, '--replace-all', 'user.email', email],
    repoPath
  )
  return getGitIdentity(repoPath)
}

function parseChangedFiles(raw, commitish, parentCommitish) {
  const parts = raw.split('\0')
  const files = []
  for (let i = 0; i < parts.length - 1; ) {
    const status = parts[i++]
    if (!status) continue
    if (status.startsWith('R') || status.startsWith('C')) {
      const oldPath = parts[i++]
      const filePath = parts[i++]
      files.push({
        path: filePath,
        oldPath,
        status: { kind: changedFileKind(status) },
        commitish,
        parentCommitish,
      })
    } else {
      const filePath = parts[i++]
      files.push({
        path: filePath,
        status: { kind: changedFileKind(status) },
        commitish,
        parentCommitish,
      })
    }
  }
  return files
}

function submoduleStatusFromModes(status, sourceMode, destinationMode) {
  if (
    sourceMode === '160000' &&
    destinationMode === '160000' &&
    status.startsWith('M')
  ) {
    return {
      commitChanged: true,
      modifiedChanges: false,
      untrackedChanges: false,
    }
  }
  if (
    (sourceMode === '160000' && status.startsWith('D')) ||
    (destinationMode === '160000' && status.startsWith('A'))
  ) {
    return {
      commitChanged: false,
      modifiedChanges: false,
      untrackedChanges: false,
    }
  }
  return undefined
}

function parseRawChangedFiles(raw, commitish, parentCommitish) {
  const parts = raw.split('\0')
  const files = []
  for (let i = 0; i < parts.length - 1; ) {
    const header = parts[i++]
    if (!header) continue
    const match = /^:([0-7]{6}) ([0-7]{6}) [a-f0-9]+ [a-f0-9]+ (.+)$/.exec(
      header
    )
    if (!match) continue
    const [, sourceMode, destinationMode, status] = match
    const oldPath =
      status.startsWith('R') || status.startsWith('C') ? parts[i++] : undefined
    const filePath = parts[i++]
    const nestedRepository = submoduleStatusFromModes(
      status,
      sourceMode,
      destinationMode
    )
    files.push({
      path: filePath,
      oldPath,
      status: {
        kind: changedFileKind(status),
        ...(nestedRepository ? { submoduleStatus: nestedRepository } : {}),
      },
      commitish,
      parentCommitish,
    })
  }
  return files
}

async function getStashFiles(repoPath, url) {
  const stash = requireGitValue(url.searchParams.get('stash'), 'stash')
  const raw = await git(
    [
      'stash',
      'show',
      stash,
      '--raw',
      '-z',
      '--include-untracked',
      '--format=format:',
      '--no-show-signature',
      '--',
    ],
    repoPath
  )
  return { files: parseRawChangedFiles(raw.stdout, stash, `${stash}^`) }
}

async function getStashDiff(repoPath, url) {
  const stash = requireGitValue(url.searchParams.get('stash'), 'stash')
  const filePath = requireString(url.searchParams.get('file'), 'file')
  let newCommitish = stash
  let result = await git(
    [
      'diff',
      '--no-ext-diff',
      '--no-color',
      `${stash}^1`,
      stash,
      '--',
      filePath,
    ],
    repoPath,
    [0, 1]
  )
  if (result.stdout.length === 0) {
    const untrackedParent = await git(
      ['rev-parse', '--verify', `${stash}^3`],
      repoPath,
      [0, 128]
    )
    if (untrackedParent.exitCode === 0) {
      newCommitish = untrackedParent.stdout.trim()
      result = await git(
        [
          'diff',
          '--no-ext-diff',
          '--no-color',
          '4b825dc642cb6eb9a060e54bf8d69288fbee4904',
          untrackedParent.stdout.trim(),
          '--',
          filePath,
        ],
        repoPath,
        [0, 1]
      )
    }
  }
  const submoduleUrl = await git(
    ['config', '--get', `submodule.${filePath}.url`],
    repoPath,
    [0, 1]
  )
  const image = await getDiffImage(
    repoPath,
    filePath,
    `${stash}^1`,
    newCommitish
  )
  return {
    patch: result.stdout,
    image,
    fileContents: await getDiffFileContents(
      repoPath,
      filePath,
      `${stash}^1`,
      newCommitish
    ),
    submoduleUrl:
      submoduleUrl.exitCode === 0 ? submoduleUrl.stdout.trim() || null : null,
    fullPath: path.join(repoPath, filePath),
  }
}

async function getBranchAheadBehind(repoPath, url) {
  const branch = requireGitValue(url.searchParams.get('branch'), 'branch')
  const upstreamResult = await git(
    [
      'rev-parse',
      '--abbrev-ref',
      '--symbolic-full-name',
      `${branch}@{upstream}`,
    ],
    repoPath,
    [0, 128]
  )
  if (upstreamResult.exitCode !== 0) return { aheadBehind: null }
  const upstream = upstreamResult.stdout.trim()
  const result = await git(
    ['rev-list', '--left-right', '--count', `${branch}...${upstream}`],
    repoPath,
    [0, 128]
  )
  if (result.exitCode !== 0) return { aheadBehind: null }
  const [ahead, behind] = result.stdout.trim().split(/\s+/).map(Number)
  return {
    aheadBehind:
      Number.isFinite(ahead) && Number.isFinite(behind)
        ? { ahead, behind }
        : null,
  }
}

async function getHistory(repoPath, url) {
  const limit = Math.min(
    Math.max(Number(url.searchParams.get('limit') || 100), 1),
    500
  )
  const skip = Math.max(Number(url.searchParams.get('skip') || 0), 0)
  const query = (url.searchParams.get('query') || '').trim().toLowerCase()
  const fetchLimit = query ? Math.max(limit + skip, 500) : limit
  const ref =
    url.searchParams.get('all') === '1'
      ? '--all'
      : url.searchParams.get('ref') || 'HEAD'
  const field = '\x1f'
  const record = '\x1e'
  const format =
    [
      `%H`,
      `%h`,
      `%s`,
      `%b`,
      `%an`,
      `%ae`,
      `%aI`,
      `%cn`,
      `%ce`,
      `%cI`,
      `%P`,
      `%D`,
      `%(trailers:unfold,only)`,
    ].join(field) + record
  const result = await git(
    [
      'log',
      ref,
      `--max-count=${fetchLimit}`,
      `--skip=${query ? 0 : skip}`,
      `--format=${format}`,
      '--no-show-signature',
      '--no-color',
      '--',
    ],
    repoPath,
    [0, 128]
  )
  if (result.exitCode === 128) return { commits: [] }

  const commits = result.stdout.split(record).flatMap(raw => {
    const values = raw.replace(/^\n+|\n+$/g, '').split(field)
    if (values.length < 13) return []
    const [
      sha,
      shortSha,
      summary,
      body,
      authorName,
      authorEmail,
      authorDate,
      committerName,
      committerEmail,
      committerDate,
      parents,
      refs,
      trailers,
    ] = values
    const parseDate = value => {
      const parsed = new Date(value)
      return Number.isNaN(parsed.valueOf()) ? new Date(0) : parsed
    }
    const parseTimezoneOffset = value => {
      const match = /([+-])(\d{2}):?(\d{2})$/.exec(value)
      if (!match) return 0
      const minutes = Number(match[2]) * 60 + Number(match[3])
      return match[1] === '-' ? -minutes : minutes
    }
    const parseTrailers = value =>
      value
        .split(/\r?\n/)
        .map(line => {
          const separator = line.indexOf(':')
          if (separator <= 0) return null
          return {
            token: line.slice(0, separator).trim(),
            value: line.slice(separator + 1).trim(),
          }
        })
        .filter(Boolean)
    return [
      {
        sha,
        shortSha,
        summary,
        body,
        author: {
          name: authorName,
          email: authorEmail,
          date: parseDate(authorDate).toISOString(),
          tzOffset: parseTimezoneOffset(authorDate),
        },
        committer: {
          name: committerName,
          email: committerEmail,
          date: parseDate(committerDate).toISOString(),
          tzOffset: parseTimezoneOffset(committerDate),
        },
        parentSHAs: parents ? parents.split(' ') : [],
        trailers: parseTrailers(trailers),
        tags: refs
          .split(', ')
          .flatMap(item => (item.startsWith('tag: ') ? [item.slice(5)] : [])),
      },
    ]
  })
  if (!query) return { commits }

  const filtered = commits.filter(commit => {
    const searchable = [
      commit.sha,
      commit.shortSha,
      commit.summary,
      commit.body,
      commit.author.name,
      commit.author.email,
      commit.committer.name,
      commit.committer.email,
      ...commit.tags,
    ]
      .join('\n')
      .toLowerCase()
    return searchable.includes(query)
  })
  return { commits: filtered.slice(skip, skip + limit) }
}

function changedFileKind(status) {
  if (status.startsWith('A')) return 'New'
  if (status.startsWith('D')) return 'Deleted'
  if (status.startsWith('R')) return 'Renamed'
  if (status.startsWith('C')) return 'Copied'
  return 'Modified'
}

async function getCommitDetails(repoPath, sha) {
  const parentResult = await git(['rev-parse', `${sha}^`], repoPath, [0, 128])
  const parent =
    parentResult.exitCode === 0 ? parentResult.stdout.trim() : EMPTY_TREE_SHA
  const raw = await git(
    [
      'diff-tree',
      '--root',
      '--no-commit-id',
      '--raw',
      '-r',
      '-M',
      '-C',
      '-z',
      sha,
    ],
    repoPath
  )
  const files = parseRawChangedFiles(raw.stdout, sha, parent)
  const stats = await git(['show', '--format=', '--numstat', sha], repoPath)
  let linesAdded = 0
  let linesDeleted = 0
  for (const line of stats.stdout.split('\n')) {
    const [added, deleted] = line.split('\t')
    if (/^\d+$/.test(added)) linesAdded += Number(added)
    if (/^\d+$/.test(deleted)) linesDeleted += Number(deleted)
  }
  return { files, linesAdded, linesDeleted }
}

async function getDiff(repoPath, url) {
  const filePath = requireString(url.searchParams.get('file'), 'file')
  const sha = url.searchParams.get('sha')
  const oldPath = url.searchParams.get('oldPath') || filePath
  const commitish = url.searchParams.get('commitish') || sha
  const parentCommitish = url.searchParams.get('parentCommitish')
  const parentResult = commitish
    ? await git(['rev-parse', `${commitish}^`], repoPath, [0, 128])
    : null
  const parent =
    parentCommitish ||
    (commitish
      ? parentResult?.exitCode === 0
        ? parentResult.stdout.trim()
        : EMPTY_TREE_SHA
      : 'HEAD')
  const args = commitish
    ? parentCommitish
      ? [
          'diff',
          '--no-ext-diff',
          '--no-color',
          parent,
          commitish,
          '--',
          ...(oldPath !== filePath ? [oldPath, filePath] : [filePath]),
        ]
      : [
          'diff',
          '--no-ext-diff',
          '--no-color',
          parent,
          commitish,
          '--',
          filePath,
        ]
    : ['diff', '--no-ext-diff', '--no-color', 'HEAD', '--', filePath]
  let result = await git(args, repoPath, [0, 1])

  if (!commitish && result.stdout.length === 0) {
    result = await git(
      ['diff', '--no-index', '--no-color', '--', '/dev/null', filePath],
      repoPath,
      [0, 1]
    )
  }
  const submoduleUrl = await git(
    ['config', '--get', `submodule.${filePath}.url`],
    repoPath,
    [0, 1]
  )
  const image = await getDiffImage(
    repoPath,
    filePath,
    commitish ? parent : 'HEAD',
    commitish || null,
    commitish ? null : filePath,
    oldPath
  )
  return {
    patch: result.stdout,
    image,
    fileContents: await getDiffFileContents(
      repoPath,
      filePath,
      commitish ? parent : 'HEAD',
      commitish || null,
      oldPath,
      commitish ? null : filePath
    ),
    submoduleUrl:
      submoduleUrl.exitCode === 0 ? submoduleUrl.stdout.trim() || null : null,
    fullPath: path.join(repoPath, filePath),
  }
}

async function getComparison(repoPath, url) {
  const branch = requireString(url.searchParams.get('branch'), 'branch')
  const mode = url.searchParams.get('mode') === 'Ahead' ? 'Ahead' : 'Behind'
  const count = await git(
    ['rev-list', '--left-right', '--count', `HEAD...${branch}`],
    repoPath
  )
  const [ahead, behind] = count.stdout.trim().split(/\s+/).map(Number)
  const compareUrl = new URL(url)
  compareUrl.searchParams.set(
    'ref',
    mode === 'Ahead' ? `${branch}..HEAD` : `HEAD..${branch}`
  )
  return { ahead, behind, ...(await getHistory(repoPath, compareUrl)) }
}

const allowedOperations = new Set(webOperationNames)

function combinedResult(results) {
  return {
    stdout: results
      .map(result => result.stdout)
      .filter(Boolean)
      .join('\n'),
    stderr: results
      .map(result => result.stderr)
      .filter(Boolean)
      .join('\n'),
    exitCode: 0,
  }
}

function conflictResolutions(body) {
  if (body.resolutions === undefined) return []
  if (!Array.isArray(body.resolutions))
    throw Object.assign(new Error('resolutions must be an array'), {
      statusCode: 400,
    })
  const resolvedFiles = new Set()
  return body.resolutions.map((item, index) => {
    if (!Array.isArray(item) || item.length !== 2)
      throw Object.assign(
        new Error(`resolution ${index + 1} must contain a file and resolution`),
        { statusCode: 400 }
      )
    const file = requireString(item[0], `resolution ${index + 1} file`)
    const resolution = requireString(item[1], `resolution ${index + 1} value`)
    if (!['ours', 'theirs', 'manual'].includes(resolution))
      throw Object.assign(
        new Error('resolution must be ours, theirs, or manual'),
        { statusCode: 400 }
      )
    if (resolvedFiles.has(file))
      throw Object.assign(
        new Error(
          `conflict resolution for '${file}' was supplied more than once`
        ),
        { statusCode: 400 }
      )
    resolvedFiles.add(file)
    return [file, resolution]
  })
}

async function stageResolvedFiles(repoPath, files, resolutions, allTracked) {
  const resolved = new Set()
  for (const [file, resolution] of resolutions) {
    resolved.add(file)
    if (resolution === 'manual') {
      await git(['add', '--', file], repoPath)
    } else {
      const entry = files.find(item => item.path === file)?.status?.entry
      const chosen = resolution === 'theirs' ? entry?.them : entry?.us

      if (chosen === 'D') {
        await git(['rm', '--', file], repoPath)
      } else {
        await git(['checkout', `--${resolution}`, '--', file], repoPath)
        await git(['add', '--', file], repoPath)
      }
    }
  }
  const filesToStage = files
    .filter(file => {
      if (file.status.kind === 'Untracked' || resolved.has(file.path))
        return false
      return allTracked || file.status.kind === 'Conflicted'
    })
    .map(file => file.path)
  if (filesToStage.length) await git(['add', '--', ...filesToStage], repoPath)
}

async function stageCommitConflictResolutions(
  repoPath,
  resolutions,
  environment
) {
  if (!resolutions.length) return

  const status = await getStatus(repoPath)
  const conflictedPaths = new Set(
    status.workingDirectory.files
      .filter(file => file.status.kind === 'Conflicted')
      .map(file => file.path)
  )

  for (const [file, resolution] of resolutions) {
    const conflict = status.workingDirectory.files.find(
      item => item.path === file
    )
    if (!conflict || !conflictedPaths.has(file))
      throw Object.assign(
        new Error(`'${file}' is not a conflicted file in this repository.`),
        { statusCode: 409 }
      )
    if (
      resolution === 'manual' &&
      (!Number.isInteger(conflict.status.conflictMarkerCount) ||
        conflict.status.conflictMarkerCount > 0)
    )
      throw Object.assign(
        new Error(
          `'${file}' still needs a manual edit or an ours/theirs resolution before it can be staged.`
        ),
        { statusCode: 409 }
      )

    if (resolution === 'ours' || resolution === 'theirs')
      await git(['checkout', `--${resolution}`, '--', file], repoPath)

    await git(['add', '--', file], repoPath)
    await git(['add', '--', file], repoPath, [0], undefined, environment)
  }
}

function assertCommitConflictsResolved(status, selectedFiles, resolutions) {
  const resolved = new Set(resolutions.map(([file]) => file))
  const selected = new Set(selectedFiles)
  const unresolved = status.workingDirectory.files.find(file => {
    if (file.status.kind !== 'Conflicted') return false
    if (resolved.has(file.path)) return false
    return !(
      selected.has(file.path) &&
      Number.isInteger(file.status.conflictMarkerCount) &&
      file.status.conflictMarkerCount === 0
    )
  })
  if (unresolved)
    throw Object.assign(
      new Error(
        `Resolve '${unresolved.path}' before committing, then include its resolved file in the commit.`
      ),
      { statusCode: 409 }
    )
}

async function stagedPatchWithoutConflicts(repoPath, conflictPaths) {
  const exclusions = conflictPaths.map(file => `:(exclude,literal)${file}`)
  return (
    await git(
      ['diff', '--cached', '--binary', '--', '.', ...exclusions],
      repoPath
    )
  ).stdout
}

async function interactiveRebase(
  repoPath,
  base,
  todo,
  message,
  noVerify = false
) {
  const directory = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), 'desktop-plus-rebase-')
  )
  const sequenceEditor = path.join(directory, 'sequence-editor.js')
  const environment = {
    GIT_SEQUENCE_EDITOR: `${process.execPath} ${sequenceEditor}`,
    GIT_EDITOR: ':',
    DESKTOP_PLUS_TODO: Buffer.from(todo).toString('base64'),
  }
  try {
    await fs.promises.writeFile(
      sequenceEditor,
      "require('fs').writeFileSync(process.argv[2], Buffer.from(process.env.DESKTOP_PLUS_TODO, 'base64'))\n"
    )
    if (message?.trim()) {
      const messageEditor = path.join(directory, 'message-editor.js')
      await fs.promises.writeFile(
        messageEditor,
        "require('fs').writeFileSync(process.argv[2], Buffer.from(process.env.DESKTOP_PLUS_MESSAGE, 'base64'))\n"
      )
      environment.GIT_EDITOR = `${process.execPath} ${messageEditor}`
      environment.DESKTOP_PLUS_MESSAGE = Buffer.from(message).toString('base64')
    }
    const rebaseTarget =
      base && (await isRootCommitParentReference(repoPath, base))
        ? ['--root']
        : base
        ? [base]
        : ['--root']
    return await git(
      [
        '-c',
        'rebase.backend=merge',
        'rebase',
        ...(noVerify ? ['--no-verify'] : []),
        '-i',
        ...rebaseTarget,
      ],
      repoPath,
      [0],
      undefined,
      environment
    )
  } finally {
    await fs.promises.rm(directory, { recursive: true, force: true })
  }
}

async function isRootCommitParentReference(repoPath, ref) {
  if (!ref.endsWith('^')) return false
  const commit = ref.slice(0, -1)
  const result = await git(
    ['rev-list', '--parents', '-n', '1', commit],
    repoPath
  )
  return result.stdout.trim().split(/\s+/).length === 1
}

async function continueRebaseWithMessage(
  repoPath,
  args,
  environment,
  message,
  noVerify = false
) {
  const continueArgs = noVerify ? [...args, '--no-verify'] : args
  if (!message?.trim())
    return git(
      continueArgs,
      repoPath,
      [0],
      undefined,
      withGitEnvironment(environment, { GIT_EDITOR: ':' })
    )

  const directory = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), 'desktop-plus-rebase-message-')
  )
  const messageEditor = path.join(directory, 'message-editor.js')
  try {
    await fs.promises.writeFile(
      messageEditor,
      "require('fs').writeFileSync(process.argv[2], Buffer.from(process.env.DESKTOP_PLUS_MESSAGE, 'base64'))\n"
    )
    return await git(
      continueArgs,
      repoPath,
      [0],
      undefined,
      withGitEnvironment(environment, {
        GIT_EDITOR: `${process.execPath} ${messageEditor}`,
        DESKTOP_PLUS_MESSAGE: Buffer.from(message).toString('base64'),
      })
    )
  } finally {
    await fs.promises.rm(directory, { recursive: true, force: true })
  }
}

async function rebaseHistory(repoPath, base) {
  const range =
    base && !(await isRootCommitParentReference(repoPath, base))
      ? `${base}..HEAD`
      : 'HEAD'
  return (await git(['rev-list', '--reverse', range], repoPath)).stdout
    .trim()
    .split('\n')
    .filter(Boolean)
}

async function copyWorktreeIncludeFiles(repoPath, worktreePath) {
  const includePath = path.join(repoPath, '.worktreeinclude')
  let patterns
  try {
    patterns = (await fs.promises.readFile(includePath, 'utf8'))
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
  } catch {
    return
  }
  if (!patterns.length) return

  try {
    const ignored = await git(
      ['ls-files', '--others', '--ignored', '--exclude-standard', '-z'],
      repoPath
    )
    const matcher = ignore().add(patterns)
    const matches = ignored.stdout
      .split('\0')
      .filter(Boolean)
      .filter(file => matcher.ignores(file))
    const root = path.resolve(worktreePath)
    for (const file of matches) {
      const source = path.resolve(repoPath, file)
      const destination = path.resolve(worktreePath, file)
      if (
        !destination.startsWith(`${root}${path.sep}`) ||
        !source.startsWith(`${path.resolve(repoPath)}${path.sep}`)
      )
        continue
      try {
        await fs.promises.mkdir(path.dirname(destination), { recursive: true })
        await fs.promises.copyFile(source, destination)
      } catch {
        // Worktree creation succeeds even when an included file cannot be copied.
      }
    }
  } catch {
    // .worktreeinclude is best-effort, matching the Desktop behavior.
  }
}

async function getWorktreeInclude(repoPath) {
  try {
    const patterns = (
      await fs.promises.readFile(
        path.join(repoPath, '.worktreeinclude'),
        'utf8'
      )
    )
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
    return { configured: patterns.length > 0, patterns }
  } catch {
    return { configured: false, patterns: [] }
  }
}

async function createDesktopStash(repoPath, values, body) {
  const selectedFiles = values.length ? values : null
  let stagedPatch = ''
  let stagedPaths = []
  if (selectedFiles && body.keepIndex === true) {
    stagedPatch = (
      await git(
        ['diff', '--cached', '--binary', '--', ...selectedFiles],
        repoPath
      )
    ).stdout
    stagedPaths = (
      await git(
        ['diff', '--cached', '--name-only', '-z', '--', ...selectedFiles],
        repoPath
      )
    ).stdout
      .split('\0')
      .filter(Boolean)
  }
  if (selectedFiles) await git(['reset', '--', '.'], repoPath)

  const status = await getStatus(repoPath)
  const selected = selectedFiles ? new Set(selectedFiles) : null
  const untracked = status.workingDirectory.files
    .filter(file => file.status.kind === 'Untracked')
    .filter(
      file =>
        body.includeUntracked === true || Boolean(selected?.has(file.path))
    )
    .map(file => file.path)
  if (selectedFiles && untracked.length)
    await git(['add', '--', ...untracked], repoPath)

  const currentBranch = (
    await git(['branch', '--show-current'], repoPath)
  ).stdout.trim()
  const branch =
    body.branchName === undefined
      ? currentBranch
      : requireString(body.branchName, 'stash branch')
  if (!branch)
    throw Object.assign(
      new Error('A checked out branch is required to stash'),
      {
        statusCode: 409,
      }
    )
  const customName =
    body.message === undefined
      ? null
      : requireString(body.message, 'stash message')
  const message = desktopStashMessage(branch, customName)
  const result = await git(
    [
      'stash',
      'push',
      ...(body.includeUntracked === true ? ['--include-untracked'] : []),
      ...(body.keepIndex === true && !selectedFiles ? ['--keep-index'] : []),
      '-m',
      message,
      ...(selectedFiles ? ['--', ...selectedFiles] : []),
    ],
    repoPath
  )
  if (stagedPatch)
    return combinedResult([
      result,
      ...(await (async () => {
        const applied = await git(
          ['apply', '--cached', '--binary', '-'],
          repoPath,
          [0],
          stagedPatch
        )
        if (!stagedPaths.length) return [applied]
        return [
          applied,
          await git(['restore', '--worktree', '--', ...stagedPaths], repoPath),
        ]
      })()),
    ])
  return result
}

function checkoutWasBlockedByLocalChanges(error) {
  const result = error && typeof error === 'object' ? error.result : null
  const detail = [
    error instanceof Error ? error.message : String(error),
    result?.stdout || '',
    result?.stderr || '',
  ].join('\n')
  return /(?:would be overwritten by checkout|would be overwritten by merge|local changes .*(?:would be|will be) overwritten|please commit your changes or stash them)/i.test(
    detail
  )
}

async function checkoutWithChanges(
  repoPath,
  args,
  gitEnvironment,
  leaveChangesStashed = false
) {
  const currentBranch = (
    await git(['branch', '--show-current'], repoPath)
  ).stdout.trim()
  const status = await getStatus(repoPath)
  if (!status.workingDirectory.files.length)
    return git(args, repoPath, [0], undefined, gitEnvironment)
  if (!currentBranch)
    throw Object.assign(
      new Error('Cannot preserve changes while not on a branch.'),
      { statusCode: 409 }
    )

  const previousStashTip = (
    await git(['rev-parse', '--verify', 'refs/stash'], repoPath, [0, 128])
  ).stdout.trim()
  const stashName = `Changes before switching branches ${Date.now()}`
  const stashResult = await createDesktopStash(repoPath, [], {
    includeUntracked: true,
    message: stashName,
  })
  const stashSha = (
    await git(['rev-parse', '--verify', 'refs/stash'], repoPath)
  ).stdout.trim()
  if (!stashSha || stashSha === previousStashTip)
    throw Object.assign(
      new Error('The temporary checkout stash could not be identified safely.'),
      { statusCode: 409 }
    )
  const temporaryStashRef = 'stash@{0}'

  let stashApplied = false
  try {
    const result = await git(args, repoPath, [0], undefined, gitEnvironment)
    await updateSubmodules(repoPath, [], false, gitEnvironment)
    if (leaveChangesStashed) return combinedResult([stashResult, result])
    const applied = await applyDesktopStash(repoPath, temporaryStashRef, true)
    stashApplied = true
    return combinedResult([stashResult, result, applied])
  } catch (error) {
    // If checkout or submodule setup failed before the pop, return to the
    // source branch and restore the user's changes. A conflicted pop returns a
    // normal result and deliberately retains the stash for the visible
    // conflict-recovery workflow.
    if (!stashApplied) {
      const branchBeforeRollback = (
        await git(['branch', '--show-current'], repoPath, [0, 1])
      ).stdout.trim()
      if (branchBeforeRollback && branchBeforeRollback !== currentBranch) {
        await git(['reset', '--hard', currentBranch], repoPath, [0, 1]).catch(
          () => {}
        )
        const switched = await git(
          ['checkout', '--force', currentBranch],
          repoPath,
          [0, 1]
        ).catch(() => null)
        const actualBranch = (
          await git(['branch', '--show-current'], repoPath, [0, 1])
        ).stdout.trim()
        if (!switched || actualBranch !== currentBranch) {
          await git(
            ['symbolic-ref', 'HEAD', `refs/heads/${currentBranch}`],
            repoPath,
            [0, 1]
          ).catch(() => {})
          await git(['reset', '--hard', currentBranch], repoPath, [0, 1]).catch(
            () => {}
          )
        }
      }
      await applyDesktopStash(repoPath, temporaryStashRef, true).catch(() => {})
    }
    throw error
  }
}

async function applyDesktopStash(repoPath, stash, pop) {
  const result = await git(
    ['stash', pop ? 'pop' : 'apply', stash],
    repoPath,
    [0, 1]
  )
  if (result.exitCode === 0) return result

  const status = await getStatus(repoPath)
  if (
    status.workingDirectory.files.some(
      file => file.status.kind === 'Conflicted'
    )
  )
    return result

  // Git occasionally reports exit code 1 after a successful stash pop without
  // diagnostic output. Desktop treats that as a completed pop and drops it.
  if (pop && !result.stderr.trim()) {
    return combinedResult([
      result,
      await git(['stash', 'drop', stash], repoPath),
    ])
  }
  throw Object.assign(
    new Error(
      result.stderr.trim() || `git stash ${pop ? 'pop' : 'apply'} failed`
    ),
    { statusCode: 400, result }
  )
}

async function undoLatestCommit(repoPath) {
  const parent = await git(
    ['rev-parse', '--verify', 'HEAD^'],
    repoPath,
    [0, 128]
  )
  if (parent.exitCode === 0)
    return git(['reset', '--mixed', parent.stdout.trim()], repoPath)

  // Match Desktop's initial-commit undo: restore files deleted after the
  // commit, make the branch unborn, then leave every former commit file
  // unstaged in the working directory.
  const status = await getStatus(repoPath)
  const deletedPaths = status.workingDirectory.files
    .filter(file => file.status.kind === 'Deleted')
    .map(file => file.path)
  const restored = deletedPaths.length
    ? await git(
        ['restore', '--source=HEAD', '--worktree', '--', ...deletedPaths],
        repoPath
      )
    : { stdout: '', stderr: '', exitCode: 0 }
  const deletedHead = await git(
    ['update-ref', '-d', 'HEAD', '-m', 'Reverting first commit'],
    repoPath
  )
  const unstaged = await git(['reset', '--', '.'], repoPath)
  return combinedResult([restored, deletedHead, unstaged])
}

async function updateSubmodules(repoPath, paths = [], force = false, env) {
  const strategy = env?.DESKTOP_PLUS_SUBMODULE_STRATEGY || 'checkout'
  if (!['checkout', 'merge', 'rebase'].includes(strategy))
    throw Object.assign(
      new Error('submoduleStrategy must be checkout, merge, or rebase'),
      { statusCode: 400 }
    )
  return git(
    [
      'submodule',
      'update',
      '--init',
      '--recursive',
      ...(force ? ['--force'] : []),
      ...(strategy === 'merge' ? ['--merge'] : []),
      ...(strategy === 'rebase' ? ['--rebase'] : []),
      ...(paths.length ? ['--', ...paths] : []),
    ],
    repoPath,
    [0],
    undefined,
    env
  )
}

async function selectedSubmodulePaths(repoPath, paths) {
  if (!paths.length) return []
  const result = await git(
    ['ls-files', '--stage', '-z', '--', ...paths],
    repoPath
  )
  return result.stdout.split('\0').flatMap(record => {
    const tab = record.indexOf('\t')
    if (tab < 0 || !record.startsWith('160000 ')) return []
    return [record.slice(tab + 1)]
  })
}

async function pullArguments(repoPath, body) {
  const pullFF = await git(
    ['config', '--get', 'pull.ff'],
    repoPath,
    [0, 1, 128]
  )
  const strategy = body.pullStrategy
  if (
    strategy !== undefined &&
    !['merge', 'rebase', 'ff-only'].includes(strategy)
  )
    throw Object.assign(
      new Error('pullStrategy must be merge, rebase, or ff-only'),
      { statusCode: 400 }
    )
  const strategyArguments =
    strategy === 'merge'
      ? ['--no-rebase']
      : strategy === 'rebase'
      ? ['--rebase']
      : strategy === 'ff-only'
      ? ['--ff-only']
      : pullFF.exitCode === 1
      ? ['--ff']
      : []
  return [
    '-c',
    'rebase.backend=merge',
    'pull',
    ...strategyArguments,
    '--recurse-submodules',
    ...(body.noVerify === true ? ['--no-verify'] : []),
  ]
}

async function fetchAll(repoPath, env) {
  return git(
    ['fetch', '--all', '--prune', '--recurse-submodules=on-demand'],
    repoPath,
    [0],
    undefined,
    env
  )
}

async function getFastForwardBranches(repoPath, branchName = null) {
  const result = await git(
    [
      'for-each-ref',
      '--format=%(refname)%00%(objectname)%00%(upstream)%00%(HEAD)%00%(worktreepath)',
      'refs/heads',
      'refs/remotes',
    ],
    repoPath
  )
  const repositoryPath = path.resolve(repoPath)
  const remoteShas = new Map()
  const localBranches = []
  for (const row of result.stdout.split('\n').filter(Boolean)) {
    const [ref, sha, upstream, head, worktreePath] = row.split('\0')
    if (ref.startsWith('refs/remotes/')) {
      remoteShas.set(ref, sha)
      continue
    }
    if (!ref.startsWith('refs/heads/')) continue
    const name = ref.slice('refs/heads/'.length)
    if (branchName !== null && name !== branchName) continue
    if (!upstream || head === '*') continue
    if (worktreePath && path.resolve(worktreePath) !== repositoryPath) continue
    localBranches.push({ ref, sha, upstream })
  }
  return localBranches.filter(
    branch =>
      remoteShas.has(branch.upstream) &&
      remoteShas.get(branch.upstream) !== branch.sha
  )
}

async function fastForwardBranches(repoPath, branchName = null) {
  const branches = await getFastForwardBranches(repoPath, branchName)
  if (branches.length === 0) return { stdout: '', stderr: '', exitCode: 0 }
  return git(
    ['fetch', '.', '--show-forced-updates', '--no-write-fetch-head', '--stdin'],
    repoPath,
    [0, 1],
    branches.map(branch => `${branch.upstream}:${branch.ref}`).join('\n'),
    { GIT_REFLOG_ACTION: 'pull' }
  )
}

async function fastForwardBranch(repoPath, branchName, env) {
  const fetched = await fetchAll(repoPath, env)
  const result = await fastForwardBranches(repoPath, branchName)
  if (result.exitCode !== 0)
    throw Object.assign(
      new Error(
        `The branch '${branchName}' cannot be fast-forwarded. Switch to it and pull it manually.`
      ),
      { statusCode: 409 }
    )
  return combinedResult([fetched, result])
}

async function pushArguments(repoPath, body) {
  const currentBranch = (
    await git(['branch', '--show-current'], repoPath)
  ).stdout.trim()
  if (!currentBranch)
    throw Object.assign(
      new Error('The current repository is in a detached HEAD state.'),
      { statusCode: 409 }
    )

  const [configuredRemote, configuredMerge, remotes] = await Promise.all([
    git(
      ['config', '--get', `branch.${currentBranch}.remote`],
      repoPath,
      [0, 1]
    ),
    git(['config', '--get', `branch.${currentBranch}.merge`], repoPath, [0, 1]),
    git(['remote'], repoPath),
  ])
  const remote =
    configuredRemote.exitCode === 0 && configuredRemote.stdout.trim()
      ? configuredRemote.stdout.trim()
      : remotes.stdout.split(/\r?\n/).filter(Boolean).includes('origin')
      ? 'origin'
      : remotes.stdout.split(/\r?\n/).filter(Boolean)[0]
  if (!remote)
    throw Object.assign(new Error('No remotes are configured'), {
      statusCode: 409,
    })

  const remoteBranch =
    configuredMerge.exitCode === 0
      ? configuredMerge.stdout.trim().replace(/^refs\/heads\//, '')
      : null
  const tags = Array.isArray(body.tagsToPush)
    ? body.tagsToPush.map(
        (tag, index) => `refs/tags/${requireGitValue(tag, `tag ${index + 1}`)}`
      )
    : []
  return [
    'push',
    ...(body.noVerify === true ? ['--no-verify'] : []),
    remote,
    remoteBranch ? `${currentBranch}:${remoteBranch}` : currentBranch,
    ...tags,
    ...(remoteBranch
      ? body.force
        ? ['--force-with-lease']
        : []
      : ['--set-upstream']),
  ]
}

async function renameBranch(repoPath, oldName, newName, force) {
  let result
  try {
    result = await git(
      ['branch', force ? '-M' : '-m', oldName, newName],
      repoPath
    )
  } catch (error) {
    if (
      force ||
      !/branch named ['"].+['"] already exists/i.test(String(error.message))
    )
      throw error
    const names = (
      await git(
        ['for-each-ref', '--format=%(refname:short)', 'refs/heads'],
        repoPath
      )
    ).stdout
      .split(/\r?\n/)
      .filter(Boolean)
    const caseOnlyRename =
      !names.includes(newName) &&
      names.some(
        name => name.toLocaleLowerCase() === newName.toLocaleLowerCase()
      )
    if (!caseOnlyRename) throw error
    result = await git(['branch', '-M', oldName, newName], repoPath)
  }
  return combinedResult([
    result,
    ...(await renameDesktopStashesForBranch(repoPath, oldName, newName)),
  ])
}

function requireHistoryCommits(history, commits, name) {
  if (!commits.length)
    throw Object.assign(new Error(`${name} commits are required`), {
      statusCode: 400,
    })
  const historySet = new Set(history)
  for (const commit of commits) {
    if (!historySet.has(commit))
      throw Object.assign(
        new Error(`${name} commit ${commit} is not in the rebase range`),
        { statusCode: 400 }
      )
  }
}

async function runOperation(repoPath, body, services = null) {
  const operation = requireString(body.operation, 'operation')
  if (!allowedOperations.has(operation))
    throw Object.assign(new Error('Unsupported operation'), { statusCode: 400 })
  const values = Array.isArray(body.values)
    ? body.values.map(value => requireString(value, 'operation value'))
    : []
  const value = (index, name) => requireGitValue(values[index], name)
  let args
  let continueRebaseMessage = null
  let gitEnvironment = await gitOperationAuthenticationEnvironment(
    repoPath,
    body,
    services,
    operation,
    values
  )
  gitEnvironment = interactiveSSHEnvironment(
    gitEnvironment,
    operationContext.getStore(),
    services
  )
  switch (operation) {
    case 'prune-branches':
      return pruneBranches(repoPath, body)
    case 'fetch':
      return combinedResult([
        await fetchAll(repoPath, gitEnvironment),
        await fastForwardBranches(repoPath),
      ])
    case 'update-from-default': {
      const branchData = await getBranches(repoPath)
      const currentBranch = branchData.branch?.name
      const defaultBranch = body.defaultBranch
        ? requireGitValue(body.defaultBranch, 'default branch')
        : branchData.defaultBranch
      if (!currentBranch)
        throw Object.assign(
          new Error(
            'Update from the default branch requires a current branch.'
          ),
          { statusCode: 409 }
        )
      if (!defaultBranch)
        throw Object.assign(
          new Error(
            'This repository does not have a default branch configured.'
          ),
          { statusCode: 409 }
        )
      if (currentBranch === defaultBranch)
        throw Object.assign(
          new Error('The current branch is already the default branch.'),
          { statusCode: 409 }
        )
      const strategy =
        body.updateStrategy === undefined ? 'merge' : body.updateStrategy
      if (strategy !== 'merge' && strategy !== 'rebase')
        throw Object.assign(
          new Error('updateStrategy must be merge or rebase'),
          { statusCode: 400 }
        )
      const fetched = await fetchAll(repoPath, gitEnvironment)
      const remoteTargets = (branchData.remotes || [])
        .map(remote => `refs/remotes/${remote.name}/${defaultBranch}`)
        .filter(Boolean)
      let targetRef = defaultBranch
      for (const candidate of remoteTargets) {
        const verified = await git(
          ['rev-parse', '--verify', candidate],
          repoPath,
          [0, 128]
        )
        if (verified.exitCode === 0) {
          targetRef = candidate
          break
        }
      }
      const localTarget = await git(
        ['rev-parse', '--verify', defaultBranch],
        repoPath,
        [0, 128]
      )
      if (localTarget.exitCode !== 0 && targetRef === defaultBranch)
        throw Object.assign(
          new Error(
            `The default branch '${defaultBranch}' does not exist locally or on a fetched remote.`
          ),
          { statusCode: 409 }
        )
      const updated = await git(
        strategy === 'rebase'
          ? ['rebase', targetRef]
          : ['merge', '--no-edit', targetRef],
        repoPath,
        [0],
        undefined,
        gitEnvironment
      )
      return combinedResult([fetched, updated])
    }
    case 'fetch-refspec': {
      const refspec = value(0, 'refspec')
      const remotes = (await git(['remote'], repoPath)).stdout
        .split(/\r?\n/)
        .filter(Boolean)
      if (!remotes.length)
        throw Object.assign(new Error('No remotes are configured'), {
          statusCode: 409,
        })
      return combinedResult(
        await Promise.all(
          remotes.map(remote =>
            git(
              ['fetch', remote, refspec],
              repoPath,
              [0, 128],
              undefined,
              gitEnvironment
            )
          )
        )
      )
    }
    case 'pull':
      return combinedResult([
        await git(
          await pullArguments(repoPath, body),
          repoPath,
          [0],
          undefined,
          gitEnvironment
        ),
        await fastForwardBranches(repoPath),
      ])
    case 'push':
      return git(
        await pushArguments(repoPath, body),
        repoPath,
        [0],
        undefined,
        gitEnvironment
      )
    case 'publish-branch':
      args = [
        'push',
        ...(body.noVerify === true ? ['--no-verify'] : []),
        '-u',
        value(0, 'remote'),
        value(1, 'branch'),
      ]
      break
    case 'checkout':
      args = [
        'checkout',
        ...(body.createLocalBranch
          ? [
              '--track',
              '-b',
              requireGitValue(body.createLocalBranch, 'local branch'),
              value(0, 'branch'),
            ]
          : [value(0, 'branch')]),
      ]
      break
    case 'checkout-commit':
      args = ['checkout', value(0, 'commit')]
      break
    case 'create-branch':
      args =
        body.checkout === true
          ? [
              'checkout',
              ...(body.noTrack === true ? ['--no-track'] : []),
              '-b',
              value(0, 'branch'),
              ...(values[1] ? [value(1, 'start point')] : []),
            ]
          : [
              'branch',
              value(0, 'branch'),
              ...(values[1] ? [value(1, 'start point')] : []),
              ...(body.noTrack === true ? ['--no-track'] : []),
            ]
      break
    case 'rename-branch':
      return renameBranch(
        repoPath,
        value(0, 'branch'),
        value(1, 'new branch'),
        body.force === true
      )
    case 'delete-branch':
      args = ['branch', '-D', value(0, 'branch')]
      break
    case 'delete-branches': {
      if (!values.length)
        throw Object.assign(new Error('branches are required'), {
          statusCode: 400,
        })
      const branches = values.map((_, index) => value(index, 'branch'))
      const currentBranch = (
        await git(['branch', '--show-current'], repoPath)
      ).stdout.trim()
      const worktreeRows = (
        await git(['worktree', 'list', '--porcelain', '-z'], repoPath)
      ).stdout
        .replace(/\0$/, '')
        .split('\0\0')
        .filter(Boolean)
      const checkedOut = new Set(
        worktreeRows.flatMap(row => {
          const ref = row.split('\0').find(line => line.startsWith('branch '))
          return ref
            ? [ref.slice('branch '.length).replace(/^refs\/heads\//, '')]
            : []
        })
      )
      const blocked = branches.find(
        branch => branch === currentBranch || checkedOut.has(branch)
      )
      if (blocked)
        throw Object.assign(
          new Error(
            `Cannot delete '${blocked}' because it is checked out in a worktree.`
          ),
          { statusCode: 409 }
        )
      return combinedResult(
        await Promise.all(
          branches.map(branch => git(['branch', '-D', branch], repoPath))
        )
      )
    }
    case 'delete-remote-branch':
      args = ['push', value(0, 'remote'), '--delete', value(1, 'branch')]
      break
    case 'stash':
      return createDesktopStash(repoPath, values, body)
    case 'stash-apply':
      return applyDesktopStash(
        repoPath,
        values[0] ? value(0, 'stash') : 'stash@{0}',
        false
      )
    case 'stash-pop':
      return applyDesktopStash(
        repoPath,
        values[0] ? value(0, 'stash') : 'stash@{0}',
        true
      )
    case 'stash-drop':
      args = ['stash', 'drop', values[0] ? value(0, 'stash') : 'stash@{0}']
      break
    case 'undo':
      return undoLatestCommit(repoPath)
    case 'reset-commit':
      args = [
        'reset',
        body.mode === 'hard' ? '--hard' : '--mixed',
        value(0, 'commit'),
      ]
      break
    case 'revert':
      args = [
        'revert',
        ...(body.mainline === true ? ['-m', '1'] : []),
        ...(body.noVerify === true ? ['--no-verify'] : []),
        value(0, 'commit'),
      ]
      gitEnvironment = withGitEnvironment(gitEnvironment, { GIT_EDITOR: ':' })
      break
    case 'cherry-pick': {
      const branch = (
        await git(['branch', '--show-current'], repoPath)
      ).stdout.trim()
      const originalTip = (
        await git(['rev-parse', '--verify', 'HEAD'], repoPath)
      ).stdout.trim()
      args = [
        'cherry-pick',
        ...values.map((_, index) => value(index, 'commit')),
        '--empty=keep',
        '-m',
        '1',
      ]
      const result = await git(args, repoPath, [0], undefined, gitEnvironment)
      if (result.exitCode !== 0 || !branch || !originalTip) return result
      const rewrittenTip = (
        await git(['rev-parse', '--verify', 'HEAD'], repoPath)
      ).stdout.trim()
      return {
        ...result,
        ...(rewrittenTip && rewrittenTip !== originalTip
          ? {
              undo: {
                branch,
                originalTip,
                rewrittenTip,
              },
            }
          : {}),
      }
    }
    case 'continue-cherry-pick': {
      const status = await getStatus(repoPath)
      if (status.operation !== 'cherryPick')
        throw Object.assign(new Error('No cherry-pick is in progress'), {
          statusCode: 409,
        })
      await stageResolvedFiles(
        repoPath,
        status.workingDirectory.files,
        conflictResolutions(body),
        true
      )
      const remaining = await getStatus(repoPath)
      if (
        !remaining.workingDirectory.files.some(
          file => file.status.kind !== 'Untracked'
        )
      )
        return git(
          [
            'commit',
            '--allow-empty',
            ...(body.noVerify === true ? ['--no-verify'] : []),
          ],
          repoPath,
          [0],
          undefined,
          withGitEnvironment(gitEnvironment, { GIT_EDITOR: ':' })
        )
      args = [
        'cherry-pick',
        '--continue',
        ...(body.noVerify === true ? ['--no-verify'] : []),
      ]
      gitEnvironment = withGitEnvironment(gitEnvironment, { GIT_EDITOR: ':' })
      break
    }
    case 'abort-cherry-pick':
      return combinedResult([
        await git(['cherry-pick', '--abort'], repoPath),
        ...(values[0]
          ? [await git(['checkout', value(0, 'source branch')], repoPath)]
          : []),
      ])
    case 'merge':
      args = [
        'merge',
        ...(body.noVerify === true ? ['--no-verify'] : []),
        value(0, 'branch'),
      ]
      gitEnvironment = withGitEnvironment(gitEnvironment, { GIT_EDITOR: ':' })
      break
    case 'squash-merge':
      return combinedResult([
        await git(
          [
            'merge',
            '--squash',
            ...(body.noVerify === true ? ['--no-verify'] : []),
            value(0, 'branch'),
          ],
          repoPath,
          [0],
          undefined,
          gitEnvironment
        ),
        await git(
          [
            'commit',
            '--no-edit',
            ...(body.noVerify === true ? ['--no-verify'] : []),
          ],
          repoPath,
          [0],
          undefined,
          withGitEnvironment(gitEnvironment, { GIT_EDITOR: ':' })
        ),
      ])
    case 'rebase':
      args = [
        '-c',
        'rebase.backend=merge',
        'rebase',
        ...(body.noVerify === true ? ['--no-verify'] : []),
        value(0, 'base branch'),
        ...(values[1] ? [value(1, 'target branch')] : []),
      ]
      break
    case 'continue-rebase': {
      const status = await getStatus(repoPath)
      if (status.operation !== 'rebase')
        throw Object.assign(new Error('No rebase is in progress'), {
          statusCode: 409,
        })
      await stageResolvedFiles(
        repoPath,
        status.workingDirectory.files,
        conflictResolutions(body),
        true
      )
      const remaining = await getStatus(repoPath)
      args = [
        'rebase',
        remaining.workingDirectory.files.some(
          file => file.status.kind !== 'Untracked'
        )
          ? '--continue'
          : '--skip',
      ]
      continueRebaseMessage =
        body.message === undefined
          ? null
          : requireString(body.message, 'message')
      break
    }
    case 'skip-rebase':
      args = [
        'rebase',
        '--skip',
        ...(body.noVerify === true ? ['--no-verify'] : []),
      ]
      gitEnvironment = withGitEnvironment(gitEnvironment, { GIT_EDITOR: ':' })
      break
    case 'abort-merge':
      return (await gitPathExists(repoPath, 'REVERT_HEAD'))
        ? git(['revert', '--abort'], repoPath)
        : git(['merge', '--abort'], repoPath)
    case 'abort-rebase':
      args = ['rebase', '--abort']
      break
    case 'abort-squash':
      // A squash merge has no Git abort command. Resetting to the current tip
      // restores the index and worktree without discarding the pre-merge commit.
      return git(['reset', '--hard', 'HEAD'], repoPath)
    case 'remote-add':
      return combinedResult([
        await git(
          [
            'remote',
            'add',
            value(0, 'remote'),
            requireGitValue(values[1], 'URL'),
          ],
          repoPath
        ),
        await git(
          [
            'fetch',
            '--prune',
            '--recurse-submodules=on-demand',
            value(0, 'remote'),
          ],
          repoPath,
          [0],
          undefined,
          gitEnvironment
        ),
      ])
    case 'remote-set-url':
      args = [
        'remote',
        'set-url',
        value(0, 'remote'),
        requireGitValue(values[1], 'URL'),
      ]
      break
    case 'remote-remove':
      args = ['remote', 'remove', value(0, 'remote')]
      break
    case 'tag-create':
      args = [
        'tag',
        '-a',
        value(0, 'tag'),
        '-m',
        body.message === undefined ? '' : requireText(body.message, 'message'),
        ...(values[1] ? [value(1, 'commit')] : []),
      ]
      break
    case 'tag-delete':
      args = ['tag', '-d', value(0, 'tag')]
      break
    case 'delete-remote-tag':
      args = ['push', value(0, 'remote'), '--delete', value(1, 'tag')]
      break
    case 'worktree-add':
      args = [
        'worktree',
        'add',
        ...(body.createBranch
          ? ['-b', requireGitValue(body.createBranch, 'new branch')]
          : []),
        requireAbsolutePath(body.worktreePath || values[0], 'worktree path'),
        ...(body.commitish
          ? [requireGitValue(body.commitish, 'commit-ish')]
          : values[1]
          ? [value(1, 'branch')]
          : []),
      ]
      break
    case 'worktree-move':
      args = [
        'worktree',
        'move',
        requireAbsolutePath(values[0], 'worktree path'),
        requireAbsolutePath(values[1], 'new path'),
      ]
      break
    case 'worktree-remove':
      args = [
        'worktree',
        'remove',
        ...(body.force ? ['--force'] : []),
        requireAbsolutePath(values[0], 'worktree path'),
      ]
      break
    case 'worktree-prune': {
      const worktreePath = requireAbsolutePath(values[0], 'worktree path')
      const worktreeRows = (
        await git(['worktree', 'list', '--porcelain', '-z'], repoPath)
      ).stdout
        .replace(/\0$/, '')
        .split('\0\0')
        .filter(Boolean)
      const prunable = worktreeRows.some(row => {
        const lines = row.split('\0')
        const candidate = lines
          .find(line => line.startsWith('worktree '))
          ?.slice('worktree '.length)
        return (
          candidate &&
          normalizeWorktreePath(repoPath, candidate) ===
            normalizeWorktreePath(repoPath, worktreePath) &&
          lines.some(line => line.startsWith('prunable'))
        )
      })
      if (!prunable)
        throw Object.assign(
          new Error('The selected worktree is not marked prunable.'),
          { statusCode: 409 }
        )
      args = ['worktree', 'prune', '--expire', 'now']
      break
    }
    case 'submodule-update':
      return updateSubmodules(repoPath, values, body.force === true, {
        ...gitEnvironment,
        DESKTOP_PLUS_SUBMODULE_STRATEGY:
          body.submoduleStrategy === undefined
            ? 'checkout'
            : requireString(body.submoduleStrategy, 'submodule strategy'),
      })
    case 'fast-forward':
      return fastForwardBranch(repoPath, value(0, 'branch'), gitEnvironment)
    case 'undo-history-rewrite': {
      const branch = value(0, 'branch')
      const undoSha = value(1, 'original commit')
      const expectedTip = value(2, 'rewritten commit')
      const status = await getStatus(repoPath)
      if (status.workingDirectory.files.length > 0)
        throw Object.assign(
          new Error('Cannot undo a history rewrite while local changes exist.'),
          { statusCode: 409 }
        )
      const currentBranch = (
        await git(['branch', '--show-current'], repoPath)
      ).stdout.trim()
      if (currentBranch !== branch)
        throw Object.assign(
          new Error(
            `Cannot undo the rewrite because '${branch}' is not checked out.`
          ),
          { statusCode: 409 }
        )
      const currentTip = (
        await git(['rev-parse', '--verify', 'HEAD'], repoPath)
      ).stdout.trim()
      if (currentTip !== expectedTip)
        throw Object.assign(
          new Error(
            'Cannot undo the rewrite because the branch has changed since the operation completed.'
          ),
          { statusCode: 409 }
        )
      return git(['reset', '--hard', undoSha], repoPath)
    }
    case 'undo-cherry-pick': {
      const branch = value(0, 'branch')
      const undoSha = value(1, 'original commit')
      const expectedTip = value(2, 'cherry-picked commit')
      const sourceBranch = values[3] || null
      const branchCreated = body.branchCreated === true
      const status = await getStatus(repoPath)
      if (status.workingDirectory.files.length > 0)
        throw Object.assign(
          new Error('Cannot undo a cherry-pick while local changes exist.'),
          { statusCode: 409 }
        )
      const currentBranch = (
        await git(['branch', '--show-current'], repoPath)
      ).stdout.trim()
      if (currentBranch !== branch)
        throw Object.assign(
          new Error(
            `Cannot undo the cherry-pick because '${branch}' is not checked out.`
          ),
          { statusCode: 409 }
        )
      const currentTip = (
        await git(['rev-parse', '--verify', 'HEAD'], repoPath)
      ).stdout.trim()
      if (currentTip !== expectedTip)
        throw Object.assign(
          new Error(
            'Cannot undo the cherry-pick because the branch has changed since the operation completed.'
          ),
          { statusCode: 409 }
        )
      if (branchCreated) {
        if (!sourceBranch)
          throw Object.assign(
            new Error(
              'Cannot undo a cherry-pick on a new branch without its source branch.'
            ),
            { statusCode: 409 }
          )
        const sourceExists = await git(
          ['show-ref', '--verify', '--quiet', `refs/heads/${sourceBranch}`],
          repoPath,
          [0, 1]
        )
        if (sourceExists.exitCode !== 0)
          throw Object.assign(
            new Error(
              `Cannot undo the cherry-pick because source branch '${sourceBranch}' no longer exists.`
            ),
            { statusCode: 409 }
          )
        return combinedResult([
          await git(['checkout', sourceBranch], repoPath),
          await git(['branch', '-D', branch], repoPath),
        ])
      }
      const results = [await git(['reset', '--hard', undoSha], repoPath)]
      if (sourceBranch && sourceBranch !== branch) {
        const sourceExists = await git(
          ['show-ref', '--verify', '--quiet', `refs/heads/${sourceBranch}`],
          repoPath,
          [0, 1]
        )
        if (sourceExists.exitCode === 0)
          results.push(await git(['checkout', sourceBranch], repoPath))
      }
      return combinedResult(results)
    }
    case 'resolve-conflict': {
      const file = requireString(values[0], 'file')
      const resolution = values[1]
      if (resolution === 'manual') return git(['add', '--', file], repoPath)
      if (!['ours', 'theirs'].includes(resolution))
        throw Object.assign(
          new Error('resolution must be ours, theirs, or manual'),
          { statusCode: 400 }
        )
      return combinedResult([
        await git(['checkout', `--${resolution}`, '--', file], repoPath),
        await git(['add', '--', file], repoPath),
      ])
    }
    case 'finish-merge': {
      const status = await getStatus(repoPath)
      if (
        status.operation !== 'merge' &&
        status.operation !== 'revert' &&
        status.operation !== 'squash'
      )
        throw Object.assign(new Error('No merge is in progress'), {
          statusCode: 409,
        })
      await stageResolvedFiles(
        repoPath,
        status.workingDirectory.files,
        conflictResolutions(body),
        false
      )
      return git(
        [
          'commit',
          '--no-edit',
          '--cleanup=strip',
          ...(body.noVerify === true ? ['--no-verify'] : []),
        ],
        repoPath,
        [0],
        undefined,
        { GIT_EDITOR: ':' }
      )
    }
    case 'reorder-commits': {
      const base = body.base ? requireGitValue(body.base, 'base commit') : null
      const commits = Array.isArray(body.commits)
        ? body.commits.map((item, index) =>
            requireGitValue(item, `commit ${index + 1}`)
          )
        : []
      const before = body.before
        ? requireGitValue(body.before, 'before commit')
        : null
      const history = await rebaseHistory(repoPath, base)
      requireHistoryCommits(history, commits, 'reorder')
      const moved = new Set(commits)
      if (before && !history.includes(before))
        throw Object.assign(
          new Error('The commit to reorder before is not in the rebase range'),
          { statusCode: 400 }
        )
      if (before && moved.has(before))
        throw Object.assign(
          new Error('The commit to reorder before cannot also be moved'),
          { statusCode: 400 }
        )
      const movedInHistoryOrder = history.filter(sha => moved.has(sha))
      const remaining = history.filter(sha => !moved.has(sha))
      const insertionIndex = before
        ? remaining.indexOf(before)
        : remaining.length
      const reordered = [
        ...remaining.slice(0, insertionIndex),
        ...movedInHistoryOrder,
        ...remaining.slice(insertionIndex),
      ]
      const originalTip = (
        await git(['rev-parse', '--verify', 'HEAD'], repoPath)
      ).stdout.trim()
      const branch = (
        await git(['branch', '--show-current'], repoPath)
      ).stdout.trim()
      if (!branch)
        throw Object.assign(
          new Error('A checked out branch is required to rewrite history.'),
          { statusCode: 409 }
        )
      const result = await interactiveRebase(
        repoPath,
        base,
        reordered.map(sha => `pick ${sha}`).join('\n') + '\n',
        '',
        body.noVerify === true
      )
      if (result.exitCode !== 0) return result
      const rewrittenTip = (
        await git(['rev-parse', '--verify', 'HEAD'], repoPath)
      ).stdout.trim()
      return {
        ...result,
        undo: { branch, originalTip, rewrittenTip },
      }
    }
    case 'squash-commits': {
      const base = body.base ? requireGitValue(body.base, 'base commit') : null
      const commits = Array.isArray(body.commits)
        ? body.commits.map((item, index) =>
            requireGitValue(item, `commit ${index + 1}`)
          )
        : []
      const squashOnto = requireGitValue(
        body.squashOnto,
        'commit to squash onto'
      )
      const history = await rebaseHistory(repoPath, base)
      requireHistoryCommits(history, commits, 'squash')
      if (commits.includes(squashOnto))
        throw Object.assign(
          new Error('The commits to squash cannot contain the squash target'),
          { statusCode: 400 }
        )
      if (!history.includes(squashOnto))
        throw Object.assign(
          new Error('The commit to squash onto is not in the rebase range'),
          { statusCode: 400 }
        )
      const toSquash = new Set(commits)
      const targetIndex = history.indexOf(squashOnto)
      const before = history.slice(0, targetIndex)
      const after = history.slice(targetIndex + 1)
      const group = [
        ...before.filter(sha => toSquash.has(sha)),
        squashOnto,
        ...after.filter(sha => toSquash.has(sha)),
      ]
      const todo =
        [
          ...before.filter(sha => !toSquash.has(sha)).map(sha => `pick ${sha}`),
          ...group.map(
            (sha, index) => `${index === 0 ? 'pick' : 'squash'} ${sha}`
          ),
          ...after.filter(sha => !toSquash.has(sha)).map(sha => `pick ${sha}`),
        ].join('\n') + '\n'
      const originalTip = (
        await git(['rev-parse', '--verify', 'HEAD'], repoPath)
      ).stdout.trim()
      const branch = (
        await git(['branch', '--show-current'], repoPath)
      ).stdout.trim()
      if (!branch)
        throw Object.assign(
          new Error('A checked out branch is required to rewrite history.'),
          { statusCode: 409 }
        )
      const result = await interactiveRebase(
        repoPath,
        base,
        todo,
        String(body.message || ''),
        body.noVerify === true
      )
      if (result.exitCode !== 0) return result
      const rewrittenTip = (
        await git(['rev-parse', '--verify', 'HEAD'], repoPath)
      ).stdout.trim()
      return {
        ...result,
        undo: { branch, originalTip, rewrittenTip },
      }
    }
    case 'lfs-install':
      throw Object.assign(
        new Error('Git LFS is unavailable in this web companion'),
        { statusCode: 501 }
      )
    case 'init': {
      const richInitialization =
        body.name !== undefined || body.parentPath !== undefined
      const resolved = richInitialization
        ? repositoryPathFromName(
            requireString(body.name, 'name'),
            requireAbsolutePath(body.parentPath, 'parent path')
          )
        : {
            repositoryPath: repoPath,
            repositoryName: path.basename(repoPath),
            error: null,
          }
      if (resolved.error)
        throw Object.assign(new Error(resolved.error), { statusCode: 400 })

      const preview = await inspectRepositoryInitialization(
        resolved.repositoryPath
      )
      if (preview.isRepository)
        throw Object.assign(
          new Error('The target directory is already a Git repository.'),
          { statusCode: 409, code: 'existing-repository' }
        )
      if (preview.warnings.some(warning => warning.code === 'invalid-path'))
        throw Object.assign(
          new Error(
            preview.warnings.find(
              warning => warning.code === 'invalid-path'
            ).message
          ),
          { statusCode: 400, code: 'invalid-path' }
        )

      await fs.promises.mkdir(resolved.repositoryPath, { recursive: true })
      const result = await git(
        [
          'init',
          ...(body.initialBranch
            ? ['-b', requireGitValue(body.initialBranch, 'initial branch')]
            : []),
        ],
        resolved.repositoryPath
      )
      if (!richInitialization)
        return { ...result, repositoryPath: resolved.repositoryPath }

      await createRepositoryFiles(
        resolved.repositoryPath,
        resolved.repositoryName,
        body
      )
      if (body.initialCommit !== false) {
        const status = await getStatus(resolved.repositoryPath)
        if (status.workingDirectory.files.length > 0) {
          await git(['add', '--all'], resolved.repositoryPath)
          await git(
            ['commit', '-m', 'Initial commit'],
            resolved.repositoryPath,
            [0]
          )
        }
      }
      return { ...result, repositoryPath: resolved.repositoryPath }
    }
    case 'clone': {
      const url = validateCloneURL(body.url)
      const preview = await previewCloneRepository({
        url,
        path: repoPath,
      })
      if (!preview.canClone)
        throw Object.assign(
          new Error(preview.warnings.map(warning => warning.message).join(' ')),
          { statusCode: 400, code: 'invalid-clone-destination' }
        )
      await fs.promises.mkdir(path.dirname(repoPath), { recursive: true })
      return git(
        [
          ...(body.initialBranch
            ? [
                '-c',
                `init.defaultBranch=${requireGitValue(
                  body.initialBranch,
                  'initial branch'
                )}`,
              ]
            : []),
          'clone',
          '--recursive',
          ...(body.branch
            ? ['-b', requireGitValue(body.branch, 'branch')]
            : []),
          '--',
          url,
          repoPath,
        ],
        path.dirname(repoPath),
        [0],
        undefined,
        gitEnvironment
      )
    }
    case 'commit':
      args = ['commit', '-F', '-']
      break
  }
  if (operation === 'discard-patch') {
    const patch = requireString(body.patch, 'patch', MAX_REQUEST_BYTES)
    return git(
      ['apply', '--unidiff-zero', '--whitespace=nowarn', '-'],
      repoPath,
      [0],
      patch
    )
  }
  if (operation === 'discard') {
    if (values.length === 0)
      throw Object.assign(new Error('files are required'), { statusCode: 400 })
    const files = values.map((_, index) => requireString(values[index], 'file'))
    const paths = files.map(file => {
      const absolute = path.resolve(repoPath, file)
      const root = path.resolve(repoPath)
      if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`))
        throw Object.assign(
          new Error(`file is outside the repository: ${file}`),
          {
            statusCode: 400,
          }
        )
      return absolute
    })
    const status = await getStatus(repoPath)
    const statusByPath = new Map(
      status.workingDirectory.files.map(file => [file.path, file])
    )
    const submodulePaths = new Set(
      await selectedSubmodulePaths(repoPath, files)
    )
    const untrackedPaths = files.filter(
      file => statusByPath.get(file)?.status.kind === 'Untracked'
    )
    if (body.moveToTrash === true && services?.moveToTrash) {
      for (let index = 0; index < files.length; index++) {
        const file = files[index]
        const change = statusByPath.get(file)
        if (
          !change ||
          change.status.kind === 'Deleted' ||
          submodulePaths.has(file)
        )
          continue
        try {
          await services.moveToTrash(paths[index])
        } catch (error) {
          if (body.allowPermanentOnTrashFailure !== true) throw error
          if (change.status.kind === 'Untracked')
            await fs.promises.rm(paths[index], {
              recursive: true,
              force: true,
            })
        }
      }
    } else {
      for (let index = 0; index < files.length; index++) {
        if (!untrackedPaths.includes(files[index])) continue
        await fs.promises.rm(paths[index], { recursive: true, force: true })
      }
    }
    const checkoutPaths = []
    for (const file of files) {
      const change = statusByPath.get(file)
      if (!change || change.status.kind === 'Untracked') continue
      if (
        (change?.status.kind === 'Renamed' ||
          change?.status.kind === 'Copied') &&
        change.oldPath
      ) {
        checkoutPaths.push(change.oldPath)
      } else {
        checkoutPaths.push(file)
      }
    }
    const restored = checkoutPaths.length
      ? await git(
          ['restore', '--staged', '--worktree', '--', ...checkoutPaths],
          repoPath,
          [0, 1, 128]
        )
      : { stdout: '', stderr: '', exitCode: 0 }
    const cleaned =
      body.cleanUntracked === true
        ? await git(['clean', '-d', '-f'], repoPath)
        : { stdout: '', stderr: '', exitCode: 0 }
    const submoduleResult = submodulePaths.size
      ? await updateSubmodules(repoPath, [...submodulePaths], true)
      : null
    return combinedResult([restored, cleaned, submoduleResult].filter(Boolean))
  }
  if (operation === 'reset-upstream') {
    if (body.confirmed !== true)
      throw Object.assign(
        new Error(
          'Confirm reset and pull before discarding commits from the current branch.'
        ),
        { statusCode: 400, code: 'confirmation-required' }
      )
    const status = await getStatus(repoPath)
    if (status.workingDirectory.files.length > 0)
      throw Object.assign(
        new Error(
          'Cannot reset and pull while uncommitted changes exist. Stash or commit them first.'
        ),
        { statusCode: 409, code: 'local-changes-overwritten' }
      )
    const upstream = (
      await git(
        ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'],
        repoPath
      )
    ).stdout.trim()
    return combinedResult([
      await fetchAll(repoPath, gitEnvironment),
      await git(
        ['reset', '--hard', requireGitValue(upstream, 'upstream')],
        repoPath
      ),
    ])
  }
  if (operation === 'stash-rename') {
    const stash = values[0] ? value(0, 'stash') : 'stash@{0}'
    const entry = await getStashEntry(repoPath, stash)
    const customName =
      body.customName === null || body.message === null
        ? null
        : body.customName !== undefined
        ? requireString(body.customName, 'stash name')
        : body.message !== undefined
        ? requireString(body.message, 'stash name')
        : entry.customName
    if (customName === entry.customName && entry.isDesktop)
      return { stdout: '', stderr: '', exitCode: 0 }
    return replaceStashEntry(repoPath, entry, entry.branchName, customName)
  }
  if (operation === 'commit') {
    const selectedFiles = Array.isArray(body.files)
      ? body.files.map(item => requireString(item, 'file'))
      : []
    const patches = Array.isArray(body.patches)
      ? body.patches.map(item =>
          requireString(item, 'patch', MAX_REQUEST_BYTES)
        )
      : []
    const resolutions = conflictResolutions(body)
    const trailers = requireCommitTrailers(body.trailers)
    if (
      !selectedFiles.length &&
      !patches.length &&
      body.allowEmpty !== true &&
      body.amend !== true
    )
      throw Object.assign(new Error('files are required'), { statusCode: 400 })
    const status = await getStatus(repoPath)
    assertCommitConflictsResolved(status, selectedFiles, resolutions)
    const conflictPaths = status.workingDirectory.files
      .filter(file => file.status.kind === 'Conflicted')
      .map(file => file.path)
    // Git represents unresolved entries as a combined diff, which cannot be
    // replayed with `git apply`. Preserve every ordinary staged path while
    // leaving conflicted entries to the explicit resolution flow below.
    const stagedPatch = conflictPaths.length
      ? await stagedPatchWithoutConflicts(repoPath, conflictPaths)
      : (await git(['diff', '--cached', '--binary'], repoPath)).stdout
    const temporaryDirectory = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'desktop-plus-index-')
    )
    const env = { GIT_INDEX_FILE: path.join(temporaryDirectory, 'index') }
    try {
      // Desktop clears its index to HEAD before staging the chosen files, for
      // both regular commits and amends. Starting an amend from HEAD^ would
      // incorrectly drop the amended commit's existing tree and reject
      // message-only amends.
      const baseTree = await git(
        ['rev-parse', '--verify', 'HEAD'],
        repoPath,
        [0, 128]
      )
      if (baseTree.exitCode === 0) {
        await git(
          ['read-tree', baseTree.stdout.trim()],
          repoPath,
          [0],
          undefined,
          env
        )
      }
      await stageCommitConflictResolutions(repoPath, resolutions, env)
      if (selectedFiles.length)
        await git(
          ['add', '--', ...selectedFiles],
          repoPath,
          [0],
          undefined,
          env
        )
      for (const patch of patches)
        await git(
          ['apply', '--cached', '--unidiff-zero', '--whitespace=nowarn', '-'],
          repoPath,
          [0],
          patch,
          env
        )
      const commitMessage = await mergeCommitTrailers(
        repoPath,
        String(body.message || ''),
        trailers
      )
      const result = await git(
        [
          ...args,
          ...(body.amend ? ['--amend'] : []),
          ...(body.noVerify ? ['--no-verify'] : []),
          ...(body.signOff ? ['--signoff'] : []),
          ...(body.allowEmpty ? ['--allow-empty'] : []),
        ],
        repoPath,
        [0],
        commitMessage,
        env
      )
      await git(['read-tree', 'HEAD'], repoPath)
      if (stagedPatch)
        await git(
          ['apply', '--cached', '--binary', '-'],
          repoPath,
          [0],
          stagedPatch
        )
      return result
    } finally {
      await fs.promises.rm(temporaryDirectory, { recursive: true, force: true })
    }
  }
  if (operation === 'worktree-add') {
    const result = await git(args, repoPath, [0], undefined, gitEnvironment)
    await copyWorktreeIncludeFiles(
      repoPath,
      requireAbsolutePath(body.worktreePath || values[0], 'worktree path')
    )
    return result
  }
  if (operation === 'continue-rebase')
    return continueRebaseWithMessage(
      repoPath,
      args,
      gitEnvironment,
      continueRebaseMessage,
      body.noVerify === true
    )
  if (operation === 'checkout' || operation === 'checkout-commit') {
    if (operation === 'checkout' && body.moveChanges === true)
      return checkoutWithChanges(repoPath, args, gitEnvironment)
    if (operation === 'checkout' && body.stashChanges === true)
      return checkoutWithChanges(repoPath, args, gitEnvironment, true)
    const result = await git(args, repoPath, [0], undefined, gitEnvironment)
    await updateSubmodules(repoPath, [], false, gitEnvironment)
    return result
  }
  return git(args, repoPath, [0], undefined, gitEnvironment)
}

const router = new Router()
registerRepositoryRoutes(router, {
  repositorySetupOptions,
  previewRepositoryInitialization,
  previewCloneRepository,
  createRepositoryFiles,
  requireRepositoryInspectionPath,
  inspectRepository,
  trustRepository,
  deleteRepositoryFromDisk,
  getWorktreeIndicators: getRepositoryIndicators,
})
registerFsRoutes(router, {
  MAX_RESPONSE_BYTES,
  MAX_REQUEST_BYTES,
})
registerHostingRoutes(router, {
  normalizeGitLabEndpoint,
  gitLabCredentialId,
  requireGitLabCredential,
  gitLabCredentialService,
  githubCredentialService,
  sendJson,
  parseJsonBody,
})
registerSystemRoutes(router)

async function routeApi(req, res, url, services) {
  const handled = await router.dispatch(req, res, services, url)
  if (handled) {
    return
  }

  const { pathname } = url

  if (req.method === 'GET' && pathname === '/api/health') {
    return sendJson(res, 200, { status: 'ok', time: new Date().toISOString() })
  }

  if (req.method === 'GET' && pathname === '/api/desktop-data/repositories') {
    return sendJson(res, 200, {
      repositories: await services.getDesktopRepositories(),
    })
  }

  if (req.method === 'GET' && pathname === '/api/repository-setup/options') {
    return sendJson(res, 200, repositorySetupOptions())
  }

  if (req.method === 'POST' && pathname === '/api/repository-setup/preview') {
    const body = await parseJsonBody(req)
    return sendJson(res, 200, await previewRepositoryInitialization(body))
  }

  if (
    req.method === 'POST' &&
    pathname === '/api/repository-setup/clone-preview'
  ) {
    const body = await parseJsonBody(req)
    return sendJson(res, 200, await previewCloneRepository(body))
  }

  if (req.method === 'POST' && pathname === '/api/repository-setup/files') {
    const body = await parseJsonBody(req)
    const repositoryPath = requireAbsolutePath(
      body.repositoryPath,
      'repository path'
    )
    const action = requireString(body.action, 'repository setup file action')
    const repositoryName = path.basename(repositoryPath)

    switch (action) {
      case 'readme':
        await createRepositoryFiles(repositoryPath, repositoryName, {
          createReadme: true,
          description: body.description,
        })
        break
      case 'gitignore':
        await createRepositoryFiles(repositoryPath, repositoryName, {
          gitignore: requireString(body.name, 'gitignore'),
        })
        break
      case 'license':
        await createRepositoryFiles(repositoryPath, repositoryName, {
          license: requireString(body.name, 'license'),
        })
        break
      case 'description':
        await createRepositoryFiles(repositoryPath, repositoryName, {
          description: requireText(body.description, 'description'),
        })
        break
      case 'attributes':
        await createRepositoryFiles(repositoryPath, repositoryName, {})
        break
      default:
        throw Object.assign(
          new Error('Unsupported repository setup file action'),
          { statusCode: 400 }
        )
    }
    return sendJson(res, 200, { ok: true })
  }

  if (req.method === 'POST' && pathname === '/api/repository/inspect') {
    const body = await parseJsonBody(req)
    const repositoryPath = requireRepositoryInspectionPath(body.path)
    return sendJson(res, 200, await inspectRepository(repositoryPath))
  }

  if (req.method === 'POST' && pathname === '/api/repository/trust') {
    const body = await parseJsonBody(req)
    const repositoryPath = requireRepositoryInspectionPath(body.path)
    await trustRepository(repositoryPath)
    return sendJson(res, 200, { trustedPath: repositoryPath })
  }

  if (req.method === 'POST' && pathname === '/api/repository/delete') {
    const body = await parseJsonBody(req)
    return sendJson(
      res,
      200,
      await deleteRepositoryFromDisk(
        body.path,
        body.mode,
        body.confirmed,
        services
      )
    )
  }

  if (req.method === 'GET' && pathname === '/api/status') {
    return sendJson(res, 200, await getStatus(repoPathFrom(url)))
  }

  if (req.method === 'GET' && pathname === '/api/repository/indicators') {
    return sendJson(res, 200, await getRepositoryIndicators(repoPathFrom(url)))
  }

  if (req.method === 'GET' && pathname === '/api/git/global-config-path') {
    return sendJson(res, 200, await getGlobalGitConfigPath())
  }

  if (req.method === 'POST' && pathname === '/api/git/config-lock') {
    const body = await parseJsonBody(req)
    const repositoryPath = repoPathFrom(url, body)
    const scope = requireString(body.scope, 'scope')
    return sendJson(
      res,
      200,
      await recoverGitConfigLock(repositoryPath, scope, body.confirmed)
    )
  }

  if (req.method === 'POST' && pathname === '/api/git/config') {
    const body = await parseJsonBody(req)
    const scope = requireString(body.scope, 'scope')
    let repositoryPath
    if (body.path || body.repoPath || url.searchParams.has('path'))
      repositoryPath = repoPathFrom(url, body)
    else if (scope === 'global') repositoryPath = process.cwd()
    else
      throw Object.assign(
        new Error('A repository path is required for this config scope.'),
        { statusCode: 400 }
      )
    const name = requireGitValue(body.name, 'Git config name')
    const operation = requireString(body.operation, 'Git config operation')
    return sendJson(
      res,
      200,
      await editGitConfigValue(
        repositoryPath,
        scope,
        name,
        body.value,
        operation
      )
    )
  }

  if (req.method === 'GET' && pathname === '/api/git/identity') {
    return sendJson(res, 200, await getGitIdentity(repoPathFrom(url)))
  }

  if (req.method === 'POST' && pathname === '/api/git/identity') {
    const body = await parseJsonBody(req)
    const repositoryPath = repoPathFrom(url, body)
    const scope = requireString(body.scope, 'scope')
    const name = requireGitValue(body.name, 'name')
    const email = requireGitValue(body.email, 'email')
    return sendJson(
      res,
      200,
      await setGitIdentity(repositoryPath, scope, name, email)
    )
  }

  if (req.method === 'GET' && pathname === '/api/branches/current') {
    return sendJson(
      res,
      200,
      await getBranches(
        repoPathFrom(url),
        url.searchParams.get('remoteTags') === '1'
      )
    )
  }

  if (req.method === 'GET' && pathname === '/api/history') {
    return sendJson(res, 200, await getHistory(repoPathFrom(url), url))
  }

  if (req.method === 'GET' && pathname === '/api/commit') {
    return sendJson(
      res,
      200,
      await getCommitDetails(
        repoPathFrom(url),
        requireString(url.searchParams.get('sha'), 'sha')
      )
    )
  }

  if (req.method === 'GET' && pathname === '/api/diff') {
    return sendJson(res, 200, await getDiff(repoPathFrom(url), url))
  }

  if (req.method === 'GET' && pathname === '/api/stash/files') {
    return sendJson(res, 200, await getStashFiles(repoPathFrom(url), url))
  }

  if (req.method === 'GET' && pathname === '/api/stash/diff') {
    return sendJson(res, 200, await getStashDiff(repoPathFrom(url), url))
  }

  if (req.method === 'GET' && pathname === '/api/gitignore')
    return sendJson(res, 200, await readGitIgnore(repoPathFrom(url)))

  if (req.method === 'POST' && pathname === '/api/gitignore') {
    const body = await parseJsonBody(req)
    if (body.text !== undefined) {
      const text = requireString(
        body.text,
        'gitignore text',
        MAX_FILE_CONTENT_BYTES
      )
      return sendJson(
        res,
        200,
        await saveGitIgnore(repoPathFrom(url, body), text)
      )
    }
    return sendJson(
      res,
      200,
      await appendGitIgnore(repoPathFrom(url, body), body)
    )
  }

  if (req.method === 'GET' && pathname === '/api/ahead-behind') {
    return sendJson(
      res,
      200,
      await getBranchAheadBehind(repoPathFrom(url), url)
    )
  }

  if (req.method === 'GET' && pathname === '/api/compare') {
    return sendJson(res, 200, await getComparison(repoPathFrom(url), url))
  }

  if (req.method === 'POST' && pathname === '/api/git/query') {
    const body = await parseJsonBody(req)
    const args = Array.isArray(body.args)
      ? body.args.map(arg =>
          requireString(arg, 'Git argument', MAX_ARGUMENT_LENGTH)
        )
      : []
    // `--no-optional-locks` is a harmless global flag (getStatus prepends
    // it) that precedes the real subcommand; skip over it when locating the
    // subcommand below.
    const commandIndex = args[0] === '--no-optional-locks' ? 1 : 0
    // `git -c init.defaultBranch=<name> init` is the one narrow config
    // override the Desktop renderer needs (initGitRepository, for Create New
    // Repository), so it can create a repo with the user's configured
    // default branch name in a single command. Any other `-c`/
    // `--config-env` override is rejected.
    const isInitDefaultBranchOverride =
      args[commandIndex] === '-c' &&
      args.length === commandIndex + 3 &&
      args[commandIndex + 2] === 'init' &&
      /^init\.defaultBranch=/.test(args[commandIndex + 1] || '')
    if (
      (args[commandIndex] === '-c' || args[commandIndex] === '--config-env') &&
      !isInitDefaultBranchOverride
    )
      return sendJson(res, 400, {
        error: 'Git configuration overrides are not allowed',
      })
    const command = isInitDefaultBranchOverride ? 'init' : args[commandIndex]
    if (command === '--version') {
      const result = await git(args, repoPathFrom(url, body))
      return sendJson(res, 200, result)
    }
    const readOnlyCommands = new Set([
      'branch',
      'check-attr',
      'check-ignore',
      'config',
      'diff',
      'diff-tree',
      'for-each-ref',
      'init',
      'log',
      'ls-files',
      'merge-base',
      'merge-tree',
      'remote',
      'rev-list',
      'rev-parse',
      'show',
      'show-ref',
      'stash',
      'status',
      'symbolic-ref',
      'tag',
      'var',
      'worktree',
    ])
    // The Create New Repository dialog's initial-commit step (createCommit,
    // unstageAll, stageFiles) calls git directly instead of going through
    // the dispatcher's `/api/git/operation` 'commit' case, so it needs a
    // few narrowly-shaped mutating commands here too. Each is validated
    // against the exact shape the Desktop renderer sends.
    const isUnstageAll =
      command === 'reset' &&
      args.length === commandIndex + 3 &&
      args[commandIndex + 1] === '--' &&
      args[commandIndex + 2] === '.'
    const stageFlags = ['--add', '--remove', '--force-remove', '--replace']
    const isStageFiles =
      command === 'update-index' &&
      ((args[args.length - 2] === '-z' &&
        args[args.length - 1] === '--stdin' &&
        args
          .slice(commandIndex + 1, args.length - 2)
          .every(arg => stageFlags.includes(arg))) ||
        // applyPatchToIndex re-stages a renamed file's blob at its new path
        // by SHA, without going through `-z --stdin`.
        (args.length === commandIndex + 6 &&
          args[commandIndex + 1] === '--add' &&
          args[commandIndex + 2] === '--cacheinfo'))
    const isInitialCommit =
      command === 'commit' &&
      args[commandIndex + 1] === '-F' &&
      args[commandIndex + 2] === '-' &&
      typeof body.options?.stdin === 'string'
    const isNarrowMutation = isUnstageAll || isStageFiles || isInitialCommit
    if (!command || (!readOnlyCommands.has(command) && !isNarrowMutation))
      return sendJson(res, 400, {
        error: `Unsupported Git query: ${args.join(' ')}`,
      })
    if (command === 'config' && args.includes('--unset'))
      return sendJson(res, 400, {
        error: `Only reading Git config is allowed: ${args.join(' ')}`,
      })
    if (command === 'init') {
      const initPath = repoPathFrom(url, body)
      await fs.promises.mkdir(initPath, { recursive: true })
      const result = await git(args, initPath, [0, 1, 128])
      return sendJson(res, 200, result)
    }
    const stdin =
      typeof body.options?.stdin === 'string' ? body.options.stdin : undefined
    const result = await git(args, repoPathFrom(url, body), [0, 1, 128], stdin)
    return sendJson(res, 200, result)
  }

  if (req.method === 'POST' && pathname === '/api/git/operation') {
    const body = await parseJsonBody(req)
    const result = await runOperationWithClassification(
      repoPathFrom(url, body),
      body,
      services
    )
    return sendJson(res, 200, {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      ...(result.repositoryPath
        ? { repositoryPath: result.repositoryPath }
        : {}),
      ...(result.undo ? { undo: result.undo } : {}),
      ...(result.candidates ? { candidates: result.candidates } : {}),
      ...(result.pruned ? { pruned: result.pruned } : {}),
    })
  }

  if (req.method === 'POST' && pathname === '/api/git/operations') {
    const body = await parseJsonBody(req)
    return sendJson(
      res,
      202,
      services.operationTasks.start(repoPathFrom(url, body), body)
    )
  }

  const operationMatch = /^\/api\/git\/operations\/([^/]+)$/.exec(pathname)
  if (operationMatch && req.method === 'GET')
    return sendJson(
      res,
      200,
      services.operationTasks.get(decodeURIComponent(operationMatch[1]))
    )
  if (operationMatch && req.method === 'POST') {
    const body = await parseJsonBody(req)
    const operationID = decodeURIComponent(operationMatch[1])
    if (body.action === 'auth-prompt') {
      const prompt = requireString(body.prompt, 'SSH authentication prompt')
      if (prompt.length > 4096)
        return sendJson(res, 400, {
          error: 'SSH authentication prompt is too long',
        })
      return sendJson(res, 200, {
        response: await services.operationTasks.requestAuth(
          operationID,
          body.token,
          prompt
        ),
      })
    }
    if (body.action === 'auth-response') {
      const response = typeof body.response === 'string' ? body.response : ''
      return sendJson(
        res,
        200,
        await services.operationTasks.respondAuth(
          operationID,
          response,
          body.remember === true
        )
      )
    }
    if (body.action !== 'cancel')
      return sendJson(res, 400, { error: 'Unsupported operation task action' })
    return sendJson(
      res,
      200,
      services.operationTasks.cancel(decodeURIComponent(operationMatch[1]))
    )
  }

  if (req.method === 'GET' && pathname === '/api/lfs') {
    return sendJson(res, 200, await services.getLfsStatus(repoPathFrom(url)))
  }

  if (req.method === 'POST' && pathname === '/api/lfs') {
    const body = await parseJsonBody(req)
    if (body.action === 'install') {
      const scope = body.scope === 'global' ? 'global' : 'local'
      const repoPath =
        scope === 'global' && !body.path && !body.repoPath
          ? process.cwd()
          : repoPathFrom(url, body)
      return sendJson(res, 200, {
        status: await services.installLfs(
          repoPath,
          scope,
          body.confirmed === true,
          body.force === true
        ),
      })
    }
    if (body.action === 'repair')
      return sendJson(res, 200, {
        status: await services.repairLfs(
          repoPathFrom(url, body),
          body.confirmed === true
        ),
      })
    return sendJson(res, 400, { error: 'Unsupported Git LFS action' })
  }

  if (pathname.startsWith('/api/lfs/operations/')) {
    const operationId = requireString(
      decodeURIComponent(pathname.slice('/api/lfs/operations/'.length)),
      'Git LFS operation ID'
    )
    if (req.method === 'GET')
      return sendJson(res, 200, {
        operation: services.lfsTasks.get(operationId),
      })
    if (req.method === 'POST') {
      const body = await parseJsonBody(req)
      if (body.action === 'cancel')
        return sendJson(res, 200, {
          operation: services.lfsTasks.cancel(operationId),
        })
      return sendJson(res, 400, {
        error: 'Unsupported Git LFS operation action',
      })
    }
  }

  if (req.method === 'POST' && pathname === '/api/lfs/operations') {
    const body = await parseJsonBody(req)
    if (body.action !== 'start')
      return sendJson(res, 400, { error: 'Unsupported Git LFS operation' })
    const repoPath = repoPathFrom(url, body)
    const status = await services.getLfsStatus(repoPath)
    if (!status.available)
      return sendJson(res, 501, {
        error: 'Git LFS is not installed on this computer',
        code: 'lfs-unavailable',
      })
    const command = requireString(body.command, 'Git LFS command')
    return sendJson(res, 200, {
      operation: services.lfsTasks.start(repoPath, command),
    })
  }

  if (req.method === 'POST' && pathname === '/api/dialog/show-open-dialog') {
    const selectedPath = await services.selectDirectory(
      await parseJsonBody(req)
    )
    return sendJson(res, 200, {
      path: selectedPath,
      filePaths: selectedPath ? [selectedPath] : [],
    })
  }

  if (req.method === 'POST' && pathname === '/api/dialog/show-save-dialog') {
    const selectedPath = await services.selectSavePath(await parseJsonBody(req))
    return sendJson(res, 200, { path: selectedPath })
  }

  if (req.method === 'POST' && pathname === '/api/files/read-directory') {
    const body = await parseJsonBody(req)
    const directoryPath = requireAbsolutePath(body.path, 'directory path')
    return sendJson(res, 200, {
      entries: await fs.promises.readdir(directoryPath),
    })
  }

  if (req.method === 'POST' && pathname === '/api/files/stat') {
    const body = await parseJsonBody(req)
    const filePath = requireAbsolutePath(body.path)
    const stats = await fs.promises.stat(filePath).catch(error => {
      if (error.code === 'ENOENT') return null
      throw error
    })
    return sendJson(res, 200, {
      exists: stats !== null,
      isDirectory: stats?.isDirectory() === true,
    })
  }

  if (req.method === 'POST' && pathname === '/api/files/mkdir') {
    const body = await parseJsonBody(req)
    await fs.promises.mkdir(requireAbsolutePath(body.path), {
      recursive: body.recursive === true,
    })
    return sendJson(res, 200, { ok: true })
  }

  if (req.method === 'POST' && pathname === '/api/os/open') {
    const body = await parseJsonBody(req)
    await services.openPath(
      requireAbsolutePath(body.path),
      body.reveal === true
    )
    return sendJson(res, 200, { ok: true })
  }

  if (req.method === 'POST' && pathname === '/api/os/trash') {
    const body = await parseJsonBody(req)
    await services.moveToTrash(requireAbsolutePath(body.path))
    return sendJson(res, 200, { ok: true })
  }

  if (req.method === 'POST' && pathname === '/api/updates') {
    const body = await parseJsonBody(req)
    if (body.action === 'check')
      return sendJson(res, 200, { update: await services.updates.check() })
    if (body.action === 'download')
      return sendJson(res, 200, {
        operation: await services.updates.startDownload(),
      })
    if (body.action === 'open')
      return sendJson(res, 200, {
        operation: await services.updates.openDownloaded(
          requireString(body.operationId, 'update operation ID'),
          body.confirmed === true
        ),
      })
    return sendJson(res, 400, { error: 'Unsupported update action' })
  }

  if (pathname.startsWith('/api/updates/operations/')) {
    const operationId = requireString(
      decodeURIComponent(pathname.slice('/api/updates/operations/'.length)),
      'update operation ID'
    )
    if (req.method === 'GET')
      return sendJson(res, 200, {
        operation: services.updates.getOperation(operationId),
      })
    if (req.method === 'POST') {
      const body = await parseJsonBody(req)
      if (body.action === 'cancel')
        return sendJson(res, 200, {
          operation: services.updates.cancel(operationId),
        })
      return sendJson(res, 400, {
        error: 'Unsupported update operation action',
      })
    }
  }

  if (req.method === 'GET' && pathname === '/api/integrations') {
    return sendJson(res, 200, await services.discoverIntegrations())
  }

  if (req.method === 'POST' && pathname === '/api/integrations/launch') {
    const body = await parseJsonBody(req)
    await services.launchIntegration({
      kind: body.kind === 'shell' ? 'shell' : 'editor',
      target: requireAbsolutePath(body.target, 'target'),
      name: typeof body.name === 'string' ? body.name : null,
      custom:
        body.custom && typeof body.custom === 'object'
          ? {
              path: requireAbsolutePath(
                body.custom.path,
                'custom integration path'
              ),
              arguments:
                typeof body.custom.arguments === 'string' ||
                Array.isArray(body.custom.arguments)
                  ? body.custom.arguments
                  : '%TARGET_PATH%',
            }
          : null,
    })
    return sendJson(res, 200, { ok: true })
  }

  if (req.method === 'POST' && pathname === '/api/integrations/run') {
    const body = await parseJsonBody(req)
    const output = await services.runIntegrationForOutput({
      target: repoPathFrom(url, body),
      custom:
        body.custom && typeof body.custom === 'object'
          ? {
              path: requireAbsolutePath(
                body.custom.path,
                'custom integration path'
              ),
              arguments:
                typeof body.custom.arguments === 'string' ||
                Array.isArray(body.custom.arguments)
                  ? body.custom.arguments
                  : '%TARGET_PATH%',
            }
          : null,
    })
    if (typeof output !== 'string')
      throw new Error('Integration did not return text output')
    if (Buffer.byteLength(output) > MAX_RESPONSE_BYTES)
      throw Object.assign(new Error('Integration output is too large'), {
        statusCode: 413,
      })
    return sendJson(res, 200, { output })
  }

  if (req.method === 'POST' && pathname === '/api/hosting/auth') {
    const body = await parseJsonBody(req)
    const endpoint = normalizeGitHubEndpoint(
      requireString(body.endpoint, 'endpoint')
    )
    const token = requireString(body.token, 'token')
    const user = await services.hostingRequest(endpoint, token, 'GET', 'user')
    const login = requireString(user.login, 'hosting user login')
    if (!services.keytar)
      return sendJson(res, 501, { error: 'OS credential store is unavailable' })
    const credentialId = githubCredentialId(endpoint, login)
    await services.keytar.setPassword(
      githubCredentialService,
      credentialId,
      token
    )
    return sendJson(res, 200, {
      credentialId,
      user: {
        login,
        id: user.id,
        name: user.name || login,
        avatarURL: user.avatar_url || '',
        endpoint,
      },
    })
  }

  if (req.method === 'POST' && pathname === '/api/gitlab/auth') {
    const body = await parseJsonBody(req)
    const endpoint = normalizeGitLabEndpoint(
      requireString(body.endpoint, 'endpoint')
    )
    const token = requireString(body.token, 'token')
    const user = await services.gitLabRequest(endpoint, token, 'GET', 'user')
    const username = requireString(user.username, 'GitLab username')
    if (!services.keytar)
      return sendJson(res, 501, { error: 'OS credential store is unavailable' })
    const credentialId = gitLabCredentialId(endpoint, username)
    await services.keytar.setPassword(
      gitLabCredentialService,
      credentialId,
      token
    )
    return sendJson(res, 200, {
      credentialId,
      user: {
        login: username,
        name: user.name || username,
        endpoint,
        provider: 'gitlab',
      },
    })
  }

  if (req.method === 'POST' && pathname === '/api/gitlab/projects') {
    const body = await parseJsonBody(req)
    if (!services.keytar)
      return sendJson(res, 501, { error: 'OS credential store is unavailable' })
    const { credentialId, endpoint } = requireGitLabCredential(body)
    const token = await services.keytar.getPassword(
      gitLabCredentialService,
      credentialId
    )
    if (!token)
      return sendJson(res, 401, { error: 'Hosting credentials were not found' })
    if (body.action === 'list')
      return sendJson(res, 200, {
        projects: await services.gitLabRequest(
          endpoint,
          token,
          'GET',
          'projects?membership=true&per_page=100&order_by=last_activity_at'
        ),
      })
    if (body.action === 'create') {
      const namespace = body.organization
        ? requireGitValue(body.organization, 'GitLab namespace')
        : ''
      const namespaceId = await gitLabNamespaceId(
        services.gitLabRequest,
        endpoint,
        token,
        namespace
      )
      const project = await services.gitLabRequest(
        endpoint,
        token,
        'POST',
        'projects',
        {
          name: requireGitValue(body.name, 'project name'),
          namespace_id: namespaceId,
          description: String(body.description || ''),
          visibility: body.private === true ? 'private' : 'public',
        }
      )
      const repoPath = repoPathFrom(url, body)
      const cloneURL = requireGitValue(project.http_url_to_repo, 'clone URL')
      requireGitLabRemote(cloneURL, endpoint)
      const hasOrigin = (await git(['remote'], repoPath)).stdout
        .split('\n')
        .includes('origin')
      await git(
        hasOrigin
          ? ['remote', 'set-url', 'origin', cloneURL]
          : ['remote', 'add', 'origin', cloneURL],
        repoPath
      )
      const branch = (
        await git(['branch', '--show-current'], repoPath)
      ).stdout.trim()
      const hasCommit =
        (await git(['rev-parse', '--verify', 'HEAD'], repoPath, [0, 128]))
          .exitCode === 0
      if (branch && hasCommit) {
        try {
          await git(
            ['push', '-u', 'origin', branch],
            repoPath,
            [0],
            undefined,
            authenticatedGitLabEnvironment(cloneURL, token)
          )
        } catch (error) {
          throw classifyGitHostingError(error)
        }
      }
      return sendJson(res, 200, { project })
    }
    if (body.action === 'push') {
      const repoPath = repoPathFrom(url, body)
      const branch = requireGitValue(body.branch, 'branch')
      requireGitValue(body.owner, 'project namespace')
      requireGitValue(body.repository, 'project name')
      const remoteURL = await configuredOriginURL(repoPath)
      requireGitLabRemote(remoteURL, endpoint)
      let env
      try {
        env = authenticatedGitLabEnvironment(remoteURL, token)
      } catch {
        env = undefined
      }
      try {
        await git(
          ['push', '-u', 'origin', branch],
          repoPath,
          [0],
          undefined,
          env
        )
      } catch (error) {
        throw classifyGitHostingError(error)
      }
      return sendJson(res, 200, { ok: true, branch })
    }
    return sendJson(res, 400, { error: 'Unsupported GitLab projects action' })
  }

  if (req.method === 'POST' && pathname === '/api/gitlab/merge-requests') {
    const body = await parseJsonBody(req)
    if (!services.keytar)
      return sendJson(res, 501, { error: 'OS credential store is unavailable' })
    const { credentialId, endpoint } = requireGitLabCredential(body)
    const token = await services.keytar.getPassword(
      gitLabCredentialService,
      credentialId
    )
    if (!token)
      return sendJson(res, 401, { error: 'Hosting credentials were not found' })
    const project = gitLabProjectPath(
      requireGitValue(body.owner, 'owner'),
      requireGitValue(body.repository, 'repository')
    )
    if (body.action === 'list') {
      const mergeRequests = await services.gitLabRequest(
        endpoint,
        token,
        'GET',
        `projects/${project}/merge_requests?state=opened&per_page=100`
      )
      return sendJson(res, 200, {
        pullRequests: mergeRequests.map(item => ({
          number: item.iid,
          title: item.title,
          state: item.state,
          user: { login: item.author?.username || '' },
          head: {
            ref: item.source_branch,
            sha: item.sha,
          },
        })),
      })
    }
    if (body.action === 'create') {
      const mergeRequest = await services.gitLabRequest(
        endpoint,
        token,
        'POST',
        `projects/${project}/merge_requests`,
        {
          title: requireString(body.title, 'title'),
          source_branch: requireGitValue(body.head, 'head branch'),
          target_branch: requireGitValue(body.base, 'base branch'),
          description: String(body.body || ''),
        }
      )
      return sendJson(res, 200, {
        pullRequest: {
          number: mergeRequest.iid,
          title: mergeRequest.title,
          state: mergeRequest.state,
          user: { login: mergeRequest.author?.username || '' },
          head: { ref: mergeRequest.source_branch, sha: mergeRequest.sha },
        },
      })
    }
    if (body.action === 'details') {
      const mergeRequestNumber = Number(body.pullRequestNumber)
      if (!Number.isInteger(mergeRequestNumber) || mergeRequestNumber < 1)
        return sendJson(res, 400, {
          error: 'pullRequestNumber must be a positive integer',
        })
      const [mergeRequest, changes, commits] = await Promise.all([
        services.gitLabRequest(
          endpoint,
          token,
          'GET',
          `projects/${project}/merge_requests/${mergeRequestNumber}`
        ),
        services.gitLabRequest(
          endpoint,
          token,
          'GET',
          `projects/${project}/merge_requests/${mergeRequestNumber}/changes`
        ),
        services.gitLabRequest(
          endpoint,
          token,
          'GET',
          `projects/${project}/merge_requests/${mergeRequestNumber}/commits`
        ),
      ])
      return sendJson(res, 200, {
        pullRequest: {
          number: mergeRequest.iid,
          title: mergeRequest.title,
          state: mergeRequest.state,
          user: { login: mergeRequest.author?.username || '' },
          head: { ref: mergeRequest.source_branch, sha: mergeRequest.sha },
          base: { sha: mergeRequest.diff_refs?.base_sha },
        },
        commitSHAs: commits.map(commit => commit.id),
        files: (changes.changes || []).map(change => {
          const stats = gitLabDiffStats(change.diff)
          return {
            path: change.new_path,
            oldPath:
              change.old_path === change.new_path ? undefined : change.old_path,
            status: { kind: gitLabChangeStatus(change) },
            additions: stats.additions,
            deletions: stats.deletions,
            patch: change.diff || null,
          }
        }),
      })
    }
    return sendJson(res, 400, {
      error: 'Unsupported GitLab merge-request action',
    })
  }

  if (req.method === 'POST' && pathname === '/api/gitlab/logout') {
    const body = await parseJsonBody(req)
    const credentialId = requireString(body.credentialId, 'credentialId')
    if (!services.keytar)
      return sendJson(res, 501, { error: 'OS credential store is unavailable' })
    return sendJson(res, 200, {
      deleted: await services.keytar.deletePassword(
        gitLabCredentialService,
        credentialId
      ),
    })
  }

  if (req.method === 'POST' && pathname === '/api/gitlab/pipelines') {
    const body = await parseJsonBody(req)
    if (!services.keytar)
      return sendJson(res, 501, { error: 'OS credential store is unavailable' })
    const { credentialId, endpoint } = requireGitLabCredential(body)
    const token = await services.keytar.getPassword(
      gitLabCredentialService,
      credentialId
    )
    if (!token)
      return sendJson(res, 401, { error: 'Hosting credentials were not found' })
    const project = gitLabProjectPath(
      requireGitValue(body.owner, 'owner'),
      requireGitValue(body.repository, 'repository')
    )
    if (body.action === 'get') {
      const ref = encodeURIComponent(requireString(body.ref, 'ref'))
      const pipelines = await services.gitLabRequest(
        endpoint,
        token,
        'GET',
        `projects/${project}/pipelines?sha=${ref}&per_page=100`
      )
      const checks = pipelines.map(gitLabPipelineCheck)
      return sendJson(res, 200, {
        check: checks.length
          ? {
              status: checks.some(check => check.status !== 'completed')
                ? 'in_progress'
                : 'completed',
              conclusion: checks.some(check => check.conclusion === 'failure')
                ? 'failure'
                : checks.some(check => check.conclusion === null)
                ? null
                : checks.every(check => check.conclusion === 'success')
                ? 'success'
                : 'neutral',
              checks,
            }
          : null,
      })
    }
    if (body.action === 'rerun') {
      const pipelineIds = Array.isArray(body.checkSuiteIds)
        ? [...new Set(body.checkSuiteIds.map(Number))]
        : []
      if (
        pipelineIds.length === 0 ||
        pipelineIds.some(id => !Number.isInteger(id) || id < 1)
      )
        return sendJson(res, 400, {
          error: 'checkSuiteIds must contain positive integers',
        })
      await Promise.all(
        pipelineIds.map(pipelineId =>
          services.gitLabRequest(
            endpoint,
            token,
            'POST',
            `projects/${project}/pipelines/${pipelineId}/retry`
          )
        )
      )
      return sendJson(res, 200, { ok: true })
    }
    return sendJson(res, 400, { error: 'Unsupported GitLab pipelines action' })
  }

  if (
    req.method === 'POST' &&
    pathname === '/api/gitlab/checkout-merge-request'
  ) {
    const body = await parseJsonBody(req)
    if (!services.keytar)
      return sendJson(res, 501, { error: 'OS credential store is unavailable' })
    const { credentialId, endpoint } = requireGitLabCredential(body)
    const token = await services.keytar.getPassword(
      gitLabCredentialService,
      credentialId
    )
    if (!token)
      return sendJson(res, 401, { error: 'Hosting credentials were not found' })
    const repoPath = repoPathFrom(url, body)
    const number = Number(body.pullRequestNumber)
    if (!Number.isInteger(number) || number < 1)
      return sendJson(res, 400, {
        error: 'pullRequestNumber must be a positive integer',
      })
    const remoteURL = await configuredOriginURL(repoPath)
    requireGitLabRemote(remoteURL, endpoint)
    let env
    try {
      env = authenticatedGitLabEnvironment(remoteURL, token)
    } catch {
      env = undefined
    }
    const ref = `refs/merge-requests/${number}/head`
    try {
      await git(['fetch', 'origin', ref], repoPath, [0], undefined, env)
    } catch (error) {
      throw classifyGitHostingError(error)
    }
    const branch = `mr/${number}`
    const exists =
      (
        await git(
          ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`],
          repoPath,
          [0, 1]
        )
      ).exitCode === 0
    if (exists) {
      await git(['checkout', branch], repoPath)
      await git(['reset', '--hard', 'FETCH_HEAD'], repoPath)
    } else {
      await git(['checkout', '-b', branch, 'FETCH_HEAD'], repoPath)
    }
    return sendJson(res, 200, { branch })
  }

  if (req.method === 'POST' && pathname === '/api/copilot') {
    const body = await parseJsonBody(req)
    if (!services.keytar)
      return sendJson(res, 501, { error: 'OS credential store is unavailable' })
    const { credentialId } = requireGitHubCredential(body)
    const token = await services.keytar.getPassword(
      githubCredentialService,
      credentialId
    )
    if (!token)
      return sendJson(res, 401, { error: 'Hosting credentials were not found' })
    const repoPath = body.path ? repoPathFrom(url, body) : process.cwd()
    const requestAbort = requestAbortSignal(req, res)
    try {
      if (body.action === 'metadata') {
        const metadata = await services.withCopilotClient(
          token,
          repoPath,
          async (client, signal) => {
            const [models, quota] = await raceWithAbort(
              Promise.all([
                client.listModels(),
                client.rpc.account.getQuota({ gitHubToken: token }),
              ]),
              signal
            )
            return {
              models: models.map(model => ({
                id: model.id,
                name: model.name || model.id,
              })),
              quota: quota.quotaSnapshots,
            }
          },
          requestAbort.signal
        )
        return sendJson(res, 200, metadata)
      }
      if (body.action === 'generate-commit-message') {
        const diff =
          (
            await git(
              ['diff', '--cached', '--no-ext-diff', '--no-color'],
              repoPath
            )
          ).stdout ||
          (await git(['diff', '--no-ext-diff', '--no-color'], repoPath)).stdout
        if (!diff.trim())
          return sendJson(res, 400, {
            error:
              'There are no changes available for commit message generation',
          })
        const content = await services.withCopilotClient(
          token,
          repoPath,
          async (client, signal) => {
            const session = await raceWithAbort(
              client.createSession({
                model: typeof body.model === 'string' ? body.model : 'auto',
                availableTools: [],
                enableSessionStore: false,
                onPermissionRequest: async () => ({ kind: 'reject' }),
                systemMessage: {
                  mode: 'append',
                  content:
                    'Return only JSON: {"title":"short commit title","description":"optional concise description"}.',
                },
              }),
              signal
            )
            const disconnectOnAbort = () => {
              void session.disconnect().catch(() => {})
            }
            signal?.addEventListener('abort', disconnectOnAbort, { once: true })
            try {
              const response = await raceWithAbort(
                session.sendAndWait(
                  { prompt: `Summarize this Git diff:\n\n${diff}` },
                  60_000
                ),
                signal
              )
              return response?.data.content || ''
            } finally {
              signal?.removeEventListener('abort', disconnectOnAbort)
              await session.disconnect().catch(() => {})
            }
          },
          requestAbort.signal
        )
        return sendJson(res, 200, { content })
      }
      if (body.action === 'resolve-conflicts') {
        const status = await getStatus(repoPath)
        const conflictFiles = status.workingDirectory.files
          .filter(file => file.status.kind === 'Conflicted')
          .slice(0, 20)
        if (!conflictFiles.length)
          return sendJson(res, 400, {
            error:
              'There are no conflicted files available for Copilot resolution',
          })
        const conflicts = await Promise.all(
          conflictFiles.map(async file => ({
            path: file.path,
            content: await fs.promises.readFile(
              path.resolve(repoPath, file.path),
              'utf8'
            ),
          }))
        )
        const content = await services.withCopilotClient(
          token,
          repoPath,
          async (client, signal) => {
            const session = await raceWithAbort(
              client.createSession({
                model: typeof body.model === 'string' ? body.model : 'auto',
                availableTools: [],
                enableSessionStore: false,
                onPermissionRequest: async () => ({ kind: 'reject' }),
                systemMessage: {
                  mode: 'append',
                  content:
                    'Resolve Git conflict markers. Return only JSON with a resolutions array. Each entry must contain path, resolvedContent, and reasoning.',
                },
              }),
              signal
            )
            const disconnectOnAbort = () => {
              void session.disconnect().catch(() => {})
            }
            signal?.addEventListener('abort', disconnectOnAbort, { once: true })
            try {
              const response = await raceWithAbort(
                session.sendAndWait(
                  {
                    prompt: `Resolve these conflicted files:\n\n${JSON.stringify(
                      conflicts
                    )}`,
                  },
                  120_000
                ),
                signal
              )
              return response?.data.content || ''
            } finally {
              signal?.removeEventListener('abort', disconnectOnAbort)
              await session.disconnect().catch(() => {})
            }
          },
          requestAbort.signal
        )
        return sendJson(res, 200, { content })
      }
      return sendJson(res, 400, { error: 'Unsupported Copilot action' })
    } catch (error) {
      if (requestAbort.signal.aborted) return
      throw copilotError(error)
    } finally {
      requestAbort.dispose()
    }
  }

  if (req.method === 'POST' && pathname === '/api/hosting/publish') {
    const body = await parseJsonBody(req)
    if (!services.keytar)
      return sendJson(res, 501, { error: 'OS credential store is unavailable' })
    const { credentialId, endpoint } = requireGitHubCredential(body)
    const token = await services.keytar.getPassword(
      githubCredentialService,
      credentialId
    )
    if (!token)
      return sendJson(res, 401, { error: 'Hosting credentials were not found' })
    const name = requireGitValue(body.name, 'repository name')
    const owner = body.organization
      ? requireGitValue(body.organization, 'organization')
      : null
    const created = await services.hostingRequest(
      endpoint,
      token,
      'POST',
      owner ? `orgs/${owner}/repos` : 'user/repos',
      {
        name,
        description: String(body.description || ''),
        private: body.private === true,
      }
    )
    const repoPath = repoPathFrom(url, body)
    const cloneURL = requireGitValue(
      created.clone_url || created.ssh_url,
      'clone URL'
    )
    const hasOrigin = (await git(['remote'], repoPath)).stdout
      .split('\n')
      .includes('origin')
    await git(
      hasOrigin
        ? ['remote', 'set-url', 'origin', cloneURL]
        : ['remote', 'add', 'origin', cloneURL],
      repoPath
    )
    const branch = (
      await git(['branch', '--show-current'], repoPath)
    ).stdout.trim()
    const hasCommit =
      (await git(['rev-parse', '--verify', 'HEAD'], repoPath, [0, 128]))
        .exitCode === 0
    if (branch && hasCommit) {
      let env
      try {
        env = authenticatedGitEnvironment(cloneURL, token)
      } catch {
        env = undefined
      }
      try {
        await git(
          ['push', '-u', 'origin', branch],
          repoPath,
          [0],
          undefined,
          env
        )
      } catch (error) {
        throw classifyGitHostingError(error)
      }
    }
    return sendJson(res, 200, { repository: created })
  }

  if (req.method === 'POST' && pathname === '/api/hosting/repositories') {
    const body = await parseJsonBody(req)
    if (!services.keytar)
      return sendJson(res, 501, { error: 'OS credential store is unavailable' })
    const { credentialId, endpoint } = requireGitHubCredential(body)
    const token = await services.keytar.getPassword(
      githubCredentialService,
      credentialId
    )
    if (!token)
      return sendJson(res, 401, { error: 'Hosting credentials were not found' })
    return sendJson(res, 200, {
      repositories: await services.hostingRequest(
        endpoint,
        token,
        'GET',
        'user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member'
      ),
    })
  }

  if (req.method === 'POST' && pathname === '/api/hosting/repository') {
    const body = await parseJsonBody(req)
    if (!services.keytar)
      return sendJson(res, 501, { error: 'OS credential store is unavailable' })
    const { credentialId, endpoint } = requireGitHubCredential(body)
    const token = await services.keytar.getPassword(
      githubCredentialService,
      credentialId
    )
    if (!token)
      return sendJson(res, 401, { error: 'Hosting credentials were not found' })
    const owner = requireGitValue(body.owner, 'owner')
    const repository = requireGitValue(body.repository, 'repository')
    return sendJson(res, 200, {
      repository: await services.hostingRequest(
        endpoint,
        token,
        'GET',
        `repos/${owner}/${repository}`
      ),
    })
  }

  if (req.method === 'POST' && pathname === '/api/hosting/fork') {
    const body = await parseJsonBody(req)
    if (!services.keytar)
      return sendJson(res, 501, { error: 'OS credential store is unavailable' })
    const { credentialId, endpoint } = requireGitHubCredential(body)
    const token = await services.keytar.getPassword(
      githubCredentialService,
      credentialId
    )
    if (!token)
      return sendJson(res, 401, { error: 'Hosting credentials were not found' })
    const owner = requireGitValue(body.owner, 'owner')
    const repository = requireGitValue(body.repository, 'repository')
    return sendJson(res, 200, {
      fork: await services.hostingRequest(
        endpoint,
        token,
        'POST',
        `repos/${owner}/${repository}/forks`,
        {}
      ),
    })
  }

  if (req.method === 'POST' && pathname === '/api/hosting/pull-requests') {
    const body = await parseJsonBody(req)
    if (!services.keytar)
      return sendJson(res, 501, { error: 'OS credential store is unavailable' })
    const { credentialId, endpoint } = requireGitHubCredential(body)
    const token = await services.keytar.getPassword(
      githubCredentialService,
      credentialId
    )
    if (!token)
      return sendJson(res, 401, { error: 'Hosting credentials were not found' })
    const owner = requireGitValue(body.owner, 'owner')
    const repository = requireGitValue(body.repository, 'repository')
    if (body.action === 'list') {
      return sendJson(res, 200, {
        pullRequests: await services.hostingRequest(
          endpoint,
          token,
          'GET',
          `repos/${owner}/${repository}/pulls`
        ),
      })
    }
    if (body.action === 'create') {
      const pullRequest = await services.hostingRequest(
        endpoint,
        token,
        'POST',
        `repos/${owner}/${repository}/pulls`,
        {
          title: requireString(body.title, 'title'),
          head: requireGitValue(body.head, 'head branch'),
          base: requireGitValue(body.base, 'base branch'),
          body: String(body.body || ''),
        }
      )
      return sendJson(res, 200, { pullRequest })
    }
    if (body.action === 'details') {
      const pullRequestNumber = Number(body.pullRequestNumber)
      if (!Number.isInteger(pullRequestNumber) || pullRequestNumber < 1)
        return sendJson(res, 400, {
          error: 'pullRequestNumber must be a positive integer',
        })
      const [pullRequest, files, commits] = await Promise.all([
        services.hostingRequest(
          endpoint,
          token,
          'GET',
          `repos/${owner}/${repository}/pulls/${pullRequestNumber}`
        ),
        services.hostingRequest(
          endpoint,
          token,
          'GET',
          `repos/${owner}/${repository}/pulls/${pullRequestNumber}/files?per_page=100`
        ),
        services.hostingRequest(
          endpoint,
          token,
          'GET',
          `repos/${owner}/${repository}/pulls/${pullRequestNumber}/commits?per_page=100`
        ),
      ])
      return sendJson(res, 200, {
        pullRequest,
        commitSHAs: commits.map(commit => commit.sha),
        files: files.map(file => ({
          path: file.filename,
          oldPath: file.previous_filename || undefined,
          status: { kind: githubFileStatus(file.status) },
          commitish: pullRequest.head.sha,
          parentCommitish: pullRequest.base.sha,
          additions: file.additions || 0,
          deletions: file.deletions || 0,
          patch: file.patch || null,
        })),
      })
    }
    return sendJson(res, 400, { error: 'Unsupported pull request action' })
  }

  if (
    req.method === 'POST' &&
    pathname === '/api/hosting/checkout-pull-request'
  ) {
    const body = await parseJsonBody(req)
    if (!services.keytar)
      return sendJson(res, 501, { error: 'OS credential store is unavailable' })
    const { credentialId } = requireGitHubCredential(body)
    const token = await services.keytar.getPassword(
      githubCredentialService,
      credentialId
    )
    if (!token)
      return sendJson(res, 401, { error: 'Hosting credentials were not found' })
    const repoPath = repoPathFrom(url, body)
    const cloneURL = requireGitValue(body.cloneURL, 'cloneURL')
    const headRef = requireGitValue(body.headRef, 'headRef')
    const owner = requireGitValue(body.owner, 'owner')
    const pullRequestNumber = Number(body.pullRequestNumber)
    if (!Number.isInteger(pullRequestNumber) || pullRequestNumber < 1)
      return sendJson(res, 400, {
        error: 'pullRequestNumber must be a positive integer',
      })
    const remoteRows = (await git(['remote', '-v'], repoPath)).stdout
      .split('\n')
      .filter(line => line.endsWith('(fetch)'))
      .map(line => {
        const [name, remoteURL] = line.split(/\s+/)
        return { name, remoteURL }
      })
    let remote = remoteRows.find(
      item =>
        normalizeRemoteURL(item.remoteURL) === normalizeRemoteURL(cloneURL)
    )?.name
    if (!remote) {
      const baseName = `desktop-pr-${owner}`
        .replace(/[^A-Za-z0-9._-]/g, '-')
        .slice(0, 80)
      remote = baseName || `desktop-pr-${pullRequestNumber}`
      const existing = remoteRows.find(item => item.name === remote)
      if (existing) {
        await git(['remote', 'set-url', remote, cloneURL], repoPath)
      } else {
        await git(['remote', 'add', remote, cloneURL], repoPath)
      }
    }
    let env
    try {
      env = authenticatedGitEnvironment(cloneURL, token)
    } catch {
      env = undefined
    }
    try {
      await git(['fetch', remote, headRef], repoPath, [0], undefined, env)
    } catch (error) {
      throw classifyGitHostingError(error)
    }
    const preferredBranch = headRef
    const localExists =
      (
        await git(
          ['show-ref', '--verify', `refs/heads/${preferredBranch}`],
          repoPath,
          [0, 1, 128]
        )
      ).exitCode === 0
    const branch = localExists ? preferredBranch : `pr/${pullRequestNumber}`
    const branchExists =
      (
        await git(
          ['show-ref', '--verify', `refs/heads/${branch}`],
          repoPath,
          [0, 1, 128]
        )
      ).exitCode === 0
    if (branchExists) {
      await git(['checkout', branch], repoPath)
      await git(['reset', '--hard', 'FETCH_HEAD'], repoPath)
    } else {
      await git(['checkout', '-b', branch, 'FETCH_HEAD'], repoPath)
      await git(
        ['branch', '--set-upstream-to', `${remote}/${headRef}`, branch],
        repoPath,
        [0, 128]
      )
    }
    return sendJson(res, 200, { branch, remote })
  }

  if (
    req.method === 'POST' &&
    pathname === '/api/hosting/prepare-pull-request-branch'
  ) {
    const body = await parseJsonBody(req)
    if (!services.keytar)
      return sendJson(res, 501, { error: 'OS credential store is unavailable' })
    const { credentialId } = requireGitHubCredential(body)
    const token = await services.keytar.getPassword(
      githubCredentialService,
      credentialId
    )
    if (!token)
      return sendJson(res, 401, { error: 'Hosting credentials were not found' })
    const repoPath = repoPathFrom(url, body)
    const cloneURL = requireGitValue(body.cloneURL, 'cloneURL')
    const headRef = requireGitValue(body.headRef, 'headRef')
    const owner = requireGitValue(body.owner, 'owner')
    const pullRequestNumber = Number(body.pullRequestNumber)
    if (!Number.isInteger(pullRequestNumber) || pullRequestNumber < 1)
      return sendJson(res, 400, {
        error: 'pullRequestNumber must be a positive integer',
      })

    const remoteRows = (await git(['remote', '-v'], repoPath)).stdout
      .split('\n')
      .filter(line => line.endsWith('(fetch)'))
      .map(line => {
        const [name, remoteURL] = line.split(/\s+/)
        return { name, remoteURL }
      })
    let remote = remoteRows.find(
      item =>
        normalizeRemoteURL(item.remoteURL) === normalizeRemoteURL(cloneURL)
    )?.name
    let addedForkRemote = false
    if (!remote) {
      const baseName = `desktop-pr-${owner}`
        .replace(/[^A-Za-z0-9._-]/g, '-')
        .slice(0, 80)
      remote = baseName || `desktop-pr-${pullRequestNumber}`
      const existing = remoteRows.find(item => item.name === remote)
      if (existing) {
        await git(['remote', 'set-url', remote, cloneURL], repoPath)
      } else {
        await git(['remote', 'add', remote, cloneURL], repoPath)
      }
      addedForkRemote = true
    }

    let env
    try {
      env = authenticatedGitEnvironment(cloneURL, token)
    } catch {
      env = undefined
    }
    const remoteRef = `${remote}/${headRef}`
    try {
      await git(
        [
          'fetch',
          remote,
          `+refs/heads/${headRef}:refs/remotes/${remote}/${headRef}`,
        ],
        repoPath,
        [0],
        undefined,
        env
      )
    } catch (error) {
      throw classifyGitHostingError(error)
    }

    const localBranches = (
      await git(
        [
          'for-each-ref',
          '--format=%(refname:short)%00%(upstream:short)',
          'refs/heads',
        ],
        repoPath
      )
    ).stdout
      .split('\n')
      .filter(Boolean)
      .map(row => {
        const [name, upstream] = row.split('\0')
        return { name, upstream }
      })
    const trackingBranch = localBranches.find(
      branch => branch.upstream === remoteRef
    )
    if (trackingBranch)
      return sendJson(res, 200, {
        branchName: trackingBranch.name,
        branchType: 'Local',
        remote,
      })

    const isForkRemote =
      addedForkRemote || (remote !== 'origin' && remote !== 'upstream')
    if (!isForkRemote)
      return sendJson(res, 200, {
        branchName: remoteRef,
        branchType: 'Remote',
        remote,
      })

    const branchName = `pr/${pullRequestNumber}`
    const branchExists =
      (
        await git(
          ['show-ref', '--verify', `refs/heads/${branchName}`],
          repoPath,
          [0, 1, 128]
        )
      ).exitCode === 0
    if (!branchExists)
      await git(
        ['branch', branchName, `refs/remotes/${remote}/${headRef}`],
        repoPath
      )
    return sendJson(res, 200, {
      branchName,
      branchType: 'Local',
      remote,
    })
  }

  if (req.method === 'POST' && pathname === '/api/hosting/checks') {
    const body = await parseJsonBody(req)
    if (!services.keytar)
      return sendJson(res, 501, { error: 'OS credential store is unavailable' })
    const { credentialId, endpoint } = requireGitHubCredential(body)
    const token = await services.keytar.getPassword(
      githubCredentialService,
      credentialId
    )
    if (!token)
      return sendJson(res, 401, { error: 'Hosting credentials were not found' })
    const owner = requireGitValue(body.owner, 'owner')
    const repository = requireGitValue(body.repository, 'repository')
    if (body.action === 'get') {
      const ref = requireString(body.ref, 'ref')
      const encodedRef = encodeURIComponent(ref)
      const [checkRuns, statuses] = await Promise.all([
        services.hostingRequest(
          endpoint,
          token,
          'GET',
          `repos/${owner}/${repository}/commits/${encodedRef}/check-runs`
        ),
        services.hostingRequest(
          endpoint,
          token,
          'GET',
          `repos/${owner}/${repository}/commits/${encodedRef}/status`
        ),
      ])
      return sendJson(res, 200, {
        check: combineGitHubChecks(
          Array.isArray(checkRuns.check_runs) ? checkRuns.check_runs : [],
          Array.isArray(statuses.statuses) ? statuses.statuses : []
        ),
      })
    }
    if (body.action === 'suite') {
      const checkSuiteId = Number(body.checkSuiteId)
      if (!Number.isInteger(checkSuiteId) || checkSuiteId < 1)
        return sendJson(res, 400, {
          error: 'checkSuiteId must be a positive integer',
        })
      return sendJson(res, 200, {
        checkSuite: await services.hostingRequest(
          endpoint,
          token,
          'GET',
          `repos/${owner}/${repository}/check-suites/${checkSuiteId}`
        ),
      })
    }
    if (body.action === 'rerun') {
      const checkSuiteIds = Array.isArray(body.checkSuiteIds)
        ? [...new Set(body.checkSuiteIds.map(Number))]
        : []
      if (
        checkSuiteIds.length === 0 ||
        checkSuiteIds.some(id => !Number.isInteger(id) || id < 1)
      )
        return sendJson(res, 400, {
          error: 'checkSuiteIds must contain positive integers',
        })
      const results = await Promise.all(
        checkSuiteIds.map(async checkSuiteId => {
          await services.hostingRequest(
            endpoint,
            token,
            'POST',
            `repos/${owner}/${repository}/check-suites/${checkSuiteId}/rerequest`
          )
          return true
        })
      )
      return sendJson(res, 200, { results })
    }
    return sendJson(res, 400, { error: 'Unsupported checks action' })
  }

  if (req.method === 'POST' && pathname === '/api/hosting/notifications') {
    const body = await parseJsonBody(req)
    if (!services.keytar)
      return sendJson(res, 501, { error: 'OS credential store is unavailable' })
    const { credentialId, endpoint } = requireGitHubCredential(body)
    const token = await services.keytar.getPassword(
      githubCredentialService,
      credentialId
    )
    if (!token)
      return sendJson(res, 401, { error: 'Hosting credentials were not found' })
    if (body.action === 'list') {
      const notifications = await services.hostingRequest(
        endpoint,
        token,
        'GET',
        'notifications?all=false&participating=false'
      )
      return sendJson(res, 200, {
        notifications: Array.isArray(notifications)
          ? notifications.map(notification => ({
              id: String(notification.id),
              reason: String(notification.reason || ''),
              updatedAt: String(notification.updated_at || ''),
              title: String(
                notification.subject?.title || 'GitHub notification'
              ),
              type: String(notification.subject?.type || ''),
              target: githubNotificationTarget(notification),
            }))
          : [],
      })
    }
    if (body.action === 'mark-read') {
      const notificationId = requireGitValue(
        requireString(body.notificationId, 'notification ID'),
        'notification ID'
      )
      await services.hostingRequest(
        endpoint,
        token,
        'PATCH',
        `notifications/threads/${notificationId}`
      )
      return sendJson(res, 200, { ok: true })
    }
    return sendJson(res, 400, { error: 'Unsupported notifications action' })
  }

  if (req.method === 'POST' && pathname === '/api/hosting/policies') {
    const body = await parseJsonBody(req)
    if (!services.keytar)
      return sendJson(res, 501, { error: 'OS credential store is unavailable' })
    const { credentialId, endpoint } = requireGitHubCredential(body)
    const token = await services.keytar.getPassword(
      githubCredentialService,
      credentialId
    )
    if (!token)
      return sendJson(res, 401, { error: 'Hosting credentials were not found' })
    const owner = requireGitValue(body.owner, 'owner')
    const repository = requireGitValue(body.repository, 'repository')
    if (body.action === 'load') {
      const branch = requireGitValue(body.branch, 'branch')
      return sendJson(res, 200, {
        policies: await loadRepositoryPolicies(
          services.hostingRequest,
          endpoint,
          token,
          owner,
          repository,
          branch
        ),
      })
    }
    return sendJson(res, 400, { error: 'Unsupported repository policy action' })
  }

  if (req.method === 'POST' && pathname === '/api/hosting/push') {
    const body = await parseJsonBody(req)
    if (!services.keytar)
      return sendJson(res, 501, { error: 'OS credential store is unavailable' })
    const { credentialId, endpoint } = requireGitHubCredential(body)
    const token = await services.keytar.getPassword(
      githubCredentialService,
      credentialId
    )
    if (!token)
      return sendJson(res, 401, { error: 'Hosting credentials were not found' })
    const owner = requireGitValue(body.owner, 'owner')
    const repository = requireGitValue(body.repository, 'repository')
    const branch = requireGitValue(body.branch, 'branch')
    const repoPath = repoPathFrom(url, body)
    const remoteURL = (
      await git(['remote', 'get-url', 'origin'], repoPath)
    ).stdout.trim()
    let env
    try {
      env = authenticatedGitEnvironment(remoteURL, token)
    } catch {
      env = undefined
    }
    try {
      await git(['push', '-u', 'origin', branch], repoPath, [0], undefined, env)
    } catch (error) {
      throw classifyGitHostingError(error)
    }
    return sendJson(res, 200, {
      ok: true,
      owner,
      repository,
      branch,
    })
  }

  if (req.method === 'POST' && pathname === '/api/hosting/logout') {
    const body = await parseJsonBody(req)
    const credentialId = requireString(body.credentialId, 'credentialId')
    if (!services.keytar)
      return sendJson(res, 501, { error: 'OS credential store is unavailable' })
    return sendJson(res, 200, {
      deleted: await services.keytar.deletePassword(
        githubCredentialService,
        credentialId
      ),
    })
  }

  return false
}

function parseLoopbackHost(host = '') {
  if (
    typeof host !== 'string' ||
    host.length === 0 ||
    host.length > 255 ||
    /[\s/@\\]/.test(host)
  )
    return null
  try {
    const parsed = new URL(`http://${host}`)
    const hostname = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase()
    if (!['localhost', '127.0.0.1', '::1'].includes(hostname)) return null
    if (
      parsed.port &&
      (!/^\d+$/.test(parsed.port) ||
        Number(parsed.port) < 1 ||
        Number(parsed.port) > 65535)
    )
      return null
    return { host: parsed.host, hostname }
  } catch {
    return null
  }
}

function isAuthorizedApiRequest(req, token) {
  const supplied = req.headers['x-desktop-plus-session']
  if (
    typeof supplied !== 'string' ||
    supplied.length !== token.length ||
    !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(token))
  )
    return false
  const origin = req.headers.origin
  if (!origin) return true
  try {
    const parsed = new URL(origin)
    const requestHost = parseLoopbackHost(req.headers.host)
    return (
      parsed.protocol === 'http:' &&
      parsed.origin === origin &&
      requestHost !== null &&
      parsed.host === requestHost.host &&
      parseLoopbackHost(parsed.host) !== null
    )
  } catch {
    return false
  }
}

async function serveStatic(req, res, pathname, sessionToken) {
  let relative
  try {
    relative =
      pathname === '/'
        ? 'index.html'
        : decodeURIComponent(pathname).replace(/^\/+/, '')
  } catch {
    return false
  }
  const fullPath = path.resolve(publicDir, relative)
  if (!fullPath.startsWith(`${publicDir}${path.sep}`) && fullPath !== publicDir)
    return false
  try {
    if (!(await fs.promises.stat(fullPath)).isFile()) return false
  } catch {
    return false
  }
  const extension = path.extname(fullPath).toLowerCase()
  const allowedExtensions = new Set([
    '.css',
    '.gitignore',
    '.html',
    '.js',
    '.json',
    '.md',
    '.png',
    '.svg',
  ])
  if (!allowedExtensions.has(extension)) return false
  if (extension === '.html' && relative !== 'index.html') return false
  const contentTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.md': 'text/plain; charset=utf-8',
    '.gitignore': 'text/plain; charset=utf-8',
  }
  const contentType =
    contentTypes[path.extname(fullPath)] || 'application/octet-stream'
  if (relative === 'index.html') {
    const indexTemplate = await fs.promises.readFile(fullPath, 'utf8')
    const home = os.homedir()
    const runtime = {
      session: sessionToken,
      platform: process.platform,
      paths: {
        cwd: process.cwd(),
        home,
        documents: path.join(home, 'Documents'),
        downloads: path.join(home, 'Downloads'),
        desktop: path.join(home, 'Desktop'),
        temp: os.tmpdir(),
      },
    }
    const html = indexTemplate.replace(
      '__DESKTOP_PLUS_RUNTIME__',
      JSON.stringify(runtime)
        .replace(/</g, '\\u003c')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029')
    )
    res.writeHead(
      200,
      securityHeaders({
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
        'Content-Length': Buffer.byteLength(html),
      })
    )
    res.end(req.method === 'HEAD' ? undefined : html)
    return true
  }
  const isHashedAsset =
    relative.startsWith('assets/') && /-[a-f0-9]{8,32}\./.test(relative)
  const isFont = extension === '.woff2' || extension === '.ttf'
  const cacheControl =
    isHashedAsset || isFont
      ? 'public, max-age=31536000, immutable'
      : relative.startsWith('static/') || extension === '.png'
      ? 'public, max-age=86400, stale-while-revalidate=3600'
      : 'no-cache'
  const stat = await fs.promises.stat(fullPath)
  res.writeHead(
    200,
    securityHeaders({
      'Content-Type': contentType,
      'Cache-Control': cacheControl,
      'Content-Length': stat.size,
      ...(extension === '.svg'
        ? {
            'Content-Security-Policy':
              "sandbox; default-src 'none'; style-src 'unsafe-inline'",
          }
        : {}),
    })
  )
  if (req.method === 'HEAD') res.end()
  else fs.createReadStream(fullPath).pipe(res)
  return true
}

function createServer(options = {}) {
  const sessionToken =
    options.sessionToken || crypto.randomBytes(32).toString('base64url')
  let server = null
  const services = {
    selectDirectory: options.selectDirectory || platform.selectDirectory,
    selectSavePath: options.selectSavePath || platform.selectSavePath,
    openPath: options.openPath || platform.openPath,
    moveToTrash: options.moveToTrash || platform.moveToTrash,
    discoverIntegrations:
      options.discoverIntegrations || platform.discoverIntegrations,
    launchIntegration: options.launchIntegration || platform.launchIntegration,
    runIntegrationForOutput:
      options.runIntegrationForOutput || platform.runIntegrationForOutput,
    keytar: options.keytar === undefined ? keytar : options.keytar,
    hostingRequest: options.hostingRequest || hostingRequest,
    gitLabRequest: options.gitLabRequest || gitLabRequest,
    getDesktopRepositories:
      options.getDesktopRepositories || getDesktopRepositories,
    withCopilotClient: options.withCopilotClient || withCopilotClient,
    getLfsStatus: options.getLfsStatus || getLfsStatus,
    installLfs: options.installLfs || installLfs,
    repairLfs: options.repairLfs || repairLfs,
    updates:
      options.updates ||
      createUpdateManager({
        currentVersion: require('../app/package.json').version,
        openArtifact: options.openUpdateArtifact || platform.openPath,
      }),
    lfsTasks: options.lfsTasks || createLfsTaskManager(),
    sessionToken,
    getServerURL: () => {
      const address = server?.address()
      return address && typeof address === 'object'
        ? `http://127.0.0.1:${address.port}`
        : null
    },
  }
  services.operationTasks =
    options.operationTasks || createOperationTaskManager(services)
  server = http.createServer(async (req, res) => {
    if (!parseLoopbackHost(req.headers.host))
      return sendJson(res, 403, { error: 'Invalid Host header' })
    const url = new URL(req.url, `http://${req.headers.host}`)
    try {
      if (url.pathname.startsWith('/api/')) {
        if (!isAuthorizedApiRequest(req, sessionToken))
          return sendJson(res, 403, { error: 'Invalid companion session' })
        const handled = await routeApi(req, res, url, services)
        if (handled !== false) return
        return sendJson(res, 404, { error: 'Not found' })
      }
      if (
        (req.method === 'GET' || req.method === 'HEAD') &&
        (await serveStatic(req, res, url.pathname, sessionToken))
      )
        return
      return sendJson(res, 404, { error: 'Not found' })
    } catch (error) {
      const statusCode = error.statusCode || 500
      if (statusCode === 500)
        console.error(`${req.method} ${url.pathname}`, error)
      const result = error.result
      return sendJson(res, statusCode, {
        error: statusCode === 500 ? 'Internal server error' : error.message,
        ...(error.code ? { code: error.code } : {}),
        ...(error.configLockScope
          ? { configLockScope: error.configLockScope }
          : {}),
        ...(error.hookFailure ? { hookFailure: error.hookFailure } : {}),
        ...(error.bypassURL ? { bypassURL: error.bypassURL } : {}),
        ...(result && statusCode < 500
          ? {
              stdout: result.stdout,
              stderr: result.stderr,
              exitCode: result.exitCode,
            }
          : {}),
      })
    }
  })
  server.on('close', () => {
    services.lfsTasks.cancelAll()
    services.operationTasks.cancelAll()
    services.updates.cancelAll?.()
  })
  server.sessionToken = sessionToken
  return server
}

if (require.main === module) {
  const port = resolveServerPort()
  createServer().listen(port, '127.0.0.1', () => {
    console.log(
      `[Desktop Plus Web Server] listening at http://127.0.0.1:${port}`
    )
  })
}

module.exports = {
  createServer,
  resolveServerPort,
  webOperationNames,
  readStoredGitCredential,
  gitOperationAuthenticationEnvironment,
}
