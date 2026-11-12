import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { motion } from 'motion/react'
import Switch from './Switch'
import WallpaperPicker from './WallpaperPicker'
import { itemsFor } from './menuItems'
import type { MenuItem } from './menuItems'
import { usePopoverDismiss } from './usePopoverDismiss'
import { useMenuKeys } from './useMenuKeys'
import { closePopover } from '../store/ui'
import { resetWindowPositions } from '../store/windows'
import { setReduceMotion, setSound, setVibrate, useSettings } from '../store/settings'
import type { Settings } from '../store/settings'
import { springs, fadeFast } from '../lib/motion'
import { useReducedMotionPref } from '../lib/useReducedMotionPref'

const SETTERS: Record<'sound' | 'reduceMotion' | 'vibrate', (v: boolean) => void> = {
  sound: setSound,
  reduceMotion: setReduceMotion,
  vibrate: setVibrate,
}

const row = 'os-tap-h flex w-full items-center justify-between gap-4 rounded-[9px] px-3 py-[7px] text-left text-[13.5px] text-os-ink'
const rowHover = 'outline-none hover:bg-os-ink/[0.05] focus-visible:bg-os-ink/[0.06] focus-visible:ring-1 focus-visible:ring-os-ink/20'
/** Shown but not available yet: muted, no hover or press, skipped by the keyboard. */
const unavailable = 'cursor-default opacity-50 outline-none'

/** Clicking anywhere on the row (label included) flips the switch; the switch itself stays the focusable control. */
function ToggleRow({ item }: { item: Extract<MenuItem, { kind: 'toggle' }> }) {
  const value = useSettings((s: Settings) => s[item.setting])
  return (
    <div
      className={`${row} cursor-default hover:bg-os-ink/[0.05]`}
      onClick={(e) => {
        if ((e.target as Element).closest('button')) return // the switch handles its own click
        SETTERS[item.setting](!value)
      }}
    >
      <span>
        {item.label}
        {item.hint ? <span className="ml-1.5 font-os-mono text-[11px] os-text-soft">{item.hint}</span> : null}
      </span>
      <Switch checked={value} onChange={SETTERS[item.setting]} label={item.label} testId={`menu-toggle-${item.id}`} />
    </div>
  )
}

const ACTIONS: Record<Extract<MenuItem, { kind: 'action' }>['action'], () => void> = {
  'reset-windows': resetWindowPositions,
}

/** A plain command row; confirms quietly in place (the label reads `done` for a moment). */
function ActionRow({ item }: { item: Extract<MenuItem, { kind: 'action' }> }) {
  const [done, setDone] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )
  return (
    <button
      type="button"
      className={`${row} ${rowHover}`}
      data-testid={`menu-${item.id}`}
      onClick={() => {
        ACTIONS[item.action]()
        setDone(true)
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => setDone(false), 1400)
      }}
    >
      <span aria-live="polite">{done ? 'done' : item.label}</span>
    </button>
  )
}

function Item({ item }: { item: MenuItem }) {
  const [aboutOpen, setAboutOpen] = useState(false)
  switch (item.kind) {
    case 'separator':
      return <div className="mx-3 my-1.5 h-px bg-os-ink/[0.08]" role="separator" />
    case 'link':
      if (item.placeholder) {
        return (
          <button type="button" aria-disabled="true" tabIndex={-1} className={`${row} ${unavailable}`} data-testid={`menu-${item.id}`}>
            {item.label}
          </button>
        )
      }
      return (
        <a
          href={item.href}
          className={`${row} ${rowHover}`}
          data-testid={`menu-${item.id}`}
          {...(item.newTab ? { target: '_blank', rel: 'noopener' } : {})}
        >
          {item.label}
        </a>
      )
    case 'account':
      return (
        <div className="px-3 py-[7px]">
          <div className="text-[13.5px] text-os-ink">{item.label}</div>
          <div className="mt-1 flex gap-1.5">
            {/* TODO(auth): placeholders, no Firebase. Unavailable until their behaviour is decided. */}
            {['Sign in', 'Sign out'].map((l) => (
              <button
                key={l}
                type="button"
                aria-disabled="true"
                tabIndex={-1}
                className={`os-tap-h rounded-[7px] border border-os-ink/15 bg-white/50 px-2.5 py-1 text-[13px] os-text-soft ${unavailable}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      )
    case 'wallpaper':
      return (
        <div className="px-3 py-[7px]">
          <div className="mb-2 text-[13.5px] text-os-ink">{item.label}</div>
          <WallpaperPicker />
        </div>
      )
    case 'toggle':
      return <ToggleRow item={item} />
    case 'action':
      return <ActionRow item={item} />
    case 'about':
      return (
        <div>
          <button
            type="button"
            className={`${row} ${rowHover}`}
            aria-expanded={aboutOpen}
            onClick={() => setAboutOpen((o) => !o)}
            data-testid="menu-about"
          >
            {item.label}
          </button>
          {aboutOpen ? (
            <div className="px-3 pb-2 font-os-mono text-[11.5px] os-text-soft" data-testid="menu-about-text">
              <p>{item.text}</p>
              <p className="mt-0.5">{item.version}</p>
            </div>
          ) : null}
        </div>
      )
  }
}

/** Four-dot menu popover, rendered from MENU_ITEMS (minus what doesn't apply to this layout). */
export default function MenuPopover({ anchorRef, isMobile }: { anchorRef: RefObject<HTMLButtonElement | null>; isMobile: boolean }) {
  const panelRef = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotionPref()
  const close = useCallback(() => closePopover(), [])
  usePopoverDismiss(panelRef, anchorRef, close)
  useMenuKeys(panelRef, anchorRef)
  return (
    <motion.div
      ref={panelRef}
      data-popover
      role="menu"
      aria-label="menu"
      data-testid="menu-popover"
      initial={{ opacity: 0, y: -6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.98, transition: fadeFast }}
      transition={reduced ? fadeFast : springs.snappy}
      style={{ transformOrigin: 'top left' }}
      className="os-panel absolute left-3 top-[calc(100%+4px)] z-50 w-[260px] origin-top-left rounded-[15px] p-1.5 font-os-sans"
    >
      {itemsFor(isMobile).map((item) => (
        <Item key={item.id} item={item} />
      ))}
    </motion.div>
  )
}
