function invoke() {
  return Promise.resolve(undefined)
}

function invokeContextualMenu(items) {
  return new Promise(resolve => {
    const previous = document.getElementById('web-context-menu')
    previous?.remove()

    const active = document.activeElement
    const menu = document.createElement('div')
    menu.id = 'web-context-menu'
    menu.setAttribute('role', 'menu')
    const finish = value => {
      menu.remove()
      document.removeEventListener('pointerdown', dismiss, true)
      document.removeEventListener('keydown', onKeyDown)
      active?.focus()
      resolve(value)
    }
    const dismiss = event => {
      if (!menu.contains(event.target)) finish(null)
    }
    const onKeyDown = event => {
      const buttons = [...menu.querySelectorAll('button:not(:disabled)')]
      const index = buttons.indexOf(document.activeElement)
      if (event.key === 'Escape') finish(null)
      else if (event.key === 'ArrowDown') {
        event.preventDefault()
        buttons[(index + 1) % buttons.length]?.focus()
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        buttons[(index - 1 + buttons.length) % buttons.length]?.focus()
      } else if (event.key === 'Enter') {
        document.activeElement?.click()
      }
    }

    items.forEach((item, index) => {
      if (item.type === 'separator') {
        menu.append(document.createElement('hr'))
        return
      }
      const button = document.createElement('button')
      button.type = 'button'
      button.role = item.type === 'checkbox' ? 'menuitemcheckbox' : 'menuitem'
      button.textContent = item.label || ''
      button.disabled = item.enabled === false
      button.onclick = () => finish([index])
      menu.append(button)
    })

    document.body.append(menu)
    menu.querySelector('button:not(:disabled)')?.focus()
    queueMicrotask(() => {
      document.addEventListener('pointerdown', dismiss, true)
      document.addEventListener('keydown', onKeyDown)
    })
  })
}

function noOp() {}

module.exports = {
  getAppleActionOnDoubleClick: invoke,
  getCurrentWindowState: invoke,
  isWindowMaximized: invoke,
  maximizeWindow: noOp,
  minimizeWindow: noOp,
  restoreWindow: noOp,
  sendDialogDidOpen: noOp,
  closeWindow: noOp,
  setNativeThemeSource: noOp,
  shouldUseDarkColors: () => Promise.resolve(true),
  invokeContextualMenu,
}
