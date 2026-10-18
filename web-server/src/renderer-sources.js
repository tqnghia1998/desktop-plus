const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '../..')
const rendererEntry = 'app/src/patches/web/index.tsx'

function typescriptSources(directory) {
  return fs
    .readdirSync(path.join(root, directory), { withFileTypes: true })
    .flatMap(entry => {
      const file = `${directory}/${entry.name}`
      return entry.isDirectory()
        ? typescriptSources(file)
        : /\.tsx?$/.test(file)
        ? [file]
        : []
    })
    .sort()
}

const rendererSources = typescriptSources('app/src/patches')

module.exports = { rendererEntry, rendererSources }
