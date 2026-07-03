// Storm director — schedules ambient lightning + thunder while coherence is
// degraded. Plain timers, no React. Reads coherence via an injected getter so
// callers can back it with a ref and avoid restarting the director per render.
//
// While the coherence state is 'SIGNAL_FRAGMENTED' or 'CRITICAL_INTERFERENCE',
// it maintains a lightning loop: random 20-60s between strikes. Each strike
// flashes the room (pulseRoomFx) then, 0.8-2s later, rumbles thunder at a
// matching intensity. When coherence recovers above the fragmented tier, no new
// strikes are scheduled. Respects prefers-reduced-motion by skipping the visual
// flash (thunder still plays).

import { pulseRoomFx } from './roomFx';
import { soundEngine } from './SoundEngine';

const CHECK_INTERVAL_MS = 10_000;
const STRIKE_MIN_MS = 20_000;
const STRIKE_MAX_MS = 60_000;
const THUNDER_MIN_MS = 800;
const THUNDER_MAX_MS = 2_000;

// Coherence states (see CoherenceContext.getCoherenceState) that count as storm
// conditions: signal fragmented and critical interference.
const STORM_STATES = new Set(['SIGNAL_FRAGMENTED', 'CRITICAL_INTERFERENCE']);

let getState: (() => string) | null = null;
let checkTimer: ReturnType<typeof setInterval> | null = null;
let strikeTimer: ReturnType<typeof setTimeout> | null = null;
let thunderTimer: ReturnType<typeof setTimeout> | null = null;
let strikeScheduled = false;

const rand = (min: number, max: number): number => min + Math.random() * (max - min);

const prefersReducedMotion = (): boolean =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const isStorming = (): boolean => (getState ? STORM_STATES.has(getState()) : false);

const fireStrike = (): void => {
    const intensity = 0.5 + Math.random() * 0.4;

    // prefers-reduced-motion: skip the visual pulse, keep the thunder.
    if (!prefersReducedMotion()) {
        pulseRoomFx(intensity);
    }

    if (thunderTimer !== null) clearTimeout(thunderTimer);
    thunderTimer = setTimeout(() => {
        thunderTimer = null;
        soundEngine.playThunder(intensity);
    }, rand(THUNDER_MIN_MS, THUNDER_MAX_MS));
};

const scheduleNextStrike = (): void => {
    strikeScheduled = true;
    if (strikeTimer !== null) clearTimeout(strikeTimer);
    strikeTimer = setTimeout(() => {
        strikeTimer = null;
        strikeScheduled = false;
        // Only strike (and reschedule) if still in a storm state.
        if (!isStorming()) return;
        fireStrike();
        scheduleNextStrike();
    }, rand(STRIKE_MIN_MS, STRIKE_MAX_MS));
};

const tick = (): void => {
    if (isStorming()) {
        if (!strikeScheduled) scheduleNextStrike();
    } else if (strikeScheduled) {
        // Recovered above the fragmented tier: stop scheduling new strikes.
        if (strikeTimer !== null) {
            clearTimeout(strikeTimer);
            strikeTimer = null;
        }
        strikeScheduled = false;
    }
};

export function startStormDirector(getCoherenceState: () => string): void {
    // Restarting cleanly if already running.
    stopStormDirector();
    getState = getCoherenceState;
    tick();
    checkTimer = setInterval(tick, CHECK_INTERVAL_MS);
}

export function stopStormDirector(): void {
    if (checkTimer !== null) {
        clearInterval(checkTimer);
        checkTimer = null;
    }
    if (strikeTimer !== null) {
        clearTimeout(strikeTimer);
        strikeTimer = null;
    }
    if (thunderTimer !== null) {
        clearTimeout(thunderTimer);
        thunderTimer = null;
    }
    strikeScheduled = false;
    getState = null;
}
