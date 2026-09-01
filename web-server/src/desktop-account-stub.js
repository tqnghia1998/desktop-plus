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

module.exports = { Account, accountEquals, isDotComAccount }
