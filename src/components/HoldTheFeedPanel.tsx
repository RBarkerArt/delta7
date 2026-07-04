import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getHoldCompleteLine } from '../lib/kaelMarginalia';
import { grantCoherenceBonus, setDim, setFocusPull } from '../lib/roomFx';

interface HoldTheFeedPanelProps {
    visitorId: string | null;
    currentDay: number;
    /** True once held:day:${currentDay} is in recoveredItems — show the quiet completed state. */
    alreadyHeld: boolean;
    /** Fired once on completion. Persists held:day:${currentDay}. */
    onHeld: () => void;
}

const hashSeed = (value: string): number => {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
        hash = (hash << 5) - hash + value.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
};

// Presence economy. Filling takes ~24s of cumulative time inside the ring;
// drifting out drains at a gentler rate so leaving is never punishing.
const FILL_SECONDS = 24;            // seconds of presence to complete
const DRAIN_RATE = 0.45;            // fraction of fill-rate that drains when outside
const RING_RADIUS_PCT = 0.17;       // ring radius as a fraction of the min game dimension
const CATCH_SLACK = 1.35;           // pointer counts as "inside" a touch beyond the ring edge

/**
 * Hold the Feed — the presence minigame (the thesis made literal).
 *
 * A soft focal ring drifts slowly around a contained game area on a seeded
 * wander path (rAF). Keep the pointer/finger inside it and a meter fills over
 * ~24s of cumulative presence; drifting out drains it slowly. While inside, the
 * room behind the modal visibly sharpens — focusPull rises and dim eases toward
 * 0. On completion a live Kael line surfaces, a coherence bonus is granted, and
 * held:day:${day} is filed so it's once per day (reopening shows a quiet
 * completed state).
 *
 * Reduced motion / no pointer: the wandering ring is replaced by a press-and-
 * hold button that fills the same meter without the chase. Touch is contained
 * (touch-none on the game area) so the hold never fights page scroll.
 */
