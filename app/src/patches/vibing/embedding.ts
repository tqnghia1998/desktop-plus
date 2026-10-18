import * as React from 'react'
import type { WebApplicationStore, WebDispatcher } from '../web/contracts'

export function getEmbeddedParentOrigin(): string | null {
  const raw = new URLSearchParams(window.location.search).get('parentOrigin')
  if (!raw) return null
  try {
    const url = new URL(raw)
    if (
      (url.protocol !== 'http:' && url.protocol !== 'https:') ||
      url.origin !== raw
    )
      return null
    return raw
  } catch {
    return null
  }
}

export function useHostRefresh(
  store: WebApplicationStore,
  dispatcher: WebDispatcher
) {
  const hostRefreshInFlight = React.useRef(false)
  const requestHostRefresh = React.useCallback(() => {
    if (hostRefreshInFlight.current || store.getState().loading) return
    hostRefreshInFlight.current = true
    void dispatcher.refresh().finally(() => {
      hostRefreshInFlight.current = false
    })
  }, [dispatcher, store])

  React.useEffect(() => {
    const onFocus = () => {
      requestHostRefresh()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [requestHostRefresh])

  React.useEffect(() => {
    const parentOrigin = getEmbeddedParentOrigin()
    if (!parentOrigin) return
    const refreshFromHost = (event: MessageEvent) => {
      if (
        event.origin === parentOrigin &&
        event.source === window.parent &&
        event.data?.type === 'space:desktop-plus-refresh-request'
      ) {
        requestHostRefresh()
      }
    }
    window.addEventListener('message', refreshFromHost)
    return () => window.removeEventListener('message', refreshFromHost)
  }, [requestHostRefresh])
}

export function useRepositoryQuery(
  dispatcher: WebDispatcher,
  selectedRepositoryPath: string | null
) {
  const openedRepositoryQuery = React.useRef<string | null>(null)
  React.useEffect(() => {
    const requestedPath = new URLSearchParams(window.location.search).get(
      'repository'
    )
    if (
      requestedPath &&
      openedRepositoryQuery.current !== requestedPath &&
      requestedPath !== selectedRepositoryPath
    ) {
      openedRepositoryQuery.current = requestedPath
      void dispatcher.addRepositoryWithWorktrees(requestedPath)
    }
  }, [dispatcher, selectedRepositoryPath])
}
