import { AudioLines, FileText } from 'lucide-react'
import { thumbBackground } from './thumbStyle'

export interface Thumb {
  name: string
  kind?: 'image' | 'doc' | 'sound'
}

/** Grid of soft, seeded gradient thumbnails with mono captions. */
export default function ThumbGrid({ items, compact }: { items: Thumb[]; compact: boolean }) {
  return (
    <ul
      className="grid gap-x-3.5 gap-y-4 p-4"
      style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${compact ? 96 : 118}px, 1fr))` }}
    >
      {items.map((it, i) => (
        <li key={`${it.name}-${i}`} className="min-w-0">
          <div
            className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-[10px] text-os-cream/85 shadow-[inset_0_0_0_0.5px_rgba(58,48,52,0.12),0_1px_2px_rgba(40,24,30,0.08)]"
            style={{ background: thumbBackground(it.name) }}
          >
            {it.kind === 'doc' ? <FileText size={22} strokeWidth={1.5} className="os-glyph-shadow" /> : null}
            {it.kind === 'sound' ? <AudioLines size={22} strokeWidth={1.5} className="os-glyph-shadow" /> : null}
          </div>
          <p className="mt-1.5 truncate font-os-mono text-[11.5px] lowercase text-os-ink/75">{it.name}</p>
        </li>
      ))}
    </ul>
  )
}
