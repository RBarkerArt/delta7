import { createStore } from './createStore'

export type Popover = 'menu' | 'search' | null

interface UIState {
  popover: Popover
  /** Search query; non-empty switches the home grid to a flat list of matches. */
  query: string
  /** Phone: a sheet is being swiped/flown above its normal box, so it must pass OVER the top bar, not under it. */
  sheetRaised: boolean
}

export const uiStore = createStore<UIState>({ popover: null, query: '', sheetRaised: false })

export function usePopover(): Popover {
  return uiStore.use((s) => s.popover)
}
export function openPopover(p: Exclude<Popover, null>) {
  uiStore.set({ popover: p })
}
export function togglePopover(p: Exclude<Popover, null>) {
  if (uiStore.get().popover === p) closePopover()
  else uiStore.set({ popover: p, query: '' })
}
/** Closing search also clears the query. */
export function closePopover() {
  uiStore.set((s) => (s.popover === 'search' ? { popover: null, query: '' } : { popover: null }))
}
export function useSearchQuery(): string {
  return uiStore.use((s) => s.query)
}
export function setSearchQuery(query: string) {
  uiStore.set({ query })
}
export function useSheetRaised(): boolean {
  return uiStore.use((s) => s.sheetRaised)
}
export function setSheetRaised(sheetRaised: boolean) {
  uiStore.set({ sheetRaised })
}
