import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { CalendarClock, Hash, Loader2, StickyNote } from 'lucide-react';
import { SignalIcon } from './SignalIcon';
import { AnimatedCounter } from './ui/AnimatedCounter';
import { TypeOn } from './ui/TypeOn';
import { db, functions } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { useCoherence } from '../hooks/useCoherence';
import {
  DEFAULT_BREAK_ROOM_CONFIG,
  normalizeBreakRoomConfig,
  type BreakRoomConfig,
  type BreakRoomObserverState,
  type BreakRoomUpdate,
} from '../lib/breakRoom';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface CoffeeClaimResponse {
  success: boolean;
  alreadyClaimed: boolean;
  message: string;
  milligrams: number;
  awarded: number;
  unitLabel: string;
}

interface FridgeClaimResponse {
  success: boolean;
  alreadyClaimed: boolean;
  message: string;
  milligrams: number;
  awarded: number;
  unitLabel: string;
  selectedSlot?: number;
  winningSlot?: number;
  selectedItemName?: string;
  winningItemName?: string;
}

const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const seededFraction = (seed: string): number => hashString(seed) / 4294967295;

const buildClockTarget = (visitorId: string | null, currentDay: number): number => {
  const safeVisitorId = visitorId || 'unanchored-observer';
  const storageKey = `delta7_clock_target:${safeVisitorId}:${currentDay}`;

  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem(storageKey);
    const parsed = stored ? Number(stored) : NaN;
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  const seed = `${safeVisitorId}:${currentDay}:clock`;
  const direction = seededFraction(`${seed}:direction`) >= 0.5 ? 1 : -1;
  const offsetDays = 3 + Math.floor(seededFraction(`${seed}:days`) * 728);
  const offsetSeconds = Math.floor(seededFraction(`${seed}:seconds`) * 86400);
  const target = Date.now() + direction * (offsetDays * MS_PER_DAY + offsetSeconds * 1000);

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(storageKey, String(target));
  }

  return target;
};

