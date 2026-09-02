const {
  requireString,
  requireBoolean,
  requireInteger,
} = require('../src/validation')

function registerHostingRoutes(router, options) {
  const {
    normalizeGitLabEndpoint,
    gitLabCredentialId,
    requireGitLabCredential,
    gitLabCredentialService,
    githubCredentialService,
    sendJson,
    parseJsonBody,
  } = options

  router.post('/api/gitlab/auth', async (req, res, services) => {
    const body = await parseJsonBody(req)
    const endpoint = normalizeGitLabEndpoint(
      requireString(body.endpoint, 'endpoint')
    )
    const token = requireString(body.token, 'token')
    const user = await services.gitLabRequest(endpoint, token, 'GET', 'user')
    const username = requireString(user.username, 'GitLab username')
    if (!services.keytar)
      return sendJson(res, 501, { error: 'OS credential store is unavailable' })
    const credentialId = gitLabCredentialId(endpoint, username)
    await services.keytar.setPassword(
      gitLabCredentialService,
      credentialId,
      token
    )
    return sendJson(res, 200, {
      credentialId,
      user: {
        login: username,
        name: user.name || username,
        endpoint,
        provider: 'gitlab',
      },
    })
  })

  router.post('/api/gitlab/projects', async (req, res, services) => {
    const body = await parseJsonBody(req)
    if (!services.keytar)
      return sendJson(res, 501, { error: 'OS credential store is unavailable' })
    const { credentialId, endpoint } = requireGitLabCredential(body)
    const token = await services.keytar.getPassword(
      gitLabCredentialService,
      credentialId
    )
    if (!token)
      return sendJson(res, 401, {
        error: 'Missing GitLab token for credential',
      })
    const query = new URLSearchParams()
    query.set('membership', 'true')
    query.set('simple', 'true')
    query.set('per_page', '100')
    if (body.search) {
      query.set('search', requireString(body.search, 'search'))
    }
    const projects = await services.gitLabRequest(
      endpoint,
      token,
      'GET',
      `projects?${query.toString()}`
    )
    return sendJson(
      res,
      200,
      (Array.isArray(projects) ? projects : []).map(p => ({
        id: p.id,
        name: p.name,
        name_with_namespace: p.name_with_namespace,
        path_with_namespace: p.path_with_namespace,
        http_url_to_repo: p.http_url_to_repo,
        ssh_url_to_repo: p.ssh_url_to_repo,
        default_branch: p.default_branch,
      }))
    )
  })

  router.post('/api/gitlab/logout', async (req, res, services) => {
    const body = await parseJsonBody(req)
    const { credentialId } = requireGitLabCredential(body)
    if (!services.keytar)
      return sendJson(res, 501, { error: 'OS credential store is unavailable' })
    return sendJson(res, 200, {
      deleted: await services.keytar.deletePassword(
        gitLabCredentialService,
        credentialId
      ),
    })
  })
}

module.exports = {
  registerHostingRoutes,
}
