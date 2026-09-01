import * as React from 'react'

import { RepositorySectionTab } from '../lib/app-state'
import { assertNever } from '../lib/fatal-error'
import { FilesChangedBadge } from './changes/files-changed-badge'
import { TabBar } from './tab-bar'

interface IRepositoryTabsProps {
  readonly changesCount: number
  readonly onTabClicked: (section: RepositorySectionTab) => void
  readonly selectedSection: RepositorySectionTab
  readonly showCompareTab: boolean
}

function repositorySectionToTab(section: RepositorySectionTab): number {
  switch (section) {
    case RepositorySectionTab.Changes:
      return 0
    case RepositorySectionTab.History:
      return 1
    case RepositorySectionTab.Compare:
      return 2
    default:
      return assertNever(section, 'Unknown repository section')
  }
}

function tabToRepositorySection(tab: number): RepositorySectionTab {
  switch (tab) {
    case 0:
      return RepositorySectionTab.Changes
    case 1:
      return RepositorySectionTab.History
    case 2:
      return RepositorySectionTab.Compare
    default:
      throw new Error(`Unknown repository tab: ${tab}`)
  }
}

export function RepositoryTabs(props: IRepositoryTabsProps) {
  return (
    <TabBar
      selectedIndex={repositorySectionToTab(props.selectedSection)}
      onTabClicked={tab => props.onTabClicked(tabToRepositorySection(tab))}
    >
      <span className="with-indicator" id="changes-tab">
        <span>Changes</span>
        {props.changesCount > 0 ? (
          <FilesChangedBadge filesChangedCount={props.changesCount} />
        ) : null}
      </span>

      <div className="with-indicator" id="history-tab">
        <span>History</span>
      </div>

      {props.showCompareTab && (
        <div className="with-indicator" id="compare-tab">
          <span>Compare</span>
        </div>
      )}
    </TabBar>
  )
}
