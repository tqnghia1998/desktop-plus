function runtimeHeaders(headers) {
  const result = new Headers(headers)
  result.set(
    'X-Desktop-Plus-Session',
    window.__DESKTOP_PLUS_RUNTIME__?.session || ''
  )
  return result
}

async function addWorktreeWithIncludes(repository, worktreePath, options = {}) {
  const response = await fetch('/api/git/operation', {
    method: 'POST',
    headers: runtimeHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      path: repository.path,
      operation: 'worktree-add',
      values: [worktreePath],
      worktreePath,
      ...(options.createBranch ? { createBranch: options.createBranch } : {}),
      ...(options.commitish ? { commitish: options.commitish } : {}),
    }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Unable to add worktree')
  if (worktreePath.startsWith('/var/')) {
    const aliases = (window.__DESKTOP_PLUS_WORKTREE_PATH_ALIASES__ ||=
      Object.create(null))
    aliases[`/private${worktreePath}`] = worktreePath
  }
}

module.exports = {
  addWorktreeWithIncludes,
}
