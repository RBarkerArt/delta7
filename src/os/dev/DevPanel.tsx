import { useState } from 'react'
import type { ReactNode } from 'react'
import { levelFor } from '../store/coherenceMath'
import { setBadStretch, setCoherence, useBadStretch, useCoherence, useTunerLocked } from '../store/coherence'
import { showHeldNotification, showNotification, triggerPulse, useHasNew } from '../store/signal'
import { setClockOverride, useClockOverride } from '../store/clock'
import { WALLPAPER_NAMES, setWallpaper, useSettings } from '../store/settings'
import type { WallpaperName } from '../store/settings'
import { setForceMobile, useForceMobile } from '../store/device'
import { setDay, setDevOpen, useDay } from '../store/dev'
import { relock } from '../boot/lockState'
import { forgetFirstLock, useEverLocked } from '../store/tuner'

const field = 'rounded bg-white/10 px-1.5 py-0.5 text-[11px] text-white outline-none focus:ring-1 focus:ring-white/40'
const btn = 'rounded bg-white/10 px-2 py-0.5 text-[11px] hover:bg-white/20 focus-visible:ring-1 focus-visible:ring-white/50 outline-none'

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-3 py-[3px]">
      <span className="text-white/55">{label}</span>
      <span className="flex items-center gap-1.5">{children}</span>
    </label>
  )
}

/** Developer panel — deliberately NOT part of the OS look. Lazy-loaded; only when dev is enabled. */
export default function DevPanel() {
  const coherence = useCoherence()
  const badStretch = useBadStretch()
  const locked = useTunerLocked()
  const everLocked = useEverLocked()
  const hasNew = useHasNew()
  const override = useClockOverride()
  const wallpaper = useSettings((s) => s.wallpaper)
  const forceMobile = useForceMobile()
  const day = useDay()
  const [collapsed, setCollapsed] = useState(false)
  // Local slider value so dragging is smooth even though the store publishes ~4×/s.
  const [slider, setSlider] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)
  const [clockText, setClockText] = useState(override ?? '')
  const shown = slider ?? coherence

  return (
    <div
      data-testid="dev-panel"
      className="os-chrome fixed bottom-3 left-3 z-[2000] w-[248px] rounded-lg border border-white/10 bg-[rgba(18,16,20,0.82)] p-2.5 font-os-mono text-[11px] text-white/90 shadow-2xl backdrop-blur-sm"
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="text-white/50">dev · ` toggles</span>
        <span className="flex gap-1">
          <button type="button" className={btn} onClick={() => setCollapsed((c) => !c)} data-testid="dev-collapse" aria-label="collapse dev panel">
            {collapsed ? '+' : '–'}
          </button>
          <button type="button" className={btn} onClick={() => setDevOpen(false)} aria-label="close dev panel">
            ×
          </button>
        </span>
      </div>
      {collapsed ? null : (
        <div>
          <Row label="coherence">
            <span data-testid="dev-coherence-value">{shown.toFixed(2)}</span>
            <span className="text-white/50" data-testid="dev-level">{levelFor(shown)}</span>
          </Row>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={shown}
            data-testid="dev-coherence"
            aria-label="coherence"
            onPointerDown={() => setDragging(true)}
            onChange={(e) => {
              const v = Number(e.target.value)
              // Hold a local value only while the pointer is down; keyboard/scripted
              // changes read straight from the store so recovery stays visible.
              setSlider(dragging ? v : null)
              setCoherence(v)
            }}
            onPointerUp={() => {
              setDragging(false)
              setSlider(null)
            }}
            onPointerCancel={() => {
              setDragging(false)
              setSlider(null)
            }}
            onBlur={() => {
              setDragging(false)
              setSlider(null)
            }}
            className="mb-1 w-full accent-white/80"
          />
          <Row label="bad stretch">
            <input type="checkbox" checked={badStretch} onChange={(e) => setBadStretch(e.target.checked)} data-testid="dev-bad-stretch" />
          </Row>
          <Row label="tuner locked">
            <span data-testid="dev-tuner-locked" className={locked ? 'text-emerald-300' : 'text-white/50'}>
              {locked ? 'yes' : 'no'}
            </span>
          </Row>
          <Row label="first lock">
            <span data-testid="dev-ever-locked" className={everLocked ? 'text-emerald-300' : 'text-white/50'}>
              {everLocked ? 'yes' : 'no'}
            </span>
            <button type="button" className={btn} onClick={forgetFirstLock} data-testid="dev-forget-lock">
              forget
            </button>
          </Row>
          <Row label={`signal${hasNew ? ' · new' : ''}`}>
            <button type="button" className={btn} onClick={triggerPulse} data-testid="dev-pulse">
              pulse
            </button>
            <button type="button" className={btn} onClick={() => showNotification()} data-testid="dev-notify">
              notify
            </button>
            <button type="button" className={btn} onClick={() => showHeldNotification()} data-testid="dev-notify-held">
              held
            </button>
          </Row>
          <Row label="clock">
            <input
              type="text"
              inputMode="numeric"
              placeholder="HH:MM"
              value={clockText}
              maxLength={5}
              data-testid="dev-clock"
              onChange={(e) => {
                setClockText(e.target.value)
                setClockOverride(e.target.value.trim() || null)
              }}
              className={`${field} w-[64px]`}
            />
          </Row>
          <Row label="wallpaper">
            <select
              value={wallpaper}
              data-testid="dev-wallpaper"
              onChange={(e) => setWallpaper(e.target.value as WallpaperName)}
              className={`${field} bg-[#2a262c]`}
            >
              {WALLPAPER_NAMES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Row>
          <Row label="lock screen">
            <button type="button" className={btn} onClick={relock} data-testid="dev-lock">
              lock
            </button>
          </Row>
          <Row label="force mobile">
            <input type="checkbox" checked={forceMobile} onChange={(e) => setForceMobile(e.target.checked)} data-testid="dev-force-mobile" />
          </Row>
          <Row label="day (mock)">
            <input
              type="number"
              min={1}
              value={day}
              data-testid="dev-day"
              onChange={(e) => setDay(Number(e.target.value))}
              className={`${field} w-[64px]`}
            />
          </Row>
        </div>
      )}
    </div>
  )
}
