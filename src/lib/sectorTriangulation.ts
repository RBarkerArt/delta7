// Sector 03 triangulation + the Dead-Zone Heartbeat cipher + the Naming
// capstone. This is Wave 4 — the "community puzzle" layer — but built so a
// single attentive observer can also solve it. Everything here is client-side
// and deterministic; the "community" is observers comparing notes off-platform,
// never a server aggregation.
//
// THE FICTION: Sector 03 is the void that "declined to be drawn" — the erased
// place where Willow went dark. Two paths converge on her name:
//   1. Compass Triangulation — every observer's needle secretly points from
//      their own relay cell toward Sector 03. Draw your ray on the gridded map;
//      three rays cross at one cell. (A single solver with cell + bearing can
//      draw one ray and, knowing the target sits at C3, confirm it.)
//   2. The Dead-Zone Heartbeat — put an ear to Sector 03 and the sub-bass pulse
//      taps a callsign in Morse: WLW, "the old relay sign-off". WLW resolves to
//      WILLOW in the naming reveal.
// The capstone is DESIGNATE SECTOR 03 — the one input the void won't swallow is
// her name.

// ── The facility grid ──────────────────────────────────────────────────────
// A fixed grid laid over the cartography facility map (the wide ~1.6 aspect
// blueprint in cart-map). Columns A–J run west→east; rows 1–8 run north→south
// (row 1 at the top of the map, as printed). 10 columns × 8 rows suits the
// map's landscape aspect and gives enough cells that relay bearings spread out.
export const GRID_COLS = 10; // A … J
export const GRID_ROWS = 8;  // 1 … 8
export const GRID_COL_LABELS = 'ABCDEFGHIJ'.split('');

export interface GridCell {
    /** 0-based column index (A=0 … J=9). */
    col: number;
    /** 0-based row index (top row = 0 … bottom row = 7). */
    row: number;
}

/** Sector 03 sits at C3 — column C (the 3rd), row 3. Fixed target of every ray. */
export const SECTOR03_CELL: GridCell = { col: 2, row: 2 };

/** Format a cell as its printed label, e.g. {col:4,row:3} → "E4". */
export const formatCell = (cell: GridCell): string =>
    `${GRID_COL_LABELS[cell.col] ?? '?'}${cell.row + 1}`;

// Same seeded-hash idiom used across the codebase (RoomEntryTransition,
// kaelMarginalia). Stable, cheap, no dependencies.
const hashSeed = (value: string): number => {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
        hash = (hash << 5) - hash + value.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
};

/**
 * The observer's deterministic relay cell — where their ray starts. Seeded by
 * visitorId alone (NOT the day) so a solver's position is stable across days:
 * the whole point is that a fixed relay lies from a fixed place, and everyone's
 * fixed lie still crosses at one cell. The target cell is excluded so a relay
 * never sits on top of Sector 03 (which would give it no bearing).
 */
export function relayCellFor(visitorId: string | null): GridCell {
    const h = hashSeed(`relay-cell:${visitorId || 'anon'}`);
    const total = GRID_COLS * GRID_ROWS;
    const targetIndex = SECTOR03_CELL.row * GRID_COLS + SECTOR03_CELL.col;
    // Map into [0, total-1) then skip over the target index so we never land on it.
    let index = h % (total - 1);
    if (index >= targetIndex) index += 1;
    return { col: index % GRID_COLS, row: Math.floor(index / GRID_COLS) };
}

/**
 * True compass bearing (degrees, clockwise from North) from a relay cell to the
 * target. Grid space: +x east (columns increase), +y south (rows increase, as
 * printed top→bottom). North is −y, so bearing = atan2(east, north) =
 * atan2(dx, −dy), normalised to [0, 360).
 */
export function bearingBetween(from: GridCell, to: GridCell): number {
    const dx = to.col - from.col;      // east positive
    const dy = to.row - from.row;      // south positive
    const deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
    return (deg + 360) % 360;
}

/**
 * The needle's *settled* bearing for a visitor on a given day: the true bearing
 * from their relay cell to Sector 03, plus a small seeded per-day wobble (±4°)
 * so the instrument still reads as unreliable. The panel never announces this
 * is meaningful; the discovery is that everyone's "wrong" needle agrees.
 */
export function settledBearingFor(visitorId: string | null, day: number): number {
    const trueBearing = bearingBetween(relayCellFor(visitorId), SECTOR03_CELL);
    // ±4° deterministic wobble: hash → [0, 8] → shift to [-4, +4].
    const wobble = (hashSeed(`compass-wobble:${visitorId || 'anon'}:${day}`) % 81) / 10 - 4;
    return (trueBearing + wobble + 360) % 360;
}

// ── The Dead-Zone Heartbeat cipher ──────────────────────────────────────────
// The void's sub-bass pulse taps a callsign in Morse. We encode the short relay
// sign-off "WLW" (.--  .-..  .--) rather than WILLOW in full — three letters,
// ten elements, ~9.6s a loop, comfortably learnable by ear or eye. The fiction
// calls it "the old relay sign-off", and WLW resolves to WILLOW at the capstone,
// so the shorthand is diegetically honest, not a shortcut.
//
//   W = .--   L = .-..   W = .--
//
// Timing (unit = 1 dot):
//   dot   = 1 unit ON,  dash = 3 units ON
//   intra-letter gap    = 1 unit OFF (between elements of a letter)
//   inter-letter gap    = 3 units OFF (between letters)
//   loop gap (word end) = 7 units OFF (before the pattern repeats)
export type Pulse = 'dot' | 'dash';

