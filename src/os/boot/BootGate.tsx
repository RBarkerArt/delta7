import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import BootScreen from './BootScreen'
import LockBackdrop from './LockBackdrop'
import LockScreen from './LockScreen'
import {
  BOOT_MS,
  BOOT_MS_REDUCED,
  RESUME_BEAT_MS,
  UNLOCK_MS,
  UNLOCK_MS_REDUCED,
  finishBoot,
  finishUnlock,
  skipBoot,
  unlock,
  useAutoResume,
  useLockPhase,
  useShellMounted,
} from './lockState'
import { useIsMobile } from '../store/device'
import { useReducedMotionPref } from '../lib/useReducedMotionPref'

const SHOW = {
  scale: { type: 'spring', visualDuration: 0.6, bounce: 0.18 },
  opacity: { duration: 0.42, ease: 'easeOut' },
} as const
const HIDE = { duration: 0.3, ease: 'easeOut' } as const

/**
 * Boot animation → lock screen → unlock → home. `?skipboot=1` renders the shell at once (no boot, no lock).
 * The shell is not rendered at all before the first unlock begins; when re-locked (dev) it stays mounted but `inert`.
 */
export default function BootGate({ children }: { children: ReactNode }) {
  const phase = useLockPhase()
  const autoResume = useAutoResume()
  const shellMounted = useShellMounted()
  const reduced = useReducedMotionPref()
  const isMobile = useIsMobile()
  const locked = phase === 'boot' || phase === 'lock'

  useEffect(() => {
    if (phase === 'boot') {
      const t = setTimeout(finishBoot, reduced ? BOOT_MS_REDUCED : BOOT_MS)
      return () => clearTimeout(t)
    }
    if (phase === 'lock' && autoResume) {
      const t = setTimeout(unlock, RESUME_BEAT_MS)
      return () => clearTimeout(t)
    }
    if (phase === 'unlocking') {
      const t = setTimeout(finishUnlock, reduced ? UNLOCK_MS_REDUCED : UNLOCK_MS)
      return () => clearTimeout(t)
    }
  }, [phase, autoResume, reduced])

  return (
    <>
      <AnimatePresence>{phase !== 'home' ? <LockBackdrop key="backdrop" /> : null}</AnimatePresence>
      {shellMounted ? (
        <motion.div
          className="fixed inset-0"
          data-testid="shell-gate"
          inert={locked}
          aria-hidden={locked ? true : undefined}
          initial={skipBoot ? false : { opacity: 0, scale: 0.96 }}
          animate={locked ? { opacity: 0, scale: 0.97 } : { opacity: 1, scale: 1 }}
          transition={locked ? HIDE : SHOW}
        >
          {children}
        </motion.div>
      ) : null}
      {phase === 'lock' || phase === 'unlocking' ? (
        <LockScreen leaving={phase === 'unlocking'} autoResume={autoResume} isMobile={isMobile} reduced={reduced} />
      ) : null}
      <AnimatePresence>{phase === 'boot' ? <BootScreen key="boot" reduced={reduced} /> : null}</AnimatePresence>
    </>
  )
}
