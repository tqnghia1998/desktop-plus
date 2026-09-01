import * as React from 'react'

import {
  DiffFontFamily,
  getDiffFontFamilyCssValue,
  getDiffLineHeight,
} from '../models/diff-font'
import { AppTheme } from './app-theme'
import { ApplicationTheme } from './lib/application-theme'

interface IAppChromeProps {
  readonly className: string
  readonly theme: ApplicationTheme
  readonly tabSize: number
  readonly diffFontSize: number
  readonly diffFontFamily: DiffFontFamily
}

export function AppChrome(props: React.PropsWithChildren<IAppChromeProps>) {
  const style = {
    tabSize: props.tabSize,
    '--diff-font-size': `${props.diffFontSize}px`,
    '--diff-font-family': getDiffFontFamilyCssValue(props.diffFontFamily),
    '--diff-line-height': `${getDiffLineHeight(props.diffFontSize)}px`,
  } as React.CSSProperties

  return (
    <div id="desktop-app-chrome" className={props.className} style={style}>
      <AppTheme theme={props.theme} />
      {props.children}
    </div>
  )
}

type FocusedAppChromeProps = Omit<IAppChromeProps, 'className'>

export function FocusedAppChrome(
  props: React.PropsWithChildren<FocusedAppChromeProps>
) {
  return <AppChrome {...props} className="focused" />
}

interface IAppContentsProps {
  readonly className?: string
}

export function AppContents(props: React.PropsWithChildren<IAppContentsProps>) {
  return (
    <div id="desktop-app-contents" className={props.className}>
      {props.children}
    </div>
  )
}
