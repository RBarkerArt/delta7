import { useSettings } from '../store/settings'
import { useMediaQuery } from './useMediaQuery'

/** True if the OS "Reduce motion" setting is on OR the system prefers reduced motion. */
export function useReducedMotionPref(): boolean {
  const setting = useSettings((s) => s.reduceMotion)
  const system = useMediaQuery('(prefers-reduced-motion: reduce)')
  return setting || system
}
