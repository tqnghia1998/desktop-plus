const { request } = require('./desktop-preferences-runtime')

const Shell = {
  Terminal: 'Terminal',
}

async function getAvailableShells() {
  const integrations = await request('/api/integrations')
  return (integrations.shells || []).map(shell => ({
    shell: shell.name,
    path: shell.path,
  }))
}

function parse(label) {
  return label || Shell.Terminal
}

module.exports = {
  Default: Shell.Terminal,
  Shell,
  getAvailableShells,
  parse,
}