export const HoldTheFeedPanel: React.FC<HoldTheFeedPanelProps> = ({
    visitorId,
    currentDay,
    alreadyHeld,
    onHeld,
}) => {
    const [reducedMotion] = useState(
        () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
    // No fine pointer (touch-only / coarse) also falls back to the hold button
    // path, where "inside" is simply "pressing".
    const [coarsePointer] = useState(
        () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
    );
    const useRingChase = !reducedMotion && !coarsePointer;

    const seed = useMemo(() => hashSeed(`${visitorId || 'anon'}:${currentDay}:held`), [visitorId, currentDay]);
    const completeLine = useMemo(
        () => getHoldCompleteLine(currentDay, visitorId || 'anon'),
        [currentDay, visitorId]
    );

    const [completed, setCompleted] = useState(alreadyHeld);
    const completedRef = useRef(alreadyHeld);

    const areaRef = useRef<HTMLDivElement>(null);
    const ringRef = useRef<HTMLDivElement>(null);
    const meterRef = useRef<HTMLDivElement>(null);

    // Live game state, mutated by the rAF loop without re-rendering each frame.
    const progressRef = useRef(alreadyHeld ? 1 : 0);          // 0..1 meter fill
    const insideRef = useRef(false);                          // pointer currently inside ring
    const holdingRef = useRef(false);                         // hold-button pressed (fallback path)
    const pointerRef = useRef<{ x: number; y: number } | null>(null); // pointer within area, 0..1

    const complete = useCallback(() => {
        if (completedRef.current) return;
        completedRef.current = true;
        setCompleted(true);
        try {
            grantCoherenceBonus(6, 30);
            setFocusPull(0);
            setDim(0);
        } catch { /* effects are never load-bearing */ }
        onHeld();
    }, [onHeld]);

    // --- The presence loop (both paths share the meter + roomFx easing) ------
    useEffect(() => {
        if (completedRef.current) return undefined;
        if (typeof window === 'undefined') return undefined;

        let frame = 0;
        let last = performance.now();
        // Seeded wander: two slow Lissajous-ish drifts so the ring never repeats
        // a tight loop but stays smooth and unhurried.
        const ax = 0.11 + ((seed % 100) / 100) * 0.05;
        const ay = 0.09 + (((seed >> 4) % 100) / 100) * 0.05;
        const px = (seed % 628) / 100;
        const py = ((seed >> 6) % 628) / 100;

        const step = (now: number) => {
            const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
            last = now;
            const tSec = now / 1000;

            // Position the drifting ring (ring-chase path only).
            let ringCx = 0.5;
            let ringCy = 0.5;
            if (useRingChase) {
                ringCx = 0.5 + Math.sin(tSec * ax + px) * 0.32;
                ringCy = 0.5 + Math.cos(tSec * ay + py) * 0.30;
                if (ringRef.current) {
                    ringRef.current.style.left = `${(ringCx * 100).toFixed(2)}%`;
                    ringRef.current.style.top = `${(ringCy * 100).toFixed(2)}%`;
                }
            }

            // Determine presence for this frame.
            let inside: boolean;
            if (useRingChase) {
                const p = pointerRef.current;
                if (!p) {
                    inside = false;
                } else {
                    const dx = p.x - ringCx;
                    const dy = p.y - ringCy;
                    inside = Math.hypot(dx, dy) <= RING_RADIUS_PCT * CATCH_SLACK;
                }
            } else {
                inside = holdingRef.current;
            }
            insideRef.current = inside;

            // Fill / drain the meter. Never dips below 0.
            const fillPerSec = 1 / FILL_SECONDS;
            const prev = progressRef.current;
            const next = inside
                ? Math.min(1, prev + fillPerSec * dt)
                : Math.max(0, prev - fillPerSec * DRAIN_RATE * dt);
            progressRef.current = next;
            if (meterRef.current) meterRef.current.style.width = `${(next * 100).toFixed(1)}%`;

            // Room easing: while present, the room sharpens (focusPull up, dim
            // toward 0); while absent, it relaxes back. Scaled by fill so the
            // effect deepens as you hold, and only when actually holding.
            try {
                if (inside) {
                    setFocusPull(0.5 + next * 0.3);   // 0.5 → 0.8
                    setDim(Math.max(0, 0.18 * (1 - next)));
                } else {
                    setFocusPull(0);
                    setDim(0);
                }
            } catch { /* silent */ }

            if (next >= 1) {
                complete();
                return;
            }
            frame = requestAnimationFrame(step);
        };

        frame = requestAnimationFrame(step);
        return () => {
            cancelAnimationFrame(frame);
            // Release the room on unmount so a half-finished hold doesn't leave
            // the room stuck sharpened.
            try { setFocusPull(0); setDim(0); } catch { /* silent */ }
        };
    }, [seed, useRingChase, complete]);

    // --- Ring-chase pointer tracking (contained to the game area) ------------
    const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        const el = areaRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        pointerRef.current = {
            x: (e.clientX - rect.left) / rect.width,
            y: (e.clientY - rect.top) / rect.height,
        };
    }, []);
    const handlePointerLeave = useCallback(() => {
        pointerRef.current = null;
    }, []);

    // --- Hold-button press tracking (fallback path) --------------------------
    const startHold = useCallback(() => { holdingRef.current = true; }, []);
    const endHold = useCallback(() => { holdingRef.current = false; }, []);

    if (completed) {
        return (
            <div className="border border-emerald-100/25 bg-[#11110e]/72 p-4">
                <div className="text-[10px] uppercase tracking-[0.2em] text-emerald-100/58">Feed held — continuity steady</div>
                <p className="mt-3 font-['EB_Garamond'] text-base italic leading-relaxed text-[#f2ead0]/86">
                    {completeLine}
                </p>
                <p className="mt-3 text-[9px] uppercase tracking-[0.2em] text-[#f7f1dc]/34">
                    The feed stays powered until the day rolls over.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-emerald-100/58">
                Hold the Feed
            </div>
            <p className="text-xs leading-relaxed text-[#f7f1dc]/70">
                {useRingChase
                    ? 'Keep the pointer inside the drifting ring. The room holds its focus while you stay with it.'
                    : 'Press and hold. The room holds its focus for as long as you keep it powered.'}
            </p>

            {useRingChase ? (
                <div
                    ref={areaRef}
                    onPointerMove={handlePointerMove}
                    onPointerLeave={handlePointerLeave}
                    className="relative h-52 w-full touch-none overflow-hidden rounded border border-emerald-500/20 bg-black/45"
                    aria-label="Presence field — keep the pointer inside the drifting ring"
                >
                    <div className="pointer-events-none absolute inset-0 bg-scanlines opacity-[0.05]" />
                    <div
                        ref={ringRef}
                        aria-hidden="true"
                        className="pointer-events-none absolute h-[34%] w-[34%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-300/60 bg-[radial-gradient(circle,rgba(52,211,153,0.16),transparent_70%)] shadow-[0_0_20px_rgba(16,185,129,0.25)]"
                        style={{ left: '50%', top: '50%' }}
                    />
                </div>
            ) : (
                <button
                    type="button"
                    onPointerDown={startHold}
                    onPointerUp={endHold}
                    onPointerLeave={endHold}
                    onPointerCancel={endHold}
                    disabled={!visitorId}
                    aria-label="Press and hold to keep the feed powered"
                    className="flex h-52 w-full touch-none select-none items-center justify-center rounded border border-emerald-500/25 bg-black/45 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-100/70 transition-colors active:border-emerald-300/55 active:bg-emerald-500/10 disabled:opacity-50"
                >
                    Hold to keep the feed open
                </button>
            )}

            {/* Presence meter */}
            <div className="space-y-1.5">
                <div className="flex justify-between text-[8px] font-mono uppercase tracking-[0.2em] text-emerald-100/40">
                    <span>PRESENCE</span>
                    <span>HOLDING</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full border border-emerald-500/15 bg-emerald-950/40">
                    <div
                        ref={meterRef}
                        className="h-full rounded-full bg-emerald-400/70 transition-none"
                        style={{ width: '0%' }}
                    />
                </div>
            </div>
        </div>
    );
};
