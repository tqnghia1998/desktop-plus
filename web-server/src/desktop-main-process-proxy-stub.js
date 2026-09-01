const React = require('react')
const ReactDOM = require('react-dom')

function invoke() {
  return Promise.resolve(undefined)
}

function runtimeHeaders(headers) {
  const result = new Headers(headers)
  result.set(
    'X-Desktop-Plus-Session',
    window.__DESKTOP_PLUS_RUNTIME__?.session || ''
  )
  return result
}

async function request(path, init = {}) {
  const response = await fetch(path, {
    ...init,
    headers: runtimeHeaders(init.headers),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Browser request failed')
  return payload
}

async function showOpenDialog(options = {}) {
  const payload = await request('/api/dialog/show-open-dialog', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  })
  return payload.path || null
}

async function showSaveDialog(options = {}) {
  const payload = await request('/api/dialog/show-save-dialog', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  })
  return payload.path || null
}

async function getPath(kind) {
  const options = await request('/api/repository-setup/options')
  const defaultParentPath = options.defaultParentPath || ''
  const documentsPath = defaultParentPath.replace(/[\\/]+GitHub$/, '')
  return kind === 'documents'
    ? documentsPath
    : documentsPath || defaultParentPath
}

let lastInteractionPosition = null
let closeCurrentContextMenu = null

function rememberInteractionPosition(event) {
  if (
    Number.isFinite(event.clientX) &&
    Number.isFinite(event.clientY) &&
    (event.clientX !== 0 || event.clientY !== 0)
  ) {
    lastInteractionPosition = { x: event.clientX, y: event.clientY }
  }
}

document.addEventListener('pointerdown', rememberInteractionPosition, true)
document.addEventListener('click', rememberInteractionPosition, true)
document.addEventListener(
  'contextmenu',
  event => {
    rememberInteractionPosition(event)
    if (
      Number.isFinite(event.clientX) &&
      Number.isFinite(event.clientY) &&
      (event.clientX !== 0 || event.clientY !== 0)
    ) {
      return
    }

    const target = event.target
    const fallback =
      target instanceof HTMLElement ? target : document.activeElement
    if (fallback instanceof HTMLElement) {
      const bounds = fallback.getBoundingClientRect()
      lastInteractionPosition = { x: bounds.left, y: bounds.bottom }
    }
  },
  true
)

const browserEditMenuItems = [
  { label: 'Undo', command: 'undo' },
  { label: 'Redo', command: 'redo' },
  { type: 'separator' },
  { label: 'Cut', command: 'cut' },
  { label: 'Copy', command: 'copy' },
  { label: 'Paste', command: 'paste' },
  { label: 'Select All', command: 'selectAll' },
]

function createMenu(items, prefix = 'context', parentIndices = []) {
  const actions = new Map()
  const menuItems = items.flatMap((item, index) => {
    const id = `${prefix}-${index}`
    const indices = [...parentIndices, index]

    if (item.role?.toLowerCase() === 'editmenu') {
      return browserEditMenuItems.map((editItem, editIndex) => {
        const editId = `${id}-${editIndex}`
        if (editItem.type === 'separator') {
          return { id: editId, type: 'separator', visible: true }
        }
        actions.set(editId, { indices: null, browserCommand: editItem.command })
        return {
          id: editId,
          type: 'menuItem',
          label: editItem.label,
          enabled: true,
          visible: true,
          accelerator: null,
          accessKey: null,
        }
      })
    }

    if (item.type === 'separator') {
      return [{ id, type: 'separator', visible: true }]
    }

    const enabled = item.enabled !== false
    if (item.submenu) {
      const nested = createMenu(item.submenu, id, indices)
      for (const [nestedId, action] of nested.actions) {
        actions.set(nestedId, action)
      }
      return [
        {
          id,
          type: 'submenuItem',
          label: item.label || '',
          enabled,
          visible: true,
          menu: nested.menu,
          accessKey: null,
        },
      ]
    }

    actions.set(id, { indices })
    return [
      {
        id,
        type: item.type === 'checkbox' ? 'checkbox' : 'menuItem',
        label: item.label || '',
        enabled,
        visible: true,
        accelerator: null,
        accessKey: null,
        ...(item.type === 'checkbox' ? { checked: item.checked === true } : {}),
      },
    ]
  })

  return { menu: { type: 'menu', items: menuItems }, actions }
}

