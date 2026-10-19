import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import * as React from 'react'

import { useStoredBoolean } from '../../../src/patches/web/preferences-state'
import { fireEvent, render } from '../../helpers/ui/render'

function Preference({ defaultValue }: { readonly defaultValue: boolean }) {
  const [value, setValue] = useStoredBoolean('test-preference', defaultValue)
  return (
    <button aria-pressed={value} onClick={() => setValue(!value)}>
      Preference
    </button>
  )
}

beforeEach(() => localStorage.clear())

describe('persisted browser preferences', () => {
  it('uses the default without writing until the user changes it', () => {
    const view = render(<Preference defaultValue={true} />)
    const button = view.getByRole('button', { name: 'Preference' })
    assert.equal(button.getAttribute('aria-pressed'), 'true')
    assert.equal(localStorage.getItem('test-preference'), null)

    fireEvent.click(button)
    assert.equal(button.getAttribute('aria-pressed'), 'false')
    assert.equal(localStorage.getItem('test-preference'), '0')

    view.unmount()
    const restored = render(<Preference defaultValue={true} />)
    assert.equal(
      restored.getByRole('button').getAttribute('aria-pressed'),
      'false'
    )
  })

  it('retains legacy encodings and invalid-value defaults', () => {
    for (const [stored, expected] of [
      ['true', 'true'],
      ['false', 'false'],
      ['1', 'true'],
      ['0', 'false'],
      ['invalid', 'true'],
    ]) {
      localStorage.setItem('test-preference', stored)
      const view = render(<Preference defaultValue={true} />)
      assert.equal(
        view.getByRole('button').getAttribute('aria-pressed'),
        expected
      )
      assert.equal(localStorage.getItem('test-preference'), stored)
      view.unmount()
    }
  })
})
