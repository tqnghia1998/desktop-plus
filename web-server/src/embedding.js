/**
 * Opt-in iframe embedding for trusted host applications.
 *
 * The companion denies framing by default (X-Frame-Options: DENY plus
 * frame-ancestors 'none'). A trusted host shell can set
 * DESKTOP_PLUS_FRAME_ANCESTORS to a comma-separated origin list, which drops
 * X-Frame-Options and scopes frame-ancestors to exactly those origins.
 */

function resolveFrameAncestors(env = process.env) {
  const raw = String(env.DESKTOP_PLUS_FRAME_ANCESTORS || '').trim()
  if (!raw) return null
  const origins = raw
    .split(',')
    .map(origin => origin.trim())
    .filter(origin => origin && !/[\s"';,]/.test(origin))
  return origins.length > 0 ? origins : null
}

function applyEmbedding(headers = {}, env = process.env) {
  const ancestors = resolveFrameAncestors(env)
  if (!ancestors) return headers
  const { 'X-Frame-Options': _frameOptions, ...rest } = headers
  const contentSecurityPolicy = rest['Content-Security-Policy']
  if (typeof contentSecurityPolicy === 'string') {
    rest['Content-Security-Policy'] = contentSecurityPolicy.replace(
      /frame-ancestors[^;]*/,
      `frame-ancestors ${ancestors.join(' ')}`
    )
  }
  return rest
}

module.exports = { resolveFrameAncestors, applyEmbedding }
