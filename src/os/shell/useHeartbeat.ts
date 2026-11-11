import { useEffect } from 'react'
import type { RefObject } from 'react'
import { animate } from 'motion/react'
import { isSkippedBeat, pulsePeriodMs } from './pulseRate'

interface Options {
  active: boolean
  badStretch: boolean
  reduced: boolean
  /** Changing this restarts the cycle with a beat right away. */
  nonce: number
}

/**
 * Soft "lub-dub" on `beatRef` (scale) + a warm halo on `haloRef` (opacity/scale).
 * Transform/opacity only. Reduced motion: no scale, just a slow halo breath.
 */
export function useHeartbeat(beatRef: RefObject<HTMLElement | null>, haloRef: RefObject<HTMLElement | null>, opts: Options) {
  const { active, badStretch, reduced, nonce } = opts
  useEffect(() => {
    const beatEl = beatRef.current
    const haloEl = haloRef.current
    if (!active || !beatEl || !haloEl) return

    const period = pulsePeriodMs(badStretch)
    let index = 0
    let timer: ReturnType<typeof setTimeout> | null = null
    const running: { stop: () => void }[] = []

    const beat = () => {
      running.length = 0
      if (!isSkippedBeat(index, badStretch)) {
        if (reduced) {
          running.push(animate(haloEl, { opacity: [0.12, 0.42, 0.12] }, { duration: (period * 2) / 1000, ease: 'easeInOut' }))
        } else {
          const d = 0.62
          const times = [0, 0.16, 0.34, 0.5, 1]
          running.push(animate(beatEl, { scale: [1, 1.04, 1, 1.025, 1] }, { duration: d, times, ease: 'easeInOut' }))
          running.push(
            animate(haloEl, { opacity: [0.1, 0.55, 0.22, 0.42, 0.1], scale: [0.92, 1.06, 0.98, 1.04, 0.94] }, { duration: d + 0.3, times, ease: 'easeOut' }),
          )
        }
      }
      index += 1
      timer = setTimeout(beat, reduced ? period * 2 : period)
    }
    beat()

    return () => {
      if (timer) clearTimeout(timer)
      running.forEach((a) => a.stop())
      beatEl.style.transform = ''
      haloEl.style.opacity = '0'
      haloEl.style.transform = ''
    }
  }, [active, badStretch, reduced, nonce, beatRef, haloRef])
}
