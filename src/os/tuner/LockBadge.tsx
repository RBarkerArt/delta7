import { motion } from 'motion/react'
import { Lock, LockOpen } from 'lucide-react'
import { springs } from '../lib/motion'
import { HOLD_MS } from './tunerMath'

interface Props {
  locked: boolean
  holding: boolean
  holdSince: number
  lockNonce: number
  reduced: boolean
  size: number
}

const WARM = '#B65A34'

/** Lock state + quiet hold progress: the ring fills over the 1.5s hold, then the lock closes. */
export default function LockBadge({ locked, holding, holdSince, lockNonce, reduced, size }: Props) {
  const r = size / 2 - 2
  const c = size / 2
  return (
    <motion.div
      key={lockNonce}
      data-testid="tuner-lock"
      data-locked={locked ? 'true' : 'false'}
      role="img"
      aria-label={locked ? 'locked' : holding ? 'holding' : 'unlocked'}
      className="relative shrink-0"
      style={{ width: size, height: size }}
      initial={lockNonce > 0 && !reduced ? { scale: 0.86 } : false}
      animate={{ scale: 1 }}
      transition={{ ...springs.snappy, damping: 14 }}
    >
      <svg width={size} height={size} className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx={c} cy={c} r={r} fill="none" stroke="#3A3034" strokeOpacity={0.12} strokeWidth={1.5} />
        {locked ? (
          <circle cx={c} cy={c} r={r} fill="none" stroke={WARM} strokeWidth={1.75} />
        ) : holding ? (
          <motion.circle
            key={holdSince}
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke={WARM}
            strokeOpacity={0.8}
            strokeWidth={1.75}
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: HOLD_MS / 1000, ease: 'linear' }}
          />
        ) : null}
      </svg>
      <span
        className={`absolute inset-0 flex items-center justify-center transition-colors duration-500 ${locked ? 'text-[#A9502D]' : 'text-os-ink-soft'}`}
      >
        {locked ? <Lock size={size * 0.4} strokeWidth={1.5} /> : <LockOpen size={size * 0.4} strokeWidth={1.5} />}
      </span>
    </motion.div>
  )
}
