import { useMemo, useRef } from 'react'
import { AnimatePresence } from 'motion/react'
import { Search } from 'lucide-react'
import { FourDotGlyph, SignalGlyph } from './glyphs'
import MenuPopover from './MenuPopover'
import SearchPanel from './SearchPanel'
import { useReturnFocus } from './usePopoverDismiss'
import { togglePopover, usePopover } from '../store/ui'
import { useClock } from '../store/clock'

const iconBtn =
  'os-tap flex h-10 w-10 items-center justify-center rounded-[10px] text-os-cream/95 outline-none transition-colors duration-150 hover:bg-os-cream/[0.08] focus-visible:ring-2 focus-visible:ring-os-cream/60'

/** Thin, nearly transparent top bar: menu · time · signal + search. Nothing else. */
export default function TopBar({ isMobile }: { isMobile: boolean }) {
  const time = useClock()
  const popover = usePopover()
  const menuRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLButtonElement>(null)
  const anchors = useMemo(() => ({ menu: menuRef, search: searchRef }), [])
  useReturnFocus(popover, anchors)

  return (
    <header
      role="banner"
      aria-label="top bar"
      data-os-region="topbar"
      className="os-chrome absolute inset-x-0 top-0 z-40"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[150%]"
        style={{ background: 'linear-gradient(180deg, rgba(52,36,44,0.3) 0%, rgba(52,36,44,0.1) 60%, rgba(52,36,44,0) 100%)' }}
      />
      <div className={`relative flex items-center justify-between ${isMobile ? 'h-12 px-2' : 'h-16 px-5'}`}>
        <div className="relative">
          <button
            ref={menuRef}
            type="button"
            data-testid="menu-button"
            aria-label="menu"
            aria-haspopup="menu"
            aria-expanded={popover === 'menu'}
            onClick={() => togglePopover('menu')}
            className={iconBtn}
          >
            <FourDotGlyph size={isMobile ? 22 : 24} className="os-glyph-shadow" />
          </button>
        </div>

        <time
          className="os-clock-pill pointer-events-none absolute left-1/2 -translate-x-1/2 font-os-mono font-light tabular-nums text-os-cream"
          style={{ fontSize: isMobile ? 16 : 19, letterSpacing: '0.1em' }}
          data-testid="clock"
        >
          {time}
        </time>

        <div className="relative flex items-center gap-0.5">
          <span role="img" aria-label="signal" className="flex h-9 w-8 items-center justify-center text-os-cream/90">
            <SignalGlyph size={isMobile ? 19 : 21} className="os-glyph-shadow" />
          </span>
          <button
            ref={searchRef}
            type="button"
            data-testid="search-button"
            aria-label="search"
            aria-expanded={popover === 'search'}
            onClick={() => togglePopover('search')}
            className={iconBtn}
          >
            <Search size={isMobile ? 20 : 22} strokeWidth={1.5} className="os-glyph-shadow" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {popover === 'menu' ? <MenuPopover key="menu" anchorRef={menuRef} isMobile={isMobile} /> : null}
        {popover === 'search' ? <SearchPanel key="search" anchorRef={searchRef} /> : null}
      </AnimatePresence>
    </header>
  )
}
