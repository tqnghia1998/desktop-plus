// Unified stub module for trivial/noop desktop platform contracts
async function filesNotTrackedByLFS(_repository, files) {
  return files || []
}

async function getLargeFilePaths() {
  return []
}

const SamplesURL = 'https://desktop.github.com/usage-data/'

async function isWindowsOpenSSHAvailable() {
  return false
}

async function doMergeCommitsExistAfterCommit() {
  return false
}

const tabSizeDefault = 4

function sendNonFatalException() {}

module.exports = {
  filesNotTrackedByLFS,
  getLargeFilePaths,
  SamplesURL,
  isWindowsOpenSSHAvailable,
  doMergeCommitsExistAfterCommit,
  tabSizeDefault,
  sendNonFatalException,
}
