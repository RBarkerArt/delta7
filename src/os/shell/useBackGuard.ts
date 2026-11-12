import { useEffect } from 'react'
import { closePopover, uiStore } from '../store/ui'
import { closeApp, windowsStore } from '../store/windows'
import { lockStore } from '../boot/lockState'

/**
 * Phone layout: the browser's back gesture (Android back, iOS edge swipe, `history.back()`) closes what is open
 * instead of leaving the OS. While a sheet, the four-dot menu or the search panel is open, exactly ONE extra history
 * entry (same URL, a state object) sits on top; back pops it and closes the top layer (popover first, then the
 * sheet). Closing things any other way consumes the entry again, so history never grows and one back never closes
 * two things. Desktop layout: back is left alone.
 */
const MARK = 'd7osBack'

let enabled = false
/** Our entry is the current history entry. */
let armed = false
/** We called history.back() to consume our entry and are waiting for its popstate. */
let consuming = false

function frontSheet() {
  const s = windowsStore.get()
  return s.focusedId && s.apps.some((a) => a.id === s.focusedId && !a.minimized) ? s.focusedId : null
}

function wantEntry(): boolean {
  return enabled && lockStore.get().phase === 'home' && (uiStore.get().popover != null || frontSheet() != null)
}

function sync() {
  if (consuming) return
  const want = wantEntry()
  if (want && !armed) {
    history.pushState({ [MARK]: true }, '', location.href)
    armed = true
  } else if (!want && armed) {
    armed = false
    consuming = true
    history.back()
  }
}

function onPopState() {
  if (consuming) {
    consuming = false
    sync()
    return
  }
  if (!armed) return // not ours: a normal back
  armed = false
  if (uiStore.get().popover) closePopover()
  else {
    const id = frontSheet()
    if (id) closeApp(id)
  }
  sync()
}

// Installed once and never removed, so a pending "consume" pop is always seen (even across a layout switch).
if (typeof window !== 'undefined') window.addEventListener('popstate', onPopState)

export function useBackGuard(isMobile: boolean) {
  useEffect(() => {
    enabled = isMobile
    // Sync after the current change has settled (store listeners run mid-update).
    const schedule = () => queueMicrotask(sync)
    const unsubs = [uiStore.subscribe(schedule), windowsStore.subscribe(schedule), lockStore.subscribe(schedule)]
    sync()
    return () => {
      unsubs.forEach((u) => u())
      enabled = false
      sync()
    }
  }, [isMobile])
}
