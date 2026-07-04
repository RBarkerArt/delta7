import React from 'react';

/**
 * RevealMask — "hold it to the light" (#8).
 *
 * Wraps an artifact. A hidden layer (`hidden`) sits over the visible one and is
 * revealed only through a soft radial aperture that follows the pointer/finger,
 * driven by CSS `mask-image: radial-gradient(...)` centered on `--light-x/y`.
 * Pointer moves are written straight to element style inside a single rAF —
 * the same discipline as RoomModal's tilt — so tracking never triggers a React
 * render. Long-press (touch) or holding still (desktop) widens the aperture a
 * little, as if leaning in.
 *
 * Accessibility / no-pointer / reduced-motion: a visible "hold to the light"
 * toggle reveals the hidden layer fully. The hidden content is always in the
 * DOM (style-obscured via mask, never display:none), so screen readers and
 * keyboard users get it as normal text.
 */

interface RevealMaskProps {
    /** The always-visible surface (e.g. fogged glass, a redacted page). */
    children: React.ReactNode;
    /** The layer revealed through the aperture (e.g. Kael's wiped-clear line). */
    hidden: React.ReactNode;
    /** Label on the accessible reveal toggle. */
    toggleLabel?: string;
    className?: string;
}

const REST_RADIUS = 0;         // aperture starts closed
const ACTIVE_RADIUS = 82;      // px radius while sweeping
const LEAN_RADIUS = 118;       // widened radius on long-press / hover-still
const LEAN_DELAY_MS = 460;     // hold this long and the aperture opens up

export const RevealMask: React.FC<RevealMaskProps> = ({
    children,
    hidden,
    toggleLabel = 'Hold to the light',
    className,
}) => {
    const layerRef = React.useRef<HTMLDivElement>(null);
    const rafRef = React.useRef(0);
    const pending = React.useRef<{ x: number; y: number } | null>(null);
    const radiusRef = React.useRef(REST_RADIUS);
    const leanTimerRef = React.useRef(0);
    const [fullyRevealed, setFullyRevealed] = React.useState(false);

    const reduced =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fine =
        typeof window !== 'undefined' &&
        window.matchMedia('(pointer: fine)').matches;

    const writeMask = React.useCallback(() => {
        rafRef.current = 0;
        const layer = layerRef.current;
        const p = pending.current;
        if (!layer || !p) return;
        layer.style.setProperty('--light-x', `${p.x.toFixed(1)}px`);
        layer.style.setProperty('--light-y', `${p.y.toFixed(1)}px`);
        layer.style.setProperty('--light-r', `${radiusRef.current.toFixed(1)}px`);
    }, []);

    const schedule = React.useCallback(() => {
        if (rafRef.current) return;
        rafRef.current = requestAnimationFrame(writeMask);
    }, [writeMask]);

    const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        if (fullyRevealed || reduced) return;
        const layer = layerRef.current;
        if (!layer) return;
        const rect = layer.getBoundingClientRect();
        pending.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
        if (radiusRef.current < ACTIVE_RADIUS) radiusRef.current = ACTIVE_RADIUS;
        schedule();
    };

    const armLean = React.useCallback(() => {
        window.clearTimeout(leanTimerRef.current);
        leanTimerRef.current = window.setTimeout(() => {
            radiusRef.current = LEAN_RADIUS;
            schedule();
        }, LEAN_DELAY_MS);
    }, [schedule]);

    const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        if (fullyRevealed || reduced) return;
        handlePointerMove(event);
        armLean();
    };

    const handlePointerLeaveOrUp = () => {
        window.clearTimeout(leanTimerRef.current);
        if (fullyRevealed) return;
        // Close the aperture back down; on touch this hides the line again so it
        // stays something you physically hold open.
        radiusRef.current = REST_RADIUS;
        pending.current = pending.current ?? { x: -9999, y: -9999 };
        schedule();
    };

    React.useEffect(() => () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        window.clearTimeout(leanTimerRef.current);
    }, []);

    // When fully revealed (toggle), drop the mask so the whole hidden layer
    // shows. Reduced-motion skips the sweep entirely: the layer is obscured via
    // opacity (still in the accessibility tree — never display:none) until the
    // toggle reveals it.
    const layerStyle: React.CSSProperties = fullyRevealed
        ? { opacity: 1 }
        : reduced
        ? { opacity: 0 }
        : ({
              '--light-x': '-9999px',
              '--light-y': '-9999px',
              '--light-r': `${REST_RADIUS}px`,
              WebkitMaskImage:
                  'radial-gradient(circle var(--light-r) at var(--light-x) var(--light-y), #000 0%, #000 62%, transparent 100%)',
              maskImage:
                  'radial-gradient(circle var(--light-r) at var(--light-x) var(--light-y), #000 0%, #000 62%, transparent 100%)',
          } as React.CSSProperties);

    return (
        <div
            className={`reveal-mask relative overflow-hidden ${className ?? ''}`}
            onPointerMove={handlePointerMove}
            onPointerDown={handlePointerDown}
            onPointerLeave={handlePointerLeaveOrUp}
            onPointerUp={handlePointerLeaveOrUp}
            onPointerCancel={handlePointerLeaveOrUp}
            style={{
                // touch-action none only while the sweep is live: once revealed
                // (or under reduced motion) it must not eat page scrolling.
                touchAction: fullyRevealed || reduced ? 'auto' : 'none',
            }}
        >
            {children}

            {/* Hidden layer — always in the DOM for SR/keyboard; revealed through
                the aperture (or fully, when toggled). */}
            <div
                ref={layerRef}
                className="pointer-events-none absolute inset-0 transition-opacity duration-300"
                style={layerStyle}
            >
                {hidden}
            </div>

            {/* Accessible reveal affordance. Visible to keyboard/no-pointer users;
                on fine pointers it fades to a faint hint so the sweep stays the
                primary play but the fallback is never fully hidden. */}
            <button
                type="button"
                onClick={() => setFullyRevealed(v => !v)}
                aria-pressed={fullyRevealed}
                className={`reveal-mask-toggle absolute bottom-2 right-2 z-10 border border-[#f2ead0]/24 bg-black/45 px-2 py-1 text-[9px] uppercase tracking-[0.2em] text-[#f7f1dc]/70 transition-opacity hover:border-emerald-100/45 hover:text-[#fff7df] ${fine && !fullyRevealed ? 'opacity-35 hover:opacity-100' : 'opacity-80'}`}
            >
                {fullyRevealed ? 'Let it fog over' : toggleLabel}
            </button>
        </div>
    );
};
