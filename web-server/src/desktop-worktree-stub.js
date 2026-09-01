function runtimeHeaders(headers) {
  const result = new Headers(headers)
  result.set(
    'X-Desktop-Plus-Session',
    window.__DESKTOP_PLUS_RUNTIME__?.session || ''
  )
  return result
}

async function request(path, init = {}) {
  const response = await fetch(path, {
    ...init,
    headers: runtimeHeaders(init.headers),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Git operation failed')
  return payload
}

async function listWorktrees(repositoryOrPath) {
  const path =
    typeof repositoryOrPath === 'string'
      ? repositoryOrPath
      : repositoryOrPath.path
  const branches = await request(
    `/api/branches/current?${new URLSearchParams({ path })}`
  )
  const aliases = window.__DESKTOP_PLUS_WORKTREE_PATH_ALIASES__ || {}
  return (branches.worktrees || []).map(worktree => ({
    ...worktree,
    path: aliases[worktree.path] || worktree.path,
  }))
}

module.exports = {
  listWorktrees,
}
