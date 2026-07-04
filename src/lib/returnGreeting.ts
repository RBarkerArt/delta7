// Return greeting — the one-shot flag that lets Kael address a real absence.
//
// The coherence context already derives a returnSignal (absenceMs, reason) on
// load and on tab-visible catch-up. When that absence clears a threshold, App
// arms a pending greeting here; the FIRST room modal opened afterwards consumes
// it and leads its marginalia with a line written to the gap. Then it clears —
// exactly once per return, never nagging.
//
// Plain module state, no React: RoomModal reads it during render setup, App
// writes it from an effect. The absence hours are frozen at arm time so the
// consumed greeting matches the gap that actually happened.

// Only greet after a genuine gap. Short same-session blips (a tab flick, a
// minute idle) never trip this — that would cheapen the beat.
const GREETING_THRESHOLD_MS = 6 * 60 * 60 * 1000; // 6h

interface PendingGreeting {
    /** Absence length in hours, frozen at arm time for the copy bucket. */
    hours: number;
    /** Dedupe key so the same return never re-arms after being consumed. */
    key: string;
}

let pending: PendingGreeting | null = null;
let lastArmedKey: string | null = null;

/**
 * Arm a pending return greeting if the absence is long enough. `key` should be
 * stable for a given return (App uses its returnSignalKey) so re-renders don't
 * re-arm a greeting the visitor already saw.
 */
export function armReturnGreeting(absenceMs: number, key: string): void {
    if (absenceMs < GREETING_THRESHOLD_MS) return;
    if (key === lastArmedKey) return; // already handled this return
    lastArmedKey = key;
    pending = { hours: absenceMs / (60 * 60 * 1000), key };
}

/**
 * Consume the pending greeting, if any. Returns the frozen absence hours for
 * the marginalia bucket, or null when there's nothing to say. Clears the flag
 * so only the first modal after a return leads with it.
 */
export function consumeReturnGreeting(): number | null {
    if (!pending) return null;
    const { hours } = pending;
    pending = null;
    return hours;
}

/** Test/debug helper: forget any armed greeting and dedupe history. */
export function resetReturnGreeting(): void {
    pending = null;
    lastArmedKey = null;
}
