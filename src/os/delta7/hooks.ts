import { useEffect, useState } from 'react'

/** Flips between false/true every `ms` while `active`. Returns false when inactive. */
export function useAlternate(active: boolean, ms: number): boolean {
  const [flip, setFlip] = useState(false)
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setFlip((f) => !f), ms)
    return () => clearInterval(id)
  }, [active, ms])
  return active && flip
}

/** Calls `onEscape` on Escape while `active`. */
export function useEscape(active: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onEscape()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [active, onEscape])
}
