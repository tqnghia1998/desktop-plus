import * as React from 'react'
import * as ReactDOM from 'react-dom'

import { WebApp } from './application'
import { webGitClient } from './client'
import { webPlatform } from './platform'
import { createWebApplicationStore } from './store'
;(
  window as Window & { __DESKTOP_PLUS_SOURCE_RENDERER__?: boolean }
).__DESKTOP_PLUS_SOURCE_RENDERER__ = true

const store = createWebApplicationStore(webGitClient, webPlatform)

ReactDOM.render(
  <WebApp dispatcher={store.dispatcher} store={store} />,
  document.getElementById('root')
)
