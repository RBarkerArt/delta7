import { useEffect } from 'react'
import { cancelGlide, getTuner, glideTo, setTunerValue } from '../store/tuner'
import {
  FREQ_MAX,
  FREQ_MIN,
  LOCKED_DETENT,
  TARGET,
  WHEEL_NOTCH_STEP,
  clampFreq,
  fineGain,
  notch,
  pullTarget,
  stepOnGrid,
  unnotch,
  wheelNotches,
} from './tunerMath'
import { startSoundOnDialTouch } from './tunerAudio'

/** Hand speed is measured over this window (ms). */
const HAND_WINDOW_MS = 90
/** Dial speed at release / wheel idle is measured over this window (ms). */
const DIAL_WINDOW_MS = 160
/** For the wheel: the window before it goes idle that must have been calm for the magnet to take it. */
const WHEEL_WINDOW_MS = 400
const WHEEL_IDLE_MS = 220
/** Release faster than this (px/ms) coasts on as a flick. A flick never ends in a glide to the target. */
const FLICK_SPEED = 0.4

interface Sample {
  v: number
  t: number
}

/** MHz per second over the samples inside `windowMs` before `now` (0 when the dial has been still). */
function dialSpeed(samples: Sample[], now: number, windowMs: number): number {
  const recent = samples.filter((s) => now - s.t <= windowMs)
  if (recent.length < 2) return 0
  let travel = 0
  for (let i = 1; i < recent.length; i++) travel += Math.abs(recent[i].v - recent[i - 1].v)
  return (travel / Math.max(now - recent[0].t, 16)) * 1000
}

/**
 * Pointer + wheel tuning on the ruled strip. The strip moves under a fixed needle, so a drag moves it with
 * the hand (drag left → higher). Every assist towards the target lives inside ±PULL_RANGE (see signalConfig):
 *  - a sticky notch (the frequency slows to a stop at the target),
 *  - on a calm release / calm wheel idle / a tap, a dial within the range glides into the target (pullTarget),
 *  - a flick or a fast pass never glides anywhere: momentum just coasts and stops,
 *  - once locked, a drag has to travel past a small detent before the lock lets go.
 * A mouse-wheel notch is a plain 0.01 grid step (like the arrow keys); trackpad scrolling is proportional.
 * A slowly inching hand moves the dial at fineGain() (everywhere on the dial, both ways): fine control on a thumb.
 * The first touch of the dial while the transport is still `open` starts the sound (startSoundOnDialTouch), from
 * inside the gesture: a mouse press, a touch/pen lift, or a wheel when the page already has a live activation.
 */
