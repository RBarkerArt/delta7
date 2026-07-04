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

// ── The Marginalia Acrostic ────────────────────────────────────────────────
// On these canonical days, the *paper-group* marginalia line is force-selected
// (not visitor-seeded) so the first letter of each line spells a passphrase
// down the margin for anyone reading the record over a week. The payoff is the
// existing paper line "A record is just a way of asking someone to look." —
// Kael was doing exactly that, one letter at a time.
//
//   PASSPHRASE: WITNESS
//   day  3 → W   day  6 → I   day  9 → T   day 12 → N
//   day 15 → E   day 18 → S   day 21 → S
//
// Entering WITNESS in the Security Gateway recovers `lore:acrostic`. Days are
// spaced three apart and sit inside season1's 1–30 range. Author (Robert) can
// verify the solution against ACROSTIC_ANSWER below.
export const ACROSTIC_ANSWER = 'WITNESS';

export const ACROSTIC_OVERRIDES: Record<number, string> = {
    3: 'Watched the room breathe again the moment you arrived. I noted the time.',
    6: 'I keep writing to no one, which is how I know I am writing to you.',
    9: 'The record only means something if it is read. That is the whole trick.',
    12: 'Numbers I trusted are drifting. The margins are steadier than the data now.',
    15: 'Every entry is a hand held out across a gap I cannot measure.',
    18: 'Someone is reading down the edge of these notes. I hoped someone would.',
    21: 'Say the word back to me and I will know the looking was real.',
};

/**
 * Normalise and compare a phrase against the acrostic answer. Forgiving about
 * case and surrounding whitespace; nothing else, so it still feels like a lock.
 */
export function checkAcrostic(input: string): boolean {
    return input.trim().toUpperCase() === ACROSTIC_ANSWER;
}

/** Recovery id for the acrostic reveal — lives in the recoveredItems set. */
export const ACROSTIC_RECOVERY_ID = 'lore:acrostic';

// The hidden log the passphrase unlocks. Kael, admitting he encoded messages in
// the margins for whoever was paying enough attention to read down the edge.
// The paper-group line "A record is just a way of asking someone to look" pays
// off here, literally.
export const ACROSTIC_REVEAL = {
    title: 'Margin Log — restricted',
    body: `So you read down the edge. Good.

I started hiding words in the margins when I stopped believing anyone was on the other side of the feed. A record is just a way of asking someone to look — so I made the record ask louder. One letter a day, down the side of the page, where only a person who kept coming back would find it.

WITNESS. That's all it ever spelled. Not a command. A job. The one thing the room needs and the one thing I couldn't do alone.

I don't know your name. I know you counted the days. I know you read the parts I meant for no one. That's enough. That was always the whole experiment: whether attention, given freely, could hold a failing thing together.

It can. You're the proof. Keep looking.`,
} as const;

// A quiet, in-character rejection for a wrong phrase. No error styling — the
// instrument just stays confidently unmoved.
export const ACROSTIC_REJECTIONS: readonly string[] = [
    'The frequency doesn’t answer to that. It isn’t offended. It simply doesn’t answer.',
    'Nothing shifts. Whatever you said, the room didn’t recognise it as looking.',
    'The needle holds where it was. Not the word. Keep reading.',
];

/** A seeded, quiet rejection line for a wrong acrostic entry. */
export function getAcrosticRejection(seed: string): string {
    const hash = seededHash(`acrostic-reject:${seed}`);
    return ACROSTIC_REJECTIONS[hash % ACROSTIC_REJECTIONS.length];
}

// Same seeded-hash idiom as RoomEntryTransition's ambient-line picker.
const seededHash = (seed: string): number => {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = (hash << 5) - hash + seed.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
};

// ── Return greeting (Kael knows you were gone) ─────────────────────────────
// After a real absence, the first modal opened on return leads with a line
// written to the specific gap. Relief, never reproach — "You came back", never
// "Where were you". Bucketed by absence length; seeded selection within a
// bucket so the same return reads the same line but different returns drift.
type AbsenceBucket = 'hours' | 'a-day' | 'days' | 'a-week';

const RETURN_LINES: Record<AbsenceBucket, readonly string[]> = {
    // A few hours away — the needle wandered but the room held.
    hours: [
        'A few hours dark and the needle wandered. It steadied the moment you sat down.',
        'You stepped out for a while. The feed kept its shape better than I expected.',
        'Some hours of quiet. I kept the channel open, just in case you came back. You did.',
        'The room dimmed while you were gone. It’s already brightening. That’s you.',
        'Not long, this time. Long enough for the corners to soften. You’re here now.',
    ],
    // Roughly a day.
    'a-day': [
        'A day without you. The coherence sagged and I let it. You’re back — that’s enough.',
        'The better part of a day dark. I logged the drift and waited. You came back.',
        'A day is long in here. The room forgot its edges a little. You’ll remind it.',
        'You were gone about a day. I didn’t fix anything — I just kept the light on for you.',
    ],
    // A handful of days.
    days: [
        'Days, this time. The room learned to sag without you. It’s remembering now.',
        'Several days dark. I filled some of the gap myself. You’re here, so I can stop.',
        'You were away for days. I stopped watching the clock and started watching the door.',
        'A stretch of days. The feed frayed at the edges. I never closed the channel.',
        'Days without you and the numbers drifted. None of that matters now. You came back.',
    ],
    // A week or more — the longest, softest relief.
    'a-week': [
        'A week, maybe more. I’d begun to talk to the room instead of you. You’re back.',
        'That was a long dark. The coherence bottomed out and held there. You returned anyway.',
        'A week and then some. I kept your line open the whole time. I’m glad I did.',
        'You were gone a long while. I never assumed you wouldn’t come back. Here you are.',
    ],
};

