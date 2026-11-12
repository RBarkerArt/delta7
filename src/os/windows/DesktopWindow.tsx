import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { motion, useMotionValue, usePresence } from 'motion/react'
import AppBody from './AppBody'
import LaunchVeil from './LaunchVeil'
import ResizeHandles from './ResizeHandles'
import TitleBar from './TitleBar'
import { clampFrame, initialFrame, loadFrame, maximizedFrame, saveFrame, viewport } from './frames'
import type { Frame } from './frames'
import { registerLiveFrame, visibleFramesExcept } from './liveFrames'
import { placeWindow } from './placement'
import { centrePose, iconRadius, identityPose, landSpring, launchSpring, poseOnto } from './pose'
import { usePose } from './usePose'
import { takeFocusOnPointer, useWindowFocus } from './useWindowFocus'
import { windowTitleId } from './titleId'
import { animateFrame, readFrame, settledFrame, stopFrame, useFrameGestures, writeFrame } from './useFrameGestures'
import type { FrameValues } from './useFrameGestures'
import { getApp } from '../apps/registry'
import { closeApp, focusApp, getVisibleIconRect, minimizeApp, onResetWindowPositions } from '../store/windows'
import type { OpenApp } from '../store/windows'
import { useReducedMotionPref } from '../lib/useReducedMotionPref'
import { fadeFast } from '../lib/motion'

const RADIUS = 16
const DESKTOP_GLYPH = Math.round(112 * 0.42) // glyph size on a desktop icon tile

interface Props {
  app: OpenApp
  focused: boolean
  /** Position among open windows; the default slot "Reset window positions" sends this window back to. */
  cascadeIndex: number
}

function boxOf(f: FrameValues) {
  return { left: f.x.get(), top: f.y.get(), width: f.w.get(), height: f.h.get() }
}

