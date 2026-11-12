import { useMemo } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { releaseVelocity, trackPointer } from './pointerTrack'
import type { Sample } from './pointerTrack'
import { identityPose, returnSpring } from './pose'
import type { Pose } from './pose'
import type { PoseController } from './usePose'
import { fadeFast } from '../lib/motion'

/** 'up' = swipe up from the home indicator; 'down' = drag down from the top strip. */
export type SheetGesture = 'up' | 'down'

export interface Fling {
  vx: number
  vy: number
}

/** Close when released past this share of the sheet height… */
export const CLOSE_DISTANCE = 0.22
/** …or when flicked toward closing faster than this (px/s). */
export const CLOSE_VELOCITY = 500
const START_SLOP = 4
const MIN_SCALE = 0.85

/**
 * Where the sheet sits while a finger drags it. The edge being held follows the finger 1:1 while the sheet shrinks
 * toward ~0.85 and its corners round off; pulling the wrong way only gives a little.
 */
export function dragPose(kind: SheetGesture, travel: number, dx: number, w: number, h: number, radius: number): Pose {
  const t = travel >= 0 ? travel : -18 * (1 - 1 / (-travel / 60 + 1))
  const d = Math.max(0, t) / h
  const s = 1 - (1 - MIN_SCALE) * (1 - Math.exp(-d * 3.4))
  const sw = w * s
  const sh = h * s
  const top = kind === 'up' ? h - t - sh : t
  return { x: (w - sw) / 2 + dx * 0.3, y: top, sx: s, sy: s, r: radius + 16 * Math.min(1, d * 2.6), o: 1 }
}

export function shouldClose(travel: number, towardVelocity: number, h: number): boolean {
  return travel > CLOSE_DISTANCE * h || (towardVelocity > CLOSE_VELOCITY && travel > 12)
}

interface Options {
  pose: PoseController
  radius: number
  reduced: boolean
  getSize: () => { width: number; height: number }
  onClose: (fling: Fling) => void
}

/** Finger-following close gestures for a mobile sheet. Only start on the strip / indicator (`touch-action: none`). */
export function useSheetGestures({ pose, radius, reduced, getSize, onClose }: Options) {
  return useMemo(() => {
    const begin = (kind: SheetGesture) => (e: ReactPointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      if ((e.target as Element).closest('button')) return
      e.preventDefault()
      const { width, height } = getSize()
      const x0 = e.clientX
      const y0 = e.clientY
      const samples: Sample[] = [{ t: e.timeStamp, x: x0, y: y0 }]
      let active = false
      let travel = 0
      trackPointer(
        e.pointerId,
        (ev) => {
          const dx = ev.clientX - x0
          const dy = ev.clientY - y0
          if (!active) {
            if (Math.abs(dx) < START_SLOP && Math.abs(dy) < START_SLOP) return
            active = true
            pose.stop()
          }
          travel = kind === 'up' ? -dy : dy
          pose.set(dragPose(kind, travel, dx, width, height, radius))
          samples.push({ t: ev.timeStamp, x: ev.clientX, y: ev.clientY })
          if (samples.length > 12) samples.shift()
        },
        (ev, cancelled) => {
          if (!active) return
          samples.push({ t: ev.timeStamp, x: ev.clientX, y: ev.clientY })
          const { vx, vy } = releaseVelocity(samples)
          const toward = kind === 'up' ? -vy : vy
          if (!cancelled && shouldClose(travel, toward, height)) {
            onClose({ vx, vy })
            return
          }
          void pose.to(identityPose(radius), reduced ? fadeFast : returnSpring, { velocity: { x: vx * 0.3, y: vy } })
        },
      )
    }
    return { onIndicatorPointerDown: begin('up'), onStripPointerDown: begin('down') }
  }, [pose, radius, reduced, getSize, onClose])
}
