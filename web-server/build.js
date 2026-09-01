const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const frontMatter = require('front-matter')
const webpack = require('webpack')
const webpackConfig = require('./webpack.config')
const highlighterWebpackConfig = require('./highlighter-webpack.config')

const root = __dirname
const sourceDir = path.join(root, 'src')
const publicDir = path.join(root, 'public')
const assetsDir = path.join(publicDir, 'assets')
const desktopStaticDir = path.join(root, '..', 'app', 'static', 'common')
const staticDir = path.join(publicDir, 'static')
const runtimeStaticFiles = [
  'admin-mentoring.svg',
  'code.svg',
  'empty-no-branches.svg',
  'empty-no-commit.svg',
  'empty-no-file-selected.svg',
  'empty-no-pull-requests.svg',
  'empty-no-repo.svg',
  'ghd_dark.svg',
  'ghd_light.svg',
  'github-for-business.svg',
  'github-for-teams.svg',
  'logo.png',
  'markdown.css',
  'multiple-files-selected.svg',
  'paper-stack.svg',
  'release-note-header-left.svg',
  'release-note-header-right.svg',
  'required-status-check.svg',
  'ufo-alert.svg',
  'welcome-illustration-left-bottom.svg',
  'welcome-illustration-left-top.svg',
  'welcome-illustration-right.svg',
]
const gemojiSourceDir = path.join(root, '..', 'gemoji', 'images', 'emoji')

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function hash(content) {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 12)
}

function replaceOnce(source, marker, value) {
  const index = source.indexOf(marker)
  if (index < 0) throw new Error(`Missing build marker: ${marker}`)
  if (source.indexOf(marker, index + marker.length) >= 0)
    throw new Error(`Duplicate build marker: ${marker}`)
  return source.slice(0, index) + value + source.slice(index + marker.length)
}

function gitSha() {
  return process.env.BUILD_SHA || 'development'
}

function writeAsset(prefix, extension, content) {
  const fileName = `${prefix}-${hash(content)}.${extension}`
  fs.writeFileSync(path.join(assetsDir, fileName), content)
  return fileName
}

function writeFileAtomically(destination, content) {
  const temporary = `${destination}.${process.pid}.${crypto
    .randomBytes(6)
    .toString('hex')}.tmp`
  fs.writeFileSync(temporary, content)
  fs.renameSync(temporary, destination)
}

function generatedAssetNames(manifest) {
  if (!manifest?.assets) return []
  return [
    manifest.assets.bootstrap,
    manifest.assets.application,
    manifest.assets.stylesheet,
  ].filter(name => typeof name === 'string')
}

function removeObsoleteGeneratedAssets(currentAssets) {
  fs.mkdirSync(assetsDir, { recursive: true })
  for (const entry of fs.readdirSync(assetsDir)) {
    if (
      !currentAssets.has(entry) &&
      /^(?:(?:app|bootstrap|index)-[a-fA-F0-9]+|index-[A-Za-z0-9_-]+)/.test(
        entry
      )
    )
      fs.rmSync(path.join(assetsDir, entry), { force: true })
  }
}

function copyFile(source, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  fs.copyFileSync(source, destination)
}

function generateAvailableLicenses() {
  const licenseSourceDir = path.join(desktopStaticDir, 'choosealicense.com')
  const licenses = fs
    .readdirSync(path.join(licenseSourceDir, '_licenses'))
    .sort()
    .map(file => {
      const parsed = frontMatter(
        fs.readFileSync(path.join(licenseSourceDir, '_licenses', file), 'utf8')
      )
      return {
        name: parsed.attributes.nickname || parsed.attributes.title,
        featured: parsed.attributes.featured || false,
        hidden:
          parsed.attributes.hidden === undefined || parsed.attributes.hidden,
        body: `${parsed.body.trim()}\n`,
      }
    })
    .filter(license => !license.hidden)
  fs.writeFileSync(
    path.join(staticDir, 'available-licenses.json'),
    JSON.stringify(licenses)
  )

  const notice = `Desktop Plus uses licensing information provided by choosealicense.com.

The bundle in available-licenses.json has been generated from a source list provided at https://github.com/github/choosealicense.com, which is made available under the below license:

------------

${fs.readFileSync(path.join(licenseSourceDir, 'LICENSE.md'), 'utf8')}`
  fs.writeFileSync(path.join(staticDir, 'LICENSE.choosealicense.md'), notice)
}

