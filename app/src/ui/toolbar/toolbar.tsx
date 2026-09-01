import * as React from 'react'

interface IToolbarProps {
  readonly id?: string
}

interface IToolbarSidebarSectionProps {
  readonly width: number
}

interface IApplicationToolbarProps {
  readonly actions?: React.ReactNode
  readonly branch: React.ReactNode
  readonly pushPull: React.ReactNode
  readonly repository: React.ReactNode
  readonly sidebarWidth: number
  readonly worktree?: React.ReactNode
}

/** The main application toolbar component. */
export class Toolbar extends React.Component<IToolbarProps, {}> {
  public render() {
    return (
      <div id={this.props.id} className="toolbar">
        {this.props.children}
      </div>
    )
  }
}

export function ToolbarSidebarSection(
  props: React.PropsWithChildren<IToolbarSidebarSectionProps>
) {
  return (
    <div className="sidebar-section" style={{ width: props.width }}>
      {props.children}
    </div>
  )
}

export function ApplicationToolbar(props: IApplicationToolbarProps) {
  return (
    <Toolbar id="desktop-app-toolbar">
      <ToolbarSidebarSection width={props.sidebarWidth}>
        {props.repository}
      </ToolbarSidebarSection>
      {props.worktree}
      {props.branch}
      {props.pushPull}
      {props.actions}
    </Toolbar>
  )
}
