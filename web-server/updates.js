const crypto = require('crypto')
const fs = require('fs')
const os = require('os')
const path = require('path')
const semver = require('semver')
const MAX_UPDATE_BYTES = 4 * 1024 * 1024 * 1024

function supportedArtifactExtensions(platform) {
  if (platform === 'darwin') return ['.dmg', '.pkg']
  if (platform === 'win32') return ['.exe', '.msi']
  return ['.appimage', '.deb', '.rpm', '.tar.gz']
}

function normalizeUpdateURL(value, name) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw Object.assign(new Error(`${name} must be a valid URL`), {
      code: 'update-verification-failed',
      statusCode: 400,
    })
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.hash
  )
    throw Object.assign(
      new Error(
        `${name} must be an HTTP(S) URL without credentials or fragment`
      ),
      { code: 'update-verification-failed', statusCode: 400 }
    )
  if (
    url.protocol === 'http:' &&
    !['127.0.0.1', '::1', 'localhost'].includes(url.hostname)
  )
    throw Object.assign(
      new Error(`${name} must use HTTPS unless it is a loopback URL`),
      { code: 'update-verification-failed', statusCode: 400 }
    )
  return url
}

function updateError(message, code, statusCode = 400) {
  return Object.assign(new Error(message), { code, statusCode })
}

function validateManifest(manifest, publicKey, channel, platform) {
  if (
    !manifest ||
    typeof manifest !== 'object' ||
    typeof manifest.signed !== 'string' ||
    typeof manifest.signature !== 'string'
  )
    throw updateError(
      'Update metadata is missing a signed payload',
      'update-verification-failed'
    )
  const signature = Buffer.from(manifest.signature, 'base64')
  let verified = false
  try {
    verified =
      signature.length > 0 &&
      crypto.verify(null, Buffer.from(manifest.signed), publicKey, signature)
  } catch {
    verified = false
  }
  if (!verified)
    throw updateError(
      'Update metadata signature could not be verified',
      'update-verification-failed'
    )
  let payload
  try {
    payload = JSON.parse(manifest.signed)
  } catch {
    throw updateError(
      'Update metadata contains an invalid signed payload',
      'update-verification-failed'
    )
  }
  if (
    !payload ||
    typeof payload !== 'object' ||
    !semver.valid(payload.version) ||
    typeof payload.url !== 'string' ||
    typeof payload.sha256 !== 'string' ||
    !/^[a-f0-9]{64}$/i.test(payload.sha256) ||
    !Number.isSafeInteger(payload.size) ||
    payload.size < 1 ||
    payload.size > MAX_UPDATE_BYTES
  )
    throw updateError(
      'Update metadata has invalid artifact details',
      'update-verification-failed'
    )
  if (payload.channel && payload.channel !== channel)
    throw updateError(
      `Update metadata is for the ${payload.channel} channel, not ${channel}`,
      'update-verification-failed'
    )
  const artifactURL = normalizeUpdateURL(payload.url, 'Update artifact URL')
  const artifactName = path.basename(artifactURL.pathname)
  if (!artifactName || artifactName === '.' || artifactName === '/')
    throw updateError(
      'Update artifact URL must include a file name',
      'update-verification-failed'
    )
  const lowerName = artifactName.toLowerCase()
  if (
    !supportedArtifactExtensions(platform).some(extension =>
      lowerName.endsWith(extension)
    )
  )
    throw updateError(
      `Update artifact must use a supported ${platform} installer format`,
      'update-verification-failed'
    )
  return {
    version: payload.version,
    url: artifactURL.toString(),
    sha256: payload.sha256.toLowerCase(),
    size: payload.size,
    releaseNotes:
      typeof payload.releaseNotes === 'string' ? payload.releaseNotes : '',
    artifactName,
  }
}

function publicStatus(operation) {
  return {
    id: operation.id,
    status: operation.status,
    downloadedBytes: operation.downloadedBytes,
    totalBytes: operation.totalBytes,
    artifactName: operation.artifactName,
    error: operation.error || null,
  }
}

function waitForDrain(stream) {
  return new Promise((resolve, reject) => {
    stream.once('drain', resolve)
    stream.once('error', reject)
  })
}

function finishStream(stream) {
  return new Promise((resolve, reject) => {
    stream.once('finish', resolve)
    stream.once('error', reject)
    stream.end()
  })
}

