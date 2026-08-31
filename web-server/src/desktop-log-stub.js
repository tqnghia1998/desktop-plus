const log = {
  debug(message, error) {
    console.debug(message, error)
  },
  error(message, error) {
    console.error(message, error)
  },
  info(message, error) {
    console.info(message, error)
  },
  warn(message, error) {
    console.warn(message, error)
  },
}

module.exports = log
