function isCoAuthoredByTrailer(trailer) {
  return trailer.token.toLowerCase() === 'co-authored-by'
}

function parseSingleUnfoldedTrailer(line, separators) {
  for (const separator of separators) {
    const index = line.indexOf(separator)
    if (index > 0)
      return {
        token: line.substring(0, index).trim(),
        value: line.substring(index + 1).trim(),
      }
  }
  return null
}

function parseRawUnfoldedTrailers(trailers, separators) {
  return trailers
    .split('\n')
    .map(line => parseSingleUnfoldedTrailer(line, separators))
    .filter(Boolean)
}

async function getTrailerSeparatorCharacters() {
  return ':'
}

async function parseTrailers() {
  return []
}

async function mergeTrailers(_, message) {
  return message
}

module.exports = {
  getTrailerSeparatorCharacters,
  isCoAuthoredByTrailer,
  mergeTrailers,
  parseRawUnfoldedTrailers,
  parseSingleUnfoldedTrailer,
  parseTrailers,
}
