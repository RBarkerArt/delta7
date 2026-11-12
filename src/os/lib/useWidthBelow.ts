import { useCallback, useEffect, useState } from 'react'

/**
 * Watches an element's width against one threshold and re-renders only when the answer flips (never on every resize
 * frame). Attach `ref` as a callback ref. `below` is `null` until the element has been measured with a width > 0.
 */
export function useWidthBelow<T extends HTMLElement = HTMLElement>(threshold: number) {
  const [el, setEl] = useState<T | null>(null)
  const [below, setBelow] = useState<boolean | null>(null)
  const ref = useCallback((node: T | null) => setEl(node), [])

  useEffect(() => {
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0
      const next = w > 0 ? w < threshold : null
      setBelow((prev) => (prev === next ? prev : next))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [el, threshold])

  return { ref, below }
}
