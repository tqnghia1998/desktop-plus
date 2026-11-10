class Account {
  static anonymous() {
    return new Account('', 'https://api.github.com', 'dotcom', '', 0)
  }

  constructor(login, endpoint, apiType, token, id) {
    this.login = login
    this.endpoint = endpoint
    this.apiType = apiType
    this.token = token
    this.id = id
  }
}

function accountEquals(left, right) {
  return (
    left.endpoint === right.endpoint &&
    left.id === right.id &&
    left.login === right.login
  )
}

function isDotComAccount(account) {
  return account.endpoint === 'https://api.github.com'
}

const UnknownLogin = { InitialAuthFetch: 0, 0: 'InitialAuthFetch' }

function getAccountKey(account) {
  return `${account.endpoint}/users/${account.login}`.toLowerCase()
}

function isSameAccount(x, y) {
  return y != null && getAccountKey(x) === getAccountKey(y)
}

function isEnterpriseAccount(account) {
  return account.apiType === 'enterprise'
}

module.exports = {
  Account,
  UnknownLogin,
  accountEquals,
  getAccountKey,
  isDotComAccount,
  isEnterpriseAccount,
  isSameAccount,
}