function prepareRuntimeAssets() {
  const acknowledgementsPath = path.join(staticDir, 'licenses.json')
  const bundledAcknowledgementsPath = path.join(__dirname, 'licenses.json')
  fs.mkdirSync(staticDir, { recursive: true })
  if (
    !fs.existsSync(acknowledgementsPath) &&
    fs.existsSync(bundledAcknowledgementsPath)
  )
    fs.copyFileSync(bundledAcknowledgementsPath, acknowledgementsPath)
  if (!fs.existsSync(acknowledgementsPath))
    throw new Error('Missing runtime acknowledgements: licenses.json')
  const acknowledgements = fs.readFileSync(acknowledgementsPath)

  fs.rmSync(staticDir, { recursive: true, force: true })
  fs.mkdirSync(staticDir, { recursive: true })
  for (const file of runtimeStaticFiles)
    copyFile(path.join(desktopStaticDir, file), path.join(staticDir, file))

  const gitignoreSource = path.join(desktopStaticDir, 'gitignore')
  const gitignoreDestination = path.join(staticDir, 'gitignore')
  fs.mkdirSync(gitignoreDestination, { recursive: true })
  for (const file of fs.readdirSync(gitignoreSource).sort()) {
    if (!file.endsWith('.gitignore')) continue
    copyFile(
      path.join(gitignoreSource, file),
      path.join(gitignoreDestination, file)
    )
  }
  copyFile(
    path.join(gitignoreSource, 'LICENSE'),
    path.join(staticDir, 'LICENSE.gitignore')
  )
  fs.writeFileSync(path.join(staticDir, 'licenses.json'), acknowledgements)
  copyDirectory(gemojiSourceDir, path.join(staticDir, 'emoji'))
  copyFile(
    path.join(root, '..', 'gemoji', 'LICENSE'),
    path.join(staticDir, 'LICENSE.gemoji.md')
  )
  generateAvailableLicenses()

  const allowedTopLevel = new Set([
    'assets',
    'build-manifest.json',
    'highlighter',
    'highlighter.js',
    'index.html',
    'static',
  ])
  for (const entry of fs.readdirSync(publicDir)) {
    if (!allowedTopLevel.has(entry))
      fs.rmSync(path.join(publicDir, entry), { recursive: true, force: true })
  }
}

function copyDirectory(source, destination) {
  fs.mkdirSync(destination, { recursive: true })
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name)
    const destinationPath = path.join(destination, entry.name)
    if (entry.isDirectory()) copyDirectory(sourcePath, destinationPath)
    else copyFile(sourcePath, destinationPath)
  }
}

function removeHighlighterAssets() {
  fs.rmSync(path.join(publicDir, 'highlighter.js'), { force: true })
  fs.rmSync(path.join(publicDir, 'highlighter'), {
    recursive: true,
    force: true,
  })
}

function validateRuntimeAssets() {
  const executableSvg = /<script\b|\bon[a-z]+\s*=|javascript:/i
  const allowedExtensions = new Set([
    '.css',
    '.gitignore',
    '.html',
    '.js',
    '.json',
    '.md',
    '.png',
    '.svg',
  ])
  const visit = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name)
      if (entry.isSymbolicLink())
        throw new Error(`Runtime assets may not contain symlinks: ${fullPath}`)
      if (entry.isDirectory()) {
        visit(fullPath)
        continue
      }
      const extension = path.extname(entry.name).toLowerCase()
      if (!allowedExtensions.has(extension))
        throw new Error(`Unexpected runtime asset type: ${fullPath}`)
      if (extension === '.json') JSON.parse(fs.readFileSync(fullPath, 'utf8'))
      if (
        extension === '.svg' &&
        executableSvg.test(fs.readFileSync(fullPath, 'utf8'))
      )
        throw new Error(`Executable SVG content is not allowed: ${fullPath}`)
    }
  }
  visit(publicDir)
}

