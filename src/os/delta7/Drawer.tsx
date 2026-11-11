import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { fadeFast, pickTransition, springs } from '../lib/motion'

interface Props {
  open: boolean
  reduced: boolean
  onClose: () => void
  children: ReactNode
}

/** Slide-out side panel for compact layouts. Lives inside Delta7's own container, never over the OS. */
export default function Drawer({ open, reduced, onClose, children }: Props) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="scrim"
          className="absolute inset-0 z-40 bg-[rgba(58,48,52,0.26)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={fadeFast}
          onClick={onClose}
          data-testid="d7-drawer-scrim"
        />
      ) : null}
      {open ? (
        <motion.aside
          key="drawer"
          role="dialog"
          aria-modal="true"
          aria-label="delta7 sections"
          data-testid="d7-drawer"
          className="absolute inset-y-0 left-0 z-50 w-[220px] max-w-[78%] border-r border-[color:var(--d7-rule)] bg-[color:var(--d7-side)] shadow-[8px_0_30px_-12px_rgba(40,24,30,0.35)]"
          initial={reduced ? { opacity: 0 } : { x: '-100%' }}
          animate={reduced ? { opacity: 1 } : { x: 0 }}
          exit={reduced ? { opacity: 0 } : { x: '-100%' }}
          transition={pickTransition(reduced, springs.soft)}
        >
          {children}
        </motion.aside>
      ) : null}
    </AnimatePresence>
  )
}
