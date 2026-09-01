const {
  request,
  selectedRepositoryPath,
} = require('./desktop-preferences-runtime')

function repositoryPath(repository) {
  return typeof repository === 'string'
    ? repository
    : repository?.path || selectedRepositoryPath()
}

async function readGitIgnoreAtRoot(repository) {
  const payload = await request(
    `/api/gitignore?path=${encodeURIComponent(
      repositoryPath(repository) || ''
    )}`
  )
  return payload.text
}

async function saveGitIgnore(repository, text) {
  await request('/api/gitignore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: repositoryPath(repository), text }),
  })
}

module.exports = { readGitIgnoreAtRoot, saveGitIgnore }
