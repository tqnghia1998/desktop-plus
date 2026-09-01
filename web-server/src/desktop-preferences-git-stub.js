const config = require('./desktop-preferences-git-config-stub')
const { request } = require('./desktop-preferences-runtime')
const { git } = require('./desktop-git-core-stub')

function isConfigFileLockError() {
  return false
}

function parseConfigLockFilePathFromError() {
  return null
}

async function doMergeCommitsExistAfterCommit() {
  return false
}

function revSymmetricDifference(from, to) {
  return `${from}...${to}`
}

async function getCommitsBetweenCommits(
  repository,
  baseBranchSha,
  targetBranchSha
) {
  const result = await git(
    [
      'rev-list',
      `${baseBranchSha}..${targetBranchSha}`,
      '--reverse',
      '--oneline',
      '--no-abbrev-commit',
      '--',
    ],
    repository.path,
    'getCommitsInRange',
    { expectedErrors: new Set([28]) }
  )
  if (result.gitError === 28) return null

  return result.stdout.split('\n').flatMap(line => {
    const match = /^([a-z0-9]{40}) (.*)$/.exec(line)
    return match ? [{ sha: match[1], summary: match[2] }] : []
  })
}

async function getAheadBehind(repository, range) {
  const result = await git(
    ['rev-list', '--left-right', '--count', range, '--'],
    repository.path,
    'getAheadBehind',
    { expectedErrors: new Set([28]) }
  )
  if (result.gitError === 28) return null

  const pieces = result.stdout.trim().split(/\s+/)
  if (pieces.length !== 2) return null
  const ahead = Number.parseInt(pieces[0], 10)
  const behind = Number.parseInt(pieces[1], 10)
  return Number.isNaN(ahead) || Number.isNaN(behind) ? null : { ahead, behind }
}

async function getRepositoryType(path) {
  const inspection = await request('/api/repository/inspect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  })

  switch (inspection.kind) {
    case 'regular':
      return {
        kind: 'regular',
        // Preserve the entered root alias for Desktop dialog comparisons.
        topLevelWorkingDirectory: inspection.isRepositoryRoot
          ? inspection.path
          : inspection.repositoryPath,
        // Required by the Desktop Git API contract.
        gitDir: `${inspection.repositoryPath}/.git`,
      }
    case 'bare':
      return { kind: 'bare' }
    case 'unsafe':
      return { kind: 'unsafe', path: inspection.unsafePath || inspection.path }
    default:
      return { kind: 'missing' }
  }
}

async function addSafeDirectory(path) {
  await request('/api/repository/trust', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  })
}

async function runOperation(path, operation, body = {}) {
  return request('/api/git/operation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, operation, ...body }),
  })
}

async function initGitRepository(path) {
  await runOperation(path, 'init')
}

async function getStatus(repository) {
  const path = typeof repository === 'string' ? repository : repository.path
  const response = await fetch(
    `/api/status?${new URLSearchParams({ path }).toString()}`,
    {
      headers: {
        'X-Desktop-Plus-Session':
          window.__DESKTOP_PLUS_RUNTIME__?.session || '',
      },
    }
  )
  const payload = await response.json()
  if (!response.ok) throw new Error(payload.error || 'Unable to read status')
  return { workingDirectory: { files: payload.workingDirectory.files || [] } }
}

async function createCommit(repository, message) {
  const path = repository.path
  const status = await getStatus(repository)
  const files = status.workingDirectory.files.map(file => file.path)
  if (files.length === 0) return ''
  await runOperation(path, 'commit', { files, message })
  return ''
}

async function getAuthorIdentity() {
  return null
}

module.exports = {
  ...config,
  addSafeDirectory,
  createCommit,
  doMergeCommitsExistAfterCommit,
  getAuthorIdentity,
  getAheadBehind,
  getCommitsBetweenCommits,
  getRepositoryType,
  getStatus,
  initGitRepository,
  isConfigFileLockError,
  parseConfigLockFilePathFromError,
  revSymmetricDifference,
}
