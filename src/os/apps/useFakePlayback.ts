import { useEffect, useState } from 'react'
import { animate, useMotionValue, useTransform } from 'motion/react'
import type { MotionValue } from 'motion/react'

export function mmss(s: number): string {
  const t = Math.max(0, Math.floor(s))
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
}

export interface FakePlayback {
  playing: boolean
  /** 0…1, drives the bar with a transform only. */
  progress: MotionValue<number>
  elapsed: MotionValue<string>
  toggle: () => void
  /** Stop and rewind (e.g. another item was picked). */
  reset: () => void
}

/**
 * Silent stand-in playback for the video app: play/pause advances a progress value over `seconds`, stops
 * at the end. No media element, no sound.
 */
export function useFakePlayback(seconds: number): FakePlayback {
  const [playing, setPlaying] = useState(false)
  const progress = useMotionValue(0)
  const elapsed = useTransform(progress, (p) => mmss(p * seconds))

  useEffect(() => {
    if (!playing) return
    const remaining = (1 - progress.get()) * seconds
    const controls = animate(progress, 1, { duration: Math.max(0.1, remaining), ease: 'linear' })
    void controls.finished.then(() => {
      if (progress.get() >= 1) setPlaying(false)
    })
    return () => controls.stop()
  }, [playing, seconds, progress])

  const toggle = () => {
    if (!playing && progress.get() >= 1) progress.set(0)
    setPlaying((p) => !p)
  }
  const reset = () => {
    setPlaying(false)
    progress.set(0)
  }
  return { playing, progress, elapsed, toggle, reset }
}
