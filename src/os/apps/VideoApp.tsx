import { useState } from 'react'
import { Play } from 'lucide-react'
import SidebarLayout from './SidebarLayout'
import PlayerBar from './PlayerBar'
import { thumbBackground } from './thumbStyle'
import { mmss, useFakePlayback } from './useFakePlayback'
import { VIDEOS } from '../mock/placeholderContent'
import type { AppProps } from '../types'

/** video: a list of clips, a soft gradient "poster" and a fake player bar. No media, no sound. */
export default function VideoApp({ isMobile }: AppProps) {
  const [id, setId] = useState(VIDEOS[0].id)
  const clip = VIDEOS.find((c) => c.id === id) ?? VIDEOS[0]
  const playback = useFakePlayback(clip.seconds)

  const select = (next: string) => {
    if (next === id) return
    setId(next)
    playback.reset()
  }

  return (
    <SidebarLayout
      items={VIDEOS.map((c) => ({ id: c.id, label: c.name, meta: mmss(c.seconds) }))}
      selectedId={id}
      onSelect={select}
      listLabel="clips"
      isMobile={isMobile}
    >
      <div className="flex h-full flex-col">
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 py-6">
          <div
            data-testid="video-poster"
            aria-hidden="true"
            className="relative flex aspect-video w-full max-w-[520px] items-center justify-center overflow-hidden rounded-[12px] text-os-cream/85 shadow-[inset_0_0_0_0.5px_rgba(58,48,52,0.12),0_1px_2px_rgba(40,24,30,0.08),0_14px_30px_-18px_rgba(40,24,30,0.4)]"
            style={{ background: thumbBackground(clip.name) }}
          >
            <span
              className={`flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(40,24,30,0.22)] transition-opacity duration-300 ${
                playback.playing ? 'opacity-0' : 'opacity-100'
              }`}
            >
              <Play size={20} strokeWidth={1.5} className="os-glyph-shadow translate-x-[1px]" />
            </span>
          </div>
          <p className="font-os-mono text-[13px] lowercase text-os-ink">{clip.name}</p>
        </div>
        <PlayerBar playback={playback} seconds={clip.seconds} testIdPrefix="video" />
      </div>
    </SidebarLayout>
  )
}
