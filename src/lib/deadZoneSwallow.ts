// The dead-zone swallow (D3): the first time an observer opens the signal-
// cartography dead-zones panel, the void pushes back. A ~2s scripted takeover —
// the room glitches and dims to near-black, the ambience ducks to near-silence,
// a bare sub-bass heartbeat pulses, and the compass loses its signal — then
// everything snaps back and the panel opens. One-shot per observer, ever.
//
// This module only drives the effect. Persistence (the one-shot flag) and the
// actual popup open are the caller's job in App.tsx; runDeadZoneSwallow just
// invokes `onDone` when the takeover releases.

import { setRoomFxTarget } from './roomFx';
import { soundEngine } from './SoundEngine';

const FULL_DURATION_MS = 2000;
const REDUCED_DURATION_MS = 1200;

// Module-level guard so a double-tap can't stack two takeovers.
let running = false;

const prefersReducedMotion = (): boolean =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Run the dead-zone swallow, calling `onDone` when it releases (or immediately
 * if it can't run). Never throws: if anything in the scripted sequence fails,
 * `onDone` is still called so the caller can open the panel regardless.
 *
 * @param onDone invoked once when the takeover ends. Guaranteed to fire exactly
 *   once, even on early-out (already running) or on error.
 */
export function runDeadZoneSwallow(onDone: () => void): void {
    // Already mid-swallow (double-fire): don't stack — just open.
    if (running) {
        onDone();
        return;
    }
    running = true;

    const reduced = prefersReducedMotion();
    const duration = reduced ? REDUCED_DURATION_MS : FULL_DURATION_MS;
    let released = false;

    const release = () => {
        if (released) return;
        released = true;
        try {
            if (!reduced) setRoomFxTarget({ glitch: 0, dim: 0 });
            soundEngine.releaseDuck(1.5);
        } catch { /* best effort */ }
        running = false;
        try {
            onDone();
        } catch { /* the caller's open must not re-enter here */ }
    };

    try {
        // t=0: the void takes over.
        if (!reduced) {
            // Reduced motion keeps sound + compass sweep but skips the visual
            // glitch/dim entirely.
            setRoomFxTarget({ glitch: 1, dim: 0.25 });
        }
        soundEngine.duck(0.05, 0.4);          // ambience to near-silence
        soundEngine.playVoidHeartbeat((duration + 200) / 1000);
        window.dispatchEvent(new Event('delta7:compass-sweep'));

        // t≈duration: snap back and hand control to the caller.
        window.setTimeout(release, duration);
    } catch {
        // Anything threw: don't leave the room dimmed or the bus ducked.
        release();
    }
}
