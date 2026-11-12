const CANDIDATES =
  'a[href], button, input, select, textarea, summary, audio[controls], video[controls], [tabindex], [contenteditable="true"]'

/** Keyboard-reachable elements inside `root`, in document order. */
export function tabbablesIn(root: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = []
  for (const el of root.querySelectorAll<HTMLElement>(CANDIDATES)) {
    if (el.tabIndex < 0 || (el as HTMLButtonElement).disabled) continue
    if (el.closest('[inert]') || el.getClientRects().length === 0) continue
    if (getComputedStyle(el).visibility === 'hidden') continue
    out.push(el)
  }
  return out
}

function follows(a: Node, b: Node): boolean {
  return (b.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
}

/** Next/previous tabbable after `from` in `list`, wrapping at the ends (`from` need not be in the list). */
export function stepTabbable(list: HTMLElement[], from: Element, back: boolean): HTMLElement {
  const i = list.indexOf(from as HTMLElement)
  if (i >= 0) return list[(i + (back ? -1 : 1) + list.length) % list.length]
  if (back) {
    for (let j = list.length - 1; j >= 0; j--) if (follows(from, list[j])) return list[j]
    return list[list.length - 1]
  }
  return list.find((el) => follows(el, from)) ?? list[0]
}
