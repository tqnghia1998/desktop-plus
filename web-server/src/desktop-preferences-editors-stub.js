const { request } = require('./desktop-preferences-runtime')

async function getAvailableEditors() {
  const integrations = await request('/api/integrations')
  return (integrations.editors || []).map(editor => ({
    editor: editor.name,
    path: editor.path,
  }))
}

module.exports = { getAvailableEditors }
