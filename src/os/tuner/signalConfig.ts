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

/* ---------- zones: how close the dial is, by distance from the target (MHz) ---------- */

/** Within this distance the static starts to thin: "faint". Outside it there is nothing but static. */
export const ZONE_FAINT = 0.08
/** Within this distance the signal is "clearer". */
export const ZONE_CLEARER = 0.03
/** Within this distance the signal is "clear". */
export const ZONE_CLEAR = 0.01

/**
 * clarity() at each zone's outer edge. 0 at the faint edge (and everywhere outside it), rising through the zones,
 * exactly 1 at the target. The curve is continuous and never rises with distance.
 */
export const CLARITY_AT_FAINT = 0
export const CLARITY_AT_CLEARER = 0.35
export const CLARITY_AT_CLEAR = 0.7

/* ---------- assists: every pull towards the target ---------- */

/**
 * The ONLY range any assist works in: the release magnet, the wheel-idle glide, tap-to-tune and the sticky notch
 * that slows the dial. Nothing tugs, slows or glides the dial towards the target from further away than this.
 */
export const PULL_RANGE = 0.008
/**
 * The magnet only takes a dial that is (nearly) at rest: dial speed at release / wheel idle, in MHz per second.
 * A flick, or a drag still moving faster than this, sails past.
 */
export const PULL_MAX_SPEED = 0.1
/** Inside PULL_RANGE the dial moves as (distance / range) ^ this: 2 → it slows smoothly to a stop at the target. */
export const NOTCH_POWER = 2
/** Old names, kept for existing imports: both are the pull range now. */
export const MAGNET_RANGE = PULL_RANGE
export const NOTCH_RANGE = PULL_RANGE

/** While locked, a drag must travel this far (in raw units) before the lock lets go. */
export const LOCKED_DETENT = 0.02

/* ---------- the hand (direction- and position-neutral: the same everywhere on the dial) ---------- */

/**
 * Fine control: a slowly moving hand moves the dial less than the hand (like a vernier), so inching is possible
 * on a thumb or a trackpad. Hand speed in px per ms; gain applied to the dial.
 */
export const FINE_SPEED = 0.06
export const COARSE_SPEED = 0.3
export const FINE_GAIN = 0.45

/** Dial scale (px per MHz) from the tuner card's width. */
export const PX_PER_UNIT_MIN = 840
export const PX_PER_UNIT_MAX = 1100
export const PX_PER_UNIT_PER_WIDTH = 2