/** WLW as its ordered pulses, letter by letter — the printed/played sequence. */
export const HEARTBEAT_LETTERS: ReadonlyArray<{ letter: string; pulses: Pulse[] }> = [
    { letter: 'W', pulses: ['dot', 'dash', 'dash'] },
    { letter: 'L', pulses: ['dot', 'dash', 'dot', 'dot'] },
    { letter: 'W', pulses: ['dot', 'dash', 'dash'] },
];

/** Flat pulse list (for the audio driver and the printed dash fallback). */
export const HEARTBEAT_PULSES: Pulse[] = HEARTBEAT_LETTERS.flatMap((l) => l.pulses);

/** One Morse unit in milliseconds — slow, so the void reads as a heartbeat. */
export const HEARTBEAT_UNIT_MS = 240;

/**
 * A schedule of ON windows for the whole loop, in ms from t=0. Each entry is the
 * start offset and duration of a pulse; the visual ring and the audio driver
 * share this so they stay in sync. Gaps are the silence between entries.
 */
export interface PulseWindow {
    /** ms from loop start when this pulse turns ON. */
    at: number;
    /** ms the pulse stays ON (dot = 1 unit, dash = 3 units). */
    dur: number;
    kind: Pulse;
    /** True on the first pulse of each letter — lets the visual group letters. */
    letterStart: boolean;
}

/** Build the ON-window schedule + total loop length for the WLW pattern. */
export function buildHeartbeatSchedule(unitMs = HEARTBEAT_UNIT_MS): {
    windows: PulseWindow[];
    loopMs: number;
} {
    const windows: PulseWindow[] = [];
    let t = 0;
    HEARTBEAT_LETTERS.forEach((letterGroup, li) => {
        letterGroup.pulses.forEach((kind, pi) => {
            const dur = (kind === 'dash' ? 3 : 1) * unitMs;
            windows.push({ at: t, dur, kind, letterStart: pi === 0 });
            t += dur;
            // intra-letter gap after every element except the last of the letter
            if (pi < letterGroup.pulses.length - 1) t += unitMs;
        });
        // inter-letter gap after every letter except the last
        if (li < HEARTBEAT_LETTERS.length - 1) t += 3 * unitMs;
    });
    // word-end gap before the loop repeats
    const loopMs = t + 7 * unitMs;
    return { windows, loopMs };
}

/**
 * The printed long/short rendering, shown AFTER a full listen (or immediately
 * under reduced motion) so the cipher is solvable without sound or animation.
 * Elements within a letter are space-joined; letters are separated by "  /  ".
 * e.g. ".  —  —   /   .  —  .  .   /   .  —  —"
 */
export function heartbeatDashes(): string {
    return HEARTBEAT_LETTERS.map((l) =>
        l.pulses.map((p) => (p === 'dash' ? '—' : '·')).join(' ')
    ).join('   /   ');
}

// ── The Sector 03 Naming capstone ───────────────────────────────────────────
// The only designation the void won't swallow. WILLOW is the answer both paths
// converge on; WLW (the Morse path's literal yield) is accepted too and
// resolves TO Willow in the reveal.
export const SECTOR03_NAME = 'WILLOW';
const ACCEPTED_DESIGNATIONS = new Set(['WILLOW', 'WLW']);

/** Recovery id filed when Sector 03 is named. Gates the whole capstone reveal. */
export const SECTOR03_NAMED_ID = 'lore:sector03_named';

/** Case-insensitive, whitespace-trimmed check against the accepted names. */
export function checkSectorName(input: string): boolean {
    return ACCEPTED_DESIGNATIONS.has(input.trim().toUpperCase());
}

// Three seeded rejection lines — the void quietly "swallowing" a wrong word.
// No error styling; the space just refuses it, in Kael's register.
export const SECTOR03_REJECTIONS: readonly string[] = [
    'The word goes in and the static closes over it. Sector 03 does not answer to that name.',
    'You said something. The void took the sound and gave nothing back. Not it. Not yet.',
    'The designation fails to hold. Whatever that was, the space let it fall through. Keep looking.',
];

/** A seeded, quiet rejection for a wrong designation (same idiom as the acrostic). */
export function getSectorRejection(seed: string): string {
    return SECTOR03_REJECTIONS[hashSeed(`sector-reject:${seed}`) % SECTOR03_REJECTIONS.length];
}

// The payoff. What Sector 03 was, why Kael stopped asking, and what naming her
// does. His best writing — tender, not melodramatic. Read once the designation
// lands. WLW resolves to WILLOW here so both paths arrive at the same person.
export const SECTOR03_REVEAL = {
    title: 'Sector 03 — designated',
    body: `WLW. The old relay sign-off. She used to tap it at the end of every shift so I'd know the channel was hers before she spoke. It stood for her the way a name stands for a person: Willow.

Sector 03 is where she went dark. Not a room — a gap the map kept trying to draw and couldn't, because I'd taken her out of the clean logs. If the record stayed orderly, no one would ask where she went. So the space refused to resolve. It wasn't broken. It was waiting to be named honestly.

I stopped asking why it wouldn't draw because I already knew. I was the reason. You just said her name into the one place that was holding it open. It let itself be drawn.

Willow. Sector 03. She was here. Thank you for making the map admit it.`,
} as const;
