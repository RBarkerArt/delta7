import { createStore } from './createStore'
import { isAppId } from '../apps/registry'
import type { AppId, IconPlacement } from '../types'

/**
 * Icon positions are DATA (page, index) so the story can move/add icons later. For now there is one home page:
 * the apps the spec names. A second page is just more entries with `page: 1`.
 */
const PAGE_1: AppId[] = ['delta7', 'tuner', 'gallery', 'video', 'messages', 'files', 'logs']

const DEFAULT_LAYOUT: IconPlacement[] = PAGE_1.map((appId, index) => ({ appId, page: 0, index }))

/** Drops placements of apps this build doesn't have (e.g. a layout saved by an older build), silently. */
function knownOnly(icons: IconPlacement[]): IconPlacement[] {
  return icons.filter((p) => isAppId(p.appId))
}

interface LayoutState {
  icons: IconPlacement[]
  /** Index into the DISPLAYED pages (see `displayPagesOf`). */
  currentPage: number
  /** How many icons fit on one screen right now (measured by the home pager). */
  capacity: number
}

export const layoutStore = createStore<LayoutState>({ icons: DEFAULT_LAYOUT, currentPage: 0, capacity: Infinity })

/** Icons on one layout (data) page, sorted by index. */
export function iconsOnPage(icons: IconPlacement[], page: number): IconPlacement[] {
  return icons.filter((p) => p.page === page).sort((a, b) => a.index - b.index)
}

function dataPageCount(icons: IconPlacement[]): number {
  return icons.reduce((max, p) => Math.max(max, p.page + 1), 1)
}

/**
 * The pages actually shown: each layout page in order, split into screens of `capacity` icons when the viewport is
 * too short or narrow to hold it (the overflow goes to the next screen, never off-screen).
 */
export function displayPagesOf(icons: IconPlacement[], capacity: number): AppId[][] {
  const cap = Math.max(1, Math.floor(capacity))
  const out: AppId[][] = []
  for (let p = 0; p < dataPageCount(icons); p++) {
    const ids = iconsOnPage(icons, p).map((i) => i.appId)
    if (ids.length === 0) out.push([])
    for (let i = 0; i < ids.length; i += cap) out.push(ids.slice(i, i + cap))
  }
  return out
}

export function pageCountOf(icons: IconPlacement[], capacity = Infinity): number {
  return Math.max(1, displayPagesOf(icons, capacity).length)
}

export function useLayout(): IconPlacement[] {
  return layoutStore.use((s) => s.icons)
}
export function useCapacity(): number {
  return layoutStore.use((s) => s.capacity)
}
export function usePageCount(): number {
  return layoutStore.use((s) => pageCountOf(s.icons, s.capacity))
}
export function getPageCount(): number {
  const s = layoutStore.get()
  return pageCountOf(s.icons, s.capacity)
}
export function setLayout(next: IconPlacement[]) {
  const icons = knownOnly(next)
  layoutStore.set((s) => ({ icons, currentPage: Math.min(s.currentPage, pageCountOf(icons, s.capacity) - 1) }))
}
/** The home pager reports how many icons fit on one screen; the shown page stays on the first icon it showed. */
export function setCapacity(capacity: number) {
  layoutStore.set((s) => {
    if (s.capacity === capacity) return {}
    const before = displayPagesOf(s.icons, s.capacity)[s.currentPage]?.[0]
    const after = displayPagesOf(s.icons, capacity)
    const idx = before ? after.findIndex((ids) => ids.includes(before)) : 0
    return { capacity, currentPage: Math.max(0, Math.min(after.length - 1, idx)) }
  })
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
