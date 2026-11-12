import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { motion, useMotionValueEvent, usePresence } from 'motion/react'
import AppBody from './AppBody'
import LaunchVeil from './LaunchVeil'
import { CloseGlyph } from './controlGlyphs'
import { centrePose, iconRadius, identityPose, landSpring, launchSpring, poseOnto } from './pose'
import { usePose } from './usePose'
import { useWindowFocus } from './useWindowFocus'
import { windowTitleId } from './titleId'
import { useSheetGestures } from './useSheetGestures'
import type { Fling } from './useSheetGestures'
import { getApp } from '../apps/registry'
import { closeApp, getOpenApps, getVisibleIconRect } from '../store/windows'
import type { OpenApp } from '../store/windows'
import { haptic } from '../store/settings'
import { setSheetRaised } from '../store/ui'
import { useReducedMotionPref } from '../lib/useReducedMotionPref'
import { fadeFast } from '../lib/motion'

const RADIUS = 18
const MOBILE_GLYPH = Math.round(66 * 0.42) // glyph size on a phone icon tile

/**
 * A full-screen app on a phone. Zooms out of its icon, and closes back into it by swiping up from the home indicator
 * or dragging down from the top strip. Can be driven from outside by closing the app in the store.
 */
export default function MobileSheet({ app }: { app: OpenApp }) {
  const def = getApp(app.id)
  const reduced = useReducedMotionPref()
  const [isPresent, safeToRemove] = usePresence()
  const boxRef = useRef<HTMLDivElement>(null)
  useWindowFocus(boxRef, app.id)
  const flingRef = useRef<Fling | null>(null)
  const pose = usePose({ ...identityPose(RADIUS), o: 0 })

  const getBox = useCallback(() => {
    const r = boxRef.current?.getBoundingClientRect()
    return r ?? { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight }
  }, [])

  const onClose = useCallback(
    (fling: Fling) => {
      flingRef.current = fling
      haptic()
      closeApp(app.id)
    },
    [app.id],
  )

  const gestures = useSheetGestures({ pose, radius: RADIUS, reduced, getSize: getBox, onClose })

  // While the sheet's top edge rides above its box (swipe up, fly home), lift the window layer over the top bar so the
  // cream clock/icons never sit on the cream sheet. Purely geometric, so gestures and closes need no extra bookkeeping.
  useMotionValueEvent(pose.values.y, 'change', (y) => setSheetRaised(y < -0.5))
  useEffect(() => () => setSheetRaised(false), [])

  // Zoom out of the icon.
  const launched = useRef(false)
  useLayoutEffect(() => {
    if (launched.current) return // plays once per opening
    launched.current = true
    const box = getBox()
    if (reduced) {
      pose.set({ ...identityPose(RADIUS), o: 0 })
      void pose.to(identityPose(RADIUS), fadeFast)
      return
    }
    const icon = getVisibleIconRect(app.id)
    pose.set(icon ? poseOnto(icon, box, iconRadius(icon)) : centrePose(box, 0.9, RADIUS))
    void pose.to(identityPose(RADIUS), launchSpring, { opacity: { duration: icon ? 0.06 : 0.2 } })
  }, [app.id, getBox, pose, reduced])

  // Leaving: closed → fly back into the icon (carrying any flick velocity); backgrounded → just go.
  useEffect(() => {
    if (isPresent) return
    const done = () => safeToRemove?.()
    if (getOpenApps().some((a) => a.id === app.id)) {
      done()
      return
    }
    const box = getBox()
    const icon = getVisibleIconRect(app.id)
    const fling = flingRef.current
    flingRef.current = null
    if (reduced) {
      void pose.to({ ...pose.get(), o: 0 }, fadeFast).then(done)
      return
    }
    const velocity = fling ? { x: fling.vx * 0.3, y: fling.vy } : undefined
    if (icon) {
      void pose.to(poseOnto(icon, box, iconRadius(icon), 0), landSpring, { opacity: { duration: 0.1, delay: 0.26 }, velocity }).then(done)
    } else {
      void pose.to(centrePose(box, 0.86, RADIUS), landSpring, { opacity: { duration: 0.2 }, velocity }).then(done)
    }
  }, [isPresent, safeToRemove, app.id, getBox, pose, reduced])

  return (
    <div
      ref={boxRef}
      data-testid={`mobile-sheet-${app.id}`}
      data-os-window={app.id}
      role="dialog"
      aria-labelledby={windowTitleId(app.id)}
      tabIndex={-1}
      inert={!isPresent}
      className={`absolute inset-x-0 bottom-0 outline-none ${isPresent ? 'pointer-events-auto' : 'pointer-events-none'}`}
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 48px)', zIndex: app.z }}
    >
      <motion.section
        data-testid={`window-${app.id}`}
        className="os-sheet relative flex h-full w-full flex-col overflow-hidden bg-os-cream font-os-sans text-os-ink"
        style={{
          x: pose.values.x,
          y: pose.values.y,
          scaleX: pose.values.sx,
          scaleY: pose.values.sy,
          opacity: pose.values.o,
          borderRadius: pose.radius,
          originX: 0,
          originY: 0,
          willChange: 'transform',
        }}
      >
        <div
          data-testid={`mobile-top-strip-${app.id}`}
          onPointerDown={gestures.onStripPointerDown}
          className="relative z-10 flex h-9 shrink-0 items-center justify-center border-b border-os-ink/[0.08] bg-[#ebe3d8]"
          style={{ touchAction: 'none' }}
        >
          {/* The OS top bar already says where you are: the strip is just a grab handle + close. Title stays for AT. */}
          <h2 id={windowTitleId(app.id)} className="sr-only">
            {def.label}
          </h2>
          <span aria-hidden="true" className="block h-[4px] w-9 rounded-full bg-os-ink/20" />
          {/* 44×44 hit area anchored to the strip's top edge (never reaches up into the top bar); the × is drawn in
              the strip's centre line and the box reaches a few px below the strip. */}
          <button
            type="button"
            aria-label={`close ${def.label}`}
            data-testid={`window-close-${app.id}`}
            onClick={() => closeApp(app.id)}
            className="group absolute right-1 top-0 flex h-11 w-11 items-start justify-center pt-[6px] text-os-ink/70 outline-none"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-[8px] group-active:bg-os-ink/[0.08] group-focus-visible:ring-2 group-focus-visible:ring-os-ink/30">
              <CloseGlyph />
            </span>
          </button>
        </div>
        {/* z-0: its own stacking context, so nothing inside an app (e.g. a drawer) can cover the strip's close button. */}
        <div className="os-selectable relative z-0 min-h-0 flex-1 overflow-auto overscroll-contain">
          <AppBody app={app} isMobile />
        </div>
        <div
          data-testid="mobile-home-indicator"
          aria-hidden="true"
          onPointerDown={gestures.onIndicatorPointerDown}
          className="relative flex shrink-0 items-start justify-center bg-os-cream"
          style={{ touchAction: 'none', height: 'calc(env(safe-area-inset-bottom, 0px) + 44px)' }}
        >
          {/* In flow below the app body (never over it): a full 44px swipe zone; the pill sits low in it. */}
          <span className="mt-[24px] block h-[5px] w-[118px] rounded-full bg-os-ink/25" />
        </div>
        <LaunchVeil def={def} pose={pose} glyph={MOBILE_GLYPH} />
      </motion.section>
    </div>
  )
}
