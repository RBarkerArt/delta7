import { useEffect } from 'react'
import type { RefObject } from 'react'
import { consumeFocusRequest, useFocusRequest } from '../store/windows'
import type { AppId } from '../types'

/**
 * Moves keyboard focus onto the window container (not its first button, so screen readers announce the dialog title)
 * when the store asks for it: open, restore, bring-to-front by icon or Ctrl+`. Plain re-renders never steal focus.
 */
export function useWindowFocus(ref: RefObject<HTMLElement | null>, id: AppId) {
  const request = useFocusRequest()
  useEffect(() => {
    if (!request || request.id !== id) return
    ref.current?.focus({ preventScroll: true })
    consumeFocusRequest(request.n)
  }, [request, id, ref])
}

/** Pointer-down anywhere in a window that doesn't hold keyboard focus: give it focus (a focusable target takes it next). */
export function takeFocusOnPointer(el: HTMLElement | null) {
  if (!el) return
  const a = document.activeElement
  if (a && el.contains(a)) return
  el.focus({ preventScroll: true })
}
