const { request } = require('./desktop-preferences-runtime')

async function stat(path) {
  return request('/api/files/stat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  })
}

async function directoryExists(path) {
  try {
    return (await stat(path)).isDirectory === true
  } catch {
    return false
  }
}

async function pathExists(path) {
  try {
    return (await stat(path)).exists === true
  } catch {
    return false
  }
}

module.exports = { directoryExists, pathExists }
