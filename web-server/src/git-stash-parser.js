const DESKTOP_STASH_ENTRY_MARKER = '!!GitHub_Desktop'
const DESKTOP_STASH_ENTRY_MESSAGE_RE =
  /(?:!!Name<([^<>]+)>)?!!GitHub_Desktop<(.+)>$/

function isDesktopStash(message) {
  return (
    typeof message === 'string' &&
    message.indexOf(DESKTOP_STASH_ENTRY_MARKER) !== -1
  )
}

function parseDesktopStashMessage(message) {
  const match = DESKTOP_STASH_ENTRY_MESSAGE_RE.exec(message)
  if (!match) {
    return null
  }
  const rawCustomName = match[1]
  const branchName = match[2]
  const customStashMessage = rawCustomName
    ? decodeURIComponent(rawCustomName)
    : null
  return {
    branchName,
    customStashMessage,
  }
}

module.exports = {
  DESKTOP_STASH_ENTRY_MARKER,
  DESKTOP_STASH_ENTRY_MESSAGE_RE,
  isDesktopStash,
  parseDesktopStashMessage,
}
