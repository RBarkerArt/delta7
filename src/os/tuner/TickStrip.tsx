import { useMemo, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { nudgeTuner, setTunerValue } from '../store/tuner'
import { FREQ_MAX, FREQ_MIN, stepOnGrid } from './tunerMath'
import { useTuneGestures } from './useTuneGestures'

const PAD = 24 // svg overhang past each end so end labels aren't clipped
const H = 60

function Ticks({ pxPerUnit }: { pxPerUnit: number }) {
  const width = (FREQ_MAX - FREQ_MIN) * pxPerUnit + PAD * 2
  const marks = useMemo(() => {
    const out: { x: number; kind: 0 | 1 | 2; label?: string }[] = []
    const steps = Math.round((FREQ_MAX - FREQ_MIN) * 100)
    for (let i = 0; i <= steps; i++) {
      const f = FREQ_MIN + i / 100
      const kind = i % 10 === 0 ? 2 : i % 5 === 0 ? 1 : 0
      out.push({ x: PAD + (i / 100) * pxPerUnit, kind, label: kind === 2 ? f.toFixed(1) : undefined })
    }
    return out
  }, [pxPerUnit])
  return (
    <svg width={width} height={H} className="block" aria-hidden="true" style={{ marginLeft: -PAD }}>
      {marks.map((m) => (
        <line
          key={m.x}
          x1={m.x}
          x2={m.x}
          y1={10}
          y2={10 + (m.kind === 2 ? 18 : m.kind === 1 ? 12 : 7)}
          stroke="#3A3034"
          strokeOpacity={m.kind === 2 ? 0.55 : m.kind === 1 ? 0.4 : 0.24}
          strokeWidth={1}
          shapeRendering="crispEdges"
        />
      ))}
      {marks.map((m) =>
        m.label ? (
          <text key={`l${m.x}`} x={m.x} y={46} textAnchor="middle" className="tuner-tick-label">
            {m.label}
          </text>
        ) : null,
      )}
    </svg>
  )
}

interface Props {
  value: number
  locked: boolean
  pxPerUnit: number
  ariaText: string
}

/** Ruled band that slides under a fixed needle. role="slider"; drag, flick, wheel, tap and keys all tune. */
export default function TickStrip({ value, locked, pxPerUnit, ariaText }: Props) {
  const [el, setEl] = useState<HTMLDivElement | null>(null)
  useTuneGestures(el, pxPerUnit)

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.altKey ? 0.001 : e.shiftKey ? 0.1 : 0.01
    let handled = true
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        setTunerValue(stepOnGrid(value, step, 1))
        break
      case 'ArrowLeft':
      case 'ArrowDown':
        setTunerValue(stepOnGrid(value, step, -1))
        break
      case 'PageUp':
        nudgeTuner(0.1)
        break
      case 'PageDown':
        nudgeTuner(-0.1)
        break
      case 'Home':
        setTunerValue(FREQ_MIN)
        break
      case 'End':
        setTunerValue(FREQ_MAX)
        break
      default:
        handled = false
    }
    if (handled) {
      e.preventDefault()
      e.stopPropagation()
    }
  }

  return (
    <div
      ref={setEl}
      role="slider"
      tabIndex={0}
      aria-label="frequency"
      aria-valuemin={FREQ_MIN}
      aria-valuemax={FREQ_MAX}
      aria-valuenow={Number(value.toFixed(3))}
      aria-valuetext={ariaText}
      aria-orientation="horizontal"
      data-testid="tuner-slider"
      data-value={value.toFixed(3)}
      onKeyDown={onKeyDown}
      className="tuner-strip relative shrink-0 cursor-grab select-none overflow-hidden rounded-[12px] outline-none active:cursor-grabbing focus-visible:ring-1 focus-visible:ring-os-ink/25"
      style={{ height: H + 8, touchAction: 'none' }}
    >
      <div className="tuner-strip-mask absolute inset-0">
        <div
          className="absolute left-1/2 top-1 will-change-transform"
          style={{ transform: `translate3d(${-(value - FREQ_MIN) * pxPerUnit}px, 0, 0)` }}
        >
          <Ticks pxPerUnit={pxPerUnit} />
        </div>
      </div>
      {/* Fixed needle; the warm copy fades in with the lock. */}
      <div className="pointer-events-none absolute bottom-[29px] top-[6px] left-1/2 -ml-[0.75px] w-[1.5px] rounded-full bg-os-ink/70" />
      <div
        className="pointer-events-none absolute bottom-[29px] top-[6px] left-1/2 -ml-[1px] w-[2px] rounded-full bg-[#B65A34] transition-opacity duration-700"
        style={{ opacity: locked ? 1 : 0 }}
      />
      <div className="pointer-events-none absolute left-1/2 top-[3px] -ml-[3.5px] h-[7px] w-[7px] rounded-full bg-os-ink/75" />
      <div
        className="pointer-events-none absolute left-1/2 top-[3px] -ml-[3.5px] h-[7px] w-[7px] rounded-full bg-[#B65A34] transition-opacity duration-700"
        style={{ opacity: locked ? 1 : 0 }}
      />
    </div>
  )
}
