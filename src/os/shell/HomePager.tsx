import { useEffect, useMemo, useState } from 'react'
import { animate, motion, useTransform } from 'motion/react'
import IconPage from './IconPage'
import { pagerHandoff, pagerProgress } from './pagerMotion'
import { usePagerGestures } from './usePagerGestures'
import { iconsOnPage, useCurrentPage, useLayout, usePageCount } from '../store/layout'
import { useSearchQuery } from '../store/ui'
import { APPS } from '../apps/registry'
import { springs, fadeFast } from '../lib/motion'
import { useElementSize } from '../lib/useElementSize'
import { useReducedMotionPref } from '../lib/useReducedMotionPref'
import type { AppId } from '../types'

/** Pure: apps whose label matches the query, across all pages, in layout order. */
function matchingApps(icons: ReturnType<typeof useLayout>, query: string): AppId[] {
  const q = query.trim().toLowerCase()
  return [...icons]
    .sort((a, b) => a.page - b.page || a.index - b.index)
    .map((p) => p.appId)
    .filter((id) => APPS[id].label.includes(q))
}

/** Home grid: pages side by side on a transform-driven track; a flat list of matches while searching. */
export default function HomePager({ isMobile }: { isMobile: boolean }) {
  const icons = useLayout()
  const pageCount = usePageCount()
  const page = useCurrentPage()
  const query = useSearchQuery()
  const reduced = useReducedMotionPref()
  const searching = query.trim().length > 0
  const { ref: sizeRef, width } = useElementSize<HTMLDivElement>()
  const [el, setEl] = useState<HTMLDivElement | null>(null)
  const x = useTransform(pagerProgress, (p) => `${-p * 100}%`)

  usePagerGestures(el, width, !searching)

  // Settle the track whenever the page changes (dots, keys, wheel, swipe).
  useEffect(() => {
    const velocity = pagerHandoff.velocity
    pagerHandoff.velocity = 0
    const controls = animate(pagerProgress, page, reduced ? fadeFast : { ...springs.soft, velocity })
    return () => controls.stop()
  }, [page, reduced])

  const pages = useMemo(
    () => Array.from({ length: pageCount }, (_, i) => iconsOnPage(icons, i).map((p) => p.appId)),
    [icons, pageCount],
  )
  const matches = useMemo(() => (searching ? matchingApps(icons, query) : []), [icons, query, searching])

  if (searching) {
    return (
      <div className="absolute inset-0" data-testid="search-results">
        {matches.length ? (
          <IconPage apps={matches} isMobile={isMobile} />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="os-label-pill font-os-mono text-sm lowercase text-os-cream">nothing here</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      ref={(node) => {
        sizeRef(node)
        setEl(node)
      }}
      className="absolute inset-0 overflow-clip"
      style={{ touchAction: 'none' }}
      data-testid="home-pager"
    >
      <motion.div className="absolute inset-0" style={{ x, willChange: 'transform' }}>
        {pages.map((apps, i) => (
          <div
            key={i}
            className="absolute inset-y-0 w-full"
            style={{ left: `${i * 100}%` }}
            aria-hidden={i !== page}
            inert={i !== page}
            data-testid={`home-page-${i}`}
          >
            <IconPage apps={apps} isMobile={isMobile} />
          </div>
        ))}
      </motion.div>
    </div>
  )
}
