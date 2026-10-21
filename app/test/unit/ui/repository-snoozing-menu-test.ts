import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { Repository } from '../../../src/models/repository'
import { generateRepositoryListContextMenu } from '../../../src/ui/repositories-list/repository-list-item-context-menu'

const repository = new Repository(process.cwd(), 1, null, false)
const noop = () => {}
const config = {
  repository,
  shellLabel: undefined,
  externalEditorLabel: undefined,
  askForConfirmationOnRemoveRepository: true,
  onViewOnGitHub: noop,
  onOpenInShell: noop,
  onShowRepository: noop,
  onOpenInExternalEditor: noop,
  onRemoveRepository: noop,
  onChangeRepositoryAlias: noop,
  onRemoveRepositoryAlias: noop,
  onNewGroupForRepository: noop,
  onRemoveRepositoryGroupName: noop,
  groupNames: [],
  onAssignRepositoryGroupName: noop,
  onCopyRepoPath: noop,
}

describe('repository snoozing menu capability', () => {
  it('omits Snooze when the browser supplies no handler', () => {
    const items = generateRepositoryListContextMenu(config)
    assert.equal(
      items.some(item => 'label' in item && item.label === 'Snooze…'),
      false
    )
  })

  it('preserves the native Snooze action and target', () => {
    let target: Repository | undefined
    const items = generateRepositoryListContextMenu({
      ...config,
      onSnoozeRepository: value => {
        target = value
      },
    })
    const snooze = items.find(
      item => 'label' in item && item.label === 'Snooze…'
    )
    assert.ok(snooze && 'action' in snooze)
    snooze.action?.()
    assert.equal(target, repository)
  })
})
