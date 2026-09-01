const { request } = require('./desktop-preferences-runtime')

async function writeRepositoryFile(action, body) {
  await request('/api/repository-setup/files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...body }),
  })
}

async function getRepositorySetupOptions() {
  return request('/api/repository-setup/options')
}

async function getGitIgnoreNames() {
  const options = await getRepositorySetupOptions()
  return options.gitignoreNames || []
}

async function writeGitIgnore(repositoryPath, name) {
  await writeRepositoryFile('gitignore', { repositoryPath, name })
}

async function getLicenses() {
  const options = await getRepositorySetupOptions()
  return (options.licenses || []).map(license => ({
    ...license,
    body: '',
    hidden: false,
  }))
}

async function writeLicense(repositoryPath, license) {
  await writeRepositoryFile('license', {
    repositoryPath,
    name: license.name,
  })
}

async function writeDefaultReadme(repositoryPath, name, description) {
  await writeRepositoryFile('readme', {
    repositoryPath,
    name,
    description,
  })
}

async function writeGitAttributes(repositoryPath) {
  await writeRepositoryFile('attributes', { repositoryPath })
}

async function writeGitDescription(repositoryPath, description) {
  await writeRepositoryFile('description', {
    repositoryPath,
    description,
  })
}

module.exports = {
  getGitIgnoreNames,
  getLicenses,
  writeDefaultReadme,
  writeGitAttributes,
  writeGitDescription,
  writeGitIgnore,
  writeLicense,
}
