/** Keep a measured toolbar foldout inside the available browser viewport. */
export function getFoldoutViewportStyle(
  rect: Pick<ClientRect, 'left' | 'width'>,
  foldoutWidth: number | null,
  viewportWidth: number
) {
  let marginLeft = rect.left
  // The first render must remain unclamped so the natural width is measured.
  if (foldoutWidth === null) return { marginLeft }

  const naturalWidth = Math.max(foldoutWidth, rect.width)
  if (marginLeft + naturalWidth > viewportWidth) {
    marginLeft = Math.max(
      marginLeft - (marginLeft + naturalWidth - viewportWidth),
      0
    )
  }
  return { marginLeft, maxWidth: Math.max(viewportWidth - marginLeft, 0) }
}

/** Preserve uncontrolled scrolling and clamp restored offsets after shrinkage. */
export function clampScrollTop(
  requestedScrollTop: number | undefined,
  contentHeight: number,
  viewportHeight: number
) {
  if (requestedScrollTop === undefined) return undefined
  const maximumScrollTop = Math.max(0, contentHeight - viewportHeight)
  return Math.max(0, Math.min(requestedScrollTop, maximumScrollTop))
}
