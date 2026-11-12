/**
 * Geometry of the phone app sheet, shared by the sheet itself and by anything that must sit clear of its header
 * (the notification banner). All px values are added to the top safe-area inset.
 */

/** The sheet's top edge sits this far below the top safe-area inset (just under the top bar). */
export const SHEET_TOP_PX = 48
/** Height of the sheet's top strip (grab handle + close button). */
export const SHEET_STRIP_PX = 36
/** The close button's hit box: anchored to the strip's top edge, it reaches a few px below the strip. */
export const SHEET_CLOSE_HIT_PX = 44
/** Where the sheet's header (strip and close hit box, whichever reaches lower) ends, from the top safe-area inset. */
export const SHEET_HEADER_BOTTOM_PX = SHEET_TOP_PX + Math.max(SHEET_STRIP_PX, SHEET_CLOSE_HIT_PX)

/** CSS `top` of the sheet box, safe area included. */
export const SHEET_TOP_CSS = `calc(env(safe-area-inset-top, 0px) + ${SHEET_TOP_PX}px)`
