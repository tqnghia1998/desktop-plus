function getCopilotAccountCacheKey(account) {
  return `${account.endpoint}:${account.login}`
}

module.exports = {
  getCopilotAccountCacheKey,
}
