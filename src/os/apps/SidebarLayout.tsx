import { useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useElementSize } from '../lib/useElementSize'

export interface SidebarItem {
  id: string
  label: string
  /** Small right-aligned hint (count, date). */
  meta?: string
  /** Quiet unread dot. */
  dot?: boolean
}

interface Props {
  items: SidebarItem[]
  selectedId: string
  onSelect: (id: string) => void
  /** Optional row under the list, e.g. "+ new". */
  footer?: ReactNode
  /** Used for the back button label in narrow mode. */
  listLabel: string
  isMobile: boolean
  children: ReactNode
}

/** Below this container width the sidebar collapses into a list → detail flow. */
export const NARROW_PX = 520

/** Messages-style layout: darker cream list on the left, content on the right. Collapses by container width. */
export default function SidebarLayout({ items, selectedId, onSelect, footer, listLabel, isMobile, children }: Props) {
  const { ref, width } = useElementSize<HTMLDivElement>()
  const narrow = width > 0 ? width < NARROW_PX : isMobile
  const [showList, setShowList] = useState(true)

  const list = (
    <nav aria-label={listLabel} className={`flex flex-col gap-0.5 p-2.5 ${narrow ? 'pt-3' : 'pt-3.5'}`}>
      {items.map((it) => {
        const selected = it.id === selectedId
        return (
          <button
            key={it.id}
            type="button"
            aria-current={selected && !narrow ? 'true' : undefined}
            data-testid={`sidebar-item-${it.id}`}
            onClick={() => {
              onSelect(it.id)
              setShowList(false)
            }}
            className={`flex min-h-[44px] items-center justify-between gap-2 rounded-[10px] px-3.5 text-left font-os-mono text-[13px] lowercase outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-os-ink/25 ${
              selected && !narrow ? 'bg-[#ddd1c3] text-os-ink' : 'text-os-ink/80 hover:bg-[#e4d9cc]'
            }`}
          >
            <span className="truncate">{it.label}</span>
            {it.dot ? <span aria-label="new" className="h-1.5 w-1.5 shrink-0 rounded-full bg-os-ink/55" /> : null}
            {!it.dot && it.meta ? <span className="shrink-0 text-[11px] os-text-soft">{it.meta}</span> : null}
          </button>
        )
      })}
      {footer}
    </nav>
  )

  if (narrow) {
    return (
      <div ref={ref} className="flex h-full min-h-full flex-col bg-os-cream">
        {showList ? (
          <div className="flex-1 bg-[#efe8de]">{list}</div>
        ) : (
          <>
            <div className="flex h-12 shrink-0 items-center border-b border-os-ink/[0.06] px-1.5">
              <button
                type="button"
                data-testid="sidebar-back"
                onClick={() => setShowList(true)}
                className="flex h-11 items-center gap-1 rounded-[9px] pl-1 pr-3 font-os-mono text-[12.5px] lowercase text-os-ink/80 outline-none hover:bg-os-ink/[0.05] focus-visible:ring-2 focus-visible:ring-os-ink/25"
              >
                <ChevronLeft size={16} strokeWidth={1.5} />
                {listLabel}
              </button>
            </div>
            <div className="relative min-h-0 flex-1 overflow-y-auto">{children}</div>
          </>
        )}
      </div>
    )
  }

  return (
    <div ref={ref} className="flex h-full min-h-full bg-os-cream">
      <aside
        className="shrink-0 overflow-y-auto border-r border-os-ink/[0.08] bg-[#efe8de]"
        style={{ width: Math.round(Math.min(260, Math.max(180, width * 0.3))) }}
      >
        {list}
      </aside>
      <div className="relative min-w-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  )
}
