function runtimePaths() {
  return window.__DESKTOP_PLUS_RUNTIME__?.paths || {}
}

function homedir() {
  return runtimePaths().home || '/'
}

function tmpdir() {
  return runtimePaths().temp || '/'
}

module.exports = {
  EOL: '\n',
  homedir,
  platform: () => window.__DESKTOP_PLUS_RUNTIME__?.platform || 'darwin',
  release: () => '0',
  tmpdir,
  type: () => 'Darwin',
}
