import { useEffect } from 'react'
import { closeApp } from '../store/windows'
import { uiStore } from '../store/ui'
import { isLocked } from '../boot/lockState'
import type { AppId } from '../types'

const CANDIDATES =
  'a[href], button, input, select, textarea, summary, audio[controls], video[controls], [tabindex], [contenteditable="true"]'

/** Keyboard-reachable elements inside `root`, in document order. */
export function tabbablesIn(root: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = []
  for (const el of root.querySelectorAll<HTMLElement>(CANDIDATES)) {
    if (el.tabIndex < 0 || (el as HTMLButtonElement).disabled) continue
    if (el.closest('[inert]') || el.getClientRects().length === 0) continue
    if (getComputedStyle(el).visibility === 'hidden') continue
    out.push(el)
  }
  return out
}

function follows(a: Node, b: Node): boolean {
  return (b.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
}

/** Next/previous tabbable after `from` inside the window, wrapping at the ends. */
function step(list: HTMLElement[], from: Element, back: boolean): HTMLElement {
  const i = list.indexOf(from as HTMLElement)
  if (i >= 0) return list[(i + (back ? -1 : 1) + list.length) % list.length]
  if (back) {
    for (let j = list.length - 1; j >= 0; j--) if (follows(from, list[j])) return list[j]
    return list[list.length - 1]
  }
  return list.find((el) => follows(el, from)) ?? list[0]
}

/**
 * Keys for the window holding keyboard focus (desktop windows and phone sheets):
 *  - Tab / Shift+Tab stay inside it and wrap (no tabbing onto the home behind it). Pointer input is untouched.
 *  - Esc closes it, after inner widgets had their turn: anything that consumed Esc calls preventDefault (bubble-phase
 *    window listener, so it runs after every element handler and capture-phase listener).
 */
export function useWindowFocusKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isLocked()) return
      if (e.key !== 'Tab' && e.key !== 'Escape') return
      const active = document.activeElement
      const win = active instanceof HTMLElement ? active.closest<HTMLElement>('[data-os-window]') : null
      if (!win || win.closest('[inert]')) return
      if (e.key === 'Escape') {
        if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey || uiStore.get().popover) return
        e.preventDefault()
        closeApp(win.dataset.osWindow as AppId)
        return
      }
      const list = tabbablesIn(win)
      e.preventDefault()
      if (list.length === 0) {
        win.focus({ preventScroll: true })
        return
      }
      step(list, active as Element, e.shiftKey).focus({ preventScroll: true })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
