const fs = require('fs')
const {
  requireAbsolutePath,
  requireString,
  requireInteger,
  requireBoolean,
} = require('../src/validation')

function registerFsRoutes(router, options) {
  const { MAX_RESPONSE_BYTES, MAX_REQUEST_BYTES } = options

  router.post('/api/fs/read-file', async (req, res) => {
    const body = await router.parseJsonBody(req)
    const filePath = requireAbsolutePath(body.path)
    if (body.encoding !== undefined && body.encoding !== 'utf8') {
      return router.sendJson(res, 400, {
        error: 'Only utf8 encoding is supported',
      })
    }
    let stats
    let data
    try {
      stats = await fs.promises.stat(filePath)
      data = await fs.promises.readFile(
        filePath,
        body.encoding ? { encoding: body.encoding } : undefined
      )
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw Object.assign(new Error('File not found'), { statusCode: 404 })
      }
      throw error
    }
    if (stats.size > MAX_RESPONSE_BYTES) {
      throw Object.assign(new Error('File is too large'), { statusCode: 413 })
    }
    return router.sendJson(
      res,
      200,
      body.encoding
        ? { content: data }
        : { content: data.toString('base64'), isBase64: true }
    )
  })

  router.post('/api/fs/read-dir', async (req, res) => {
    const body = await router.parseJsonBody(req)
    const entries = await fs.promises.readdir(requireAbsolutePath(body.path), {
      withFileTypes: true,
    })
    return router.sendJson(res, 200, {
      entries: entries.map(entry => ({
        name: entry.name,
        isDirectory: entry.isDirectory(),
        isFile: entry.isFile(),
        isSymbolicLink: entry.isSymbolicLink(),
      })),
    })
  })

  router.post('/api/fs/stat', async (req, res) => {
    const body = await router.parseJsonBody(req)
    const stats = await fs.promises.stat(requireAbsolutePath(body.path))
    return router.sendJson(res, 200, {
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
      size: stats.size,
      mtimeMs: stats.mtimeMs,
      birthtimeMs: stats.birthtimeMs,
    })
  })

  router.post('/api/fs/write-file', async (req, res) => {
    const body = await router.parseJsonBody(req)
    const content =
      body.content === undefined
        ? ''
        : requireString(body.content, 'content', MAX_REQUEST_BYTES)
    if (
      body.encoding !== undefined &&
      body.encoding !== 'utf8' &&
      body.isBase64 !== true
    ) {
      return router.sendJson(res, 400, {
        error: 'Only utf8 encoding is supported',
      })
    }
    await fs.promises.writeFile(
      requireAbsolutePath(body.path),
      body.isBase64 ? Buffer.from(content, 'base64') : content,
      body.isBase64 ? undefined : body.encoding || 'utf8'
    )
    return router.sendJson(res, 200, { ok: true })
  })

  router.post('/api/fs/mkdir', async (req, res) => {
    const body = await router.parseJsonBody(req)
    await fs.promises.mkdir(requireAbsolutePath(body.path), {
      recursive: body.recursive === true,
    })
    return router.sendJson(res, 200, { ok: true })
  })

  router.post('/api/fs/unlink', async (req, res) => {
    const body = await router.parseJsonBody(req)
    await fs.promises.unlink(requireAbsolutePath(body.path))
    return router.sendJson(res, 200, { ok: true })
  })

  router.post('/api/fs/copy-file', async (req, res) => {
    const body = await router.parseJsonBody(req)
    await fs.promises.copyFile(
      requireAbsolutePath(body.from, 'from'),
      requireAbsolutePath(body.to, 'to')
    )
    return router.sendJson(res, 200, { ok: true })
  })
}

module.exports = {
  registerFsRoutes,
}
