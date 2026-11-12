import { tabbablesIn } from './tabbables'
import { getFocusedAppId } from '../store/windows'
import { closePopover, uiStore } from '../store/ui'

/**
 * Keyboard regions of the OS: the front window (or phone sheet), the top bar, and the desktop (home icons + page
 * dots). F6 / Shift+F6 move between them; Tab moves inside the current one. Regions are marked in the DOM with
 * `data-os-region="topbar" | "desktop"`; windows carry `data-os-window`.
 */
export type Region = 'window' | 'topbar' | 'desktop'

const ORDER: Region[] = ['window', 'topbar', 'desktop']

export function regionOf(el: Element | null): Region | null {
  if (!el || el === document.body) return null
  if (el.closest('[data-os-window]')) return 'window'
  const r = el.closest<HTMLElement>('[data-os-region]')?.dataset.osRegion
  return r === 'topbar' || r === 'desktop' ? r : null
}

function isMobileLayout(): boolean {
  return document.querySelector('[data-testid="os-root"]')?.getAttribute('data-mobile') === 'true'
}

/** The window keyboard focus returns to: the most recently focused, still visible one. */
export function frontWindowEl(): HTMLElement | null {
  const id = getFocusedAppId()
  if (!id) return null
  const el = document.querySelector<HTMLElement>(`[data-os-window="${id}"]`)
  return el && !el.closest('[inert]') ? el : null
}

/** Is any window (or sheet) open and visible? Then Tab outside it must not wander into it. */
export function anyWindowVisible(): boolean {
  return document.querySelector('[data-os-window]:not([inert])') != null
}

/** Regions that can take focus right now, in F6 order. On a phone the home is behind the sheet: sheet ↔ top bar. */
function availableRegions(): Region[] {
  const win = frontWindowEl() != null
  const desktop = !(isMobileLayout() && win)
  return ORDER.filter((r) => (r === 'window' ? win : r === 'desktop' ? desktop : true))
}

/** Tabbable elements outside every window: the top bar, plus the desktop when it is reachable. */
export function shellTabbables(): HTMLElement[] {
  const root = document.querySelector<HTMLElement>('[data-testid="os-root"]')
  if (!root) return []
  const desktopOk = !(isMobileLayout() && frontWindowEl())
  return tabbablesIn(root).filter((el) => {
    if (el.closest('[data-os-window]')) return false
    return desktopOk || el.closest('[data-os-region="desktop"]') == null
  })
}

function focusEl(el: HTMLElement | null | undefined): boolean {
  if (!el) return false
  el.focus({ preventScroll: true })
  return document.activeElement === el
}

function focusRegion(r: Region): boolean {
  if (r === 'window') return focusEl(frontWindowEl())
  const region = document.querySelector<HTMLElement>(`[data-os-region="${r}"]`)
  if (!region) return false
  if (r === 'desktop') {
    // First visible home icon on the current page (or the first search result while searching), else a page dot.
    const parts = [...document.querySelectorAll<HTMLElement>('[data-os-region="desktop"]')].map((el) => tabbablesIn(el))
    const icon = parts.flat().find((el) => el.matches('[data-testid^="app-icon-"]'))
    return focusEl(icon) || parts.some((list) => focusEl(list[0]))
  }
  return focusEl(tabbablesIn(region)[0])
}

/** F6 (forward) / Shift+F6 (back): move keyboard focus to the next region that can take it. */
export function cycleRegion(back: boolean): boolean {
  const regions = availableRegions()
  const from = regionOf(document.activeElement)
  let i = from ? regions.indexOf(from) : -1
  // From nowhere: forward starts at the top bar; backward lands on the region before it.
  if (i < 0) i = regions.indexOf('topbar') + (back ? 0 : -1)
  for (let k = 1; k <= regions.length; k++) {
    const next = regions[(i + (back ? -k : k) + regions.length * 2) % regions.length]
    if (next === from) continue
    if (focusRegion(next)) {
      // The four-dot menu belongs to the top bar; leaving the bar folds it away (search stays, it filters the desktop).
      if (next !== 'topbar' && uiStore.get().popover === 'menu') closePopover()
      return true
    }
  }
  return false
}
