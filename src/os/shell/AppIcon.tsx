import { useRef } from 'react'
import { motion } from 'motion/react'
import HeartbeatHalo from './HeartbeatHalo'
import { useHeartbeat } from './useHeartbeat'
import { getApp } from '../apps/registry'
import { openApp, registerIconEl, useIsOpen } from '../store/windows'
import { useHasNew, usePulseNonce } from '../store/signal'
import { useBadStretch } from '../store/coherence'
import { haptic } from '../store/settings'
import { closePopover, uiStore } from '../store/ui'
import { springs, fadeFast } from '../lib/motion'
import { useReducedMotionPref } from '../lib/useReducedMotionPref'
import type { AppId } from '../types'

interface Props {
  appId: AppId
  isMobile: boolean
}

export default function AppIcon({ appId, isMobile }: Props) {
  const app = getApp(appId)
  const isOpen = useIsOpen(appId)
  const reduced = useReducedMotionPref()
  const hasNew = useHasNew()
  const nonce = usePulseNonce()
  const badStretch = useBadStretch()
  const beatRef = useRef<HTMLDivElement>(null)
  const haloRef = useRef<HTMLDivElement>(null)
  const isDelta7 = appId === 'delta7'

  useHeartbeat(beatRef, haloRef, { active: isDelta7 && hasNew, badStretch, reduced, nonce })

  const tile = isMobile ? 66 : 112
  const glyph = Math.round(tile * 0.42)
  // ~1.5–1.75px rendered line regardless of glyph size (lucide scales stroke with its 24-unit viewBox).
  const stroke = (1.7 * 24) / glyph

  return (
    <button
      type="button"
      data-testid={`app-icon-${appId}`}
      aria-label={`open ${app.label}`}
      onClick={() => {
        haptic()
        if (uiStore.get().popover === 'search') closePopover()
        openApp(appId)
      }}
      className="group flex flex-col items-center rounded-[22px] outline-none"
      style={{ width: isMobile ? 82 : 136 }}
    >
      <div ref={beatRef} className="relative" style={{ width: tile, height: tile }}>
        {isDelta7 ? <HeartbeatHalo ref={haloRef} /> : null}
        <motion.div
          ref={(el) => registerIconEl(appId, el)}
          tabIndex={-1}
          whileTap={reduced ? { opacity: 0.85 } : { scale: 0.94 }}
          transition={reduced ? fadeFast : springs.snappy}
          className="os-tile relative flex h-full w-full items-center justify-center text-os-cream group-focus-visible:ring-2 group-focus-visible:ring-os-cream/80 group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-transparent"
          style={{ ['--tint' as string]: app.tint, borderRadius: Math.round(tile * 0.23) }}
        >
          <app.Glyph size={glyph} strokeWidth={stroke} className="os-glyph-shadow relative" />
        </motion.div>
      </div>
      <span
        className={`os-label-shadow os-label-halo mt-2.5 max-w-full font-os-mono lowercase text-os-cream ${isMobile ? 'text-[12px]' : 'text-[13.5px] tracking-[0.02em]'}`}
      >
        <span className="block truncate">{app.label}</span>
      </span>
      <span
        aria-hidden="true"
        className={`mt-1 h-1 w-1 rounded-full bg-os-cream/80 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
      />
    </button>
  )
}
