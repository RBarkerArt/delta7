// Absence watcher: makes the observer's inattention visible in the room.
//
// The story premise is that the observer's attention stabilizes the lab. When
// the observer looks away — the tab is hidden, or no input arrives for a while
// — the room begins to drift: fog creeps in and the ambience thins. When they
// return, the drift is arrested and the room gives a soft welcoming pulse.
//
// No React here: plain DOM listeners + timers writing into the roomFx bus
// (which lerps smoothly on its own) and the SoundEngine ducking system.
//
// Idempotent: startAbsenceWatcher() twice installs one set of listeners;
// stopAbsenceWatcher() removes everything and clears state.

import { setRoomFxTarget, pulseRoomFx } from './roomFx';
import { soundEngine } from './SoundEngine';

export interface AbsenceCallbacks {
    onDrift: () => void;
    /** @param driftMs how long the drift lasted, so callers can gate UI. */
    onReturn: (driftMs: number) => void;
}

// Idle threshold: no input for this long while visible begins a drift.
const IDLE_MS = 60_000;
// Throttle for the input listeners so pointermove doesn't spam.
const INPUT_THROTTLE_MS = 1_000;

const INPUT_EVENTS = ['pointermove', 'pointerdown', 'keydown', 'touchstart'] as const;

interface WatcherState {
    callbacks: AbsenceCallbacks;
    idleTimer: number | null;
    drifting: boolean;
    driftStart: number;
    lastInputAt: number;
    onVisibility: () => void;
    onInput: () => void;
}

let watcher: WatcherState | null = null;

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function beginDrift(w: WatcherState): void {
    if (w.drifting) return;
    w.drifting = true;
    w.driftStart = now();
    // Gradually raise the room effects — the bus lerps toward these targets.
    setRoomFxTarget({ fogBoost: 0.45, dim: 0.15 });
    // Thin the ambience over ~10s so it feels like the room is fading out.
    soundEngine.duck(0.5, 10);
    w.callbacks.onDrift();
}

function endDrift(w: WatcherState): void {
    if (!w.drifting) return;
    const driftMs = now() - w.driftStart;
    w.drifting = false;
    // Restore the room. NOTE: an open modal sets dim 0.35 via its own effect and
    // restores 0 on unmount, so this dim:0 may be overwritten by modal
    // open/close while drifting. Acceptable — the modal owns dim while open.
    setRoomFxTarget({ fogBoost: 0, dim: 0 });
    soundEngine.releaseDuck(3);
    pulseRoomFx(0.35); // soft welcome-back light sweep
    w.callbacks.onReturn(driftMs);
}

function clearIdleTimer(w: WatcherState): void {
    if (w.idleTimer !== null) {
        window.clearTimeout(w.idleTimer);
        w.idleTimer = null;
    }
}

function armIdleTimer(w: WatcherState): void {
    clearIdleTimer(w);
    // Only track idleness while the page is visible; hidden pages drift via the
    // visibility handler instead.
    if (typeof document !== 'undefined' && document.hidden) return;
    w.idleTimer = window.setTimeout(() => beginDrift(w), IDLE_MS);
}

export function startAbsenceWatcher(callbacks: AbsenceCallbacks): void {
    if (watcher) return; // idempotent
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const state: WatcherState = {
        callbacks,
        idleTimer: null,
        drifting: false,
        driftStart: 0,
        lastInputAt: now(),
        onVisibility: () => {},
        onInput: () => {},
    };

    state.onVisibility = () => {
        if (document.hidden) {
            // Looked away: drift immediately, and stop the idle countdown.
            clearIdleTimer(state);
            beginDrift(state);
        } else {
            // Returned to the tab: arrest any drift and restart the idle clock.
            state.lastInputAt = now();
            endDrift(state);
            armIdleTimer(state);
        }
    };

    state.onInput = () => {
        const t = now();
        if (t - state.lastInputAt < INPUT_THROTTLE_MS) return;
        state.lastInputAt = t;
        // Input after an idle drift arrests it (only meaningful while visible).
        if (state.drifting && !document.hidden) endDrift(state);
        armIdleTimer(state);
    };

    document.addEventListener('visibilitychange', state.onVisibility);
    for (const evt of INPUT_EVENTS) {
        window.addEventListener(evt, state.onInput, { passive: true });
    }

    watcher = state;
    armIdleTimer(state);
}

export function stopAbsenceWatcher(): void {
    const w = watcher;
    if (!w) return;
    watcher = null;

    clearIdleTimer(w);
    document.removeEventListener('visibilitychange', w.onVisibility);
    for (const evt of INPUT_EVENTS) {
        window.removeEventListener(evt, w.onInput);
    }

    // If we tear down mid-drift, don't leave the room fogged/ducked.
    if (w.drifting) {
        setRoomFxTarget({ fogBoost: 0, dim: 0 });
        soundEngine.releaseDuck(3);
    }
}
