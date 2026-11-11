import { Pause, Play, Square } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Transport as TransportState } from '../store/tuner'
import { pauseTuner, playTuner, stopTuner } from '../store/tuner'
import { ensureTunerAudio } from './tunerAudio'

function Btn(props: { label: string; testId: string; active: boolean; onClick: () => void; size: number; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={props.label}
      aria-pressed={props.active}
      data-testid={props.testId}
      onClick={props.onClick}
      className={`flex items-center justify-center rounded-[9px] border text-os-ink outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-os-ink/30 active:scale-[0.96] ${
        props.active ? 'border-os-ink/20 bg-os-cream-dim' : 'border-os-ink/[0.12] bg-white/50 hover:bg-white/80'
      }`}
      style={{ width: props.size, height: props.size }}
    >
      {props.children}
    </button>
  )
}

/** Play = listen (audio if Sound is on), pause = freeze the trace, stop = release the lock and silence. */
export default function Transport({ state, size }: { state: TransportState; size: number }) {
  const icon = Math.round(size * 0.42)
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label="transport">
      <Btn
        label="play"
        testId="tuner-play"
        active={state === 'playing'}
        size={size}
        onClick={() => {
          playTuner()
          ensureTunerAudio()
        }}
      >
        <Play size={icon} strokeWidth={1.5} />
      </Btn>
      <Btn label="pause" testId="tuner-pause" active={state === 'paused'} size={size} onClick={pauseTuner}>
        <Pause size={icon} strokeWidth={1.5} />
      </Btn>
      <Btn label="stop" testId="tuner-stop" active={false} size={size} onClick={stopTuner}>
        <Square size={icon - 2} strokeWidth={1.5} />
      </Btn>
    </div>
  )
}
