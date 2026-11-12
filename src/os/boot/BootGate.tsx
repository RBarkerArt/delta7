import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import BootScreen from './BootScreen'
import LockBackdrop from './LockBackdrop'
import LockScreen from './LockScreen'
import {
  BOOT_MS,
  BOOT_MS_REDUCED,
  PREPARE_SHELL_MS,
  RESUME_BEAT_MS,
  UNLOCK_MS,
  UNLOCK_MS_REDUCED,
  beginUnlock,
  finishBoot,
  finishUnlock,
  prepareShell,
  skipBoot,
  unlock,
  useAutoResume,
  useLockPhase,
  useShellMounted,
  useUnlockPending,
} from './lockState'
import { useIsMobile } from '../store/device'
import { useReducedMotionPref } from '../lib/useReducedMotionPref'

// The home eases in as the lock lifts away (~0.5s, soft at both ends so the move is actually seen); reduced motion:
// a short fade, opacity only (no scale).
const SHOW = {
  scale: { type: 'spring', visualDuration: 0.5, bounce: 0.08 },
  opacity: { duration: 0.5, ease: [0.33, 0, 0.2, 1] },
} as const
const SHOW_REDUCED = { duration: 0.2, ease: 'easeOut' } as const
const HIDE = { duration: 0.3, ease: 'easeOut' } as const

/**
 * Boot animation → lock screen → unlock → home. `?skipboot=1` renders the shell at once (no boot, no lock).
 * The shell is not rendered at all before the first unlock begins; when re-locked (dev) it stays mounted but `inert`.
 */
export default function BootGate({ children }: { children: ReactNode }) {
  const phase = useLockPhase()
  const autoResume = useAutoResume()
  const shellMounted = useShellMounted()
  const unlockPending = useUnlockPending()
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
    if (phase === 'lock' && !shellMounted) {
      // Mount the shell behind the settled lock screen, so the unlock later only has to animate.
      const t = setTimeout(prepareShell, PREPARE_SHELL_MS)
      return () => clearTimeout(t)
    }
    if (phase === 'unlocking') {
      const t = setTimeout(finishUnlock, reduced ? UNLOCK_MS_REDUCED : UNLOCK_MS)
      return () => clearTimeout(t)
    }
  }, [phase, autoResume, reduced, shellMounted])

  // Unlock asked for before the shell existed: it has mounted now; start the move once that frame has painted.
  useEffect(() => {
    if (!unlockPending || !shellMounted) return
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(beginUnlock)
    })
    return () => cancelAnimationFrame(raf)
  }, [unlockPending, shellMounted])

  return (
    <>
      {/* The home is fully opaque over the backdrop by the time the lock is gone, so the backdrop just leaves. */}
      {phase !== 'home' ? <LockBackdrop /> : null}
      {shellMounted ? (
        <motion.div
          className="fixed inset-0"
          data-testid="shell-gate"
          inert={locked}
          aria-hidden={locked ? true : undefined}
          initial={skipBoot ? false : { opacity: 0, scale: reduced ? 1 : 0.96 }}
          animate={locked ? { opacity: 0, scale: reduced ? 1 : 0.97 } : { opacity: 1, scale: 1 }}
          transition={locked ? HIDE : reduced ? SHOW_REDUCED : SHOW}
        >
          {children}
        </motion.div>
      ) : null}
      {phase === 'lock' || phase === 'unlocking' ? (
        <LockScreen
          leaving={phase === 'unlocking'}
          releasing={unlockPending || phase === 'unlocking'}
          autoResume={autoResume}
          isMobile={isMobile}
          reduced={reduced}
        />
      ) : null}
      <AnimatePresence>{phase === 'boot' ? <BootScreen key="boot" reduced={reduced} /> : null}</AnimatePresence>
    </>
  )
}
