import { useEffect } from 'react'
import type { RefObject } from 'react'
import { animate } from 'motion/react'
import { beatIntervalMs, beatIrregularity, isSkippedBeat, isSoftBeat, pulsePeriodMs } from './pulseRate'
import { getTuner, useTunerAdjusting } from '../store/tuner'
import { clarity } from '../tuner/tunerMath'

interface Options {
  /** Beat because something is new. (The Delta7 icon also beats while the tuner is being adjusted.) */
  active: boolean
  badStretch: boolean
  reduced: boolean
  /** Changing this restarts the cycle with a beat right away. */
  nonce: number
}

/**
 * Soft "lub-dub" on `beatRef` (scale) + a warm halo on `haloRef` (opacity/scale). Only an icon that renders a halo
 * (Delta7) ever beats.
 *
 * The beat is a quiet hint for the tuner: while the signal is not locked it is slightly irregular (seeded interval
 * jitter and the odd soft half-beat), easing to an even lub-dub as clarity rises, perfectly steady while locked. Read
 * live from the tuner store on every beat, so it needs no re-renders. A bad stretch still slows it and skips beats.
 * Transform/opacity only. Reduced motion: no scale, just a slow halo breath.
 */
export function useHeartbeat(beatRef: RefObject<HTMLElement | null>, haloRef: RefObject<HTMLElement | null>, opts: Options) {
  const { active, badStretch, reduced, nonce } = opts
  const adjusting = useTunerAdjusting()
  const on = active || adjusting
  useEffect(() => {
    const beatEl = beatRef.current
    const haloEl = haloRef.current
    if (!on || !beatEl || !haloEl) return

    const period = pulsePeriodMs(badStretch)
    let index = 0
    let timer: ReturnType<typeof setTimeout> | null = null
    const running: { stop: () => void }[] = []

    const beat = () => {
      running.length = 0
      const t = getTuner()
      const irregular = beatIrregularity(clarity(t.value), t.locked)
      if (!isSkippedBeat(index, badStretch)) {
        const soft = isSoftBeat(index, irregular)
        if (reduced) {
          const peak = soft ? 0.24 : 0.42
          running.push(animate(haloEl, { opacity: [0.12, peak, 0.12] }, { duration: (period * 2) / 1000, ease: 'easeInOut' }))
        } else if (soft) {
          // A faint single "lub": no second beat.
          const d = 0.42
          running.push(animate(beatEl, { scale: [1, 1.018, 1] }, { duration: d, ease: 'easeInOut' }))
          running.push(animate(haloEl, { opacity: [0.1, 0.3, 0.1], scale: [0.94, 1.0, 0.94] }, { duration: d + 0.2, ease: 'easeOut' }))
        } else {
          const d = 0.62
          const times = [0, 0.16, 0.34, 0.5, 1]
          running.push(animate(beatEl, { scale: [1, 1.04, 1, 1.025, 1] }, { duration: d, times, ease: 'easeInOut' }))
          running.push(
            animate(haloEl, { opacity: [0.1, 0.55, 0.22, 0.42, 0.1], scale: [0.92, 1.06, 0.98, 1.04, 0.94] }, { duration: d + 0.3, times, ease: 'easeOut' }),
          )
        }
      }
      const wait = beatIntervalMs(index, period, irregular)
      index += 1
      timer = setTimeout(beat, reduced ? wait * 2 : wait)
    }
    beat()

    return () => {
      if (timer) clearTimeout(timer)
      running.forEach((a) => a.stop())
      beatEl.style.transform = ''
      haloEl.style.opacity = '0'
      haloEl.style.transform = ''
    }
  }, [on, badStretch, reduced, nonce, beatRef, haloRef])
}
