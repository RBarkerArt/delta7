import React, { useCallback, useEffect, useRef, useState } from 'react';
import { setFocusPull } from '../lib/roomFx';

interface TheAlmostProps {
    /** Rendered inert once the catch is already recovered (never repeat hollowly). */
    alreadyCaught: boolean;
    /** Fired once when the visitor resolves the catch — marks lore:the-almost. */
    onCatch: () => void;
}

// Near-miss count is not sacred data; localStorage is the lighter fit than the
// observer doc for a pity floor. Keyed globally per browser.
const MISS_KEY = 'delta7:almost:misses';
const PITY_MISSES = 4;                  // after this many misses, the next open catches
const POST_CATCH_MISS_ODDS = 1 / 6;     // near-miss ambience becomes rare after the catch
const NEAR_MISS_ODDS = 0.42;            // chance a fresh open drifts something past the edge

const readMisses = (): number => {
    try {
        const raw = window.localStorage.getItem(MISS_KEY);
        return raw ? Math.max(0, parseInt(raw, 10) || 0) : 0;
    } catch {
        return 0;
    }
};
const writeMisses = (n: number) => {
    try { window.localStorage.setItem(MISS_KEY, String(Math.max(0, n))); } catch { /* ignore */ }
};

type AlmostMode = 'none' | 'near-miss' | 'catch';

/**
 * The Almost (#10) — the near-miss at the window.
 *
 * On some opens, a blurred silhouette drifts across the feed edge and exits in
 * ~2.5s; the caption reacts ("Did you see that? Tell me you saw that."). A pity
 * timer counts misses in localStorage: after N misses the next open is a CATCH —
 * the shape lingers center-frame ~4s and clicking/tapping it (or letting it
 * linger to completion) resolves one clear frame with a one-line caption, then
 * marks lore:the-almost so it never repeats hollowly. After the catch, near-
 * misses become rare ambience.
 *
 * Never blocks the feed or the RevealMask: the overlay is pointer-transparent
 * except for the catchable shape, and it lives inside the feed's children (below
 * RevealMask's hidden layer). Reduced motion: no drift; a due catch appears as a
 * still faint frame with the caption.
 */
