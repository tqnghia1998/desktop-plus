import assert from 'node:assert/strict'
import { before, describe, it, mock } from 'node:test'
import * as React from 'react'

import type { CommitList } from '../../../src/ui/history/commit-list'
import type {
  WebCommit,
  WebGitClient,
  WebPlatform,
} from '../../../src/patches/web/contracts'
import { createWebApplicationStore } from '../../../src/patches/web/store'
import { fireEvent, render, screen, waitFor } from '../../helpers/ui/render'

type HistoryView =
  typeof import('../../../src/patches/web/history').DesktopHistoryView
let DesktopHistoryView: HistoryView

// Keep the native sidebar lifecycle and search controls; replace only its
// virtualized list so the test can report a scroll without layout measurements.
class TestCommitList extends React.Component<
  React.ComponentProps<typeof CommitList>
> {
  public render() {
    return (
      <button
        onClick={() => this.props.onScroll?.(0, this.props.commitSHAs.length)}
      >
        {this.props.commitSHAs.length} commits
      </button>
    )
  }
}

before(async () => {
  mock.module('../../../src/ui/history/commit-list.tsx', {
    namedExports: { CommitList: TestCommitList },
  })
  ;({ DesktopHistoryView } = await import('../../../src/patches/web/history'))
})

const repositoryPath = '/test/repository'

function commit(index: number): WebCommit {
  const author = {
    name: 'Test User',
    email: 'test@example.com',
    date: '2025-01-01T00:00:00Z',
    tzOffset: 0,
  }
  return {
    sha: String(index).padStart(40, '0'),
    shortSha: String(index),
    summary: `matching commit ${index}`,
    body: '',
    author,
    committer: author,
    parentSHAs: [],
    trailers: [],
    tags: [],
  }
}

describe('browser commit graph lifecycle', () => {
  it('switches to Graph and searches without a native dispatcher error while preserving filtered pagination', async () => {
    localStorage.clear()
    localStorage.setItem(
      'desktop-plus-web-source-state',
      JSON.stringify({
        repositories: [{ path: repositoryPath }],
        selectedRepositoryPath: repositoryPath,
      })
    )
    const commits = Array.from({ length: 101 }, (_, index) => commit(index + 1))
    const getHistory = mock.fn(
      async (
        _path: string,
        limit: number,
        skip: number,
        _filter: string,
        _graph: boolean
      ) => ({ commits: commits.slice(skip, skip + limit) })
    )
    const store = createWebApplicationStore(
      { getHistory } as unknown as WebGitClient,
      {} as WebPlatform
    )
    await store.dispatcher.setHistoryGraphMode(true)

    function History() {
      const [state, setState] = React.useState(store.getState)
      React.useEffect(
        () => store.subscribe(() => setState(store.getState())),
        []
      )
      return (
        <DesktopHistoryView
          state={state}
          dispatcher={store.dispatcher}
          mode="sidebar"
          selectedSHAs={[]}
          onSelectedSHAsChanged={() => {}}
          confirmCheckoutCommit={true}
          onConfirmCheckoutCommitChanged={() => {}}
          preferAbsoluteDates={false}
          showConventionalCommitBadges={false}
          onCommitMessagePopup={() => {}}
          onHistoryRewriteStarted={() => {}}
        />
      )
    }

    const errors = mock.method(console, 'error', () => {})
    try {
      render(<History />)
      fireEvent.click(screen.getByRole('button', { name: 'Graph view' }))
      fireEvent.change(screen.getByLabelText('Commit filter'), {
        target: { value: 'matching' },
      })
      await waitFor(() => assert.equal(store.getState().loading, false))

      assert.equal(
        errors.mock.calls.filter(
          call => call.arguments[0] === 'Error while filtering commits graph:'
        ).length,
        0
      )
      assert.deepEqual(getHistory.mock.calls.at(-1)?.arguments, [
        repositoryPath,
        100,
        0,
        'matching',
        true,
      ])
      fireEvent.click(screen.getByRole('button', { name: '100 commits' }))
      await screen.findByRole('button', { name: '101 commits' })
      assert.deepEqual(getHistory.mock.calls.at(-1)?.arguments, [
        repositoryPath,
        100,
        100,
        'matching',
        true,
      ])
      assert.equal(store.getState().hasMoreHistory, false)
    } finally {
      errors.mock.restore()
    }
  })
})
