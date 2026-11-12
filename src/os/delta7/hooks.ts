import { useEffect, useMemo, useState } from 'react'
import { useEverLocked, useTunerLock, useTunerTouched, useTunerValue } from '../store/tuner'
import { SIGNAL_TARGET } from '../tuner/signalConfig'
import { d7Logs } from '../mock/delta7Content'
import type { D7Status } from '../mock/delta7Content'

/** Flips between false/true every `ms` while `active`. Returns false when inactive. */
export function useAlternate(active: boolean, ms: number): boolean {
  const [flip, setFlip] = useState(false)
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setFlip((f) => !f), ms)
    return () => clearInterval(id)
  }, [active, ms])
  return active && flip
}

/** Calls `onEscape` on Escape while `active`. */
export function useEscape(active: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Esc contract: inner widgets that consume Esc stop it AND mark it handled, so the window stays open.
        e.preventDefault()
        e.stopPropagation()
        onEscape()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [active, onEscape])
}

export interface D7Signal {
  /** The tuner's live value (two decimals) once it has been touched this session; `—` before that. */
  live: string
  /** `?` until the first lock ever, then the target. */
  hold: string
  status: D7Status
  everLocked: boolean
  /** Log lines with the hold filled in (and the nudge line until the first lock). */
  logs: string[]
}

/**
 * What the dashboard knows about the signal. Before the first lock it never shows the target: only the live dial
 * value (which the player is moving themselves) and `hold=?`.
 */
export function useD7Signal(): D7Signal {
  const value = useTunerValue()
  const locked = useTunerLock()
  const touched = useTunerTouched()
  const everLocked = useEverLocked()
  const hold = everLocked ? SIGNAL_TARGET.toFixed(2) : '?'
  const live = locked ? SIGNAL_TARGET.toFixed(2) : touched ? value.toFixed(2) : '—'
  const status: D7Status = !everLocked ? 'searching' : locked ? 'holding' : 'drifting'
  const logs = useMemo(() => d7Logs(hold, everLocked), [hold, everLocked])
  return { live, hold, status, everLocked, logs }
}
