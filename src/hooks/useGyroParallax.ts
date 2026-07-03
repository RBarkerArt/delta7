/**
 * Gyroscope parallax opt-in (D1).
 *
 * Feeds `deviceorientation` tilt into a caller-provided mutable ref shaped like
 * the mouse `pointerTiltRef` ({ x, y }, each roughly in [-1, 1]). The room's
 * existing plane-tilt composition and depth-parallax canvas consume that ref
 * unchanged, so a phone tilt reads the same way a desktop mouse move does.
 *
 * Feel notes:
 * - People hold phones at a 30-50deg pitch, and every grip is different. We
 *   track a slow-moving neutral BASELINE (a long-time-constant EMA) per axis
 *   and emit only the OFFSET from it. Tilt-and-hold therefore drifts back to
 *   zero, and the resting grip always reads as neutral.
 * - Readings are smoothed with a fast EMA so hand tremor doesn't jitter the
 *   scene, then clamped to +/-0.6.
 *
 * Everything is ref-based (no React state) so it can run inside the room's
 * rAF-driven motion path without triggering re-renders. Never throws when
 * DeviceOrientationEvent is missing.
 */

export const GYRO_OPTIN_KEY = 'delta7_gyro_optin';

/** Mutable target the readings are written into, shaped like pointerTiltRef. */
export interface TiltTarget {
    x: number;
    y: number;
}

// --- Feel constants -------------------------------------------------------

// Degrees of tilt that map to a full unit of offset. Slightly wider than the
// POC (which used /20) so the motion stays gentle.
const GAMMA_SPAN = 24; // left/right tilt -> x
const BETA_SPAN = 26; // front/back tilt -> y

// Fast EMA applied to each raw reading to kill tremor (higher = snappier).
const SMOOTH = 0.15;

// Baseline EMA. A ~3s time constant at ~60 events/s => alpha ~= 1/(3*60).
// The neutral grip is absorbed into this baseline and reads as zero.
const BASELINE_ALPHA = 1 / 180;

const CLAMP = 0.6;

const clamp = (v: number) => (v < -CLAMP ? -CLAMP : v > CLAMP ? CLAMP : v);

type PermissionCapableEvent = typeof DeviceOrientationEvent & {
    requestPermission?: () => Promise<'granted' | 'denied' | 'default'>;
};

const hasDeviceOrientation = (): boolean =>
    typeof window !== 'undefined' && typeof window.DeviceOrientationEvent !== 'undefined';

const isTouchDevice = (): boolean =>
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(pointer: coarse)').matches ?? false);

/** Touch device that actually exposes the deviceorientation API. */
export const isGyroAvailable = (): boolean => hasDeviceOrientation() && isTouchDevice();

export const getGyroOptIn = (): '1' | '0' | null => {
    try {
        const v = window.localStorage.getItem(GYRO_OPTIN_KEY);
        return v === '1' || v === '0' ? v : null;
    } catch {
        return null;
    }
};

export const setGyroOptIn = (value: '1' | '0'): void => {
    try {
        window.localStorage.setItem(GYRO_OPTIN_KEY, value);
    } catch {
        /* storage unavailable — opt-in just won't persist */
    }
};

// --- Runtime state (module singleton; only one room is mounted at a time) ---

let target: TiltTarget | null = null;
let listening = false;

// Smoothed readings and slow baselines, in raw degrees.
let smoothGamma = 0;
let smoothBeta = 0;
let baseGamma: number | null = null;
let baseBeta: number | null = null;

const handleOrientation = (e: DeviceOrientationEvent): void => {
    if (!target || e.gamma == null || e.beta == null) return;

    const landscape =
        Math.abs((window as unknown as { orientation?: number }).orientation ?? 0) === 90 ||
        (window.screen?.orientation?.type?.startsWith('landscape') ?? false);

    // In landscape the axes swap roles (matches the POC mapping).
    const rawGamma = landscape ? (e.beta ?? 0) : (e.gamma ?? 0);
    const rawBeta = landscape ? -(e.gamma ?? 0) : (e.beta ?? 0);

    // Fast EMA to remove tremor.
    smoothGamma += (rawGamma - smoothGamma) * SMOOTH;
    smoothBeta += (rawBeta - smoothBeta) * SMOOTH;

    // Seed then slowly track the neutral baseline (the resting grip).
    if (baseGamma == null) baseGamma = smoothGamma;
    else baseGamma += (smoothGamma - baseGamma) * BASELINE_ALPHA;
    if (baseBeta == null) baseBeta = smoothBeta;
    else baseBeta += (smoothBeta - baseBeta) * BASELINE_ALPHA;

    // Emit the OFFSET from baseline, scaled to a unit and clamped.
    target.x = clamp((smoothGamma - baseGamma) / GAMMA_SPAN);
    target.y = clamp((smoothBeta - baseBeta) / BETA_SPAN);
};

const attach = (writeTarget: TiltTarget): boolean => {
    if (typeof window === 'undefined' || !hasDeviceOrientation()) return false;
    target = writeTarget;
    if (!listening) {
        // Reset baselines so the current grip becomes neutral on (re)start.
        smoothGamma = 0;
        smoothBeta = 0;
        baseGamma = null;
        baseBeta = null;
        window.addEventListener('deviceorientation', handleOrientation);
        listening = true;
    }
    return true;
};

/**
 * Begin writing tilt into `writeTarget`. On iOS this must be called from within
 * a user tap and BEFORE any `await` in the handler (the permission prompt has
 * to sit on the synchronous call path of the gesture). Resolves true once
 * granted and listening; persists opt-in state as a side effect.
 */
export const requestGyro = (writeTarget: TiltTarget): Promise<boolean> => {
    if (typeof window === 'undefined' || !hasDeviceOrientation()) {
        return Promise.resolve(false);
    }

    const DOE = window.DeviceOrientationEvent as PermissionCapableEvent;

    // iOS 13+ gated flow. requestPermission() is called synchronously here so
    // it stays inside the originating gesture.
    if (typeof DOE.requestPermission === 'function') {
        return DOE.requestPermission()
            .then((result) => {
                if (result === 'granted') {
                    const ok = attach(writeTarget);
                    if (ok) setGyroOptIn('1');
                    return ok;
                }
                // Denied — remember it so we never nag again.
                setGyroOptIn('0');
                return false;
            })
            .catch(() => false);
    }

    // Non-iOS: no gate, just listen.
    const ok = attach(writeTarget);
    if (ok) setGyroOptIn('1');
    return Promise.resolve(ok);
};

/**
 * Start listening without prompting — for platforms where permission isn't
 * gated, or where it was already granted this session. Safe to call when
 * unavailable (returns false).
 */
export const startGyro = (writeTarget: TiltTarget): boolean => {
    if (!hasDeviceOrientation()) return false;
    const DOE = window.DeviceOrientationEvent as PermissionCapableEvent;
    // If the platform gates permission, silent start won't deliver events —
    // the caller should use requestGyro() from a tap instead.
    if (typeof DOE.requestPermission === 'function') return false;
    return attach(writeTarget);
};

export const stopGyro = (): void => {
    if (typeof window !== 'undefined' && listening) {
        window.removeEventListener('deviceorientation', handleOrientation);
    }
    listening = false;
    target = null;
};

export const isGyroListening = (): boolean => listening;
