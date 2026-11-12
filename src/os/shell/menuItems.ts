import type { Settings } from '../store/settings'

/**
 * The four-dot menu, as data. Add items here; MenuPopover renders each `kind`.
 * This menu is the "touch of the real world": plain, small, ordinary.
 */
export type MenuItem =
  | { kind: 'link'; id: string; label: string; href: string; placeholder?: boolean }
  | { kind: 'account'; id: string; label: string }
  | { kind: 'wallpaper'; id: string; label: string }
  | { kind: 'toggle'; id: string; label: string; setting: keyof Pick<Settings, 'sound' | 'reduceMotion' | 'vibrate'>; hint?: string }
  | { kind: 'about'; id: string; label: string; text: string; version: string }
  | { kind: 'action'; id: string; label: string; action: 'reset-windows' }
  | { kind: 'separator'; id: string }

export const MENU_ITEMS: MenuItem[] = [
  { kind: 'link', id: 'help', label: 'Help', href: '#', placeholder: true },
  // TODO(auth): sign in / sign out become the Firebase login later. No Firebase calls here.
  { kind: 'account', id: 'account', label: 'Account' },
  { kind: 'separator', id: 's1' },
  { kind: 'wallpaper', id: 'wallpaper', label: 'Wallpaper' },
  { kind: 'toggle', id: 'sound', label: 'Sound', setting: 'sound' },
  { kind: 'toggle', id: 'reduce-motion', label: 'Reduce motion', setting: 'reduceMotion' },
  { kind: 'toggle', id: 'haptics', label: 'Haptics', setting: 'vibrate', hint: 'phones' },
  { kind: 'action', id: 'reset-windows', label: 'Reset window positions', action: 'reset-windows' },
  { kind: 'separator', id: 's2' },
  { kind: 'link', id: 'privacy', label: 'Privacy', href: '/privacy' },
  { kind: 'link', id: 'terms', label: 'Terms', href: '/terms' },
  // TODO(copy): about text is a stand-in.
  { kind: 'about', id: 'about', label: 'About Delta7', text: 'a quiet place for your things.', version: 'version 1.0' },
]