const formatDuration = (milliseconds: number): string => {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
  }
  return `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
};

const formatDateTime = (timestamp: number): string => (
  new Date(timestamp).toLocaleString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  })
);

const timestampMillis = (value: BreakRoomUpdate['updatedAt'] | BreakRoomUpdate['createdAt']): number => (
  value?.toMillis?.() || 0
);

const useBreakRoomConfig = () => {
  const [config, setConfig] = useState<BreakRoomConfig>(DEFAULT_BREAK_ROOM_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'break_room_config', 'main'), (snapshot) => {
      setConfig(normalizeBreakRoomConfig(snapshot.exists() ? snapshot.data() : null));
      setLoading(false);
    }, (error) => {
      if (import.meta.env.DEV) console.warn('[Delta-7] Break room config unavailable:', error);
      setConfig(DEFAULT_BREAK_ROOM_CONFIG);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { config, loading };
};

export const useObserverBreakRoomState = (visitorId: string | null) => {
  const [state, setState] = useState<BreakRoomObserverState>({});

  useEffect(() => {
    if (!visitorId) {
      setState({});
      return undefined;
    }

    const unsubscribe = onSnapshot(doc(db, 'observers', visitorId), (snapshot) => {
      setState(snapshot.exists() ? snapshot.data() as BreakRoomObserverState : {});
    }, (error) => {
      if (import.meta.env.DEV) console.warn('[Delta-7] Observer break room state unavailable:', error);
      setState({});
    });

    return () => unsubscribe();
  }, [visitorId]);

  return state;
};

const GLITCH_GLYPHS = '0189▒█/\\';

/** Corrupt a few characters of a clock string, leaving separators intact. */
const corruptClockString = (value: string): string => {
  const chars = value.split('');
  const corruptions = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < corruptions; i += 1) {
    const idx = Math.floor(Math.random() * chars.length);
    if (/[0-9]/.test(chars[idx])) {
      chars[idx] = GLITCH_GLYPHS[Math.floor(Math.random() * GLITCH_GLYPHS.length)];
    }
  }
  return chars.join('');
};

export const BreakRoomClockPanel: React.FC = () => {
  const { visitorId } = useAuth();
  const { currentDay } = useCoherence();
  const [now, setNow] = useState(() => Date.now());
  const [isGlitching, setIsGlitching] = useState(false);
  const target = useMemo(() => buildClockTarget(visitorId, currentDay), [currentDay, visitorId]);
  const isFuture = target > now;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // The clock can't quite hold itself together: every 6-14s a few digits
  // corrupt for a beat, then recover.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;

    let glitchTimer: number;
    let recoverTimer: number;
    const scheduleGlitch = () => {
      glitchTimer = window.setTimeout(() => {
        setIsGlitching(true);
        recoverTimer = window.setTimeout(() => {
          setIsGlitching(false);
          scheduleGlitch();
        }, 160 + Math.random() * 240);
      }, 6000 + Math.random() * 8000);
    };
    scheduleGlitch();
    return () => {
      window.clearTimeout(glitchTimer);
      window.clearTimeout(recoverTimer);
    };
  }, []);

  const countdown = formatDuration(Math.abs(target - now));

  return (
    <div className="space-y-5 text-sm text-[#d8d2bd]/74">
      <div className="border border-[#f2ead0]/14 bg-black/28 p-4">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-emerald-100/58">
          <CalendarClock size={14} />
          Signal Day {String(currentDay).padStart(3, '0')}
        </div>
        <div className={`mt-3 text-xl font-semibold uppercase tracking-[0.08em] text-[#fff7df] ${isGlitching ? 'animate-flicker-fast' : ''}`}>
          {isGlitching ? corruptClockString(formatDateTime(target)) : formatDateTime(target)}
        </div>
      </div>

      <div className="border border-white/10 bg-[#11110e]/72 p-4">
        <div className="text-[10px] uppercase tracking-[0.2em] text-[#d8d2bd]/52">
          {isFuture ? 'Counting backward from now' : 'Counting forward from breach'}
        </div>
        <div className={`mt-2 font-mono text-2xl font-semibold tracking-[0.08em] ${isGlitching ? 'text-red-300/90 animate-flicker-fast' : 'text-emerald-100'}`}>
          {isGlitching ? corruptClockString(countdown) : countdown}
        </div>
        {isGlitching && (
          <div className="mt-2 text-[9px] uppercase tracking-[0.2em] text-red-300/55">drift detected — resyncing</div>
        )}
      </div>
    </div>
  );
};

