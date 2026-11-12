import type { Settings } from '../store/settings'

/**
 * The four-dot menu, as data. Add items here; MenuPopover renders each `kind`.
 * This menu is the "touch of the real world": plain, small, ordinary. All wording is lowercase, like the rest of the OS.
 */
/**
 * `only`: the item is shown on that layout alone (e.g. haptics only do anything on phones).
 * `hidden`: kept in the data but not shown; set it to false (or remove it) to bring the item back.
 */
type Common = { only?: 'phone' | 'desktop'; hidden?: boolean }

export type MenuItem =
  /** `placeholder`: not available yet (shown muted, does nothing). `newTab`: opens in a new tab so the OS stays put. */
  | ({ kind: 'link'; id: string; label: string; href: string; placeholder?: boolean; newTab?: boolean } & Common)
  | ({ kind: 'account'; id: string; label: string } & Common)
  | ({ kind: 'wallpaper'; id: string; label: string } & Common)
  | ({ kind: 'toggle'; id: string; label: string; setting: keyof Pick<Settings, 'sound' | 'reduceMotion' | 'vibrate'>; hint?: string } & Common)
  | ({ kind: 'about'; id: string; label: string; text: string; version: string } & Common)
  | ({ kind: 'action'; id: string; label: string; action: 'reset-windows' } & Common)
  | ({ kind: 'separator'; id: string } & Common)

/** No separator at the start or end, and never two in a row (hidden items can leave one stranded). */
function tidySeparators(items: MenuItem[]): MenuItem[] {
  const out: MenuItem[] = []
  for (const item of items) {
    if (item.kind === 'separator' && (out.length === 0 || out[out.length - 1].kind === 'separator')) continue
    out.push(item)
  }
  while (out.length > 0 && out[out.length - 1].kind === 'separator') out.pop()
  return out
}

export function itemsFor(isMobile: boolean): MenuItem[] {
  return tidySeparators(MENU_ITEMS.filter((i) => !i.hidden && (!i.only || i.only === (isMobile ? 'phone' : 'desktop'))))
}

export const MENU_ITEMS: MenuItem[] = [
  // TODO(owner): help and sign in / sign out are hidden until they work.
  { kind: 'link', id: 'help', label: 'help', href: '#', placeholder: true, hidden: true },
  // TODO(auth): sign in / sign out become the Firebase login later. No Firebase calls here.
  { kind: 'account', id: 'account', label: 'account', hidden: true },
  { kind: 'separator', id: 's1' },
  { kind: 'wallpaper', id: 'wallpaper', label: 'wallpaper' },
  { kind: 'toggle', id: 'sound', label: 'sound', setting: 'sound' },
  { kind: 'toggle', id: 'reduce-motion', label: 'reduce motion', setting: 'reduceMotion' },
  { kind: 'toggle', id: 'haptics', label: 'haptics', setting: 'vibrate', only: 'phone' },
  { kind: 'action', id: 'reset-windows', label: 'reset window positions', action: 'reset-windows', only: 'desktop' },
  { kind: 'separator', id: 's2' },
  // Pages of the live site: a new tab, so the player never loses the OS.
  // TODO(owner): hidden until the owner has checked the live pages.
  { kind: 'link', id: 'privacy', label: 'privacy', href: '/privacy', newTab: true, hidden: true },
  { kind: 'link', id: 'terms', label: 'terms', href: '/terms', newTab: true, hidden: true },
  // TODO(copy): about text is a stand-in.
  { kind: 'about', id: 'about', label: 'about delta7', text: 'a quiet place for your things.', version: 'version 1.0' },
]
