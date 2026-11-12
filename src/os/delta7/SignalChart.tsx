import { useEffect, useRef } from 'react'
import { seeded } from '../lib/seeded'
import { watchOnScreen } from '../lib/watchOnScreen'
import { useAppVisible } from '../windows/appVisibility'
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
const FRAME_MS = 1000 / 30 // ~30fps is plenty for a slow trace
/** The backing store grows in steps of this many CSS px (and never shrinks), so resizing rarely reallocates it. */
const SLACK_PX = 128

interface Props {
  fx: ChartFx
  reduced: boolean
  seed: string
  /** The panel's soft-type blur, applied to the trace itself (the panel around the canvas is never filtered). */
  blurPx?: number
}

/**
 * A slow, slightly noisy trace on a canvas. Decay makes it stutter (frames freeze, then jump), flatten and
 * drop segments. Reduced motion: one static frame. Draws at its own ~30fps (no frame requested in between), and not at
 * all while its window is minimized, the tab is hidden or the canvas is off screen. Its size comes from its own
 * ResizeObserver (no layout reads while drawing).
 */
export default function SignalChart({ fx, reduced, seed, blurPx = 0 }: Props) {
  const boxRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fxRef = useRef(fx)
  const blurRef = useRef(blurPx)
  const appVisible = useAppVisible()
  const visibleRef = useRef(appVisible)
  const ctlRef = useRef<{ redraw: () => void; update: () => void } | null>(null)

  useEffect(() => {
    fxRef.current = fx
    blurRef.current = blurPx
    ctlRef.current?.redraw()
  }, [fx, blurPx])

  useEffect(() => {
    visibleRef.current = appVisible
    ctlRef.current?.update()
  }, [appVisible])

  useEffect(() => {
    const box = boxRef.current
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!box || !canvas || !ctx) return
    const rnd = seeded(`${seed}:chart`)
    let w = 0
    let h = 0
    let dpr = 1
    let lastT = reduced ? 4 : performance.now() / 1000
    let timer: ReturnType<typeof setTimeout> | null = null
    let running = false
    let shown = true

    const draw = (t: number) => {
      lastT = t
      if (w === 0 || h === 0) return
      const f = fxRef.current
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const blur = blurRef.current
      if (blur > 0) ctx.filter = `blur(${blur}px)`
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
      if (blur > 0) ctx.filter = 'none'
    }

    // One frame every FRAME_MS on a plain timer (no animation frames requested at all: the canvas shows the new frame
    // at the next paint); a stutter holds the current frame for a few frames, then the trace jumps on.
    let due = 0
    const step = () => {
      timer = null
      if (!running) return
      const now = performance.now()
      let hold = 0
      const s = fxRef.current.stutter
      if (s > 0 && rnd() < s * 0.07) hold = 3 + Math.floor(rnd() * 16 * s)
      draw(now / 1000)
      // Keep an even beat; after a long stall (a busy main thread), start counting again from now.
      due = Math.max(due + FRAME_MS * (1 + hold), now + FRAME_MS / 2)
      timer = setTimeout(step, due - now)
    }
    const halt = () => {
      if (timer) clearTimeout(timer)
      timer = null
    }
    const update = () => {
      const run = !reduced && visibleRef.current && shown
      if (run === running) return
      running = run
      if (run) {
        due = performance.now()
        step()
      } else halt()
    }

    // Size from the observer only (no layout reads while drawing). The canvas sits at the top-left of its clipping box
    // with a backing store a little larger than needed, so a resize mostly just changes the drawn width: the store is
    // reallocated (and redrawn at once, so it never shows blank) only when it has to grow. Otherwise the running loop
    // picks the new size up on its next frame.
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect
      if (!r) return
      const nextDpr = Math.min(2, window.devicePixelRatio || 1)
      if (r.width === w && r.height === h && nextDpr === dpr) return
      w = r.width
      h = r.height
      let grown = false
      if (nextDpr !== dpr || canvas.width < Math.ceil(w * nextDpr) || canvas.height < Math.ceil(h * nextDpr)) {
        dpr = nextDpr
        const cw = Math.ceil(w / SLACK_PX) * SLACK_PX
        const ch = Math.ceil(h / SLACK_PX) * SLACK_PX
        canvas.width = Math.round(cw * dpr)
        canvas.height = Math.round(ch * dpr)
        canvas.style.width = `${cw}px`
        canvas.style.height = `${ch}px`
        grown = true
      }
      if (grown || !running) draw(lastT)
    })
    ro.observe(box)
    const unwatch = watchOnScreen(box, (on) => {
      shown = on
      update()
    })
    ctlRef.current = { redraw: () => draw(lastT), update }
    update()
    return () => {
      running = false
      halt()
      ro.disconnect()
      unwatch()
      ctlRef.current = null
    }
  }, [reduced, seed])

  return (
    <div ref={boxRef} className="relative h-full w-full overflow-hidden">
      <canvas ref={canvasRef} className="absolute left-0 top-0 block" aria-hidden="true" data-testid="d7-chart" />
    </div>
  )
}
