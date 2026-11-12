import { motion } from 'motion/react'
import { GRAIN_URL } from '../wallpapers/specs'

// Abstract profile picture: a soft multi-stop gradient disc in the OS palette with faint grain. No face, no initials.
const SWIRL =
  'conic-gradient(from 210deg at 44% 46%, #e4ad94 0deg, #b9747c 70deg, #8a6680 140deg, #d8995e 215deg, #f1d3ba 285deg, #e4ad94 360deg)'
const LIGHT =
  'radial-gradient(circle at 34% 28%, rgba(255, 244, 234, 0.38) 0%, rgba(255, 244, 234, 0) 50%), radial-gradient(circle at 70% 82%, rgba(74, 40, 54, 0.3) 0%, rgba(74, 40, 54, 0) 60%)'

interface Props {
  size: number
  reduced: boolean
  /** Changes when the screen unlocks: plays a tiny press-and-release bounce. */
  leaving: boolean
}

export default function LockAvatar({ size, reduced, leaving }: Props) {
  return (
    <motion.div
      data-testid="lock-avatar"
      role="img"
      aria-label="profile picture"
      className="relative shrink-0 rounded-full"
      style={{ width: size, height: size }}
      initial={reduced ? false : { scale: 0.9 }}
      animate={reduced ? undefined : leaving ? { scale: [1, 0.93, 1.05, 1] } : { scale: 1 }}
      transition={
        leaving
          ? { duration: 0.34, times: [0, 0.3, 0.7, 1], ease: 'easeOut' }
          : { type: 'spring', visualDuration: 0.5, bounce: 0.35, delay: 0.08 }
      }
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-[45%] rounded-full"
        style={{ background: 'radial-gradient(closest-side, rgba(255, 212, 180, 0.26) 0%, rgba(255, 212, 180, 0) 100%)' }}
      />
      <div
        className="absolute inset-0 overflow-hidden rounded-full"
        style={{ boxShadow: '0 0 0 1px rgba(243, 237, 228, 0.34), 0 14px 34px -12px rgba(30, 18, 24, 0.6)' }}
      >
        {/* The swirl is blurred once, on a still child, and its composited parent turns with a CSS animation: the
            blur is never redone per frame and no script runs to turn it. */}
        <div aria-hidden="true" className={`absolute -inset-[25%] ${reduced ? '' : 'os-lock-swirl'}`}>
          <div className="absolute inset-0" style={{ background: SWIRL, filter: 'blur(9px) saturate(1.1)' }} />
        </div>
        <div aria-hidden="true" className="absolute inset-0" style={{ background: LIGHT }} />
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.22] mix-blend-overlay"
          style={{ backgroundImage: GRAIN_URL, backgroundSize: '120px' }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-full"
          style={{ boxShadow: 'inset 0 -10px 20px -10px rgba(40, 20, 28, 0.5), inset 0 8px 16px -10px rgba(255, 238, 222, 0.4)' }}
        />
      </div>
    </motion.div>
  )
}
