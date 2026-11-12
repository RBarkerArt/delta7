import type { Transition } from 'motion/react'

/** Shared spring presets. Use these instead of ad-hoc transitions. */
export const springs = {
  /** Presses, toggles, small UI responses. */
  snappy: { type: 'spring', stiffness: 520, damping: 34, mass: 0.7 },
  /** Paging, panels, sheets. */
  soft: { type: 'spring', stiffness: 260, damping: 32, mass: 1 },
  /** Slow ambient settles (wallpaper parallax, large surfaces). */
  gentle: { type: 'spring', stiffness: 120, damping: 26, mass: 1.2 },
} as const satisfies Record<string, Transition>

/** Reduced-motion replacement: a short fade/settle. */
export const fadeFast = { type: 'tween', duration: 0.16, ease: 'easeOut' } as const satisfies Transition

export function pickTransition(reduced: boolean, spring: Transition): Transition {
  return reduced ? fadeFast : spring
}
