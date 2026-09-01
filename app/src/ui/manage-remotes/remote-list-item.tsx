import * as React from 'react'

import { IRemote } from '../../models/remote'
import { Button } from '../lib/button'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'

interface IRemoteListItemProps {
  readonly remote: IRemote
  readonly onRemoveRemote: (name: string) => void
  readonly onEditRemote: (remote: IRemote) => void
}

export class RemoteListItem extends React.Component<IRemoteListItemProps, {}> {
  private onRemoveClick = () => {
    this.props.onRemoveRemote(this.props.remote.name)
  }

  private onEditClick = () => {
    this.props.onEditRemote(this.props.remote)
  }

  public render() {
    const { remote } = this.props

    return (
      <li className="remote-list-item">
        <Octicon className="icon" symbol={octicons.server} />
        <span className="name">{remote.name}</span>
        <span className="url">{remote.url}</span>
        <Button
          className="edit-remote-button"
          tooltip={`Edit the "${remote.name}" remote`}
          ariaLabel={`Edit the "${remote.name}" remote`}
          onClick={this.onEditClick}
        >
          <Octicon symbol={octicons.pencil} />
        </Button>
        <Button
          className="remove-remote-button"
          tooltip={`Remove the "${remote.name}" remote`}
          ariaLabel={`Remove the "${remote.name}" remote`}
          onClick={this.onRemoveClick}
        >
          <Octicon symbol={octicons.trash} />
        </Button>
      </li>
    )
  }
}
