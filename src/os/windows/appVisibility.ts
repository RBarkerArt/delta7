import { createContext, useContext } from 'react'

/**
 * Whether the app body is on screen as far as its host knows: false while its window is minimized (faded to
 * opacity 0 but still mounted) or closing. Loops (canvas traces) stop while it is false.
 */
export const AppVisibleContext = createContext(true)

export function useAppVisible(): boolean {
  return useContext(AppVisibleContext)
}
