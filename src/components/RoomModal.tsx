import React from 'react';
import { X } from 'lucide-react';
import { useSound } from '../hooks/useSound';
import { lockBodyScroll, unlockBodyScroll } from '../lib/scrollLock';
import { setRoomFxTarget } from '../lib/roomFx';
import { onStormStrike } from '../lib/stormDirector';
import { corruptGlyphString } from '../lib/textCorruption';
import { getMarginaliaLine, getReturnMarginalia } from '../lib/kaelMarginalia';
import { consumeReturnGreeting } from '../lib/returnGreeting';
import { getObserverSession } from '../lib/visitor';
import { useCoherence } from '../hooks/useCoherence';
import { TypeOn } from './ui/TypeOn';
import { DecodeText } from './ui/DecodeText';

type RoomModalVariant =
    | 'blackboard'
    | 'drawer'
    | 'window'
    | 'prologue'
    | 'archive'
    | 'support'
    | 'security'
    | 'room-signal'
    | 'break-clock'
    | 'break-bulletin'
    | 'break-coffee'
    | 'break-fridge'
    | 'cart-map'
    | 'cart-compass'
    | 'cart-dead-zones'
    | 'cart-room-index'
    | 'cart-route-trace'
    | 'cart-relay-tuning'
    | 'cart-notes'
    | 'cart-unmarked-door'
    | 'cart-sector-scan'
    | 'lore';

interface RoomModalProps {
    title: string;
    eyebrow?: string;
    onClose: () => void;
    children: React.ReactNode;
    maxWidth?: string;
    variant?: RoomModalVariant;
    /** Current signal day, used to seed Kael's marginalia line. Falls back to 0. */
    marginaliaDay?: number;
    /**
     * Physical read-trace state for this panel's paper. 'unread' shows nothing;
     * 'paper' folds a dog-eared corner; 'instrument' leaves a faint fingerprint
     * smudge. Aria-hidden, purely decorative — the room remembering you were here.
     */
    readTrace?: 'unread' | 'paper' | 'instrument';
    /**
     * Origin Flight (#1): the on-screen box of the hotspot that opened this
     * modal. When present, the panel springs geometrically out of that box on
     * open and collapses back into it on close. Null/undefined (programmatic
     * opens, or reduced-motion) → the existing centered fade.
     */
    originRect?: DOMRect | null;
}

const MODAL_AMBIENCE: Record<RoomModalVariant, string> = {
    blackboard: 'from-emerald-300/18 via-transparent to-cyan-300/10',
    drawer: 'from-[#f2ead0]/16 via-transparent to-amber-200/10',
    window: 'from-cyan-200/18 via-transparent to-emerald-200/14',
    prologue: 'from-[#f2ead0]/18 via-transparent to-emerald-200/12',
    archive: 'from-amber-100/15 via-transparent to-[#f2ead0]/10',
    support: 'from-rose-100/12 via-transparent to-emerald-200/12',
    security: 'from-emerald-200/18 via-transparent to-red-200/10',
    'room-signal': 'from-white/16 via-transparent to-emerald-200/12',
    'break-clock': 'from-cyan-200/14 via-transparent to-emerald-200/10',
    'break-bulletin': 'from-amber-100/14 via-transparent to-emerald-200/10',
    'break-coffee': 'from-[#f2ead0]/16 via-transparent to-emerald-200/10',
    'break-fridge': 'from-cyan-100/12 via-transparent to-[#f2ead0]/10',
    'cart-map': 'from-emerald-300/18 via-transparent to-[#f2ead0]/10',
    'cart-compass': 'from-emerald-200/16 via-transparent to-cyan-300/10',
    'cart-dead-zones': 'from-red-300/14 via-transparent to-red-200/10',
    'cart-room-index': 'from-emerald-300/12 via-transparent to-cyan-300/10',
    'cart-route-trace': 'from-emerald-300/14 via-transparent to-emerald-200/10',
    'cart-relay-tuning': 'from-cyan-300/16 via-transparent to-emerald-200/10',
    'cart-notes': 'from-amber-200/14 via-transparent to-[#f2ead0]/10',
    'cart-unmarked-door': 'from-emerald-300/14 via-transparent to-red-200/10',
    'cart-sector-scan': 'from-emerald-300/18 via-transparent to-[#f2ead0]/10',
    lore: 'from-[#f2ead0]/14 via-transparent to-emerald-200/10',
};

