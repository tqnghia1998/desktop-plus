import { encodePathAsUrl } from '../../lib/path'

// These illustrations are shared by the welcome flow and the no-repositories
// view, so keep their URLs independent of the Electron-only welcome store.
export const WelcomeRightImageUri = encodePathAsUrl(
  __dirname,
  'static/welcome-illustration-right.svg'
)

export const WelcomeLeftTopImageUri = encodePathAsUrl(
  __dirname,
  'static/welcome-illustration-left-top.svg'
)

export const WelcomeLeftBottomImageUri = encodePathAsUrl(
  __dirname,
  'static/welcome-illustration-left-bottom.svg'
)
