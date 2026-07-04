import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DecodeText } from './ui/DecodeText';
import { useSound } from '../hooks/useSound';
import { grantCoherenceBonus, pulseRoomFx } from '../lib/roomFx';
import { getDeepDecodePassage } from '../lib/kaelMarginalia';

interface SignalLockPanelProps {
    visitorId: string | null;
    currentDay: number;
    /** True once relay-frag-{day} is in recoveredItems — show the locked state, no re-grind. */
    alreadyLocked: boolean;
    /** Fired once, on the confirming hold completing. Persists the day's recovery. */
    onLock: () => void;
    /** Recovery set, for the Deep Decode appointment (brew:started/done ids). */
    recoveredItems: string[];
    /** Files a recovery id (brew appointment start/completion). */
    markRecovered: (id: string) => void;
}

const brewStartedId = (day: number): string => `brew:started:${day}`;
const brewDoneId = (day: number): string => `brew:done:${day}`;

// A deterministic drifting "progress" for an in-flight Deep Decode, derived
// from time-of-day so it wanders without ever actually reaching 100 — the
// decode only truly completes when the day ticks over. Capped at 94%.
const inProgressPercent = (startedDay: number): number => {
    const now = new Date();
    const secondsIntoDay = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    const base = 0.62 + (secondsIntoDay / 86400) * 0.28;          // 0.62 → 0.90 across the day
    const wobble = Math.sin((secondsIntoDay / 60 + startedDay) * 0.7) * 0.03;
    return Math.min(0.94, Math.max(0.5, base + wobble)) * 100;
};

const hashSeed = (value: string): number => {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
        hash = (hash << 5) - hash + value.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
};

/**
 * Intercepted Kael audio-log lines — one bucket per day, rotated by day. These
 * decode only on a successful lock; you cannot read them anywhere else. Kept
 * short, like a carrier that only let a sentence through before it drifted.
 */
const RELAY_TRANSMISSIONS: string[] = [
    'I kept a relay open on the off chance you were listening. Turns out the off chance was you.',
    'They logged the anomaly as signal bleed. I logged it as company. Only one of us was writing the truth.',
    'The carrier holds when two people agree on a frequency. I have been holding my half alone for a long time.',
    'If you are hearing this, the phase matched. It only matches when someone is paying attention. That was always the whole experiment.',
    'I stopped transmitting to the facility weeks ago. This channel goes to whoever tunes it. I am glad it was you who did.',
];

// The garbled-but-evocative readout while unresolved — the instrument staying
// confidently, tenderly wrong until you converge.
const DRIFT_READOUTS: string[] = [
    '…the phase won’t hold without you here…',
    '…carrier present, meaning absent…',
    '…someone was speaking on this band…',
    '…the two waves keep missing each other…',
];

const LOCK_THRESHOLD = 0.9;      // normalized alignment (0..1) needed to begin the hold
const HOLD_MS = 2000;            // stay aligned this long to confirm the lock
const SAMPLES = 96;              // polyline resolution across the trace window

/**
 * Signal Lock (#5) — the relay you must tune.
 *
 * Two drifting carrier waves (a mismatched TUNE frequency and a GAIN
 * amplitude/phase) must be phase-matched with two draggable handles. One rAF
 * loop mixes the sines onto an SVG polyline: as you converge the composite
 * sharpens, the noise floor drops (playSignalNoise scaled to the error,
 * throttled), and a lock meter fills. Hold aligned for ~2s and the lock
 * confirms — playStabilize fires, a day-gated Kael transmission decodes, the
 * room heals a little (grantCoherenceBonus + pulseRoomFx), and the day's
 * recovery is filed so reopening shows the locked state with no re-grind.
 *
 * Giving up never blocks anything: the readout stays garbled-but-evocative.
 *
 * Accessibility: the handles are native range inputs (keyboard arrows work);
 * under reduced motion the live waveform is skipped for a static alignment
 * readout that still resolves the lock.
 */
