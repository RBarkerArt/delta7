import { useCoherence, useDecayLevel, useTunerLocked } from '../store/coherence'
import type { AppProps } from '../types'

/** STUB — replaced by the Delta7 dashboard builder. Exercises the coherence store. */
export default function Delta7App({ params }: AppProps) {
  const coherence = useCoherence()
  const level = useDecayLevel()
  const locked = useTunerLocked()
  return (
    <div className="h-full bg-os-cream p-6 font-os-mono text-sm text-os-ink" data-testid="delta7-stub">
      <p>Delta7 v0.14-rk</p>
      <p className="mt-2 text-os-ink-soft">
        coherence {coherence.toFixed(2)} · {level}
        {locked ? ' · recovering (tuner locked)' : ''}
      </p>
      {params?.view ? <p className="mt-1 text-os-ink-soft">view: {params.view}</p> : null}
    </div>
  )
}
