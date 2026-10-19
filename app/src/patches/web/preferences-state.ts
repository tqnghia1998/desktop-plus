import * as React from 'react'
import { getBoolean, setBoolean } from '../../lib/local-storage'

export function useStoredBoolean(key: string, defaultValue: boolean) {
  const [value, setValue] = React.useState(() => getBoolean(key, defaultValue))
  const update = React.useCallback(
    (next: boolean) => {
      setBoolean(key, next)
      setValue(next)
    },
    [key]
  )
  return [value, update] as const
}
