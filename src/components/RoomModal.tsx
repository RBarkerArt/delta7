import React from 'react';
import { X } from 'lucide-react';
import { useSound } from '../hooks/useSound';

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

export const RoomModal: React.FC<RoomModalProps> = ({
    title,
    eyebrow,
    onClose,
    children,
    maxWidth = 'max-w-2xl',
    variant = 'blackboard'
}) => {
    const { playClick } = useSound();
    const panelRef = React.useRef<HTMLDivElement>(null);

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

    return (
        <div className="fixed inset-0 z-[12000] flex min-h-dvh items-start justify-center overflow-y-auto bg-black/72 px-3 py-3 font-mono select-none backdrop-blur-[3px] sm:items-center sm:p-5">
            <div className="pointer-events-none fixed inset-0 overflow-hidden">
                <div className={`absolute left-1/2 top-1/2 h-[70vmin] w-[70vmin] -translate-x-1/2 -translate-y-1/2 bg-gradient-to-br ${MODAL_AMBIENCE[variant]} blur-3xl`} />
                <div className={`absolute inset-0 ${MODAL_SCAN[variant]} bg-[repeating-linear-gradient(0deg,transparent_0,transparent_12px,rgba(242,234,208,0.045)_13px,transparent_14px)]`} />
            </div>

            <div
                ref={panelRef}
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
                className={`relative flex w-full ${maxWidth} max-h-[calc(100dvh-1.5rem)] min-h-0 flex-col overflow-hidden border border-[#f2ead0]/20 bg-[#1b1a15]/95 shadow-[0_24px_80px_rgba(0,0,0,0.72),0_0_42px_rgba(242,234,208,0.06)] transition-transform duration-200 ease-out sm:max-h-[min(88vh,calc(100dvh-2.5rem))]`}
            >
                <div
                    className={`pointer-events-none absolute -inset-12 bg-gradient-to-br ${MODAL_AMBIENCE[variant]} blur-2xl transition-transform duration-200`}
                    style={{ transform: 'translate3d(var(--modal-parallax-x), var(--modal-parallax-y), -60px)' }}
                />
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_0%,rgba(255,247,223,0.12),transparent_42%),linear-gradient(135deg,rgba(16,185,129,0.08),transparent_48%)]" />
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#fff7df]/55 to-transparent" />
                <div className="relative shrink-0 flex items-start justify-between gap-4 border-b border-[#f2ead0]/16 bg-black/18 px-4 py-3 sm:px-6 sm:py-4">
                    <div className="min-w-0">
                        {eyebrow && (
                            <div className="mb-1 text-[10px] uppercase tracking-[0.22em] text-emerald-100/62">
                                {eyebrow}
                            </div>
                        )}
                        <h2 className="text-base font-semibold uppercase tracking-[0.14em] text-[#fff7df]">
                            {title}
                        </h2>
                    </div>
                    <button
                        onClick={() => {
                            playClick();
                            onClose();
                        }}
                        className="shrink-0 border border-[#f2ead0]/16 bg-black/28 p-2 text-[#f7f1dc]/72 transition-colors hover:border-emerald-100/40 hover:text-[#fff7df]"
                        aria-label="Close panel"
                    >
                        <X size={15} />
                    </button>
                </div>
                <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 text-[#f7f1dc] custom-scrollbar sm:px-6 sm:py-5">
                    {children}
                </div>
            </div>
        </div>
    );
};
