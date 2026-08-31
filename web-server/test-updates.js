const assert = require('assert/strict')
const crypto = require('crypto')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { createUpdateManager } = require('./updates')

async function waitForOperation(manager, id) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const operation = manager.getOperation(id)
    if (operation.status !== 'downloading') return operation
    await new Promise(resolve => setTimeout(resolve, 5))
  }
  throw new Error('Timed out waiting for update download')
}

async function main() {
  const cacheDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'desktop-plus-updates-')
  )
  const artifact = Buffer.from('verified update artifact')
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519')
  const payload = JSON.stringify({
    version: '2.0.0',
    channel: 'production',
    url: 'https://updates.example/desktop-plus-2.0.0.pkg',
    sha256: crypto.createHash('sha256').update(artifact).digest('hex'),
    size: artifact.length,
    releaseNotes: 'Signed update notes',
  })
  const manifest = {
    signed: payload,
    signature: crypto
      .sign(null, Buffer.from(payload), privateKey)
      .toString('base64'),
  }
  const opened = []
  const manager = createUpdateManager({
    currentVersion: '1.0.0',
    channel: 'production',
    platform: 'darwin',
    manifestURL: 'https://updates.example/manifest.json',
    publicKey: publicKey.export({ type: 'spki', format: 'pem' }),
    cacheDirectory,
    openArtifact: async artifactPath => opened.push(artifactPath),
    fetch: async url => {
      if (String(url).endsWith('/manifest.json'))
        return new Response(JSON.stringify(manifest), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      return new Response(artifact, {
        status: 200,
        headers: { 'Content-Length': String(artifact.length) },
      })
    },
  })
  const manual = createUpdateManager({ currentVersion: '1.0.0' })

  try {
    assert.equal((await manual.check()).status, 'manual')
    const available = await manager.check()
    assert.deepEqual(available, {
      status: 'available',
      currentVersion: '1.0.0',
      platform: 'darwin',
      availableVersion: '2.0.0',
      releaseNotes: 'Signed update notes',
      message: 'Version 2.0.0 is ready to download.',
    })
    const started = await manager.startDownload()
    assert.equal(started.status, 'downloading')
    const downloaded = await waitForOperation(manager, started.id)
    assert.equal(downloaded.status, 'downloaded')
    assert.equal(downloaded.downloadedBytes, artifact.length)
    await assert.rejects(
      manager.openDownloaded(started.id, false),
      error => error.code === 'confirmation-required'
    )
    const openedOperation = await manager.openDownloaded(started.id, true)
    assert.equal(openedOperation.status, 'opened')
    assert.equal(opened.length, 1)
    assert.deepEqual(await fs.promises.readFile(opened[0]), artifact)

    const cancelledManager = createUpdateManager({
      currentVersion: '1.0.0',
      channel: 'production',
      platform: 'darwin',
      manifestURL: 'https://updates.example/manifest.json',
      publicKey: publicKey.export({ type: 'spki', format: 'pem' }),
      fetch: async (url, options = {}) => {
        if (String(url).endsWith('/manifest.json'))
          return new Response(JSON.stringify(manifest), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        return new Promise((resolve, reject) => {
          if (options.signal.aborted) {
            reject(new DOMException('Aborted', 'AbortError'))
            return
          }
          options.signal.addEventListener(
            'abort',
            () => reject(new DOMException('Aborted', 'AbortError')),
            { once: true }
          )
        })
      },
    })
    await cancelledManager.check()
    const cancelled = await cancelledManager.startDownload()
    assert.equal(cancelledManager.cancel(cancelled.id).status, 'cancelled')
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(
      cancelledManager.getOperation(cancelled.id).status,
      'cancelled'
    )
    cancelledManager.cancelAll()

    const invalidManager = createUpdateManager({
      currentVersion: '1.0.0',
      manifestURL: 'https://updates.example/manifest.json',
      publicKey: publicKey.export({ type: 'spki', format: 'pem' }),
      fetch: async () =>
        new Response(
          JSON.stringify({
            ...manifest,
            signature: Buffer.alloc(64).toString('base64'),
          }),
          { status: 200 }
        ),
    })
    await assert.rejects(
      invalidManager.check(),
      error => error.code === 'update-verification-failed'
    )
    console.log(
      'Update contract passed: signed metadata, verified download, confirmation, and manual fallback'
    )
  } finally {
    manager.cancelAll()
    fs.rmSync(cacheDirectory, { recursive: true, force: true })
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
