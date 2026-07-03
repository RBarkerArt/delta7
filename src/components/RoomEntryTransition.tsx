import React, { useEffect, useMemo, useRef, useState } from 'react';
import { TypeOn } from './ui/TypeOn';
import { openAudioChannel, resumeAudioChannel } from '../lib/audioUnlock';
import { isGyroAvailable, getGyroOptIn, requestGyro } from '../hooks/useGyroParallax';
import type { CoherenceState } from '../types/schema';

interface RoomEntryTransitionProps {
    currentDay: number;
    state: CoherenceState;
    score: number;
    /** Milliseconds away, when a return signal registered an absence. */
    absenceMs?: number | null;
    dayDelta?: number;
    /**
     * 'reentry' is the full telemetry beat; 'relink' is the short hold used
     * after a mobile room-navigation reload (picks up from the index.html veil).
     */
    mode?: 'reentry' | 'relink';
    /**
     * The room scene behind the overlay has signaled ready. The overlay never
     * fades before this is true (capped by READY_CAP_MS so a failed room
     * can't hold the black screen forever). Defaults to true for callers that
     * have no readiness signal.
     */
    sceneReady?: boolean;
    onComplete: () => void;
}

const REENTRY_LINES = [
    'The room is as you left it. Almost.',
    'The dust has not moved. The signal has.',
    'The monitor noticed you before you sat down.',
    'Nothing in this room breathes. And yet.',
    'The chair is still warm. You have been gone for hours.',
    'It kept the lights on. It does not know why.',
];

const RETURN_LINES = [
    'The room counted the days you were gone.',
    'Your absence left a residue. The system filed it.',
    'The signal kept arriving. No one was here to hear it.',
    'It did not forget you. It is incapable of forgetting.',
    'Someone has been keeping the record while you were away.',
];

const formatAbsence = (ms: number): string => {
    const totalMinutes = Math.max(0, Math.round(ms / 60000));
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;

    if (days > 0) return `${days}d ${String(hours).padStart(2, '0')}h`;
    if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
    return `${minutes}m`;
};

const HOLD_MS = 3600;
const FADE_MS = 1100;
const RELINK_HOLD_MS = 1200;
const CALM_FADE_MS = 400;
// Never hold the black overlay past this waiting for the scene — a room that
// fails to signal ready degrades to the old timer-only behavior.
const READY_CAP_MS = 10000;

/**
 * Cinematic re-entry for sessions that skip the prologue: a brief black
 * telemetry beat with an ambient line, then the room resolves underneath.
 * Click anywhere to skip. The room loads behind this overlay, so it also
 * covers asset settling.
 */
