const assert = require('assert/strict')
const childProcess = require('child_process')
const crypto = require('crypto')
const fs = require('fs')
const http = require('http')
const path = require('path')
const { createServer } = require('./server')

const root = path.join(__dirname, '..')
const sourceFiles = [
  'app/src/ui/web-index.tsx',
  'app/src/ui/web-app.tsx',
  'app/src/ui/web-emoji.ts',
  'app/src/ui/web/contracts.ts',
  'app/src/ui/web/client.ts',
  'app/src/ui/web/platform.ts',
  'app/src/ui/web/store.ts',
]

function digestGeneratedBuild() {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'public/build-manifest.json'), 'utf8')
  )
  const files = [
    'index.html',
    'build-manifest.json',
    `assets/${manifest.assets.bootstrap}`,
    `assets/${manifest.assets.application}`,
    `assets/${manifest.assets.stylesheet}`,
    manifest.assets.highlighter.entry,
    ...manifest.assets.highlighter.chunks.map(file => file),
  ]
  const hash = crypto.createHash('sha256')
  for (const file of files) {
    hash.update(file)
    hash.update(fs.readFileSync(path.join(__dirname, 'public', file)))
  }
  return { digest: hash.digest('hex'), manifest }
}

function request(port, requestPath) {
  return new Promise((resolve, reject) => {
    const request = http.get(
      { hostname: '127.0.0.1', port, path: requestPath },
      response => {
        response.resume()
        response.on('end', () =>
          resolve({
            statusCode: response.statusCode,
            contentType: response.headers['content-type'],
          })
        )
      }
    )
    request.on('error', reject)
  })
}

function runBuild() {
  return new Promise((resolve, reject) => {
    const child = childProcess.spawn(
      process.execPath,
      ['web-server/build.js'],
      {
        cwd: root,
        stdio: 'inherit',
      }
    )
    child.on('error', reject)
    child.on('exit', code => {
      if (code === 0) resolve()
      else reject(new Error(`Web build exited with code ${code}`))
    })
  })
}

async function assertLiveBuildRemainsAvailable(port, build) {
  let complete = false
  let failure
  build.then(
    () => {
      complete = true
    },
    error => {
      complete = true
      failure = error
    }
  )

  do {
    const html = await new Promise((resolve, reject) => {
      http
        .get({ hostname: '127.0.0.1', port, path: '/' }, response => {
          let body = ''
          response.setEncoding('utf8')
          response.on('data', chunk => {
            body += chunk
          })
          response.on('end', () => {
            if (response.statusCode !== 200)
              reject(new Error(`Index returned ${response.statusCode}`))
            else resolve(body)
          })
        })
        .on('error', reject)
    })
    const assetPaths = [...html.matchAll(/(?:src|href)="(\/[^"]+)"/g)].map(
      match => match[1]
    )
    assert.ok(assetPaths.length >= 3, 'Index did not reference runtime assets')
    for (const assetPath of assetPaths) {
      const response = await request(port, assetPath)
      assert.equal(
        response.statusCode,
        200,
        `${assetPath} became unavailable during a live build`
      )
    }
    if (!complete) await new Promise(resolve => setTimeout(resolve, 25))
  } while (!complete)

  if (failure) throw failure
}

async function main() {
  for (const file of sourceFiles)
    assert.ok(
      fs.existsSync(path.join(root, file)),
      `Missing web source: ${file}`
    )

  childProcess.execFileSync(process.execPath, ['web-server/build.js'], {
    cwd: root,
    stdio: 'inherit',
  })
  const firstBuild = digestGeneratedBuild()
  const server = createServer({ getDesktopRepositories: async () => [] })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  try {
    await assertLiveBuildRemainsAvailable(server.address().port, runBuild())
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
  const secondBuild = digestGeneratedBuild()

  assert.equal(secondBuild.digest, firstBuild.digest)
  assert.equal(
    secondBuild.manifest.version,
    require('../app/package.json').version
  )
  assert.equal(secondBuild.manifest.platform, 'web')
  assert.equal(secondBuild.manifest.renderer.entry, 'app/src/ui/web-index.tsx')
  assert.deepEqual(secondBuild.manifest.renderer.source, sourceFiles)
  assert.equal(Object.hasOwn(secondBuild.manifest, 'snapshot'), false)
  assert.equal(secondBuild.manifest.assets.highlighter.entry, 'highlighter.js')
  assert.ok(secondBuild.manifest.assets.highlighter.chunks.length > 0)

  const application = fs.readFileSync(
    path.join(
      __dirname,
      'public/assets',
      secondBuild.manifest.assets.application
    ),
    'utf8'
  )
  assert.doesNotMatch(
    application,
    /desktop-app\.template\.js|sourceCommit|__desktopPlusDispatcherContract/
  )
  assert.match(application, /__DESKTOP_PLUS_SOURCE_RENDERER__/)

  console.log(
    `Web source build passed: ${
      sourceFiles.length
    } modules, reproducible ${secondBuild.digest.slice(
      0,
      12
    )}, live rebuild assets remained available`
  )
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
