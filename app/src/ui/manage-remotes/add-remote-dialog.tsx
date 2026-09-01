import * as React from 'react'

import { Repository } from '../../models/repository'
import { Dispatcher } from '../dispatcher'
import { Dialog, DialogContent, DialogError, DialogFooter } from '../dialog'
import { TextBox } from '../lib/text-box'
import { Row } from '../lib/row'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { IRemote } from '../../models/remote'

interface IAddRemoteDialogProps {
  readonly repository: Repository
  readonly dispatcher: Dispatcher
  readonly existingRemoteNames: ReadonlyArray<string>
  readonly onDismissed: () => void
  readonly remote?: IRemote
}

interface IAddRemoteDialogState {
  readonly name: string
  readonly url: string
  readonly adding: boolean
}

export class AddRemoteDialog extends React.Component<
  IAddRemoteDialogProps,
  IAddRemoteDialogState
> {
  private nameTextBoxRef = React.createRef<TextBox>()

  public constructor(props: IAddRemoteDialogProps) {
    super(props)

    this.state = {
      name: props.remote?.name || '',
      url: props.remote?.url || '',
      adding: false,
    }
  }

  public componentDidMount() {
    this.nameTextBoxRef.current?.focus()
  }

  private onNameChanged = (name: string) => {
    this.setState({ name })
  }

  private onUrlChanged = (url: string) => {
    this.setState({ url })
  }

  private get nameAlreadyExists(): boolean {
    const name = this.state.name.trim()
    return (
      name !== this.props.remote?.name &&
      this.props.existingRemoteNames.some(n => n === name)
    )
  }

  private get isValidName(): boolean {
    const name = this.state.name.trim()
    // Git remote names cannot contain whitespace.
    return name.length > 0 && !/\s/.test(name)
  }

  private onSubmit = async () => {
    const name = this.state.name.trim()
    const url = this.state.url.trim()
    const { dispatcher, repository } = this.props

    this.setState({ adding: true })

    try {
      if (this.props.remote) {
        await dispatcher.setRemoteURL(repository, this.props.remote.name, url)
      } else {
        await dispatcher.addRemote(repository, name, url)
      }
    } catch (e) {
      dispatcher.postError(e)
      this.setState({ adding: false })
      return
    }

    this.setState({ adding: false })
    this.props.onDismissed()
  }

  public render() {
    const disabled =
      !this.isValidName ||
      this.nameAlreadyExists ||
      this.state.url.trim().length === 0 ||
      this.state.adding

    return (
      <Dialog
        id="add-remote"
        title={
          this.props.remote
            ? __DARWIN__
              ? 'Edit Remote'
              : 'Edit remote'
            : __DARWIN__
            ? 'Add a Remote'
            : 'Add a remote'
        }
        loading={this.state.adding}
        onSubmit={this.onSubmit}
        onDismissed={this.props.onDismissed}
      >
        {this.nameAlreadyExists ? (
          <DialogError>
            A remote named "{this.state.name.trim()}" already exists.
          </DialogError>
        ) : null}

        <DialogContent>
          <Row>
            <TextBox
              ref={this.nameTextBoxRef}
              label="Name"
              placeholder="upstream"
              readOnly={this.props.remote !== undefined}
              value={this.state.name}
              onValueChanged={this.onNameChanged}
            />
          </Row>

          <Row>
            <TextBox
              label="URL"
              placeholder="https://github.com/user/repo.git"
              value={this.state.url}
              onValueChanged={this.onUrlChanged}
            />
          </Row>
        </DialogContent>

        <DialogFooter>
          <OkCancelButtonGroup
            okButtonText={
              this.props.remote
                ? __DARWIN__
                  ? 'Save Remote'
                  : 'Save remote'
                : __DARWIN__
                ? 'Add Remote'
                : 'Add remote'
            }
            okButtonDisabled={disabled}
          />
        </DialogFooter>
      </Dialog>
    )
  }
}
