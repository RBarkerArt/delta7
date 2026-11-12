import { useEffect } from 'react'
import { frontWindowEl, regionOf } from './regions'
import { cycleFocus } from '../store/windows'

/**
 * Ctrl+` or Alt+` cycles window focus (a bare ` stays with the dev panel). From the top bar or the desktop it first
 * goes back into the front window.
 */
export function useWindowKeys(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Backquote' || e.metaKey || !(e.ctrlKey || e.altKey)) return
      e.preventDefault()
      const front = regionOf(document.activeElement) === 'window' ? null : frontWindowEl()
      if (front) front.focus({ preventScroll: true })
      else cycleFocus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled])
}
