import { useState } from 'react'
import SidebarLayout from './SidebarLayout'
import PlayerBar from './PlayerBar'
import { mmss, useFakePlayback } from './useFakePlayback'
import { CLIPS } from '../mock/placeholderContent'
import type { AppProps } from '../types'

/** audio: a list of clips and a fake player bar. Silent on purpose — the OS makes no sound. */
export default function AudioApp({ isMobile }: AppProps) {
  const [id, setId] = useState(CLIPS[0].id)
  const clip = CLIPS.find((c) => c.id === id) ?? CLIPS[0]
  const playback = useFakePlayback(clip.seconds)

  const select = (next: string) => {
    if (next === id) return
    setId(next)
    playback.reset()
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
          <p className="font-os-mono text-[11.5px] os-text-soft">recording · {mmss(clip.seconds)}</p>
        </div>
        <PlayerBar playback={playback} seconds={clip.seconds} testIdPrefix="audio" />
      </div>
    </SidebarLayout>
  )
}
