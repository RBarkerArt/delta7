import { createStore } from './createStore'
import { useMediaQuery } from '../lib/useMediaQuery'
import { urlFlag } from '../lib/url'

const deviceStore = createStore<{ forceMobile: boolean }>({ forceMobile: urlFlag('mobile') })

export function setForceMobile(on: boolean) {
  deviceStore.set({ forceMobile: on })
}
export function useForceMobile(): boolean {
  return deviceStore.use((s) => s.forceMobile)
}

/** `(max-width: 767px)` OR `(pointer: coarse)` OR the dev force-mobile flag. */
export function useIsMobile(): boolean {
  const narrow = useMediaQuery('(max-width: 767px)')
  const coarse = useMediaQuery('(pointer: coarse)')
  const forced = useForceMobile()
  return narrow || coarse || forced
}
