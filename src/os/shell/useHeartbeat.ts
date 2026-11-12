import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { animate } from 'motion/react'
import { beatIntervalMs, beatIrregularity, isSkippedBeat, isSoftBeat, pulsePeriodMs } from './pulseRate'
import { getTuner, useTunerAdjusting } from '../store/tuner'
import { clarity } from '../tuner/tunerMath'

interface Options {
  /** Beat because something is new. (The Delta7 icon also beats while the tuner is being adjusted.) */
  active: boolean
  /** May play a single beat on a nonce bump (false e.g. while the home is behind the lock screen). */
  awake: boolean
  badStretch: boolean
  reduced: boolean
  /** Changing this restarts a running cycle with a beat right away, or (no cycle running) plays one single beat. */
  nonce: number
}

type Running = { stop: () => void; finished: Promise<unknown> }[]

/**
 * One beat on `beatEl` (scale) + `haloEl` (opacity/scale): a full lub-dub, or a faint single "lub" when `soft`.
 * Reduced motion: no scale, just a slow halo breath. Transform/opacity only.
 */
function playBeat(beatEl: HTMLElement, haloEl: HTMLElement, soft: boolean, reduced: boolean, period: number): Running {
  if (reduced) {
    const peak = soft ? 0.24 : 0.42
    return [animate(haloEl, { opacity: [0.12, peak, 0.12] }, { duration: (period * 2) / 1000, ease: 'easeInOut' })]
  }
  if (soft) {
    const d = 0.42
    return [
      animate(beatEl, { scale: [1, 1.018, 1] }, { duration: d, ease: 'easeInOut' }),
      animate(haloEl, { opacity: [0.1, 0.3, 0.1], scale: [0.94, 1.0, 0.94] }, { duration: d + 0.2, ease: 'easeOut' }),
    ]
  }
  const d = 0.62
  const times = [0, 0.16, 0.34, 0.5, 1]
  return [
    animate(beatEl, { scale: [1, 1.04, 1, 1.025, 1] }, { duration: d, times, ease: 'easeInOut' }),
    animate(haloEl, { opacity: [0.1, 0.55, 0.22, 0.42, 0.1], scale: [0.92, 1.06, 0.98, 1.04, 0.94] }, { duration: d + 0.3, times, ease: 'easeOut' }),
  ]
}

function settle(beatEl: HTMLElement, haloEl: HTMLElement) {
  beatEl.style.transform = ''
  haloEl.style.opacity = '0'
  haloEl.style.transform = ''
}

/**
 * Stop a beat and rest the icon. A stopped animation can still have one batched style write pending for the next
 * frame, which would leave the icon frozen mid-beat, so rest it again then (unless a newer beat has started by then).
 */
function stopAndSettle(running: Running, beatEl: HTMLElement, haloEl: HTMLElement, stillLatest: () => boolean) {
  running.forEach((a) => a.stop())
  settle(beatEl, haloEl)
  requestAnimationFrame(() => {
    if (stillLatest()) settle(beatEl, haloEl)
  })
}

/**
 * Soft "lub-dub" on `beatRef` (scale) + a warm halo on `haloRef` (opacity/scale). Only an icon that renders a halo
 * (Delta7) ever beats.
 *
 * The beat is a quiet hint for the tuner: while the signal is not locked it is slightly irregular (seeded interval
 * jitter and the odd soft half-beat), easing to an even lub-dub as clarity rises, perfectly steady while locked. Read
 * live from the tuner store on every beat, so it needs no re-renders. A bad stretch still slows it and skips beats.
 * A nonce bump while no cycle runs (e.g. the first-lock banner) plays exactly one beat and stops.
 * Transform/opacity only. Reduced motion: no scale, just a slow halo breath.
 */
export function useHeartbeat(beatRef: RefObject<HTMLElement | null>, haloRef: RefObject<HTMLElement | null>, opts: Options) {
  const { active, awake, badStretch, reduced, nonce } = opts
  const adjusting = useTunerAdjusting()
  const on = active || adjusting
  // Bumped whenever a beat (cycle or single) starts, so a late rest from an older one never cuts a newer one short.
  const epoch = useRef(0)

  // The continuous heartbeat.
  useEffect(() => {
    const beatEl = beatRef.current
    const haloEl = haloRef.current
    if (!on || !beatEl || !haloEl) return
    const mine = ++epoch.current
    const latest = () => epoch.current === mine

    const period = pulsePeriodMs(badStretch)
    let index = 0
    let timer: ReturnType<typeof setTimeout> | null = null
    let running: Running = []

    const beat = () => {
      const t = getTuner()
      const irregular = beatIrregularity(t.transport === 'stopped' ? 0 : clarity(t.value), t.locked)
      running = isSkippedBeat(index, badStretch) ? [] : playBeat(beatEl, haloEl, isSoftBeat(index, irregular), reduced, period)
      const wait = beatIntervalMs(index, period, irregular)
      index += 1
      timer = setTimeout(beat, reduced ? wait * 2 : wait)
    }
    beat()

    return () => {
      if (timer) clearTimeout(timer)
      stopAndSettle(running, beatEl, haloEl, latest)
    }
  }, [on, badStretch, reduced, nonce, beatRef, haloRef])

  // One single beat for a nonce bump while the heartbeat is idle (a running cycle restarts with its own beat instead).
  const seenNonce = useRef(nonce)
  useEffect(() => {
    if (nonce === seenNonce.current) return
    seenNonce.current = nonce
    const beatEl = beatRef.current
    const haloEl = haloRef.current
    if (on || !awake || !beatEl || !haloEl) return
    const mine = ++epoch.current
    const latest = () => epoch.current === mine
    const running = playBeat(beatEl, haloEl, false, reduced, pulsePeriodMs(badStretch))
    // Rest fully afterwards (halo off), as before the beat: a frame after it ends, once its last value is written.
    void Promise.all(running.map((a) => a.finished)).then(() =>
      requestAnimationFrame(() => {
        if (latest()) settle(beatEl, haloEl)
      }),
    )
    return () => stopAndSettle(running, beatEl, haloEl, latest)
  }, [nonce, on, awake, reduced, badStretch, beatRef, haloRef])
}
