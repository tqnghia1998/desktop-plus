import assert from 'node:assert'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'
import * as React from 'react'

import { PopupManager } from '../../../src/lib/popup-manager'
import { Popup, PopupType } from '../../../src/models/popup'
import { IRemote } from '../../../src/models/remote'
import { Repository } from '../../../src/models/repository'
import { DialogStackContext } from '../../../src/ui/dialog/dialog'
import type { Dispatcher } from '../../../src/ui/dispatcher'
import { AddRemoteDialog } from '../../../src/ui/manage-remotes/add-remote-dialog'
import { ManageRemotesDialog } from '../../../src/ui/manage-remotes/manage-remotes-dialog'
import { fireEvent, render, screen, waitFor } from '../../helpers/ui/render'

const repository = new Repository('/test/repository', 1, null, false)
const origin = { name: 'origin', url: 'https://example.test/original.git' }
const showModalDescriptor = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  'showModal'
)
const closeDescriptor = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  'close'
)
let restoreIpcSend: (() => void) | undefined

beforeEach(async () => {
  const electron = await import('electron')
  const previousSend = electron.ipcRenderer.send
  electron.ipcRenderer.send = () => {}
  restoreIpcSend = () => {
    electron.ipcRenderer.send = previousSend
  }
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function () {
    this.open = false
  }
})

afterEach(() => {
  restoreIpcSend?.()
  for (const [name, descriptor] of [
    ['showModal', showModalDescriptor],
    ['close', closeDescriptor],
  ] as const) {
    if (descriptor) {
      Object.defineProperty(HTMLDialogElement.prototype, name, descriptor)
    } else {
      Reflect.deleteProperty(HTMLDialogElement.prototype, name)
    }
  }
})

function remoteFixture() {
  let remotes: ReadonlyArray<IRemote> = [origin]
  const manager = new PopupManager()
  manager.addPopup({ type: PopupType.ManageRemotes, repository })
  const postError = mock.fn((_error: Error) => {})
  const getRemotes = async () => remotes
  const addRemote = mock.fn(
    async (_repository: Repository, name: string, url: string) => {
      remotes = [...remotes, { name, url }]
    }
  )
  const setRemoteURL = mock.fn(
    async (_repository: Repository, name: string, url: string) => {
      remotes = remotes.map(remote =>
        remote.name === name ? { name, url } : remote
      )
    }
  )
  const removeRemote = async (_repository: Repository, name: string) => {
    remotes = remotes.filter(remote => remote.name !== name)
  }
  return {
    manager,
    postError,
    getRemotes,
    addRemote,
    setRemoteURL,
    removeRemote,
  }
}

function RemoteDialogs({
  fixture,
}: {
  fixture: ReturnType<typeof remoteFixture>
}) {
  const [, update] = React.useState(0)
  const dispatcher = {
    ...fixture,
    showPopup: async (popup: Popup) => {
      fixture.manager.addPopup(popup)
      update(value => value + 1)
    },
  } as unknown as Dispatcher
  const dismiss = (popup: Popup) => {
    fixture.manager.removePopup(popup)
    update(value => value + 1)
  }

  return (
    <>
      {fixture.manager.allPopups.map((popup, index) => {
        const isTopMost = fixture.manager.currentPopup === popup
        return (
          <DialogStackContext.Provider key={index} value={{ isTopMost }}>
            {popup.type === PopupType.ManageRemotes ? (
              <ManageRemotesDialog
                dispatcher={dispatcher}
                isTopMost={isTopMost}
                onDismissed={() => dismiss(popup)}
                repository={popup.repository}
              />
            ) : popup.type === PopupType.AddRemote ? (
              <AddRemoteDialog
                dispatcher={dispatcher}
                existingRemoteNames={popup.existingRemoteNames}
                onDismissed={() => dismiss(popup)}
                remote={popup.remote}
                repository={popup.repository}
              />
            ) : null}
          </DialogStackContext.Provider>
        )
      })}
    </>
  )
}