/** A desktop window: grows out of its icon, drags, resizes, maximizes, minimizes back into its icon. */
export default function DesktopWindow({ app, focused, cascadeIndex }: Props) {
  const def = getApp(app.id)
  const reduced = useReducedMotionPref()
  const [isPresent, safeToRemove] = usePresence()
  const [init] = useState(() => {
    // Placed relative to the windows already open, so it never lands fully over (or under) one of them.
    const vp = viewport()
    const saved = placeWindow(def, loadFrame(def.id), initialFrame(def, 0, vp), visibleFramesExcept(app.id), vp)
    return { saved, start: saved.maximized ? maximizedFrame(vp) : saved }
  })
  const [maximized, setMaximizedState] = useState(init.saved.maximized)
  const maxRef = useRef(init.saved.maximized)
  const restoreRef = useRef<Frame | null>(init.saved.maximized ? init.saved : null)

  const fx = useMotionValue(init.start.x)
  const fy = useMotionValue(init.start.y)
  const fw = useMotionValue(init.start.w)
  const fh = useMotionValue(init.start.h)
  const [frame] = useState<FrameValues>(() => ({ x: fx, y: fy, w: fw, h: fh }))
  const pose = usePose({ ...identityPose(RADIUS), o: 0 })
  const sectionRef = useRef<HTMLElement>(null)
  useWindowFocus(sectionRef, app.id)
  useEffect(() => registerLiveFrame(app.id, () => readFrame(frame)), [app.id, frame])

  const setMaximized = useCallback((v: boolean) => {
    maxRef.current = v
    setMaximizedState(v)
  }, [])

  const commit = useCallback(() => {
    const restore = restoreRef.current
    if (maxRef.current && restore) saveFrame(app.id, { ...restore, maximized: true })
    else saveFrame(app.id, { ...readFrame(frame), maximized: false })
  }, [app.id, frame])

  const maximizedRestore = useCallback(() => (maxRef.current ? restoreRef.current : null), [])
  const leaveMaximized = useCallback(() => {
    restoreRef.current = null
    setMaximized(false)
  }, [setMaximized])

  const gestures = useFrameGestures(
    { frame, minSize: def.minSize, maximizedRestore, leaveMaximized, commit },
    reduced,
  )

  const toggleMaximize = useCallback(() => {
    const vp = viewport()
    if (maxRef.current) {
      const to = clampFrame(restoreRef.current ?? initialFrame(def, 0, vp), def.minSize, vp)
      restoreRef.current = null
      setMaximized(false)
      void animateFrame(frame, to, reduced).then(commit)
    } else {
      restoreRef.current = settledFrame(frame)
      setMaximized(true)
      void animateFrame(frame, maximizedFrame(vp), reduced).then(commit)
    }
  }, [def, frame, reduced, commit, setMaximized])

  // Launch out of the icon on mount and on restore; fly back into it on minimize.
  const lastMinimized = useRef<boolean | null>(null)
  useLayoutEffect(() => {
    if (lastMinimized.current === app.minimized) return
    lastMinimized.current = app.minimized
    const box = boxOf(frame)
    const icon = getVisibleIconRect(app.id)
    if (app.minimized) {
      if (reduced) void pose.to({ ...pose.get(), o: 0 }, fadeFast)
      else if (icon) void pose.to(poseOnto(icon, box, iconRadius(icon), 0), landSpring, { opacity: { duration: 0.12, delay: 0.22 } })
      else void pose.to(centrePose(box, 0.92, RADIUS), landSpring, { opacity: { duration: 0.18 } })
      return
    }
    const cur = pose.get()
    const midFlight = cur.o > 0.05 && Math.abs(cur.sx - 1) > 0.01
    if (reduced) {
      pose.set({ ...identityPose(RADIUS), o: midFlight ? cur.o : 0 })
      void pose.to(identityPose(RADIUS), fadeFast)
      return
    }
    if (!midFlight) pose.set(icon ? poseOnto(icon, box, iconRadius(icon)) : centrePose(box, 0.94, RADIUS))
    void pose.to(identityPose(RADIUS), launchSpring, { opacity: { duration: icon ? 0.08 : 0.2 } })
  }, [app.minimized, app.id, frame, pose, reduced])

  // Close: reverse into the icon, then let AnimatePresence remove us.
  useEffect(() => {
    if (isPresent) return
    const box = boxOf(frame)
    const icon = getVisibleIconRect(app.id)
    const done = () => safeToRemove?.()
    if (reduced) void pose.to({ ...pose.get(), o: 0 }, fadeFast).then(done)
    else if (icon) void pose.to(poseOnto(icon, box, iconRadius(icon), 0), landSpring, { opacity: { duration: 0.1, delay: 0.24 } }).then(done)
    else void pose.to(centrePose(box, 0.92, RADIUS), landSpring, { opacity: { duration: 0.16 } }).then(done)
  }, [isPresent, safeToRemove, app.id, frame, pose, reduced])

  // Menu → "Reset window positions": saved frames are already gone; spring back to the default cascade, un-maximized.
  // Nothing is saved here, so the defaults stay un-remembered until the user moves the window again.
  const cascadeRef = useRef(cascadeIndex)
  useEffect(() => {
    cascadeRef.current = cascadeIndex
  }, [cascadeIndex])
  useEffect(
    () =>
      onResetWindowPositions(() => {
        const to = initialFrame(def, cascadeRef.current, viewport())
        restoreRef.current = null
        setMaximized(false)
        if (app.minimized) writeFrame(frame, to)
        else void animateFrame(frame, to, reduced)
      }),
    [def, frame, reduced, setMaximized, app.minimized],
  )

  // Keep the window inside the viewport whenever the viewport changes: its whole title bar, controls included, stays in
  // view and under the top bar. A spring still in flight is stopped first (it would otherwise carry on to an
  // off-screen target), and a maximized window's restore frame is clamped too.
  useEffect(() => {
    const onResize = () => {
      const vp = viewport()
      const to = maxRef.current ? maximizedFrame(vp) : clampFrame(settledFrame(frame), def.minSize, vp)
      stopFrame(frame)
      writeFrame(frame, to)
      if (restoreRef.current) restoreRef.current = clampFrame(restoreRef.current, def.minSize, vp)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [frame, def.minSize])

  // Hidden (minimized / closing): the frame follows the surface's fade too, so a parked window is truly invisible.
  const hidden = app.minimized || !isPresent
  return (
    <motion.section
      ref={sectionRef}
      data-testid={`window-${app.id}`}
      data-os-window={app.id}
      data-focused={focused && !hidden ? 'true' : 'false'}
      data-maximized={maximized ? 'true' : 'false'}
      data-minimized={app.minimized ? 'true' : 'false'}
      role="dialog"
      aria-labelledby={windowTitleId(app.id)}
      tabIndex={-1}
      inert={hidden}
      onPointerDownCapture={() => {
        if (hidden) return
        focusApp(app.id)
        takeFocusOnPointer(sectionRef.current)
      }}
      className={`absolute left-0 top-0 outline-none ${hidden ? 'pointer-events-none' : 'pointer-events-auto'}`}
      style={{ x: fx, y: fy, width: fw, height: fh, zIndex: app.z, opacity: hidden ? pose.values.o : 1 }}
    >
      {/* The frame carries the pose (launch / minimize) and the two static shadow layers; the panel inside clips. */}
      <motion.div
        className={`os-window-frame relative h-full w-full ${focused ? 'is-focused' : ''}`}
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
          className={`relative flex h-full w-full flex-col overflow-hidden bg-os-cream font-os-sans text-os-ink ${focused ? 'os-window' : 'os-window os-window-idle'}`}
          style={{ borderRadius: 'inherit' }}
        >
          <TitleBar
            def={def}
            focused={focused}
            maximized={maximized}
            onPointerDown={gestures.onTitlePointerDown}
            onToggleMaximize={toggleMaximize}
            onMinimize={() => minimizeApp(app.id)}
            onClose={() => closeApp(app.id)}
          />
          <div className="os-selectable relative min-h-0 flex-1 overflow-auto overscroll-contain">
            <AppBody id={app.id} params={app.params} isMobile={false} visible={!hidden} />
          </div>
          <LaunchVeil def={def} pose={pose} glyph={DESKTOP_GLYPH} />
        </div>
      </motion.div>
      {!maximized && !hidden ? <ResizeHandles appId={app.id} onEdgePointerDown={gestures.onEdgePointerDown} /> : null}
    </motion.section>
  )
}
