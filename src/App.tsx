import React, { useEffect, useState, useCallback, useRef, Suspense, lazy, useMemo } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { HelmetProvider, Helmet } from 'react-helmet-async';
import { useCoherence } from './hooks/useCoherence';
import { useAuth } from './hooks/useAuth';
import { CoherenceProvider } from './context/CoherenceContext';
import { AuthProvider } from './context/AuthContext';
import { db, storage, functions } from './lib/firebase';
import { doc, onSnapshot, getDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import type { DayLog, ReturnSignalReport } from './types/schema';
import { LabObserverRoom, preloadRoomSceneAssets, type RoomHotspotDefinition, type RoomHotspotStatus, type RoomSceneId } from './components/LabObserverRoom';
import { TerminalOverlay } from './components/TerminalOverlay';
import { RoomModal } from './components/RoomModal';
import { PrologueViewerPanel } from './components/PrologueViewerPanel';
import { SecurityGatewayPanel } from './components/SecurityGatewayPanel';
import { SignatureLog } from './components/SignatureLog';
import { SupportRelayPanel } from './components/SupportRelayPanel';
import { ArchiveShelfPanel } from './components/ArchiveShelfPanel';
import { ReturnSignalPanel } from './components/ReturnSignalPanel';
import { InlineAutoplayVideo } from './components/InlineAutoplayVideo';
import { RoomIndexPanel } from './components/RoomIndexPanel';
import { BreakRoomBulletinPanel, BreakRoomClockPanel, BreakRoomCoffeePanel, BreakRoomRefrigeratorPanel, useObserverBreakRoomState } from './components/BreakRoomPanels';
import { CartographyCompassPanel } from './components/CartographyCompassPanel';
import { AnimatedCounter } from './components/ui/AnimatedCounter';
import { TypeOn } from './components/ui/TypeOn';
import { DecodeText } from './components/ui/DecodeText';
import { FlipCard } from './components/ui/FlipCard';
import { RevealMask } from './components/ui/RevealMask';
import { SignalLockPanel } from './components/SignalLockPanel';
import { TheAlmost } from './components/TheAlmost';
import { ROOM_HOTSPOTS } from './lib/roomDefinitions';
import { RoomEntryTransition } from './components/RoomEntryTransition';

import { ScreenEffects } from './components/ScreenEffects';
import { BackgroundAtmosphere } from './components/BackgroundAtmosphere';
import { Prologue } from './components/Prologue';
import { AuthModal } from './components/AuthModal';
import { GlitchOverlay } from './components/GlitchOverlay';
import { AtmosphereManager } from './components/AtmosphereManager';
import { getSystemFlag } from './lib/systemFlags';
import { TuningInterface } from './components/TuningInterface'; // Project Signal
import { useSound } from './hooks/useSound';
import { getAudioOptIn, setAudioOptIn, openAudioChannel } from './lib/audioUnlock';
import { startStormDirector, stopStormDirector } from './lib/stormDirector';
import { startAbsenceWatcher, stopAbsenceWatcher } from './lib/absenceWatcher';
import { setRoomFxTarget, setDisturbed } from './lib/roomFx';
import { soundEngine } from './lib/SoundEngine';
import { onRecoverySurge, triggerRecoverySurge } from './lib/recoverySurge';
import { ACROSTIC_RECOVERY_ID } from './lib/kaelMarginalia';
import { armReturnGreeting } from './lib/returnGreeting';
import { runDeadZoneSwallow } from './lib/deadZoneSwallow';
import { ProtectedRoute } from './components/ProtectedRoute';
import { getWillowRestorationState, isVideoSource, selectAvailableWillowState, toStoragePath, WILLOW_VIDEO_VARIANTS, type WillowEvidenceState } from './lib/roomMedia';
import { buildPrologueThresholdsFromDays, buildPrologueThresholdsFromLocalData, getPrologueThresholdId, type PrologueThreshold } from './lib/prologueThresholds';
import { buildDailyRecoveryState, countRecoveredVmLogs, getCatchupSignalRecoveryId, getDayNoteRecoveryId, getReturnPacketRecoveryId, getDayVmRecoveryId, getDayEvidenceRecoveryId } from './lib/dailyRecovery';
import prologueData from './season1_prologues.json';
import localDaysData from './season1_days.json';

// Lazy Load Admin Components (7.2 Payload Hygiene)
const AdminLogin = lazy(() => import('./components/AdminLogin').then(m => ({ default: m.AdminLogin })));
const AdminLayout = lazy(() => import('./components/AdminLayout').then(m => ({ default: m.AdminLayout })));
const DashboardOverview = lazy(() => import('./components/DashboardOverview').then(m => ({ default: m.DashboardOverview })));
const NarrativeManager = lazy(() => import('./components/NarrativeManager').then(m => ({ default: m.NarrativeManager })));
const ObserverDirectory = lazy(() => import('./components/ObserverDirectory').then(m => ({ default: m.ObserverDirectory })));
const NarrativeReader = lazy(() => import('./components/NarrativeReader').then(m => ({ default: m.NarrativeReader })));
const AdminSettings = lazy(() => import('./components/AdminSettings').then(m => ({ default: m.AdminSettings })));
const StoryBibleEditor = lazy(() => import('./components/StoryBibleEditor').then(m => ({ default: m.StoryBibleEditor })));
const AtmosphereControl = lazy(() => import('./components/AtmosphereControl').then(m => ({ default: m.AtmosphereControl })));
const AdminRooms = lazy(() => import('./components/AdminRooms').then(m => ({ default: m.AdminRooms })));
const AdminStats = lazy(() => import('./components/AdminStats').then(m => ({ default: m.AdminStats })));
const AdminBreakRoom = lazy(() => import('./components/AdminBreakRoom').then(m => ({ default: m.AdminBreakRoom })));
const AdminCartography = lazy(() => import('./components/AdminCartography').then(m => ({ default: m.AdminCartography })));
import { PrivacyStatement, TermsAndConditions } from './pages/LegalPage';

const REQUIRED_SIGNAL_ROOM_VM_LOGS = 5;
const REQUIRED_NEXT_ROOM_VM_LOGS = 15;
const ROOM_TRANSITION_SWAP_MS = 220;
const ROOM_TRANSITION_MIN_MS = 680;
const ROOM_TRANSITION_MAX_MS = 1500;
const MOBILE_ROOM_NAVIGATION_KEY = 'delta7_mobile_room_navigation';

type ActiveRoom = 'lab' | 'break-room' | 'signal-cartography';
type ActivePopup =
  | 'blackboard'
  | 'drawer'
  | 'window'
  | 'prologue'
  | 'archive'
  | 'support'
  | 'security'
  | 'room-signal'
  | 'return-door'
  | 'next-room-door'
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

const VALID_POPUP_IDS = new Set<ActivePopup>([
  'blackboard', 'drawer', 'window', 'prologue', 'archive', 'support', 'security',
  'room-signal', 'return-door', 'next-room-door', 'break-clock', 'break-bulletin',
  'break-coffee', 'break-fridge', 'cart-map', 'cart-compass', 'cart-dead-zones',
  'cart-room-index', 'cart-route-trace', 'cart-relay-tuning', 'cart-notes',
  'cart-unmarked-door', 'cart-sector-scan',
]);

// One-shot recovery id for the dead-zone swallow (D3). Recorded via
// markRecovered on first open; presence in recoveredItems disables the takeover.
const DEAD_ZONE_SWALLOW_ID = 'event_dead_zone_swallow';

// Read-trace (dog-ears): papery panels earn a folded corner once opened;
// instruments a faint fingerprint. Purely decorative persistence keyed on the
// resolved modal variant via `read:${variant}` in recoveredItems. `window` and
// door/index shells carry no trace (they're live feeds, not artifacts to leave).
const PAPER_READ_TRACE_VARIANTS = new Set<string>([
  'drawer', 'archive', 'prologue', 'support', 'blackboard', 'lore',
  'cart-notes', 'break-bulletin',
]);
const INSTRUMENT_READ_TRACE_VARIANTS = new Set<string>([
  'security', 'break-clock', 'break-coffee', 'break-fridge',
  'cart-compass', 'cart-route-trace', 'cart-sector-scan', 'cart-relay-tuning',
]);
const readTraceKindForVariant = (variant: string): 'unread' | 'paper' | 'instrument' => {
  if (PAPER_READ_TRACE_VARIANTS.has(variant)) return 'paper';
  if (INSTRUMENT_READ_TRACE_VARIANTS.has(variant)) return 'instrument';
  return 'unread';
};

const getRoomSceneId = (room: ActiveRoom): RoomSceneId => {
  if (room === 'lab') return 'lab';
  if (room === 'break-room') return 'break-room';
  return 'signal-cartography';
};

// Variable Signal (#6): action ids that never carry the day's featured content —
// doors and the room-index/signal panels are navigation, not story surfaces.
const FEATURED_INELIGIBLE_ACTIONS = new Set<string>([
  'return-door', 'next-room-door', 'room-signal', 'cart-room-index', 'cart-unmarked-door',
]);

// Small string hash mirroring the per-day seeding idiom used across the panels
// (CartographyCompassPanel, SignalLockPanel).
const hashSeedString = (value: string): number => {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

/**
 * Pick the 1–2 hotspots that carry the day's freshest content, seeded by
 * (day + observer) over the current room's eligible actionIds. Stable per
 * observer/day; deterministically distinct picks. Returns the featured
 * *action ids* (matched against hotspot.actionId in the room).
 */
const selectFeaturedActionIds = (sceneId: RoomSceneId, day: number, visitorId: string | null): Set<string> => {
  const eligible = (ROOM_HOTSPOTS[sceneId] ?? [])
    .map((hs) => hs.actionId)
    .filter((actionId) => !FEATURED_INELIGIBLE_ACTIONS.has(actionId));
  // De-dupe (some rooms map two hotspots to the same actionId, e.g. `window`).
  const pool = Array.from(new Set(eligible));
  if (pool.length === 0) return new Set();

  const seed = hashSeedString(`featured:${sceneId}:${day}:${visitorId || 'anon'}`);
  const count = pool.length >= 4 ? 1 + (seed % 2) : 1; // 1–2 hot per day
  const featured = new Set<string>();
  let cursor = seed % pool.length;
  for (let i = 0; i < count && featured.size < pool.length; i++) {
    // Step by a seed-derived stride so the two picks are rarely adjacent.
    while (featured.has(pool[cursor])) cursor = (cursor + 1) % pool.length;
    featured.add(pool[cursor]);
    cursor = (cursor + 1 + (seed % 3)) % pool.length;
  }
  return featured;
};

const getRoomPath = (room: ActiveRoom): string => {
  if (room === 'lab') return '/rooms/observation';
  return `/rooms/${room}`;
};

const getRoomDisplayName = (room: ActiveRoom): string => {
  if (room === 'lab') return 'OBSERVATION';
  if (room === 'break-room') return 'BREAK ROOM';
  return 'SIGNAL CARTOGRAPHY';
};

const getRoomFromRoute = (roomSlug?: string): ActiveRoom => {
  if (roomSlug === 'break-room') return 'break-room';
  if (roomSlug === 'signal-cartography') return 'signal-cartography';
  return 'lab';
};

const isMobileOrTabletDevice = () => {
  if (typeof window === 'undefined') return false;
  const userAgent = navigator.userAgent || '';
  const isMobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  const isIPadDesktopMode = /Macintosh/i.test(userAgent) && navigator.maxTouchPoints > 1;
  const isCoarse = window.matchMedia('(pointer: coarse)').matches;
  const shortestSide = Math.min(window.innerWidth, window.innerHeight);

  return isMobileUserAgent || isIPadDesktopMode || isCoarse || shortestSide <= 820;
};

const shouldUseMemorySafeRoomRuntime = () => {
  if (typeof window === 'undefined') return false;

  return (
    isMobileOrTabletDevice() ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
};

const RoomSignalTransitionOverlay: React.FC = () => {
  return (
    <div className="pointer-events-none fixed inset-0 z-[13000] overflow-hidden bg-black/20" aria-hidden="true">
      <div className="room-transition-flash absolute inset-0" />
    </div>
  );
};



const formatSignalCountdown = (target: number | null, now: number): string => {
  if (!target) return 'CALIBRATING';

  const totalSeconds = Math.max(0, Math.ceil((target - now) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  return `${seconds}s`;
};

const getReturnSignalLabel = (arrivalDayDelta: number, currentDay: number): string => {
  if (arrivalDayDelta > 1) return `ABSENCE DRIFT: ${arrivalDayDelta} DAYS RECOVERED`;
  if (arrivalDayDelta === 1) return 'NEW SIGNAL OPEN';
  if (currentDay === 1) return 'INITIAL SIGNAL HOLDING';
  return 'ROOM HOLDING';
};

const selectPendingPrologueQueue = (
  thresholds: PrologueThreshold[],
  recoveredItems: string[],
  currentDay: number
): PrologueThreshold[] => (
  thresholds
    .filter(threshold => threshold.canonicalDay <= currentDay)
    .filter(threshold => (
      !recoveredItems.includes(threshold.id) && !recoveredItems.includes(threshold.legacyId)
    ))
    .sort((a, b) => a.canonicalDay - b.canonicalDay)
);

const getPrologueRecoveryIds = (
  threshold: PrologueThreshold,
  returnSignal: ReturnSignalReport | null
): string[] => {
  const ids = [threshold.id];

  if (threshold.returnText?.trim()) {
    ids.push(getReturnPacketRecoveryId(threshold.canonicalDay));
  }

  if (
    returnSignal?.reason === 'catchup_return' &&
    threshold.canonicalDay > returnSignal.previousDay &&
    threshold.canonicalDay <= returnSignal.currentDay
  ) {
    ids.push(getCatchupSignalRecoveryId(threshold.canonicalDay));
  }

  return ids;
};

const compressCatchupQueue = (
  pendingQueue: PrologueThreshold[],
  returnSignal: ReturnSignalReport | null
): { visibleQueue: PrologueThreshold[]; autoRecoveryIds: string[] } => {
  if (returnSignal?.reason !== 'catchup_return' || pendingQueue.length <= 1) {
    return { visibleQueue: pendingQueue, autoRecoveryIds: [] };
  }

  // Defer all catch-up recovery of skipped days to the terminal confirmation command.
  const visibleQueue = [pendingQueue[pendingQueue.length - 1]];
  return { visibleQueue, autoRecoveryIds: [] };
};

/**
 * Fixed bottom-left telemetry line. Fades in while a message is present, then
 * fades out when it clears (the message drives visibility). Reduced motion gets
 * a plain opacity fade — transform/opacity only. A single generalized line
 * serves recovery surges, absence returns, and day arrivals; only one shows at
 * a time (last event wins).
 */
const TelemetryLine: React.FC<{ message: string | null }> = ({ message }) => {
  const reducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const visible = message !== null;
  // Keep the last non-null message mounted so it can fade out gracefully.
  const [held, setHeld] = React.useState<string | null>(message);
  React.useEffect(() => {
    if (message !== null) setHeld(message);
  }, [message]);
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed bottom-4 left-4 z-[13000] text-[10px] uppercase tracking-[0.28em] text-emerald-100/80"
      style={{
        opacity: visible ? 1 : 0,
        transform: reducedMotion ? undefined : visible ? 'translateY(0)' : 'translateY(4px)',
        transition: reducedMotion ? 'opacity 500ms ease-out' : 'opacity 700ms ease-out, transform 700ms ease-out',
        textShadow: '0 0 12px rgba(16,185,129,0.35)',
      }}
    >
      {held}
    </div>
  );
};



const LabInterface: React.FC = () => {
  const { score, state, loading, currentDay, nextDayAt, arrivalDayDelta, returnSignal, isAnchored, isGlitching, ensureUser, accessCode, recoveredItems, markRecovered, markRecoveredMany, user, discoverRoom } = useCoherence();
  const { isAdmin, visitorId } = useAuth();
  const observerState = useObserverBreakRoomState(visitorId);
  const navigate = useNavigate();
  const { roomSlug } = useParams<{ roomSlug?: string }>();
  const routeRoom = getRoomFromRoute(roomSlug);
  const [dayData, setDayData] = useState<DayLog | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [isPrologueActive, setIsPrologueActive] = useState(true);
  const [showEntryTransition, setShowEntryTransition] = useState(false);
  // The active room's scene has signaled ready this mount — gates the entry
  // overlay fade so slow asset loads never reveal a half-composed room.
  const [isRoomSceneLive, setIsRoomSceneLive] = useState(false);
  const [entryTransitionMode, setEntryTransitionMode] = useState<'reentry' | 'relink'>('reentry');
  const [prologueQueue, setPrologueQueue] = useState<PrologueThreshold[]>([]);
  const [prologueQueueTotal, setPrologueQueueTotal] = useState(0);
  const [prologueGateDay, setPrologueGateDay] = useState<number | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isTuningOpen, setIsTuningOpen] = useState(false);
  const [resolvedDay, setResolvedDay] = useState<number>(1);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [activeRoom, setActiveRoom] = useState<ActiveRoom>(routeRoom);
  const [isRoomTransitioning, setIsRoomTransitioning] = useState(false);
  const [pendingRoomReadyTarget, setPendingRoomReadyTarget] = useState<ActiveRoom | null>(null);
  const [activePopup, setActivePopup] = useState<ActivePopup | null>(null);
  // Origin Flight (#1): the on-screen box of the hotspot that opened the current
  // popup, so the modal springs out of it and closes back into it. Null for
  // programmatic opens (which keep the centered fade).
  const [popupOriginRect, setPopupOriginRect] = useState<DOMRect | null>(null);
  const [loreContent, setLoreContent] = useState<{ title: string; body: string } | null>(null);
  const [observationVideoSrc, setObservationVideoSrc] = useState<Partial<Record<WillowEvidenceState, string>>>({});
  const [cartMapUrl, setCartMapUrl] = useState<string>('');
  const [dbDays, setDbDays] = useState<DayLog[]>([]);
  // One generalized bottom-left telemetry line, shared by recovery surges,
  // absence returns, and day arrivals. Last event wins; auto-clears after a
  // hold. showTelemetry() re-arms the hold timer.
  const [telemetryMessage, setTelemetryMessage] = useState<string | null>(null);
  const telemetryHideTimerRef = useRef(0);
  const showTelemetry = useCallback((message: string, holdMs = 4000) => {
    setTelemetryMessage(message);
    window.clearTimeout(telemetryHideTimerRef.current);
    telemetryHideTimerRef.current = window.setTimeout(() => setTelemetryMessage(null), holdMs);
  }, []);
  useEffect(() => () => window.clearTimeout(telemetryHideTimerRef.current), []);

  // A recovery surge (day-log recovered) flashes: the room remembers.
  useEffect(() => {
    const unsubscribe = onRecoverySurge(() => {
      showTelemetry('LOG RECOVERED — THE ROOM REMEMBERS');
    });
    return unsubscribe;
  }, [showTelemetry]);

  // A room swap starts a fresh scene: not live until it signals ready again.
  useEffect(() => {
    setIsRoomSceneLive(false);
  }, [activeRoom]);

  // Returning opted-in sessions have no entry overlay, so nothing gesture-bound
  // initializes the audio engine — the first interaction anywhere quietly
  // re-opens the channel (no swell). New/muted visitors are untouched.
  useEffect(() => {
    if (getAudioOptIn() !== '1') return undefined;
    const resume = () => {
      void openAudioChannel({ silent: true });
    };
    window.addEventListener('pointerdown', resume, { once: true });
    return () => window.removeEventListener('pointerdown', resume);
  }, []);

  // D2 — Absence made visible. While in a room, drift the room when the
  // observer looks away or stops interacting; arrest it on return. Only
  // surface the return line if the drift actually lasted long enough to notice.
  useEffect(() => {
    startAbsenceWatcher({
      onDrift: () => {},
      onReturn: (driftMs) => {
        if (driftMs > 30_000) showTelemetry('OBSERVER RETURNED — DRIFT ARRESTED');
      },
    });
    return () => stopAbsenceWatcher();
  }, [showTelemetry]);

  // D4 — Day-transition stinger. A single unified beat for a day arrival,
  // called from the one place the day boundary is observed (the isGlitching
  // rising edge below). All day-advance paths in CoherenceContext funnel
  // through isGlitching, so this covers normal boundaries and catch-up returns.
  const playDayArrival = useCallback((dayDelta: number, dayNumber?: number) => {
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 1. Brief veil-dip (transform/opacity-only fx bus), skipped for reduced
    //    motion — the sound still plays.
    if (!reducedMotion) {
      setRoomFxTarget({ dim: 0.5 });
      window.setTimeout(() => setRoomFxTarget({ dim: 0 }), 1200);
    }

    // 2. Day stinger, scaled by how many days arrived (min 1).
    soundEngine.playDayStinger(Math.max(1, Math.abs(dayDelta || 1)));

    // 3. Telemetry line if we know the day number.
    if (typeof dayNumber === 'number') {
      showTelemetry(`DAY ${dayNumber} — SIGNAL REACQUIRED`);
    }
  }, [showTelemetry]);

  // Fire the day-arrival beat on the isGlitching rising edge (day boundary).
  const prevGlitchingRef = useRef(isGlitching);
  useEffect(() => {
    if (isGlitching && !prevGlitchingRef.current) {
      playDayArrival(arrivalDayDelta, currentDay);
    }
    prevGlitchingRef.current = isGlitching;
  }, [isGlitching, arrivalDayDelta, currentDay, playDayArrival]);

  const handleConfirmReturnSignal = useCallback(async () => {
    if (!returnSignal) return;

    const minDay = returnSignal.reason === 'catchup_return' ? returnSignal.previousDay + 1 : returnSignal.currentDay;
    const maxDay = returnSignal.currentDay;
    const idsToRecover: string[] = [];

    const sortedDays = [...dbDays].sort((a, b) => a.day - b.day);

    for (let d = minDay; d <= maxDay; d++) {
      idsToRecover.push(getPrologueThresholdId(d));
      idsToRecover.push(getReturnPacketRecoveryId(d));
      idsToRecover.push(getCatchupSignalRecoveryId(d));
      idsToRecover.push(getDayNoteRecoveryId(d));
      idsToRecover.push(getDayVmRecoveryId(d));
      idsToRecover.push(getDayEvidenceRecoveryId(d));

      let dayLog = sortedDays.find(day => day.day === d);
      if (!dayLog) {
        dayLog = (localDaysData as unknown as DayLog[]).find(day => day.day === d);
      }
      if (dayLog?.fragments) {
        dayLog.fragments.forEach(frag => {
          idsToRecover.push(`fragment:${frag.id}`);
        });
      }
    }

    if (idsToRecover.length > 0) {
      await markRecoveredMany(idsToRecover);
    }
  }, [returnSignal, dbDays, markRecoveredMany]);

  const missedDaysPackets = useMemo(() => {
    if (!returnSignal) return [];

    const packets: Array<{ day: number; text: string }> = [];
    const minDay = returnSignal.reason === 'catchup_return' ? returnSignal.previousDay + 1 : returnSignal.currentDay;
    const maxDay = returnSignal.currentDay;

    for (let d = minDay; d <= maxDay; d++) {
      const dayLog = dbDays.find(day => day.day === d);
      let text = dayLog?.prologueSentences?.[1];

      if (!text?.trim()) {
        const localPrologue = prologueData.find(item => item.day === d);
        text = localPrologue?.sentences?.[1];
      }

      if (text?.trim()) {
        packets.push({ day: d, text });
      }
    }

    return packets;
  }, [returnSignal, dbDays]);

  interface DBCartographerNote {
    id?: string;
    text: string;
    imageUrl?: string;
    caption?: string;
  }
  interface DBCompassReadout {
    id?: string;
    text: string;
  }

  const [dbCompassReadouts, setDbCompassReadouts] = useState<DBCompassReadout[]>([]);
  const [dbCartographerNotes, setDbCartographerNotes] = useState<DBCartographerNote[]>([]);
  const [tuningResponse, setTuningResponse] = useState<string | null>(null);
  const [isTuningRelay, setIsTuningRelay] = useState<boolean>(false);
  const [tuningError, setTuningError] = useState<string | null>(null);
  const [isCartScanning, setIsCartScanning] = useState<boolean>(false);
  const [cartScanComplete, setCartScanComplete] = useState<boolean>(false);
  const [residueSurge, setResidueSurge] = useState<string | null>(null);

  const handleTuneRelay = async (type: 'inspect' | 'tune' | 'overtune') => {
    setIsTuningRelay(true);
    setTuningResponse(null);
    setTuningError(null);
    try {
      await ensureUser();
      const tuneFn = httpsCallable(functions, 'tuneRelay');
      const res = await tuneFn({ visitorId, tuningType: type });
      const data = res.data as { success: boolean; message: string; milligrams: number };
      setTuningResponse(data.message);
    } catch (err: any) {
      console.error(err);
      setTuningError(err.message || 'The relay coil hums erratically and cancels operation.');
    } finally {
      setIsTuningRelay(false);
    }
  };

  const getDailyCompassReadout = () => {
    if (dbCompassReadouts.length === 0) return "Compass needle spins erratically. Signal uncalibrated.";
    let hash = 0;
    const str = `${visitorId || 'anon'}-${currentDay}`;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    const index = Math.abs(hash) % dbCompassReadouts.length;
    return dbCompassReadouts[index].text;
  };

  const handleStartCartScan = () => {
    setIsCartScanning(true);
    setCartScanComplete(false);
    setTimeout(() => {
      setIsCartScanning(false);
      setCartScanComplete(true);
    }, 2000);
  };

  const DAILY_ANOMALIES = [
    "Phase-shift detected in corridor A-07. Coordinates drift by 1.8m.",
    "Ghost signal at 1.42Hz observed. Source appears to be stationary in the Break Room wall.",
    "Observer attendance recorded twice. System reports negative mass at the workspace.",
    "Room clock reported 42 minutes behind server timestamp. Coherence recovery recommended.",
    "Cartography map data corrupted for Sector 04. Blueprint file integrity verified, but layout shifts.",
    "Carrier wave contains audio fragment: 'Please remain.' origin unknown.",
    "Telemetry sensor reporting zero entropy in Sector 02. Thermals stable, but molecular state is frozen.",
    "Sub-level access hatch detected in scans. Sector 05 door reported a telemetry lock."
  ];

  useEffect(() => {
    let active = true;
    const resolveMapImages = async () => {
      try {
        const mapUrl = await getDownloadURL(ref(storage, 'rooms/cart_room_map.webp'));
        if (active) {
          setCartMapUrl(mapUrl);
        }
      } catch (err) {
        console.error('[Delta-7] Failed to resolve cartography map image from storage:', err);
      }
    };
    resolveMapImages();

    // Listen to Compass Readouts
    const unsubReadouts = onSnapshot(
      query(collection(db, 'system', 'cartography', 'compass_readouts'), orderBy('createdAt', 'desc')),
      (snap) => {
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as DBCompassReadout);
        setDbCompassReadouts(list);
      },
      (err) => console.error('[Delta-7] Compass readouts listener error:', err)
    );

    // Listen to Cartographer Notes
    const unsubNotes = onSnapshot(
      query(collection(db, 'system', 'cartography', 'cartographer_notes'), orderBy('createdAt', 'desc')),
      (snap) => {
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as DBCartographerNote);
        setDbCartographerNotes(list);
      },
      (err) => console.error('[Delta-7] Cartographer notes listener error:', err)
    );

    return () => {
      active = false;
      unsubReadouts();
      unsubNotes();
    };
  }, []);
  const [isObservationVideoReady, setIsObservationVideoReady] = useState(false);
  const [observationVideoError, setObservationVideoError] = useState(false);
  const [roomRestoration, setRoomRestoration] = useState(0.12);
  const [signalNow, setSignalNow] = useState(() => Date.now());
  const [isReturnSignalOpen, setIsReturnSignalOpen] = useState(false);
  const [isHudOpen, setIsHudOpen] = useState(false);
  const [isMemorySafeRoomRuntime, setIsMemorySafeRoomRuntime] = useState(() => shouldUseMemorySafeRoomRuntime());

  // Default the audio-enabled flag from the persisted opt-in so a prior mute/
  // un-mute choice sticks across reloads. Until the entry gesture unlocks the
  // channel, audio stays off (browser autoplay policy blocks it anyway).
  const [isAudioEnabled, setIsAudioEnabled] = useState(() => getAudioOptIn() === '1');
  const { setMuted, setRoomProfile } = useSound();
  const desiredWillowViewportState = getWillowRestorationState(roomRestoration);
  const activeWillowEvidenceState = selectAvailableWillowState(desiredWillowViewportState, observationVideoSrc);
  const activeObservationVideoSrc = observationVideoSrc[activeWillowEvidenceState] || '';
  const activeObservationIsVideo = isVideoSource(activeObservationVideoSrc);
  const hasPreparedPrologueQueueRef = useRef(false);
  const lastReturnSignalKeyRef = useRef<string | null>(null);
  const hasEnteredRoomRef = useRef(false);
  const roomSwapTimerRef = useRef<number | null>(null);
  const roomTransitionTimerRef = useRef<number | null>(null);
  const roomTransitionIdRef = useRef(0);
  const roomTransitionStartedAtRef = useRef(0);
  const activePrologue = prologueQueue[0] || null;
  const activePrologueIndex = activePrologue ? Math.max(1, prologueQueueTotal - prologueQueue.length + 1) : 0;
  const activePrologueEyebrow = activePrologue
    ? prologueQueueTotal > 1
      ? `Recovered signal ${activePrologueIndex} of ${prologueQueueTotal} // Day ${String(activePrologue.canonicalDay).padStart(3, '0')}`
      : `Signal threshold // Day ${String(activePrologue.canonicalDay).padStart(3, '0')}`
    : '';
  const dailyRecovery = useMemo(
    () => buildDailyRecoveryState(dayData, recoveredItems),
    [dayData, recoveredItems]
  );
  const vmLogRecoveryCount = useMemo(
    () => countRecoveredVmLogs(recoveredItems),
    [recoveredItems]
  );
  const hasSignalRoomAccess = isAdmin || vmLogRecoveryCount >= REQUIRED_SIGNAL_ROOM_VM_LOGS;
  const hasNextRoomAccess = isAdmin || vmLogRecoveryCount >= REQUIRED_NEXT_ROOM_VM_LOGS;
  const hotspotStates = useMemo<Partial<Record<string, RoomHotspotStatus>>>(() => {
    if (!dayData) return {};

    const isRoomCorrupted = score < 35;
    const getStatus = (baseStatus: RoomHotspotStatus): RoomHotspotStatus => {
      if (isRoomCorrupted && baseStatus !== 'used' && baseStatus !== 'locked') {
        return 'corrupted';
      }
      return baseStatus;
    };

    return {
      'main-monitor': getStatus(dailyRecovery.hasVmLog && dailyRecovery.recoveredFragments >= dailyRecovery.totalFragments ? 'used' : 'new'),
      'desk-drawer': getStatus(dailyRecovery.hasNote ? 'used' : 'new'),
      'observation-window': getStatus(dailyRecovery.hasEvidence ? 'used' : 'new'),
      'prologue-viewer': getStatus(dailyRecovery.hasEntryPrologue && (!dailyRecovery.hasReturnPacketContent || dailyRecovery.hasReturnPacket) ? 'used' : 'new'),
      'room-signal-door': hasSignalRoomAccess ? getStatus('available') : 'locked',
      'break-tv': getStatus(dailyRecovery.hasEvidence ? 'used' : 'new'),
      'break-door-right': hasNextRoomAccess ? getStatus('available') : 'locked',
      'break-coffee-mug': getStatus(observerState.lastCoffeeSignalDay === currentDay ? 'used' : 'available'),
      'break-refrigerator': getStatus(observerState.lastFridgeSignalDay === currentDay ? 'used' : 'available'),
    };
  }, [dailyRecovery, dayData, hasNextRoomAccess, hasSignalRoomAccess, observerState, currentDay, score]);
  const handleHotspotAction = useCallback((hotspot: RoomHotspotDefinition, originRect?: DOMRect) => {
    // Origin Flight (#1): stash the clicked hotspot's box so RoomModal can spring
    // out of it. Cleared on close. The monitor terminal and dead-zone swallow run
    // their own transitions, so we only set it for RoomModal-backed opens.
    setPopupOriginRect(originRect ?? null);
    switch (hotspot.actionId) {
      case 'monitor':
        void markRecovered(`vm:${resolvedDay}`);
        setIsTerminalOpen(true);
        return;
      case 'drawer':
        void markRecovered(getDayNoteRecoveryId(resolvedDay));
        setActivePopup('drawer');
        return;
      case 'window':
        void markRecovered('evidence:willow');
        void markRecovered(`evidence:day:${resolvedDay}:willow`);
        setActivePopup('window');
        return;
      case 'lore':
        setLoreContent(hotspot.lore ?? { title: hotspot.label.replace(/_/g, ' '), body: 'Signal recovered. No transcript attached.' });
        setActivePopup('lore');
        return;
      case 'cart-dead-zones': {
        // The dead-zone swallow (D3): first-ever open triggers a ~2s scripted
        // void takeover, THEN opens the panel. One-shot per observer forever.
        // Any later open (already recovered) is an unchanged immediate open.
        if (recoveredItems.includes(DEAD_ZONE_SWALLOW_ID)) {
          setActivePopup('cart-dead-zones');
          return;
        }
        const openDeadZones = () => {
          setActivePopup('cart-dead-zones');
          showTelemetry('SECTOR 03 DECLINED TO BE DRAWN');
        };
        void markRecovered(DEAD_ZONE_SWALLOW_ID);
        try {
          runDeadZoneSwallow(openDeadZones);
        } catch {
          // Never block the panel: if the swallow throws, open directly.
          openDeadZones();
        }
        return;
      }
      default:
        if (VALID_POPUP_IDS.has(hotspot.actionId as ActivePopup)) {
          setActivePopup(hotspot.actionId as ActivePopup);
        } else if (import.meta.env.DEV) {
          console.warn('[Delta-7] Unknown hotspot action:', hotspot.actionId);
        }
    }
  }, [markRecovered, resolvedDay, recoveredItems, showTelemetry]);

  const returnSignalKey = returnSignal
    ? `${returnSignal.reason}:${returnSignal.previousDay}:${returnSignal.currentDay}:${returnSignal.dayDelta}:${Math.round(returnSignal.absenceMs / 60000)}:${returnSignal.coherenceDelta.toFixed(1)}`
    : null;
  const isPrologueGateReady = prologueGateDay === currentDay;

  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pointerQuery = window.matchMedia('(pointer: coarse)');
    const updateRuntime = () => setIsMemorySafeRoomRuntime(shouldUseMemorySafeRoomRuntime());

    motionQuery.addEventListener('change', updateRuntime);
    pointerQuery.addEventListener('change', updateRuntime);
    window.addEventListener('resize', updateRuntime);
    updateRuntime();

    return () => {
      motionQuery.removeEventListener('change', updateRuntime);
      pointerQuery.removeEventListener('change', updateRuntime);
      window.removeEventListener('resize', updateRuntime);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    // Legacy value is '1'; current value is a small JSON payload the
    // index.html boot veil also reads. Either way the flag means a mobile
    // room-navigation reload just landed.
    if (window.sessionStorage.getItem(MOBILE_ROOM_NAVIGATION_KEY) === null) return undefined;

    window.sessionStorage.removeItem(MOBILE_ROOM_NAVIGATION_KEY);
    setIsRoomTransitioning(true);
    setEntryTransitionMode('relink');
    setShowEntryTransition(true);

    const timer = window.setTimeout(() => setIsRoomTransitioning(false), ROOM_TRANSITION_MIN_MS);
    return () => window.clearTimeout(timer);
  }, []);

  // If the relink reload lands on a prologue day, the prologue surface
  // replaces the entry overlay — clear the boot veil once it has painted.
  useEffect(() => {
    if (isPrologueActive && isPrologueGateReady) {
      document.getElementById('d7-relink-veil')?.remove();
    }
  }, [isPrologueActive, isPrologueGateReady]);

  useEffect(() => {
    let nextRoom = routeRoom;

    if (routeRoom === 'signal-cartography' && !hasNextRoomAccess) {
      nextRoom = hasSignalRoomAccess ? 'break-room' : 'lab';
    } else if (routeRoom === 'break-room' && !hasSignalRoomAccess) {
      nextRoom = 'lab';
    }

    if (nextRoom !== routeRoom) {
      navigate(getRoomPath(nextRoom), { replace: true });
    }

    setActiveRoom(nextRoom);
  }, [hasNextRoomAccess, hasSignalRoomAccess, navigate, routeRoom]);

  // Layer the room ambience profile over the breath drone as the active room
  // changes ('lab' scene id is the observation cell). Teardown on unmount.
  useEffect(() => {
    const profile = activeRoom === 'lab' ? 'observation' : activeRoom;
    setRoomProfile(profile);
    return () => setRoomProfile(null);
  }, [activeRoom, setRoomProfile]);

  // Storm director: ambient lightning + thunder while coherence is degraded.
  // The director reads coherence through a ref-backed getter so it isn't
  // restarted on every state change (only mounts/unmounts with the room).
  const coherenceStateRef = useRef(state);
  coherenceStateRef.current = state;
  useEffect(() => {
    startStormDirector(() => coherenceStateRef.current);
    return () => stopStormDirector();
  }, []);

  useEffect(() => {
    if (isMemorySafeRoomRuntime) return;

    if (activeRoom === 'lab' && hasSignalRoomAccess) {
      void preloadRoomSceneAssets('break-room');
      return;
    }

    if (activeRoom === 'break-room' && hasNextRoomAccess) {
      void preloadRoomSceneAssets('signal-cartography');
    }
  }, [activeRoom, hasNextRoomAccess, hasSignalRoomAccess, isMemorySafeRoomRuntime]);

  useEffect(() => {
    hasPreparedPrologueQueueRef.current = false;
    const timer = window.setTimeout(() => {
      setPrologueQueue([]);
      setPrologueQueueTotal(0);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [currentDay]);

  useEffect(() => {
    const syncTimer = window.setTimeout(() => setSignalNow(Date.now()), 0);
    if (!nextDayAt) return () => window.clearTimeout(syncTimer);

    const timer = window.setInterval(() => setSignalNow(Date.now()), 1000);
    return () => {
      window.clearTimeout(syncTimer);
      window.clearInterval(timer);
    };
  }, [nextDayAt]);

  useEffect(() => {
    if (!isPrologueGateReady || isPrologueActive) return;

    let cancelled = false;

    const resolveObservationVideo = async () => {
      setObservationVideoError(false);
      setIsObservationVideoReady(false);

      const resolved: Partial<Record<WillowEvidenceState, string>> = {};

      await Promise.all((Object.entries(WILLOW_VIDEO_VARIANTS) as Array<[WillowEvidenceState, string]>).map(async ([variant, path]) => {
        const storagePath = toStoragePath(path);
        if (storagePath === null) {
          resolved[variant] = path;
          return;
        }

        try {
          resolved[variant] = await getDownloadURL(ref(storage, storagePath));
        } catch (error) {
          if (import.meta.env.DEV) console.warn(`[Delta-7] ${variant} willow evidence failed to resolve:`, error);
        }
      }));

      if (!cancelled) {
        setObservationVideoSrc(resolved);
        setObservationVideoError(!resolved.night && !resolved.day && !resolved.storm);
      }
    };

    void resolveObservationVideo();

    return () => {
      cancelled = true;
    };
  }, [isPrologueActive, isPrologueGateReady]);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsObservationVideoReady(false), 0);
    return () => window.clearTimeout(timer);
  }, [activeWillowEvidenceState, activeObservationVideoSrc]);

  useEffect(() => {
    const timer = window.setTimeout(() => setRoomRestoration(0.12), 0);
    return () => window.clearTimeout(timer);
  }, [resolvedDay]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setRoomRestoration(prev => Math.max(prev, 0.12 + dailyRecovery.restorationWeight * 0.56));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [dailyRecovery.restorationWeight, resolvedDay]);

  useEffect(() => {
    let timer: number | null = null;

    if (!returnSignalKey) {
      timer = window.setTimeout(() => setIsReturnSignalOpen(false), 0);
      return () => {
        if (timer) window.clearTimeout(timer);
      };
    }

    if (lastReturnSignalKeyRef.current === returnSignalKey) {
      return undefined;
    }

    lastReturnSignalKeyRef.current = returnSignalKey;
    timer = window.setTimeout(() => setIsReturnSignalOpen(true), 0);
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [returnSignalKey]);

  // Arm Kael's return greeting off the same signal: after a real absence, the
  // first modal opened on return leads with a line written to the gap. The
  // greeting module gates on its own threshold and dedupes on returnSignalKey.
  useEffect(() => {
    if (!returnSignal || !returnSignalKey) return;
    armReturnGreeting(returnSignal.absenceMs, returnSignalKey);
  }, [returnSignal, returnSignalKey]);

  // The resolved modal variant (door/index shells collapse to cart-room-index,
  // mirroring the RoomModal `variant` prop below) and its read-trace state.
  const resolvedPopupVariant = activePopup
    ? (activePopup === 'return-door' || activePopup === 'next-room-door' || activePopup === 'room-signal'
        ? 'cart-room-index'
        : activePopup)
    : null;
  // Frozen at open: the marking effect below updates recoveredItems while the
  // panel is up, and the fold must not ink in mid-read — it appears next visit.
  const popupReadTrace = useMemo<'unread' | 'paper' | 'instrument'>(
    () => resolvedPopupVariant && recoveredItems.includes(`read:${resolvedPopupVariant}`)
      ? readTraceKindForVariant(resolvedPopupVariant)
      : 'unread',
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resolvedPopupVariant]
  );

  // Dog-ear persistence: first open of a papery/instrument panel leaves a
  // permanent physical trace. Marked one frame after open so the fresh panel
  // shows clean, then carries the fold on every subsequent visit.
  useEffect(() => {
    if (!resolvedPopupVariant) return;
    if (readTraceKindForVariant(resolvedPopupVariant) === 'unread') return;
    const id = `read:${resolvedPopupVariant}`;
    if (recoveredItems.includes(id)) return;
    void markRecovered(id);
  }, [resolvedPopupVariant, recoveredItems, markRecovered]);

  // Room-remembers (#2b): the *room* carries a lasting warmth once panels have
  // been opened — as if lights were left on / a drawer left ajar. Driven purely
  // off the persisted read:* traces (no new storage), so it survives reloads.
  // The count of opened artifacts eases a faint persistent lamp-lift into the
  // depth shader; per-hotspot glow is placed in the room plane (see
  // openedHotspotIds → LabObserverRoom). Kept subtle — inhabited, not a trophy.
  const openedTraceCount = useMemo(
    () => recoveredItems.filter(item => item.startsWith('read:')).length,
    [recoveredItems]
  );
  useEffect(() => {
    // Saturates around ~5 opened panels; a room that's been fully explored
    // reads clearly inhabited without ever looking lit-up.
    setDisturbed(Math.min(0.55, openedTraceCount * 0.13));
  }, [openedTraceCount]);

  // Opened-artifact action ids (== the read:{variant} suffix, which is the
  // hotspot actionId). Passed to the room so it can place a faint lasting glow
  // at each opened hotspot's exact position — the drawer left ajar, the lamp
  // left on. Positions live with the hotspots in the room plane, so the glow
  // tracks pan/zoom/tilt for free.
  const openedHotspotActionIds = useMemo(() => {
    const opened = new Set<string>();
    for (const item of recoveredItems) {
      if (item.startsWith('read:')) opened.add(item.slice('read:'.length));
    }
    return opened;
  }, [recoveredItems]);

  // Variable Signal (#6): the day's 1–2 "hot" hotspots for the current room,
  // seeded per day+observer. Diegetic tell only — the floor guarantee (every
  // panel always carries marginalia) means no open is ever a blank.
  const featuredHotspotActionIds = useMemo(
    () => selectFeaturedActionIds(getRoomSceneId(activeRoom), currentDay, visitorId),
    [activeRoom, currentDay, visitorId]
  );

  useEffect(() => {
    if (isPrologueActive || dataLoading) return;

    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        setRoomRestoration(prev => Math.min(1, prev + 1 / 240));
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isPrologueActive, dataLoading, resolvedDay]);

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    const resolveDay = async () => {
      try {
        const dayRef = doc(db, 'season1_days', `day_${currentDay}`);
        const dayDoc = await getDoc(dayRef);
        if (cancelled) return;
        if (dayDoc.exists()) {
          setResolvedDay(currentDay);
          return;
        }
        const latestQuery = query(collection(db, 'season1_days'), orderBy('day', 'desc'), limit(1));
        const latestSnap = await getDocs(latestQuery);
        if (!latestSnap.empty) {
          const latestDay = (latestSnap.docs[0].data() as DayLog).day;
          setResolvedDay(latestDay || 1);
        } else {
          setResolvedDay(1);
        }
      } catch (error) {
        if (import.meta.env.DEV) console.warn('Day resolution failed:', error);
        setResolvedDay(1);
      }
    };
    resolveDay();
    return () => {
      cancelled = true;
    };
  }, [currentDay, loading]);

  useEffect(() => {
    if (loading) return;
    if (hasPreparedPrologueQueueRef.current) {
      return;
    }

    let cancelled = false;

    const fetchPrologueThreshold = async () => {
      try {
        const daysQuery = query(collection(db, 'season1_days'), orderBy('day', 'asc'));
        const snap = await getDocs(daysQuery);
        if (cancelled) return;

        const dayLogs = snap.docs.map(doc => doc.data() as DayLog);
        setDbDays(dayLogs);

        const firestoreThresholds = buildPrologueThresholdsFromDays(dayLogs);
        const localThresholds = buildPrologueThresholdsFromLocalData(prologueData);
        const thresholds = firestoreThresholds.length > 0 ? firestoreThresholds : localThresholds;
        const pendingQueue = selectPendingPrologueQueue(thresholds, recoveredItems, currentDay);
        const { visibleQueue, autoRecoveryIds } = compressCatchupQueue(pendingQueue, returnSignal);

        hasPreparedPrologueQueueRef.current = true;

        if (autoRecoveryIds.length > 0) {
          await markRecoveredMany(autoRecoveryIds);
          if (cancelled) return;
        }

        setPrologueQueue(visibleQueue);
        setPrologueQueueTotal(visibleQueue.length);

        if (visibleQueue.length > 0) {
          setIsPrologueActive(true);
        } else {
          // No prologue this session: play the lighter re-entry beat instead
          // of hard-cutting from black to the room.
          setIsPrologueActive(false);
          setShowEntryTransition(true);
        }
        setPrologueGateDay(currentDay);
      } catch (error) {
        if (import.meta.env.DEV) console.warn('Falling back to local prologue data:', error);

        if (cancelled) return;

        setDbDays(localDaysData as unknown as DayLog[]);

        const thresholds = buildPrologueThresholdsFromLocalData(prologueData);
        const pendingQueue = selectPendingPrologueQueue(thresholds, recoveredItems, currentDay);
        const { visibleQueue, autoRecoveryIds } = compressCatchupQueue(pendingQueue, returnSignal);

        hasPreparedPrologueQueueRef.current = true;

        if (autoRecoveryIds.length > 0) {
          await markRecoveredMany(autoRecoveryIds);
          if (cancelled) return;
        }

        setPrologueQueue(visibleQueue);
        setPrologueQueueTotal(visibleQueue.length);

        if (visibleQueue.length > 0) {
          setIsPrologueActive(true);
        } else {
          // No prologue this session: play the lighter re-entry beat instead
          // of hard-cutting from black to the room.
          setIsPrologueActive(false);
          setShowEntryTransition(true);
        }
        setPrologueGateDay(currentDay);
      }
    };

    void fetchPrologueThreshold();

    return () => {
      cancelled = true;
    };
  }, [loading, recoveredItems, currentDay, markRecoveredMany, returnSignal]);

  useEffect(() => {
    if (isPrologueActive) return;

    let didResolve = false;
    const loadingTimer = window.setTimeout(() => {
      if (!didResolve) setDataLoading(true);
    }, 0);
    const dayId = `day_${resolvedDay}`;
    const dayRef = doc(db, 'season1_days', dayId);

    const unsubscribe = onSnapshot(dayRef, (doc) => {
      didResolve = true;
      window.clearTimeout(loadingTimer);
      if (doc.exists()) {
        const data = doc.data() as DayLog;
        setDayData(data);
      } else {
        setDayData(null);
      }
      setDataLoading(false);
    }, (error) => {
      didResolve = true;
      window.clearTimeout(loadingTimer);
      if (import.meta.env.DEV) console.error('Error listening to day data:', error);
      setDataLoading(false);
    });

    return () => {
      window.clearTimeout(loadingTimer);
      unsubscribe();
    };
  }, [resolvedDay, isPrologueActive]);

  useEffect(() => {
    if (isPrologueActive) return;
    if (!hasEnteredRoomRef.current) {
      hasEnteredRoomRef.current = true;
      return;
    }

    const interface_el = document.querySelector('.scanlines');
    if (interface_el) {
      interface_el.classList.add('glitch-intense');
      setTimeout(() => interface_el.classList.remove('glitch-intense'), 1000);
    }
  }, [state, resolvedDay, isPrologueActive]);

  const handlePrologueComplete = useCallback(async () => {
    // The prologue advance click may have opened the audio channel — sync the HUD.
    setIsAudioEnabled(getAudioOptIn() === '1');
    if (!activePrologue) {
      setIsPrologueActive(false);
      return;
    }

    try {
      await ensureUser();
      await markRecoveredMany(getPrologueRecoveryIds(activePrologue, returnSignal));
    } catch (err) {
      if (import.meta.env.DEV) console.error('[Delta-7] Feed induction failure:', err);
    }

    const remainingQueue = prologueQueue.slice(1);
    setPrologueQueue(remainingQueue);

    if (remainingQueue.length > 0) {
      setIsPrologueActive(true);
    } else {
      setIsPrologueActive(false);
    }
  }, [activePrologue, ensureUser, markRecoveredMany, prologueQueue, returnSignal]);

  const handleTerminalClose = () => {
    setIsTerminalOpen(false);
    setIsZoomed(false);
  };

  const clearRoomTransitionTimers = useCallback(() => {
    if (roomSwapTimerRef.current) {
      window.clearTimeout(roomSwapTimerRef.current);
      roomSwapTimerRef.current = null;
    }

    if (roomTransitionTimerRef.current) {
      window.clearTimeout(roomTransitionTimerRef.current);
      roomTransitionTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearRoomTransitionTimers, [clearRoomTransitionTimers]);

  const finishRoomTransition = useCallback((transitionId: number) => {
    if (transitionId !== roomTransitionIdRef.current) return;

    if (roomTransitionTimerRef.current) {
      window.clearTimeout(roomTransitionTimerRef.current);
      roomTransitionTimerRef.current = null;
    }

    setIsRoomTransitioning(false);
    setPendingRoomReadyTarget(null);
  }, []);

  const scheduleRoomTransitionFinish = useCallback((transitionId: number, delay: number) => {
    if (roomTransitionTimerRef.current) {
      window.clearTimeout(roomTransitionTimerRef.current);
    }

    roomTransitionTimerRef.current = window.setTimeout(() => {
      roomTransitionTimerRef.current = null;
      finishRoomTransition(transitionId);
    }, delay);
  }, [finishRoomTransition]);

  const transitionToRoom = useCallback((nextRoom: ActiveRoom) => {
    if (activeRoom === nextRoom || isRoomTransitioning) return;

    const transitionId = roomTransitionIdRef.current + 1;
    const sceneId = getRoomSceneId(nextRoom);

    roomTransitionIdRef.current = transitionId;
    roomTransitionStartedAtRef.current = Date.now();
    clearRoomTransitionTimers();
    setActivePopup(null);
    setIsReturnSignalOpen(false);
    setIsTerminalOpen(false);
    setIsZoomed(false);
    setIsRoomTransitioning(true);
    setPendingRoomReadyTarget(nextRoom);

    if (!isMemorySafeRoomRuntime) {
      const scenePreload = preloadRoomSceneAssets(sceneId).catch((err) => {
        if (import.meta.env.DEV) console.warn('[Delta-7] Room preload failed:', err);
      });
      void scenePreload;
    }

    roomSwapTimerRef.current = window.setTimeout(() => {
      roomSwapTimerRef.current = null;

      if (transitionId !== roomTransitionIdRef.current) return;

      // Memory-safe runtime (mobile) normally reloads the page to force the OS
      // to release accumulated WebGL/video decoder memory. When the remote
      // `mobileSpaRooms` kill-switch is enabled, DepthRoomCanvas now disposes GL
      // + video resources on unmount, so we can do a true SPA swap instead.
      if (isMemorySafeRoomRuntime && !getSystemFlag('mobileSpaRooms')) {
        window.sessionStorage.setItem(MOBILE_ROOM_NAVIGATION_KEY, JSON.stringify({
          v: 1,
          from: getRoomDisplayName(activeRoom),
          to: getRoomDisplayName(nextRoom),
        }));
        window.location.replace(getRoomPath(nextRoom));
        return;
      }

      setActiveRoom(nextRoom);
      navigate(getRoomPath(nextRoom));
    }, ROOM_TRANSITION_SWAP_MS);

    // Securely check and reward room discovery residue
    void (async () => {
      try {
        const res = await discoverRoom(nextRoom);
        if (res && res.success && res.awarded > 0) {
          setResidueSurge(`+${res.awarded.toFixed(2)} mg RESIDUE SURGE DETECTED // SECTOR ${nextRoom.replace('-', ' ').toUpperCase()} confirmed`);
          setTimeout(() => setResidueSurge(null), 5000);
        }
      } catch (err) {
        console.warn('Room discovery trace failed:', err);
      }
    })();

    scheduleRoomTransitionFinish(transitionId, ROOM_TRANSITION_MAX_MS);
  }, [activeRoom, clearRoomTransitionTimers, isMemorySafeRoomRuntime, isRoomTransitioning, navigate, scheduleRoomTransitionFinish, discoverRoom]);

  const handleRoomSceneReady = useCallback((readyRoom: ActiveRoom) => {
    if (!isRoomTransitioning || pendingRoomReadyTarget !== readyRoom) return;

    const elapsed = Date.now() - roomTransitionStartedAtRef.current;
    scheduleRoomTransitionFinish(
      roomTransitionIdRef.current,
      Math.max(0, ROOM_TRANSITION_MIN_MS - elapsed)
    );
  }, [isRoomTransitioning, pendingRoomReadyTarget, scheduleRoomTransitionFinish]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-lab-black text-signal-green font-mono">
        {/* Silent loading to prioritize Prologue */}
      </div>
    );
  }

  if (!isPrologueGateReady) {
    return <div className="h-screen w-screen bg-lab-black" aria-hidden="true" />;
  }

  if (isPrologueActive && activePrologue) {
    return (
      <Prologue
        key={activePrologue.id}
        sentence={activePrologue.text}
        eyebrow={activePrologueEyebrow}
        actionLabel={prologueQueue.length > 1 ? 'Continue Signal' : 'Enter Room'}
        coherence={score}
        onComplete={handlePrologueComplete}
      />
    );
  }

  const isSignalCartographyRoom = activeRoom === 'signal-cartography';
  const suppressAmbientEffects = isSignalCartographyRoom || isMemorySafeRoomRuntime;
  const glitchClass = !suppressAmbientEffects && score < 20 ? 'glitch-heavy' : !suppressAmbientEffects && score < 70 ? 'glitch-subtle' : '';
  const scanlineClass = !suppressAmbientEffects && score < 50 ? 'scanlines-active' : '';

  return (
    <>
      <TelemetryLine message={telemetryMessage} />
      {/* Atmosphere Control System (Theme, Particles, Blackout) */}
      <AtmosphereManager
        coherence={score}
        roomRestoration={roomRestoration}
        suspendParticles={suppressAmbientEffects}
      />

      <div
        className={`relative w-screen h-screen bg-lab-black text-signal-green font-mono scanlines transition-colors duration-1000 overflow-hidden ${glitchClass} ${scanlineClass}`}
      >
        <div className="fixed inset-0 z-0 pointer-events-none" />
        {!suppressAmbientEffects && <BackgroundAtmosphere score={score} />}

        {!suppressAmbientEffects && <ScreenEffects flickerLevel={0} driftLevel={1} />}
        <GlitchOverlay
          coherence={score}
          isGlitching={!suppressAmbientEffects && isGlitching}
          ambientDisabled={suppressAmbientEffects}
        />

        <button
          type="button"
          aria-expanded={isHudOpen}
          aria-label={isHudOpen ? 'Collapse status display' : 'Expand status display'}
          onClick={() => setIsHudOpen(prev => !prev)}
          className={`fixed left-3 top-0 z-[90] w-[calc(100vw-1.5rem)] max-w-sm border border-[#f2ead0]/14 bg-black/52 text-left text-[#f7f1dc] shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-sm transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-[#f2ead0]/24 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-100/55 sm:left-5 ${
            isHudOpen ? 'translate-y-3 sm:translate-y-5' : '-translate-y-[calc(100%-2rem)]'
          }`}
        >
          <div className="px-3 pb-3 pt-3">
            <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.18em] text-emerald-100/70">
              <span>DAY {String(currentDay).padStart(3, '0')}</span>
              <span>{state}</span>
            </div>
            <div className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#fff7df]">
              {getReturnSignalLabel(arrivalDayDelta, currentDay)}
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.16em] text-[#f7f1dc]/58">
              <span>Next signal</span>
              <span className="text-[#f7f1dc]/82">{formatSignalCountdown(nextDayAt, signalNow)}</span>
            </div>
          </div>
          <div className="flex h-8 items-center justify-center border-t border-[#f2ead0]/10 bg-black/28 text-emerald-100/72">
            <ChevronDown
              size={16}
              aria-hidden="true"
              className={`transition-transform duration-500 ${isHudOpen ? 'rotate-180' : ''}`}
            />
          </div>
        </button>

        {dataLoading ? (
          <div className="h-screen w-screen bg-black" aria-hidden="true" />
        ) : (
          <div className={`room-stage ${activePopup !== null ? 'room-recede' : ''}`}>
            <LabObserverRoom
              key={activeRoom}
              roomId={getRoomSceneId(activeRoom)}
              onHotspotAction={handleHotspotAction}
              isZoomed={isZoomed}
              roomRestoration={roomRestoration}
              willowVideoSources={observationVideoSrc}
              hotspotStates={hotspotStates}
              openedHotspotActionIds={openedHotspotActionIds}
              featuredHotspotActionIds={featuredHotspotActionIds}
              onSceneReady={() => {
                setIsRoomSceneLive(true);
                handleRoomSceneReady(activeRoom);
              }}
            />
          </div>
        )}

        {showEntryTransition && (
          <RoomEntryTransition
            currentDay={currentDay}
            state={state}
            score={score}
            absenceMs={returnSignal?.absenceMs}
            dayDelta={returnSignal?.dayDelta}
            mode={entryTransitionMode}
            sceneReady={isRoomSceneLive}
            onComplete={() => {
              setShowEntryTransition(false);
              // The entry click may have opened the audio channel — sync the HUD.
              setIsAudioEnabled(getAudioOptIn() === '1');
            }}
          />
        )}

        {isReturnSignalOpen && returnSignal && !isPrologueActive && !showEntryTransition && !dataLoading && !activePopup && !isTerminalOpen && (
          <ReturnSignalPanel
            report={returnSignal}
            packetCount={missedDaysPackets.length}
            onClose={() => {
              setIsReturnSignalOpen(false);
              setIsTerminalOpen(true);
            }}
          />
        )}

        {activePopup && (
          <RoomModal
            title={
              activePopup === 'lore' ? (loreContent?.title ?? 'Recovered Signal') :
                activePopup === 'prologue' ? 'Prologue Viewer' :
                activePopup === 'archive' ? 'Archive Shelf' :
                  activePopup === 'support' ? 'Continuity Relay' :
                    activePopup === 'room-signal' || activePopup === 'return-door' || activePopup === 'next-room-door' || activePopup === 'cart-room-index' ? 'Room Index' :
                      activePopup === 'break-clock' ? 'Room Clock' :
                        activePopup === 'break-bulletin' ? 'Project Bulletin' :
                          activePopup === 'break-coffee' ? 'Coffee Station' :
                            activePopup === 'break-fridge' ? 'Refrigerator' :
                              activePopup === 'window' ? 'Willow Evidence' :
                                activePopup === 'drawer' ? 'Clipboard Archive' :
                                  activePopup === 'blackboard' ? 'Coherence Engine' :
                                    activePopup === 'cart-map' ? 'Facility Map' :
                                      activePopup === 'cart-compass' ? 'Signal Compass' :
                                        activePopup === 'cart-dead-zones' ? 'Dead Zones' :
                                          activePopup === 'cart-route-trace' ? 'Route Trace' :
                                            activePopup === 'cart-relay-tuning' ? 'Relay Tuning' :
                                              activePopup === 'cart-notes' ? 'Cartographer Notes' :
                                                activePopup === 'cart-unmarked-door' ? 'Unnamed Access' :
                                                  activePopup === 'cart-sector-scan' ? 'Sector Scan' :
                                                    'Security Box'
            }
            eyebrow={activeRoom === 'break-room' ? 'Break Room' : activeRoom === 'signal-cartography' ? 'Signal Cartography' : 'Observation Cell'}
            maxWidth={activePopup === 'archive' || activePopup === 'prologue' || activePopup === 'break-bulletin' || activePopup === 'break-fridge' || activePopup === 'cart-map' ? 'max-w-4xl' : activePopup === 'security' || activePopup === 'cart-notes' ? 'max-w-3xl' : activePopup === 'break-clock' || activePopup === 'break-coffee' || activePopup === 'cart-compass' || activePopup === 'cart-dead-zones' || activePopup === 'cart-relay-tuning' || activePopup === 'cart-route-trace' || activePopup === 'cart-unmarked-door' || activePopup === 'cart-sector-scan' ? 'max-w-xl' : 'max-w-2xl'}
            variant={activePopup === 'return-door' || activePopup === 'next-room-door' || activePopup === 'room-signal' ? 'cart-room-index' : activePopup}
            marginaliaDay={currentDay}
            readTrace={popupReadTrace}
            originRect={popupOriginRect}
            onClose={() => {
              setActivePopup(null);
              setPopupOriginRect(null);
            }}
          >
            <>
              {activePopup === 'lore' && (
                <div className="space-y-4 text-sm leading-relaxed text-[#d8d2bd]/80 whitespace-pre-wrap font-mono">
                  {loreContent?.body}
                </div>
              )}
              {activePopup === 'blackboard' && (
                <div className="space-y-5 text-sm text-[#d8d2bd]/74">
                  <style>{`
                    @keyframes blackboard-gauge-in {
                      from { transform: scaleX(0); }
                      to { transform: scaleX(1); }
                    }
                    .blackboard-gauge {
                      transform-origin: left center;
                      animation: blackboard-gauge-in 1100ms cubic-bezier(0.22, 1, 0.36, 1) both;
                    }
                    @media (prefers-reduced-motion: reduce) {
                      .blackboard-gauge { animation-duration: 1ms; }
                    }
                  `}</style>

                  <div className="space-y-4">
                    <div>
                      <div className="flex items-baseline justify-between">
                        <span className="text-[10px] uppercase tracking-[0.2em] text-emerald-100/55">Coherence</span>
                        <span className="text-xl font-semibold text-[#fff7df]">
                          <AnimatedCounter value={score} duration={1200} suffix="%" />
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full bg-white/8">
                        <div
                          className="blackboard-gauge h-full bg-gradient-to-r from-emerald-300/70 to-emerald-100/80"
                          style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-baseline justify-between">
                        <span className="text-[10px] uppercase tracking-[0.2em] text-emerald-100/55">Room restoration</span>
                        <span className="text-xl font-semibold text-[#fff7df]">
                          <AnimatedCounter value={roomRestoration * 100} decimals={0} duration={1200} suffix="%" />
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full bg-white/8">
                        <div
                          className="blackboard-gauge h-full bg-gradient-to-r from-cyan-300/55 to-emerald-100/70"
                          style={{ width: `${Math.max(0, Math.min(100, roomRestoration * 100))}%`, animationDelay: '140ms' }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between border border-[#f2ead0]/12 bg-black/24 px-3 py-2">
                      <span className="text-[10px] uppercase tracking-[0.2em] text-emerald-100/55">Signal state</span>
                      <span className="text-sm font-semibold uppercase tracking-[0.12em] text-[#f2ead0]">{state}</span>
                    </div>
                    <div className="flex items-center justify-between border border-[#f2ead0]/12 bg-black/24 px-3 py-2">
                      <span className="text-[10px] uppercase tracking-[0.2em] text-emerald-100/55">Next signal</span>
                      <span className="text-sm font-semibold tracking-[0.12em] text-[#f2ead0]">{formatSignalCountdown(nextDayAt, signalNow)}</span>
                    </div>
                  </div>

                  <div className="border-t border-white/10 pt-4 space-y-2 text-xs text-[#d8d2bd]/58">
                    <div className="uppercase tracking-[0.2em] text-emerald-100/55">Telemetry Variables</div>
                    <div className="animate-flicker-subtle">FLICKER RATING: {((dayData?.variables?.flicker ?? 1) * (100 - score) / 100).toFixed(1)} ms</div>
                    <div>DRIFT MULTIPLIER: {(dayData?.variables?.drift ?? 1).toFixed(1)}x</div>
                    <div>COGNITIVE COHERENCE: {dayData?.variables?.kaelCoherence ?? 'UNKNOWN'}%</div>
                    {dayData?.variables?.kaelMood && <div>KAEL MOOD SIGNAL: <span className="italic text-[#f2ead0]/75">"{dayData.variables.kaelMood}"</span></div>}
                  </div>
                </div>
              )}

              {activePopup === 'drawer' && (
                <div className="space-y-4 text-sm text-[#d8d2bd]/74">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-emerald-100/58">
                    Field note filed
                  </div>
                  {/* The filed note is a physical page (#8): drag it sideways —
                      or use the affordance — to turn it over. Kael writes where
                      the log can't see. */}
                  <FlipCard
                    flipLabel="Turn the note over"
                    minHeight={180}
                    front={
                      <div className="flex min-h-[180px] flex-col justify-center border border-[#f2ead0]/12 bg-black/24 p-4">
                        <div className="italic text-sm border-l border-emerald-200/25 pl-4 py-1 space-y-2 leading-relaxed max-h-[40vh] overflow-y-auto">
                          {dayData?.narrativeSummary ? (
                            <p className="select-text text-[#f2ead0]">
                              <TypeOn text={`"${dayData.narrativeSummary}"`} speed={14} startDelay={300} />
                            </p>
                          ) : (
                            <p className="text-[#d8d2bd]/60">
                              <TypeOn text="Scattered papers show fragment records and mathematical drafts referencing the 1.42Hz frequency, but the pages are too degraded to resolve completely." speed={8} startDelay={300} showCursor={false} />
                            </p>
                          )}
                        </div>
                      </div>
                    }
                    back={
                      <div className="flex h-full min-h-[180px] flex-col justify-between border border-[#f2ead0]/12 bg-[#16150f] p-4">
                        <p className="font-['EB_Garamond'] text-base italic leading-relaxed text-[#e8e0c8]/85">
                          The front of the page is for the record. The back is for whoever thinks to turn it over. Until now, that has been no one.
                        </p>
                        <div
                          aria-hidden="true"
                          className="mt-4 inline-block max-w-max -rotate-3 border-2 border-[#b04a3a]/45 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.3em] text-[#b04a3a]/60"
                        >
                          Δ-7 CONTINUITY ARCHIVE · FILED UNREAD
                        </div>
                      </div>
                    }
                  />
                </div>
              )}

              {activePopup === 'window' && (
                <div className="space-y-4 text-sm text-[#d8d2bd]/74">
                  <p className="text-xs leading-relaxed text-[#d8d2bd]/62">
                    The viewport mirrors the room's exterior feed. Current evidence state: <span className="uppercase tracking-[0.18em] text-emerald-100/70">{activeWillowEvidenceState}</span>.
                  </p>

                  {/* Hold-to-the-light (#8): condensation keeps forming on the
                      inside of the viewport glass. Sweep a finger/cursor across
                      the feed to wipe it clear and find what Kael wrote there. */}
                  <RevealMask
                    toggleLabel="Wipe the glass"
                    hidden={
                      <div className="h-full w-full bg-[radial-gradient(circle_at_50%_60%,rgba(190,205,198,0.16),rgba(190,205,198,0.05)_70%)]">
                        <p className="absolute bottom-8 left-5 right-5 font-['EB_Garamond'] text-lg italic leading-snug tracking-wide text-[#eef4ec]/85 [text-shadow:0_0_12px_rgba(238,244,236,0.35)]">
                          the fog isn&rsquo;t weather. it&rsquo;s the room forgetting.
                        </p>
                      </div>
                    }
                  >
                  <div
                    className="relative aspect-video w-full overflow-hidden border border-white/10 bg-black shadow-[0_0_24px_rgba(16,185,129,0.08)]"
                  >
                    {activeObservationVideoSrc && !observationVideoError && activeObservationIsVideo && (
                      <InlineAutoplayVideo
                        key={`${activeWillowEvidenceState}-${activeObservationVideoSrc}`}
                        src={activeObservationVideoSrc}
                        className="absolute inset-0 h-full w-full object-contain"
                        preload="auto"
                        poster="/rooms/Willow_background.webp"
                        ariaLabel="Current exterior observation feed"
                        onReady={() => setIsObservationVideoReady(true)}
                        onError={() => {
                          setObservationVideoError(true);
                        }}
                      />
                    )}

                    {activeObservationVideoSrc && !observationVideoError && !activeObservationIsVideo && (
                      <img
                        src={activeObservationVideoSrc}
                        className="absolute inset-0 h-full w-full object-contain"
                        onLoad={() => setIsObservationVideoReady(true)}
                        alt="Current exterior observation feed"
                      />
                    )}

                    {!isObservationVideoReady && !observationVideoError && activeObservationVideoSrc && (
                      <div className="absolute inset-0 flex items-center justify-center text-[10px] uppercase tracking-widest text-[#d8d2bd]/45">
                        resolving evidence feed
                      </div>
                    )}

                    {(observationVideoError || !activeObservationVideoSrc) && (
                      <div className="absolute inset-0 flex items-center justify-center text-[10px] uppercase tracking-widest text-decay-red/70">
                        Exterior feed unavailable
                      </div>
                    )}

                    <div className="pointer-events-none absolute inset-0 bg-scanlines opacity-[0.12]" />

                    {/* The Almost (#10): a near-miss (or, on the pity floor, a
                        catch) drifts through the feed. Sits inside the feed's
                        children — above the video, below RevealMask's hidden
                        condensation layer — so wiping the glass still works and
                        the catch never blocks the feed. */}
                    <TheAlmost
                      key={`almost-${activeWillowEvidenceState}-${activePopup}`}
                      alreadyCaught={recoveredItems.includes('lore:the-almost')}
                      onCatch={() => {
                        void markRecovered('lore:the-almost');
                        showTelemetry('EXTERIOR CONTACT — ONE FRAME RESOLVED');
                      }}
                    />

                    {isObservationVideoReady && (
                      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-3 py-2 text-[9px] uppercase tracking-[0.22em] text-emerald-100/75">
                        <span className="flex items-center gap-1.5">
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                          REC
                        </span>
                        <span className="text-emerald-100/55">EXT_FEED_01 // DAY {String(currentDay).padStart(3, '0')}</span>
                      </div>
                    )}
                  </div>
                  </RevealMask>

                  <p className="text-[10px] italic tracking-wide text-[#d8d2bd]/42">
                    Condensation keeps forming on the inside of the glass.
                  </p>
                </div>
              )}

              {activePopup === 'prologue' && (
                <PrologueViewerPanel recoveredItems={recoveredItems} />
              )}

              {activePopup === 'security' && (
                <SecurityGatewayPanel
                  accessCode={accessCode}
                  isAnchored={isAnchored}
                  email={user?.email}
                  score={score}
                  state={state}
                  recoveredCount={recoveredItems.length}
                  acrosticSolved={recoveredItems.includes(ACROSTIC_RECOVERY_ID)}
                  onAcrosticSolved={() => {
                    void markRecovered(ACROSTIC_RECOVERY_ID);
                    triggerRecoverySurge();
                  }}
                  onTune={() => {
                    setActivePopup(null);
                    setIsTuningOpen(true);
                  }}
                  onAnchor={async () => {
                    await ensureUser();
                    setActivePopup(null);
                    setIsAuthModalOpen(true);
                  }}
                />
              )}

              {(activePopup === 'room-signal' ||
                activePopup === 'return-door' ||
                activePopup === 'next-room-door' ||
                activePopup === 'cart-room-index') && (
                <RoomIndexPanel
                  vmLogRecoveryCount={vmLogRecoveryCount}
                  activeRoom={activeRoom}
                  onNavigate={transitionToRoom}
                  isAdmin={isAdmin}
                  onClose={() => setActivePopup(null)}
                />
              )}

              {activePopup === 'archive' && (
                <ArchiveShelfPanel currentDay={currentDay} recoveredItems={recoveredItems} markRecovered={markRecovered} />
              )}

              {activePopup === 'support' && (
                <SupportRelayPanel />
              )}

              {activePopup === 'break-clock' && (
                <BreakRoomClockPanel />
              )}

              {activePopup === 'break-bulletin' && (
                <div className="space-y-6">
                  {/* The observation log clips to the corkboard above the notices —
                      the daily signing ritual lives on the break-room board. */}
                  <SignatureLog />
                  <div className="border-t border-[#f2ead0]/12 pt-5">
                    <BreakRoomBulletinPanel />
                  </div>
                </div>
              )}

              {activePopup === 'break-coffee' && (
                <BreakRoomCoffeePanel />
              )}

              {activePopup === 'break-fridge' && (
                <BreakRoomRefrigeratorPanel />
              )}

              {activePopup === 'cart-map' && (
                <div className="relative flex flex-col items-center justify-center p-4">
                  <style>{`
                    @keyframes map-blueprint-in {
                      0% { opacity: 0; filter: brightness(2.2) contrast(0.4) blur(5px); }
                      45% { opacity: 1; filter: brightness(1.5) contrast(0.7) blur(2px); }
                      100% { opacity: 1; filter: brightness(1) contrast(1) blur(0); }
                    }
                    .map-blueprint-in {
                      animation: map-blueprint-in 1400ms ease-out both;
                    }
                    @keyframes map-survey-line {
                      0% { top: 0; opacity: 0.8; }
                      100% { top: 100%; opacity: 0; }
                    }
                    .map-survey-line {
                      animation: map-survey-line 1400ms ease-in both;
                    }
                    @media (prefers-reduced-motion: reduce) {
                      .map-blueprint-in { animation-duration: 1ms; }
                      .map-survey-line { animation: none; opacity: 0; }
                    }
                  `}</style>
                  <div className="relative overflow-hidden border border-emerald-500/30 bg-black/45 p-2">
                    {cartMapUrl ? (
                      <>
                        <img src={cartMapUrl} alt="Facility Map" className="map-blueprint-in w-full max-h-[60vh] object-contain select-none" />
                        <div className="map-survey-line pointer-events-none absolute inset-x-0 h-px bg-emerald-300/70 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                      </>
                    ) : (
                      <div className="flex aspect-[1.6] w-full items-center justify-center text-xs uppercase tracking-widest text-emerald-500/50 animate-pulse">
                        LOADING MAP BLUEPRINT...
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activePopup === 'cart-compass' && (
                <CartographyCompassPanel 
                  visitorId={visitorId}
                  currentDay={currentDay}
                  readout={getDailyCompassReadout()}
                />
              )}

              {activePopup === 'cart-dead-zones' && (
                <div className="flex flex-col items-center justify-center p-4 space-y-6">
                  <div className="w-full border border-red-500/30 bg-red-950/10 p-4 relative overflow-hidden flex flex-col items-center">
                    <div 
                      className="absolute top-0 left-0 right-0 h-2 opacity-35" 
                      style={{
                        backgroundImage: 'repeating-linear-gradient(45deg, #ef4444, #ef4444 8px, transparent 8px, transparent 16px)',
                      }}
                    />
                    
                    <style>{`
                      @keyframes dead-zone-render-attempt {
                        0% { stroke-dashoffset: 290; opacity: 0.85; }
                        55% { stroke-dashoffset: 60; opacity: 0.85; }
                        62% { stroke-dashoffset: 60; opacity: 0.15; }
                        66% { stroke-dashoffset: 60; opacity: 0.7; }
                        70% { stroke-dashoffset: 60; opacity: 0.1; }
                        78% { stroke-dashoffset: 60; opacity: 0.5; }
                        100% { stroke-dashoffset: 290; opacity: 0; }
                      }
                      .dead-zone-outline {
                        stroke-dasharray: 290;
                        animation: dead-zone-render-attempt 4.5s infinite linear;
                      }
                      @media (prefers-reduced-motion: reduce) {
                        .dead-zone-outline { animation: none; stroke-dashoffset: 60; opacity: 0.4; }
                      }
                    `}</style>
                    <svg viewBox="0 0 100 100" className="w-20 h-20 text-red-500 my-4 animate-pulse">
                      {/* Sector 03 trying — and failing — to draw itself */}
                      <polygon points="50,8 92,88 8,88" fill="none" stroke="currentColor" strokeWidth="0.6" className="dead-zone-outline opacity-40" />
                      <polygon points="50,15 90,85 10,85" fill="none" stroke="currentColor" strokeWidth="2" />
                      <line x1="50" y1="40" x2="50" y2="65" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                      <circle cx="50" cy="76" r="3" fill="currentColor" />
                    </svg>

                    <div className="text-center space-y-2">
                      <div className="text-xs font-mono font-bold tracking-[0.2em] text-red-400">CRITICAL ANOMALY DETECTED</div>
                      <p className="text-[10px] font-mono text-red-300/60 uppercase tracking-wider">COHERENCE FAULT IN SECTOR 03</p>
                    </div>

                    <div 
                      className="absolute bottom-0 left-0 right-0 h-2 opacity-35" 
                      style={{
                        backgroundImage: 'repeating-linear-gradient(45deg, #ef4444, #ef4444 8px, transparent 8px, transparent 16px)',
                      }}
                    />
                  </div>

                  <div className="w-full border border-emerald-500/25 bg-black/60 p-4 rounded font-mono text-xs space-y-2">
                    <div className="text-[10px] text-emerald-100/50 uppercase tracking-widest">DIAGNOSTIC LOG</div>
                    <div className="text-emerald-100/80 leading-relaxed font-mono">
                      <div>[TIME] {new Date().toISOString().split('T')[0]} 14:03:00</div>
                      <div>[CODE] D-7-ERR-CART-DZ-03</div>
                      <div className="text-red-400 mt-2">[MESSAGE] <DecodeText text="DEAD ZONE 03: Rendering failed. The space is unresolvable. Coherence too low or attention absent." speed={14} startDelay={400} /></div>
                      <div className="text-[#d8d2bd]/50 mt-1 italic">
                        <TypeOn text='"The cartographer notes that Sector 03 refuses to draw itself. When we look away, it expands. When we look back, it is just static."' speed={10} startDelay={2200} showCursor={false} />
                      </div>
                    </div>
                  </div>
                </div>
              )}



              {activePopup === 'cart-route-trace' && (
                <div className="flex flex-col p-4 space-y-6">
                  <style>{`
                    @keyframes route-trace-reveal {
                      from { clip-path: inset(0 100% 0 0); }
                      to { clip-path: inset(0 0% 0 0); }
                    }
                    .route-trace-reveal {
                      animation: route-trace-reveal 2200ms cubic-bezier(0.4, 0, 0.4, 1) both;
                    }
                    @media (prefers-reduced-motion: reduce) {
                      .route-trace-reveal { animation-duration: 1ms; }
                    }
                  `}</style>
                  <div className="relative w-full h-40 bg-black/40 border border-emerald-500/25 rounded overflow-hidden flex items-center justify-center">
                    <svg viewBox="0 0 400 150" className="w-full h-full text-emerald-500 route-trace-reveal">
                      <path 
                        d="M 20 120 Q 100 20, 200 80 T 380 40" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeDasharray="4 8"
                        className="opacity-80"
                      />
                      <path 
                        d="M 20 120 Q 100 20, 200 80 T 380 40" 
                        fill="none" 
                        stroke="#10b981" 
                        strokeWidth="4" 
                        strokeDasharray="0.1 20"
                        strokeLinecap="round"
                        style={{
                          animation: 'route-flow 6s infinite linear'
                        }}
                      />
                      
                      <path 
                        d="M 20 120 Q 95 30, 205 60 T 380 55" 
                        fill="none" 
                        stroke="#ef4444" 
                        strokeWidth="1.5" 
                        strokeDasharray="3 9"
                        className="opacity-45 animate-flicker-subtle"
                      />
                      <text x="210" y="50" className="font-mono text-[8px] fill-red-400 opacity-60 animate-pulse">ANOMALY DETECTED: SIGNAL SPLIT</text>

                      <line x1="0" y1="75" x2="400" y2="75" stroke="currentColor" strokeWidth="0.5" strokeDasharray="1 15" className="opacity-20" />
                      <line x1="200" y1="0" x2="200" y2="150" stroke="currentColor" strokeWidth="0.5" strokeDasharray="1 15" className="opacity-20" />
                    </svg>
                    <div className="absolute top-2 left-2 text-[8px] font-mono text-emerald-500/50 uppercase tracking-widest">ROUTE SCANNER FEED</div>
                    <div className="absolute top-2 right-2 text-[8px] font-mono text-red-500/70 uppercase tracking-widest animate-pulse">DUAL-TRACE DETECTED</div>
                  </div>
                  
                  <div className="border border-emerald-500/25 bg-black/60 p-3 rounded font-mono text-xs space-y-2">
                    <div className="text-[10px] text-emerald-100/50 uppercase tracking-widest">ROUTE TRACE LOG</div>
                    <div className="space-y-1 text-emerald-100/80 leading-relaxed">
                      <div className="room-modal-stagger" style={{ animationDelay: '200ms' }}>[00:12:08] Route trace initiated. Origin: Observation Cell.</div>
                      <div className="room-modal-stagger" style={{ animationDelay: '900ms' }}>[00:12:15] Signal path split detected. Path divergence: 14.2%.</div>
                      <div className="room-modal-stagger text-red-400" style={{ animationDelay: '1600ms' }}>[00:12:22] Warning: Observer position reported in two spatial coords simultaneously.</div>
                      <div className="room-modal-stagger" style={{ animationDelay: '2300ms' }}>[00:12:35] Re-stabilizing route. Attention required.</div>
                    </div>
                  </div>
                </div>
              )}

              {activePopup === 'cart-relay-tuning' && (
                <div className="flex flex-col">
                  {/* Signal Lock (#5): phase-match the carrier to decode a
                      day-gated Kael transmission. Lives at the top of the relay
                      panel; the residue-mass economy stays below the divider. */}
                  <SignalLockPanel
                    visitorId={visitorId}
                    currentDay={currentDay}
                    alreadyLocked={recoveredItems.includes(`relay-frag-${currentDay}`)}
                    onLock={() => {
                      void markRecovered(`relay-frag-${currentDay}`);
                      showTelemetry('CARRIER LOCKED — TRANSMISSION RESOLVED');
                    }}
                  />

                  <div className="mx-4 my-2 border-t border-emerald-500/10" />
                  <div className="px-4 pt-1 text-[9px] font-mono uppercase tracking-widest text-emerald-100/35">
                    RESIDUE RECLAMATION // SECONDARY COIL
                  </div>

                <div className="flex flex-col p-4 space-y-6">
                  <div className={`flex justify-between items-center border bg-black/40 p-3 rounded transition-colors duration-500 ${isTuningRelay ? 'border-cyan-300/45' : 'border-emerald-500/25'}`}>
                    <span className="font-mono text-xs text-emerald-100/60 uppercase">RESIDUE MASS</span>
                    <span className="font-mono text-sm font-bold text-emerald-400">
                      <AnimatedCounter value={Math.max(0, observerState?.milligrams || 0)} duration={1000} suffix=" mg" />
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <button
                      disabled={isTuningRelay}
                      onClick={() => handleTuneRelay('inspect')}
                      className="border border-emerald-500/30 hover:border-emerald-400 bg-black/45 disabled:opacity-40 p-3 text-center transition-all flex flex-col items-center justify-center space-y-1 group"
                    >
                      <span className="font-mono text-[10px] text-emerald-400 group-hover:text-emerald-300 font-bold">INSPECT</span>
                      <span className="font-mono text-[8px] text-emerald-100/50">FREE</span>
                    </button>

                    <button
                      disabled={isTuningRelay || (observerState?.milligrams || 0) < 4.26}
                      onClick={() => handleTuneRelay('tune')}
                      className="border border-emerald-500/30 hover:border-emerald-400 bg-black/45 disabled:opacity-40 disabled:hover:border-emerald-500/30 p-3 text-center transition-all flex flex-col items-center justify-center space-y-1 group"
                    >
                      <span className="font-mono text-[10px] text-emerald-400 group-hover:text-emerald-300 font-bold">TUNE</span>
                      <span className="font-mono text-[8px] text-emerald-100/50">4.26 mg</span>
                    </button>

                    <button
                      disabled={isTuningRelay || (observerState?.milligrams || 0) < 9.94}
                      onClick={() => handleTuneRelay('overtune')}
                      className="border border-emerald-500/30 hover:border-emerald-400 bg-black/45 disabled:opacity-40 disabled:hover:border-emerald-500/30 p-3 text-center transition-all flex flex-col items-center justify-center space-y-1 group"
                    >
                      <span className="font-mono text-[10px] text-emerald-400 group-hover:text-emerald-300 font-bold">OVERTUNE</span>
                      <span className="font-mono text-[8px] text-emerald-100/50">9.94 mg</span>
                    </button>
                  </div>

                  <div className="relative border border-emerald-500/20 bg-black/70 p-4 rounded min-h-[120px] flex flex-col justify-between overflow-hidden">
                    {isTuningRelay && (
                      <svg viewBox="0 0 200 30" className="absolute inset-x-0 top-0 h-6 w-full text-cyan-300/60" aria-hidden="true">
                        <path d="M 0 15 Q 12 2, 25 15 T 50 15 T 75 15 T 100 15 T 125 15 T 150 15 T 175 15 T 200 15" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="4 3" style={{ animation: 'route-flow 0.5s infinite linear' }} />
                      </svg>
                    )}
                    <div className="font-mono text-xs space-y-2 pt-3">
                      <div className="text-[10px] text-emerald-100/40 uppercase tracking-widest">RELAY FEEDBACK</div>
                      {isTuningRelay ? (
                        <div className="text-cyan-300/80 animate-pulse uppercase tracking-wider text-[10px]">
                          Coil charging — calibrating relay... maintain attention.
                        </div>
                      ) : tuningError ? (
                        <p className="text-red-400 leading-relaxed font-mono">
                          <TypeOn key={tuningError} text={tuningError} speed={10} showCursor={false} />
                        </p>
                      ) : tuningResponse ? (
                        <p className="text-emerald-100/90 leading-relaxed font-mono select-text">
                          <TypeOn key={tuningResponse} text={tuningResponse} speed={14} />
                        </p>
                      ) : (
                        <p className="text-emerald-100/50 font-mono italic">
                          Coil status: Idle. Click a calibration action to query the signal.
                        </p>
                      )}
                    </div>
                    <div className="pointer-events-none absolute inset-0 bg-scanlines opacity-[0.05]" />
                  </div>
                </div>
                </div>
              )}

              {activePopup === 'cart-notes' && (
                <div className="flex flex-col p-4 space-y-6">
                  <div className="text-[10px] font-mono text-emerald-100/50 uppercase tracking-widest">
                    SYSTEM ARCHIVE // RECORDED LOGS (DR. KAEL)
                  </div>
                  
                  {dbCartographerNotes.length === 0 ? (
                    <div className="border border-emerald-500/15 bg-black/30 p-8 text-center text-xs font-mono text-emerald-100/40 uppercase tracking-wider">
                      No notes recovered in cartography databank.
                    </div>
                  ) : (
                    <div className="space-y-6 max-h-[55vh] overflow-y-auto pr-2 custom-scrollbar">
                      {dbCartographerNotes.map((note, noteIndex) => (
                        <div key={note.id} className="room-modal-stagger border border-emerald-500/20 bg-black/45 p-4 rounded space-y-4" style={{ animationDelay: `${Math.min(noteIndex, 6) * 110}ms` }}>
                          <p className="font-mono text-xs text-emerald-100/90 leading-relaxed whitespace-pre-wrap select-text">
                            "{note.text}"
                          </p>
                          {note.imageUrl && (
                            <div className="border border-emerald-500/15 bg-black/60 p-2 relative overflow-hidden flex flex-col items-center">
                              <img 
                                src={note.imageUrl} 
                                alt={note.caption || "Evidence Capture"} 
                                className="max-w-full max-h-[300px] object-contain filter grayscale contrast-125 brightness-90 hover:filter-none transition-all duration-500 select-none"
                              />
                              {note.caption && (
                                <div className="mt-2 text-[9px] font-mono text-emerald-100/40 uppercase tracking-widest text-center select-text">
                                  [CAP: {note.caption}]
                                </div>
                              )}
                              <div className="pointer-events-none absolute inset-0 bg-scanlines opacity-[0.06]" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activePopup === 'cart-unmarked-door' && (
                <div className="flex flex-col p-4 space-y-6">
                  <style>{`
                    @keyframes door-scan-beam {
                      0% { transform: translateY(-10%); opacity: 0; }
                      8% { opacity: 0.9; }
                      92% { opacity: 0.9; }
                      100% { transform: translateY(820%); opacity: 0; }
                    }
                    .door-scan-beam {
                      animation: door-scan-beam 2.8s infinite cubic-bezier(0.4, 0, 0.6, 1);
                    }
                    @media (prefers-reduced-motion: reduce) {
                      .door-scan-beam { animation: none; opacity: 0; }
                    }
                  `}</style>
                  <div className="relative w-full h-32 border border-emerald-500/25 bg-black/40 rounded flex items-center justify-center overflow-hidden">
                    <div className={`w-16 h-24 border-2 transition-all duration-1000 ${
                      score < 35 ? 'border-red-500/20 border-dashed animate-pulse' :
                      score < 70 ? 'border-emerald-500/40 border-dotted' :
                      'border-emerald-500/80 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                    }`}>
                      {score >= 70 && (
                        <div className="relative left-2 top-10 h-2.5 w-1 bg-emerald-400/70 shadow-[0_0_6px_rgba(16,185,129,0.6)] room-modal-stagger" style={{ animationDelay: '900ms' }} />
                      )}
                    </div>

                    <div className="door-scan-beam pointer-events-none absolute inset-x-6 top-2 h-3.5 bg-gradient-to-b from-transparent via-emerald-300/22 to-transparent" />

                    <div className="absolute top-2 left-2 text-[8px] font-mono text-emerald-100/50 uppercase tracking-widest">DOORWAY METRIC SCAN</div>
                    <div className="absolute bottom-2 right-2 text-[8px] font-mono text-emerald-100/40 uppercase tracking-widest">
                      RESOLUTION: {score >= 70 ? 'STABLE' : score >= 35 ? 'DEGRADED' : 'UNRESOLVED'}
                    </div>
                  </div>

                  <div className="border border-emerald-500/20 bg-black/60 p-4 rounded font-mono text-xs space-y-3">
                    <div className="text-[10px] text-emerald-100/40 uppercase tracking-widest">SCAN DETAILS</div>
                    <p className="text-emerald-100/80 leading-relaxed select-text">
                      <TypeOn
                        speed={10}
                        startDelay={500}
                        showCursor={false}
                        text={score < 35
                          ? 'No door resolved. The scanner reports only flat brickwork and unstable carrier waves. You are looking at a space that has already faded.'
                          : score < 70
                            ? 'The silhouette of an unnumbered frame is present in the scan, but the door handle remains out of coherence. A faint hum originates from behind it.'
                            : 'The door is resolved and locked. Diagnostics report: SECTOR 05 CONNECTION ACTIVE. No physical access is permitted under current laboratory directives.'}
                      />
                    </p>
                  </div>
                </div>
              )}

              {activePopup === 'cart-sector-scan' && (
                <div className="flex flex-col p-4 space-y-6">
                  <div className="relative w-48 h-48 mx-auto border border-emerald-500/25 rounded-full bg-black/40 flex items-center justify-center overflow-hidden">
                    <svg viewBox="0 0 200 200" className="w-full h-full text-emerald-500">
                      <circle cx="100" cy="100" r="90" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="3 3" className="opacity-30" />
                      <circle cx="100" cy="100" r="60" fill="none" stroke="currentColor" strokeWidth="0.5" className="opacity-40" />
                      <circle cx="100" cy="100" r="30" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="3 3" className="opacity-30" />
                      
                      <line x1="100" y1="10" x2="100" y2="190" stroke="currentColor" strokeWidth="0.5" className="opacity-30" />
                      <line x1="10" y1="100" x2="190" y2="100" stroke="currentColor" strokeWidth="0.5" className="opacity-30" />

                      {isCartScanning && (
                        <line 
                          x1="100" y1="100" x2="100" y2="10" 
                          stroke="currentColor" strokeWidth="2" 
                          className="origin-[100px_100px]"
                          style={{
                            animation: 'radar-sweep 2s infinite linear'
                          }}
                        />
                      )}
                      
                      {isCartScanning && (
                        <path 
                          d="M 100 100 L 100 10 A 90 90 0 0 1 163.64 36.36 Z" 
                          fill="currentColor" 
                          className="opacity-15 origin-[100px_100px]"
                          style={{
                            animation: 'radar-sweep 2s infinite linear'
                          }}
                        />
                      )}

                      {cartScanComplete && (() => {
                        // Daily-seeded anomaly position so the blip moves between days/observers.
                        let blipHash = 0;
                        const blipSeed = `${visitorId || 'anon'}-${currentDay}-blip`;
                        for (let i = 0; i < blipSeed.length; i++) {
                          blipHash = (blipHash << 5) - blipHash + blipSeed.charCodeAt(i);
                          blipHash |= 0;
                        }
                        const blipAngle = (Math.abs(blipHash) % 360) * (Math.PI / 180);
                        const blipRadius = 32 + (Math.abs(blipHash >> 3) % 50);
                        const bx = 100 + Math.cos(blipAngle) * blipRadius;
                        const by = 100 + Math.sin(blipAngle) * blipRadius;
                        return (
                          <g className="animate-pulse">
                            <circle cx={bx} cy={by} r="4" fill="#ef4444" />
                            <circle cx={bx} cy={by} r="8" fill="none" stroke="#ef4444" strokeWidth="1" />
                            <line x1="100" y1="100" x2={bx} y2={by} stroke="#ef4444" strokeWidth="0.5" strokeDasharray="2 3" opacity="0.4" />
                          </g>
                        );
                      })()}
                    </svg>
                    <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none bg-scanlines opacity-[0.08]" />
                  </div>

                  <div className="flex justify-center">
                    <button
                      disabled={isCartScanning}
                      onClick={handleStartCartScan}
                      className="border border-emerald-500/30 hover:border-emerald-400 disabled:opacity-40 bg-black/45 px-6 py-2 font-mono text-xs text-emerald-400 font-bold uppercase transition-all"
                    >
                      {isCartScanning ? 'SCANNING...' : 'INITIATE RADIAL SCAN'}
                    </button>
                  </div>

                  <div className="border border-emerald-500/20 bg-black/60 p-4 rounded font-mono text-xs min-h-[100px] relative overflow-hidden flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="text-[10px] text-emerald-100/40 uppercase tracking-widest">SCANNER TELEMETRY</div>
                      {isCartScanning ? (
                        <p className="text-emerald-500/80 animate-pulse uppercase tracking-wider text-[10px]">
                          Sweeping sector frequency bands... Please wait.
                        </p>
                      ) : cartScanComplete ? (
                        <div className="space-y-1">
                          <div className="text-red-400 font-bold animate-pulse text-[10px]">[WARNING: DEVIANT RESPONSE]</div>
                          <p className="text-emerald-100/80 leading-relaxed select-text">
                            <DecodeText text={DAILY_ANOMALIES[currentDay % DAILY_ANOMALIES.length]} speed={18} />
                          </p>
                        </div>
                      ) : (
                        <p className="text-emerald-100/50 italic">
                          Scanner ready. Initiate sweep to query local sector anomalies.
                        </p>
                      )}
                    </div>
                    <div className="pointer-events-none absolute inset-0 bg-scanlines opacity-[0.05]" />
                  </div>
                </div>
              )}
            </>
          </RoomModal>
        )}

        {/* Central Terminal Close-up Screen Overlay */}
        <TerminalOverlay
          isOpen={isTerminalOpen}
          onClose={handleTerminalClose}
          dayData={dayData}
          isAudioEnabled={isAudioEnabled}
          toggleAudio={() => {
            const newState = !isAudioEnabled;
            setIsAudioEnabled(newState);
            if (newState) {
              // Full unlock path: initializes the engine if the user never
              // clicked through the entry overlay, un-mutes, persists opt-in,
              // and plays the channel-open swell as feedback.
              void openAudioChannel({ force: true });
            } else {
              setMuted(true);
              // Persist the mute choice so it survives reloads.
              setAudioOptIn(false);
            }
          }}
          observerState={observerState}
          returnSignal={returnSignal}
          returnPackets={missedDaysPackets}
          onConfirmReturnSignal={handleConfirmReturnSignal}
        />

        {residueSurge && (
          <div className="fixed bottom-5 right-5 z-[10000] border border-emerald-500/40 bg-black/90 p-4 font-mono text-[11px] text-emerald-400 shadow-[0_0_24px_rgba(16,185,129,0.2)] animate-pulse uppercase tracking-[0.16em]">
            <div className="font-bold text-[9px] text-emerald-500/50 mb-1">// TELEMETRY UPDATE //</div>
            {residueSurge}
          </div>
        )}
      </div>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

      <TuningInterface
        isOpen={isTuningOpen}
        onClose={() => setIsTuningOpen(false)}
      />

      {isRoomTransitioning && <RoomSignalTransitionOverlay />}
    </>
  );
};

import { GlobalErrorBoundary } from './components/GlobalErrorBoundary';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { ChevronDown, WifiOff } from 'lucide-react';

const ObserverRoute: React.FC = () => {
  const { loading } = useAuth();

  if (loading) {
    return <div className="h-screen w-screen bg-lab-black" aria-hidden="true" />;
  }

  return (
    <CoherenceProvider>
      <LabInterface />
    </CoherenceProvider>
  );
};

function App() {
  const isOnline = useOnlineStatus();

  return (
    <GlobalErrorBoundary>
      <AuthProvider>
        <HelmetProvider>
          <Helmet>
            {/* 8.2 Dynamic Metadata: Default Tags */}
            <title>Delta-7: Coherence Protocol</title>
            <meta name="description" content="Secure communication terminal for the Delta-7 coherence project." />
          </Helmet>

          {!isOnline && (
            <div className="fixed top-0 left-0 right-0 z-[10000] bg-red-600 text-white text-[10px] font-mono font-bold text-center py-1 flex items-center justify-center gap-2 animate-pulse">
              <WifiOff size={10} />
              OFFLINE_MODE_ACTIVE // CONNECTIVITY_LOST
            </div>
          )}

          <BrowserRouter>
            <Routes>
              <Route path="/" element={<ObserverRoute />} />
              <Route path="/rooms/:roomSlug" element={<ObserverRoute />} />
              <Route path="/admin/login" element={
                <Suspense fallback={<div className="text-signal-green p-4 font-mono">LOADING_AUTH_MODULE...</div>}>
                  <AdminLogin />
                </Suspense>
              } />
              <Route path="/admin" element={<ProtectedRoute />}>
                <Route element={
                  <Suspense fallback={<div className="text-signal-green p-4 font-mono">LOADING_ADMIN_CORE...</div>}>
                    <AdminLayout />
                  </Suspense>
                }>
                  <Route index element={<DashboardOverview />} />
                  <Route path="logs" element={<NarrativeManager />} />
                  <Route path="narrative" element={<NarrativeReader />} />
                  <Route path="users" element={<ObserverDirectory />} />
                  <Route path="observers" element={<ObserverDirectory />} /> {/* Legacy alias? */}
                  <Route path="story-bible" element={<StoryBibleEditor />} />
                  <Route path="break-room" element={<AdminBreakRoom />} />
                  <Route path="cartography" element={<AdminCartography />} />
                  <Route path="rooms" element={<AdminRooms />} />
                  <Route path="stats" element={<AdminStats />} />
                  <Route path="settings" element={<AdminSettings />} />
                  <Route path="director" element={<AtmosphereControl />} />
                </Route>
              </Route>
              <Route path="/privacy" element={<PrivacyStatement />} />
              <Route path="/terms" element={<TermsAndConditions />} />
            </Routes>
          </BrowserRouter>
        </HelmetProvider>
      </AuthProvider>
    </GlobalErrorBoundary>
  );
}

export default App;
