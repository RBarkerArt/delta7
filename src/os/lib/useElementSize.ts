import { useCallback, useEffect, useState } from 'react'

/** ResizeObserver hook. Attach `ref` as a callback ref; width/height update via state. */
export function useElementSize<T extends HTMLElement = HTMLElement>() {
  const [el, setEl] = useState<T | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const ref = useCallback((node: T | null) => setEl(node), [])

  useEffect(() => {
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect
      if (!r) return
      setSize((prev) => (prev.width === r.width && prev.height === r.height ? prev : { width: r.width, height: r.height }))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [el])

  return { ref, width: size.width, height: size.height }
}