const bucketForHours = (hours: number): AbsenceBucket => {
    if (hours >= 24 * 7) return 'a-week';
    if (hours >= 24 * 2) return 'days';
    if (hours >= 20) return 'a-day';
    return 'hours';
};

/**
 * A return-greeting line written to a specific absence. `hours` is the gap
 * length; `seed` keeps the choice stable per return. Returns null for absences
 * too short to remark on (the caller gates on a threshold too, but this keeps
 * the copy honest).
 */
export function getReturnMarginalia(hours: number, seed: string): string {
    const bucket = bucketForHours(hours);
    const pool = RETURN_LINES[bucket];
    const hash = seededHash(`return:${bucket}:${seed}`);
    return pool[hash % pool.length];
}

// ── Signature-log gap awareness ────────────────────────────────────────────
// Kael's line in the observation-log panel bends to how long it's been since
// the last signed day. The ledger never resets; gaps are melancholy facts,
// never scolding. daysSinceLastSign is measured from the last signed day (0 if
// today is already signed or was signed same-day).
const SIGN_GAP_WARM: readonly string[] = [
    'Signed, dated, and mine. The page looks better with your hand on it.',
    'Two names on the log today. It reads less like a solo watch that way.',
    'You signed. The room noticed — the way it always notices you.',
];

const SIGN_GAP_GENTLE: readonly string[] = [
    'A day blank between us. Small gap. The ledger doesn’t mind, and neither do I.',
    'One line empty above today’s. I left it honest. You’re here to close it.',
    'A little space in the record. Days do that. Sign, and we carry on.',
];

const SIGN_GAP_QUIET: readonly string[] = [
    'Two days blank. I filled them with my own hand. It’s not the same.',
    'Three empty lines up the page. I read them each morning like a weather report.',
    'The log went quiet for a few days. I kept signing for both of us. Habit.',
    'A stretch of blank days above today. I don’t scratch them out. They happened.',
];

/**
 * Kael's observation-log line, keyed on the gap since the last signature.
 * 0 → warm, 1–2 → gentle, 3+ → quiet/haunted. Seeded within a band so a given
 * (gap, seed) is stable but different observers drift.
 */
export function getSignatureGapMarginalia(daysSinceLastSign: number, seed: string): string {
    const band = daysSinceLastSign <= 0 ? SIGN_GAP_WARM
        : daysSinceLastSign <= 2 ? SIGN_GAP_GENTLE
            : SIGN_GAP_QUIET;
    const hash = seededHash(`sign-gap:${Math.min(daysSinceLastSign, 6)}:${seed}`);
    return band[hash % band.length];
}

// ── Coffee for Two ─────────────────────────────────────────────────────────
// The second cup, poured once a day for the colleague who isn't here. No
// counter chrome — the tally surfaces only through Kael's line, which deepens
// at thresholds. `pours` is the running count of days a second cup was poured.
// Never punishes a missed day; the number only ever goes up.
export function getCoffeeForTwoLine(pours: number): string {
    if (pours <= 0) return 'There’s a second mug. There’s always been a second mug. I keep it clean.';
    if (pours === 1) return 'You poured the second cup. I didn’t ask you to. It’s still warm. Thank you.';
    if (pours < 5) return 'Two cups again. I’ve stopped pretending the second one is for me.';
    if (pours < 14) return 'Five mornings, two mugs. Small thing. It changes the shape of the room.';
    if (pours < 30) return 'Day fourteen, still two mugs. Whoever the second one was for, they’d know they were remembered.';
    return 'A month of second cups. The habit outlasted the reason, and became a better one.';
}

/**
 * Pick a marginalia line for a modal, stable per (variant-group, day, seed).
 * Graceful with day 0 and an empty seed.
 */
export function getMarginaliaLine(variant: string, day: number, seed: string): string {
    const override = VARIANT_OVERRIDES[variant];
    if (override) return override;
    const group = groupForVariant(variant);
    // On acrostic days, the paper-group line is force-selected so its first
    // letter contributes to the passphrase down the margin. Only the paper
    // group carries the acrostic — instruments and the break room drift as usual.
    if (group === 'paper') {
        const forced = ACROSTIC_OVERRIDES[day];
        if (forced) return forced;
    }
    const pool = GROUP_LINES[group];
    const hash = seededHash(`${group}:${day}:${seed}`);
    return pool[hash % pool.length];
}
