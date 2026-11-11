import { useEffect } from 'react'
import { cycleFocus } from '../store/windows'

/** Ctrl+` or Alt+` cycles window focus (a bare ` stays with the dev panel). */
export function useWindowKeys(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Backquote' || e.metaKey || !(e.ctrlKey || e.altKey)) return
      e.preventDefault()
      cycleFocus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled])
}
