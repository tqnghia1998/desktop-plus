import * as React from 'react'

import { IToolbarDropdownProps, ToolbarDropdown } from './dropdown'

type RepositoryToolbarDropdownProps = Omit<
  IToolbarDropdownProps,
  'foldoutStyle'
> & {
  readonly width: number
}

export function RepositoryToolbarDropdown(
  props: RepositoryToolbarDropdownProps
) {
  const { width, ...dropdownProps } = props
  const foldoutStyle: React.CSSProperties = {
    position: 'absolute',
    marginLeft: 0,
    width,
    minWidth: width,
    height: '100%',
    top: 0,
  }

  return <ToolbarDropdown {...dropdownProps} foldoutStyle={foldoutStyle} />
}
