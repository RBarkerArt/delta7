import { motion } from 'motion/react'
import { Pause, Play } from 'lucide-react'
import { mmss } from './useFakePlayback'
import type { FakePlayback } from './useFakePlayback'

/** The quiet player bar under the video app: play/pause · elapsed · bar · length. */
export default function PlayerBar({ playback, seconds, testIdPrefix }: { playback: FakePlayback; seconds: number; testIdPrefix: string }) {
  const { playing, progress, elapsed, toggle } = playback
  return (
    <div className="flex shrink-0 items-center gap-3 border-t border-os-ink/[0.08] bg-[#efe8de] px-4 py-3" data-testid={`${testIdPrefix}-player`}>
      <button
        type="button"
        aria-label={playing ? 'pause' : 'play'}
        data-testid={`${testIdPrefix}-play`}
        onClick={toggle}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-os-ink/[0.12] bg-[#f6f1ea] text-os-ink/80 outline-none hover:bg-white/70 focus-visible:ring-2 focus-visible:ring-os-ink/25"
      >
        {playing ? <Pause size={16} strokeWidth={1.5} /> : <Play size={16} strokeWidth={1.5} className="translate-x-[1px]" />}
      </button>
      <motion.span className="w-10 shrink-0 font-os-mono text-[11.5px] tabular-nums os-text-soft">{elapsed}</motion.span>
      <div className="relative h-[3px] min-w-0 flex-1 overflow-hidden rounded-full bg-os-ink/[0.12]">
        <motion.div
          data-testid={`${testIdPrefix}-progress`}
          className="absolute inset-0 rounded-full bg-os-ink/50"
          style={{ scaleX: progress, originX: 0 }}
        />
      </div>
      <span className="w-10 shrink-0 text-right font-os-mono text-[11.5px] tabular-nums os-text-soft">{mmss(seconds)}</span>
    </div>
  )
}
