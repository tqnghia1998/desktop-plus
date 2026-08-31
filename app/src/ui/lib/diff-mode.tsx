import { getBoolean, setBoolean } from '../../lib/local-storage'
import { ImageDiffType } from '../../models/diff'

export const ShowSideBySideDiffDefault = false
const showSideBySideDiffKey = 'show-side-by-side-diff'
export const ShowDiffMinimapDefault = false
const showDiffMinimapKey = 'show-diff-minimap'
export const ShowWholeFileDefault = false
const showWholeFileKey = 'show-whole-file'
export const WrapDiffLinesDefault = true
const wrapDiffLinesKey = 'wrap-diff-lines'
export const HideWhitespaceInDiffDefault = false
const hideWhitespaceInDiffKey = 'hide-whitespace-in-diff'
export const ImageDiffTypeDefault = ImageDiffType.TwoUp
const imageDiffTypeKey = 'image-diff-type'
export const ShowDiffCheckMarksDefault = true
const showDiffCheckMarksKey = 'diff-check-marks-visible'

/**
 * Gets a value indicating whether not to present diffs in a split view mode
 * as opposed to unified (the default).
 */
export function getShowSideBySideDiff(): boolean {
  return getBoolean(showSideBySideDiffKey, ShowSideBySideDiffDefault)
}

/**
 * Sets a local storage key indicating whether not to present diffs in a split
 * view mode as opposed to unified (the default).
 */
export function setShowSideBySideDiff(showSideBySideDiff: boolean) {
  setBoolean(showSideBySideDiffKey, showSideBySideDiff)
}

/**
 * Gets a value indicating whether to present the diff minimap.
 */
export function getShowDiffMinimap(): boolean {
  return getBoolean(showDiffMinimapKey, ShowDiffMinimapDefault)
}

/**
 * Sets a local storage key indicating whether to present the diff minimap.
 */
export function setShowDiffMinimap(showDiffMinimap: boolean) {
  setBoolean(showDiffMinimapKey, showDiffMinimap)
}

/**
 * Gets a value indicating whether to keep text diffs expanded to the whole file.
 */
export function getShowWholeFile(): boolean {
  return getBoolean(showWholeFileKey, ShowWholeFileDefault)
}

/**
 * Sets a local storage key indicating whether to keep text diffs expanded to
 * the whole file.
 */
export function setShowWholeFile(showWholeFile: boolean) {
  setBoolean(showWholeFileKey, showWholeFile)
}

/**
 * Gets a value indicating whether text diff lines should wrap.
 */
export function getWrapDiffLines(): boolean {
  return getBoolean(wrapDiffLinesKey, WrapDiffLinesDefault)
}

/** Persists the text diff line wrapping preference. */
export function setWrapDiffLines(wrapDiffLines: boolean) {
  setBoolean(wrapDiffLinesKey, wrapDiffLines)
}

export function getHideWhitespaceInDiff(): boolean {
  return getBoolean(hideWhitespaceInDiffKey, HideWhitespaceInDiffDefault)
}

export function setHideWhitespaceInDiff(hideWhitespaceInDiff: boolean) {
  setBoolean(hideWhitespaceInDiffKey, hideWhitespaceInDiff)
}

export function getImageDiffType(): ImageDiffType {
  const value = Number(localStorage.getItem(imageDiffTypeKey))
  return Number.isInteger(value) &&
    value >= ImageDiffType.TwoUp &&
    value <= ImageDiffType.Difference
    ? value
    : ImageDiffTypeDefault
}

export function setImageDiffType(imageDiffType: ImageDiffType) {
  localStorage.setItem(imageDiffTypeKey, String(imageDiffType))
}

export function getShowDiffCheckMarks(): boolean {
  return getBoolean(showDiffCheckMarksKey, ShowDiffCheckMarksDefault)
}

export function setShowDiffCheckMarks(showDiffCheckMarks: boolean) {
  setBoolean(showDiffCheckMarksKey, showDiffCheckMarks)
}

/**
 * Converts wheel input into the shared horizontal diff scroll delta.
 */
export function getDiffHorizontalScrollDelta(
  deltaX: number,
  deltaY: number,
  shiftKey: boolean
): number {
  return shiftKey ? deltaY || deltaX : deltaX
}
