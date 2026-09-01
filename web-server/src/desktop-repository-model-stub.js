class Repository {
  constructor(
    path,
    id,
    gitHubRepository,
    missing,
    alias = null,
    groupName = null,
    defaultBranch = null
  ) {
    this.path = path
    this.id = id
    this.gitHubRepository = gitHubRepository
    this.missing = missing
    this.alias = alias
    this.groupName = groupName
    this.defaultBranch = defaultBranch
    this.workflowPreferences = {}
    this.name = path.split(/[\\/]/).filter(Boolean).pop() || path
    this.customEditorOverride = null
    this._url = null
  }

  get url() {
    return this._url
  }
}

function isRepositoryWithGitHubRepository(repository) {
  return repository.gitHubRepository !== null
}

function isRepositoryWithForkedGitHubRepository() {
  return false
}

function getForkContributionTarget(repository) {
  return repository.workflowPreferences.forkContributionTarget || 'parent'
}

function getUpdateBranchStrategy(repository) {
  return repository.workflowPreferences.updateBranchStrategy || 'merge'
}

function hasDefaultRemoteUrl(repository) {
  return Boolean(repository.url)
}

function nameOf(repository) {
  return repository.gitHubRepository
    ? repository.gitHubRepository.fullName
    : repository.name
}

module.exports = {
  Repository,
  hasDefaultRemoteUrl,
  isRepositoryWithGitHubRepository,
  isRepositoryWithForkedGitHubRepository,
  getForkContributionTarget,
  getUpdateBranchStrategy,
  nameOf,
}
