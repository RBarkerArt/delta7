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
import { SupportRelayPanel } from './components/SupportRelayPanel';
import { ArchiveShelfPanel } from './components/ArchiveShelfPanel';
import { ReturnSignalPanel } from './components/ReturnSignalPanel';
import { InlineAutoplayVideo } from './components/InlineAutoplayVideo';
import { RoomIndexPanel } from './components/RoomIndexPanel';
import { BreakRoomBulletinPanel, BreakRoomClockPanel, BreakRoomCoffeePanel, BreakRoomRefrigeratorPanel, useObserverBreakRoomState } from './components/BreakRoomPanels';

import { ScreenEffects } from './components/ScreenEffects';
import { BackgroundAtmosphere } from './components/BackgroundAtmosphere';
import { Prologue } from './components/Prologue';
import { AuthModal } from './components/AuthModal';
import { GlitchOverlay } from './components/GlitchOverlay';
import { AtmosphereManager } from './components/AtmosphereManager';
import { TuningInterface } from './components/TuningInterface'; // Project Signal
import { useSound } from './hooks/useSound';
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

const getRoomSceneId = (room: ActiveRoom): RoomSceneId => {
  if (room === 'lab') return 'lab';
  if (room === 'break-room') return 'break-room';
  return 'signal-cartography';
};

