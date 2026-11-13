// Browser Git mutations run through the companion; native assisted commits are unavailable.
function isRepositoryAffectedByAssistedCommit() {
  return false
}

// These paths only feed native ownership queries; companion requests validate the actual target.
async function canonicalMutationPath(path) {
  return path
}

function withoutRepositoryGitAccess(operation) {
  return operation()
}

module.exports = {
  isRepositoryAffectedByAssistedCommit,
  canonicalMutationPath,
  withoutRepositoryGitAccess,
}
