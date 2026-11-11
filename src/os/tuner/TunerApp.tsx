import { setTunerLocked, useCoherence, useTunerLocked } from '../store/coherence'

/** STUB — replaced by the Tuner builder (receives AppProps). Exercises setTunerLocked. */
export default function TunerApp() {
  const locked = useTunerLocked()
  const coherence = useCoherence()
  return (
    <div className="h-full bg-os-cream p-6 font-os-mono text-sm text-os-ink" data-testid="tuner-stub">
      <p>{locked ? '1.42 MHz · locked' : 'unlocked'}</p>
      <p className="mt-1 text-os-ink-soft">coherence {coherence.toFixed(2)}</p>
      <button
        type="button"
        data-testid="tuner-lock-toggle"
        onClick={() => setTunerLocked(!locked)}
        className="mt-4 rounded-md border border-os-line bg-white/60 px-3 py-1 font-os-sans text-sm hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-os-ink/40"
      >
        {locked ? 'unlock' : 'lock'}
      </button>
    </div>
  )
}