describe('remote dialogs', () => {
  it('edits through the existing popup stack and reloads the filtered list', async () => {
    const fixture = remoteFixture()
    render(<RemoteDialogs fixture={fixture} />)
    const edit = await screen.findByRole('button', {
      name: 'Edit the "origin" remote',
    })
    fireEvent.change(screen.getByPlaceholderText('Filter remotes'), {
      target: { value: 'origin' },
    })
    fireEvent.click(edit)

    assert.strictEqual(fixture.manager.allPopups.length, 2)
    assert.strictEqual(fixture.manager.currentPopup?.type, PopupType.AddRemote)
    assert.strictEqual(
      (screen.getByLabelText('Name') as HTMLInputElement).readOnly,
      true
    )
    assert.strictEqual(
      (screen.getByLabelText('Name') as HTMLInputElement).value,
      'origin'
    )
    fireEvent.change(screen.getByLabelText('URL'), {
      target: { value: '  https://example.test/updated.git  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save remote/i }))

    await waitFor(() => {
      assert.strictEqual(
        fixture.manager.currentPopup?.type,
        PopupType.ManageRemotes
      )
      assert.ok(screen.getByText('https://example.test/updated.git'))
    })
    assert.deepStrictEqual(fixture.setRemoteURL.mock.calls[0].arguments, [
      repository,
      'origin',
      'https://example.test/updated.git',
    ])
    assert.strictEqual(fixture.addRemote.mock.callCount(), 0)
    assert.strictEqual(
      (screen.getByPlaceholderText('Filter remotes') as HTMLInputElement).value,
      'origin'
    )
  })

  it('keeps new-remote validation and refreshes the list after adding', async () => {
    const fixture = remoteFixture()
    render(<RemoteDialogs fixture={fixture} />)
    await screen.findByRole('button', { name: 'Edit the "origin" remote' })
    fireEvent.click(screen.getByRole('button', { name: /new remote/i }))

    const name = screen.getByLabelText('Name') as HTMLInputElement
    const add = screen.getByRole('button', {
      name: /add remote/i,
    }) as HTMLButtonElement
    assert.strictEqual(name.readOnly, false)
    fireEvent.change(name, { target: { value: 'origin' } })
    fireEvent.change(screen.getByLabelText('URL'), {
      target: { value: 'https://example.test/upstream.git' },
    })
    assert.strictEqual(add.getAttribute('aria-disabled'), 'true')
    fireEvent.change(name, { target: { value: 'bad name' } })
    assert.strictEqual(add.getAttribute('aria-disabled'), 'true')
    fireEvent.change(name, { target: { value: '  upstream  ' } })
    assert.strictEqual(add.getAttribute('aria-disabled'), null)
    fireEvent.click(add)

    await waitFor(() => assert.ok(screen.getByText('upstream')))
    assert.deepStrictEqual(fixture.addRemote.mock.calls[0].arguments, [
      repository,
      'upstream',
      'https://example.test/upstream.git',
    ])
    assert.strictEqual(fixture.manager.allPopups.length, 1)
  })

  it('keeps the editor open on failure and cancel restores Manage Remotes', async () => {
    const fixture = remoteFixture()
    const failure = new Error('Remote update failed')
    fixture.setRemoteURL.mock.mockImplementation(async () => {
      throw failure
    })
    render(<RemoteDialogs fixture={fixture} />)
    const appeared = new Promise<void>(resolve => {
      const onAppeared = (event: Event) => {
        if ((event.target as HTMLElement).id !== 'add-remote') return
        document.removeEventListener('dialog-appeared', onAppeared)
        resolve()
      }
      document.addEventListener('dialog-appeared', onAppeared)
    })
    fireEvent.click(
      await screen.findByRole('button', { name: 'Edit the "origin" remote' })
    )
    fireEvent.click(screen.getByRole('button', { name: /save remote/i }))

    await waitFor(() =>
      assert.strictEqual(fixture.postError.mock.callCount(), 1)
    )
    assert.strictEqual(fixture.postError.mock.calls[0].arguments[0], failure)
    assert.strictEqual(fixture.manager.currentPopup?.type, PopupType.AddRemote)
    assert.strictEqual(
      screen
        .getByRole('button', { name: /save remote/i })
        .getAttribute('aria-disabled'),
      null
    )
    await appeared
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    await waitFor(() => {
      assert.strictEqual(fixture.manager.allPopups.length, 1)
      assert.ok(
        screen.getByRole('button', { name: 'Edit the "origin" remote' })
      )
    })
  })
})
