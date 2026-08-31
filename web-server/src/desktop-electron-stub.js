const clipboard = {
  writeText(value) {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(value)
    }
  },
}

module.exports = { clipboard }
