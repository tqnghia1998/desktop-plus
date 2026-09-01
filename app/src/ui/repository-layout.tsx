import * as React from 'react'

import { IConstrainedValue } from '../lib/app-state'
import { FocusContainer } from './lib/focus-container'
import { Resizable } from './resizable'
import { UiView } from './ui-view'

interface IRepositoryLayoutProps {
  readonly content: React.ReactNode
  readonly onSidebarFocusWithinChanged?: (hasFocusWithin: boolean) => void
  readonly onSidebarReset: () => void
  readonly onSidebarResize: (width: number) => void
  readonly sidebar: React.ReactNode
  readonly sidebarWidth: IConstrainedValue
  readonly tutorial?: React.ReactNode
}

export function RepositoryLayout(props: IRepositoryLayoutProps) {
  return (
    <UiView id="repository">
      <FocusContainer onFocusWithinChanged={props.onSidebarFocusWithinChanged}>
        <Resizable
          id="repository-sidebar"
          width={props.sidebarWidth.value}
          maximumWidth={props.sidebarWidth.max}
          minimumWidth={props.sidebarWidth.min}
          onReset={props.onSidebarReset}
          onResize={props.onSidebarResize}
          description="Repository sidebar"
        >
          {props.sidebar}
        </Resizable>
      </FocusContainer>
      {props.content}
      {props.tutorial}
    </UiView>
  )
}
