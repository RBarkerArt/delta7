import { motion } from 'motion/react'
import type { PoseController } from './usePose'
import type { AppDefinition } from '../types'

interface Props {
  def: AppDefinition
  pose: PoseController
  /** Glyph size on the icon tile, so the veil looks like the icon at the start of a launch. */
  glyph: number
}

/**
 * The icon's tint + glyph laid over a launching surface. Fully opaque at icon size and gone by ~60% width, so the
 * window/sheet reads as the icon itself growing (shared-element feel). The glyph is counter-scaled to stay crisp.
 */
export default function LaunchVeil({ def, pose, glyph }: Props) {
  const stroke = (1.7 * 24) / glyph
  return (
    <motion.div
      aria-hidden="true"
      className="os-tile pointer-events-none absolute inset-0 z-20"
      style={{
        // Solid (unlike the slightly translucent home tile) so the cream surface underneath doesn't wash it out.
        background: `linear-gradient(180deg, rgba(255,244,232,0.06) 0%, rgba(255,244,232,0) 45%, rgba(40,20,28,0.08) 100%), ${def.tint}`,
        opacity: pose.veil,
        borderRadius: 'inherit',
      }}
    >
      <div className="absolute left-1/2 top-1/2 h-0 w-0">
        <motion.div
          className="absolute flex items-center justify-center text-os-cream"
          style={{
            left: -glyph / 2,
            top: -glyph / 2,
            width: glyph,
            height: glyph,
            scaleX: pose.invSx,
            scaleY: pose.invSy,
          }}
        >
          <def.Glyph size={glyph} strokeWidth={stroke} className="os-glyph-shadow" />
        </motion.div>
      </div>
    </motion.div>
  )
}
