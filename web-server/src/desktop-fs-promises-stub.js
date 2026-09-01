const { request } = require('./desktop-preferences-runtime')

async function mkdir(path, options = {}) {
  await request('/api/files/mkdir', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, recursive: options.recursive === true }),
  })
}

async function readdir(path) {
  const payload = await request('/api/files/read-directory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  })
  return payload.entries
}

async function stat(path) {
  const payload = await request('/api/files/stat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  })
  return { isDirectory: () => payload.isDirectory === true }
}

async function access(path) {
  const payload = await request('/api/files/stat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  })
  if (!payload.exists) throw new Error('Path does not exist')
}

module.exports = { access, mkdir, readdir, stat }
