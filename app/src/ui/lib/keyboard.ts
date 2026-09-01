interface IModifierEvent {
  readonly ctrlKey: boolean
  readonly metaKey: boolean
}

export function isMacPlatform(
  platform = typeof navigator === 'undefined' ? undefined : navigator.platform
) {
  return platform === undefined ? __DARWIN__ : platform.startsWith('Mac')
}

export function isPrimaryModifier(event: IModifierEvent, platform?: string) {
  return isMacPlatform(platform) ? event.metaKey : event.ctrlKey
}
