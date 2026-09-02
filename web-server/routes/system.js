const { requireString, requireAbsolutePath } = require('../src/validation')

function registerSystemRoutes(router) {
  router.post('/api/updates', async (req, res, services) => {
    const body = await router.parseJsonBody(req)
    if (body.action === 'check') {
      return router.sendJson(res, 200, {
        update: await services.updates.check(),
      })
    }
    if (body.action === 'download') {
      return router.sendJson(res, 200, {
        operation: await services.updates.startDownload(),
      })
    }
    if (body.action === 'open') {
      return router.sendJson(res, 200, {
        operation: await services.updates.openDownloaded(
          requireString(body.operationId, 'update operation ID'),
          body.confirmed === true
        ),
      })
    }
    return router.sendJson(res, 400, { error: 'Unsupported update action' })
  })

  router.get('/api/integrations', async (req, res, services) => {
    return router.sendJson(res, 200, await services.discoverIntegrations())
  })

  router.post('/api/integrations/launch', async (req, res, services) => {
    const body = await router.parseJsonBody(req)
    await services.launchIntegration({
      kind: body.kind === 'shell' ? 'shell' : 'editor',
      target: requireAbsolutePath(body.target, 'target'),
      name: typeof body.name === 'string' ? body.name : null,
      custom:
        body.custom && typeof body.custom === 'object'
          ? {
              path: requireAbsolutePath(
                body.custom.path,
                'custom integration path'
              ),
              arguments:
                typeof body.custom.arguments === 'string' ||
                Array.isArray(body.custom.arguments)
                  ? body.custom.arguments
                  : '%TARGET_PATH%',
            }
          : null,
    })
    return router.sendJson(res, 200, { ok: true })
  })
}

module.exports = {
  registerSystemRoutes,
}
