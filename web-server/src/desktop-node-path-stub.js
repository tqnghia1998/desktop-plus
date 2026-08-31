function separator(path) {
  return path.includes('\\') ? '\\' : '/'
}

function normalize(path) {
  const slash = separator(path)
  const absolute = path.startsWith('/') || path.startsWith('\\')
  const segments = path.split(/[\\/]+/)
  const output = []

  for (const segment of segments) {
    if (!segment || segment === '.') continue
    if (segment === '..') {
      if (output.length > 0 && output[output.length - 1] !== '..') output.pop()
      else if (!absolute) output.push(segment)
      continue
    }
    output.push(segment)
  }

  const result = output.join(slash)
  return absolute ? `${slash}${result}` || slash : result || '.'
}

function join(...segments) {
  return normalize(segments.filter(Boolean).join('/'))
}

function basename(path, extension = '') {
  const name = path.split(/[\\/]/).pop() || ''
  return extension && name.endsWith(extension)
    ? name.slice(0, -extension.length)
    : name
}

function dirname(path) {
  const slash = separator(path)
  const normalized = normalize(path)
  const index = Math.max(
    normalized.lastIndexOf('/'),
    normalized.lastIndexOf('\\')
  )
  if (index < 0) return '.'
  if (index === 0) return slash
  return normalized.slice(0, index)
}

function extname(path) {
  const name = basename(path)
  const index = name.lastIndexOf('.')
  return index > 0 ? name.slice(index) : ''
}

function relative(from, to) {
  const fromParts = normalize(from)
    .split(/[\\/]+/)
    .filter(Boolean)
  const toParts = normalize(to)
    .split(/[\\/]+/)
    .filter(Boolean)
  while (fromParts.length && toParts.length && fromParts[0] === toParts[0]) {
    fromParts.shift()
    toParts.shift()
  }
  return [...fromParts.map(() => '..'), ...toParts].join('/')
}

const path = {
  basename,
  delimiter: ':',
  dirname,
  extname,
  isAbsolute: value => value.startsWith('/') || value.startsWith('\\'),
  join,
  normalize,
  relative,
  resolve: (...segments) => normalize(join(...segments)),
  sep: '/',
}

path.posix = path
path.win32 = { ...path, delimiter: ';', sep: '\\' }

module.exports = path
