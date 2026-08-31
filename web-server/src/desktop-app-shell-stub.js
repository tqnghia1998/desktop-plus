function openExternal(url) {
  window.open(url, '_blank', 'noopener,noreferrer')
}

module.exports = {
  shell: { openExternal },
  openExternal,
}
