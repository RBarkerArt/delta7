import type { AppId } from '../types'

// The heavier lazy apps, fetched as soon as their icon is hovered or focused so the launch never waits on the network.
// Same module specifiers as the registry's lazy() calls, so the bundler hands back the very same chunk.
const LOADERS: Partial<Record<AppId, () => Promise<unknown>>> = {
  delta7: () => import('../delta7/Delta7App'),
  tuner: () => import('../tuner/TunerApp'),
}
const started = new Set<AppId>()

export function preloadApp(id: AppId) {
  const load = LOADERS[id]
  if (!load || started.has(id)) return
  started.add(id)
  load().catch(() => started.delete(id))
}
