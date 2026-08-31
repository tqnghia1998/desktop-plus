function accountEquals(left, right) {
  return (
    left.endpoint === right.endpoint &&
    left.id === right.id &&
    left.login === right.login
  )
}

module.exports = { accountEquals }
