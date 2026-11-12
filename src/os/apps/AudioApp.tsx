import { useEffect, useState } from 'react'
import { animate, motion, useMotionValue, useTransform } from 'motion/react'
import { Pause, Play } from 'lucide-react'
import SidebarLayout from './SidebarLayout'
import { CLIPS } from '../mock/placeholderContent'
import type { AppProps } from '../types'

function mmss(s: number): string {
  const t = Math.max(0, Math.floor(s))
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
}

/** audio: a list of clips and a fake player bar. Silent on purpose — the OS makes no sound. */
export default function AudioApp({ isMobile }: AppProps) {
  const [id, setId] = useState(CLIPS[0].id)
  const [playing, setPlaying] = useState(false)
  const clip = CLIPS.find((c) => c.id === id) ?? CLIPS[0]
  const progress = useMotionValue(0)
  const elapsed = useTransform(progress, (p) => mmss(p * clip.seconds))

  // Advance the bar while "playing" (transform only); stop at the end.
  useEffect(() => {
    if (!playing) return
    const remaining = (1 - progress.get()) * clip.seconds
    const controls = animate(progress, 1, { duration: Math.max(0.1, remaining), ease: 'linear' })
    void controls.finished.then(() => {
      if (progress.get() >= 1) setPlaying(false)
    })
    return () => controls.stop()
  }, [playing, clip.seconds, progress])

  const select = (next: string) => {
    if (next === id) return
    setId(next)
    setPlaying(false)
    progress.set(0)
  }

  const toggle = () => {
    if (!playing && progress.get() >= 1) progress.set(0)
    setPlaying((p) => !p)
  }

  return (
    <SidebarLayout
      items={CLIPS.map((c) => ({ id: c.id, label: c.name, meta: mmss(c.seconds) }))}
      selectedId={id}
      onSelect={select}
      listLabel="clips"
      isMobile={isMobile}
    >
      <div className="flex h-full flex-col">
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-8">
          <p className="font-os-mono text-[13px] lowercase text-os-ink">{clip.name}</p>
          <p className="font-os-mono text-[11.5px] os-text-soft">TODO(copy)</p>
        </div>
        <div className="flex shrink-0 items-center gap-3 border-t border-os-ink/[0.08] bg-[#efe8de] px-4 py-3" data-testid="audio-player">
          <button
            type="button"
            aria-label={playing ? 'pause' : 'play'}
            data-testid="audio-play"
            onClick={toggle}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-os-ink/[0.12] bg-[#f6f1ea] text-os-ink/80 outline-none hover:bg-white/70 focus-visible:ring-2 focus-visible:ring-os-ink/25"
          >
            {playing ? <Pause size={16} strokeWidth={1.5} /> : <Play size={16} strokeWidth={1.5} className="translate-x-[1px]" />}
          </button>
          <motion.span className="w-10 shrink-0 font-os-mono text-[11.5px] tabular-nums os-text-soft">{elapsed}</motion.span>
          <div className="relative h-[3px] min-w-0 flex-1 overflow-hidden rounded-full bg-os-ink/[0.12]">
            <motion.div
              data-testid="audio-progress"
              className="absolute inset-0 rounded-full bg-os-ink/50"
              style={{ scaleX: progress, originX: 0 }}
            />
          </div>
          <span className="w-10 shrink-0 text-right font-os-mono text-[11.5px] tabular-nums os-text-soft">{mmss(clip.seconds)}</span>
        </div>
      </div>
    </SidebarLayout>
  )
}
