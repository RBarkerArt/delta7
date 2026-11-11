import { useEffect, useRef } from 'react'
import { seeded } from '../lib/seeded'
import type { ChartFx } from './decay'

/** Deterministic value noise in [-1, 1] from an integer. */
function hashNoise(i: number): number {
  const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453
  return (s - Math.floor(s)) * 2 - 1
}
function smoothNoise(x: number): number {
  const i = Math.floor(x)
  const f = x - i
  const u = f * f * (3 - 2 * f)
  return hashNoise(i) * (1 - u) + hashNoise(i + 1) * u
}

const SPAN = 9 // world units across the chart
const SPEED = 0.35 // world units per second — slow

interface Props {
  fx: ChartFx
  reduced: boolean
  seed: string
}

/**
 * A slow, slightly noisy trace on a canvas. Decay makes it stutter (frames freeze, then jump), flatten and
 * drop segments. Reduced motion: one static frame.
 */
export default function SignalChart({ fx, reduced, seed }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fxRef = useRef(fx)
  const redrawRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    fxRef.current = fx
    redrawRef.current?.()
  }, [fx])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const rnd = seeded(`${seed}:chart`)
    let raf = 0
    let frame = 0
    let hold = 0
    let lastT = 0

    const draw = (t: number) => {
      lastT = t
      const f = fxRef.current
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (w === 0 || h === 0) return
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr)
        canvas.height = Math.round(h * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      const mid = h * 0.55

      // one faint baseline (no grid)
      ctx.strokeStyle = 'rgba(58, 48, 52, 0.14)'
      ctx.lineWidth = 1
      ctx.setLineDash([2, 4])
      ctx.beginPath()
      ctx.moveTo(0, Math.round(mid) + 0.5)
      ctx.lineTo(w, Math.round(mid) + 0.5)
      ctx.stroke()
      ctx.setLineDash([])

      const off = t * SPEED
      const yAt = (px: number) => {
        const x = (px / w) * SPAN + off
        const v =
          Math.sin(x * 0.9) * 0.42 +
          Math.sin(x * 2.3 + 1.1) * 0.18 +
          smoothNoise(x * 3.1) * (0.1 + f.noise * 0.35) +
          smoothNoise(x * 11) * f.noise * 0.12
        return mid - v * f.amp * h * 0.36
      }

      // Contiguous runs of the trace (segments drop out when decayed).
      const runs: number[][] = []
      let run: number[] | null = null
      for (let px = 0; px <= w + 2; px += 3) {
        const seg = Math.floor(((px / w) * SPAN + off) * 2.2)
        const gone = f.gaps > 0 && (hashNoise(seg * 7.13) + 1) / 2 < f.gaps
        if (gone) run = null
        else {
          if (!run) runs.push((run = []))
          run.push(px)
        }
      }

      // The trace loses its warmth as it weakens: rose → dusty grey.
      const k = Math.max(0, Math.min(1, (f.noise - 0.12) / 0.38)) * 0.85
      const rgb = [155 + (143 - 155) * k, 94 + (130 - 94) * k, 94 + (135 - 94) * k].map(Math.round).join(', ')

      // Soft fill under a healthy trace; once segments drop out, only the broken line remains.
      ctx.fillStyle = `rgba(${rgb}, 0.08)`
      if (f.gaps === 0) for (const r of runs) {
        if (r.length < 2) continue
        ctx.beginPath()
        ctx.moveTo(r[0], h)
        for (const px of r) ctx.lineTo(px, yAt(px))
        ctx.lineTo(r[r.length - 1], h)
        ctx.closePath()
        ctx.fill()
      }

      ctx.strokeStyle = `rgb(${rgb})`
      ctx.lineWidth = 1.5
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.beginPath()
      for (const r of runs) {
        r.forEach((px, i) => (i ? ctx.lineTo(px, yAt(px)) : ctx.moveTo(px, yAt(px))))
      }
      ctx.stroke()
    }

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      frame++
      if (frame % 2) return // ~30fps is plenty for a slow trace
      if (hold > 0) {
        hold--
        return
      }
      const s = fxRef.current.stutter
      if (s > 0 && rnd() < s * 0.07) hold = 3 + Math.floor(rnd() * 16 * s)
      draw(now / 1000)
    }

    const ro = new ResizeObserver(() => draw(lastT))
    ro.observe(canvas)
    redrawRef.current = () => draw(lastT)
    if (reduced) draw(4)
    else raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      redrawRef.current = null
    }
  }, [reduced, seed])

  return <canvas ref={canvasRef} className="block h-full w-full" aria-hidden="true" data-testid="d7-chart" />
}
