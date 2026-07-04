// Module-level effect bus connecting story events to the room renderer.
// Components write targets (no React re-render); the depth canvas rAF loop
// calls stepRoomFx(dt) and reads `current` when uploading uniforms. Mirrors
// the mutable parallaxSource ref pattern in LabObserverRoom.

export interface RoomFxChannels {
    /** Room defers while you read: multiplies final color, deepens vignette. 0..1 */
    dim: number;
    /** Un-observation creeping in: added to fog weights. 0..1 */
    fogBoost: number;
    /** The signal getting through: brief additive light sweep. 0..1 */
    pulse: number;
    /** Scripted band-glitch, independent of coherence. 0..1 */
    glitch: number;
    /** Attention pull toward the focal plane. 0..1 */
    focusPull: number;
    /**
     * Persistent "inhabited" warmth: once panels have been opened, the room
     * carries a faint lasting lamp-lift as if someone left a light on. Unlike
     * the other channels this one is meant to *stay set* across a session
     * (driven from recoveredItems), not decay to 0 — a lasting trace, not an
     * event. 0..1
     */
    disturbed: number;
}

const ZERO: RoomFxChannels = { dim: 0, fogBoost: 0, pulse: 0, glitch: 0, focusPull: 0, disturbed: 0 };
const CHANNELS = Object.keys(ZERO) as Array<keyof RoomFxChannels>;

// Per-second approach rates. Pulse decays faster so light sweeps read as events.
const APPROACH_RATE: RoomFxChannels = {
    dim: 6,
    fogBoost: 4,
    pulse: 2.6,
    glitch: 8,
    focusPull: 6,
    // Eases in slowly so a freshly-opened panel warms the room over ~1s rather
    // than snapping; never eases back down on its own (target holds).
    disturbed: 1.2,
};

const SNAP_EPSILON = 0.001;

export const roomFx = {
    target: { ...ZERO } as RoomFxChannels,
    current: { ...ZERO } as RoomFxChannels,
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * Advance `current` toward `target` with a frame-rate independent exponential
 * approach. Call once per rAF tick; `dt` is elapsed seconds since last tick.
 */
export function stepRoomFx(dt: number): void {
    const safeDt = Math.min(Math.max(dt, 0), 0.1);
    for (const channel of CHANNELS) {
        const target = roomFx.target[channel];
        const current = roomFx.current[channel];
        if (current === target) continue;

        const blend = 1 - Math.exp(-APPROACH_RATE[channel] * safeDt);
        const next = current + (target - current) * blend;
        roomFx.current[channel] = Math.abs(target - next) < SNAP_EPSILON ? target : next;
    }
}

export function setRoomFxTarget(patch: Partial<RoomFxChannels>): void {
    for (const channel of CHANNELS) {
        const value = patch[channel];
        if (value !== undefined) roomFx.target[channel] = clamp01(value);
    }
}

export function setDim(value: number): void {
    roomFx.target.dim = clamp01(value);
}

export function setFogBoost(value: number): void {
    roomFx.target.fogBoost = clamp01(value);
}

export function setGlitch(value: number): void {
    roomFx.target.glitch = clamp01(value);
}

export function setFocusPull(value: number): void {
    roomFx.target.focusPull = clamp01(value);
}

/**
 * Set the persistent "inhabited" warmth level (see RoomFxChannels.disturbed).
 * App wires this from the count of read:* traces so the room stays subtly warmer
 * once panels have been opened — a lasting change, not an event pulse.
 */
export function setDisturbed(value: number): void {
    roomFx.target.disturbed = clamp01(value);
}

/** Fire a light sweep: jumps `current` up and lets it decay back toward 0. */
export function pulseRoomFx(intensity = 1): void {
    roomFx.current.pulse = clamp01(Math.max(roomFx.current.pulse, intensity));
    roomFx.target.pulse = 0;
}

// --- Visual coherence bonus -------------------------------------------------
// A recovery surge temporarily lifts the room's apparent coherence: uCoh in the
// depth shader adds this bonus for a while so the room visibly knits back
// together, then decays linearly to 0. Stored as timestamps and computed lazily
// so no timer or React state is involved — the rAF loop just reads it.

let bonusAmount = 0;      // coherence points (0..100 scale) at the moment granted
let bonusStart = 0;       // performance.now() when granted
let bonusDurationMs = 0;  // linear decay window

/**
 * Grant a temporary visual coherence lift that decays linearly to 0.
 * @param amount points on the 0..100 coherence scale (added on top of the real score).
 * @param decaySeconds seconds over which the lift fades to nothing.
 */
export function grantCoherenceBonus(amount = 8, decaySeconds = 20): void {
    bonusAmount = amount;
    bonusStart = typeof performance !== 'undefined' ? performance.now() : Date.now();
    bonusDurationMs = Math.max(1, decaySeconds * 1000);
}

/** Current visual coherence bonus (0..amount), decayed linearly from the grant. */
export function getCoherenceBonus(): number {
    if (bonusAmount <= 0) return 0;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const elapsed = now - bonusStart;
    if (elapsed >= bonusDurationMs) {
        bonusAmount = 0;
        return 0;
    }
    return bonusAmount * (1 - elapsed / bonusDurationMs);
}

// Channels that survive a reset: `disturbed` is a lasting trace driven from
// persisted state, not a scripted event — wiping it on room unmount would cost
// the room its warmth on every room switch until the trace count next changes.
const PERSISTENT_CHANNELS: ReadonlySet<keyof RoomFxChannels> = new Set(['disturbed']);

/** Zero transient targets and currents, e.g. on room unmount. */
export function resetRoomFx(): void {
    for (const channel of CHANNELS) {
        if (PERSISTENT_CHANNELS.has(channel)) continue;
        roomFx.target[channel] = 0;
        roomFx.current[channel] = 0;
    }
}

// Dev-only console hook so effects can be exercised before any component wires
// targets (later batches). e.g. `__roomFx.setRoomFxTarget({ dim: 1 })`.
if (import.meta.env.DEV && typeof window !== 'undefined') {
    (window as unknown as { __roomFx: unknown }).__roomFx = {
        roomFx,
        setRoomFxTarget,
        pulseRoomFx,
        resetRoomFx,
    };
}