const MODAL_SCAN: Record<RoomModalVariant, string> = {
    blackboard: 'opacity-45',
    drawer: 'opacity-20',
    window: 'opacity-55',
    prologue: 'opacity-40',
    archive: 'opacity-28',
    support: 'opacity-18',
    security: 'opacity-60',
    'room-signal': 'opacity-48',
    'break-clock': 'opacity-35',
    'break-bulletin': 'opacity-24',
    'break-coffee': 'opacity-22',
    'break-fridge': 'opacity-30',
    'cart-map': 'opacity-40',
    'cart-compass': 'opacity-35',
    'cart-dead-zones': 'opacity-45',
    'cart-room-index': 'opacity-30',
    'cart-route-trace': 'opacity-28',
    'cart-relay-tuning': 'opacity-35',
    'cart-notes': 'opacity-22',
    'cart-unmarked-door': 'opacity-35',
    'cart-sector-scan': 'opacity-42',
    lore: 'opacity-30',
};

/**
 * Open-sound flavor per variant. Papery surfaces (drawers, notes, bulletins,
 * lore, archives) rustle; instruments and displays chirp through the room
 * reverb. Anything not explicitly papery falls through to 'instrument'.
 */
const PAPER_VARIANTS: ReadonlySet<RoomModalVariant> = new Set([
    'drawer',
    'archive',
    'prologue',
    'cart-notes',
    'break-bulletin',
    'lore',
    'support',
    'blackboard',
]);

const modalOpenKind = (variant: RoomModalVariant): 'paper' | 'instrument' =>
    PAPER_VARIANTS.has(variant) ? 'paper' : 'instrument';

const EXIT_DURATION_MS = 170;
// Origin Flight (#1): a slightly longer, physical spring than the plain fade —
// the panel travels from the hotspot to rest (and back). Tuned to feel like the
// panel has mass without dragging.
const FLIGHT_ENTER_MS = 380;
const FLIGHT_EXIT_MS = 300;
// Drag-to-dismiss: how far the panel must be flung down (px) to release, and how
// hard the rubber-band resists past that.
const DISMISS_THRESHOLD_PX = 130;
const RUBBER_BAND = 0.55;