export const TheAlmost: React.FC<TheAlmostProps> = ({ alreadyCaught, onCatch }) => {
    const [reducedMotion] = useState(
        () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );

    // Decide once, at mount (== one modal open), whether anything happens this
    // time. The initializer only READS (StrictMode invokes it twice in dev, so
    // it must stay pure); the one-shot side effects — clearing the forced-catch
    // flag and bumping the pity counter — run in the ref-guarded effect below.
    const [mode] = useState<AlmostMode>(() => {
        let forceCatch = false;
        try {
            forceCatch = window.sessionStorage.getItem('delta7:almost:force') === '1';
        } catch { /* ignore */ }

        if (alreadyCaught) {
            // Post-catch: only rare ambience, never another catch.
            return Math.random() < POST_CATCH_MISS_ODDS ? 'near-miss' : 'none';
        }
        if (forceCatch || readMisses() >= PITY_MISSES) return 'catch';
        return Math.random() < NEAR_MISS_ODDS ? 'near-miss' : 'none';
    });

    // Consume the decision's side effects exactly once per open. The ref guard
    // survives StrictMode's simulated remount, so neither the flag clear nor
    // the miss bump can double-fire in dev.
    const consumedRef = useRef(false);
    useEffect(() => {
        if (consumedRef.current) return;
        consumedRef.current = true;
        try { window.sessionStorage.removeItem('delta7:almost:force'); } catch { /* ignore */ }
        // A miss bumps the pity counter so a catch is guaranteed eventually.
        if (mode === 'near-miss' && !alreadyCaught) writeMisses(readMisses() + 1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const [resolved, setResolved] = useState(false);
    const catchTimerRef = useRef(0);

    const doCatch = useCallback(() => {
        if (resolved) return;
        setResolved(true);
        writeMisses(0);
        try { setFocusPull(0); } catch { /* never load-bearing */ }
        onCatch();
    }, [resolved, onCatch]);

    // Side effects of a catch: pull focus, and (unless reduced-motion) let the
    // shape linger ~4s then resolve on its own if untouched — the pity floor
    // guarantees a real catch, not just an endless taunt.
    useEffect(() => {
        if (mode !== 'catch') return undefined;
        try { setFocusPull(0.7); } catch { /* ignore */ }
        if (reducedMotion) return undefined;   // still frame; resolves on click only
        catchTimerRef.current = window.setTimeout(doCatch, 4200);
        return () => window.clearTimeout(catchTimerRef.current);
    }, [mode, reducedMotion, doCatch]);

    // Dev hook: force the next open (of this panel) to be a catch. Mirrors the
    // existing __storm / __roomFx console-hook precedent.
    useEffect(() => {
        if (!import.meta.env.DEV || typeof window === 'undefined') return;
        (window as unknown as { __almost: unknown }).__almost = {
            forceCatch: () => {
                try { window.sessionStorage.setItem('delta7:almost:force', '1'); } catch { /* ignore */ }
                console.info('[Delta-7] __almost: next Observation Port open will catch. Reopen the window.');
            },
            resetMisses: () => writeMisses(0),
            misses: () => readMisses(),
        };
    }, []);

    // --- Resolved frame: a single composed still, one line in-voice ----------
    if (resolved) {
        return (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                <div className="almost-resolved relative flex h-full w-full items-center justify-center">
                    <svg viewBox="0 0 200 120" className="h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
                        <defs>
                            <radialGradient id="almost-halo" cx="50%" cy="46%" r="60%">
                                <stop offset="0%" stopColor="rgba(238,244,236,0.32)" />
                                <stop offset="55%" stopColor="rgba(190,205,198,0.10)" />
                                <stop offset="100%" stopColor="transparent" />
                            </radialGradient>
                        </defs>
                        <rect width="200" height="120" fill="url(#almost-halo)" />
                        {/* A figure, finally still enough to resolve: shoulders and a turned head. */}
                        <g fill="rgba(230,238,232,0.82)">
                            <ellipse cx="100" cy="50" rx="11" ry="13" />
                            <path d="M 78 118 Q 82 74 100 72 Q 118 74 122 118 Z" />
                        </g>
                    </svg>
                    <p className="absolute bottom-4 left-4 right-4 text-center font-['EB_Garamond'] text-base italic leading-snug text-[#eef4ec]/90 [text-shadow:0_0_12px_rgba(238,244,236,0.4)]">
                        One frame held still. It was someone. It was looking back.
                    </p>
                </div>
            </div>
        );
    }

    if (mode === 'none') return null;

    if (mode === 'near-miss') {
        return (
            <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
                {!reducedMotion && (
                    <div className="almost-drift absolute top-1/2 h-24 w-16 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(220,232,226,0.5),rgba(200,214,208,0.12)_60%,transparent_75%)] blur-[6px]" aria-hidden="true" />
                )}
                {/* Kael reacts to the thing that just left frame. */}
                <p className="almost-caption absolute bottom-3 left-4 right-4 font-['EB_Garamond'] text-sm italic leading-snug text-[#eef4ec]/78 [text-shadow:0_0_10px_rgba(238,244,236,0.3)]">
                    Did you see that? Tell me you saw that.
                </p>
            </div>
        );
    }

    // mode === 'catch'
    return (
        <div className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden">
            <button
                type="button"
                onClick={doCatch}
                aria-label="Resolve the shape at the window"
                className={`almost-catch pointer-events-auto relative h-28 w-20 rounded-full bg-[radial-gradient(circle,rgba(224,236,230,0.62),rgba(200,214,208,0.16)_58%,transparent_74%)] ${reducedMotion ? '' : 'blur-[5px]'} cursor-pointer`}
                style={reducedMotion ? { opacity: 0.55 } : undefined}
            />
        </div>
    );
};
