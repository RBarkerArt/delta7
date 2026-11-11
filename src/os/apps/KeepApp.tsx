import { Bookmark } from 'lucide-react'
import { KEEP_ITEMS } from '../mock/placeholderContent'

/** keep: one quiet list of saved things. TODO(copy) */
export default function KeepApp() {
  return (
    <ul className="mx-auto max-w-[560px] px-5 py-5">
      {KEEP_ITEMS.map((name) => (
        <li
          key={name}
          className="flex items-center gap-3 border-b border-os-ink/[0.07] px-1 py-3.5 font-os-mono text-[13px] lowercase text-os-ink/85 last:border-b-0"
        >
          <Bookmark size={15} strokeWidth={1.5} className="shrink-0 text-os-ink-soft" />
          <span className="truncate">{name}</span>
        </li>
      ))}
    </ul>
  )
}
