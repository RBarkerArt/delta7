import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import type { Popover } from '../store/ui'

/** Click-outside closes. (Esc is handled globally in useGlobalKeys.) */
export function usePopoverDismiss(
  panelRef: RefObject<HTMLElement | null>,
  anchorRef: RefObject<HTMLElement | null>,
  onClose: () => void,
  /** Pointerdowns inside elements matching this selector don't dismiss. */
  ignoreSelector?: string,
) {
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (panelRef.current?.contains(t) || anchorRef.current?.contains(t)) return
      if (ignoreSelector && t instanceof Element && t.closest(ignoreSelector)) return
      onClose()
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [panelRef, anchorRef, onClose, ignoreSelector])
}

/**
 * When a popover closes, return focus to its anchor button — unless the user already moved focus
 * somewhere else on purpose (e.g. clicked an icon).
 */
export function useReturnFocus(popover: Popover, anchors: Record<Exclude<Popover, null>, RefObject<HTMLElement | null>>) {
  const prev = useRef<Popover>(popover)
  useEffect(() => {
    const was = prev.current
    prev.current = popover
    if (!was || was === popover) return
    const active = document.activeElement
    if (!active || active === document.body || active.closest('[data-popover]')) {
      anchors[was].current?.focus({ preventScroll: true })
    }
  }, [popover, anchors])
}
