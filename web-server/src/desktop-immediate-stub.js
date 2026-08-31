function setImmediate(callback, ...args) {
  return window.setTimeout(() => callback(...args), 0)
}

function clearImmediate(id) {
  window.clearTimeout(id)
}

module.exports = {
  clearImmediate,
  setImmediate,
}
