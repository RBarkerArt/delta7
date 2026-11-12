import { motion, useTransform } from 'motion/react'
import WallpaperArt from './WallpaperArt'
import { PARALLAX_PX, pagerProgress } from '../shell/pagerMotion'
import { useSettings } from '../store/settings'
import { useReducedMotionPref } from '../lib/useReducedMotionPref'
import { useMediaQuery } from '../lib/useMediaQuery'

/**
 * Full-bleed wallpaper, slightly wider than the viewport; drifts a little as pages change (transform only).
 * `still`: not promoted to its own layer, so a filter over it (the lock screen's soft focus) is rasterised once
 * instead of being re-applied to the whole screen on every frame that anything else on screen changes.
 */
export default function Wallpaper({ still = false }: { still?: boolean }) {
  const name = useSettings((s) => s.wallpaper)
  const reduced = useReducedMotionPref()
  const portrait = useMediaQuery('(max-aspect-ratio: 1/1)')
  const x = useTransform(pagerProgress, (p) => (reduced ? 0 : -p * PARALLAX_PX))
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" data-wallpaper={name}>
      <motion.div className="absolute inset-y-0" style={{ left: -PARALLAX_PX * 1.5, right: -PARALLAX_PX * 1.5, x, willChange: still ? undefined : 'transform' }}>
        <WallpaperArt name={name} portrait={portrait} />
      </motion.div>
    </div>
  )
}
