/**
 * Follows one pointer on `window` until it lifts or is cancelled, so a drag keeps working when the pointer leaves the
 * element it started on. `onEnd` gets `cancelled = true` for pointercancel.
 */
export function trackPointer(
  pointerId: number,
  onMove: (e: PointerEvent) => void,
  onEnd: (e: PointerEvent, cancelled: boolean) => void,
) {
  const move = (e: PointerEvent) => {
    if (e.pointerId === pointerId) onMove(e)
  }
  const end = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', end)
    window.removeEventListener('pointercancel', end)
    onEnd(e, e.type === 'pointercancel')
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', end)
  window.addEventListener('pointercancel', end)
}

export interface Sample {
  t: number
  x: number
  y: number
}

/** Release velocity in px/s from the last ~100ms of samples. */
export function releaseVelocity(samples: Sample[]): { vx: number; vy: number } {
  if (samples.length < 2) return { vx: 0, vy: 0 }
  const last = samples[samples.length - 1]
  let first = samples[0]
  for (const s of samples) {
    if (last.t - s.t <= 100) {
      first = s
      break
    }
  }
  const dt = Math.max(16, last.t - first.t) / 1000
  return { vx: (last.x - first.x) / dt, vy: (last.y - first.y) / dt }
}
