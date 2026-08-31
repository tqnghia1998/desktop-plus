;(function initializeWebEnvironment() {
  var build = __WEB_BUILD_INFO__
  var runtimeElement = document.getElementById('desktop-plus-runtime')
  var runtime = runtimeElement
    ? JSON.parse(runtimeElement.textContent || '{}')
    : {}
  var platform = runtime.platform || 'web'

  var __OAUTH_CLIENT_ID__ = '3a723b10ac5575cc5bb9'
  var __OAUTH_SECRET__ = ''
  var __OAUTH_CLIENT_ID_BITBUCKET__ = 'Cu6ZDZgjKEAMEj45cg'
  var __OAUTH_SECRET_BITBUCKET__ = ''
  var __OAUTH_CLIENT_ID_GITLAB__ =
    'a6b3b9c8fb8a782d3a0284ac80378912e44272c4a41465b5b9f5a14a79d5526a'
  var __OAUTH_SECRET_GITLAB__ = ''
  var __OAUTH_CLIENT_ID_CODEBERG__ = 'eec16d05-93bd-43ec-8e29-a7e5dc677c78'
  var __OAUTH_SECRET_CODEBERG__ = ''
  var __OAUTH_CLIENT_ID_GITEA__ = '654533c4-cf62-494e-b391-b90edb22773f'
  var __OAUTH_SECRET_GITEA__ = ''
  var __DARWIN__ = platform === 'darwin'
  var __WIN32__ = platform === 'win32'
  var __LINUX__ = platform === 'linux'
  var __FLATPAK__ = false
  var __APP_NAME__ = 'Desktop Plus Web'
  var __APP_VERSION__ = build.version
  var __DEV__ = build.channel === 'development'
  var __DEV_SECRETS__ = false
  var __RELEASE_CHANNEL__ = build.channel
  var __UPDATES_URL__ = ''
  var __ERROR_REPORTING_ENDPOINT__ = ''
  var __NON_FATAL_ERROR_REPORTING_ENDPOINT__ = ''
  var __SHA__ = build.sha
  var __PROCESS_KIND__ = 'ui'

  Object.assign(window, {
    __OAUTH_CLIENT_ID__,
    __OAUTH_SECRET__,
    __OAUTH_CLIENT_ID_BITBUCKET__,
    __OAUTH_SECRET_BITBUCKET__,
    __OAUTH_CLIENT_ID_GITLAB__,
    __OAUTH_SECRET_GITLAB__,
    __OAUTH_CLIENT_ID_CODEBERG__,
    __OAUTH_SECRET_CODEBERG__,
    __OAUTH_CLIENT_ID_GITEA__,
    __OAUTH_SECRET_GITEA__,
    __DARWIN__,
    __WIN32__,
    __LINUX__,
    __FLATPAK__,
    __APP_NAME__,
    __APP_VERSION__,
    __DEV__,
    __DEV_SECRETS__,
    __RELEASE_CHANNEL__,
    __UPDATES_URL__,
    __ERROR_REPORTING_ENDPOINT__,
    __NON_FATAL_ERROR_REPORTING_ENDPOINT__,
    __SHA__,
    __PROCESS_KIND__,
    __DESKTOP_PLUS_BUILD__: Object.freeze(build),
    __DESKTOP_PLUS_RUNTIME__: Object.freeze(runtime),
    global: window,
  })

  window.log = {
    error: (...args) => console.error('[Desktop Plus]', ...args),
    warn: (...args) => console.warn('[Desktop Plus]', ...args),
    info: (...args) => console.info('[Desktop Plus]', ...args),
    debug: (...args) => console.debug('[Desktop Plus]', ...args),
  }

  var __dirname = '/'
  var __filename = '/index.html'
  window.__dirname = __dirname
  window.__filename = __filename
  window.module = window.module || { exports: {} }
  window.exports = window.exports || {}

  window.process = window.process || {}
  window.process.browser = true
  window.process.version = 'v20.0.0'
  window.process.versions = { node: '20.0.0' }
  window.process.platform = platform
  window.process.env = { NODE_ENV: __DEV__ ? 'development' : 'production' }
  window.process.cwd = () => runtime.paths?.cwd || '/'
  window.process.nextTick = (fn, ...args) => setTimeout(() => fn(...args), 0)
  window.setImmediate =
    window.setImmediate || ((fn, ...args) => setTimeout(fn, 0, ...args))
  window.clearImmediate = window.clearImmediate || clearTimeout

  window.Buffer = window.Buffer || {
    isBuffer: obj => obj instanceof Uint8Array,
    from: data => {
      if (typeof data === 'string') return new TextEncoder().encode(data)
      return new Uint8Array(data)
    },
    alloc: size => new Uint8Array(size),
    concat: (chunks, length) => {
      const size =
        length ?? chunks.reduce((total, chunk) => total + chunk.length, 0)
      const result = new Uint8Array(size)
      let offset = 0
      for (const chunk of chunks) {
        result.set(chunk, offset)
        offset += chunk.length
      }
      return result
    },
    byteLength: value => new TextEncoder().encode(value).length,
  }

  const originalFetch = window.fetch.bind(window)
  window.fetch = (input, init = {}) => {
    const requestUrl = new URL(
      typeof input === 'string' ? input : input.url,
      location.href
    )
    if (
      requestUrl.origin === location.origin &&
      requestUrl.pathname.startsWith('/api/')
    ) {
      const headers = new Headers(
        init.headers || (input instanceof Request ? input.headers : undefined)
      )
      headers.set('X-Desktop-Plus-Session', runtime.session || '')
      init = { ...init, headers }
    }
    if (
      requestUrl.hostname === 'central.github.com' &&
      requestUrl.pathname.endsWith('/desktop/changelog.json')
    ) {
      return Promise.resolve(
        new Response('[]', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    }
    return originalFetch(input, init)
  }
})()