const prefersReducedMotion = (): boolean =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const RoomModal: React.FC<RoomModalProps> = ({
    title,
    eyebrow,
    onClose,
    children,
    maxWidth = 'max-w-2xl',
    variant = 'blackboard',
    marginaliaDay,
    readTrace = 'unread',
    originRect = null
}) => {
    const { playClick, playModalOpen, duck, releaseDuck } = useSound();
    const { score } = useCoherence();

    // On the FIRST modal opened after a real absence, the return greeting is
    // consumed exactly once at mount and leads in place of the normal line —
    // Kael addressing the gap directly. Consumed in an effect (not render) so
    // StrictMode's double-render can't swallow the one-shot flag on a throwaway.
    const [returnHours, setReturnHours] = React.useState<number | null>(null);
    React.useEffect(() => {
        // Functional update: StrictMode re-runs this effect, and the second
        // consume returns null — it must not clobber a greeting already taken.
        setReturnHours(prev => prev ?? consumeReturnGreeting());
    }, []);

    // Kael's marginalia: a quiet first-person line, stable per (variant-group,
    // day, observer). At low coherence his notes fray, so we scramble-resolve
    // them instead of typing them cleanly.
    const marginaliaLine = React.useMemo(() => {
        const seed = getObserverSession().visitorId;
        if (returnHours !== null) return getReturnMarginalia(returnHours, seed);
        return getMarginaliaLine(variant, marginaliaDay ?? 0, seed);
    }, [variant, marginaliaDay, returnHours]);
    const marginaliaFrayed = score < 45;
    const panelRef = React.useRef<HTMLDivElement>(null);
    // Outer wrapper that carries the Origin Flight transform + drag offset. Kept
    // separate from panelRef (which owns the pointer-tilt transform) so the two
    // transforms never fight — flight/drag on the wrapper, tilt on the panel.
    const flightRef = React.useRef<HTMLDivElement>(null);
    const titleRef = React.useRef<HTMLHeadingElement>(null);
    const contentRef = React.useRef<HTMLDivElement>(null);
    const cueRef = React.useRef<HTMLDivElement>(null);
    const cueLabelRef = React.useRef<HTMLSpanElement>(null);
    const closingRef = React.useRef(false);
    const [isClosing, setIsClosing] = React.useState(false);

    // Origin Flight is active only when we have a source box AND motion is
    // allowed. Frozen for the modal's lifetime (reduced-motion can't change
    // mid-open, and the source box is captured at open).
    const flightActive = React.useMemo(
        () => Boolean(originRect) && !prefersReducedMotion(),
        [originRect]
    );

    // Compute the transform that places the resting panel back over `originRect`
    // (translate its center onto the hotspot, scale down to ~the hotspot size).
    // FLIP-style: measured against the wrapper's own resting box, so it's exact
    // regardless of panel size / viewport. Returns null if geometry is missing.
    const computeOriginTransform = React.useCallback((): string | null => {
        const wrapper = flightRef.current;
        if (!wrapper || !originRect) return null;
        const rest = wrapper.getBoundingClientRect();
        if (rest.width < 1 || rest.height < 1) return null;
        const restCx = rest.left + rest.width / 2;
        const restCy = rest.top + rest.height / 2;
        const originCx = originRect.left + originRect.width / 2;
        const originCy = originRect.top + originRect.height / 2;
        // Scale so the panel shrinks toward the hotspot's footprint, floored so a
        // tiny hotspot doesn't collapse the panel to a dot.
        const scale = Math.max(0.06, Math.min(0.6, (originRect.width || 40) / rest.width));
        const dx = originCx - restCx;
        const dy = originCy - restCy;
        return `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) scale(${scale.toFixed(4)})`;
    }, [originRect]);

    // Enter flight: place the wrapper at the origin instantly (no transition),
    // then on the next frame release to identity with a spring transition. Layout
    // effect so the "at origin" frame paints before the release — no flash of the
    // panel at rest.
    React.useLayoutEffect(() => {
        if (!flightActive) return;
        const wrapper = flightRef.current;
        const from = computeOriginTransform();
        if (!wrapper || !from) return;
        wrapper.style.transition = 'none';
        wrapper.style.transformOrigin = 'center center';
        wrapper.style.opacity = '0.2';
        wrapper.style.transform = from;
        // Force a reflow so the from-state is committed before we transition.
        void wrapper.offsetWidth;
        const raf = requestAnimationFrame(() => {
            wrapper.style.transition = `transform ${FLIGHT_ENTER_MS}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${FLIGHT_ENTER_MS * 0.6}ms ease-out`;
            wrapper.style.transform = 'translate3d(0, 0, 0) scale(1)';
            wrapper.style.opacity = '1';
        });
        return () => cancelAnimationFrame(raf);
    }, [flightActive, computeOriginTransform]);

    // Read-progress telemetry: written straight to element styles so scroll
    // events never trigger React renders. Geometry (scrollHeight/clientHeight)
    // is measured only on resize — reading it inside the scroll handler after
    // style writes forces a synchronous layout every frame and janks scrolling,
    // worst on 120Hz iPhones. Writes are coalesced into one rAF per frame.
    const maxScrollRef = React.useRef(0);
    const lastPctRef = React.useRef(-1);
    const atEndRef = React.useRef<boolean | null>(null);
    const cueRafRef = React.useRef(0);

    const applyScrollCue = React.useCallback(() => {
        cueRafRef.current = 0;
        const content = contentRef.current;
        const cue = cueRef.current;
        if (!content || !cue) return;

        const maxScroll = maxScrollRef.current;
        if (maxScroll <= 24) return;

        const progress = Math.min(1, Math.max(0, content.scrollTop / maxScroll));
        cue.style.setProperty('--scroll-progress', progress.toFixed(4));

        const atEnd = progress >= 0.985;
        if (atEnd !== atEndRef.current) {
            atEndRef.current = atEnd;
            cue.dataset.atEnd = atEnd ? 'true' : 'false';
        }
        const pct = Math.round(progress * 100);
        if (pct !== lastPctRef.current && cueLabelRef.current) {
            lastPctRef.current = pct;
            cueLabelRef.current.textContent = `BUFFER ${pct}% READ`;
        }
    }, []);

    const onCueScroll = React.useCallback(() => {
        if (cueRafRef.current) return;
        cueRafRef.current = requestAnimationFrame(applyScrollCue);
    }, [applyScrollCue]);

    // Measure geometry on mount and whenever the panel or its content resizes;
    // the scroll handler itself never reads layout.
    const measureScrollCue = React.useCallback(() => {
        const content = contentRef.current;
        const cue = cueRef.current;
        if (!content || !cue) return;
        const maxScroll = content.scrollHeight - content.clientHeight;
        maxScrollRef.current = maxScroll;
        cue.classList.toggle('hidden', maxScroll <= 24);
        if (maxScroll > 24) applyScrollCue();
    }, [applyScrollCue]);

    React.useEffect(() => {
        measureScrollCue();
        const content = contentRef.current;
        if (!content || typeof ResizeObserver === 'undefined') return undefined;
        // Watch both the viewport box and the inner content, so async-loaded
        // panel content re-triggers the overflow check.
        const observer = new ResizeObserver(measureScrollCue);
        observer.observe(content);
        if (content.firstElementChild) observer.observe(content.firstElementChild);
        return () => {
            observer.disconnect();
            if (cueRafRef.current) cancelAnimationFrame(cueRafRef.current);
        };
    }, [measureScrollCue]);

    const requestClose = React.useCallback(() => {
        if (closingRef.current) return;
        closingRef.current = true;
        playClick();
        if (prefersReducedMotion()) {
            onClose();
            return;
        }
        setIsClosing(true);
        // Origin Flight (#1): reverse the flight back into the hotspot. Drive the
        // wrapper transform imperatively so it composes with any live drag offset,
        // then close once the flight lands. Falls back to the CSS panel-out
        // animation (via isClosing) when there's no origin box.
        if (flightActive) {
            const wrapper = flightRef.current;
            const to = computeOriginTransform();
            if (wrapper && to) {
                wrapper.style.transition = `transform ${FLIGHT_EXIT_MS}ms cubic-bezier(0.5, 0, 0.75, 0), opacity ${FLIGHT_EXIT_MS}ms ease-in`;
                wrapper.style.transform = to;
                wrapper.style.opacity = '0';
                window.setTimeout(onClose, FLIGHT_EXIT_MS);
                return;
            }
        }
        window.setTimeout(onClose, EXIT_DURATION_MS);
    }, [onClose, playClick, flightActive, computeOriginTransform]);

    React.useEffect(() => {
        // Duck the room ambience and play the variant-appropriate open cue.
        duck(0.4, 0.3);
        playModalOpen(modalOpenKind(variant));
        // World defers while you read: room dims and fog creeps in behind the panel.
        setRoomFxTarget({ dim: 0.35, fogBoost: 0.15 });
        return () => {
            releaseDuck(0.6);
            setRoomFxTarget({ dim: 0, fogBoost: 0 });
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    React.useEffect(() => {
        const previouslyFocused = document.activeElement as HTMLElement | null;
        panelRef.current?.focus({ preventScroll: true });

        lockBodyScroll();

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.stopPropagation();
                requestClose();
                return;
            }
            if (event.key !== 'Tab') return;

            // Keep focus cycling inside the panel.
            const panel = panelRef.current;
            if (!panel) return;
            const focusable = panel.querySelectorAll<HTMLElement>(
                'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
            );
            if (focusable.length === 0) {
                event.preventDefault();
                return;
            }
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', handleKeyDown, true);
        return () => {
            document.removeEventListener('keydown', handleKeyDown, true);
            unlockBodyScroll();
            previouslyFocused?.focus?.({ preventScroll: true });
        };
    }, [requestClose]);

    const resetPerspective = React.useCallback(() => {
        const panel = panelRef.current;
        if (!panel) return;
        panel.style.setProperty('--modal-tilt-x', '0deg');
        panel.style.setProperty('--modal-tilt-y', '0deg');
        panel.style.setProperty('--modal-shift-x', '0px');
        panel.style.setProperty('--modal-shift-y', '0px');
        panel.style.setProperty('--modal-parallax-x', '0px');
        panel.style.setProperty('--modal-parallax-y', '0px');
    }, []);

    const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        const panel = panelRef.current;
        if (!panel) return;

        const rect = panel.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
        const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;

        panel.style.setProperty('--modal-tilt-x', `${(-y * 1.8).toFixed(2)}deg`);
        panel.style.setProperty('--modal-tilt-y', `${(x * 2.2).toFixed(2)}deg`);
        panel.style.setProperty('--modal-shift-x', `${(x * 3).toFixed(2)}px`);
        panel.style.setProperty('--modal-shift-y', `${(y * 2).toFixed(2)}px`);
        panel.style.setProperty('--modal-parallax-x', `${(-x * 14).toFixed(2)}px`);
        panel.style.setProperty('--modal-parallax-y', `${(-y * 10).toFixed(2)}px`);
    };

    // --- Physical drag-to-dismiss (touch) --------------------------------------
    // Initiated only from the header bar so it never fights content scrolling.
    // The panel rubber-bands down and, past a threshold, closes with the flight;
    // short drags spring back. Offset is written straight to the wrapper on rAF
    // (same discipline as the tilt), and React state stays out of the drag loop.
    const dragRef = React.useRef<{ startY: number; active: boolean } | null>(null);
    const dragOffsetRef = React.useRef(0);
    const dragRafRef = React.useRef(0);

    const writeDragOffset = React.useCallback(() => {
        dragRafRef.current = 0;
        const wrapper = flightRef.current;
        if (!wrapper) return;
        const dy = dragOffsetRef.current;
        wrapper.style.transform = `translate3d(0, ${dy.toFixed(1)}px, 0)`;
        // Fade slightly as it's pulled away, so release-to-close reads as intent.
        wrapper.style.opacity = (1 - Math.min(0.4, dy / (DISMISS_THRESHOLD_PX * 3))).toFixed(3);
    }, []);

    const onHeaderPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        if (prefersReducedMotion()) return;
        // Primary pointer only; ignore drags that start on the close button.
        if ((event.target as HTMLElement).closest('button')) return;
        const wrapper = flightRef.current;
        if (!wrapper) return;
        dragRef.current = { startY: event.clientY, active: true };
        dragOffsetRef.current = 0;
        wrapper.style.transition = 'none';
        event.currentTarget.setPointerCapture?.(event.pointerId);
    };

    const onHeaderPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current;
        if (!drag?.active) return;
        const raw = event.clientY - drag.startY;
        // Only downward drags dismiss; upward is rubber-banded hard so the panel
        // barely gives, and never travels up off-screen.
        dragOffsetRef.current = raw > 0 ? raw * RUBBER_BAND : raw * 0.12;
        if (!dragRafRef.current) dragRafRef.current = requestAnimationFrame(writeDragOffset);
    };

    const onHeaderPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current;
        dragRef.current = null;
        event.currentTarget.releasePointerCapture?.(event.pointerId);
        if (!drag?.active) return;
        const wrapper = flightRef.current;
        if (dragRafRef.current) {
            cancelAnimationFrame(dragRafRef.current);
            dragRafRef.current = 0;
        }
        if (dragOffsetRef.current > DISMISS_THRESHOLD_PX) {
            requestClose();
            return;
        }
        // Spring back to rest.
        if (wrapper) {
            wrapper.style.transition = 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1), opacity 260ms ease-out';
            wrapper.style.transform = 'translate3d(0, 0, 0) scale(1)';
            wrapper.style.opacity = '1';
        }
        dragOffsetRef.current = 0;
    };

    // --- Storm-reactive flicker ------------------------------------------------
    // When the storm director fires a strike, an open modal reacts for a beat:
    // a 1-2px shiver, a brief content dim, and a few title glyphs corrupting via
    // the shared textCorruption util, then settle. Gated behind reduced-motion
    // (a single subtle brightness dip instead), clamped to once per strike, and
    // the title always restores so text stays readable.
    const [titleGlitch, setTitleGlitch] = React.useState<string | null>(null);
    const stormBusyRef = React.useRef(false);
    React.useEffect(() => {
        const isPaper = PAPER_VARIANTS.has(variant);
        const reduced = prefersReducedMotion();

        const unsubscribe = onStormStrike((intensity) => {
            if (stormBusyRef.current) return; // clamp: never twice per strike
            stormBusyRef.current = true;
            const panel = panelRef.current;

            if (reduced) {
                // Calm tier: a single brightness dip, no shiver, no corruption.
                if (panel) {
                    panel.style.transition = 'filter 220ms ease-out';
                    panel.style.filter = 'brightness(0.9)';
                    window.setTimeout(() => {
                        panel.style.filter = '';
                        stormBusyRef.current = false;
                    }, 240);
                } else {
                    stormBusyRef.current = false;
                }
                return;
            }

            // Papery panels rustle softer; instruments shiver harder + flicker.
            // The shiver runs via WAAPI on the independent `translate` property:
            // it can't collide with the panel's tilt transform, and it stays out
            // of the CSS `animation` cascade (which the instrument-bloom rule
            // owns on this element — a class-based shiver would lose to it).
            const shiver = isPaper ? 1 : 2;
            const dimTo = isPaper ? 0.94 : 0.86;
            if (panel) {
                if (typeof panel.animate === 'function') {
                    panel.animate(
                        [
                            { translate: '0px 0px' },
                            { translate: `${-shiver}px ${shiver}px`, offset: 0.2 },
                            { translate: `${shiver}px ${(-shiver * 0.6).toFixed(1)}px`, offset: 0.45 },
                            { translate: `${(-shiver * 0.5).toFixed(1)}px ${shiver}px`, offset: 0.7 },
                            { translate: '0px 0px' },
                        ],
                        { duration: 340, easing: 'ease-in-out' }
                    );
                }
                panel.style.setProperty('--storm-dim', String(dimTo));
            }

            // Corrupt a few title glyphs for a couple of quick beats, then restore.
            const strength = isPaper ? 0.35 : 0.6 * (0.6 + intensity * 0.4);
            let beats = 0;
            const flick = () => {
                beats += 1;
                setTitleGlitch(corruptGlyphString(title, strength));
                if (beats < (isPaper ? 1 : 2)) {
                    window.setTimeout(flick, 70);
                } else {
                    window.setTimeout(() => setTitleGlitch(null), 90);
                }
            };
            flick();

            window.setTimeout(() => {
                if (panel) panel.style.removeProperty('--storm-dim');
                stormBusyRef.current = false;
            }, 360);
        });

        return () => {
            unsubscribe();
            setTitleGlitch(null);
        };
    }, [variant, title]);

    return (
        <div
            onPointerDown={(event) => {
                if (event.target === event.currentTarget) requestClose();
            }}
            className={`fixed inset-0 z-[12000] flex min-h-dvh items-start justify-center overflow-hidden bg-black/72 px-3 py-3 font-mono select-none backdrop-blur-[3px] sm:items-center sm:p-5 ${isClosing ? 'room-modal-backdrop-exit' : 'room-modal-backdrop-enter'}`}
        >
            <div className="pointer-events-none fixed inset-0 overflow-hidden">
                <div className={`absolute left-1/2 top-1/2 h-[70vmin] w-[70vmin] -translate-x-1/2 -translate-y-1/2 bg-gradient-to-br ${MODAL_AMBIENCE[variant]} blur-3xl`} />
                <div className={`absolute inset-0 ${MODAL_SCAN[variant]} bg-[repeating-linear-gradient(0deg,transparent_0,transparent_12px,rgba(242,234,208,0.045)_13px,transparent_14px)]`} />
            </div>

            {/* Origin Flight wrapper: when flightActive, its transform is driven
                imperatively (enter/exit spring + drag), so the CSS panel-in/out
                animation is suppressed to avoid two transforms fighting. The
                boot-line/stagger choreography lives on inner elements and layers
                on top of the flight regardless. */}
            <div
                ref={flightRef}
                data-flight={flightActive ? 'true' : undefined}
                className={`flex w-full ${maxWidth} ${flightActive ? '' : isClosing ? 'room-modal-panel-exit' : 'room-modal-panel-enter'}`}
                style={flightActive ? { willChange: 'transform, opacity' } : undefined}
            >
            <div
                ref={panelRef}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                data-material={modalOpenKind(variant)}
                onPointerMove={handlePointerMove}
                onPointerLeave={resetPerspective}
                style={{
                    '--modal-tilt-x': '0deg',
                    '--modal-tilt-y': '0deg',
                    '--modal-shift-x': '0px',
                    '--modal-shift-y': '0px',
                    '--modal-parallax-x': '0px',
                    '--modal-parallax-y': '0px',
                    transform: 'perspective(1100px) rotateX(var(--modal-tilt-x)) rotateY(var(--modal-tilt-y)) translate3d(var(--modal-shift-x), var(--modal-shift-y), 0)',
                    transformStyle: 'preserve-3d'
                } as React.CSSProperties}
                className="room-modal-material relative flex w-full max-h-[calc(100dvh-1.5rem)] min-h-0 flex-col overflow-hidden border border-[#f2ead0]/20 bg-[#1b1a15]/95 shadow-[0_24px_80px_rgba(0,0,0,0.72),0_0_42px_rgba(242,234,208,0.06)] transition-transform duration-200 ease-out outline-none sm:max-h-[min(88vh,calc(100dvh-2.5rem))]"
            >
                <div
                    className={`pointer-events-none absolute -inset-12 bg-gradient-to-br ${MODAL_AMBIENCE[variant]} blur-2xl transition-transform duration-200`}
                    style={{ transform: 'translate3d(var(--modal-parallax-x), var(--modal-parallax-y), -60px)' }}
                />
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_0%,rgba(255,247,223,0.12),transparent_42%),linear-gradient(135deg,rgba(16,185,129,0.08),transparent_48%)]" />
                {/* Read-trace: the room remembers you opened this before. A dog-eared
                    corner on papery panels; a faint fingerprint smudge on instruments.
                    Decorative only. */}
                {readTrace === 'paper' && (
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute right-0 top-0 z-20 h-6 w-6 sm:h-7 sm:w-7"
                        style={{
                            background: 'linear-gradient(225deg, rgba(27,26,21,0.96) 0%, rgba(27,26,21,0.96) 48%, rgba(242,234,208,0.14) 50%, rgba(242,234,208,0.05) 100%)',
                            clipPath: 'polygon(100% 0, 0 0, 100% 100%)',
                            boxShadow: 'inset 1px 1px 3px rgba(0,0,0,0.5)'
                        }}
                    />
                )}
                {readTrace === 'instrument' && (
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute right-3 top-3 z-20 h-8 w-8 rounded-full opacity-[0.14] sm:h-9 sm:w-9"
                        style={{
                            background: 'radial-gradient(circle at 40% 40%, rgba(242,234,208,0.5) 0%, transparent 62%), repeating-radial-gradient(circle at 45% 45%, transparent 0, transparent 1.5px, rgba(242,234,208,0.25) 2px, transparent 3px)'
                        }}
                    />
                )}
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#fff7df]/55 to-transparent" />
                <div className="room-modal-boot-line pointer-events-none absolute inset-x-0 z-10 h-px bg-gradient-to-r from-transparent via-emerald-200/70 to-transparent shadow-[0_0_12px_rgba(16,185,129,0.45)]" />
                {/* Header bar doubles as the drag-to-dismiss handle (touch). Drag
                    only initiates here, never over the scrolling content, so it
                    can't fight the scroll. Desktop keeps X + Esc unchanged. */}
                <div
                    onPointerDown={onHeaderPointerDown}
                    onPointerMove={onHeaderPointerMove}
                    onPointerUp={onHeaderPointerUp}
                    onPointerCancel={onHeaderPointerUp}
                    style={{ touchAction: 'none' }}
                    className="relative shrink-0 flex items-start justify-between gap-4 border-b border-[#f2ead0]/16 bg-black/18 px-4 py-3 sm:px-6 sm:py-4"
                >
                    {/* Grabber: a faint diegetic pull-tab hinting the panel comes
                        off the wall. Only meaningful on touch; harmless on desktop. */}
                    <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1 h-0.5 w-9 -translate-x-1/2 rounded-full bg-[#f2ead0]/22 sm:hidden" />
                    <div className="min-w-0">
                        {eyebrow && (
                            <div className="room-modal-stagger mb-1 text-[10px] uppercase tracking-[0.22em] text-emerald-100/62" style={{ animationDelay: '60ms' }}>
                                {eyebrow}
                            </div>
                        )}
                        <h2
                            ref={titleRef}
                            className="room-modal-stagger text-base font-semibold uppercase tracking-[0.14em] text-[#fff7df]"
                            style={{ animationDelay: '120ms' }}
                        >
                            {titleGlitch ?? title}
                        </h2>
                    </div>
                    <button
                        onClick={requestClose}
                        className="shrink-0 border border-[#f2ead0]/16 bg-black/28 p-2 text-[#f7f1dc]/72 transition-colors hover:border-emerald-100/40 hover:text-[#fff7df]"
                        aria-label="Close panel"
                    >
                        <X size={15} />
                    </button>
                </div>
                <div className="relative min-h-0 flex-1">
                    <div
                        ref={contentRef}
                        onScroll={onCueScroll}
                        className="room-modal-content-storm room-modal-stagger relative h-full overflow-y-auto overscroll-contain px-4 py-4 text-[#f7f1dc] custom-scrollbar sm:px-6 sm:py-5"
                        style={{ animationDelay: '170ms', touchAction: 'pan-y' }}
                    >
                        <div>{children}</div>
                    </div>
                    <div ref={cueRef} className="room-scroll-cue pointer-events-none absolute inset-0 hidden" aria-hidden="true">
                        <div className="room-scroll-cue-fade absolute inset-x-0 bottom-0 h-12" />
                        <div className="room-scroll-cue-tick absolute right-0 top-0 h-full w-[2px]" />
                        <span ref={cueLabelRef} className="room-scroll-cue-label absolute bottom-2 right-3 text-[9px] uppercase tracking-[0.22em] text-emerald-100/55 sm:right-4" />
                    </div>
                </div>
                {/* Kael's marginalia — a quiet, hand-written line under the content. */}
                <div className="room-modal-marginalia pointer-events-none relative shrink-0 border-t border-[#f2ead0]/12 bg-black/22 px-4 py-2.5 sm:px-6">
                    <p
                        className="line-clamp-2 font-['EB_Garamond'] text-[11px] italic leading-snug tracking-wide text-[#d1d1c7]/60"
                        title={marginaliaLine}
                    >
                        {marginaliaFrayed ? (
                            <DecodeText text={marginaliaLine} speed={26} startDelay={600} />
                        ) : (
                            <TypeOn text={marginaliaLine} speed={22} startDelay={600} showCursor={false} />
                        )}
                    </p>
                </div>
            </div>
            </div>
        </div>
    );
};
