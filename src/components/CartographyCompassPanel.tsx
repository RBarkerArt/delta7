import React, { useEffect, useRef, useState } from 'react';
import { TypeOn } from './ui/TypeOn';
import {
    formatCell,
    relayCellFor,
    settledBearingFor,
    SECTOR03_NAMED_ID,
} from '../lib/sectorTriangulation';

interface CartographyCompassPanelProps {
    visitorId: string | null;
    currentDay: number;
    readout: string;
    /** Full recovery set — the compass hint line changes once Sector 03 is named. */
    recoveredItems: string[];
}

type CompassPhase = 'calibrating' | 'settling' | 'locked' | 'sweeping';

const hashSeed = (value: string): number => {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
        hash = (hash << 5) - hash + value.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
};

const STATUS_LABEL: Record<CompassPhase, string> = {
    calibrating: 'CALIBRATING...',
    settling: 'ACQUIRING LOCK',
    locked: 'LOCK ACTIVE',
    sweeping: 'SIGNAL LOST',
};

const STATUS_TONE: Record<CompassPhase, string> = {
    calibrating: 'text-amber-400 animate-pulse',
    settling: 'text-amber-300',
    locked: 'text-emerald-400',
    sweeping: 'text-red-400 animate-pulse',
};

/**
 * A spring-damped compass that behaves like a real magnetized instrument —
 * and is confidently wrong. The needle settles to a per-observer daily
 * bearing, twitches at random, periodically loses the signal and sweeps a
 * full revolution, and drifts back to its lie after the bezel is dragged.
 */