function createUpdateManager(options = {}) {
  const currentVersion = options.currentVersion || '0.0.0'
  const platform = options.platform || process.platform
  const channel = options.channel || process.env.RELEASE_CHANNEL || 'production'
  const manifestURL =
    options.manifestURL || process.env.DESKTOP_PLUS_UPDATE_MANIFEST_URL || ''
  const publicKey =
    options.publicKey ||
    String(process.env.DESKTOP_PLUS_UPDATE_PUBLIC_KEY || '').replace(
      /\\n/g,
      '\n'
    )
  const fetchImpl = options.fetch || fetch
  const cacheDirectory =
    options.cacheDirectory || path.join(os.tmpdir(), 'desktop-plus-web-updates')
  const openArtifact = options.openArtifact
  const operations = new Map()
  let available = null

  // Fixed TTL eviction (not last-seen/LRU); fine for the handful of update
  // operations a companion process handles.
  const OPERATION_RETENTION_MS = 30 * 60 * 1000
  const scheduleEviction = id => {
    const timer = setTimeout(
      () => operations.delete(id),
      OPERATION_RETENTION_MS
    )
    timer.unref?.()
  }

  const configured = () => Boolean(manifestURL && publicKey)

  async function check() {
    if (!configured())
      return {
        status: 'manual',
        currentVersion,
        platform,
        availableVersion: null,
        releaseNotes: '',
        message:
          'Automatic updates are not configured for this companion. Install a signed update from the release channel manually.',
      }
    let response
    try {
      response = await fetchImpl(
        normalizeUpdateURL(manifestURL, 'Update manifest URL'),
        {
          signal: AbortSignal.timeout(30_000),
          redirect: 'error',
          headers: {
            Accept: 'application/json',
            'User-Agent': 'Desktop-Plus-Web',
          },
        }
      )
    } catch (error) {
      throw updateError(
        error instanceof Error
          ? error.message
          : 'Unable to load update metadata',
        'update-unavailable',
        502
      )
    }
    if (!response.ok)
      throw updateError(
        `Update metadata request failed with ${response.status}`,
        'update-unavailable',
        502
      )
    let manifest
    try {
      manifest = await response.json()
    } catch {
      throw updateError(
        'Update metadata is not valid JSON',
        'update-verification-failed'
      )
    }
    const update = validateManifest(manifest, publicKey, channel, platform)
    if (!semver.gt(update.version, currentVersion)) {
      available = null
      return {
        status: 'up-to-date',
        currentVersion,
        platform,
        availableVersion: null,
        releaseNotes: '',
        message: 'This companion is up to date.',
      }
    }
    available = update
    return {
      status: 'available',
      currentVersion,
      platform,
      availableVersion: update.version,
      releaseNotes: update.releaseNotes,
      message: `Version ${update.version} is ready to download.`,
    }
  }

  async function download(operation) {
    const controller = operation.controller
    const update = operation.update
    const tempPath = path.join(cacheDirectory, `${operation.id}.part`)
    const finalPath = path.join(
      cacheDirectory,
      `${update.version}-${update.artifactName}`
    )
    try {
      await fs.promises.mkdir(cacheDirectory, { recursive: true, mode: 0o700 })
      await fs.promises.rm(tempPath, { force: true })
      const response = await fetchImpl(update.url, {
        signal: controller.signal,
        redirect: 'error',
        headers: {
          Accept: 'application/octet-stream',
          'User-Agent': 'Desktop-Plus-Web',
        },
      })
      if (!response.ok || !response.body)
        throw updateError(
          `Update download failed with ${response.status}`,
          'update-download-failed',
          502
        )
      const reportedSize = Number(response.headers.get('content-length'))
      if (Number.isFinite(reportedSize) && reportedSize !== update.size)
        throw updateError(
          'Downloaded update size does not match signed metadata',
          'update-verification-failed'
        )
      const stream = fs.createWriteStream(tempPath, { mode: 0o600 })
      const hash = crypto.createHash('sha256')
      const reader = response.body.getReader()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        hash.update(value)
        operation.downloadedBytes += value.byteLength
        if (!stream.write(Buffer.from(value))) await waitForDrain(stream)
      }
      await finishStream(stream)
      if (operation.downloadedBytes !== update.size)
        throw updateError(
          'Downloaded update size does not match signed metadata',
          'update-verification-failed'
        )
      if (hash.digest('hex') !== update.sha256)
        throw updateError(
          'Downloaded update checksum does not match signed metadata',
          'update-verification-failed'
        )
      await fs.promises.rm(finalPath, { force: true })
      await fs.promises.rename(tempPath, finalPath)
      operation.status = 'downloaded'
      operation.path = finalPath
    } catch (error) {
      await fs.promises.rm(tempPath, { force: true }).catch(() => {})
      if (controller.signal.aborted) operation.status = 'cancelled'
      else {
        operation.status = 'failed'
        operation.error = error instanceof Error ? error.message : String(error)
      }
    } finally {
      operation.controller = null
      scheduleEviction(operation.id)
    }
  }

  async function startDownload() {
    if (!available) {
      const checked = await check()
      if (checked.status !== 'available')
        throw updateError(
          checked.message || 'No update is available to download',
          'update-unavailable'
        )
    }
    const operation = {
      id: crypto.randomUUID(),
      status: 'downloading',
      downloadedBytes: 0,
      totalBytes: available.size,
      artifactName: available.artifactName,
      error: null,
      path: null,
      update: available,
      controller: new AbortController(),
    }
    operations.set(operation.id, operation)
    void download(operation)
    return publicStatus(operation)
  }

  function getOperation(id) {
    const operation = operations.get(id)
    if (!operation)
      throw updateError('Update operation was not found', 'resource-not-found')
    return publicStatus(operation)
  }

  function cancel(id) {
    const operation = operations.get(id)
    if (!operation)
      throw updateError('Update operation was not found', 'resource-not-found')
    if (operation.status === 'downloading') {
      operation.status = 'cancelled'
      operation.controller?.abort()
    }
    return publicStatus(operation)
  }

  async function openDownloaded(id, confirmed) {
    if (confirmed !== true)
      throw updateError(
        'Confirm opening the verified update artifact before continuing',
        'confirmation-required'
      )
    const operation = operations.get(id)
    if (!operation || operation.status !== 'downloaded' || !operation.path)
      throw updateError(
        'A verified downloaded update is required before opening it',
        'update-unavailable'
      )
    if (typeof openArtifact !== 'function')
      throw updateError(
        'This companion does not support opening downloaded update artifacts',
        'update-unavailable'
      )
    await openArtifact(operation.path, false)
    operation.status = 'opened'
    scheduleEviction(id)
    return publicStatus(operation)
  }

  function cancelAll() {
    for (const operation of operations.values())
      if (operation.status === 'downloading') operation.controller?.abort()
  }

  return {
    check,
    startDownload,
    getOperation,
    cancel,
    openDownloaded,
    cancelAll,
  }
}

module.exports = {
  createUpdateManager,
  normalizeUpdateURL,
  supportedArtifactExtensions,
  validateManifest,
}
