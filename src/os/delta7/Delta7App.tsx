import { useCallback, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import './delta7.css'
import Header from './Header'
import Nav from './Nav'
import Drawer from './Drawer'
import OverviewView from './OverviewView'
import TunerView from './TunerView'
import { ArchiveView, FilesView, LogsView, MemoriesView, MessagesView } from './SectionViews'
import { bucketOf, decayPlan } from './decay'
import { useEscape } from './hooks'
import { useCoherence, useDecayLevel } from '../store/coherence'
import { useDay } from '../store/dev'
import { useElementSize } from '../lib/useElementSize'
import { useReducedMotionPref } from '../lib/useReducedMotionPref'
import { isD7View } from '../mock/delta7Content'
import type { D7View } from '../mock/delta7Content'
import type { AppParams, AppProps } from '../types'

const COMPACT_BELOW = 640

/**
 * Delta7 v0.14-rk — a homemade dashboard. Its look is driven by one value, `coherence`, via the pure
 * `decayPlan()`; the Tuner view is never touched by any of it.
 */
export default function Delta7App({ params, isMobile }: AppProps) {
  const { ref, width } = useElementSize<HTMLDivElement>()
  const compact = isMobile || (width > 0 && width < COMPACT_BELOW)

  const [view, setView] = useState<D7View>(() => (isD7View(params?.view) ? params.view : 'overview'))
  // `params` changed while open (e.g. the notification asks for the tuner): switch view. Adjusting state during render.
  const [seenParams, setSeenParams] = useState<AppParams | undefined>(params)
  if (params !== seenParams) {
    setSeenParams(params)
    const next = params?.view
    if (isD7View(next)) setView(next)
  }

  const [drawerOpen, setDrawerOpen] = useState(false)
  const closeDrawer = useCallback(() => setDrawerOpen(false), [])
  useEscape(compact && drawerOpen, closeDrawer)

  const coherence = useCoherence()
  const level = useDecayLevel()
  const day = useDay()
  const reduced = useReducedMotionPref()
  const seed = `d7:${day}`
  const bucket = bucketOf(coherence)
  const plan = useMemo(() => decayPlan(bucket, seed), [bucket, seed])

  const select = (v: D7View) => {
    setView(v)
    setDrawerOpen(false)
  }

  // Left-edge swipe opens the drawer (touch only).
  const swipe = useRef<{ x: number; y: number; id: number } | null>(null)
  const onEdgeDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    swipe.current = { x: e.clientX, y: e.clientY, id: e.pointerId }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onEdgeMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = swipe.current
    if (!s || s.id !== e.pointerId) return
    const dx = e.clientX - s.x
    if (dx > 32 && Math.abs(e.clientY - s.y) < dx) {
      swipe.current = null
      setDrawerOpen(true)
    }
  }
  const onEdgeEnd = () => {
    swipe.current = null
  }

  const wide = !compact
  const vp = { plan, wide }
  const nav = <Nav view={view} plan={plan} onSelect={select} day={day} />

  return (
    <div
      ref={ref}
      data-testid="d7-root"
      data-level={level}
      data-bucket={plan.bucket.toFixed(2)}
      data-compact={compact ? 'true' : 'false'}
      className={`d7 relative flex h-full w-full flex-col overflow-hidden font-os-sans ${reduced ? 'd7-reduced' : ''}`}
    >
      <Header compact={compact} drawerOpen={drawerOpen} onMenu={() => setDrawerOpen(true)} plan={plan} day={day} />
      <div className="relative flex min-h-0 flex-1">
        {wide ? <aside className="w-[164px] shrink-0 border-r border-[color:var(--d7-rule)] bg-[color:var(--d7-side)]">{nav}</aside> : null}
        <div className="relative min-h-0 min-w-0 flex-1">
          <main className="absolute inset-0 overflow-auto overscroll-contain" data-testid="d7-main" data-view={view}>
            {view === 'tuner' ? (
              <TunerView isMobile={isMobile} />
            ) : view === 'overview' ? (
              <OverviewView plan={plan} wide={wide} reduced={reduced} seed={seed} onNavigate={select} />
            ) : view === 'memories' ? (
              <MemoriesView {...vp} />
            ) : view === 'messages' ? (
              <MessagesView {...vp} />
            ) : view === 'files' ? (
              <FilesView {...vp} />
            ) : view === 'logs' ? (
              <LogsView {...vp} />
            ) : (
              <ArchiveView {...vp} />
            )}
          </main>
          {view !== 'tuner' ? (
            <>
              <div className="d7-grain d7-fx absolute inset-0 z-10" style={{ opacity: plan.grain }} aria-hidden="true" />
              <div className="d7-vignette d7-fx absolute inset-0 z-10" style={{ opacity: plan.vignette }} aria-hidden="true" />
            </>
          ) : null}
          {compact && isMobile && !drawerOpen ? (
            <div
              className="d7-edge absolute inset-y-0 left-0 z-20 w-4"
              aria-hidden="true"
              onPointerDown={onEdgeDown}
              onPointerMove={onEdgeMove}
              onPointerUp={onEdgeEnd}
              onPointerCancel={onEdgeEnd}
            />
          ) : null}
        </div>
      </div>
      {compact ? (
        <Drawer open={drawerOpen} reduced={reduced} onClose={closeDrawer}>
          {nav}
        </Drawer>
      ) : null}
    </div>
  )
}