export function useTuneGestures(el: HTMLElement | null, pxPerUnit: number) {
  useEffect(() => {
    if (!el) return
    let pointerId: number | null = null
    let lastX = 0
    let raw = 0
    let downAt = 0
    let moved = false
    let startX = 0
    let hand: { x: number; t: number }[] = []
    let dial: Sample[] = []
    let momentumRaf = 0
    let wheelRaw: number | null = null
    let wheelTimer: ReturnType<typeof setTimeout> | null = null
    let wheelSamples: Sample[] = []

    const rawNow = () => {
      const s = getTuner()
      return s.locked ? TARGET : unnotch(s.value)
    }

    /** Returns false when the raw position hit an end of the band. */
    const applyRaw = (r0: number): boolean => {
      const r = Math.min(FREQ_MAX, Math.max(FREQ_MIN, r0))
      if (getTuner().locked && Math.abs(r - TARGET) < LOCKED_DETENT) return true
      setTunerValue(clampFreq(notch(r)))
      return r === r0
    }

    /** The hand let go with the dial moving at `speed` MHz/s: the magnet takes it only if it is close AND calm. */
    const settle = (speed: number) => {
      const s = getTuner()
      if (s.locked) return
      const to = pullTarget(s.value, speed)
      if (to !== s.value) glideTo(to, 380)
    }

    const stopMomentum = () => {
      if (momentumRaf) cancelAnimationFrame(momentumRaf)
      momentumRaf = 0
    }

    const startMomentum = (pxPerMs: number) => {
      let r = rawNow()
      let v = -pxPerMs / pxPerUnit // units per ms
      let last = performance.now()
      const step = (now: number) => {
        const dt = Math.min(32, now - last)
        last = now
        r += v * dt
        v *= Math.exp(-dt / 280)
        const inBand = applyRaw(r)
        // Coasts until it runs out of speed (or hits an end). No magnet at the end of a flick.
        if (!inBand || Math.abs(v * pxPerUnit) < 0.08) {
          momentumRaf = 0
          return
        }
        momentumRaf = requestAnimationFrame(step)
      }
      momentumRaf = requestAnimationFrame(step)
    }

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || pointerId !== null) return
      e.preventDefault()
      el.focus({ preventScroll: true })
      stopMomentum()
      cancelGlide()
      pointerId = e.pointerId
      el.setPointerCapture(e.pointerId)
      startX = e.clientX
      lastX = e.clientX
      raw = rawNow()
      downAt = performance.now()
      moved = false
      hand = [{ x: e.clientX, t: downAt }]
      dial = [{ v: raw, t: downAt }]
      // A mouse press is a user activation; a touch or pen only activates on lift (handled in onUp).
      startSoundOnDialTouch(e.pointerType === 'mouse')
    }

    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return
      if (!moved && Math.abs(e.clientX - startX) > 3) moved = true
      if (!moved) return
      const now = performance.now()
      hand.push({ x: e.clientX, t: now })
      while (hand.length > 2 && now - hand[0].t > HAND_WINDOW_MS) hand.shift()
      const span = now - hand[0].t
      const handSpeed = span > 0 ? Math.abs(e.clientX - hand[0].x) / span : 0
      const dx = e.clientX - lastX
      lastX = e.clientX
      raw = Math.min(FREQ_MAX, Math.max(FREQ_MIN, raw - (dx / pxPerUnit) * fineGain(handSpeed)))
      applyRaw(raw)
      dial.push({ v: raw, t: now })
      while (dial.length > 2 && now - dial[0].t > DIAL_WINDOW_MS * 2) dial.shift()
    }

    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return
      pointerId = null
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
      if (e.pointerType !== 'mouse') startSoundOnDialTouch(true)
      const now = performance.now()
      if (!moved) {
        if (now - downAt > 450) return
        // Tap: glide to the tapped spot on the band (the magnet only if the spot itself is within the pull range).
        const rect = el.getBoundingClientRect()
        const spot = clampFreq(getTuner().value + (e.clientX - (rect.left + rect.width / 2)) / pxPerUnit)
        glideTo(pullTarget(spot, 0), 460)
        return
      }
      const first = hand[0]
      const lastS = hand[hand.length - 1]
      const span = lastS.t - first.t
      const vx = span > 0 && now - lastS.t < 60 ? (lastS.x - first.x) / span : 0
      if (Math.abs(vx) > FLICK_SPEED) startMomentum(vx)
      else settle(dialSpeed(dial, now, DIAL_WINDOW_MS))
    }

    const onCancel = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return
      pointerId = null
      settle(dialSpeed(dial, performance.now(), DIAL_WINDOW_MS))
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()
      stopMomentum()
      // A clicky mouse wheel: each notch is one 0.01 step on the arrow keys' grid (lands exactly, holds and locks like
      // any other input). Trackpad pixel scrolling stays proportional (below).
      const notches = wheelNotches(e as WheelEvent & { wheelDeltaX?: number; wheelDeltaY?: number })
      if (notches !== 0) {
        if (wheelTimer) clearTimeout(wheelTimer)
        wheelTimer = null
        wheelRaw = null
        wheelSamples = []
        cancelGlide()
        let v = getTuner().locked ? TARGET : getTuner().value
        for (let i = 0; i < Math.abs(notches); i++) v = stepOnGrid(v, WHEEL_NOTCH_STEP, notches > 0 ? 1 : -1)
        setTunerValue(v)
        startSoundOnDialTouch(false)
        return
      }
      const scale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1
      const d = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * scale
      const now = performance.now()
      if (wheelRaw === null) {
        wheelRaw = rawNow()
        wheelSamples = [{ v: wheelRaw, t: now }]
      }
      wheelRaw = Math.min(FREQ_MAX, Math.max(FREQ_MIN, wheelRaw + (d * 0.6) / pxPerUnit))
      applyRaw(wheelRaw)
      startSoundOnDialTouch(false)
      wheelSamples.push({ v: wheelRaw, t: now })
      while (wheelSamples.length > 2 && now - wheelSamples[0].t > WHEEL_WINDOW_MS * 2) wheelSamples.shift()
      if (wheelTimer) clearTimeout(wheelTimer)
      wheelTimer = setTimeout(() => {
        wheelTimer = null
        wheelRaw = null
        // Speed over the calm-down window before the wheel stopped: the tail of a fast fling still counts as fast.
        const lastT = wheelSamples[wheelSamples.length - 1].t
        settle(dialSpeed(wheelSamples, lastT, WHEEL_WINDOW_MS))
        wheelSamples = []
      }, WHEEL_IDLE_MS)
    }

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onCancel)
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      stopMomentum()
      if (wheelTimer) clearTimeout(wheelTimer)
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onCancel)
      el.removeEventListener('wheel', onWheel)
    }
  }, [el, pxPerUnit])
}
