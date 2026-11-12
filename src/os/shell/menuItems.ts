import type { Settings } from '../store/settings'

/**
 * The four-dot menu, as data. Add items here; MenuPopover renders each `kind`.
 * This menu is the "touch of the real world": plain, small, ordinary.
 */
/** `only`: the item is shown on that layout alone (e.g. haptics only do anything on phones). */
type Only = { only?: 'phone' | 'desktop' }

export type MenuItem =
  /** `placeholder`: not available yet (shown muted, does nothing). `newTab`: opens in a new tab so the OS stays put. */
  | ({ kind: 'link'; id: string; label: string; href: string; placeholder?: boolean; newTab?: boolean } & Only)
  | ({ kind: 'account'; id: string; label: string } & Only)
  | ({ kind: 'wallpaper'; id: string; label: string } & Only)
  | ({ kind: 'toggle'; id: string; label: string; setting: keyof Pick<Settings, 'sound' | 'reduceMotion' | 'vibrate'>; hint?: string } & Only)
  | ({ kind: 'about'; id: string; label: string; text: string; version: string } & Only)
  | ({ kind: 'action'; id: string; label: string; action: 'reset-windows' } & Only)
  | ({ kind: 'separator'; id: string } & Only)

export function itemsFor(isMobile: boolean): MenuItem[] {
  return MENU_ITEMS.filter((i) => !i.only || i.only === (isMobile ? 'phone' : 'desktop'))
}

export const MENU_ITEMS: MenuItem[] = [
  // TODO(owner): Help, Sign in and Sign out are shown but unavailable until their behaviour is decided.
  { kind: 'link', id: 'help', label: 'Help', href: '#', placeholder: true },
  // TODO(auth): sign in / sign out become the Firebase login later. No Firebase calls here.
  { kind: 'account', id: 'account', label: 'Account' },
  { kind: 'separator', id: 's1' },
  { kind: 'wallpaper', id: 'wallpaper', label: 'Wallpaper' },
  { kind: 'toggle', id: 'sound', label: 'Sound', setting: 'sound' },
  { kind: 'toggle', id: 'reduce-motion', label: 'Reduce motion', setting: 'reduceMotion' },
  { kind: 'toggle', id: 'haptics', label: 'Haptics', setting: 'vibrate', only: 'phone' },
  { kind: 'action', id: 'reset-windows', label: 'Reset window positions', action: 'reset-windows', only: 'desktop' },
  { kind: 'separator', id: 's2' },
  // Pages of the live site: a new tab, so the player never loses the OS.
  { kind: 'link', id: 'privacy', label: 'Privacy', href: '/privacy', newTab: true },
  { kind: 'link', id: 'terms', label: 'Terms', href: '/terms', newTab: true },
  // TODO(copy): about text is a stand-in.
  { kind: 'about', id: 'about', label: 'About Delta7', text: 'a quiet place for your things.', version: 'version 1.0' },
]
