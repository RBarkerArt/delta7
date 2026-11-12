// In-OS only; never the browser Notification API. Quiet: no sound, never opens anything by itself.
import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { PanInfo } from 'motion/react'
import { X } from 'lucide-react'
import { WaveGlyph } from './glyphs'
import { dismissNotification, useNotification } from '../store/signal'
import { openApp } from '../store/windows'
import { useIsMobile } from '../store/device'
import { useReducedMotionPref } from '../lib/useReducedMotionPref'
import { fadeFast, springs } from '../lib/motion'

const AUTO_HIDE_MS = 12_000

/**
 * Small cream banner under the top bar (top-right on desktop, centred on mobile). Tapping it opens
 * Delta7 on the tuner view. Auto-hides after ~12s; the Delta7 icon keeps pulsing (hasNew is untouched).
 */
export default function NotificationBanner() {
  const n = useNotification()
  const isMobile = useIsMobile()
  const reduced = useReducedMotionPref()
  const dragged = useRef(false)

  useEffect(() => {
    if (!n) return
    // A newer notification replaces `n`, which clears this timer and starts a fresh one.
    const timer = setTimeout(dismissNotification, AUTO_HIDE_MS)
    return () => clearTimeout(timer)
  }, [n])

  const open = () => {
    if (dragged.current) return
    openApp('delta7', { view: 'tuner' })
    dismissNotification()
  }

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y < -28 || info.velocity.y < -350) dismissNotification()
    // Let the click that ends a drag pass without opening.
    setTimeout(() => {
      dragged.current = false
    }, 0)
  }

  const hidden = reduced ? { opacity: 0 } : { opacity: 0, y: -14, scale: 0.98 }
  const shown = reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none absolute z-[900] flex ${
        isMobile ? 'inset-x-0 top-[54px] justify-center px-3' : 'right-4 top-[70px] justify-end'
      }`}
      style={{ marginTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <AnimatePresence>
        {n ? (
          <motion.div
            key={n.id}
            data-testid="os-notification"
            className="os-panel pointer-events-auto flex w-[min(340px,100%)] items-center rounded-[14px] font-os-sans text-os-ink"
            initial={hidden}
            animate={shown}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.98 }}
            transition={reduced ? fadeFast : springs.soft}
            drag={isMobile && !reduced ? 'y' : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.6, bottom: 0.08 }}
            dragSnapToOrigin
            onDragStart={() => {
              dragged.current = true
            }}
            onDragEnd={onDragEnd}
          >
            <button
              type="button"
              onClick={open}
              aria-label={`${n.text}. open delta7 tuner`}
              className="flex min-h-[48px] min-w-0 flex-1 items-center gap-3 rounded-[13px] py-2.5 pl-3.5 pr-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-os-ink/30"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-os-plum text-os-cream/95">
                <WaveGlyph size={16} strokeWidth={1.5} />
              </span>
              {/* Wraps instead of truncating, so longer copy never pushes the dismiss control out of the banner. */}
              <span className="min-w-0 flex-1 font-os-mono text-[12.5px] leading-snug tracking-[0.01em] text-os-ink/90">{n.text}</span>
            </button>
            <button
              type="button"
              aria-label="dismiss"
              data-testid="os-notification-dismiss"
              onClick={() => dismissNotification()}
              className="os-tap mr-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] os-text-soft outline-none hover:bg-os-ink/[0.06] focus-visible:ring-2 focus-visible:ring-os-ink/30"
            >
              <X size={15} strokeWidth={1.5} />
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
