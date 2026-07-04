import React from 'react';
import { Ear, Radio } from 'lucide-react';
import { TypeOn } from './ui/TypeOn';
import { soundEngine } from '../lib/SoundEngine';
import { triggerRecoverySurge } from '../lib/recoverySurge';
import {
    buildHeartbeatSchedule,
    heartbeatDashes,
    checkSectorName,
    getSectorRejection,
    SECTOR03_NAMED_ID,
    SECTOR03_REVEAL,
    HEARTBEAT_PULSES,
} from '../lib/sectorTriangulation';

interface DeadZoneListeningPanelProps {
    /** Full recovery set — gates the capstone reveal + swapped marginalia. */
    recoveredItems: string[];
    /** Files lore:sector03_named on a correct designation. */
    markRecovered: (id: string) => void;
    /** Stable per-observer seed for rejection-line selection. */
    seed: string;
}

const prefersReducedMotion = (): boolean =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const COOLDOWN_MS = 3000;

/**
 * The Sector 03 listening post + naming capstone, mounted inside the
 * cart-dead-zones modal. Two affordances, both pure bonus, neither blocking:
 *
 *  1. "Put an ear to Sector 03" plays the void's sub-bass pulse loop through the
 *     SoundEngine — the WLW callsign in Morse. A dim ring swells long/short in
 *     sync (reduced-motion: the ring is static). After a full listen, the
 *     printed long/short dashes are revealed so the cipher is solvable without
 *     sound or motion. Repeatable at will with a ~3s cooldown.
 *
 *  2. "DESIGNATE SECTOR 03" — the one input the void won't swallow is her name.
 *     WILLOW (or WLW) is accepted; wrong entries get a quiet mini-swallow feel
 *     and a seeded in-character rejection. On success: a recovery surge, the
 *     lore:sector03_named recovery, and the Kael reveal log.
 */
