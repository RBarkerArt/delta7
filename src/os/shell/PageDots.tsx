import { motion } from 'motion/react'
import { setPage, useCurrentPage, usePageCount } from '../store/layout'
import { useSearchQuery } from '../store/ui'
import { springs } from '../lib/motion'

/** Bottom-centre page dots. Nothing else lives at the bottom. */
export default function PageDots({ isMobile }: { isMobile: boolean }) {
  const count = usePageCount()
  const page = useCurrentPage()
  const query = useSearchQuery()
  if (query.trim() || count < 2) return null
  return (
    <nav
      aria-label="pages"
      className="os-chrome absolute inset-x-0 flex justify-center"
      style={{ bottom: isMobile ? 'calc(env(safe-area-inset-bottom, 0px) + 34px)' : 30 }}
    >
      <div className="flex items-center gap-1">
        {Array.from({ length: count }, (_, i) => (
          <button
            key={i}
            type="button"
            data-testid={`page-dot-${i}`}
            aria-label={`page ${i + 1}`}
            aria-current={i === page ? 'page' : undefined}
            onClick={() => setPage(i)}
            className="os-tap flex h-6 w-6 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-os-cream/70"
          >
            <motion.span
              className="block h-2 w-2 rounded-full bg-os-cream shadow-[0_0_6px_rgba(60,36,44,0.25)]"
              initial={false}
              animate={{ scale: i === page ? 1.25 : 0.82, opacity: i === page ? 0.95 : 0.4 }}
              transition={springs.snappy}
            />
          </button>
        ))}
      </div>
    </nav>
  )
}
