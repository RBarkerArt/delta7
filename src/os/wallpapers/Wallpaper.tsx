import { motion, useTransform } from 'motion/react'
import WallpaperArt from './WallpaperArt'
import { PARALLAX_PX, pagerProgress } from '../shell/pagerMotion'
import { useSettings } from '../store/settings'
import { useReducedMotionPref } from '../lib/useReducedMotionPref'
import { useMediaQuery } from '../lib/useMediaQuery'

/** Full-bleed wallpaper, slightly wider than the viewport; drifts a little as pages change (transform only). */
export default function Wallpaper() {
  const name = useSettings((s) => s.wallpaper)
  const reduced = useReducedMotionPref()
  const portrait = useMediaQuery('(max-aspect-ratio: 1/1)')
  const x = useTransform(pagerProgress, (p) => (reduced ? 0 : -p * PARALLAX_PX))
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" data-wallpaper={name}>
      <motion.div className="absolute inset-y-0" style={{ left: -PARALLAX_PX * 1.5, right: -PARALLAX_PX * 1.5, x, willChange: 'transform' }}>
        <WallpaperArt name={name} portrait={portrait} />
      </motion.div>
    </div>
  )
}
