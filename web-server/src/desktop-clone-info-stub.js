// The companion performs cloning with the user's configured Git credentials.
// The browser has no native account catalog for API-based clone discovery.
async function resolveURLCloneInfo(url) {
  return { url }
}

module.exports = { resolveURLCloneInfo }
