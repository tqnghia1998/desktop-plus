class IssuesStore {
  getIssuesMatching() {
    return Promise.resolve([])
  }
}

class GitHubUserStore {
  getMentionableUsersMatching() {
    return Promise.resolve([])
  }
}

module.exports = { GitHubUserStore, IssuesStore }
