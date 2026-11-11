import { createStore } from './createStore'
import type { AppId, IconPlacement } from '../types'

/** Icon positions are DATA (page, index) so the story can move/add icons later. */
const PAGE_1: AppId[] = ['delta7', 'tuner', 'audio', 'memories', 'messages', 'notes', 'files', 'lab', 'archive']
const PAGE_2: AppId[] = ['keep', 'find']

const DEFAULT_LAYOUT: IconPlacement[] = [
  ...PAGE_1.map((appId, index) => ({ appId, page: 0, index })),
  ...PAGE_2.map((appId, index) => ({ appId, page: 1, index })),
]

interface LayoutState {
  icons: IconPlacement[]
  currentPage: number
}

export const layoutStore = createStore<LayoutState>({ icons: DEFAULT_LAYOUT, currentPage: 0 })

export function pageCountOf(icons: IconPlacement[]): number {
  return icons.reduce((max, p) => Math.max(max, p.page + 1), 1)
}

export function useLayout(): IconPlacement[] {
  return layoutStore.use((s) => s.icons)
}
export function usePageCount(): number {
  return layoutStore.use((s) => pageCountOf(s.icons))
}
export function getPageCount(): number {
  return pageCountOf(layoutStore.get().icons)
}
export function setLayout(icons: IconPlacement[]) {
  layoutStore.set((s) => ({ icons, currentPage: Math.min(s.currentPage, pageCountOf(icons) - 1) }))
}

export function useCurrentPage(): number {
  return layoutStore.use((s) => s.currentPage)
}
export function getCurrentPage(): number {
  return layoutStore.get().currentPage
}
/** Clamped to the available pages. */
export function setPage(n: number) {
  const max = getPageCount() - 1
  layoutStore.set({ currentPage: Math.max(0, Math.min(max, Math.round(n))) })
}
export function nextPage() {
  setPage(getCurrentPage() + 1)
}
export function prevPage() {
  setPage(getCurrentPage() - 1)
}

/** Icons on one page, sorted by index. */
export function iconsOnPage(icons: IconPlacement[], page: number): IconPlacement[] {
  return icons.filter((p) => p.page === page).sort((a, b) => a.index - b.index)
}