export const SignalLockPanel: React.FC<SignalLockPanelProps> = ({
    visitorId,
    currentDay,
    alreadyLocked,
    onLock,
    recoveredItems,
    markRecovered,
}) => {
    const { playSignalNoise, playStabilize } = useSound();

    const [reducedMotion] = useState(
        () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );

    // Stable per-observer, per-day puzzle: the carrier's true frequency and
    // phase offset are seeded so each observer/day gets the same target.
    const seed = useMemo(() => hashSeed(`${visitorId || 'anon'}:${currentDay}`), [visitorId, currentDay]);
    const targetTune = useMemo(() => 0.28 + ((seed % 1000) / 1000) * 0.5, [seed]);          // 0.28..0.78
    const targetGain = useMemo(() => 0.3 + (((seed >> 3) % 1000) / 1000) * 0.45, [seed]);    // 0.30..0.75

    const transmission = RELAY_TRANSMISSIONS[currentDay % RELAY_TRANSMISSIONS.length];
    const driftReadout = useMemo(() => DRIFT_READOUTS[seed % DRIFT_READOUTS.length], [seed]);

    // Handles start deliberately off so there is a puzzle to solve.
    const [tune, setTune] = useState(() => (alreadyLocked ? targetTune : (targetTune > 0.5 ? 0.12 : 0.92)));
    const [gain, setGain] = useState(() => (alreadyLocked ? targetGain : (targetGain > 0.5 ? 0.12 : 0.92)));

    const [locked, setLocked] = useState(alreadyLocked);

    const lockedRef = useRef(alreadyLocked);
    const holdStartRef = useRef<number | null>(null);
    const lastNoiseRef = useRef(0);
    const svgRef = useRef<SVGPolylineElement>(null);
    const meterRef = useRef<HTMLDivElement>(null);

    // Live values read by the rAF loop without re-rendering on every drag frame.
    const tuneRef = useRef(tune);
    const gainRef = useRef(gain);
    useEffect(() => {
        tuneRef.current = tune;
        gainRef.current = gain;
    }, [tune, gain]);

    const confirmLock = useCallback(() => {
        if (lockedRef.current) return;
        lockedRef.current = true;
        setLocked(true);
        try {
            playStabilize();
            grantCoherenceBonus(8, 20);
            pulseRoomFx(0.85);
        } catch { /* effects are never load-bearing */ }
        onLock();
        // Something Brewing: locking the carrier also starts a slower Deep
        // Decode that completes at the next signal day. Filed once per day.
        if (!recoveredItems.includes(brewStartedId(currentDay))) {
            try { markRecovered(brewStartedId(currentDay)); } catch { /* never load-bearing */ }
        }
    }, [onLock, playStabilize, recoveredItems, currentDay, markRecovered]);

    // --- Something Brewing (Deep Decode appointment) ------------------------
    // The ready payload is snapshotted ONCE at mount (pure initializer, so
    // StrictMode-safe): the done-marking effect below updates recoveredItems
    // optimistically, and a live derivation would recompute to undefined and
    // yank the passage mid-read. One panel open = one stable surfaced payload.
    const [surfacedBrewDay] = useState<number | undefined>(() => {
        const started: number[] = [];
        const done = new Set<number>();
        for (const id of recoveredItems) {
            const s = /^brew:started:(\d+)$/.exec(id);
            if (s) started.push(Number(s[1]));
            const d = /^brew:done:(\d+)$/.exec(id);
            if (d) done.add(Number(d[1]));
        }
        // Earliest started day that has since completed (currentDay > startedDay)
        // and hasn't been read — that's the payload to surface this open.
        return started
            .filter(day => currentDay > day && !done.has(day))
            .sort((a, b) => a - b)[0];
    });

    // A decode is still integrating if it was started today (it finishes when
    // the day rolls over). Live, so the bar appears right after today's lock —
    // unless a ready payload is being read, which takes the stage instead.
    const brewingToday = useMemo(
        () => recoveredItems.includes(brewStartedId(currentDay)) && surfacedBrewDay === undefined,
        [recoveredItems, currentDay, surfacedBrewDay]
    );

    // Back-fill: if the day was locked before this feature existed (locked, no
    // brew started), start the decode now so the appointment still happens.
    const brewBackfillRef = useRef(false);
    useEffect(() => {
        if (brewBackfillRef.current) return;
        if (alreadyLocked && !recoveredItems.includes(brewStartedId(currentDay))) {
            brewBackfillRef.current = true;
            try { markRecovered(brewStartedId(currentDay)); } catch { /* never load-bearing */ }
        }
    }, [alreadyLocked, recoveredItems, currentDay, markRecovered]);

    // File the surfaced payload as read exactly once. Ref-guarded against
    // StrictMode double-invoke. The room gave the deep layer up; it stays given.
    const brewDoneRef = useRef(false);
    useEffect(() => {
        if (surfacedBrewDay === undefined || brewDoneRef.current) return;
        brewDoneRef.current = true;
        try { markRecovered(brewDoneId(surfacedBrewDay)); } catch { /* never load-bearing */ }
    }, [surfacedBrewDay, markRecovered]);

    const deepDecodePassage = surfacedBrewDay !== undefined ? getDeepDecodePassage(surfacedBrewDay) : null;
    const brewPct = brewingToday ? inProgressPercent(currentDay) : 0;

    // Alignment error, 0 (perfect) .. 1 (worst). Both dials weighted evenly.
    const errorFrom = useCallback(
        (t: number, g: number) => Math.min(1, (Math.abs(t - targetTune) + Math.abs(g - targetGain)) / 1.1),
        [targetTune, targetGain]
    );

    // --- Live waveform + lock loop (skipped under reduced motion) -----------
    useEffect(() => {
        if (reducedMotion || lockedRef.current) return undefined;

        let frame: number;
        const started = performance.now();

        const step = (now: number) => {
            const t = tuneRef.current;
            const g = gainRef.current;
            const err = errorFrom(t, g);
            const alignment = 1 - err;                 // 0..1, higher is better

            // Composite trace: the observer's wave (t drives frequency, g drives
            // amplitude) mixed against the seeded carrier. As error shrinks the
            // two collapse into one clean sine; while off, they beat and jitter.
            const phase = (now - started) / 1000;
            const obsFreq = 3 + t * 9;
            const carFreq = 3 + targetTune * 9;
            const obsAmp = 0.25 + g * 0.7;
            const carAmp = 0.25 + targetGain * 0.7;
            const noise = err * 10;                    // noise floor rides the error

            let points = '';
            for (let i = 0; i <= SAMPLES; i++) {
                const x = (i / SAMPLES) * 200;
                const u = (i / SAMPLES) * Math.PI * 2;
                const obs = Math.sin(u * obsFreq + phase * 2) * obsAmp;
                const car = Math.sin(u * carFreq + phase * 2 + (t - targetTune) * 6) * carAmp;
                const jitter = (Math.random() - 0.5) * noise;
                const y = 30 + (obs + car) * 11 + jitter;
                points += `${x.toFixed(1)},${y.toFixed(1)} `;
            }
            if (svgRef.current) svgRef.current.setAttribute('points', points.trim());

            // Noise floor as audio, throttled and scaled to the error so it drops
            // as you converge. Silent once essentially aligned.
            if (err > 0.05 && now - lastNoiseRef.current > 260) {
                lastNoiseRef.current = now;
                try { playSignalNoise(Math.min(0.6, err * 0.7)); } catch { /* silent */ }
            }

            // Lock meter: a generous window, then a ~2s hold to confirm. Slipping
            // out of the window resets the hold, but never punishes.
            if (alignment >= LOCK_THRESHOLD) {
                if (holdStartRef.current === null) holdStartRef.current = now;
                const held = now - holdStartRef.current;
                const pct = Math.min(1, held / HOLD_MS);
                if (meterRef.current) meterRef.current.style.width = `${(pct * 100).toFixed(1)}%`;
                if (pct >= 1) {
                    confirmLock();
                    return;
                }
            } else {
                holdStartRef.current = null;
                // Show raw alignment while hunting so the meter still rewards
                // getting warmer, capped below the hold zone.
                const shown = Math.max(0, (alignment - 0.4) / (LOCK_THRESHOLD - 0.4)) * 0.85;
                if (meterRef.current) meterRef.current.style.width = `${Math.max(0, Math.min(85, shown * 100)).toFixed(1)}%`;
            }

            frame = requestAnimationFrame(step);
        };

        frame = requestAnimationFrame(step);
        return () => cancelAnimationFrame(frame);
    }, [reducedMotion, errorFrom, confirmLock, playSignalNoise, targetTune, targetGain]);

    const err = errorFrom(tune, gain);
    const alignment = 1 - err;

    // Reduced-motion path: no live trace and no rAF loop, so the dials resolve
    // the lock directly from their change events. The meter is derived from
    // alignment during render (see `reducedLockPct`), never via setState-in-
    // effect. Confirmation fires from the handler once the threshold is crossed.
    const handleDial = useCallback((setter: (v: number) => void, next: number, other: number, isTune: boolean) => {
        setter(next);
        if (reducedMotion && !lockedRef.current) {
            const a = 1 - errorFrom(isTune ? next : other, isTune ? other : next);
            if (a >= LOCK_THRESHOLD) confirmLock();
        }
    }, [reducedMotion, errorFrom, confirmLock]);

    const reducedLockPct = locked ? 1 : Math.max(0, Math.min(1, (alignment - 0.4) / 0.6));
    const statusLabel = locked
        ? 'CARRIER LOCKED'
        : alignment >= LOCK_THRESHOLD
            ? 'HOLDING PHASE…'
            : alignment > 0.6
                ? 'PHASE CONVERGING'
                : 'CARRIER DRIFTING';
    const statusTone = locked
        ? 'text-emerald-400'
        : alignment >= LOCK_THRESHOLD
            ? 'text-cyan-300 animate-pulse'
            : alignment > 0.6
                ? 'text-amber-300'
                : 'text-red-400/80';

    return (
        <div className="flex flex-col p-4 space-y-5">
            <div className="flex justify-between items-center text-[9px] font-mono uppercase tracking-widest text-emerald-100/50 border-b border-emerald-500/10 pb-1.5">
                <span>CARRIER PHASE-MATCH // RELAY 03</span>
                <span className={statusTone}>{statusLabel}</span>
            </div>

            {/* Waveform window */}
            <div className={`relative border bg-black/70 rounded overflow-hidden transition-colors duration-500 ${locked ? 'border-emerald-400/45' : alignment >= LOCK_THRESHOLD ? 'border-cyan-300/45' : 'border-emerald-500/20'}`}>
                {reducedMotion ? (
                    <div className="flex h-[76px] items-center justify-center font-mono text-xs text-emerald-100/70">
                        {locked ? 'TRACE ALIGNED — CARRIER RESOLVED' : `ALIGNMENT ${(alignment * 100).toFixed(0)}%`}
                    </div>
                ) : (
                    <svg viewBox="0 0 200 60" className="w-full h-[76px]" aria-hidden="true" preserveAspectRatio="none">
                        <line x1="0" y1="30" x2="200" y2="30" stroke="currentColor" strokeWidth="0.4" className="text-emerald-500/25" strokeDasharray="2 4" />
                        <polyline
                            ref={svgRef}
                            points={locked ? Array.from({ length: SAMPLES + 1 }, (_, i) => `${((i / SAMPLES) * 200).toFixed(1)},${(30 + Math.sin((i / SAMPLES) * Math.PI * 2 * 6) * 13).toFixed(1)}`).join(' ') : ''}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1"
                            className={locked ? 'text-emerald-300' : alignment >= LOCK_THRESHOLD ? 'text-cyan-300' : 'text-emerald-400/80'}
                        />
                    </svg>
                )}
                <div className="pointer-events-none absolute inset-0 bg-scanlines opacity-[0.06]" />
            </div>

            {/* Lock meter */}
            <div className="space-y-1.5">
                <div className="flex justify-between text-[8px] font-mono uppercase tracking-[0.2em] text-emerald-100/40">
                    <span>LOCK</span>
                    <span>{locked ? 'SYNCED' : alignment >= LOCK_THRESHOLD ? 'HOLD STEADY' : 'ACQUIRE'}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-emerald-950/40 border border-emerald-500/15">
                    <div
                        ref={meterRef}
                        className={`h-full rounded-full transition-colors duration-300 ${locked ? 'bg-emerald-400' : alignment >= LOCK_THRESHOLD ? 'bg-cyan-300' : 'bg-emerald-500/60'}`}
                        style={{ width: `${(reducedMotion || locked ? reducedLockPct * 100 : 0).toFixed(1)}%`, boxShadow: locked ? '0 0 8px rgba(16,185,129,0.6)' : undefined }}
                    />
                </div>
            </div>

            {/* Dials — native ranges so keyboard/SR reach them for free. */}
            <div className="grid grid-cols-2 gap-4">
                {([
                    { key: 'tune', label: 'TUNE', value: tune, set: setTune, other: gain, isTune: true },
                    { key: 'gain', label: 'GAIN', value: gain, set: setGain, other: tune, isTune: false },
                ] as const).map((dial) => (
                    <label key={dial.key} className="flex flex-col gap-1.5">
                        <span className="flex justify-between text-[9px] font-mono uppercase tracking-[0.2em] text-emerald-100/55">
                            <span>{dial.label}</span>
                            <span className="text-emerald-100/35">{(dial.value * 100).toFixed(0)}</span>
                        </span>
                        <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.001}
                            value={dial.value}
                            disabled={locked}
                            onChange={(e) => handleDial(dial.set, Number(e.target.value), dial.other, dial.isTune)}
                            aria-label={`${dial.label} — carrier phase-match dial`}
                            className="signal-lock-range w-full accent-emerald-400 disabled:opacity-60 touch-none"
                        />
                    </label>
                ))}
            </div>

            {/* Readout: transmission on lock, garbled-but-evocative while hunting. */}
            <div className="relative border border-emerald-500/20 bg-black/60 p-4 rounded min-h-[92px] overflow-hidden">
                <div className="text-[9px] font-mono uppercase tracking-widest text-emerald-100/40 mb-2">RELAY READOUT</div>
                {locked ? (
                    <p className="font-mono text-xs leading-relaxed text-emerald-100/90 select-text">
                        <DecodeText text={transmission} speed={26} startDelay={200} />
                    </p>
                ) : (
                    <p className="font-mono text-xs italic leading-relaxed text-emerald-100/45 select-text">
                        {driftReadout}
                    </p>
                )}
                <div className="pointer-events-none absolute inset-0 bg-scanlines opacity-[0.05]" />
            </div>

            {/* Something Brewing (Deep Decode): a second, slower process. Locking
                the carrier starts it; it completes at the next signal day. In
                progress it drifts a deterministic percentage (never reaching 100
                until the day ticks); once complete, the "beneath the
                transmission" payload decodes here. No pressure, no penalty — it
                waits forever. */}
            {(brewingToday || deepDecodePassage) && (
                <div className="relative border border-cyan-500/20 bg-black/55 p-4 rounded overflow-hidden">
                    <div className="flex justify-between items-center text-[9px] font-mono uppercase tracking-widest text-cyan-100/45 mb-2">
                        <span>DEEP DECODE</span>
                        <span>{deepDecodePassage ? 'RESOLVED' : `INTEGRATING… ${brewPct.toFixed(0)}%`}</span>
                    </div>
                    {deepDecodePassage ? (
                        <p className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-cyan-50/85 select-text">
                            <DecodeText text={deepDecodePassage} speed={14} startDelay={300} />
                        </p>
                    ) : (
                        <>
                            <div className="h-1.5 w-full overflow-hidden rounded-full border border-cyan-500/15 bg-cyan-950/40">
                                <div className="h-full rounded-full bg-cyan-400/50 transition-all duration-1000" style={{ width: `${brewPct.toFixed(1)}%` }} />
                            </div>
                            <p className="mt-2 font-mono text-[10px] italic leading-relaxed text-cyan-100/40">
                                Integrating the layer beneath the transmission. It finishes when the next signal day arrives. There is no hurry — it waits.
                            </p>
                        </>
                    )}
                    <div className="pointer-events-none absolute inset-0 bg-scanlines opacity-[0.05]" />
                </div>
            )}

            <p className="text-[8px] font-mono uppercase tracking-[0.2em] text-emerald-100/30 text-center">
                {locked
                    ? 'Carrier held. The channel stays open until day rolls over.'
                    : 'Match both dials to the carrier and hold — the phase only sets when someone is here to set it.'}
            </p>
        </div>
    );
};
