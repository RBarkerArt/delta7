import React from 'react';
import { useSound } from '../../hooks/useSound';

/**
 * FlipCard — turn the artifact over (#8).
 *
 * A two-sided card. Drag horizontally past 50% of the card width to commit a
 * `rotateY` flip (backface-visibility: hidden hides the reverse mid-turn); a
 * short drag springs back. A visible flip affordance (and Enter/Space when the
 * card is focused) flips without dragging, for pointer-free use.
 * `playModalOpen('paper')` fires on each committed flip — the paper turning over.
 *
 * The live drag angle is written straight to a `--flip` CSS var on rAF (no
 * React render in the loop — same discipline as RoomModal's tilt). Rotation is
 * tracked continuously in a ref and never normalized, so the spring always
 * continues in the direction you dragged instead of unwinding the long way;
 * React state only tracks parity for labels/aria.
 *
 * Reduced-motion: the rotation is replaced by an opacity crossfade between the
 * two faces (no 3D transform), and both faces stay in the accessibility tree.
 */

interface FlipCardProps {
    front: React.ReactNode;
    back: React.ReactNode;
    /** Accessible label for the flip control, e.g. "Turn the note over". */
    flipLabel?: string;
    className?: string;
    /** Min height so the absolutely-positioned faces reserve space. */
    minHeight?: number | string;
}

const FLIP_TRANSITION = 'transform 460ms cubic-bezier(0.22, 1, 0.36, 1)';

export const FlipCard: React.FC<FlipCardProps> = ({
    front,
    back,
    flipLabel = 'Turn it over',
    className,
    minHeight = 160,
}) => {
    const { playModalOpen } = useSound();
    const [flipped, setFlipped] = React.useState(false);
    const cardRef = React.useRef<HTMLDivElement>(null);
    const dragRef = React.useRef<{ startX: number; width: number; startRotation: number } | null>(null);
    const rafRef = React.useRef(0);
    const dragXRef = React.useRef(0);
    // Continuous rotation in degrees; parity (odd multiples of 180) == flipped.
    const rotationRef = React.useRef(0);

    const reduced =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Settle the card to a resting rotation (with the spring transition) and
    // sync parity state. The --flip var is driven imperatively only — it is
    // deliberately NOT in the JSX style object, so React re-renders never
    // clobber a mid-flight angle.
    const settleTo = React.useCallback((rotation: number) => {
        rotationRef.current = rotation;
        const card = cardRef.current;
        if (card) {
            card.style.transition = FLIP_TRANSITION;
            card.style.setProperty('--flip', `${rotation}deg`);
        }
        const nextFlipped = Math.round(Math.abs(rotation) / 180) % 2 === 1;
        setFlipped(prev => {
            if (prev !== nextFlipped) playModalOpen('paper');
            return nextFlipped;
        });
    }, [playModalOpen]);

    const flip = React.useCallback(() => {
        settleTo(rotationRef.current + 180);
    }, [settleTo]);

    const writeDrag = React.useCallback(() => {
        rafRef.current = 0;
        const card = cardRef.current;
        const drag = dragRef.current;
        if (!card || !drag) return;
        const frac = Math.max(-1, Math.min(1, dragXRef.current / (drag.width * 0.5)));
        card.style.setProperty('--flip', `${(drag.startRotation + frac * 180).toFixed(1)}deg`);
    }, []);

    const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        if (reduced) return;
        const card = cardRef.current;
        if (!card) return;
        // Ignore drags that begin on interactive content inside a face.
        if ((event.target as HTMLElement).closest('button, a, input, textarea, select')) return;
        dragRef.current = {
            startX: event.clientX,
            width: Math.max(1, card.getBoundingClientRect().width),
            startRotation: rotationRef.current,
        };
        dragXRef.current = 0;
        card.style.transition = 'none';
        card.setPointerCapture?.(event.pointerId);
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current;
        if (!drag) return;
        dragXRef.current = event.clientX - drag.startX;
        if (!rafRef.current) rafRef.current = requestAnimationFrame(writeDrag);
    };

    const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current;
        dragRef.current = null;
        const card = cardRef.current;
        card?.releasePointerCapture?.(event.pointerId);
        if (!drag || !card) return;
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = 0;
        }
        const passed = Math.abs(dragXRef.current) > drag.width * 0.5;
        const direction = dragXRef.current < 0 ? -1 : 1;
        // Commit continues the drag direction; a short drag springs back.
        settleTo(passed ? drag.startRotation + direction * 180 : drag.startRotation);
    };

    React.useEffect(() => () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }, []);

    const heightStyle = typeof minHeight === 'number' ? `${minHeight}px` : minHeight;

    // Reduced-motion: no 3D — crossfade the two faces in place.
    if (reduced) {
        return (
            <div className={`relative ${className ?? ''}`} style={{ minHeight: heightStyle }}>
                <div className={`transition-opacity duration-300 ${flipped ? 'pointer-events-none absolute inset-0 opacity-0' : 'opacity-100'}`}>
                    {front}
                </div>
                <div className={`transition-opacity duration-300 ${flipped ? 'opacity-100' : 'pointer-events-none absolute inset-0 opacity-0'}`}>
                    {back}
                </div>
                <button
                    type="button"
                    onClick={() => {
                        playModalOpen('paper');
                        setFlipped(prev => !prev);
                    }}
                    aria-pressed={flipped}
                    className="flip-card-affordance absolute bottom-2 right-2 z-10 border border-[#f2ead0]/24 bg-black/45 px-2 py-1 text-[9px] uppercase tracking-[0.2em] text-[#f7f1dc]/70 transition-colors hover:border-emerald-100/45 hover:text-[#fff7df]"
                >
                    {flipped ? 'Turn it back' : flipLabel}
                </button>
            </div>
        );
    }

    return (
        <div
            className={`flip-card relative ${className ?? ''}`}
            style={{ perspective: '1400px', minHeight: heightStyle }}
        >
            <div
                ref={cardRef}
                tabIndex={0}
                role="group"
                aria-label={flipLabel}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        flip();
                    }
                }}
                className="flip-card-inner relative w-full outline-none"
                style={{
                    minHeight: heightStyle,
                    transformStyle: 'preserve-3d',
                    transform: 'rotateY(var(--flip, 0deg))',
                    transition: FLIP_TRANSITION,
                    touchAction: 'pan-y',
                }}
            >
                <div
                    className="w-full"
                    style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
                >
                    {front}
                </div>
                <div
                    className="absolute inset-0 w-full"
                    style={{
                        backfaceVisibility: 'hidden',
                        WebkitBackfaceVisibility: 'hidden',
                        transform: 'rotateY(180deg)',
                    }}
                >
                    {back}
                </div>
            </div>
            <button
                type="button"
                onClick={flip}
                aria-pressed={flipped}
                className="flip-card-affordance absolute bottom-2 right-2 z-10 border border-[#f2ead0]/24 bg-black/45 px-2 py-1 text-[9px] uppercase tracking-[0.2em] text-[#f7f1dc]/70 transition-colors hover:border-emerald-100/45 hover:text-[#fff7df]"
            >
                {flipped ? 'Turn it back' : flipLabel}
            </button>
        </div>
    );
};
