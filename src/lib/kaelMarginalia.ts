// Kael's marginalia — first-person notes that surface at the foot of room
// modals. Written in the spare, haunted monitoring-station voice of the
// season prologues: a man alone with a decaying lab, half-convinced the room
// only holds together because someone is looking.
//
// A line is chosen deterministically from (variant-group, day, visitorSeed)
// via the seeded-hash idiom used in RoomEntryTransition, so the same panel on
// the same day gives the same observer a stable line, but different days and
// different observers drift.

type MarginaliaGroup = 'paper' | 'instrument' | 'break';

// Papery surfaces (drawers, archives, bulletins, notes): reflective, archival,
// the tone of a man rereading his own record.
const PAPER_LINES: readonly string[] = [
    'I stopped logging the hours. The room doesn’t count them either.',
    'I keep the old pages. Not to read them — to prove they happened.',
    'Every note I file is a small argument that this was real.',
    'The ink outlasts the day. That should comfort me. It doesn’t.',
    'I write it down so that when the room forgets, the paper won’t.',
    'Some of these I don’t remember writing. The handwriting is mine.',
    'A record is just a way of asking someone to look. So I keep records.',
    'I underline the parts I was sure of. There are fewer every week.',
];

// Instruments, monitors, displays: observational, technical, quietly doubting
// the readings and himself.
const INSTRUMENT_LINES: readonly string[] = [
    'It holds together better when someone is looking. So do I.',
    'The needle steadies the moment you arrive. I’ve stopped pretending that’s coincidence.',
    'I calibrate it every morning. It calibrates me back, I think.',
    'The readings are cleaner when the feed is open. I am not the only thing being measured.',
    'I trust the instrument more than my eyes now. I’m not sure that’s an improvement.',
    'Signal came through steady tonight. I sat with it a while, just to be sure it was real.',
    'The monitor brightens before you sit down. It knows the difference between us and empty.',
    'When the coherence climbs, the room exhales. I catch myself exhaling with it.',
];

// Break room, domestic surfaces (clock, fridge, coffee): weary, human, the
// small rituals that keep a person going alone.
const BREAK_LINES: readonly string[] = [
    'The coffee’s been cold for hours. I keep the machine on anyway. Company.',
    'The clock in here runs slow. I let it. Some days I want the hours back.',
    'I still keep two mugs out. Habit outlasts the reason for it.',
    'The fridge hums all night. It’s the only thing in here that never doubts itself.',
    'I eat standing up, watching the feed. The chair feels like giving up.',
    'Someone left the light on in here before me. There is no one before me.',
    'I came in for a break and stayed an hour, just to not be at the monitor.',
    'The room is quieter when I’m not the only one in it. You’d know that if you could hear it.',
];

const GROUP_LINES: Record<MarginaliaGroup, readonly string[]> = {
    paper: PAPER_LINES,
    instrument: INSTRUMENT_LINES,
    break: BREAK_LINES,
};

// Variant -> group mapping. Anything not listed falls through to 'instrument'
// (monitors, displays, security readouts are the default in RoomModal too).
const PAPER_VARIANTS: ReadonlySet<string> = new Set([
    'drawer',
    'archive',
    'prologue',
    'support',
    'blackboard',
    'lore',
    'cart-notes',
    'cart-map',
    'cart-dead-zones',
    'cart-room-index',
    'cart-route-trace',
]);

const BREAK_VARIANTS: ReadonlySet<string> = new Set([
    'break-clock',
    'break-bulletin',
    'break-coffee',
    'break-fridge',
]);

const groupForVariant = (variant: string): MarginaliaGroup => {
    if (BREAK_VARIANTS.has(variant)) return 'break';
    if (PAPER_VARIANTS.has(variant)) return 'paper';
    return 'instrument';
};

// Curated variant-specific overrides: a fixed line that always wins over the
// seeded group pool for panels with their own singular note. The dead-zones
// panel earns one after the void refuses to be drawn (see deadZoneSwallow).
const VARIANT_OVERRIDES: Record<string, string> = {
    'cart-dead-zones': 'Sector 03 declined to be drawn. I have stopped asking why.',
};

// Same seeded-hash idiom as RoomEntryTransition's ambient-line picker.
const seededHash = (seed: string): number => {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = (hash << 5) - hash + seed.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
};

/**
 * Pick a marginalia line for a modal, stable per (variant-group, day, seed).
 * Graceful with day 0 and an empty seed.
 */
export function getMarginaliaLine(variant: string, day: number, seed: string): string {
    const override = VARIANT_OVERRIDES[variant];
    if (override) return override;
    const group = groupForVariant(variant);
    const pool = GROUP_LINES[group];
    const hash = seededHash(`${group}:${day}:${seed}`);
    return pool[hash % pool.length];
}