function BrowserContextMenu({ items, onClose }) {
  // Load the shared desktop menu after the proxy module has finished loading.
  // AppMenu depends on menu-item, which imports this proxy to invoke actions.
  const { AppMenu: AppMenuState } = require('../../app/src/models/app-menu')
  const {
    AppMenu: DesktopAppMenu,
  } = require('../../app/src/ui/app-menu/app-menu')
  const { menu, actions } = React.useMemo(() => createMenu(items), [items])
  const [state, setState] = React.useState(() => AppMenuState.fromMenu(menu))

  React.useEffect(() => setState(AppMenuState.fromMenu(menu)), [menu])

  const dispatcher = React.useMemo(
    () => ({
      executeMenuItem(item) {
        const action = actions.get(item.id)
        if (action?.browserCommand) document.execCommand(action.browserCommand)
        onClose(action?.indices || null)
      },
      setAppMenuState(update) {
        setState(current => update(current))
      },
    }),
    [actions, onClose]
  )

  return React.createElement(DesktopAppMenu, {
    ariaLabelledby: 'web-context-menu',
    dispatcher,
    enableAccessKeyNavigation: false,
    onClose: source => {
      if (source.type === 'keyboard') onClose(null)
    },
    state: state.openMenus,
  })
}

function invokeContextualMenu(items) {
  return new Promise(resolve => {
    closeCurrentContextMenu?.(null)

    const active = document.activeElement
    const root = document.createElement('div')
    root.id = 'web-context-menu'
    const position =
      lastInteractionPosition &&
      Number.isFinite(lastInteractionPosition.x) &&
      Number.isFinite(lastInteractionPosition.y)
        ? lastInteractionPosition
        : active instanceof HTMLElement
        ? (() => {
            const bounds = active.getBoundingClientRect()
            return { x: bounds.left, y: bounds.bottom }
          })()
        : { x: 8, y: 8 }
    lastInteractionPosition = null

    const finish = value => {
      if (closeCurrentContextMenu !== finish) return
      closeCurrentContextMenu = null
      document.removeEventListener('pointerdown', dismiss, true)
      ReactDOM.unmountComponentAtNode(root)
      root.remove()
      active instanceof HTMLElement && active.focus()
      resolve(value)
    }
    const dismiss = event => {
      if (!root.contains(event.target)) finish(null)
    }

    const activeDialog = document.querySelector('dialog[open]')
    ;(activeDialog || document.body).append(root)
    root.style.left = `${position.x}px`
    root.style.top = `${position.y}px`
    closeCurrentContextMenu = finish
    ReactDOM.render(
      React.createElement(BrowserContextMenu, { items, onClose: finish }),
      root
    )

    const margin = 8
    const place = () => {
      const bounds = root.getBoundingClientRect()
      root.style.left = `${Math.max(
        margin,
        Math.min(position.x, window.innerWidth - bounds.width - margin)
      )}px`
      root.style.top = `${Math.max(
        margin,
        Math.min(position.y, window.innerHeight - bounds.height - margin)
      )}px`
    }
    place()
    requestAnimationFrame(place)
    root.querySelector('.menu-pane')?.focus()
    queueMicrotask(() =>
      document.addEventListener('pointerdown', dismiss, true)
    )
  })
}

function noOp() {}

module.exports = {
  checkForUpdates: invoke,
  getAppleActionOnDoubleClick: invoke,
  getCurrentWindowState: invoke,
  getPath,
  isRunningUnderARM64Translation: () => Promise.resolve(false),
  isWindowMaximized: invoke,
  maximizeWindow: noOp,
  minimizeWindow: noOp,
  onAutoUpdaterCheckingForUpdate: noOp,
  onAutoUpdaterError: noOp,
  onAutoUpdaterUpdateAvailable: noOp,
  onAutoUpdaterUpdateDownloaded: noOp,
  onAutoUpdaterUpdateNotAvailable: noOp,
  quitAndInstallUpdate: noOp,
  restoreWindow: noOp,
  sendWillQuitSync: noOp,
  sendDialogDidOpen: noOp,
  closeWindow: noOp,
  setNativeThemeSource: noOp,
  showOpenDialog,
  showSaveDialog,
  shouldUseDarkColors: () => Promise.resolve(true),
  invokeContextualMenu,
}
