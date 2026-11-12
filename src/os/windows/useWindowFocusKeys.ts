import { useEffect } from 'react'
import { anyWindowVisible, cycleRegion, shellTabbables } from './regions'
import { stepTabbable, tabbablesIn } from './tabbables'
import { closeApp } from '../store/windows'
import { uiStore } from '../store/ui'
import { isLocked } from '../boot/lockState'
import type { AppId } from '../types'

export { tabbablesIn }

/**
 * Keys for the window holding keyboard focus (desktop windows and phone sheets), and the way out of it:
 *  - Tab / Shift+Tab stay inside it and wrap (no tabbing onto the home behind it). Pointer input is untouched.
 *  - Esc closes it, after inner widgets had their turn: anything that consumed Esc calls preventDefault (bubble-phase
 *    window listener, so it runs after every element handler and capture-phase listener).
 *  - F6 / Shift+F6 cycle focus between regions: window → top bar → desktop → window (phone: sheet ↔ top bar).
 *  - With focus in the top bar or on the desktop while a window is open, Tab moves through those (wrapping) and never
 *    drops into the window; F6, a click on the window or Ctrl+` go back.
 */
export function useWindowFocusKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isLocked()) return
      if (e.key === 'F6') {
        if (e.metaKey || e.ctrlKey || e.altKey) return
        e.preventDefault()
        cycleRegion(e.shiftKey)
        return
      }
      if (e.key !== 'Tab' && e.key !== 'Escape') return
      const active = document.activeElement
      const win = active instanceof HTMLElement ? active.closest<HTMLElement>('[data-os-window]') : null
      if (!win) {
        if (e.key !== 'Tab' || e.metaKey || e.ctrlKey || e.altKey || !anyWindowVisible()) return
        const list = shellTabbables()
        if (list.length === 0) return
        e.preventDefault()
        stepTabbable(list, active ?? document.body, e.shiftKey).focus({ preventScroll: true })
        return
      }
      if (win.closest('[inert]')) return
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
      stepTabbable(list, active as Element, e.shiftKey).focus({ preventScroll: true })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
