import { useCallback, useRef } from 'react'
import type { RefObject } from 'react'
import { motion } from 'motion/react'
import { usePopoverDismiss } from './usePopoverDismiss'
import { closePopover, setSearchQuery, uiStore, useSearchQuery } from '../store/ui'
import { layoutStore } from '../store/layout'
import { openApp } from '../store/windows'
import { APPS } from '../apps/registry'
import { springs, fadeFast } from '../lib/motion'
import { useReducedMotionPref } from '../lib/useReducedMotionPref'
import { Search } from 'lucide-react'

function firstMatch(query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return null
  const icons = [...layoutStore.get().icons].sort((a, b) => a.page - b.page || a.index - b.index)
  return icons.find((p) => APPS[p.appId].label.includes(q))?.appId ?? null
}

/** Small search panel under the search icon. Filters the home grid. */
export default function SearchPanel({ anchorRef }: { anchorRef: RefObject<HTMLButtonElement | null> }) {
  // TODO(story): the search bar gets a story role later.
  const panelRef = useRef<HTMLDivElement>(null)
  const query = useSearchQuery()
  const reduced = useReducedMotionPref()
  const close = useCallback(() => closePopover(), [])
  // Clicking a result opens it (AppIcon closes the search); anywhere else clears and closes.
  usePopoverDismiss(panelRef, anchorRef, close, '[data-testid="search-results"]')

  return (
    <motion.div
      ref={panelRef}
      data-popover
      data-testid="search-panel"
      initial={{ opacity: 0, y: -6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.98, transition: fadeFast }}
      transition={reduced ? fadeFast : springs.snappy}
      style={{ transformOrigin: 'top right' }}
      className="os-panel absolute right-3 top-[calc(100%+4px)] z-50 w-[min(280px,calc(100vw-24px))] rounded-[14px] p-1.5"
    >
      <label className="flex items-center gap-2 rounded-[9px] bg-white/55 px-2.5 py-1.5 ring-1 ring-os-ink/10 focus-within:ring-os-ink/25">
        <Search size={15} strokeWidth={1.5} className="shrink-0 text-os-ink-soft" aria-hidden="true" />
        <input
          autoFocus
          type="text"
          value={query}
          placeholder="search"
          aria-label="search apps"
          data-testid="search-input"
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const id = firstMatch(uiStore.get().query)
              if (id) {
                closePopover()
                openApp(id)
              }
            } else if (e.key === 'Escape') {
              e.preventDefault()
              e.stopPropagation()
              closePopover()
            }
          }}
          className="os-selectable w-full bg-transparent font-os-mono text-[13px] lowercase text-os-ink outline-none placeholder:text-os-ink-soft/60"
        />
      </label>
    </motion.div>
  )
}
