/** Original line glyphs for the shell (not stock icons). All use currentColor. */

interface GlyphProps {
  size?: number
  strokeWidth?: number
  className?: string
}

/** Delta7: a thin, slightly uneven waveform that settles at both ends. */
export function WaveGlyph({ size = 24, strokeWidth = 1.5, className }: GlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M1.75 12h2.4c.9 0 1.1-1.6 1.9-1.6s1 3.4 1.9 3.4 1.2-7.6 2.2-7.6 1.25 11.6 2.3 11.6 1.15-8.4 2.1-8.4 1 5.3 1.9 5.3.95-2.6 1.75-2.6.8 1 1.5 1h2.6" />
    </svg>
  )
}

/** Four-dot (2×2) menu mark. */
export function FourDotGlyph({ size = 20, className }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
      <circle cx="6" cy="6" r="2.35" />
      <circle cx="14" cy="6" r="2.35" />
      <circle cx="6" cy="14" r="2.35" />
      <circle cx="14" cy="14" r="2.35" />
    </svg>
  )
}

/** Network signal: three soft arcs rising from a point, drawn as thin strokes. */
export function SignalGlyph({ size = 20, strokeWidth = 1.5, className }: GlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 16.5v-2" />
      <path d="M8 16.5v-5" />
      <path d="M12 16.5v-8" />
      <path d="M16 16.5v-11" opacity="0.45" />
    </svg>
  )
}
