const { execFile } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const desktopDataDirectoryNames = [
  'Desktop Plus',
  'Desktop Plus-dev',
  'GitHub Desktop Plus',
]

function getDesktopDataDirectories(
  home = os.homedir(),
  platform = process.platform
) {
  if (platform === 'darwin') {
    const applicationSupport = path.join(home, 'Library', 'Application Support')
    return desktopDataDirectoryNames.map(name =>
      path.join(applicationSupport, name)
    )
  }

  if (platform === 'win32') {
    const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming')
    return desktopDataDirectoryNames.map(name => path.join(appData, name))
  }

  const configHome = process.env.XDG_CONFIG_HOME || path.join(home, '.config')
  return desktopDataDirectoryNames.map(name => path.join(configHome, name))
}

function isPathWithin(root, candidate) {
  const relative = path.relative(root, candidate)
  return (
    relative === '' ||
    (!relative.startsWith(`..${path.sep}`) && relative !== '..')
  )
}

function extractAbsolutePaths(buffer, home = os.homedir()) {
  const text = buffer.toString('latin1')
  const matches = text.match(
    /(?:\/(?:[^\u0000-\u001f"<>]+)|[A-Za-z]:\\[^\u0000-\u001f"<>]+)/g
  )
  if (!matches) return []

  const candidates = new Set()
  for (const rawPath of matches) {
    const normalized = path.normalize(rawPath.trim())
    if (!path.isAbsolute(normalized) || !isPathWithin(home, normalized))
      continue
    candidates.add(normalized)
  }
  return [...candidates]
}

function readIndexedDbCandidates(dataDirectory, home) {
  const databaseDirectory = path.join(
    dataDirectory,
    'IndexedDB',
    'file__0.indexeddb.leveldb'
  )
  let entries
  try {
    entries = fs.readdirSync(databaseDirectory, { withFileTypes: true })
  } catch {
    return []
  }

  const paths = new Set()
  for (const entry of entries) {
    if (!entry.isFile() || !/\.(?:ldb|log)$/i.test(entry.name)) continue
    try {
      for (const candidate of extractAbsolutePaths(
        fs.readFileSync(path.join(databaseDirectory, entry.name)),
        home
      )) {
        paths.add(candidate)
      }
    } catch {
      // The desktop process may rotate a LevelDB file while it is being read.
    }
  }
  return [...paths]
}

function gitTopLevel(repositoryPath) {
  return new Promise(resolve => {
    execFile(
      'git',
      ['-C', repositoryPath, 'rev-parse', '--show-toplevel'],
      { windowsHide: true, timeout: 5_000, maxBuffer: 8 * 1024 },
      (error, stdout) => {
        if (error) return resolve(null)
        const topLevel = stdout.trim()
        resolve(path.isAbsolute(topLevel) ? path.normalize(topLevel) : null)
      }
    )
  })
}

async function getDesktopRepositories(options = {}) {
  const home = options.home || os.homedir()
  const directories =
    options.directories || getDesktopDataDirectories(home, options.platform)
  const candidates = new Set()
  for (const directory of directories) {
    for (const candidate of readIndexedDbCandidates(directory, home))
      candidates.add(candidate)
  }

  const repositories = new Set()
  for (const candidate of candidates) {
    const topLevel = await gitTopLevel(candidate)
    if (topLevel) repositories.add(topLevel)
  }

  return [...repositories]
    .sort((left, right) => left.localeCompare(right))
    .map(repositoryPath => ({ path: repositoryPath }))
}

module.exports = {
  extractAbsolutePaths,
  getDesktopDataDirectories,
  getDesktopRepositories,
  isPathWithin,
}
