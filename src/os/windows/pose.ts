// A "pose" is the transform of a window/sheet surface relative to its real layout box (transform-origin: top left).
// Launch and close animations move between the identity pose and the pose that makes the surface sit on its icon.
import type { Transition } from 'motion/react'

export interface Pose {
  x: number
  y: number
  sx: number
  sy: number
  /** Visual corner radius in screen px (counter-scaled so it never stretches). */
  r: number
  o: number
}

export interface RectLike {
  left: number
  top: number
  width: number
  height: number
}

export function identityPose(r: number): Pose {
  return { x: 0, y: 0, sx: 1, sy: 1, r, o: 1 }
}

/** Pose that maps a box (in viewport coords) exactly onto `target`. */
export function poseOnto(target: RectLike, box: RectLike, r: number, o = 1): Pose {
  return {
    x: target.left - box.left,
    y: target.top - box.top,
    sx: target.width / Math.max(1, box.width),
    sy: target.height / Math.max(1, box.height),
    r,
    o,
  }
}

/** Fallback when the icon can't be seen: a slightly smaller, transparent copy around the box centre. */
export function centrePose(box: RectLike, scale: number, r: number): Pose {
  return {
    x: (box.width * (1 - scale)) / 2,
    y: (box.height * (1 - scale)) / 2 + 10,
    sx: scale,
    sy: scale,
    r,
    o: 0,
  }
}

/** Icon tile corner radius (matches AppIcon: ~23% of the tile). */
export function iconRadius(rect: RectLike): number {
  return Math.round(rect.width * 0.23)
}

/** The tinted "icon veil" is fully visible at icon size and gone by ~70% of full width. */
export function veilFor(sx: number): number {
  return Math.min(1, Math.max(0, (0.7 - sx) / 0.45))
}

/* ---------- transitions ---------- */

/** Out of the icon: a quick, lively spring with a hint of settle. */
export const launchSpring: Transition = { type: 'spring', visualDuration: 0.42, bounce: 0.14 }
/** Back into the icon: no overshoot, so it never pops past the tile. */
export const landSpring: Transition = { type: 'spring', visualDuration: 0.34, bounce: 0 }
/** Gesture abandoned: spring home with a soft micro-bounce. */
export const returnSpring: Transition = { type: 'spring', visualDuration: 0.38, bounce: 0.22 }
/** Maximize / restore / snap back inside the viewport. */
export const frameSpring: Transition = { type: 'spring', visualDuration: 0.36, bounce: 0.1 }