export const DeadZoneListeningPanel: React.FC<DeadZoneListeningPanelProps> = ({
    recoveredItems,
    markRecovered,
    seed,
}) => {
    const named = recoveredItems.includes(SECTOR03_NAMED_ID);
    const [reducedMotion] = React.useState(prefersReducedMotion);
    const { windows, loopMs } = React.useMemo(() => buildHeartbeatSchedule(), []);

    // Listening state. `listening` drives the ring animation; `heardOnce` unlocks
    // the printed dashes (immediately under reduced motion, since there's no
    // animated channel to read). `cooling` gates the ~3s cooldown.
    const [listening, setListening] = React.useState(false);
    const [heardOnce, setHeardOnce] = React.useState(reducedMotion);
    const [cooling, setCooling] = React.useState(false);
    const [activePulse, setActivePulse] = React.useState(false);
    const timersRef = React.useRef<number[]>([]);
    const stopAudioRef = React.useRef<(() => void) | null>(null);

    const clearTimers = React.useCallback(() => {
        for (const t of timersRef.current) window.clearTimeout(t);
        timersRef.current = [];
    }, []);

    // Unmount: kill the visual timers AND the audio loop — closing the modal
    // mid-listen must not leave the void thumping over the room.
    React.useEffect(() => () => {
        clearTimers();
        stopAudioRef.current?.();
        stopAudioRef.current = null;
    }, [clearTimers]);

    const listen = React.useCallback(() => {
        if (listening || cooling) return;
        setListening(true);
        setCooling(true);

        // Audio: hand the ON-window schedule (seconds) to the sub-bass driver.
        // The returned stop handle lets unmount cut the loop short.
        try {
            stopAudioRef.current = soundEngine.playVoidPattern(
                windows.map((w) => ({ at: w.at / 1000, dur: w.dur / 1000 }))
            ) ?? null;
        } catch { /* audio may be locked; the visual + dashes still carry it */ }

        // Visual sync: swell the ring for each ON window (skipped under reduced
        // motion — the ring stays static and the dashes are already shown).
        if (!reducedMotion) {
            for (const w of windows) {
                timersRef.current.push(window.setTimeout(() => setActivePulse(true), w.at));
                timersRef.current.push(window.setTimeout(() => setActivePulse(false), w.at + w.dur));
            }
        }

        // At loop end: reveal the printed dashes, stop the ring.
        timersRef.current.push(window.setTimeout(() => {
            setListening(false);
            setActivePulse(false);
            setHeardOnce(true);
        }, loopMs));

        // Cooldown releases a little after the loop so a second play can't stack.
        timersRef.current.push(window.setTimeout(() => setCooling(false), loopMs + COOLDOWN_MS));
    }, [listening, cooling, windows, loopMs, reducedMotion]);

    // ── Naming capstone ─────────────────────────────────────────────────────
    const [designation, setDesignation] = React.useState('');
    const [rejection, setRejection] = React.useState<string | null>(null);
    const [swallowing, setSwallowing] = React.useState(false);

    const submitName = React.useCallback((raw: string) => {
        if (named) return true;
        if (checkSectorName(raw)) {
            setRejection(null);
            markRecovered(SECTOR03_NAMED_ID);
            triggerRecoverySurge();
            return true;
        }
        // Quiet mini-swallow: a brief dim/settle, no full room takeover.
        setRejection(getSectorRejection(seed + raw.trim().toUpperCase()));
        if (!reducedMotion) {
            setSwallowing(true);
            window.setTimeout(() => setSwallowing(false), 550);
        }
        return false;
    }, [named, markRecovered, seed, reducedMotion]);

    const onSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        submitName(designation);
    };

    // ── Dev hook: __sector.solve() / .pattern() ─────────────────────────────
    // DEV-only (like __storm / __almost / __night) — solve() in a production
    // console would spoil the season capstone. Ref-guarded so StrictMode's
    // double-mount installs it exactly once.
    const devHookRef = React.useRef(false);
    React.useEffect(() => {
        if (!import.meta.env.DEV || typeof window === 'undefined') return;
        if (devHookRef.current) return;
        devHookRef.current = true;
        (window as unknown as { __sector?: unknown }).__sector = {
            solve: (name = 'WILLOW') => {
                setDesignation(name);
                const ok = submitName(name);
                return ok ? 'Sector 03 named.' : `Rejected: ${name}`;
            },
            pattern: () => {
                const morse = heartbeatDashes();
                console.log('[__sector] WLW Morse:', morse, '| pulses:', HEARTBEAT_PULSES.join(' '));
                return morse;
            },
            state: () => ({ named, heardOnce, listening, cooling }),
        };
        return () => {
            try { delete (window as unknown as { __sector?: unknown }).__sector; } catch { /* noop */ }
            devHookRef.current = false;
        };
    }, [submitName, named, heardOnce, listening, cooling]);

    return (
        <div className="w-full space-y-5">
            {/* Listening post */}
            <div
                className={`border border-red-500/25 bg-black/55 p-4 rounded transition-[filter,opacity] duration-500 ${swallowing ? 'opacity-40 brightness-50' : ''}`}
            >
                <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-red-300/55">
                    <span>Listening Post — Sector 03</span>
                    {heardOnce && <span className="text-red-300/40">callsign captured</span>}
                </div>

                <div className="mt-4 flex items-center gap-4">
                    <div className="relative flex h-20 w-20 shrink-0 items-center justify-center">
                        {/* The dim ring: swells on each ON window. Reduced-motion keeps
                            it static; the dashes below carry the cipher instead. */}
                        <span
                            className="absolute inset-0 rounded-full border border-red-500/40"
                            style={{
                                transform: reducedMotion ? 'scale(1)' : activePulse ? 'scale(1.18)' : 'scale(0.72)',
                                opacity: reducedMotion ? 0.45 : activePulse ? 0.85 : 0.25,
                                transition: 'transform 120ms ease-out, opacity 120ms ease-out',
                                boxShadow: activePulse ? '0 0 18px rgba(239,68,68,0.4)' : 'none',
                            }}
                        />
                        <span className="absolute h-2.5 w-2.5 rounded-full bg-red-500/70" />
                    </div>

                    <div className="flex-1">
                        <button
                            type="button"
                            onClick={listen}
                            disabled={listening || cooling}
                            className="border border-red-500/30 bg-red-950/20 px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-red-300 transition-colors hover:border-red-400/60 hover:bg-red-950/40 disabled:cursor-default disabled:opacity-40"
                        >
                            <Ear size={13} className="mr-1.5 inline" />
                            {listening ? 'Listening…' : cooling ? 'The pulse fades…' : 'Put an ear to Sector 03'}
                        </button>
                        <p className="mt-2 font-['EB_Garamond'] text-[11px] italic leading-snug text-red-200/45">
                            Something down there is still keeping time.
                        </p>
                    </div>
                </div>

                {/* Printed long/short — the accessibility-honest concession. Shown
                    only after a full listen (or immediately under reduced motion).
                    No label calls it Morse; the reading is the whole puzzle. */}
                {heardOnce && (
                    <div className="mt-4 border-t border-red-500/15 pt-3">
                        <div className="text-[9px] uppercase tracking-[0.2em] text-red-300/40">Pulse transcript</div>
                        <div className="mt-1.5 font-mono text-lg tracking-[0.15em] text-red-200/75 select-text">
                            {heartbeatDashes()}
                        </div>
                    </div>
                )}
            </div>

            {/* Naming capstone */}
            <div className="border-t border-[#f2ead0]/12 pt-5">
                {named ? (
                    <div className="border border-emerald-100/25 bg-[#11110e]/72 p-4">
                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-emerald-100/58">
                            <Radio size={13} />
                            {SECTOR03_REVEAL.title}
                        </div>
                        <p className="mt-3 whitespace-pre-wrap font-['EB_Garamond'] text-sm italic leading-relaxed text-[#f2ead0]/85">
                            <TypeOn text={SECTOR03_REVEAL.body} speed={9} startDelay={200} showCursor={false} />
                        </p>
                    </div>
                ) : (
                    <form onSubmit={onSubmit} className="space-y-2">
                        <label
                            className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[#f7f1dc]/50"
                            htmlFor="sector-designation"
                        >
                            <Radio size={13} className="text-emerald-100/60" />
                            Designate Sector 03
                        </label>
                        <div className="flex gap-2">
                            <input
                                id="sector-designation"
                                type="text"
                                value={designation}
                                onChange={(e) => { setDesignation(e.target.value); setRejection(null); }}
                                autoComplete="off"
                                autoCapitalize="characters"
                                spellCheck={false}
                                placeholder="give the void a name…"
                                className="min-w-0 flex-1 border border-[#f2ead0]/16 bg-black/28 px-3 py-2 font-mono text-sm uppercase tracking-[0.16em] text-[#fff7df] placeholder:text-[#f7f1dc]/28 outline-none transition-colors focus:border-emerald-100/40"
                            />
                            <button
                                type="submit"
                                className="shrink-0 border border-emerald-100/30 bg-emerald-100/12 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-50 transition-colors hover:bg-emerald-100/22"
                            >
                                Designate
                            </button>
                        </div>
                        {rejection && (
                            <p className="font-['EB_Garamond'] text-[12px] italic leading-snug text-[#d1d1c7]/62">
                                {rejection}
                            </p>
                        )}
                    </form>
                )}
            </div>
        </div>
    );
};
