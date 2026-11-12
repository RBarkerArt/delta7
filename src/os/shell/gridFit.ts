/** Home grid metrics, measured from AppIcon (button incl. label pill and open dot) and IconPage's gaps. */
const METRICS = {
  phone: { col: 82, gapX: 4, row: 106, gapY: 20, padX: 12, baseCols: 4 },
  desktop: { col: 136, gapX: 36, row: 158, gapY: 32, padX: 12, baseCols: 5 },
} as const

export interface GridFit {
  cols: number
  rows: number
  /** Icons per screen; more go to the next page. */
  capacity: number
  /** Phone: space above the first row. Desktop: vertical nudge from centre (negative = up). */
  offsetY: number
  /** Grid width in px (desktop rows wrap inside it). */
  width: number
}

/**
 * How the home grid fits the space it has (`width` × `height` of the area between the top bar and the page dots).
 * Rows follow the available height; a wide, short screen (landscape, on-screen keyboard) gets more columns instead of
 * a cut-off row; whatever still doesn't fit goes to the next page. `most` is the largest number of icons on a page.
 */
export function gridFit(width: number, height: number, isMobile: boolean, most: number, viewportH: number): GridFit {
  const m = isMobile ? METRICS.phone : METRICS.desktop
  const fitCols = Math.max(1, Math.floor((width - 2 * m.padX + m.gapX) / (m.col + m.gapX)))
  const fitRows = Math.max(1, Math.floor((height - 16 + m.gapY) / (m.row + m.gapY)))
  const cols = Math.min(fitCols, Math.max(m.baseCols, Math.ceil(most / fitRows)))
  const rows = Math.min(fitRows, Math.max(1, Math.ceil(most / cols)))
  const contentH = rows * m.row + (rows - 1) * m.gapY
  const slack = Math.max(0, height - contentH)
  const offsetY = isMobile
    ? Math.round(Math.max(8, Math.min(0.13 * viewportH, slack - 8)))
    : -Math.round(Math.min(0.04 * viewportH, slack / 2))
  return { cols, rows: fitRows, capacity: cols * fitRows, offsetY, width: cols * m.col + (cols - 1) * m.gapX }
}
