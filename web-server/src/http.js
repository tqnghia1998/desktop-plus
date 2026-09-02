const path = require('path')
const fs = require('fs')
const os = require('os')

function securityHeaders(headers = {}) {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy':
      "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; script-src 'self'; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    ...headers,
  }
}

function sendJson(res, statusCode, data) {
  const structuredData =
    data && typeof data === 'object'
      ? Array.isArray(data)
        ? data
        : { ...data }
      : data
  const body = JSON.stringify(structuredData)
  res.writeHead(
    statusCode,
    securityHeaders({
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Length': Buffer.byteLength(body),
    })
  )
  res.end(body)
}

function parseLoopbackHost(hostHeader) {
  if (!hostHeader || typeof hostHeader !== 'string') return null
  const match = hostHeader.trim().match(/^([^:]+)(?::(\d+))?$/)
  if (!match) return null
  const [, hostname, portString] = match
  const allowedHostnames = new Set(['127.0.0.1', 'localhost'])
  if (!allowedHostnames.has(hostname.toLowerCase())) return null
  if (!portString) return { host: hostname }
  const port = Number.parseInt(portString, 10)
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null
  return { host: `${hostname}:${port}`, port }
}

function parseJsonBody(req, limit = 10 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let raw = ''
    let length = 0
    req.on('data', chunk => {
      length += chunk.length
      if (length > limit) {
        reject(
          Object.assign(new Error('Request body too large'), {
            statusCode: 413,
          })
        )
        return
      }
      raw += chunk.toString('utf8')
    })
    req.on('end', () => {
      if (!raw) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(raw))
      } catch (error) {
        reject(
          Object.assign(new Error('Malformed JSON payload'), {
            statusCode: 400,
          })
        )
      }
    })
    req.on('error', reject)
  })
}

class Router {
  constructor() {
    this.routes = {
      GET: new Map(),
      POST: new Map(),
      DELETE: new Map(),
      PUT: new Map(),
    }
  }

  get(pathname, handler) {
    this.routes.GET.set(pathname, handler)
  }

  sendJson(res, statusCode, data) {
    return sendJson(res, statusCode, data)
  }

  parseJsonBody(req) {
    return parseJsonBody(req)
  }

  post(pathname, handler) {
    this.routes.POST.set(pathname, handler)
  }

  delete(pathname, handler) {
    this.routes.DELETE.set(pathname, handler)
  }

  put(pathname, handler) {
    this.routes.PUT.set(pathname, handler)
  }

  async dispatch(req, res, services, url) {
    return this.handle(req, res, url, services)
  }

  async handle(req, res, url, services) {
    const methodMap = this.routes[req.method]
    if (!methodMap) return false
    const handler = methodMap.get(url.pathname)
    if (!handler) return false
    await handler(req, res, services, url)
    return true
  }
}

module.exports = {
  securityHeaders,
  sendJson,
  parseLoopbackHost,
  parseJsonBody,
  Router,
}