function compileApplication() {
  return new Promise((resolve, reject) => {
    const compiler = webpack({
      ...webpackConfig,
      output: {
        ...webpackConfig.output,
        path: assetsDir,
      },
    })
    compiler.run((error, stats) => {
      compiler.close(closeError => {
        if (error) return reject(error)
        if (closeError) return reject(closeError)
        if (!stats)
          return reject(new Error('Webpack did not return build stats'))
        if (stats.hasErrors())
          return reject(new Error(stats.toString({ errors: true })))
        resolve(stats)
      })
    })
  })
}

function compileHighlighter() {
  return new Promise((resolve, reject) => {
    const compiler = webpack(highlighterWebpackConfig)
    compiler.run((error, stats) => {
      compiler.close(closeError => {
        if (error) return reject(error)
        if (closeError) return reject(closeError)
        if (!stats)
          return reject(new Error('Webpack did not return highlighter stats'))
        if (stats.hasErrors())
          return reject(new Error(stats.toString({ errors: true })))
        resolve(stats)
      })
    })
  })
}

function compiledAssetNames(stats) {
  const assets = stats.toJson({ assets: true }).assets.map(asset => asset.name)
  const application = assets.find(
    asset => asset.startsWith('app-') && asset.endsWith('.js')
  )
  const stylesheet = assets.find(
    asset => asset.startsWith('app-') && asset.endsWith('.css')
  )
  if (!application || !stylesheet)
    throw new Error('Source renderer build did not emit app JavaScript and CSS')
  return { application, stylesheet }
}

function compiledHighlighterAssets(stats) {
  const assets = stats
    .toJson({ assets: true })
    .assets.map(asset => asset.name)
    .filter(asset => asset.endsWith('.js'))
  const entry = assets.find(asset => asset === 'highlighter.js')
  if (!entry) throw new Error('Highlighter build did not emit highlighter.js')
  return {
    entry,
    chunks: assets.filter(asset => asset !== entry),
  }
}

async function main() {
  const appPackage = require('../app/package.json')
  const channel =
    process.env.RELEASE_CHANNEL ||
    (process.env.NODE_ENV === 'production' ? 'production' : 'development')
  const buildInfo = Object.freeze({
    version: appPackage.version,
    channel,
    sha: gitSha(),
    platform: 'web',
  })

  let environment = read('src/environment.js')
  environment = replaceOnce(
    environment,
    '__WEB_BUILD_INFO__',
    JSON.stringify(buildInfo)
  )

  const capabilities = require('./src/capabilities')
  prepareRuntimeAssets()
  removeHighlighterAssets()
  const bootstrapAsset = writeAsset('bootstrap', 'js', environment)
  const [applicationStats, highlighterStats] = await Promise.all([
    compileApplication(),
    compileHighlighter(),
  ])
  const compiledAssets = compiledAssetNames(applicationStats)
  const compiledHighlighter = compiledHighlighterAssets(highlighterStats)

  let html = read('src/index.template.html')
  html = html
    .replace('__BOOTSTRAP_ASSET__', bootstrapAsset)
    .replace('__APPLICATION_ASSET__', compiledAssets.application)
    .replace('__STYLESHEET_ASSET__', compiledAssets.stylesheet)
  const manifest = {
    ...buildInfo,
    renderer: {
      entry: 'app/src/ui/web-index.tsx',
      source: [
        'app/src/ui/web-index.tsx',
        'app/src/ui/web-app.tsx',
        'app/src/ui/web-emoji.ts',
        'app/src/ui/web/contracts.ts',
        'app/src/ui/web/client.ts',
        'app/src/ui/web/platform.ts',
        'app/src/ui/web/store.ts',
      ],
      capabilities,
    },
    assets: {
      bootstrap: bootstrapAsset,
      application: compiledAssets.application,
      stylesheet: compiledAssets.stylesheet,
      highlighter: compiledHighlighter,
    },
  }
  writeFileAtomically(
    path.join(publicDir, 'build-manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`
  )
  writeFileAtomically(path.join(publicDir, 'index.html'), html)
  removeObsoleteGeneratedAssets(new Set(generatedAssetNames(manifest)))
  validateRuntimeAssets()

  console.log(
    `Built Desktop Plus Web ${buildInfo.version} (${
      buildInfo.channel
    }, ${buildInfo.sha.slice(0, 12)})`
  )
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
