import assert from 'node:assert'
import { describe, it } from 'node:test'

import { isMacPlatform, isPrimaryModifier } from '../../../src/ui/lib/keyboard'

describe('keyboard modifiers', () => {
  it('uses Command on macOS and Control elsewhere', () => {
    assert.strictEqual(isMacPlatform('MacIntel'), true)
    assert.strictEqual(isMacPlatform('Win32'), false)

    assert.strictEqual(
      isPrimaryModifier({ metaKey: true, ctrlKey: false }, 'MacIntel'),
      true
    )
    assert.strictEqual(
      isPrimaryModifier({ metaKey: false, ctrlKey: true }, 'MacIntel'),
      false
    )
    assert.strictEqual(
      isPrimaryModifier({ metaKey: false, ctrlKey: true }, 'Linux x86_64'),
      true
    )
  })
})
