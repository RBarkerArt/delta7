import { motionValue } from 'motion/react'

/** Continuous pager position in page units (0 = first page). Shared by the pager and wallpaper parallax. */
export const pagerProgress = motionValue(0)

/** Wallpaper parallax travel per page, in px. */
export const PARALLAX_PX = 36

/** Fling velocity (pages/s) handed from a swipe to the page-settle animation; consumed once. */
export const pagerHandoff = { velocity: 0 }
