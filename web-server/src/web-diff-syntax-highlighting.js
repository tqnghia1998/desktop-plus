const { highlight } = require('../../app/src/lib/highlighter/worker')

const DiffLineType = {
  Add: 1,
  Delete: 2,
}

function getLineFilters(hunks) {
  const oldLineFilter = []
  const newLineFilter = []
  const diffLines = []
  let anyAdded = false
  let anyDeleted = false

  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      anyAdded = anyAdded || line.type === DiffLineType.Add
      anyDeleted = anyDeleted || line.type === DiffLineType.Delete
      diffLines.push(line)
    }
  }

  for (const line of diffLines) {
    if (line.oldLineNumber !== null && line.newLineNumber !== null) {
      if (anyAdded && !anyDeleted) {
        newLineFilter.push(line.newLineNumber - 1)
      } else {
        oldLineFilter.push(line.oldLineNumber - 1)
      }
    } else if (line.oldLineNumber !== null) {
      oldLineFilter.push(line.oldLineNumber - 1)
    } else if (line.newLineNumber !== null) {
      newLineFilter.push(line.newLineNumber - 1)
    }
  }

  return { oldLineFilter, newLineFilter }
}

async function highlightContents(contents, tabSize, lineFilters) {
  const { file, oldContents, newContents } = contents
  const oldPath =
    file.status.kind === 'Renamed' || file.status.kind === 'Copied'
      ? file.status.oldPath
      : file.path

  const [oldTokens, newTokens] = await Promise.all([
    highlight(
      oldContents,
      oldPath.split(/[\\/]/).pop() || '',
      extension(oldPath),
      tabSize,
      lineFilters.oldLineFilter
    ).catch(error => {
      console.error('Highlighter worker failed for old contents', error)
      return {}
    }),
    highlight(
      newContents,
      file.path.split(/[\\/]/).pop() || '',
      extension(file.path),
      tabSize,
      lineFilters.newLineFilter
    ).catch(error => {
      console.error('Highlighter worker failed for new contents', error)
      return {}
    }),
  ])

  return { oldTokens, newTokens }
}

function extension(filePath) {
  const basename = filePath.split(/[\\/]/).pop() || ''
  const index = basename.lastIndexOf('.')
  return index > 0 ? basename.slice(index) : ''
}

module.exports = {
  getLineFilters,
  highlightContents,
}