export const BreakRoomBulletinPanel: React.FC = () => {
  const [updates, setUpdates] = useState<BreakRoomUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchUpdates = async () => {
      setLoading(true);
      setError(null);

      try {
        const updatesQuery = query(collection(db, 'break_room_updates'), where('published', '==', true));
        const snapshot = await getDocs(updatesQuery);
        const nextUpdates = snapshot.docs
          .map(updateDoc => ({ id: updateDoc.id, ...updateDoc.data() }) as BreakRoomUpdate)
          .sort((a, b) => {
            if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
            return Math.max(timestampMillis(b.updatedAt), timestampMillis(b.createdAt)) - Math.max(timestampMillis(a.updatedAt), timestampMillis(a.createdAt));
          });

        if (!cancelled) setUpdates(nextUpdates);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchUpdates();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-40 items-center justify-center text-[#d8d2bd]/55">
        <Loader2 className="mr-2 animate-spin" size={16} />
        Checking the corkboard
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-red-300/20 bg-red-950/20 p-4 text-sm text-red-100/75">
        Bulletin board feed unavailable.
      </div>
    );
  }

  if (updates.length === 0) {
    return (
      <div className="border border-[#f2ead0]/14 bg-black/28 p-5 text-sm text-[#d8d2bd]/62">
        The board has fresh pinholes, old tape, and no posted notes.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {updates.map((update, updateIndex) => (
        <article key={update.id} className="room-modal-stagger border border-[#f2ead0]/14 bg-black/28 p-4" style={{ animationDelay: `${Math.min(updateIndex, 6) * 110}ms` }}>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-emerald-100/58">
            <StickyNote size={13} />
            <span>{update.type}</span>
            {update.pinned && <span className="border border-emerald-100/20 px-1.5 py-0.5 text-emerald-50/70">Pinned</span>}
          </div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-[#fff7df]">{update.title}</h3>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[#d8d2bd]/72">{update.body}</p>
        </article>
      ))}
    </div>
  );
};

const POUR_DURATION_MS = 2600;

type CoffeePhase = 'idle' | 'pouring' | 'done' | 'error';

export const BreakRoomCoffeePanel: React.FC = () => {
  const { visitorId } = useAuth();
  const { currentDay, ensureUser } = useCoherence();
  const { config, loading } = useBreakRoomConfig();
  const observerState = useObserverBreakRoomState(visitorId);
  const [message, setMessage] = useState<string | null>(null);
  const [phase, setPhase] = useState<CoffeePhase>('idle');
  const [pourAward, setPourAward] = useState(0);
  const [massGlow, setMassGlow] = useState(false);
  const alreadyPoured = observerState.lastCoffeeSignalDay === currentDay;
  const totalMilligrams = observerState.milligrams || 0;
  const coffeeValue = config.coffeeValue || 1.42;

  const isPouring = phase === 'pouring';
  // Cup reads full once today's pour is done (or was done on a previous visit).
  const cupFilled = phase === 'done' || (alreadyPoured && phase === 'idle');

  const pourCoffee = async () => {
    if (!visitorId || isPouring || alreadyPoured) return;
    setPhase('pouring');
    setMessage(null);
    setPourAward(0);
    // Kick the award odometer on the next frame so it animates from 0.
    requestAnimationFrame(() => setPourAward(coffeeValue));

    const animationDone = new Promise<void>(resolve => setTimeout(resolve, POUR_DURATION_MS));

    try {
      const claim = (async () => {
        const activeUser = await ensureUser();
        await activeUser.getIdToken();
        const claimCoffee = httpsCallable(functions, 'claimBreakRoomCoffee');
        const result = await claimCoffee({ visitorId });
        return result.data as CoffeeClaimResponse;
      })();

      const [data] = await Promise.all([claim, animationDone]);
      setMessage(data.message);
      setPhase('done');
      setMassGlow(true);
      setTimeout(() => setMassGlow(false), 1400);
    } catch (err) {
      await animationDone;
      setMessage((err as Error).message || 'The coffee machine clicks twice and refuses service.');
      setPhase('error');
      setPourAward(0);
    }
  };

  return (
    <div className="space-y-5 text-sm text-[#d8d2bd]/74">
      <style>{`
        @keyframes coffee-stream-wobble {
          0%, 100% { transform: translateX(0) scaleY(1); opacity: 0.92; }
          30% { transform: translateX(-0.6px) scaleY(0.99); opacity: 0.8; }
          60% { transform: translateX(0.5px) scaleY(1.01); opacity: 0.95; }
        }
        @keyframes coffee-steam-rise {
          0% { transform: translateY(0) scaleX(1); opacity: 0; }
          25% { opacity: 0.5; }
          100% { transform: translateY(-26px) scaleX(1.6); opacity: 0; }
        }
        @keyframes coffee-machine-hum {
          0%, 100% { transform: translate(0, 0); }
          25% { transform: translate(0.4px, -0.2px); }
          50% { transform: translate(-0.3px, 0.3px); }
          75% { transform: translate(0.2px, 0.2px); }
        }
        @keyframes coffee-machine-sputter {
          0%, 100% { transform: translate(0, 0); }
          20% { transform: translate(-2px, 1px); }
          40% { transform: translate(2px, -1px); }
          60% { transform: translate(-1.5px, -1px); }
          80% { transform: translate(1px, 1.5px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .coffee-liquid-level { transition-duration: 1ms !important; }
        }
      `}</style>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className={`border bg-black/28 p-4 transition-all duration-700 ${massGlow ? 'border-emerald-200/55 shadow-[0_0_22px_rgba(16,185,129,0.22)]' : 'border-[#f2ead0]/14'}`}>
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#d8d2bd]/52">Residue Mass</div>
          <div className="mt-2 text-2xl font-semibold text-[#fff7df]">
            <AnimatedCounter value={totalMilligrams} duration={1100} />
          </div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-emerald-100/58">mg</div>
        </div>
        <div className="border border-[#f2ead0]/14 bg-black/28 p-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#d8d2bd]/52">Coffee claim</div>
          <div className="mt-2 text-2xl font-semibold text-[#fff7df]">{loading ? '...' : coffeeValue.toFixed(2)}</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-emerald-100/58">mg</div>
        </div>
      </div>

      {/* Coffee machine vignette */}
      <div className="relative flex flex-col items-center border border-[#f2ead0]/14 bg-[#11110e]/72 px-4 pb-3 pt-4">
        <svg
          viewBox="0 0 200 150"
          className="h-44 w-auto select-none"
          style={{
            animation: isPouring
              ? 'coffee-machine-hum 0.18s infinite linear'
              : phase === 'error'
                ? 'coffee-machine-sputter 0.32s 3 linear'
                : undefined,
          }}
          aria-label="Coffee machine"
        >
          {/* Machine body */}
          <g className="text-[#f2ead0]">
            <rect x="55" y="10" width="90" height="26" rx="2" fill="rgba(242,234,208,0.08)" stroke="currentColor" strokeOpacity="0.35" />
            <rect x="62" y="36" width="14" height="42" fill="rgba(242,234,208,0.06)" stroke="currentColor" strokeOpacity="0.28" />
            <rect x="124" y="36" width="14" height="42" fill="rgba(242,234,208,0.06)" stroke="currentColor" strokeOpacity="0.28" />
            {/* Spout */}
            <rect x="94" y="36" width="12" height="10" fill="rgba(242,234,208,0.14)" stroke="currentColor" strokeOpacity="0.4" />
            {/* Status lamp */}
            <circle cx="135" cy="23" r="3" fill={isPouring ? '#34d399' : phase === 'error' ? '#ef4444' : 'rgba(242,234,208,0.25)'} className={isPouring ? 'animate-pulse' : ''} />
            <text x="64" y="27" className="font-mono" fill="rgba(242,234,208,0.45)" fontSize="8" letterSpacing="2">DELTA-7</text>
            {/* Drip tray */}
            <rect x="58" y="128" width="84" height="5" rx="1" fill="rgba(242,234,208,0.1)" stroke="currentColor" strokeOpacity="0.3" />
          </g>

          {/* Pour stream */}
          {isPouring && (
            <rect
              x="98.5" y="46" width="3" height="74"
              fill="#8a5a33" opacity="0.9"
              style={{ animation: 'coffee-stream-wobble 0.22s infinite linear', transformOrigin: '100px 46px' }}
            />
          )}

          {/* Cup */}
          <g>
            <clipPath id="coffee-cup-clip">
              <path d="M 82 96 L 85 126 Q 85.5 128 88 128 L 112 128 Q 114.5 128 115 126 L 118 96 Z" />
            </clipPath>
            <g clipPath="url(#coffee-cup-clip)">
              <rect
                x="80"
                y="0"
                width="40"
                height="132"
                fill="#6f4426"
                className="coffee-liquid-level"
                style={{
                  transform: `translateY(${cupFilled || isPouring ? 102 : 132}px)`,
                  transition: `transform ${isPouring ? POUR_DURATION_MS - 200 : 1}ms cubic-bezier(0.3, 0.6, 0.4, 1)`,
                }}
              />
            </g>
            <path
              d="M 82 96 L 85 126 Q 85.5 128 88 128 L 112 128 Q 114.5 128 115 126 L 118 96 Z"
              fill="rgba(242,234,208,0.04)" stroke="rgba(242,234,208,0.5)" strokeWidth="1.2"
            />
            <path d="M 117 102 Q 127 102 126 110 Q 125 117 115.5 116" fill="none" stroke="rgba(242,234,208,0.42)" strokeWidth="1.2" />
          </g>

          {/* Steam — only while fresh */}
          {phase === 'done' && (
            <g stroke="rgba(242,234,208,0.5)" strokeWidth="1" fill="none" strokeLinecap="round">
              <path d="M 92 90 Q 89 84 92 78" style={{ animation: 'coffee-steam-rise 2.4s infinite ease-out' }} />
              <path d="M 100 92 Q 103 85 100 78" style={{ animation: 'coffee-steam-rise 2.4s 0.7s infinite ease-out' }} />
              <path d="M 108 90 Q 105 84 108 79" style={{ animation: 'coffee-steam-rise 2.4s 1.3s infinite ease-out' }} />
            </g>
          )}
        </svg>

        {/* Award tick-up during pour */}
        <div className={`pointer-events-none absolute right-4 top-4 text-right transition-opacity duration-500 ${isPouring || phase === 'done' ? 'opacity-100' : 'opacity-0'}`}>
          <div className="text-lg font-semibold text-emerald-200">
            <AnimatedCounter value={pourAward} duration={POUR_DURATION_MS - 300} prefix="+" />
          </div>
          <div className="text-[9px] uppercase tracking-[0.2em] text-emerald-100/55">mg residue</div>
        </div>

        <div className="mt-1 text-[9px] uppercase tracking-[0.24em] text-[#d8d2bd]/40">
          {isPouring ? 'Dispensing — maintain attention' : cupFilled ? 'Serving complete' : 'Unit ready'}
        </div>
      </div>

      <button
        type="button"
        onClick={pourCoffee}
        disabled={!visitorId || alreadyPoured || isPouring}
        className="flex w-full items-center justify-center gap-2 border border-emerald-100/35 bg-emerald-100/14 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-50 transition-colors hover:bg-emerald-100/24 disabled:cursor-not-allowed disabled:border-[#f2ead0]/12 disabled:bg-black/28 disabled:text-[#d8d2bd]/42"
      >
        {isPouring ? <Loader2 className="animate-spin" size={15} /> : <SignalIcon name="coffee" size={15} useFilter={false} />}
        {isPouring ? 'Pouring…' : `Pour Coffee (+${coffeeValue.toFixed(2)} mg)`}
      </button>

      {(alreadyPoured || message) && !isPouring && (
        <div className={`border p-4 text-sm leading-relaxed ${phase === 'error' ? 'border-red-300/25 bg-red-950/15 text-red-100/75' : 'border-white/10 bg-[#11110e]/72 text-[#d8d2bd]/68'}`}>
          <TypeOn
            key={message || 'warm-pot'}
            text={message || 'The pot is warm, empty, and pretending not to notice you.'}
            speed={12}
            showCursor={false}
          />
        </div>
      )}
    </div>
  );
};

const FRIDGE_SCAN_MS = 1700;

export const BreakRoomRefrigeratorPanel: React.FC = () => {
  const { visitorId } = useAuth();
  const { currentDay, ensureUser } = useCoherence();
  const { config } = useBreakRoomConfig();
  const observerState = useObserverBreakRoomState(visitorId);
  const [message, setMessage] = useState<string | null>(null);
  const [isChoosing, setIsChoosing] = useState(false);
  const [scanningSlot, setScanningSlot] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<{ selectedSlot?: number; winningSlot?: number } | null>(null);
  const alreadyOpened = observerState.lastFridgeSignalDay === currentDay;
  const totalMilligrams = observerState.milligrams || 0;

  const chooseItem = async (slot: number) => {
    if (!visitorId || isChoosing || alreadyOpened) return;
    setIsChoosing(true);
    setScanningSlot(slot);
    setMessage(null);
    setOutcome(null);

    const scanDone = new Promise<void>(resolve => setTimeout(resolve, FRIDGE_SCAN_MS));

    try {
      const claim = (async () => {
        const activeUser = await ensureUser();
        await activeUser.getIdToken();
        const claimFridge = httpsCallable(functions, 'claimBreakRoomFridge');
        const result = await claimFridge({ visitorId, selectedSlot: slot });
        return result.data as FridgeClaimResponse;
      })();

      const [data] = await Promise.all([claim, scanDone]);
      setOutcome({ selectedSlot: data.selectedSlot ?? slot, winningSlot: data.winningSlot });
      setMessage(data.message);
    } catch (err) {
      await scanDone;
      setMessage((err as Error).message || 'The refrigerator rattles, then chooses silence.');
    } finally {
      setScanningSlot(null);
      setIsChoosing(false);
    }
  };

  const statusMessage = alreadyOpened && !message
    ? config.fridgeOutOfOrderMessage
    : message;

  const slotState = (slot: number): 'idle' | 'scanning' | 'picked' | 'winner' | 'both' => {
    if (isChoosing) return scanningSlot === slot ? 'picked' : 'scanning';
    if (!outcome) return 'idle';
    const isPicked = outcome.selectedSlot === slot;
    const isWinner = outcome.winningSlot === slot;
    if (isPicked && isWinner) return 'both';
    if (isWinner) return 'winner';
    if (isPicked) return 'picked';
    return 'idle';
  };

  const SLOT_CLASS: Record<ReturnType<typeof slotState>, string> = {
    idle: 'border-[#f2ead0]/14 bg-[#11110e]/72',
    scanning: 'border-[#f2ead0]/14 bg-[#11110e]/72 fridge-slot-scan',
    picked: 'border-amber-200/55 bg-amber-100/8 shadow-[0_0_16px_rgba(251,191,36,0.12)]',
    winner: 'border-emerald-200/65 bg-emerald-100/10 shadow-[0_0_18px_rgba(16,185,129,0.2)]',
    both: 'border-emerald-200/80 bg-emerald-100/16 shadow-[0_0_22px_rgba(16,185,129,0.3)]',
  };

  return (
    <div className="space-y-5 text-sm text-[#d8d2bd]/74">
      <style>{`
        @keyframes fridge-scan-flicker {
          0%, 100% { background-color: rgba(17, 17, 14, 0.72); border-color: rgba(242, 234, 208, 0.14); }
          50% { background-color: rgba(16, 185, 129, 0.07); border-color: rgba(167, 243, 208, 0.35); }
        }
        .fridge-slot-scan {
          animation: fridge-scan-flicker 0.34s infinite steps(2);
        }
        .fridge-slot-scan:nth-child(odd) {
          animation-delay: 0.17s;
        }
        @media (prefers-reduced-motion: reduce) {
          .fridge-slot-scan { animation: none; }
        }
      `}</style>

      <div className="flex flex-wrap items-center justify-between gap-3 border border-[#f2ead0]/14 bg-black/28 p-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-emerald-100/58">
            <SignalIcon name="refrigerator" size={14} useFilter={false} />
            Cold storage
          </div>
          <div className="mt-2 text-sm text-[#d8d2bd]/68">
            {isChoosing ? 'Compressor spinning. The refrigerator is deciding.' : 'Choose one item. Do not ask why the refrigerator knows.'}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xl font-semibold text-[#fff7df]">
            <AnimatedCounter value={totalMilligrams} duration={1100} />
          </div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-emerald-100/58">mg</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {config.fridgeItems.map((item) => {
          const stateName = slotState(item.slot);
          return (
            <button
              key={item.slot}
              type="button"
              onClick={() => chooseItem(item.slot)}
              disabled={!visitorId || alreadyOpened || isChoosing}
              className={`min-h-24 border p-3 text-left transition-all duration-300 hover:border-emerald-100/36 hover:bg-emerald-100/10 disabled:cursor-not-allowed disabled:hover:bg-transparent ${SLOT_CLASS[stateName]}`}
            >
              <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-[#d8d2bd]/45">
                <span>Slot {item.slot}</span>
                {stateName === 'both' && <span className="text-emerald-200/90">Match</span>}
                {stateName === 'winner' && <span className="text-emerald-200/90">Chosen</span>}
                {stateName === 'picked' && !isChoosing && <span className="text-amber-200/85">Yours</span>}
              </div>
              <div className="mt-2 text-sm font-semibold text-[#fff7df]">{item.name}</div>
              <div className="mt-1 flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-emerald-100/58">
                <Hash size={11} />
                +{item.milligramValue.toFixed(2)} mg
              </div>
            </button>
          );
        })}
      </div>

      {isChoosing && (
        <div className="border border-emerald-100/20 bg-[#11110e]/72 p-4 text-[11px] uppercase tracking-[0.2em] text-emerald-100/65 animate-pulse">
          Scanning cold inventory…
        </div>
      )}

      {statusMessage && !isChoosing && (
        <div className="border border-white/10 bg-[#11110e]/72 p-4 text-sm leading-relaxed text-[#d8d2bd]/68">
          <TypeOn key={statusMessage} text={statusMessage} speed={12} showCursor={false} />
          {alreadyOpened && observerState.lastFridgeOutcome && (
            <div className="mt-3 text-[10px] uppercase tracking-[0.16em] text-[#d8d2bd]/42">
              Last pull: {observerState.lastFridgeOutcome.selectedItemName}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
