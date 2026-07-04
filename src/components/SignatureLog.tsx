import React from 'react';
import { PenLine } from 'lucide-react';
import { useCoherence } from '../hooks/useCoherence';
import { getObserverSession } from '../lib/visitor';
import { getSignatureGapMarginalia } from '../lib/kaelMarginalia';
import { triggerRecoverySurge } from '../lib/recoverySurge';
import { useSound } from '../hooks/useSound';

// The Signature Log — a daily observation-log signing ritual clipped to the
// break-room corkboard. The last ~10 signal days render as ledger lines:
// signed days show a scrawled hand (a seeded SVG path so it reads as "your"
// signature); missed days stay honestly blank. Today's line offers a sign
// affordance; signing writes `sign:day:${day}` to recoveredItems and fires the
// recovery surge. The ledger never resets — gaps are melancholy, never scolding.
//
// Persistence rides the existing recoveredItems set; no new tracking surface.

const LEDGER_LENGTH = 10;
const signRecoveryId = (day: number): string => `sign:day:${day}`;

const hashSeed = (seed: string): number => {
    let hash = 2166136261;
    for (let i = 0; i < seed.length; i += 1) {
        hash ^= seed.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
};

// A small seeded PRNG so a given observer's scrawl is stable but distinct.
const makeRng = (seed: number) => {
    let state = seed || 1;
    return () => {
        state ^= state << 13;
        state ^= state >>> 17;
        state ^= state << 5;
        state >>>= 0;
        return state / 4294967295;
    };
};

/**
 * Build a seeded, looping signature path over a 200×40 box. Deterministic per
 * seed so the same observer always signs with the same hand.
 */
const buildScrawlPath = (seed: string): string => {
    const rng = makeRng(hashSeed(`scrawl:${seed}`));
    const strokes = 5 + Math.floor(rng() * 3);
    let x = 8;
    const baseY = 26;
    let d = `M ${x.toFixed(1)} ${(baseY + (rng() - 0.5) * 8).toFixed(1)}`;
    for (let i = 0; i < strokes; i += 1) {
        const dx = 20 + rng() * 34;
        const cx1 = x + dx * (0.3 + rng() * 0.2);
        const cx2 = x + dx * (0.6 + rng() * 0.2);
        x += dx;
        const cy1 = baseY - 14 + rng() * 28;
        const cy2 = baseY - 14 + rng() * 28;
        const y = baseY - 6 + rng() * 12;
        d += ` C ${cx1.toFixed(1)} ${cy1.toFixed(1)}, ${cx2.toFixed(1)} ${cy2.toFixed(1)}, ${Math.min(x, 192).toFixed(1)} ${y.toFixed(1)}`;
    }
    // A trailing flourish under the line.
    const fx = Math.min(x, 190);
    d += ` M ${(fx - 40).toFixed(1)} ${(baseY + 8).toFixed(1)} Q ${(fx - 20).toFixed(1)} ${(baseY + 14).toFixed(1)}, ${fx.toFixed(1)} ${(baseY + 6).toFixed(1)}`;
    return d;
};

interface ScrawlProps {
    seed: string;
    /** When true, the ink draws itself on (the signing animation). */
    animate: boolean;
}

const Scrawl: React.FC<ScrawlProps> = ({ seed, animate }) => {
    const d = React.useMemo(() => buildScrawlPath(seed), [seed]);
    const reducedMotion = typeof window !== 'undefined'
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const draw = animate && !reducedMotion;

    return (
        <svg viewBox="0 0 200 40" className="h-6 w-auto max-w-[180px] overflow-visible" aria-hidden="true">
            <path
                d={d}
                fill="none"
                stroke="rgba(167,243,208,0.82)"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={draw ? {
                    strokeDasharray: 640,
                    strokeDashoffset: 640,
                    animation: 'signature-ink-on 900ms ease-out forwards',
                } : undefined}
            />
        </svg>
    );
};

export const SignatureLog: React.FC = () => {
    const { currentDay, recoveredItems, markRecovered } = useCoherence();
    const { playClick } = useSound();
    const seed = getObserverSession().visitorId;
    const [justSigned, setJustSigned] = React.useState(false);

    const todaySigned = recoveredItems.includes(signRecoveryId(currentDay));

    // The last N signal days, newest at the foot (today's line sits last, where
    // you'd add your name).
    const ledger = React.useMemo(() => {
        const start = Math.max(1, currentDay - LEDGER_LENGTH + 1);
        const rows: Array<{ day: number; signed: boolean }> = [];
        for (let d = start; d <= currentDay; d += 1) {
            rows.push({ day: d, signed: recoveredItems.includes(signRecoveryId(d)) });
        }
        return rows;
    }, [currentDay, recoveredItems]);

    // Days since the last signed day (before today). Drives Kael's gap line.
    // Large sentinel when nothing has ever been signed — reads as "quiet".
    const daysSinceLastSign = React.useMemo(() => {
        for (let d = currentDay - 1; d >= 1; d -= 1) {
            if (recoveredItems.includes(signRecoveryId(d))) return currentDay - d;
        }
        return todaySigned ? 0 : Math.min(currentDay, 6);
    }, [currentDay, recoveredItems, todaySigned]);

    const gapLine = React.useMemo(
        () => getSignatureGapMarginalia(todaySigned ? 0 : daysSinceLastSign, seed),
        [todaySigned, daysSinceLastSign, seed]
    );

    const handleSign = async () => {
        if (todaySigned) return;
        playClick();
        setJustSigned(true);
        await markRecovered(signRecoveryId(currentDay));
        triggerRecoverySurge();
    };

    return (
        <div className="space-y-4 text-sm text-[#d8d2bd]/74">
            <style>{`
                @keyframes signature-ink-on {
                    to { stroke-dashoffset: 0; }
                }
                @media (prefers-reduced-motion: reduce) {
                    .signature-line-in { animation: none !important; }
                }
            `}</style>

            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-emerald-100/58">
                <PenLine size={13} />
                Daily Observation Log
            </div>

            {/* The clipboard ledger. Ruled lines; signed days carry a hand, blanks
                stay blank. */}
            <div className="border border-[#f2ead0]/16 bg-[#11110e]/72 p-4">
                <div className="divide-y divide-[#f2ead0]/8">
                    {ledger.map((row, index) => {
                        const isToday = row.day === currentDay;
                        return (
                            <div
                                key={row.day}
                                className="signature-line-in room-modal-stagger flex items-center gap-3 py-2"
                                style={{ animationDelay: `${Math.min(index, 9) * 45}ms` }}
                            >
                                <span className="w-16 shrink-0 text-[10px] uppercase tracking-[0.16em] text-[#d8d2bd]/40">
                                    Day {String(row.day).padStart(3, '0')}
                                </span>
                                <span className="flex min-h-6 flex-1 items-center border-b border-dashed border-[#f2ead0]/12">
                                    {row.signed ? (
                                        <Scrawl seed={seed} animate={isToday && justSigned} />
                                    ) : isToday ? (
                                        <span className="text-[10px] uppercase tracking-[0.18em] text-emerald-100/45">
                                            awaiting signature
                                        </span>
                                    ) : (
                                        <span className="sr-only">unsigned</span>
                                    )}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            <button
                type="button"
                onClick={handleSign}
                disabled={todaySigned}
                className="flex w-full items-center justify-center gap-2 border border-emerald-100/35 bg-emerald-100/14 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-50 transition-colors hover:bg-emerald-100/24 disabled:cursor-not-allowed disabled:border-[#f2ead0]/12 disabled:bg-black/28 disabled:text-[#d8d2bd]/42"
            >
                <PenLine size={14} />
                {todaySigned ? 'Signed for today' : 'Sign the log'}
            </button>

            {/* Kael's gap-aware note. Not RoomModal's footer marginalia — this one
                belongs to the ledger itself, bending to how long it's been. */}
            <p className="border-l border-emerald-100/25 pl-3 font-['EB_Garamond'] text-[12px] italic leading-snug text-[#d1d1c7]/68">
                {gapLine}
            </p>
        </div>
    );
};
