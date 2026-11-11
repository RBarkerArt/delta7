import { useEffect } from 'react'
import { nextPage, prevPage } from '../store/layout'
import { closePopover, uiStore } from '../store/ui'
import { devEnabled, toggleDevOpen } from '../store/dev'

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

/** ←/→ page the home grid · ` toggles the dev panel (dev only) · Esc closes popovers. */
export function useGlobalKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return
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
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        nextPage()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        prevPage()
      } else if (e.key === '`' && devEnabled) {
        e.preventDefault()
        toggleDevOpen()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
