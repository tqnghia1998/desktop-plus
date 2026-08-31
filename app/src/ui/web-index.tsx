import * as React from 'react'
import * as ReactDOM from 'react-dom'

import { WebApp } from './web-app'
import { webGitClient, webHostingClient } from './web/client'
import { webPlatform } from './web/platform'
import { createWebApplicationStore } from './web/store'
;(
  window as Window & { __DESKTOP_PLUS_SOURCE_RENDERER__?: boolean }
).__DESKTOP_PLUS_SOURCE_RENDERER__ = true

const store = createWebApplicationStore(
  webGitClient,
  webPlatform,
  webHostingClient
)

ReactDOM.render(
  <WebApp dispatcher={store.dispatcher} store={store} />,
  document.getElementById('root')
)
