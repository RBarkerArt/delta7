/** Canvas drawing for the tuner waveform. Pure apart from the canvas it is given. */

const TAU = Math.PI * 2

/** Cheap deterministic hash noise in [-1, 1]. */
function jitter(i: number, f: number): number {
  const s = Math.sin(i * 12.9898 + f * 78.233) * 43758.5453
  return (s - Math.floor(s)) * 2 - 1
}

/** Jitter interpolated between integer points: grainy, not needle-sharp. */
function softJitter(x: number, f: number): number {
  const i = Math.floor(x)
  const t = x - i
  return jitter(i, f) * (1 - t) + jitter(i + 1, f) * t
}

const WEAK =[150, 128, 132] // muted grey-rose
const WARM = [190, 92, 52] // warm red-amber

function mix(a: number[], b: number[], t: number): [number, number, number] {
  return [0, 1, 2].map((k) => Math.round(a[k] + (b[k] - a[k]) * t)) as [number, number, number]
}

export interface WaveFrame {
  /** CSS pixels. */
  width: number
  height: number
  /** Seconds of "signal time" (drives the hiss). */
  t: number
  /** Accumulated carrier phase (radians); see carrierSpeed(). */
  phase: number
  /** Smoothed lock strength 0..1. */
  strength: number
  /** Signed distance from 1.42 (MHz). */
  offset: number
  /** Jitter frame index: changes ~20×/s normally, slowly with reduced motion. */
  frame: number
}

/** Carrier phase speed (rad/s): restless off-lock, a slow calm roll at the lock. */
export function carrierSpeed(strength: number): number {
  return 0.55 + (1 - strength) ** 1.3 * 2.2
}

export function drawWave(ctx: CanvasRenderingContext2D, f: WaveFrame) {
  const { width: w, height: h, t, phase, strength: s, offset, frame } = f
  ctx.clearRect(0, 0, w, h)
  const mid = h / 2
  const pad = 14

  // Quiet centre line.
  ctx.strokeStyle = 'rgba(58, 48, 52, 0.08)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(pad, mid + 0.5)
  ctx.lineTo(w - pad, mid + 0.5)
  ctx.stroke()

  const noiseAmt = (1 - s) ** 0.8
  const amp = Math.min(h * 0.26, 76) * (1 + 0.22 * s)
  // Off-lock the carrier is detuned (more, faster cycles); at the lock it slows to ~2 calm cycles.
  const cycles = 2 + Math.min(6, Math.abs(offset) * 22)
  const n = Math.max(32, Math.floor((w - pad * 2) / 2))
  // Colour is held back until the very end: near → a hint of warmth, the lock → full red-amber.
  const [r, g, b] = mix(WEAK, WARM, Math.pow(s, 5))

  const trace = () => {
    ctx.beginPath()
    for (let i = 0; i <= n; i++) {
      const x = i / n
      const env = Math.pow(Math.sin(Math.PI * x), 0.6) // settles at both ends
      const clean = Math.sin(TAU * cycles * x - phase)
      const hiss =
        0.5 * Math.sin(TAU * 17 * x + t * 7.3) * Math.sin(TAU * 3.1 * x - t * 2.1) +
        0.3 * Math.sin(TAU * 41 * x - t * 13) +
        0.38 * softJitter(i / 3, frame)
      const y = mid - amp * env * ((1 - noiseAmt * 0.45) * clean + noiseAmt * hiss)
      const px = pad + x * (w - pad * 2)
      if (i === 0) ctx.moveTo(px, y)
      else ctx.lineTo(px, y)
    }
  }

  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  if (s > 0.88) {
    // Soft warm halo that only arrives with the lock.
    trace()
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.18 * ((s - 0.88) / 0.12)})`
    ctx.lineWidth = 7
    ctx.stroke()
  }
  trace()
  ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.7 + 0.3 * s})`
  ctx.lineWidth = 1.4 + 0.5 * s
  ctx.stroke()
}
