import assert from 'node:assert'
import { before, beforeEach, describe, it, mock } from 'node:test'
import * as React from 'react'

import { DiffParser } from '../../../src/lib/diff-parser'
import {
  DiffType,
  IDiff,
  ImageDiffType,
  ITextDiff,
} from '../../../src/models/diff'
import { Repository } from '../../../src/models/repository'
import {
  AppFileStatusKind,
  CommittedFileChange,
} from '../../../src/models/status'
import type { IFileContents } from '../../../src/ui/diff/syntax-highlighting'
import { render, waitFor } from '../../helpers/ui/render'

type Switcher =
  typeof import('../../../src/ui/diff/seamless-diff-switcher').SeamlessDiffSwitcher
type Props = React.ComponentProps<Switcher>

let SeamlessDiffSwitcher: Switcher
const getFileContents = mock.fn(async (): Promise<IFileContents> => {
  throw new Error('Content unavailable')
})

before(async () => {
  mock.module('../../../src/ui/diff/index.tsx', {
    namedExports: { Diff: () => <div data-testid="rendered-diff" /> },
  })
  mock.module('../../../src/ui/diff/syntax-highlighting/index.ts', {
    namedExports: { getFileContents },
  })
  ;({ SeamlessDiffSwitcher } = await import(
    '../../../src/ui/diff/seamless-diff-switcher'
  ))
})

beforeEach(() => {
  getFileContents.mock.resetCalls()
  getFileContents.mock.mockImplementation(async () => {
    throw new Error('Content unavailable')
  })
})

const repository = new Repository('/test/repository', 1, null, false)
const file = new CommittedFileChange(
  'file.txt',
  { kind: AppFileStatusKind.Modified },
  'HEAD',
  'HEAD^'
)

function textDiff(): ITextDiff {
  const text = '--- a/file.txt\n+++ b/file.txt\n@@ -1 +1 @@\n-old\n+new\n'
  return {
    ...new DiffParser().parse(text),
    kind: DiffType.Text,
    text,
    maxLineNumber: 1,
    hasHiddenBidiChars: false,
  }
}

function contents(): IFileContents {
  return {
    file,
    oldContents: ['old', 'same', 'last'],
    newContents: ['new', 'same', 'last'],
    canBeExpanded: true,
  }
}

function props(
  externalFileContents?: IFileContents | null,
  diff: IDiff | null = textDiff()
): Props {
  return {
    repository,
    file,
    diff,
    externalFileContents,
    readOnly: true,
    imageDiffType: ImageDiffType.TwoUp,
    hideWhitespaceInDiff: false,
    showSideBySideDiff: false,
    showDiffMinimap: false,
    wrapDiffLines: false,
    showDiffCheckMarks: false,
    onOpenBinaryFile: () => {},
    onChangeImageDiffType: () => {},
    onHideWhitespaceInDiffChanged: () => {},
  }
}

describe('SeamlessDiffSwitcher content lifecycle', () => {
  it('initializes supplied contents and bottom expansion without loading', () => {
    const supplied = contents()
    const state = new SeamlessDiffSwitcher(props(supplied)).state

    assert.strictEqual(state.fileContents, supplied)
    assert.strictEqual(state.isLoadingDiff, false)
    assert.strictEqual(state.isLoadingSlow, false)
    assert.strictEqual(state.diff?.kind, DiffType.Text)
    assert.strictEqual((state.diff as ITextDiff).hunks.length, 2)
  })

  it('keeps missing, pending, and mismatched text contents loading', () => {
    const otherFile = new CommittedFileChange(
      'other.txt',
      { kind: AppFileStatusKind.Modified },
      'HEAD',
      'HEAD^'
    )
    for (const supplied of [
      undefined,
      null,
      { ...contents(), file: otherFile },
    ]) {
      const requested = props(supplied)
      const state = new SeamlessDiffSwitcher(requested).state
      assert.strictEqual(state.isLoadingDiff, true)
      assert.strictEqual(state.fileContents, null)
      assert.strictEqual(state.diff, requested.diff)
    }
  })

  it('does not require text contents for non-text diffs', () => {
    const binary = { kind: DiffType.Binary } as const
    const state = new SeamlessDiffSwitcher(props(null, binary)).state
    assert.strictEqual(state.isLoadingDiff, false)
    assert.strictEqual(state.diff, binary)
  })

  it('leaves nonexpandable and large text diffs unchanged', () => {
    const diff = textDiff()
    const nonexpandable = { ...contents(), canBeExpanded: false }
    assert.strictEqual(
      new SeamlessDiffSwitcher(props(nonexpandable, diff)).state.diff,
      diff
    )

    const large = { ...diff, kind: DiffType.LargeText } as const
    const state = new SeamlessDiffSwitcher(props(contents(), large)).state
    assert.strictEqual(state.diff, large)
    assert.strictEqual(state.isLoadingDiff, false)
  })

  it('keeps the visible snapshot while external contents are pending', () => {
    const loaded = props(contents())
    const state = new SeamlessDiffSwitcher(loaded).state
    const pending = props(null, null)
    const next = SeamlessDiffSwitcher.getDerivedStateFromProps(pending, state)

    assert.strictEqual(next.isLoadingDiff, true)
    assert.strictEqual(next.diff, state.diff)
    assert.strictEqual(next.fileContents, null)
    assert.strictEqual(next.propSnapshot, undefined)
  })

  it('reuses equal contents but accepts same-file content changes', () => {
    const loaded = props(contents())
    const state = new SeamlessDiffSwitcher(loaded).state
    const equal = SeamlessDiffSwitcher.getDerivedStateFromProps(
      props(contents(), loaded.diff),
      state
    )
    assert.strictEqual(equal.diff, state.diff)

    const changed = { ...contents(), newContents: ['new', 'changed', 'last'] }
    const next = SeamlessDiffSwitcher.getDerivedStateFromProps(
      props(changed, loaded.diff),
      state
    )
    assert.strictEqual(next.fileContents, changed)
    assert.notStrictEqual(next.diff, state.diff)
    assert.strictEqual(next.isLoadingDiff, false)
  })

  it('renders a patch when native content loading fails', async () => {
    const ref = React.createRef<InstanceType<Switcher>>()
    render(<SeamlessDiffSwitcher {...props()} ref={ref} />)

    await waitFor(() => {
      assert.strictEqual(ref.current?.state.isLoadingDiff, false)
      assert.strictEqual(ref.current?.state.fileContents?.canBeExpanded, false)
      assert.deepStrictEqual(ref.current?.state.fileContents?.newContents, [])
    })
    assert.strictEqual(getFileContents.mock.callCount(), 1)
  })

  it('waits for authoritative external contents without fetching from git', () => {
    const ref = React.createRef<InstanceType<Switcher>>()
    const view = render(<SeamlessDiffSwitcher {...props(null)} ref={ref} />)
    assert.strictEqual(getFileContents.mock.callCount(), 0)
    assert.strictEqual(ref.current?.state.isLoadingDiff, true)

    const supplied = contents()
    view.rerender(<SeamlessDiffSwitcher {...props(supplied)} ref={ref} />)
    assert.strictEqual(ref.current?.state.isLoadingDiff, false)
    assert.strictEqual(ref.current?.state.fileContents, supplied)
    assert.strictEqual(getFileContents.mock.callCount(), 0)
  })
})
