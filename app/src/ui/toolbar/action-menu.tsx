import * as React from 'react'
import { DropdownState, ToolbarDropdown } from './dropdown'

interface IToolbarActionMenuSeparator {
  readonly id: string
  readonly type: 'separator'
}

interface IToolbarActionMenuItem {
  readonly id: string
  readonly type: 'item'
  readonly label: string
  readonly action: () => void
  readonly disabled?: boolean
}

export type ToolbarActionMenuItem =
  | IToolbarActionMenuSeparator
  | IToolbarActionMenuItem

interface IToolbarActionMenuProps {
  readonly id: string
  readonly label: string
  readonly isOpen: boolean
  readonly items: ReadonlyArray<ToolbarActionMenuItem>
  readonly onStateChanged: (state: DropdownState) => void
}

export function ToolbarActionMenu(props: IToolbarActionMenuProps) {
  const menuRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!props.isOpen) return
    menuRef.current
      ?.querySelector<HTMLButtonElement>('button:not(:disabled)')
      ?.focus()
  }, [props.isOpen])

  const onItemClick = (item: IToolbarActionMenuItem) => {
    props.onStateChanged('closed')
    item.action()
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return

    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>(
        'button:not(:disabled)'
      )
    )
    if (items.length === 0) return

    const activeElement = document.activeElement
    const currentIndex =
      activeElement instanceof HTMLButtonElement
        ? items.indexOf(activeElement)
        : -1
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
        ? items.length - 1
        : currentIndex === -1
        ? event.key === 'ArrowDown'
          ? 0
          : items.length - 1
        : (currentIndex + (event.key === 'ArrowDown' ? 1 : -1) + items.length) %
          items.length

    event.preventDefault()
    items[nextIndex].focus()
  }

  return (
    <ToolbarDropdown
      ariaLabel={`${props.label} menu`}
      buttonAriaHaspopup="menu"
      className="toolbar-action-menu"
      dropdownContentRenderer={() => (
        <div
          aria-label={`${props.label} menu`}
          className="toolbar-action-list"
          id={props.id}
          onKeyDown={onKeyDown}
          ref={menuRef}
          role="menu"
        >
          {props.items.map(item =>
            item.type === 'separator' ? (
              <hr key={item.id} role="separator" />
            ) : (
              <button
                aria-disabled={item.disabled}
                disabled={item.disabled}
                key={item.id}
                onClick={() => onItemClick(item)}
                role="menuitem"
                type="button"
              >
                {item.label}
              </button>
            )
          )}
        </div>
      )}
      dropdownState={props.isOpen ? 'open' : 'closed'}
      foldoutStyleOverrides={{
        height: 'auto',
        minWidth: 'var(--toolbar-action-menu-width)',
      }}
      onDropdownStateChanged={props.onStateChanged}
      title={props.label}
      tooltip={`${props.label} actions`}
    />
  )
}
