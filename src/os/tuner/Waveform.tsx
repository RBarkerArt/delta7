import { useEffect, useRef } from 'react'
import { useElementSize } from '../lib/useElementSize'
import { coherenceStore } from '../store/coherence'
import { tunerStore } from '../store/tuner'
import { TARGET, clarity } from './tunerMath'
import { carrierSpeed, drawWave } from './waveDraw'

const BAD_STRETCH_NOISE = 0.3

/**
 * The live trace. One rAF loop per mounted canvas, paused when the tab is hidden, the canvas is offscreen,
 * or the transport is paused (the trace freezes). Reads the store directly each frame (no React renders).
 */
export default function Waveform({ reduced }: { reduced: boolean }) {
  const { ref: boxRef, width, height } = useElementSize<HTMLDivElement>()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || width < 2 || height < 2) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const initial = tunerStore.get()
    let strength = initial.locked ? 1 : clarity(initial.value) * 0.9
    let offset = initial.locked ? 0 : initial.value - TARGET
    let noiseFloor = 0
    let t = 0
    let phase = 0
    let last = performance.now()
    let raf = 0
    let onScreen = true
    const timeScale = reduced ? 0.12 : 1

    const render = () =>
      drawWave(ctx, { width, height, t, phase, strength, offset, noiseFloor, frame: Math.floor(t * (reduced ? 1.5 : 20)) })

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const s = tunerStore.get()
      // Locked: the last bit of steadiness arrives only with the lock, then the trace settles slowly.
      const target = s.locked ? 1 : clarity(s.value) * 0.9
      const k = 1 - Math.exp(-dt * (s.locked ? 1.6 : 6))
      strength += (target - strength) * k
      offset += ((s.locked ? 0 : s.value - TARGET) - offset) * (1 - Math.exp(-dt * 8))
      // Bad stretch: the trace stays a little grainy however close you get, until the lock lands.
      const floorTarget = !s.locked && coherenceStore.get().badStretch ? BAD_STRETCH_NOISE : 0
      noiseFloor += (floorTarget - noiseFloor) * (1 - Math.exp(-dt * 2))
      t += dt * timeScale
      phase += dt * timeScale * carrierSpeed(strength)
      render()
      raf = requestAnimationFrame(tick)
    }

    const shouldRun = () =>
      document.visibilityState === 'visible' && onScreen && tunerStore.get().transport !== 'paused'
    const update = () => {
      const run = shouldRun()
      if (run && !raf) {
        last = performance.now()
        raf = requestAnimationFrame(tick)
      } else if (!run && raf) {
        cancelAnimationFrame(raf)
        raf = 0
      }
    }

    render()
    const io = new IntersectionObserver((entries) => {
      onScreen = entries.some((e) => e.isIntersecting)
      update()
    })
    io.observe(canvas)
    const unsub = tunerStore.subscribe(update)
    document.addEventListener('visibilitychange', update)
    update()
    return () => {
      cancelAnimationFrame(raf)
      raf = 0
      io.disconnect()
      unsub()
      document.removeEventListener('visibilitychange', update)
    }
  }, [width, height, reduced])

  return (
    <div ref={boxRef} className="tuner-wave relative h-full w-full">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
    </div>
  )
}
