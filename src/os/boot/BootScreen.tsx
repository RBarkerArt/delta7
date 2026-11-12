import { motion } from 'motion/react'
import { GRAIN_URL } from '../wallpapers/specs'

const DURATION = 1.1 // keep in step with BOOT_MS (lockState.ts)
const EASE = [0.22, 1, 0.36, 1] as const

/**
 * Boot: a warm ink screen, one soft cream line drawing out from the centre, breathing once, then the whole screen
 * fades into the lock screen. No logo, no text, no progress chrome. Transform / opacity only.
 */
export default function BootScreen({ reduced }: { reduced: boolean }) {
  return (
    <motion.div
      data-testid="boot-screen"
      role="presentation"
      className="fixed inset-0 z-[3000] flex cursor-default items-center justify-center"
      style={{ background: 'radial-gradient(120% 95% at 50% 50%, #33252d 0%, #251b21 52%, #161014 100%)' }}
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: reduced ? 0.2 : 0.34, ease: 'easeOut' } }}
    >
      <div aria-hidden="true" className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: GRAIN_URL, backgroundSize: '220px' }} />
      <div aria-hidden="true" className="relative" style={{ width: 'min(48vw, 340px)', height: 2 }}>
        {/* Wide soft glow under the line: blooms as the line finishes, breathes once. */}
        <motion.div
          className="absolute inset-x-[-12%] rounded-full"
          style={{
            top: -21,
            height: 44,
            background: 'radial-gradient(closest-side, rgba(255, 210, 176, 0.42) 0%, rgba(255, 196, 160, 0.14) 55%, rgba(255, 196, 160, 0) 100%)',
          }}
          initial={reduced ? { opacity: 0.5 } : { opacity: 0, scaleX: 0.2, scaleY: 0.6 }}
          animate={
            reduced
              ? { opacity: 0.5 }
              : { opacity: [0, 0.55, 1, 0.55], scaleX: [0.2, 1, 1.04, 1], scaleY: [0.6, 1, 1.45, 1] }
          }
          transition={reduced ? { duration: 0 } : { duration: DURATION, times: [0, 0.48, 0.72, 1], ease: EASE }}
        />
        {/* The line itself, drawn from the centre outwards. */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              'linear-gradient(90deg, rgba(243, 237, 228, 0) 0%, rgba(243, 237, 228, 0.55) 22%, rgba(255, 246, 236, 0.98) 50%, rgba(243, 237, 228, 0.55) 78%, rgba(243, 237, 228, 0) 100%)',
          }}
          initial={reduced ? { opacity: 0.8 } : { opacity: 0, scaleX: 0 }}
          animate={reduced ? { opacity: 0.8 } : { opacity: [0, 0.9, 1, 0.8], scaleX: [0, 1, 1, 1], scaleY: [1, 1, 1.5, 1] }}
          transition={reduced ? { duration: 0 } : { duration: DURATION, times: [0, 0.48, 0.72, 1], ease: EASE }}
        />
      </div>
    </motion.div>
  )
}
