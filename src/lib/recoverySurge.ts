// Recovery surge — the single beat fired when a day-log recovery succeeds.
// Bundles the room pulse, the stabilize chime, a temporary visual coherence
// lift, and a telemetry ping so every call site behaves identically.
//
// Kept out of roomFx.ts so the pure effect-bus stays free of the sound engine;
// this is the story-level composition of those primitives.

import { pulseRoomFx, grantCoherenceBonus } from './roomFx';
import { soundEngine } from './SoundEngine';

type SurgeListener = () => void;

const listeners = new Set<SurgeListener>();

/** Subscribe to recovery-surge events (e.g. to flash a telemetry line). */
export function onRecoverySurge(listener: SurgeListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/**
 * Fire the full recovery surge: bright window sweep, stabilize chime, a ~20s
 * visual coherence lift so the room knits back together, and a telemetry ping.
 * Safe to call from any recovery confirmation path.
 */
export function triggerRecoverySurge(): void {
    pulseRoomFx(0.9);
    grantCoherenceBonus(8, 20);
    try {
        soundEngine.playStabilize();
    } catch {
        /* best effort — audio may not be unlocked */
    }
    for (const listener of listeners) {
        try {
            listener();
        } catch {
            /* a bad subscriber shouldn't sink the surge */
        }
    }
}
