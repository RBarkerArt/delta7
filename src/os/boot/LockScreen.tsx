import { useState } from 'react'
import { motion } from 'motion/react'
import LockAvatar from './LockAvatar'
import { unlock } from './lockState'
import { useClock } from '../store/clock'

interface Props {
  /** Unlock has begun: the content lifts away and the veil clears. */
  leaving: boolean
  /** Session was only asleep: no field, a quiet `resuming…` line, unlocks by itself. */
  autoResume: boolean
  isMobile: boolean
  reduced: boolean
}

const VEIL =
  'radial-gradient(90% 75% at 50% 46%, rgba(44, 28, 36, 0.06) 0%, rgba(44, 28, 36, 0.3) 100%), linear-gradient(180deg, rgba(44, 28, 36, 0.14) 0%, rgba(44, 28, 36, 0) 40%, rgba(44, 28, 36, 0.18) 100%)'

/**
 * Lock screen foreground: a soft veil over the (blurred) wallpaper, the time, an abstract picture and a plain
 * password field. ANY input unlocks, including an empty one. No account name, no error states.
 */
export default function LockScreen({ leaving, autoResume, isMobile, reduced }: Props) {
  const time = useClock()
  const [value, setValue] = useState('')
  const ease = { duration: reduced ? 0.2 : 0.42, ease: [0.32, 0.72, 0, 1] as const }

  return (
    <div
      data-testid="lock-screen"
      role="dialog"
      aria-modal="true"
      aria-label="locked"
      className={`os-chrome fixed inset-0 z-[2500] font-os-sans text-os-cream ${leaving ? 'pointer-events-none' : ''}`}
    >
      <motion.div
        aria-hidden="true"
        className="absolute inset-0"
        style={{ background: VEIL }}
        initial={{ opacity: 0 }}
        animate={{ opacity: leaving ? 0 : 1 }}
        transition={{ duration: leaving ? (reduced ? 0.2 : 0.5) : 0.5, ease: 'easeOut' }}
      />
      <motion.div
        className="relative flex h-full flex-col items-center justify-center px-4"
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 6vh)',
        }}
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 14 }}
        animate={leaving ? { opacity: 0, y: reduced ? 0 : -40 } : { opacity: 1, y: 0 }}
        transition={leaving ? ease : { duration: reduced ? 0.2 : 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <time
          data-testid="lock-time"
          className="os-label-shadow font-os-mono font-extralight tabular-nums text-os-cream/95"
          style={{ fontSize: isMobile ? 64 : 92, letterSpacing: '0.06em', lineHeight: 1 }}
        >
          {time}
        </time>

        <div className={isMobile ? 'h-[14vh]' : 'h-[11vh]'} />

        <LockAvatar size={isMobile ? 76 : 88} reduced={reduced} leaving={leaving} />

        <div className="mt-6 flex h-11 items-center justify-center">
          {autoResume ? (
            <p
              data-testid="lock-resuming"
              role="status"
              className="os-label-shadow font-os-mono text-[13px] lowercase tracking-[0.08em] text-os-cream/75"
            >
              resuming…
            </p>
          ) : (
            <form
              className="flex items-center gap-2"
              autoComplete="off"
              onSubmit={(e) => {
                e.preventDefault()
                // TODO(auth): this becomes the Firebase login later. The value is never checked or stored.
                unlock()
              }}
            >
              <input
                type="password"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="password"
                aria-label="password"
                data-testid="lock-password"
                autoFocus={!isMobile}
                autoComplete="off"
                spellCheck={false}
                className="os-selectable h-10 w-[min(212px,56vw)] rounded-[12px] border border-os-ink/10 bg-os-cream/90 px-3.5 text-[14px] text-os-ink shadow-[0_6px_20px_-10px_rgba(30,18,24,0.55)] outline-none transition-[background-color,box-shadow] duration-200 placeholder:font-os-mono placeholder:text-[12.5px] placeholder:lowercase placeholder:tracking-[0.06em] placeholder:text-os-ink-soft/70 focus:bg-os-cream focus-visible:ring-2 focus-visible:ring-os-cream/60"
              />
              <button
                type="submit"
                data-testid="lock-resume"
                className="h-10 rounded-[12px] border border-os-cream/30 bg-os-cream/[0.14] px-3.5 font-os-mono text-[12.5px] lowercase tracking-[0.06em] text-os-cream/95 outline-none transition-colors duration-150 hover:bg-os-cream/[0.22] active:bg-os-cream/[0.28] focus-visible:ring-2 focus-visible:ring-os-cream/60"
              >
                resume
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  )
}
