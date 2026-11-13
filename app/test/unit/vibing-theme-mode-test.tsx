import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import * as React from 'react'

import {
  getEmbeddedThemeMode,
  parseThemeModeMessage,
  readHostThemeModeMessage,
  useHostThemeMode,
} from '../../src/patches/vibing/theme-mode'
import { act } from 'react-dom/test-utils'
import { render } from '../helpers/ui/render'

const parentOrigin = 'http://localhost:5183'

function setQuery(search: string) {
  window.history.replaceState(null, '', `/${search}`)
}

function post(init: {
  origin?: string
  source?: Window | null
  data: unknown
}) {
  // The Node MessageEvent constructor only accepts a MessagePort source, so
  // build a plain event carrying the fields the listener reads.
  const event = new Event('message')
  Object.defineProperties(event, {
    origin: { value: init.origin ?? parentOrigin },
    // The test window is its own parent, like a top-level document.
    source: { value: init.source === undefined ? window.parent : init.source },
    data: { value: init.data },
  })
  act(() => {
    window.dispatchEvent(event)
  })
}

function ModeProbe() {
  return <span data-testid="mode">{String(useHostThemeMode())}</span>
}

afterEach(() => setQuery(''))

describe('getEmbeddedThemeMode', () => {
  it('reads light and dark from the themeMode query', () => {
    setQuery('?themeMode=light')
    assert.equal(getEmbeddedThemeMode(), 'light')
    setQuery('?themeMode=dark')
    assert.equal(getEmbeddedThemeMode(), 'dark')
  })

  it('returns null for unknown or missing values', () => {
    setQuery('?themeMode=purple')
    assert.equal(getEmbeddedThemeMode(), null)
    setQuery('?themeMode=')
    assert.equal(getEmbeddedThemeMode(), null)
    setQuery('')
    assert.equal(getEmbeddedThemeMode(), null)
  })
})

describe('parseThemeModeMessage', () => {
  it('accepts exactly the host message shape', () => {
    assert.equal(
      parseThemeModeMessage({ type: 'space:theme-mode', mode: 'light' }),
      'light'
    )
    assert.equal(
      parseThemeModeMessage({ type: 'space:theme-mode', mode: 'dark' }),
      'dark'
    )
  })

  it('rejects anything else without throwing', () => {
    for (const data of [
      null,
      undefined,
      'space:theme-mode',
      42,
      [],
      {},
      { type: 'space:theme-mode' },
      { type: 'space:theme-mode', mode: 'purple' },
      { type: 'space:theme-mode', mode: 'system' },
      { type: 'space:other', mode: 'light' },
      { type: 'space:theme-mode', mode: 'light', extra: true },
    ]) {
      assert.equal(parseThemeModeMessage(data), null, JSON.stringify(data))
    }
  })
})

describe('readHostThemeModeMessage', () => {
  const message = { type: 'space:theme-mode', mode: 'light' }

  it('accepts the parent window at the parent origin', () => {
    assert.equal(
      readHostThemeModeMessage(
        { origin: parentOrigin, source: window.parent, data: message },
        parentOrigin,
        window.parent
      ),
      'light'
    )
  })

  it('rejects another origin, another source or no parent origin', () => {
    const other = { postMessage() {} } as unknown as Window
    assert.equal(
      readHostThemeModeMessage(
        { origin: 'http://evil.test', source: window.parent, data: message },
        parentOrigin,
        window.parent
      ),
      null
    )
    assert.equal(
      readHostThemeModeMessage(
        { origin: parentOrigin, source: other, data: message },
        parentOrigin,
        window.parent
      ),
      null
    )
    assert.equal(
      readHostThemeModeMessage(
        { origin: parentOrigin, source: window.parent, data: message },
        null,
        window.parent
      ),
      null
    )
  })
})

describe('useHostThemeMode', () => {
  it('starts from the query and follows valid host messages', () => {
    setQuery(`?parentOrigin=${encodeURIComponent(parentOrigin)}&themeMode=dark`)
    const view = render(<ModeProbe />)
    assert.equal(view.getByTestId('mode').textContent, 'dark')

    post({ data: { type: 'space:theme-mode', mode: 'light' } })
    assert.equal(view.getByTestId('mode').textContent, 'light')
    post({ data: { type: 'space:theme-mode', mode: 'dark' } })
    assert.equal(view.getByTestId('mode').textContent, 'dark')
  })

  it('ignores messages from the wrong origin, source, type or mode', () => {
    setQuery(`?parentOrigin=${encodeURIComponent(parentOrigin)}&themeMode=dark`)
    const view = render(<ModeProbe />)

    post({
      origin: 'http://evil.test',
      data: { type: 'space:theme-mode', mode: 'light' },
    })
    post({ source: null, data: { type: 'space:theme-mode', mode: 'light' } })
    post({ data: { type: 'space:other', mode: 'light' } })
    post({ data: { type: 'space:theme-mode', mode: 'purple' } })
    post({ data: { type: 'space:theme-mode' } })
    post({ data: 'nope' })
    post({ data: null })
    assert.equal(view.getByTestId('mode').textContent, 'dark')
  })

  it('stays null outside a host, even for a well-formed message', () => {
    setQuery('')
    const view = render(<ModeProbe />)
    assert.equal(view.getByTestId('mode').textContent, 'null')
    post({ data: { type: 'space:theme-mode', mode: 'light' } })
    assert.equal(view.getByTestId('mode').textContent, 'null')
  })
})
