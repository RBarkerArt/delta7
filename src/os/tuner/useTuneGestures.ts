import { useEffect } from 'react'
import { cancelGlide, getTuner, glideTo, setTunerValue } from '../store/tuner'
import { FREQ_MAX, FREQ_MIN, LOCKED_DETENT, MAGNET_RANGE, TARGET, clampFreq, notch, unnotch } from './tunerMath'

/**
 * Pointer + wheel tuning on the ruled strip. The strip moves under a fixed needle, so a drag moves it with
 * the hand (drag left → higher). Forgiveness, in layers:
 *  - a sticky notch around 1.42 (the frequency moves slower than the hand near it),
 *  - on release / flick end / wheel idle, anything within ±0.02 glides into 1.42,
 *  - a tap on the strip glides to that spot (with the same magnet),
 *  - once locked, a drag has to travel past a small detent before the lock lets go.
 */
export function useTuneGestures(el: HTMLElement | null, pxPerUnit: number) {
  useEffect(() => {
    if (!el) return
    let pointerId: number | null = null
    let startX = 0
    let startRaw = 0
    let downAt = 0
    let moved = false
    let samples: { x: number; t: number }[] = []
    let momentumRaf = 0
    let wheelRaw: number | null = null
    let wheelTimer: ReturnType<typeof setTimeout> | null = null

    const rawNow = () => {
      const s = getTuner()
      return s.locked ? TARGET : unnotch(s.value)
    }

    /** Returns false when the raw position hit an end of the band. */
    const applyRaw = (raw: number): boolean => {
      const r = Math.min(FREQ_MAX, Math.max(FREQ_MIN, raw))
      if (getTuner().locked && Math.abs(r - TARGET) < LOCKED_DETENT) return true
      setTunerValue(clampFreq(notch(r)))
      return r === raw
    }

    const settle = () => {
      const s = getTuner()
      if (s.locked) return
      if (Math.abs(s.value - TARGET) <= MAGNET_RANGE) glideTo(TARGET, 380)
    }

    const stopMomentum = () => {
      if (momentumRaf) cancelAnimationFrame(momentumRaf)
      momentumRaf = 0
    }

    const startMomentum = (pxPerMs: number) => {
      let raw = rawNow()
      let v = -pxPerMs / pxPerUnit // units per ms
      let last = performance.now()
      const step = (now: number) => {
        const dt = Math.min(32, now - last)
        last = now
        raw += v * dt
        v *= Math.exp(-dt / 280)
        const inBand = applyRaw(raw)
        // Slow enough near 1.42: let the magnet take it from here.
        const slow = Math.abs(v * pxPerUnit) < 0.08
        if (!inBand || slow || (Math.abs(raw - TARGET) <= MAGNET_RANGE && Math.abs(v * pxPerUnit) < 0.35)) {
          momentumRaf = 0
          settle()
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
      startRaw = rawNow()
      downAt = performance.now()
      moved = false
      samples = [{ x: e.clientX, t: downAt }]
    }

    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return
      const dx = e.clientX - startX
      if (!moved && Math.abs(dx) > 3) moved = true
      if (!moved) return
      const now = performance.now()
      samples.push({ x: e.clientX, t: now })
      while (samples.length > 2 && now - samples[0].t > 90) samples.shift()
      applyRaw(startRaw - dx / pxPerUnit)
    }

    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return
      pointerId = null
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
      if (!moved) {
        if (performance.now() - downAt > 450) return
        // Tap: glide to the tapped spot on the band.
        const rect = el.getBoundingClientRect()
        let target = clampFreq(getTuner().value + (e.clientX - (rect.left + rect.width / 2)) / pxPerUnit)
        if (Math.abs(target - TARGET) <= MAGNET_RANGE) target = TARGET
        glideTo(target, 460)
        return
      }
      const first = samples[0]
      const lastS = samples[samples.length - 1]
      const span = lastS.t - first.t
      const vx = span > 0 && performance.now() - lastS.t < 60 ? (lastS.x - first.x) / span : 0
      if (Math.abs(vx) > 0.4) startMomentum(vx)
      else settle()
    }

    const onCancel = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return
      pointerId = null
      settle()
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()
      stopMomentum()
      const scale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1
      const d = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * scale
      if (wheelRaw === null) wheelRaw = rawNow()
      wheelRaw = Math.min(FREQ_MAX, Math.max(FREQ_MIN, wheelRaw + (d * 0.6) / pxPerUnit))
      applyRaw(wheelRaw)
      if (wheelTimer) clearTimeout(wheelTimer)
      wheelTimer = setTimeout(() => {
        wheelTimer = null
        wheelRaw = null
        settle()
      }, 220)
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
