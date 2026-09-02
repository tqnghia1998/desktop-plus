const {
  requireString,
  requireAbsolutePath,
  requireText,
  requireBoolean,
} = require('../src/validation')

function registerRepositoryRoutes(router, options) {
  const {
    repositorySetupOptions,
    previewRepositoryInitialization,
    previewCloneRepository,
    createRepositoryFiles,
    requireRepositoryInspectionPath,
    inspectRepository,
    trustRepository,
    deleteRepositoryFromDisk,
    getWorktreeIndicators,
  } = options

  router.get('/api/repository-setup/options', async (req, res) => {
    return router.sendJson(res, 200, repositorySetupOptions())
  })

  router.post('/api/repository-setup/preview', async (req, res) => {
    const body = await router.parseJsonBody(req)
    return router.sendJson(
      res,
      200,
      await previewRepositoryInitialization(body)
    )
  })

  router.post('/api/repository-setup/clone-preview', async (req, res) => {
    const body = await router.parseJsonBody(req)
    return router.sendJson(res, 200, await previewCloneRepository(body))
  })

  router.post('/api/repository-setup/files', async (req, res) => {
    const body = await router.parseJsonBody(req)
    const repositoryPath = requireAbsolutePath(
      body.repositoryPath,
      'repository path'
    )
    const repositoryName = requireString(body.repositoryName, 'repository name')
    switch (body.action) {
      case 'readme':
        await createRepositoryFiles(repositoryPath, repositoryName, {
          createReadme: true,
          description: body.description,
        })
        break
      case 'gitignore':
        await createRepositoryFiles(repositoryPath, repositoryName, {
          gitignore: requireString(body.name, 'gitignore'),
        })
        break
      case 'license':
        await createRepositoryFiles(repositoryPath, repositoryName, {
          license: requireString(body.name, 'license'),
        })
        break
      case 'description':
        await createRepositoryFiles(repositoryPath, repositoryName, {
          description: requireText(body.description, 'description'),
        })
        break
      case 'attributes':
        await createRepositoryFiles(repositoryPath, repositoryName, {})
        break
      default:
        throw Object.assign(
          new Error('Unsupported repository setup file action'),
          { statusCode: 400 }
        )
    }
    return router.sendJson(res, 200, { ok: true })
  })

  router.post('/api/repository/inspect', async (req, res) => {
    const body = await router.parseJsonBody(req)
    const repositoryPath = requireRepositoryInspectionPath(body.path)
    return router.sendJson(res, 200, await inspectRepository(repositoryPath))
  })

  router.post('/api/repository/trust', async (req, res) => {
    const body = await router.parseJsonBody(req)
    const repositoryPath = requireAbsolutePath(body.path)
    return router.sendJson(res, 200, await trustRepository(repositoryPath))
  })

  router.post('/api/repository/delete', async (req, res, services) => {
    const body = await router.parseJsonBody(req)
    const repositoryPath = requireAbsolutePath(body.path)
    const mode = requireString(body.mode, 'deletion mode')
    const confirmed = body.confirmed === true
    return router.sendJson(
      res,
      200,
      await deleteRepositoryFromDisk(repositoryPath, mode, confirmed, services)
    )
  })

  router.get('/api/repository/indicators', async (req, res, services, url) => {
    const repositoryPath = requireAbsolutePath(
      url.searchParams.get('path'),
      'repository path'
    )
    return router.sendJson(
      res,
      200,
      await getWorktreeIndicators(repositoryPath)
    )
  })
}

module.exports = {
  registerRepositoryRoutes,
}
