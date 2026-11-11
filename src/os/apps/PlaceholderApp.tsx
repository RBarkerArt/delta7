import type { AppProps } from '../types'
import { APPS } from './registry'

/** Shared placeholder body for apps that are not built yet. */
export default function PlaceholderApp({ appId }: AppProps) {
  const app = APPS[appId]
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 bg-os-cream p-8 font-os-sans text-os-ink">
      <app.Glyph size={28} strokeWidth={1.5} className="text-os-ink-soft" />
      <p className="font-os-mono text-sm lowercase tracking-wide">{app.label}</p>
      <p className="font-os-mono text-xs text-os-ink-soft/70">TODO(copy)</p>
    </div>
  )
}
