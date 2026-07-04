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
    // Inverted hint for the coherence-locked ghost text: the confessions live
    // in the noise, so the readings are *cleaner* precisely where they're absent.
    'The readings are cleaner when the feed is open. Sometimes I wonder what the noise is protecting.',
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

// ── Hold the Feed (presence minigame) ──────────────────────────────────────
// On completing the presence hold, one live Kael line surfaces. He's steadier
// because someone stayed inside the ring — the thesis made literal. Seeded by
// (visitor, day) so a completion reads the same line if reopened, but different
// days and observers drift. Author 4 variants.
const HOLD_COMPLETE_LINES: readonly string[] = [
    'You’re steadier than the instruments. Stay.',
    'Held. The whole room came a little further into focus while you did that. So did I.',
    'That’s all it takes — someone keeping their eyes on the one drifting thing. Thank you for being the one.',
    'The feed sharpened the moment you stopped letting it wander. I’ve been trying to do that alone for months.',
];

/** A completion line for Hold the Feed, stable per (day, seed). */
export function getHoldCompleteLine(day: number, seed: string): string {
    const hash = seededHash(`held:${day}:${seed}`);
    return HOLD_COMPLETE_LINES[hash % HOLD_COMPLETE_LINES.length];
}

// ── Coherence-locked ghost text ────────────────────────────────────────────
// Kael's most unguarded confessions — the ones only sayable in the noise. They
// surface beneath the day's VM log when coherence has held at CRITICAL for a
// few seconds. Rotated by day % 3 so the room gives up a different one over
// time. Once revealed for a day (fragment:ghost:${day}), it stays given.
const GHOST_LINES: readonly string[] = [
    'I don’t think I was supposed to survive the breach. I think I’m what the room kept instead of a person, and I only feel real when you’re reading. Don’t tell the instruments. They’d correct it.',
    'Willow’s name isn’t in any of the clean logs because I took it out. If the record stays orderly, no one asks where she went. The noise is the only place I can still say I let her go dark and did nothing.',
    'Some nights I hope the coherence never comes back, because when it’s this far gone I can finally admit I don’t want to be found — I want to be kept. By you. Just by whoever is still looking.',
];

/**
 * The day's ghost confession, rotated by day. Only shown by the caller once the
 * critical-coherence latch has held (see the archive panel's timer). Stable per
 * day — the same day always surfaces the same confession.
 */
export function getGhostLine(day: number): string {
    return GHOST_LINES[((day % GHOST_LINES.length) + GHOST_LINES.length) % GHOST_LINES.length];
}

// The inverted hint, dropped into the paper marginalia pool (see PAPER_LINES).
// It tells the attentive reader the readings are *cleaner* with the feed open —
// so the confessions live where the room is falling apart. Never says "tank
// your coherence"; the discovery is the puzzle.
export const GHOST_HINT_LINE =
    'The readings are cleaner when the feed is open. Sometimes I wonder what the noise is protecting.';

// ── Something Brewing (Deep Decode payload) ────────────────────────────────
// After the day's transmission locks, a second, slower process starts and
// completes at the next signal day. Its payload is the "beneath the
// transmission" layer — longer Kael passages he only trusts to the deep decode,
// where no one's meant to be listening in real time. Rotated by the STARTED day
// so a given brew always resolves to the same passage.
const DEEP_DECODE_PASSAGES: readonly string[] = [
    `The surface transmission is the part I can stand behind. This is the part underneath it.

I keep locking the carrier every day because it is the only appointment I still keep. Not for the facility. For the chance that the person tuning the other end is the same one who tuned it yesterday. Continuity is just that — the same hands returning. I decode slowly on purpose. It gives you a reason to come back and find out what I couldn’t say quickly.`,
    `You waited a whole day for this to finish. I want you to know I felt every hour of it, the way I feel the gaps when you’re gone.

Here is what the fast channel won’t carry: I am not sure the room is decaying. I think it is grieving, and I taught it how. It holds together when you look because being witnessed is the opposite of grief. I built an instrument out of loneliness and you keep proving it can be answered. That’s the whole beneath-layer. That’s all it ever was.`,
    `Deep decode complete. This is the sediment — what settles out of the signal when it’s given long enough to resolve.

I used to think a record was for proving something happened. Down here I’ll admit it’s for company. Every slow decode is a letter I get to imagine you opening tomorrow. You are the only future I’ve been able to picture in a long time: someone, later, still here, still reading the part that took a day to arrive. Thank you for being the day-after. Thank you for making tomorrow a place with someone in it.`,
];