const getRoomPath = (room: ActiveRoom): string => {
  if (room === 'lab') return '/rooms/observation';
  return `/rooms/${room}`;
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



const CartographyCompassPanel: React.FC<{
  visitorId: string | null;
  currentDay: number;
  readout: string;
}> = ({ visitorId, currentDay, readout }) => {
  const [isCalibrating, setIsCalibrating] = useState(true);

  useEffect(() => {
    setIsCalibrating(true);
    const timer = setTimeout(() => {
      setIsCalibrating(false);
    }, 1800);
    return () => clearTimeout(timer);
  }, []);

  const getDailyCompassAngle = () => {
    let hash = 0;
    const str = `${visitorId || 'anon'}-${currentDay}`;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return 30 + (Math.abs(hash) % 300);
  };

  const dailyAngle = getDailyCompassAngle();

  return (
    <div className="flex flex-col items-center justify-center p-4 space-y-6">
      <style>{`
        @keyframes compass-wild-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes compass-settle-jitter {
          0%, 100% { transform: rotate(var(--target-angle)); }
          20% { transform: rotate(calc(var(--target-angle) - 3deg)); }
          40% { transform: rotate(calc(var(--target-angle) + 4deg)); }
          60% { transform: rotate(calc(var(--target-angle) - 1.5deg)); }
          80% { transform: rotate(calc(var(--target-angle) + 2deg)); }
        }
        .animate-compass-wild {
          animation: compass-wild-spin 0.25s infinite linear;
        }
        .animate-compass-settled {
          animation: compass-settle-jitter 3s infinite ease-in-out;
        }
      `}</style>

      <div className="relative w-52 h-52 flex items-center justify-center border border-emerald-500/25 rounded-full bg-black/50 p-2 shadow-[0_0_20px_rgba(16,185,129,0.05)]">
        <svg viewBox="0 0 200 200" className="w-full h-full text-emerald-500 select-none">
          <circle cx="100" cy="100" r="92" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 4" className="opacity-30" />
          <circle cx="100" cy="100" r="86" fill="none" stroke="currentColor" strokeWidth="1" className="opacity-60" />
          <circle cx="100" cy="100" r="82" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="1 8" className="opacity-80" />
          <circle cx="100" cy="100" r="70" fill="none" stroke="currentColor" strokeWidth="0.5" className="opacity-20" />
          
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
            <line
              key={deg}
              x1="100"
              y1="14"
              x2="100"
              y2="20"
              stroke="currentColor"
              strokeWidth={deg % 90 === 0 ? "1.5" : "0.5"}
              className="opacity-70"
              transform={`rotate(${deg} 100 100)`}
            />
          ))}

          <text x="100" y="32" textAnchor="middle" className="font-mono text-xs font-bold fill-current">N</text>
          <text x="168" y="104" textAnchor="middle" className="font-mono text-xs font-bold fill-current">E</text>
          <text x="100" y="176" textAnchor="middle" className="font-mono text-xs font-bold fill-current">S</text>
          <text x="32" y="104" textAnchor="middle" className="font-mono text-xs font-bold fill-red-500/50 animate-pulse">Ø</text>

          <line x1="100" y1="20" x2="100" y2="180" stroke="currentColor" strokeWidth="0.5" strokeDasharray="1 8" className="opacity-30" />
          <line x1="20" y1="100" x2="180" y2="100" stroke="currentColor" strokeWidth="0.5" strokeDasharray="1 8" className="opacity-30" />

          <g 
            transform="translate(100, 100)" 
            className={isCalibrating ? "animate-compass-wild" : "animate-compass-settled"}
            style={{
              '--target-angle': `${dailyAngle}deg`,
              transformOrigin: '50% 50%'
            } as React.CSSProperties}
          >
            <path d="M 0 0 L -8 -20 L 0 -72 L 8 -20 Z" fill="currentColor" className="opacity-90" stroke="currentColor" strokeWidth="1" />
            <path d="M 0 0 L -8 20 L 0 72 L 8 20 Z" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-50" />
            
            <circle cx="0" cy="0" r="7" fill="#0c0a09" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="0" cy="0" r="2" fill="currentColor" />
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
          <span className={isCalibrating ? "text-amber-400 animate-pulse" : "text-emerald-400"}>
            {isCalibrating ? "CALIBRATING..." : "LOCK ACTIVE"}
          </span>
        </div>
        <p className="text-emerald-100/80 leading-relaxed select-text min-h-[40px]">
          {isCalibrating ? (
            <span className="opacity-60 italic">Reading magnetospheric telemetry vectors...</span>
          ) : (
            readout
          )}
        </p>
      </div>
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
  const [loreContent, setLoreContent] = useState<{ title: string; body: string } | null>(null);
  const [observationVideoSrc, setObservationVideoSrc] = useState<Partial<Record<WillowEvidenceState, string>>>({});
  const [cartMapUrl, setCartMapUrl] = useState<string>('');
  const [dbDays, setDbDays] = useState<DayLog[]>([]);

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

  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const { setMuted } = useSound();
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
  const handleHotspotAction = useCallback((hotspot: RoomHotspotDefinition) => {
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
      default:
        if (VALID_POPUP_IDS.has(hotspot.actionId as ActivePopup)) {
          setActivePopup(hotspot.actionId as ActivePopup);
        } else if (import.meta.env.DEV) {
          console.warn('[Delta-7] Unknown hotspot action:', hotspot.actionId);
        }
    }
  }, [markRecovered, resolvedDay]);

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
    if (window.sessionStorage.getItem(MOBILE_ROOM_NAVIGATION_KEY) !== '1') return undefined;

    window.sessionStorage.removeItem(MOBILE_ROOM_NAVIGATION_KEY);
    setIsRoomTransitioning(true);

    const timer = window.setTimeout(() => setIsRoomTransitioning(false), ROOM_TRANSITION_MIN_MS);
    return () => window.clearTimeout(timer);
  }, []);

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
          setIsPrologueActive(false);
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
          setIsPrologueActive(false);
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

      if (isMemorySafeRoomRuntime) {
        window.sessionStorage.setItem(MOBILE_ROOM_NAVIGATION_KEY, '1');
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
          <LabObserverRoom
            key={activeRoom}
            roomId={getRoomSceneId(activeRoom)}
            onHotspotAction={handleHotspotAction}
            isZoomed={isZoomed}
            roomRestoration={roomRestoration}
            willowVideoSources={observationVideoSrc}
            hotspotStates={hotspotStates}
            onSceneReady={() => handleRoomSceneReady(activeRoom)}
          />
        )}

        {isReturnSignalOpen && returnSignal && !isPrologueActive && !dataLoading && !activePopup && !isTerminalOpen && (
          <ReturnSignalPanel
            report={returnSignal}
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
            onClose={() => setActivePopup(null)}
          >
            <>
              {activePopup === 'lore' && (
                <div className="space-y-4 text-sm leading-relaxed text-[#d8d2bd]/80 whitespace-pre-wrap font-mono">
                  {loreContent?.body}
                </div>
              )}
              {activePopup === 'blackboard' && (
                <div className="space-y-4 text-sm text-[#d8d2bd]/74">
                  <div className="space-y-2">
                    <div>Coherence: <span className="text-[#f2ead0]">{score.toFixed(2)}%</span></div>
                    <div>Signal state: <span className="text-[#f2ead0]">{state}</span></div>
                    <div>Room restoration: <span className="text-[#f2ead0]">{Math.round(roomRestoration * 100)}%</span></div>
                    <div>Next signal: <span className="text-[#f2ead0]">{formatSignalCountdown(nextDayAt, signalNow)}</span></div>
                  </div>
                  <div className="border-t border-white/10 pt-4 space-y-2 text-xs text-[#d8d2bd]/58">
                    <div className="uppercase tracking-[0.2em] text-emerald-100/55">Telemetry Variables</div>
                    <div>FLICKER RATING: {((dayData?.variables?.flicker ?? 1) * (100 - score) / 100).toFixed(1)} ms</div>
                    <div>DRIFT MULTIPLIER: {(dayData?.variables?.drift ?? 1).toFixed(1)}x</div>
                    <div>COGNITIVE COHERENCE: {dayData?.variables?.kaelCoherence ?? 'UNKNOWN'}%</div>
                    {dayData?.variables?.kaelMood && <div>KAEL MOOD SIGNAL: <span className="italic">"{dayData.variables.kaelMood}"</span></div>}
                  </div>
                </div>
              )}

              {activePopup === 'drawer' && (
                <div className="space-y-4 text-sm text-[#d8d2bd]/74">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-emerald-100/58">
                    Field note filed
                  </div>
                  <div className="italic text-sm border-l border-emerald-200/25 pl-4 py-1 space-y-2 leading-relaxed max-h-[40vh] overflow-y-auto">
                    {dayData?.narrativeSummary ? (
                      <p className="select-text text-[#f2ead0]">"{dayData.narrativeSummary}"</p>
                    ) : (
                      <p className="text-[#d8d2bd]/60">Scattered papers show fragment records and mathematical drafts referencing the 1.42Hz frequency, but the pages are too degraded to resolve completely.</p>
                    )}
                  </div>
                </div>
              )}

              {activePopup === 'window' && (
                <div className="space-y-4 text-sm text-[#d8d2bd]/74">
                  <p className="text-xs leading-relaxed text-[#d8d2bd]/62">
                    The viewport mirrors the room's exterior feed. Current evidence state: <span className="uppercase tracking-[0.18em] text-emerald-100/70">{activeWillowEvidenceState}</span>.
                  </p>

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
                  </div>
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
                <ArchiveShelfPanel currentDay={currentDay} recoveredItems={recoveredItems} />
              )}

              {activePopup === 'support' && (
                <SupportRelayPanel />
              )}

              {activePopup === 'break-clock' && (
                <BreakRoomClockPanel />
              )}

              {activePopup === 'break-bulletin' && (
                <BreakRoomBulletinPanel />
              )}

              {activePopup === 'break-coffee' && (
                <BreakRoomCoffeePanel />
              )}

              {activePopup === 'break-fridge' && (
                <BreakRoomRefrigeratorPanel />
              )}

              {activePopup === 'cart-map' && (
                <div className="relative flex flex-col items-center justify-center p-4">
                  <div className="relative border border-emerald-500/30 bg-black/45 p-2">
                    {cartMapUrl ? (
                      <img src={cartMapUrl} alt="Facility Map" className="w-full max-h-[60vh] object-contain select-none" />
                    ) : (
                      <div className="flex aspect-[1.6] w-full items-center justify-center text-xs uppercase tracking-widest text-emerald-500/50">
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
                    
                    <svg viewBox="0 0 100 100" className="w-20 h-20 text-red-500 my-4 animate-pulse">
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
                      <div className="text-red-400 mt-2">[MESSAGE] DEAD ZONE 03: Rendering failed. The space is unresolvable. Coherence too low or attention absent.</div>
                      <div className="text-[#d8d2bd]/50 mt-1">"The cartographer notes that Sector 03 refuses to draw itself. When we look away, it expands. When we look back, it is just static."</div>
                    </div>
                  </div>
                </div>
              )}



              {activePopup === 'cart-route-trace' && (
                <div className="flex flex-col p-4 space-y-6">
                  <div className="relative w-full h-40 bg-black/40 border border-emerald-500/25 rounded overflow-hidden flex items-center justify-center">
                    <svg viewBox="0 0 400 150" className="w-full h-full text-emerald-500">
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
                      <div>[00:12:08] Route trace initiated. Origin: Observation Cell.</div>
                      <div>[00:12:15] Signal path split detected. Path divergence: 14.2%.</div>
                      <div className="text-red-400">[00:12:22] Warning: Observer position reported in two spatial coords simultaneously.</div>
                      <div>[00:12:35] Re-stabilizing route. Attention required.</div>
                    </div>
                  </div>
                </div>
              )}

              {activePopup === 'cart-relay-tuning' && (
                <div className="flex flex-col p-4 space-y-6">
                  <div className="flex justify-between items-center border border-emerald-500/25 bg-black/40 p-3 rounded">
                    <span className="font-mono text-xs text-emerald-100/60 uppercase">RESIDUE MASS</span>
                    <span className="font-mono text-sm font-bold text-emerald-400">
                      {Math.max(0, observerState?.milligrams || 0).toFixed(2)} mg
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
                    <div className="font-mono text-xs space-y-2">
                      <div className="text-[10px] text-emerald-100/40 uppercase tracking-widest">RELAY FEEDBACK</div>
                      {isTuningRelay ? (
                        <div className="text-emerald-500/80 animate-pulse uppercase tracking-wider text-[10px]">
                          Calibrating relay coil... Please maintain attention.
                        </div>
                      ) : tuningError ? (
                        <p className="text-red-400 leading-relaxed font-mono">{tuningError}</p>
                      ) : tuningResponse ? (
                        <p className="text-emerald-100/90 leading-relaxed font-mono select-text">
                          {tuningResponse}
                          <span className="inline-block w-1.5 h-3 bg-emerald-400 ml-1 animate-pulse" />
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
                      {dbCartographerNotes.map((note) => (
                        <div key={note.id} className="border border-emerald-500/20 bg-black/45 p-4 rounded space-y-4">
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
                  <div className="relative w-full h-32 border border-emerald-500/25 bg-black/40 rounded flex items-center justify-center overflow-hidden">
                    <div className={`w-16 h-24 border-2 transition-all duration-1000 ${
                      score < 35 ? 'border-red-500/20 border-dashed animate-pulse' :
                      score < 70 ? 'border-emerald-500/40 border-dotted' :
                      'border-emerald-500/80 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                    }`} />
                    
                    <div className="absolute top-2 left-2 text-[8px] font-mono text-emerald-100/50 uppercase tracking-widest">DOORWAY METRIC SCAN</div>
                    <div className="absolute bottom-2 right-2 text-[8px] font-mono text-emerald-100/40 uppercase tracking-widest">
                      RESOLUTION: {score >= 70 ? 'STABLE' : score >= 35 ? 'DEGRADED' : 'UNRESOLVED'}
                    </div>
                  </div>

                  <div className="border border-emerald-500/20 bg-black/60 p-4 rounded font-mono text-xs space-y-3">
                    <div className="text-[10px] text-emerald-100/40 uppercase tracking-widest">SCAN DETAILS</div>
                    <p className="text-emerald-100/80 leading-relaxed select-text">
                      {score < 35 ? (
                        "No door resolved. The scanner reports only flat brickwork and unstable carrier waves. You are looking at a space that has already faded."
                      ) : score < 70 ? (
                        "The silhouette of an unnumbered frame is present in the scan, but the door handle remains out of coherence. A faint hum originates from behind it."
                      ) : (
                        "The door is resolved and locked. Diagnostics report: SECTOR 05 CONNECTION ACTIVE. No physical access is permitted under current laboratory directives."
                      )}
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

                      {cartScanComplete && (
                        <g className="animate-pulse">
                          <circle cx="140" cy="70" r="4" fill="#ef4444" />
                          <circle cx="140" cy="70" r="8" fill="none" stroke="#ef4444" strokeWidth="1" />
                        </g>
                      )}
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
                            {DAILY_ANOMALIES[currentDay % DAILY_ANOMALIES.length]}
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
            setMuted(!newState);
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
