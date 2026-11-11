import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { motion, useMotionValue, usePresence } from 'motion/react'
import AppBody from './AppBody'
import LaunchVeil from './LaunchVeil'
import ResizeHandles from './ResizeHandles'
import TitleBar from './TitleBar'
import { clampFrame, initialFrame, maximizedFrame, saveFrame, viewport } from './frames'
import type { Frame } from './frames'
import { centrePose, iconRadius, identityPose, landSpring, launchSpring, poseOnto } from './pose'
import { usePose } from './usePose'
import { animateFrame, readFrame, useFrameGestures, writeFrame } from './useFrameGestures'
import type { FrameValues } from './useFrameGestures'
import { getApp } from '../apps/registry'
import { closeApp, focusApp, getVisibleIconRect, minimizeApp } from '../store/windows'
import type { OpenApp } from '../store/windows'
import { useReducedMotionPref } from '../lib/useReducedMotionPref'
import { fadeFast } from '../lib/motion'

const RADIUS = 16
const DESKTOP_GLYPH = Math.round(112 * 0.42) // glyph size on a desktop icon tile

interface Props {
  app: OpenApp
  focused: boolean
  /** Position among open windows at mount; only used to cascade a window that has no remembered frame. */
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
    const vp = viewport()
    const saved = initialFrame(def, cascadeIndex, vp)
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
      restoreRef.current = readFrame(frame)
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

  // Keep the window inside the viewport when the viewport changes.
  useEffect(() => {
    const onResize = () => {
      const vp = viewport()
      writeFrame(frame, maxRef.current ? maximizedFrame(vp) : clampFrame(readFrame(frame), def.minSize, vp))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [frame, def.minSize])

  const hidden = app.minimized || !isPresent
  return (
    <motion.section
      data-testid={`window-${app.id}`}
      data-os-window={app.id}
      data-focused={focused && !hidden ? 'true' : 'false'}
      data-maximized={maximized ? 'true' : 'false'}
      data-minimized={app.minimized ? 'true' : 'false'}
      aria-label={def.label}
      inert={hidden}
      onPointerDownCapture={() => {
        if (!hidden) focusApp(app.id)
      }}
      className={`absolute left-0 top-0 ${hidden ? 'pointer-events-none' : 'pointer-events-auto'}`}
      style={{ x: fx, y: fy, width: fw, height: fh, zIndex: app.z }}
    >
      <motion.div
        className={`relative flex h-full w-full flex-col overflow-hidden bg-os-cream font-os-sans text-os-ink ${focused ? 'os-window' : 'os-window os-window-idle'}`}
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
          <AppBody app={app} isMobile={false} />
        </div>
        <LaunchVeil def={def} pose={pose} glyph={DESKTOP_GLYPH} />
      </motion.div>
      {!maximized && !hidden ? <ResizeHandles appId={app.id} onEdgePointerDown={gestures.onEdgePointerDown} /> : null}
    </motion.section>
  )
}