export const CartographyCompassPanel: React.FC<CartographyCompassPanelProps> = ({
    visitorId,
    currentDay,
    readout,
    recoveredItems,
}) => {
    const seed = hashSeed(`${visitorId || 'anon'}-${currentDay}`);
    // The needle no longer settles on hash noise. Its bearing is the true
    // compass heading from this observer's relay cell to Sector 03, plus a small
    // seeded per-day wobble — a confidently-wrong instrument whose lie secretly
    // agrees with every other observer's. The panel never announces this.
    const relayCell = React.useMemo(() => relayCellFor(visitorId), [visitorId]);
    const relayLabel = formatCell(relayCell);
    const dailyAngle = React.useMemo(
        () => settledBearingFor(visitorId, currentDay),
        [visitorId, currentDay]
    );
    const sectorNamed = recoveredItems.includes(SECTOR03_NAMED_ID);

    const [reducedMotion] = useState(
        () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
    const initialPhase: CompassPhase = reducedMotion ? 'locked' : 'calibrating';
    const [phase, setPhase] = useState<CompassPhase>(initialPhase);
    const phaseRef = useRef<CompassPhase>(initialPhase);
    const needleRef = useRef<SVGGElement>(null);
    const bezelRef = useRef<SVGGElement>(null);
    const voidMarkRef = useRef<SVGTextElement>(null);

    const angle = useRef(reducedMotion ? dailyAngle : 0);
    const velocity = useRef(0);
    const target = useRef(dailyAngle);
    const bezelAngle = useRef(0);
    const dragState = useRef<{ pointerId: number; lastPointerAngle: number } | null>(null);

    const setPhaseBoth = (next: CompassPhase) => {
        phaseRef.current = next;
        setPhase(next);
    };

    useEffect(() => {
        const startedAt = performance.now();

        if (reducedMotion) {
            // Static instrument: paint the daily bearing once, no physics loop.
            if (needleRef.current) {
                needleRef.current.style.transform = `rotate(${dailyAngle}deg)`;
            }
            return undefined;
        }

        const calibrateMs = 1200 + ((seed % 1000) / 1000) * 1800;
        velocity.current = 1400 + (seed % 400);

        let nextTwitchAt = startedAt + calibrateMs + 2500 + Math.random() * 3500;
        let nextSweepAt = startedAt + calibrateMs + 20000 + Math.random() * 20000;
        let lastFrame = startedAt;
        let frame: number;

        const step = (now: number) => {
            const dt = Math.min(0.05, (now - lastFrame) / 1000);
            lastFrame = now;
            const currentPhase = phaseRef.current;

            if (currentPhase === 'calibrating') {
                // Wild spin that loses energy as calibration "completes".
                const progress = Math.min(1, (now - startedAt) / calibrateMs);
                velocity.current = (1400 + (seed % 400)) * (1 - progress * 0.65) + (Math.random() - 0.5) * 300;
                angle.current += velocity.current * dt;
                if (progress >= 1) {
                    // Hand off to the spring near the current heading.
                    target.current = angle.current + (((dailyAngle - angle.current) % 360) + 540) % 360 - 180 + 360;
                    setPhaseBoth('settling');
                }
            } else {
                // Spring-damper toward the (wrong) daily bearing.
                const stiffness = currentPhase === 'settling' ? 26 : currentPhase === 'sweeping' ? 14 : 18;
                const damping = currentPhase === 'settling' ? 3.6 : 5.2;
                const displacement = target.current - angle.current;
                velocity.current += (displacement * stiffness - velocity.current * damping) * dt;
                angle.current += velocity.current * dt;

                if (currentPhase === 'settling' && Math.abs(displacement) < 1.5 && Math.abs(velocity.current) < 8) {
                    setPhaseBoth('locked');
                }

                if (currentPhase === 'sweeping' && Math.abs(displacement) < 2 && Math.abs(velocity.current) < 10) {
                    setPhaseBoth('locked');
                }

                if (currentPhase === 'locked') {
                    // Micro-tremor: a real needle is never perfectly still.
                    velocity.current += (Math.random() - 0.5) * 14;

                    if (now >= nextTwitchAt) {
                        velocity.current += (Math.random() - 0.5) * 160;
                        nextTwitchAt = now + 2500 + Math.random() * 4000;
                    }

                    if (now >= nextSweepAt && !dragState.current) {
                        // The signal "drops" and the needle hunts a full revolution.
                        target.current += 360 * (Math.random() >= 0.5 ? 1 : -1);
                        nextSweepAt = now + 20000 + Math.random() * 20000;
                        setPhaseBoth('sweeping');
                    }
                }
            }

            if (needleRef.current) {
                needleRef.current.style.transform = `rotate(${angle.current}deg)`;
            }
            if (bezelRef.current) {
                bezelRef.current.style.transform = `rotate(${bezelAngle.current}deg)`;
            }
            if (voidMarkRef.current) {
                // The Ø glyph wakes up when the needle points anywhere near west.
                const heading = ((angle.current % 360) + 360) % 360;
                const nearVoid = heading > 240 && heading < 300;
                voidMarkRef.current.style.opacity = nearVoid
                    ? String(0.55 + Math.random() * 0.45)
                    : '0.3';
            }

            frame = requestAnimationFrame(step);
        };

        // External force: the dead-zone swallow dispatches `delta7:compass-sweep`
        // to make the needle lose the signal and hunt a full revolution, using
        // the same machinery as the scheduled random sweep above.
        const forceSweep = () => {
            if (reducedMotion || phaseRef.current === 'calibrating' || dragState.current) return;
            target.current += 360 * (Math.random() >= 0.5 ? 1 : -1);
            setPhaseBoth('sweeping');
        };
        window.addEventListener('delta7:compass-sweep', forceSweep);

        frame = requestAnimationFrame(step);
        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener('delta7:compass-sweep', forceSweep);
        };
    }, [dailyAngle, seed, reducedMotion]);

    const pointerAngleFrom = (event: React.PointerEvent<SVGSVGElement>): number => {
        const rect = event.currentTarget.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        return (Math.atan2(event.clientY - cy, event.clientX - cx) * 180) / Math.PI;
    };

    const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
        if (phaseRef.current === 'calibrating') return;
        event.currentTarget.setPointerCapture(event.pointerId);
        dragState.current = { pointerId: event.pointerId, lastPointerAngle: pointerAngleFrom(event) };
    };

    const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
        const drag = dragState.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        const pointerAngle = pointerAngleFrom(event);
        let delta = pointerAngle - drag.lastPointerAngle;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        drag.lastPointerAngle = pointerAngle;

        // Rotating the housing should not move a real needle — but turning the
        // case disturbs this one, and it always creeps back to its wrong bearing.
        bezelAngle.current += delta;
        velocity.current += delta * 6;
    };

    const handlePointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
        if (dragState.current?.pointerId === event.pointerId) {
            dragState.current = null;
        }
    };

    const isCalibrating = phase === 'calibrating';

    return (
        <div className="flex flex-col items-center justify-center p-4 space-y-6">
            <div className="relative w-52 h-52 flex items-center justify-center border border-emerald-500/25 rounded-full bg-black/50 p-2 shadow-[0_0_20px_rgba(16,185,129,0.05)]">
                <svg
                    viewBox="0 0 200 200"
                    className="w-full h-full text-emerald-500 select-none touch-none cursor-grab active:cursor-grabbing"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                >
                    <circle cx="100" cy="100" r="92" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 4" className="opacity-30" />
                    <circle cx="100" cy="100" r="86" fill="none" stroke="currentColor" strokeWidth="1" className="opacity-60" />
                    <circle cx="100" cy="100" r="70" fill="none" stroke="currentColor" strokeWidth="0.5" className="opacity-20" />

                    {/* Rotatable bezel: tick ring + cardinal labels */}
                    <g ref={bezelRef} style={{ transformOrigin: '100px 100px', transformBox: 'view-box' }}>
                        <circle cx="100" cy="100" r="82" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="1 8" className="opacity-80" />
                        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
                            <line
                                key={deg}
                                x1="100"
                                y1="14"
                                x2="100"
                                y2="20"
                                stroke="currentColor"
                                strokeWidth={deg % 90 === 0 ? '1.5' : '0.5'}
                                className="opacity-70"
                                transform={`rotate(${deg} 100 100)`}
                            />
                        ))}
                        <text x="100" y="32" textAnchor="middle" className="font-mono text-xs font-bold fill-current">N</text>
                        <text x="168" y="104" textAnchor="middle" className="font-mono text-xs font-bold fill-current">E</text>
                        <text x="100" y="176" textAnchor="middle" className="font-mono text-xs font-bold fill-current">S</text>
                        <text ref={voidMarkRef} x="32" y="104" textAnchor="middle" className="font-mono text-xs font-bold fill-red-500" style={{ opacity: 0.3 }}>Ø</text>
                    </g>

                    <line x1="100" y1="20" x2="100" y2="180" stroke="currentColor" strokeWidth="0.5" strokeDasharray="1 8" className="opacity-30" />
                    <line x1="20" y1="100" x2="180" y2="100" stroke="currentColor" strokeWidth="0.5" strokeDasharray="1 8" className="opacity-30" />

                    <g ref={needleRef} style={{ transformOrigin: '100px 100px', transformBox: 'view-box' }}>
                        <g transform="translate(100, 100)">
                            <path d="M 0 0 L -8 -20 L 0 -72 L 8 -20 Z" fill="currentColor" className="opacity-90" stroke="currentColor" strokeWidth="1" />
                            <path d="M 0 0 L -8 20 L 0 72 L 8 20 Z" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-50" />
                            <circle cx="0" cy="0" r="7" fill="#0c0a09" stroke="currentColor" strokeWidth="1.5" />
                            <circle cx="0" cy="0" r="2" fill="currentColor" />
                        </g>
                    </g>
                </svg>

                {isCalibrating && (
                    <div className="absolute top-[48%] left-4 right-4 h-[1px] bg-emerald-400/80 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
                )}
                <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none bg-scanlines opacity-[0.08]" />
            </div>

            <div className="w-full border border-emerald-500/25 bg-black/50 p-4 rounded font-mono text-xs space-y-3">
                <div className="flex justify-between items-center text-[9px] text-emerald-100/50 uppercase tracking-widest border-b border-emerald-500/10 pb-1.5">
                    <span>TELESCOPIC AZIMUTH DEVIATION</span>
                    <span className={STATUS_TONE[phase]}>{STATUS_LABEL[phase]}</span>
                </div>
                {/* Relay readout — where this observer's ray starts. Quiet, presented
                    as an instrument fact, never flagged as load-bearing. */}
                <div className="flex justify-between items-center text-[9px] uppercase tracking-[0.18em] text-emerald-100/45">
                    <span>RELAY POSITION</span>
                    <span className="text-emerald-300/80 tracking-[0.22em]">{relayLabel}</span>
                </div>
                <p className="text-emerald-100/80 leading-relaxed select-text min-h-[40px]">
                    {isCalibrating ? (
                        <span className="opacity-60 italic">Reading magnetospheric telemetry vectors...</span>
                    ) : (
                        <TypeOn text={readout} speed={14} />
                    )}
                </p>
                <div className="text-[8px] uppercase tracking-[0.2em] text-emerald-100/35">
                    Rotate housing to verify bearing — readings non-binding
                </div>
                {/* A deniable, pointed marginalia-adjacent line. Before the naming
                    it hints the needle isn't random; after, it admits it never lied. */}
                <p className="border-t border-emerald-500/10 pt-2 font-['EB_Garamond'] text-[11px] italic leading-snug text-emerald-100/45 select-text">
                    {sectorNamed
                        ? 'The needle was never lying. It pointed at her the whole time, from wherever you stood.'
                        : 'Every relay lies from where it stands. Mine included. Ask them all the same question and see where the lies cross.'}
                </p>
            </div>
        </div>
    );
};
