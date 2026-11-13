import * as React from 'react'
import { getEmbeddedParentOrigin } from './embedding'

/** The resolved light or dark mode the Space App Vibing host is showing. */
export type HostThemeMode = 'light' | 'dark'

const themeModeQueryParam = 'themeMode'
const themeModeMessageType = 'space:theme-mode'

function isHostThemeMode(value: unknown): value is HostThemeMode {
  return value === 'light' || value === 'dark'
}

/**
 * The mode the host loaded this frame with (`?themeMode=light|dark`), or null
 * when the app is not embedded or the value is anything else.
 */
export function getEmbeddedThemeMode(): HostThemeMode | null {
  const raw = new URLSearchParams(window.location.search).get(
    themeModeQueryParam
  )
  return isHostThemeMode(raw) ? raw : null
}

/**
 * Returns the mode of a `{ type: 'space:theme-mode', mode }` message, or null
 * for any other value. Never throws.
 */
export function parseThemeModeMessage(data: unknown): HostThemeMode | null {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return null
  }
  const message = data as Record<string, unknown>
  const keys = Object.keys(message)
  if (
    keys.length !== 2 ||
    message.type !== themeModeMessageType ||
    !isHostThemeMode(message.mode)
  ) {
    return null
  }
  return message.mode
}

/**
 * Applies the host-message trust rules: only the embedding parent window, at
 * the exact `parentOrigin`, may change the mode.
 */
export function readHostThemeModeMessage(
  event: Pick<MessageEvent, 'origin' | 'source' | 'data'>,
  parentOrigin: string | null,
  parentWindow: Window
): HostThemeMode | null {
  if (
    parentOrigin === null ||
    event.origin !== parentOrigin ||
    event.source !== parentWindow
  ) {
    return null
  }
  return parseThemeModeMessage(event.data)
}

/**
 * The host's theme mode: the query value at first render, then every valid
 * `space:theme-mode` message from the embedding parent. Null when there is no
 * host mode, in which case the app keeps its own theme preference.
 */
export function useHostThemeMode(): HostThemeMode | null {
  const [mode, setMode] = React.useState<HostThemeMode | null>(
    getEmbeddedThemeMode
  )

  React.useEffect(() => {
    const parentOrigin = getEmbeddedParentOrigin()
    if (!parentOrigin) return
    const onMessage = (event: MessageEvent) => {
      const next = readHostThemeModeMessage(event, parentOrigin, window.parent)
      if (next !== null) setMode(next)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  return mode
}