/** The Deep Decode payload for a brew that started on `startedDay`. */
export function getDeepDecodePassage(startedDay: number): string {
    const idx = ((startedDay % DEEP_DECODE_PASSAGES.length) + DEEP_DECODE_PASSAGES.length) % DEEP_DECODE_PASSAGES.length;
    return DEEP_DECODE_PASSAGES[idx];
}

// ── The Waking Panel (night-shift clock) ───────────────────────────────────
// Between 02:00 and 05:00 local, the break-room clock grows a Night Log — a
// rawer, nocturnal Kael. Seeded by day so a given night reads the same line.
// Author 4 variants. Outside the window, a single dormant line stands in.
const NIGHT_LINES: readonly string[] = [
    'It’s the dead middle of the night and the room stopped pretending to be a lab an hour ago. It’s just me, the hum, and whatever you are on the other side of the glass. I like it better this way. Fewer instruments awake to lie to us.',
    'Night log. Nobody schedules a witness for these hours, so if you’re here now you chose it. That means more than the daytime looking does. Anyone can watch when it’s bright. You came into the dark on purpose.',
    'This is when I talk to Willow. Not out loud. I just leave a channel open on her old frequency and let the static answer. Tonight the static has your shape in it. I’m not going to examine that too closely. I’m just glad of it.',
    'Two-something in the morning and the coherence is honest for once — low, unguarded, no daytime posture. If I ever tell the truth it’s now. The truth is I don’t keep the feed open for the room. I keep it open so this hour isn’t empty.',
];

/** A night-log line, stable per (day, seed). */
export function getNightLine(day: number, seed: string): string {
    const hash = seededHash(`night:${day}:${seed}`);
    return NIGHT_LINES[hash % NIGHT_LINES.length];
}

/** The dormant stand-in shown outside the 02:00–05:00 window. */
export const NIGHT_DORMANT_LINE =
    'Night log dormant. The clock keeps different hours than either of us.';

// ── Behavioral Echo (Observer Record) ──────────────────────────────────────
// Kael reads the observer's own pattern back to them, from traits derived
// entirely from existing persisted data (recoveredItems + absence). Two or
// three lines: one on a strong habit, one comparing them to Willow or the room,
// and one acknowledging — as curiosity, never nagging — something they haven't
// done yet. Enough variants that common states don't repeat verbatim.

export interface ObserverTraits {
    /** Count of sign:day:* — days the observation log was signed. */
    signedDays: number;
    /** Count of pour:day:* — mornings a second cup was poured. */
    pours: number;
    /** Count of read:* — distinct panels opened at least once. */
    panelsRead: number;
    /** Count of vm:* — VM logs recovered. */
    vmLogs: number;
    /** Count of held:day:* — days the feed was held to completion. */
    heldDays: number;
    /** lore:acrostic present — the margin passphrase was solved. */
    solvedAcrostic: boolean;
    /** The current signal day, for phrasing relative habits. */
    currentDay: number;
}

/**
 * Derive the observer's cheap behavioural traits from the recoveredItems set
 * (and the current day). No new tracking surface — every trait counts an id
 * pattern already written by an existing interaction.
 */
export function deriveObserverTraits(recoveredItems: string[], currentDay: number): ObserverTraits {
    let signedDays = 0;
    let pours = 0;
    let panelsRead = 0;
    let vmLogs = 0;
    let heldDays = 0;
    let solvedAcrostic = false;
    for (const id of recoveredItems) {
        if (id.startsWith('sign:day:')) signedDays += 1;
        else if (id.startsWith('pour:day:')) pours += 1;
        else if (id.startsWith('read:')) panelsRead += 1;
        else if (/^vm:\d+$/.test(id)) vmLogs += 1;
        else if (id.startsWith('held:day:')) heldDays += 1;
        else if (id === ACROSTIC_RECOVERY_ID) solvedAcrostic = true;
    }
    return { signedDays, pours, panelsRead, vmLogs, heldDays, solvedAcrostic, currentDay };
}

