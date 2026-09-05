// Bundles the desktop-plus web runtime into the Space App Vibing repository so
// the packaged app can launch it without a desktop-plus checkout on disk.
// Mirrors the paseo bundler: the output is committed build output that vibing
// ships inside server-bundle/scripts and spawns directly.
//
// Usage: node scripts/bundle-desktop-plus-web.mjs [output-dir]
// Run `yarn build:web` first so web-server/public/ exists.

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outRoot =
  process.argv[2] ??
  path.resolve(root, '..', 'space-app-vibing', 'scripts', 'desktop-plus-web')

const builtins = new Set(
  require('node:module').builtinModules.flatMap((name) => [name, `node:${name}`]),
)

const serverEntry = path.join(root, 'web-server', 'server.js')
const builtIndex = path.join(root, 'web-server', 'public', 'index.html')
if (!fs.existsSync(builtIndex)) {
  console.error(
    'web-server/public/index.html is missing. Run `yarn build:web` before bundling.',
  )
  process.exit(1)
}

const files = new Set()
const packages = new Set()
const unresolved = []

function resolveRelative(fromFile, spec) {
  const base = path.resolve(path.dirname(fromFile), spec)
  for (const candidate of [
    base,
    `${base}.js`,
    `${base}.json`,
    path.join(base, 'package.json'),
    path.join(base, 'index.js'),
  ]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate
    }
  }
  return null
}

function resolvePackage(spec, fromDir) {
  // Bare specifier lookup, walking up node_modules dirs like node does.
  let dir = fromDir
  while (true) {
    for (const segments of [
      [dir, 'node_modules', spec],
      [dir, 'app', 'node_modules', spec],
    ]) {
      const pkgDir = path.join(...segments)
      if (fs.existsSync(path.join(pkgDir, 'package.json'))) return pkgDir
    }
    const parent = path.dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

function copyPackage(pkgDir) {
  const relative = path.relative(root, pkgDir)
  if (packages.has(relative)) return
  packages.add(relative)
  copyDir(pkgDir, path.join(outRoot, relative))

  const manifest = JSON.parse(
    fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'),
  )
  for (const name of Object.keys(manifest.dependencies ?? {})) {
    const nested = path.join(pkgDir, 'node_modules', name)
    const depDir = fs.existsSync(path.join(nested, 'package.json'))
      ? nested
      : resolvePackage(name, path.dirname(pkgDir))
    if (depDir) copyPackage(depDir)
    else unresolved.push(`${relative} -> ${name}`)
  }
}

function copyDir(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true })
  fs.cpSync(from, to, { recursive: true })
}

function copyFile(from) {
  const relative = path.relative(root, from)
  if (files.has(relative)) return
  files.add(relative)
  fs.mkdirSync(path.dirname(path.join(outRoot, relative)), { recursive: true })
  fs.copyFileSync(from, path.join(outRoot, relative))
}

function walk(file) {
  const relative = path.relative(root, file)
  if (files.has(relative)) return
  copyFile(file)
  const text = fs.readFileSync(file, 'utf8')
  for (const match of text.matchAll(/require\('([^']+)'\)/g)) {
    const spec = match[1]
    if (spec.startsWith('.')) {
      const resolved = resolveRelative(file, spec)
      if (!resolved) {
        unresolved.push(`${relative} -> ${spec}`)
        continue
      }
      if (resolved.includes(`${path.sep}node_modules${path.sep}`)) {
        // Directory require into a package (../app/node_modules/dugite).
        const pkgRoot = findPackageRoot(path.dirname(resolved))
        if (pkgRoot) copyPackage(pkgRoot)
        else unresolved.push(`${relative} -> ${spec}`)
      } else {
        walk(resolved)
      }
    } else if (!builtins.has(spec)) {
      const pkgDir = resolvePackage(spec, path.dirname(file))
      if (pkgDir) copyPackage(pkgDir)
      else unresolved.push(`${relative} -> ${spec}`)
    }
  }
}

function findPackageRoot(dir) {
  let current = dir
  while (true) {
    if (fs.existsSync(path.join(current, 'package.json'))) return current
    const parent = path.dirname(current)
    if (parent === current) return null
    current = parent
  }
}

fs.rmSync(outRoot, { recursive: true, force: true })
fs.mkdirSync(outRoot, { recursive: true })

walk(serverEntry)
// Spawned by path for SSH credential flows, never required.
copyFile(path.join(root, 'web-server', 'ssh-askpass.js'))
// Built renderer, highlighter worker and static assets.
copyDir(path.join(root, 'web-server', 'public'), path.join(outRoot, 'web-server', 'public'))

if (unresolved.length > 0) {
  console.error('Unresolved requires:\n' + unresolved.join('\n'))
  process.exit(1)
}

let totalBytes = 0
function measure(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const child = path.join(dir, entry.name)
    if (entry.isSymbolicLink()) continue
    if (entry.isDirectory()) measure(child)
    else totalBytes += fs.statSync(child).size
  }
}
measure(outRoot)

console.log(`Bundled Desktop Plus Web into ${outRoot}`)
console.log(
  `${files.size} server files, ${packages.size} packages, ${(totalBytes / 1024 / 1024).toFixed(1)} MB total`,
)

// Vibing's root package.json is "type": "module"; the desktop-plus runtime is
// CommonJS, so pin the module type inside the bundle.
fs.writeFileSync(
  path.join(outRoot, 'package.json'),
  JSON.stringify({ name: 'desktop-plus-web-bundle', type: 'commonjs', private: true }, null, 2) + '\n',
)
console.log('Wrote bundle package.json (type: commonjs)')
