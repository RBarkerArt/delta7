/** Original, quiet title-bar glyphs: same ink, thin strokes, drawn on a 16-unit grid. */

const base = {
  width: 16,
  height: 16,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.4,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

/** Short, low dash. */
export function MinimizeGlyph() {
  return (
    <svg {...base}>
      <path d="M4.5 11h7" />
    </svg>
  )
}

/** Small rounded outline square. */
export function MaximizeGlyph() {
  return (
    <svg {...base}>
      <rect x="3.5" y="3.5" width="9" height="9" rx="2.4" />
    </svg>
  )
}

/** Two offset rounded outlines. */
export function RestoreGlyph() {
  return (
    <svg {...base}>
      <rect x="3" y="5.5" width="7.5" height="7.5" rx="2" />
      <path d="M6 3.4h4.6a2 2 0 0 1 2 2V10" />
    </svg>
  )
}

/** Thin ×. */
export function CloseGlyph() {
  return (
    <svg {...base}>
      <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
    </svg>
  )
}