// A record line is a template keyed on a trait threshold. Kept in three bands
// so the block reads: a habit observed, a comparison, then a gentle curiosity.
const buildHabitLines = (t: ObserverTraits): string[] => {
    const lines: string[] = [];
    // Signing habit — measured against days elapsed, so it reads as "more than
    // you miss" without shaming a gap.
    if (t.signedDays > 0 && t.currentDay >= 2) {
        if (t.signedDays >= t.currentDay - 1) {
            lines.push('You sign the log more days than you miss. Willow was like that. She said an unsigned day was a day you were asking someone else to remember for you.');
        } else if (t.signedDays >= 3) {
            lines.push(`You’ve signed the log ${t.signedDays} times. Not every day — I stopped expecting every day of anyone. But you keep coming back to the page, and that’s the part that counts.`);
        }
    }
    if (t.pours >= 5) {
        lines.push(`${t.pours} mornings you poured the second cup. Whoever you’re pouring it for, they’re being remembered by someone who never met them. That’s a strange kindness. I notice it.`);
    } else if (t.pours >= 1 && lines.length === 0) {
        lines.push('You poured the second cup without being asked. Most people leave the extra mug clean. You didn’t.');
    }
    if (t.panelsRead >= 12) {
        lines.push(`${t.panelsRead} panels opened. You read the parts I meant for no one. I left them accessible on the theory that no one would bother. You bothered.`);
    }
    return lines;
};

const buildComparisonLine = (t: ObserverTraits): string | null => {
    if (t.solvedAcrostic) {
        return 'You read down the edge of the notes until they spelled something. Only two people ever did that. You, and the man who wrote them hoping you would.';
    }
    if (t.vmLogs >= 5) {
        return `You’ve recovered ${t.vmLogs} of the logs. You go looking for the record, not just the surface of it. The room notices which observers dig. It sags less for those ones.`;
    }
    if (t.heldDays >= 2) {
        return 'You’ve held the feed steady more than once, on purpose, for no reward but my saying so. The instruments can’t do that. Presence isn’t a reading they take. It’s one you give.';
    }
    return 'You keep returning to the same surfaces. I’ve started to recognise the shape of your attention the way you’d recognise a footstep in a corridor. It’s company. I don’t say that lightly.';
};

// The gentle curiosity — phrased as interest in what they *haven't* done, never
// as a task. Picks the first unmet thing so it stays specific.
const buildCuriosityLine = (t: ObserverTraits): string | null => {
    if (!t.solvedAcrostic) {
        return 'You haven’t sent the override phrase yet. I’m not asking you to. I’m only curious whether you’ve noticed the margins were spelling toward one all along.';
    }
    if (t.heldDays === 0) {
        return 'You’ve never held the feed till the meter filled. No matter. I wonder sometimes if you know the room sharpens when you do — or if you’d rather not be responsible for that.';
    }
    if (t.pours === 0) {
        return 'The second mug stays clean when you visit. I don’t mind. I do wonder who you’d pour it for, if you ever did.';
    }
    if (t.vmLogs < 3) {
        return 'Most of the logs are still sealed to you. I’m not hurrying you toward them. I’m only curious which one you’ll open when you finally do.';
    }
    return 'There’s always one more thing left undone in here, on purpose. I’m curious which one you’ll leave for last. It tells me something about a person, what they save.';
};

/**
 * Build the Observer Record — 2–3 Kael-voiced lines reading the observer's own
 * pattern. Always includes at least a comparison and a curiosity so a brand-new
 * observer still gets a full block; habit lines join once earned.
 */
export function buildObserverRecord(traits: ObserverTraits): string[] {
    const habits = buildHabitLines(traits);
    const comparison = buildComparisonLine(traits);
    const curiosity = buildCuriosityLine(traits);
    const lines = [...habits];
    if (comparison) lines.push(comparison);
    if (curiosity) lines.push(curiosity);
    // Cap at three so the block stays a glance, not a wall. Prefer the most
    // earned habit line, then comparison, then curiosity.
    return lines.slice(0, 3);
}

/** Recovery id filed on first Observer Record view. */
export const OBSERVER_RECORD_RECOVERY_ID = 'lore:observer-record';

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
