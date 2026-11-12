/**
 * The tuner's signal: the target frequency and every tuning constant around it.
 *
 * This is the ONLY file in `src/os/` that spells the target out. Everything else (readouts, logs, aria text, tests,
 * comments) derives from `SIGNAL_TARGET` or says "the target". Before the player's first lock the UI never shows it.
 * TODO(engine): later the target may come from the story config instead of a constant.
 */

/** The frequency the player has to find (MHz). */
export const SIGNAL_TARGET = 1.42

/** The band the dial covers (MHz). */
export const FREQ_MIN = 0.8
export const FREQ_MAX = 2.2

/** Where the dial sits before the player has touched it. TODO(engine): could come from the day script. */
export const START_VALUE = 1.1

/** |value − target| ≤ this counts as "in the lock window". */
export const LOCK_WINDOW = 0.005
/** Time the value must stay in the window before it locks. */
export const HOLD_MS = 1500
/** During a bad stretch the lock takes about twice as long to land. */
export const BAD_STRETCH_HOLD_MS = 3000

/** On release / wheel idle, values this close to the target glide into it. */
export const MAGNET_RANGE = 0.02
/** Half-width of the sticky "notch" around the target while dragging. */
export const NOTCH_RANGE = 0.03
/** While locked, a drag must travel this far (in raw units) before the lock lets go. */
export const LOCKED_DETENT = 0.02

/**
 * clarity(): two soft bells added together. A broad, faint shoulder (so a patient sweep notices a zone where the
 * static thins) and a narrow core (where it really clears). ≈0.10 at ±0.2, ≈0.30 at ±0.1, ≈0.65 at ±0.05, 1 at the target.
 */
export const CLARITY_WIDE_SIGMA = 0.18
export const CLARITY_WIDE_WEIGHT = 0.35
export const CLARITY_CORE_SIGMA = 0.06

/** Clarity bucket edges (for the screen-reader words and the dashboard): none < faint < clearer < clear. */
export const CLARITY_FAINT = 0.08
export const CLARITY_CLEARER = 0.3
export const CLARITY_CLEAR = 0.7
