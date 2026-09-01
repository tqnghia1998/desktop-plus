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
  if (!response.ok) {
    const error = new Error(payload.error || 'Browser request failed')
    if (typeof payload.code === 'string') error.code = payload.code
    throw error
  }
  return payload
}

function selectedRepositoryPath() {
  return window.__DESKTOP_PLUS_WEB_REPOSITORY_PATH__ || null
}

module.exports = {
  request,
  selectedRepositoryPath,
}
