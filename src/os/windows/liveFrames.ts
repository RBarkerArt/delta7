// Live frames of mounted desktop windows, so a window that is opening can be placed relative to the others.
import { getOpenApps } from '../store/windows'
import type { AppId } from '../types'
import type { Frame } from './frames'
import type { Placed } from './placement'

const live = new Map<AppId, () => Frame>()

/** A desktop window registers a reader for its current frame (and unregisters on unmount). */
export function registerLiveFrame(id: AppId, read: () => Frame): () => void {
  live.set(id, read)
  return () => {
    if (live.get(id) === read) live.delete(id)
  }
}

/** Every other open, non-minimized window with its frame and z, as it stands right now. */
export function visibleFramesExcept(id: AppId): Placed[] {
  const out: Placed[] = []
  for (const a of getOpenApps()) {
    if (a.id === id || a.minimized) continue
    const read = live.get(a.id)
    if (read) out.push({ frame: read(), z: a.z })
  }
  return out
}