export const RoomEntryTransition: React.FC<RoomEntryTransitionProps> = ({
    currentDay,
    state,
    score,
    absenceMs,
    dayDelta = 0,
    mode = 'reentry',
    sceneReady = true,
    onComplete,
}) => {
    const [isFading, setIsFading] = useState(false);
    const [holdElapsed, setHoldElapsed] = useState(false);
    const [readyCapElapsed, setReadyCapElapsed] = useState(false);
    const [reducedMotion] = useState(
        () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
    // Show the motion-link calibration line only on touch devices that expose
    // the gyro and haven't explicitly opted out. Never nag when reduced-motion
    // is requested — we won't start the gyro in that case anyway.
    const [motionOffered] = useState(
        () => !reducedMotion && isGyroAvailable() && getGyroOptIn() !== '0'
    );
    // 'idle' -> the calibrate cue; 'linked' -> the brief post-grant confirmation.
    const [motionStatus, setMotionStatus] = useState<'idle' | 'linked'>('idle');
    const onCompleteRef = useRef(onComplete);
    const isRelink = mode === 'relink';
    const isLongAbsence = (dayDelta ?? 0) > 0 || (absenceMs ?? 0) > 12 * 60 * 60 * 1000;

    useEffect(() => {
        onCompleteRef.current = onComplete;
    }, [onComplete]);

    const ambientLine = useMemo(() => {
        const pool = isLongAbsence ? RETURN_LINES : REENTRY_LINES;
        let hash = 0;
        const seed = `${currentDay}-${new Date().toDateString()}-entry`;
        for (let i = 0; i < seed.length; i++) {
            hash = (hash << 5) - hash + seed.charCodeAt(i);
            hash |= 0;
        }
        return pool[Math.abs(hash) % pool.length];
    }, [currentDay, isLongAbsence]);

    useEffect(() => {
        // Take over from the pre-paint boot veil (mobile relink reload); both
        // surfaces are plain black, so the handoff is invisible.
        document.getElementById('d7-relink-veil')?.remove();
    }, []);

    useEffect(() => {
        // Calm tier still holds long enough for the static ambient-line fade
        // to land instead of bailing instantly.
        const holdMs = isRelink
            ? (reducedMotion ? 700 : RELINK_HOLD_MS)
            : (reducedMotion ? 1400 : HOLD_MS);

        const holdTimer = window.setTimeout(() => setHoldElapsed(true), holdMs);
        const capTimer = window.setTimeout(() => setReadyCapElapsed(true), READY_CAP_MS);
        return () => {
            window.clearTimeout(holdTimer);
            window.clearTimeout(capTimer);
        };
    }, [isRelink, reducedMotion]);

    // Fade only once the hold has played AND the room behind is actually
    // composed (or the cap expired) — a slow network can no longer drop the
    // viewer onto a half-loaded room.
    useEffect(() => {
        if (!holdElapsed || isFading) return undefined;
        if (!sceneReady && !readyCapElapsed) return undefined;

        const fadeMs = reducedMotion ? CALM_FADE_MS : FADE_MS;
        setIsFading(true);
        const doneTimer = window.setTimeout(() => onCompleteRef.current(), fadeMs);
        return () => window.clearTimeout(doneTimer);
    }, [holdElapsed, sceneReady, readyCapElapsed, isFading, reducedMotion]);

    const skip = () => {
        if (isFading) return;

        // The single entry tap grants BOTH audio and motion. iOS allows several
        // permission flows from one gesture, but requestPermission() must sit on
        // the synchronous call path — so fire the gyro request BEFORE any await.
        if (motionOffered) {
            const scratch = { x: 0, y: 0 };
            void requestGyro(scratch).then((granted) => {
                if (granted) {
                    setMotionStatus('linked');
                    // Let a mounted room start its own gyro immediately.
                    window.dispatchEvent(new CustomEvent('delta7:gyro-optin'));
                }
                // On denial requestGyro() already persisted '0', so we won't nag.
            });
        }

        // The entry click is also the diegetic audio-unlock gesture. In relink
        // mode the channel is already open, so just resume the (possibly
        // suspended) context; in full re-entry, open the channel.
        if (isRelink) {
            void resumeAudioChannel();
        } else {
            void openAudioChannel();
        }
        setIsFading(true);
        // Hold slightly longer when we granted motion so CALIBRATED can flash.
        window.setTimeout(() => onCompleteRef.current(), motionOffered ? 650 : 450);
    };

    const motionLine =
        motionStatus === 'linked' ? 'MOTION LINK: CALIBRATED' : 'MOTION LINK: TAP TO CALIBRATE';

    return (
        <div
            onClick={skip}
            className={`fixed inset-0 z-[13500] flex cursor-pointer flex-col items-center justify-center bg-lab-black px-8 font-mono transition-all ease-out ${
                isFading ? 'pointer-events-none opacity-0 backdrop-blur-0' : 'opacity-100'
            }`}
            style={{ transitionDuration: `${isFading ? (reducedMotion ? CALM_FADE_MS : FADE_MS) : 0}ms` }}
            aria-label="Entering room — click to skip"
            role="button"
        >
            {isRelink ? (
                /* Short relink beat: one telemetry line, no ambient prose. */
                <div className="w-full max-w-md text-center text-[10px] uppercase tracking-[0.26em] text-emerald-100/55">
                    <TypeOn
                        text={`FEED RELINKED — SIGNAL DAY ${String(currentDay).padStart(3, '0')} // ${state}`}
                        speed={10}
                        startDelay={120}
                        showCursor={false}
                    />
                    {motionOffered && (
                        <div className="mt-2 text-[10px] uppercase tracking-[0.26em] text-cyan-300/60">
                            {motionLine}
                        </div>
                    )}
                </div>
            ) : (
                <>
                    {/* Telemetry block */}
                    <div className="w-full max-w-md space-y-1.5 text-[10px] uppercase tracking-[0.26em] text-emerald-100/55">
                        <div>
                            <TypeOn text="DELTA-7 // OBSERVATION FEED" speed={14} startDelay={150} showCursor={false} />
                        </div>
                        <div>
                            <TypeOn
                                text={`SIGNAL DAY ${String(currentDay).padStart(3, '0')} — ${state}`}
                                speed={14}
                                startDelay={650}
                                showCursor={false}
                            />
                        </div>
                        <div className={isLongAbsence ? 'text-amber-200/70' : ''}>
                            <TypeOn
                                text={isLongAbsence && absenceMs
                                    ? `ABSENCE REGISTERED: ${formatAbsence(absenceMs)} — RECALIBRATING FEED`
                                    : `LINK RE-ESTABLISHED — COHERENCE ${score.toFixed(1)}%`}
                                speed={14}
                                startDelay={1150}
                                showCursor={false}
                            />
                        </div>
                        {/* Diegetic audio-unlock cue — amber to distinguish it. */}
                        <div className="text-amber-300/70">
                            <TypeOn
                                text="AUDIO CHANNEL: STANDBY — ENTERING OPENS THE CHANNEL"
                                speed={14}
                                startDelay={1650}
                                showCursor={false}
                            />
                        </div>
                        {/* Motion-link calibration cue — cyan, distinct from the amber audio line. */}
                        {motionOffered && (
                            <div className="text-cyan-300/60">{motionLine}</div>
                        )}
                    </div>

                    {/* Ambient line — same voice as the prologue */}
                    <div className="mt-10 max-w-2xl text-center">
                        <p
                            className="prologue-entry-line font-['EB_Garamond'] italic text-2xl leading-relaxed tracking-wide text-[#d1d1c7] sm:text-3xl"
                            style={{ textShadow: '0 0 20px rgba(209, 209, 199, 0.15)' }}
                        >
                            {ambientLine}
                        </p>
                    </div>

                    <div className="prologue-entry-hint mt-12 text-[9px] uppercase tracking-[0.3em] text-[#d8d2bd]/35">
                        click to enter
                    </div>
                </>
            )}

            <style>{`
                @keyframes prologue-entry-line-in {
                    from { opacity: 0; filter: blur(6px); transform: translateY(6px); }
                    to { opacity: 1; filter: blur(0); transform: translateY(0); }
                }
                .prologue-entry-line {
                    animation: prologue-entry-line-in 2400ms 900ms cubic-bezier(0.22, 1, 0.36, 1) both;
                }
                @keyframes prologue-entry-hint-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .prologue-entry-hint {
                    animation: prologue-entry-hint-in 900ms 2200ms ease-out both;
                }
                @keyframes prologue-entry-line-calm {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @media (prefers-reduced-motion: reduce) {
                    /* Calm tier: static opacity fade, no blur or movement. */
                    .prologue-entry-line {
                        animation: prologue-entry-line-calm 600ms ease-out both;
                    }
                    .prologue-entry-hint {
                        animation: prologue-entry-hint-in 400ms 300ms ease-out both;
                    }
                }
            `}</style>
        </div>
    );
};
