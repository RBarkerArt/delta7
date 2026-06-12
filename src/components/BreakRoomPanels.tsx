import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { CalendarClock, Hash, Loader2, StickyNote } from 'lucide-react';
import { SignalIcon } from './SignalIcon';
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

export const BreakRoomClockPanel: React.FC = () => {
  const { visitorId } = useAuth();
  const { currentDay } = useCoherence();
  const [now, setNow] = useState(() => Date.now());
  const target = useMemo(() => buildClockTarget(visitorId, currentDay), [currentDay, visitorId]);
  const isFuture = target > now;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="space-y-5 text-sm text-[#d8d2bd]/74">
      <div className="border border-[#f2ead0]/14 bg-black/28 p-4">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-emerald-100/58">
          <CalendarClock size={14} />
          Signal Day {String(currentDay).padStart(3, '0')}
        </div>
        <div className="mt-3 text-xl font-semibold uppercase tracking-[0.08em] text-[#fff7df]">
          {formatDateTime(target)}
        </div>
      </div>

      <div className="border border-white/10 bg-[#11110e]/72 p-4">
        <div className="text-[10px] uppercase tracking-[0.2em] text-[#d8d2bd]/52">
          {isFuture ? 'Counting backward from now' : 'Counting forward from breach'}
        </div>
        <div className="mt-2 font-mono text-2xl font-semibold tracking-[0.08em] text-emerald-100">
          {formatDuration(Math.abs(target - now))}
        </div>
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
      {updates.map((update) => (
        <article key={update.id} className="border border-[#f2ead0]/14 bg-black/28 p-4">
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

export const BreakRoomCoffeePanel: React.FC = () => {
  const { visitorId } = useAuth();
  const { currentDay, ensureUser } = useCoherence();
  const { config, loading } = useBreakRoomConfig();
  const observerState = useObserverBreakRoomState(visitorId);
  const [message, setMessage] = useState<string | null>(null);
  const [isPouring, setIsPouring] = useState(false);
  const alreadyPoured = observerState.lastCoffeeSignalDay === currentDay;
  const totalMilligrams = observerState.milligrams || 0;

  const pourCoffee = async () => {
    if (!visitorId || isPouring) return;
    setIsPouring(true);
    setMessage(null);

    try {
      const activeUser = await ensureUser();
      await activeUser.getIdToken();
      const claimCoffee = httpsCallable(functions, 'claimBreakRoomCoffee');
      const result = await claimCoffee({ visitorId });
      const data = result.data as CoffeeClaimResponse;
      setMessage(data.message);
    } catch (err) {
      setMessage((err as Error).message || 'The coffee machine clicks twice and refuses service.');
    } finally {
      setIsPouring(false);
    }
  };

  return (
    <div className="space-y-5 text-sm text-[#d8d2bd]/74">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="border border-[#f2ead0]/14 bg-black/28 p-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#d8d2bd]/52">Residue Mass</div>
          <div className="mt-2 text-2xl font-semibold text-[#fff7df]">{totalMilligrams.toFixed(2)}</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-emerald-100/58">mg</div>
        </div>
        <div className="border border-[#f2ead0]/14 bg-black/28 p-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#d8d2bd]/52">Coffee claim</div>
          <div className="mt-2 text-2xl font-semibold text-[#fff7df]">{loading ? '...' : (config.coffeeValue || 0).toFixed(2)}</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-emerald-100/58">mg</div>
        </div>
      </div>

      <button
        type="button"
        onClick={pourCoffee}
        disabled={!visitorId || alreadyPoured || isPouring}
        className="flex w-full items-center justify-center gap-2 border border-emerald-100/35 bg-emerald-100/14 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-50 transition-colors hover:bg-emerald-100/24 disabled:cursor-not-allowed disabled:border-[#f2ead0]/12 disabled:bg-black/28 disabled:text-[#d8d2bd]/42"
      >
        {isPouring ? <Loader2 className="animate-spin" size={15} /> : <SignalIcon name="coffee" size={15} useFilter={false} />}
        Pour Coffee (+{(config.coffeeValue || 1.42).toFixed(2)} mg)
      </button>

      {(alreadyPoured || message) && (
        <div className="border border-white/10 bg-[#11110e]/72 p-4 text-sm leading-relaxed text-[#d8d2bd]/68">
          {message || 'The pot is warm, empty, and pretending not to notice you.'}
        </div>
      )}
    </div>
  );
};

export const BreakRoomRefrigeratorPanel: React.FC = () => {
  const { visitorId } = useAuth();
  const { currentDay, ensureUser } = useCoherence();
  const { config } = useBreakRoomConfig();
  const observerState = useObserverBreakRoomState(visitorId);
  const [message, setMessage] = useState<string | null>(null);
  const [isChoosing, setIsChoosing] = useState(false);
  const alreadyOpened = observerState.lastFridgeSignalDay === currentDay;
  const totalMilligrams = observerState.milligrams || 0;

  const chooseItem = async (slot: number) => {
    if (!visitorId || isChoosing || alreadyOpened) return;
    setIsChoosing(true);
    setMessage(null);

    try {
      const activeUser = await ensureUser();
      await activeUser.getIdToken();
      const claimFridge = httpsCallable(functions, 'claimBreakRoomFridge');
      const result = await claimFridge({ visitorId, selectedSlot: slot });
      const data = result.data as FridgeClaimResponse;
      setMessage(data.message);
    } catch (err) {
      setMessage((err as Error).message || 'The refrigerator rattles, then chooses silence.');
    } finally {
      setIsChoosing(false);
    }
  };

  const statusMessage = alreadyOpened
    ? config.fridgeOutOfOrderMessage
    : message;

  return (
    <div className="space-y-5 text-sm text-[#d8d2bd]/74">
      <div className="flex flex-wrap items-center justify-between gap-3 border border-[#f2ead0]/14 bg-black/28 p-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-emerald-100/58">
            <SignalIcon name="refrigerator" size={14} useFilter={false} />
            Cold storage
          </div>
          <div className="mt-2 text-sm text-[#d8d2bd]/68">Choose one item. Do not ask why the refrigerator knows.</div>
        </div>
        <div className="text-right">
          <div className="text-xl font-semibold text-[#fff7df]">{totalMilligrams.toFixed(2)}</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-emerald-100/58">mg</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {config.fridgeItems.map((item) => (
          <button
            key={item.slot}
            type="button"
            onClick={() => chooseItem(item.slot)}
            disabled={!visitorId || alreadyOpened || isChoosing}
            className="min-h-24 border border-[#f2ead0]/14 bg-[#11110e]/72 p-3 text-left transition-colors hover:border-emerald-100/36 hover:bg-emerald-100/10 disabled:cursor-not-allowed disabled:hover:border-[#f2ead0]/14 disabled:hover:bg-[#11110e]/72"
          >
            <div className="text-[10px] uppercase tracking-[0.18em] text-[#d8d2bd]/45">Slot {item.slot}</div>
            <div className="mt-2 text-sm font-semibold text-[#fff7df]">{item.name}</div>
            <div className="mt-1 flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-emerald-100/58">
              <Hash size={11} />
              +{item.milligramValue.toFixed(2)} mg
            </div>
          </button>
        ))}
      </div>

      {statusMessage && (
        <div className="border border-white/10 bg-[#11110e]/72 p-4 text-sm leading-relaxed text-[#d8d2bd]/68">
          {statusMessage}
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
