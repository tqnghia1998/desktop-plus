const {
  request,
  selectedRepositoryPath,
} = require('./desktop-preferences-runtime')

const globalConfigCache = new Map()

function repositoryPath(repository) {
  if (typeof repository === 'string') return repository
  return repository?.path || selectedRepositoryPath()
}

async function config(scope, name, value, operation, repository) {
  const path = repositoryPath(repository)
  if (!path && scope !== 'global')
    throw new Error('Open a repository before changing Git configuration.')
  return request('/api/git/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, scope, name, value, operation }),
  })
}

async function getConfigValue(repository, name, onlyLocal = false) {
  if (onlyLocal && !repositoryPath(repository)) return null
  try {
    const payload = await config(
      onlyLocal ? 'local' : 'effective',
      name,
      undefined,
      'get',
      repository
    )
    return payload.value || null
  } catch (error) {
    if (error?.code === 'missing-repository') return null
    throw error
  }
}

async function getGlobalConfigValue(name) {
  if (globalConfigCache.has(name)) return globalConfigCache.get(name)

  const pending = config('global', name, undefined, 'get').then(payload => {
    const value = payload.value || null
    globalConfigCache.set(name, value)
    return value
  })
  pending.catch(() => {
    if (globalConfigCache.get(name) === pending) globalConfigCache.delete(name)
  })
  globalConfigCache.set(name, pending)
  return pending
}

async function setConfigValue(repository, name, value) {
  await config('local', name, value, 'set', repository)
}

async function setGlobalConfigValue(name, value) {
  globalConfigCache.delete(name)
  await config('global', name, value, 'set')
}

async function removeConfigValue(repository, name) {
  await config('local', name, undefined, 'remove', repository)
}

async function removeGlobalConfigValue(name) {
  globalConfigCache.delete(name)
  await config('global', name, undefined, 'remove')
}

async function getConfigValueWithOrigin(repository, name) {
  const payload = await config('origin', name, undefined, 'get', repository)
  return payload.origin || null
}

module.exports = {
  getConfigValue,
  getConfigValueWithOrigin,
  getGlobalConfigValue,
  removeConfigValue,
  removeGlobalConfigValue,
  setConfigValue,
  setGlobalConfigValue,
}
