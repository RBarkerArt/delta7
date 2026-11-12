import { motion } from 'motion/react'
import { springs } from '../lib/motion'

interface Props {
  text: string
  locked: boolean
  lockNonce: number
  reduced: boolean
  /** Digit size in px. */
  size: number
}

/** Large frequency readout. At the lock the digits warm (cross-fade) and give one small spring bounce. */
export default function Readout({ text, locked, lockNonce, reduced, size }: Props) {
  return (
    <motion.div
      key={lockNonce}
      data-testid="tuner-readout"
      aria-live="off"
      className="flex origin-left items-baseline gap-2 tabular-nums"
      initial={lockNonce > 0 && !reduced ? { scale: 1.045, y: -1 } : false}
      animate={{ scale: 1, y: 0 }}
      transition={{ ...springs.snappy, damping: 16 }}
    >
      <span className="relative font-os-sans font-light leading-none tracking-[-0.02em]" style={{ fontSize: size }}>
        <span className="text-os-ink transition-opacity duration-700" style={{ opacity: locked ? 0 : 1 }}>
          {text}
        </span>
        {/* Warm copy via ::after so the element's text stays exactly "<value> MHz". */}
        <span
          aria-hidden="true"
          data-text={text}
          className="tuner-readout-warm absolute inset-0 transition-opacity duration-700"
          style={{ opacity: locked ? 1 : 0 }}
        />
      </span>{' '}
      <span className="font-os-mono text-os-ink-soft" style={{ fontSize: Math.max(12, size * 0.26) }}>
        MHz
      </span>
    </motion.div>
  )
}
