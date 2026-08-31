function encodePathAsUrl(...segments) {
  const assetPath = segments[segments.length - 1] || ''
  const filename = assetPath.split(/[\\/]/).pop() || ''
  if (filename === 'highlighter.js') return '/highlighter.js'
  return `/static/${filename}`
}

async function resolveWithin() {
  return null
}

module.exports = {
  encodePathAsUrl,
  posix: { resolveWithin },
  resolveWithin,
  resolveWithinPosix: resolveWithin,
  resolveWithinWin32: resolveWithin,
  win32: { resolveWithin },
}
