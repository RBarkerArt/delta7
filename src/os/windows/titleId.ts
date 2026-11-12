import type { AppId } from '../types'

/** id of a window's / sheet's title element; the dialog's `aria-labelledby` points at it. */
export function windowTitleId(id: AppId): string {
  return `os-window-title-${id}`
}
