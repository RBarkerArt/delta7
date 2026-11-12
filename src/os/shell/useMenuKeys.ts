import { useEffect } from 'react'
import type { RefObject } from 'react'
import { closePopover } from '../store/ui'

/** Enabled, focusable controls of the menu in DOM order (unavailable rows are skipped). */
export function menuItemsIn(panel: HTMLElement): HTMLElement[] {
  return [...panel.querySelectorAll<HTMLElement>('button, a[href]')].filter(
    (el) => el.getAttribute('aria-disabled') !== 'true' && el.tabIndex >= 0 && !el.hasAttribute('disabled'),
  )
}

/**
 * Keyboard for the four-dot menu: opening it puts focus on its first enabled item; ↑/↓ move (wrapping), Home/End
 * jump; Esc closes it and focus returns to the menu button (useGlobalKeys + useReturnFocus); Tab leaves normally and
 * the menu folds away once focus has left it.
 */
export function useMenuKeys(panelRef: RefObject<HTMLElement | null>, anchorRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    menuItemsIn(panel)[0]?.focus({ preventScroll: true })

    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const items = menuItemsIn(panel)
      if (items.length === 0) return
      const i = items.indexOf(document.activeElement as HTMLElement)
      let next: HTMLElement | undefined
      if (e.key === 'ArrowDown') next = items[(i + 1) % items.length]
      else if (e.key === 'ArrowUp') next = items[(i - 1 + items.length) % items.length]
      else if (e.key === 'Home') next = items[0]
      else if (e.key === 'End') next = items[items.length - 1]
      if (!next) return
      e.preventDefault()
      e.stopPropagation() // ←/→ and friends never page the home behind the menu
      next.focus({ preventScroll: true })
    }
    let timer: ReturnType<typeof setTimeout> | null = null
    const onFocusOut = (e: FocusEvent) => {
      const to = e.relatedTarget
      if (!(to instanceof Node)) return // focus went nowhere in particular (window blur, a click on bare page)
      if (panel.contains(to) || anchorRef.current?.contains(to)) return
      // After the focus move has finished, so closing doesn't pull focus back to the menu button.
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        const a = document.activeElement
        if (a && a !== document.body && !panel.contains(a) && !anchorRef.current?.contains(a)) closePopover()
      }, 0)
    }
    panel.addEventListener('keydown', onKey)
    panel.addEventListener('focusout', onFocusOut)
    return () => {
      if (timer) clearTimeout(timer)
      panel.removeEventListener('keydown', onKey)
      panel.removeEventListener('focusout', onFocusOut)
    }
  }, [panelRef, anchorRef])
}
