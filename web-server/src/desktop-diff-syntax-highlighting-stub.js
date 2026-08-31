function getLineFilters() {
  return { oldLineFilter: [], newLineFilter: [] }
}

async function highlightContents() {
  return { oldTokens: {}, newTokens: {} }
}

async function getFileContents(_repository, file) {
  return {
    file,
    oldContents: [],
    newContents: [],
    canBeExpanded: false,
  }
}

module.exports = {
  getFileContents,
  getLineFilters,
  highlightContents,
}
