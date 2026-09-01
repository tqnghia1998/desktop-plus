const { request } = require('./desktop-preferences-runtime')

const BadRevision = 28
const CannotMergeUnrelatedHistories = 30

class GitError extends Error {
  constructor(result, args, terminalOutput) {
    super(terminalOutput || 'Git operation failed')
    this.name = 'GitError'
    this.result = result
    this.args = args
    this.isRawMessage = Boolean(terminalOutput)
  }
}

function isAuthFailureError() {
  return false
}

function parseGitError(stderr, stdout) {
  const output = `${stderr || ''}\n${stdout || ''}`
  if (/fatal: bad revision ['"].*['"]/i.test(output)) return BadRevision
  if (/fatal: refusing to merge unrelated histories/i.test(output))
    return CannotMergeUnrelatedHistories
  return null
}

function describeGitError(error) {
  switch (error) {
    case BadRevision:
      return 'The requested Git revision does not exist.'
    case CannotMergeUnrelatedHistories:
      return 'The branches do not share a common history.'
    default:
      return null
  }
}

async function git(args, path, _name, options = {}) {
  const result = await request('/api/git/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, args }),
  })
  const successExitCodes = options.successExitCodes || new Set([0])
  const acceptableExitCode = successExitCodes.has(result.exitCode)
  const parsedError = acceptableExitCode
    ? null
    : parseGitError(result.stderr, result.stdout)
  const gitResult = {
    ...result,
    gitError: parsedError,
    gitErrorDescription: describeGitError(parsedError),
    path,
  }
  const acceptableError =
    parsedError !== null && options.expectedErrors?.has(parsedError)

  if (acceptableExitCode || acceptableError) return gitResult

  throw new GitError(
    gitResult,
    args,
    result.stderr ||
      result.stdout ||
      `git ${args[0]} exited with ${result.exitCode}`
  )
}

function isGitError(error, kind) {
  return (
    error instanceof GitError &&
    (kind === undefined || error.result.gitError === kind)
  )
}

module.exports = {
  GitError,
  git,
  isAuthFailureError,
  isGitError,
}
