const { chromium, firefox, webkit } = require('playwright')

const browserSelection = {
  chromium: { type: chromium },
  chrome: { type: chromium, channel: 'chrome' },
  edge: { type: chromium, channel: 'msedge' },
  firefox: { type: firefox },
  safari: { type: webkit },
  webkit: { type: webkit },
}

function selectedBrowserName() {
  const name = (process.env.WEB_BROWSER || 'chromium').toLowerCase()
  if (name === 'msedge') return 'edge'
  if (!Object.hasOwn(browserSelection, name))
    throw new Error(
      `Unsupported WEB_BROWSER=${name}; expected chromium, chrome, edge, firefox, or webkit`
    )
  return name
}

async function launchBrowser(options = {}) {
  const name = selectedBrowserName()
  const { type, ...defaults } = browserSelection[name]
  return type.launch({ headless: true, ...defaults, ...options })
}

module.exports = { launchBrowser, selectedBrowserName }
