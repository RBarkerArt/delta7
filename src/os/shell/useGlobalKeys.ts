import { useEffect } from 'react'
import { getCurrentPage, nextPage, prevPage } from '../store/layout'
import { closePopover, uiStore } from '../store/ui'
import { devEnabled, toggleDevOpen } from '../store/dev'
import { isLocked } from '../boot/lockState'

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false
  if (t.isContentEditable) return true
  const tag = t.tagName
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (tag === 'INPUT') {
    const type = (t as HTMLInputElement).type
    return type !== 'checkbox' && type !== 'radio' && type !== 'button'
  }
  return t.getAttribute('role') === 'slider'
}

/**
 * After paging with the keyboard from an icon, keep keyboard focus on the home: the first icon of the new page (the
 * old page has just gone `inert`, which would otherwise drop focus to the body).
 */
function focusFirstIconSoon(from: number) {
  if (getCurrentPage() === from) return
  let tries = 0
  const step = () => {
    const el = document.querySelector<HTMLElement>(`[data-testid="home-page-${getCurrentPage()}"] [data-testid^="app-icon-"]`)
    if (el && !el.closest('[inert]')) el.focus({ preventScroll: true })
    else if (++tries < 4) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

/** ←/→ page the home grid · ` toggles the dev panel (dev only) · Esc closes popovers. */
export function useGlobalKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return
      // Booting / locked / mid-unlock: the home is not interactive.
      if (isLocked()) return
      if (e.key === 'Escape') {
        if (uiStore.get().popover) {
          e.preventDefault()
          closePopover()
        }
        return
      }
      if (isTypingTarget(e.target)) return
      const t = e.target instanceof Element ? e.target : null
      if (t?.closest('[data-os-window]')) return
      const onIcon = t?.closest('[data-testid^="app-icon-"]') != null
      const from = getCurrentPage()
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        nextPage()
        if (onIcon) focusFirstIconSoon(from)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        prevPage()
        if (onIcon) focusFirstIconSoon(from)
      } else if (e.key === '`' && devEnabled) {
        e.preventDefault()
        toggleDevOpen()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
