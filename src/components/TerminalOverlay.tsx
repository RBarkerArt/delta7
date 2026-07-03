import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useCoherence } from '../hooks/useCoherence';
import { useSound } from '../hooks/useSound';
import { Terminal, CornerDownLeft, X, BookOpen, FileText, Compass, Activity, Inbox, type LucideIcon } from 'lucide-react';
import type { DayLog, ReturnSignalReport } from '../types/schema';
import { db } from '../lib/firebase';
import { doc, getDoc, collection, query, getDocs, where } from 'firebase/firestore';
import { getReturnPacketRecoveryId, getDayNoteRecoveryId, countRecoveredVmLogs } from '../lib/dailyRecovery';
import { lockBodyScroll, unlockBodyScroll } from '../lib/scrollLock';
import { triggerRecoverySurge } from '../lib/recoverySurge';
import { useAuth } from '../hooks/useAuth';
import type { BreakRoomObserverState } from '../lib/breakRoom';
import localDaysData from '../season1_days.json';
import localProloguesData from '../season1_prologues.json';

interface TerminalOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  dayData: DayLog | null;
  isAudioEnabled: boolean;
  toggleAudio: () => void;
  observerState: BreakRoomObserverState;
  returnSignal?: ReturnSignalReport | null;
  returnPackets?: Array<{ day: number; text: string }>;
  onConfirmReturnSignal?: () => Promise<void>;
}

type LineTone = 'default' | 'dim' | 'bright' | 'error' | 'warn' | 'accent' | 'quote' | 'header' | 'input';

interface TermLine {
  text: string;
  tone: LineTone;
}

const TONE_CLASS: Record<LineTone, string> = {
  default: 'text-signal-green',
  dim: 'text-signal-green/55',
  bright: 'text-emerald-100',
  error: 'text-red-400',
  warn: 'text-amber-300',
  accent: 'text-cyan-300/90',
  quote: 'text-[#f2ead0]/85 italic',
  header: 'text-emerald-200 font-semibold tracking-[0.08em]',
  input: 'text-signal-green/85',
};

const asLine = (line: string | Partial<TermLine>): TermLine =>
  typeof line === 'string' ? { text: line, tone: 'default' } : { text: line.text ?? '', tone: line.tone ?? 'default' };

// Keep in sync with App.tsx room gating.
const BREAK_ROOM_LOGS_REQUIRED = 5;
const CARTOGRAPHY_LOGS_REQUIRED = 15;

const COMMAND_NAMES = [
  'guide', 'help', 'status', 'story', 'recap', 'progress', 'next', 'logs',
  'read', 'fragment', 'fragments', 'decrypt', 'recall', 'confirm',
  'signals', 'tuning', 'mg', 'tune', 'audio', 'clear', 'exit',
];

const BOOT_LINES: Array<Partial<TermLine>> = [
  { text: 'DELTA-7 OBSERVATION TERMINAL // REV 7.3', tone: 'header' },
  { text: 'ESTABLISHING COHERENCE LINK...', tone: 'dim' },
  { text: 'CARRIER LOCK: 1.42 Hz', tone: 'dim' },
  { text: 'LINK ESTABLISHED.', tone: 'bright' },
];

const formatBar = (value: number, total: number, width = 18): string => {
  if (total <= 0) return '░'.repeat(width);
  const filled = Math.round(Math.min(1, value / total) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
};

interface MergedDay {
  day: number;
  narrativeSummary?: string;
  prologueSentences?: string[];
  vmTitle?: string;
  fragments: Array<{ id: string; body: string; severity?: string }>;
}

export const TerminalOverlay: React.FC<TerminalOverlayProps> = ({
  isOpen,
  onClose,
  dayData,
  isAudioEnabled,
  toggleAudio,
  observerState,
  returnSignal,
  returnPackets,
  onConfirmReturnSignal,
}) => {
  const { score, state, currentDay, isAnchored, accessCode, recoveredItems, ensureUser, markRecovered } = useCoherence();
  const { visitorId } = useAuth();
  const { playClick, playBlip } = useSound();
  const [history, setHistory] = useState<TermLine[]>([]);
  const [inputVal, setInputVal] = useState('');
  const [isBooting, setIsBooting] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const consoleBottomRef = useRef<HTMLDivElement>(null);
  const consoleRef = useRef<HTMLDivElement>(null);
  const consoleCueRef = useRef<HTMLDivElement>(null);
  const commandHistoryRef = useRef<string[]>([]);
  const historyCursorRef = useRef<number | null>(null);
  const storyCacheRef = useRef<Map<number, MergedDay> | null>(null);

  const activeTerminalDay = dayData?.day || currentDay;

  const appendLines = useCallback((lines: Array<string | Partial<TermLine>>) => {
    setHistory(prev => [...prev, ...lines.map(asLine)]);
  }, []);

  const appendToHistory = (line: string | Partial<TermLine>) => appendLines([line]);

  const resolveDayLog = async (targetDay: number): Promise<DayLog | null> => {
    if (dayData?.day === targetDay) {
      return dayData;
    }

    try {
      const dayDocRef = doc(db, 'season1_days', `day_${targetDay}`);
      const snap = await getDoc(dayDocRef);
      if (snap.exists()) return snap.data() as DayLog;
    } catch {
      // fall through to local data
    }

    const local = (localDaysData as unknown as DayLog[]).find(d => d.day === targetDay);
    return local ?? null;
  };

  /** Merge Firestore day docs with bundled JSON so story commands work offline. */
  const ensureStoryData = async (): Promise<Map<number, MergedDay>> => {
    if (storyCacheRef.current) return storyCacheRef.current;

    const merged = new Map<number, MergedDay>();

    const fold = (log: Partial<DayLog> & { day: number }) => {
      const existing = merged.get(log.day) ?? { day: log.day, fragments: [] };
      const vmLog = log.vm_logs?.['FEED_STABLE'] ?? Object.values(log.vm_logs ?? {})[0];
      merged.set(log.day, {
        day: log.day,
        narrativeSummary: log.narrativeSummary ?? existing.narrativeSummary,
        prologueSentences: log.prologueSentences ?? existing.prologueSentences,
        vmTitle: vmLog?.title ?? existing.vmTitle,
        fragments: log.fragments?.length ? log.fragments : existing.fragments,
      });
    };

    (localDaysData as unknown as DayLog[]).forEach(fold);
    (localProloguesData as Array<{ day: number; sentences: string[] }>).forEach(({ day, sentences }) => {
      const existing = merged.get(day) ?? { day, fragments: [] };
      merged.set(day, { ...existing, prologueSentences: existing.prologueSentences ?? sentences });
    });

    try {
      const snap = await getDocs(collection(db, 'season1_days'));
      snap.docs.forEach(d => {
        const data = d.data() as DayLog;
        if (typeof data.day === 'number') fold(data);
      });
    } catch {
      // Bundled data already loaded; remote enrichment is best-effort.
    }

    storyCacheRef.current = merged;
    return merged;
  };

  const getFragmentDayHint = (fragmentId: string): number | null => {
    const match = fragmentId.match(/^frag_(\d{4})_/i);
    if (!match) return null;
    const parsed = parseInt(match[1], 10);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const parseRequestedDay = (rawDay: string | undefined, fallbackDay: number): number => {
    if (!rawDay) return fallbackDay;
    return parseInt(rawDay, 10);
  };

  // Boot sequence: type the boot lines on, then surface warnings + prompt.
  useEffect(() => {
    if (!isOpen) return undefined;

    const isPendingConfirm = returnSignal && !recoveredItems.includes(getReturnPacketRecoveryId(currentDay));
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const statusLines: Array<Partial<TermLine>> = [
      { text: `COHERENCE RATING: ${score.toFixed(1)}% (${state})`, tone: 'default' },
      { text: 'CONNECTION: ' + (isAnchored ? 'SECURED_ANCHOR' : 'UNVERIFIED_TEMPORAL_BREACH'), tone: isAnchored ? 'default' : 'warn' },
      { text: '' },
      { text: 'New here? Type "story" to catch up, or "next" for your best move.', tone: 'accent' },
      { text: 'Type "help" for all protocols.', tone: 'dim' },
      { text: '' },
    ];

    if (isPendingConfirm) {
      statusLines.push(
        { text: '*** WARNING: ' + (returnSignal.reason === 'catchup_return' ? 'TEMPORAL DRIFT DETECTED' : 'NEW RETURN SIGNAL DETECTED') + ' ***', tone: 'warn' },
        {
          text: returnSignal.reason === 'catchup_return'
            ? `The system registered a drift of +${returnSignal.dayDelta} days since last verification.`
            : 'The system registered a new interval return signal.',
          tone: 'warn',
        },
        { text: 'Unfiled interval packets are buffered in local memory.', tone: 'warn' },
        { text: 'To execute and file the return packets, type: "confirm"', tone: 'bright' },
        { text: '' },
      );
    }

    setHistory([]);
    setIsBooting(true);

    if (reducedMotion) {
      setHistory([...BOOT_LINES, ...statusLines].map(asLine));
      setIsBooting(false);
      return undefined;
    }

    const timers: number[] = [];
    BOOT_LINES.forEach((line, index) => {
      timers.push(window.setTimeout(() => {
        setHistory(prev => [...prev, asLine(line)]);
        playBlip('low');
      }, 180 + index * 200));
    });

    timers.push(window.setTimeout(() => {
      setHistory(prev => [...prev, ...statusLines.map(asLine)]);
      setIsBooting(false);
      window.setTimeout(() => inputRef.current?.focus(), 80);
    }, 180 + BOOT_LINES.length * 200 + 150));

    return () => timers.forEach(t => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Keep scrolled to bottom
  useEffect(() => {
    consoleBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  // Read-progress telemetry on the console: styles written via refs so scroll
  // events never trigger React renders. Layout reads + writes are coalesced
  // into one rAF per frame so scrolling never forces synchronous layout.
  const consoleCueRafRef = useRef(0);
  const updateConsoleCue = useCallback(() => {
    if (consoleCueRafRef.current) return;
    consoleCueRafRef.current = requestAnimationFrame(() => {
      consoleCueRafRef.current = 0;
      const content = consoleRef.current;
      const cue = consoleCueRef.current;
      if (!content || !cue) return;

      const maxScroll = content.scrollHeight - content.clientHeight;
      const hasOverflow = maxScroll > 24;
      cue.classList.toggle('hidden', !hasOverflow);
      if (!hasOverflow) return;

      const progress = Math.min(1, Math.max(0, content.scrollTop / maxScroll));
      cue.style.setProperty('--scroll-progress', progress.toFixed(4));
      cue.dataset.atEnd = progress >= 0.985 ? 'true' : 'false';
    });
  }, []);

  // Pin the page behind the terminal (iOS-safe, shares the lock with modals).
  useEffect(() => {
    if (!isOpen) return undefined;
    lockBodyScroll();
    return () => unlockBodyScroll();
  }, [isOpen]);

  if (!isOpen) return null;

  const printGuide = () => {
    appendLines([
      { text: 'DISCOVERY GUIDE:', tone: 'header' },
      '  1. story - Catch up on everything recovered so far.',
      '  2. next - Ask the system for your best next move.',
      `  3. read ${activeTerminalDay} - Read today's VM log.`,
      `  4. fragment ${activeTerminalDay} - Recover today's fragment text.`,
      '  5. progress - See how much of the record you have restored.',
      '',
      { text: 'Day numbers work across story commands: read 1, recap 1, fragment 1.', tone: 'dim' },
    ]);
  };

  const printHelp = () => {
    appendLines([
      { text: 'ACTIVE PROTOCOLS', tone: 'header' },
      '',
      { text: '-- STORY --', tone: 'accent' },
      '  story            Chronological story-so-far digest.',
      '  recap [day]      Full recap of a single day. Example: recap 1',
      '  read [day]       Print a VM log body. Example: read 1',
      '  fragment [day]   Recover fragment text for a day.',
      '  fragments [day]  List visible fragment slots for a day.',
      '  recall           Print the filed return packet.',
      '  logs             List recorded logs and read status.',
      '',
      { text: '-- ORIENTATION --', tone: 'accent' },
      '  next             Recommend the best next action.',
      '  progress         Recovery progress and room access.',
      '  status           Signal telemetry and coherence.',
      '  guide            Short discovery path for new observers.',
      '',
      { text: '-- SIGNALS --', tone: 'accent' },
      '  signals               List recovered signals.',
      '  signals verified      List verified signals.',
      '  signals unverified    List unverified/overtuned signals.',
      '  signals read [id]     Read a recovered signal.',
      '  tuning log            Coil tuning transaction history.',
      '  decrypt [id]          Legacy resolver for exact fragment IDs.',
      '  mg                    Explain Residue Mass (mg).',
      '',
      { text: '-- SYSTEM --', tone: 'accent' },
      '  confirm          Execute and file pending return packets.',
      '  tune [code]      Restore an observation record by frequency.',
      '  audio [on/off]   Toggle audio signals.',
      '  clear            Flush terminal screen memory.',
      '  exit             Disconnect terminal link.',
      '',
      { text: 'TIP: Up/Down arrows recall previous commands. Tab autocompletes.', tone: 'dim' },
    ]);
  };

  const assertValidDay = (targetDayNum: number): boolean => {
    if (isNaN(targetDayNum) || targetDayNum < 1 || targetDayNum > currentDay) {
      appendToHistory({ text: `ERROR: Day must be a number between 1 and ${currentDay}.`, tone: 'error' });
      return false;
    }

    return true;
  };

  const revealFragmentsForDay = async (targetDayNum: number) => {
    appendToHistory({ text: `ACCESSING FRAGMENT ARCHIVE: DAY_${targetDayNum}...`, tone: 'dim' });

    let fragments: DayLog['fragments'] = [];
    try {
      const data = await resolveDayLog(targetDayNum);
      fragments = data?.fragments || [];
    } catch {
      appendToHistory({ text: 'ERROR: Fragment index could not be resolved.', tone: 'error' });
      return;
    }

    if (fragments.length === 0) {
      appendToHistory(`NO FRAGMENTS VISIBLE IN DAY_${targetDayNum}.`);
      return;
    }

    appendToHistory({ text: `--- FRAGMENTS: DAY_${targetDayNum} ---`, tone: 'header' });
    for (const fragment of fragments) {
      await markRecovered(`fragment:${fragment.id}`);
      appendToHistory({ text: `[${fragment.severity || 'UNCLASSIFIED'}] ${fragment.body}`, tone: 'quote' });
    }
    appendToHistory({ text: '------------------------', tone: 'dim' });
  };

  const printStory = async () => {
    appendToHistory({ text: 'COMPILING STORY RECORD...', tone: 'dim' });
    const days = await ensureStoryData();

    appendLines([
      '',
      { text: `=== THE RECORD SO FAR — DAY 001 to DAY ${String(currentDay).padStart(3, '0')} ===`, tone: 'header' },
      '',
    ]);

    for (let d = 1; d <= currentDay; d++) {
      const entry = days.get(d);
      const vmRead = recoveredItems.includes(`vm:${d}`);
      const noteFiled = recoveredItems.includes(getDayNoteRecoveryId(d));
      const marker = vmRead ? '#' : '·';
      const markerTone: LineTone = vmRead ? 'bright' : 'dim';

      if ((vmRead || noteFiled) && entry?.narrativeSummary) {
        appendLines([
          { text: `[${marker}] DAY ${String(d).padStart(3, '0')}  ${entry.narrativeSummary}`, tone: markerTone },
        ]);
      } else {
        appendLines([
          { text: `[${marker}] DAY ${String(d).padStart(3, '0')}  RECORD UNREAD — type: read ${d}`, tone: 'dim' },
        ]);
      }
    }

    const readCount = countRecoveredVmLogs(recoveredItems);
    appendLines([
      '',
      { text: `${readCount}/${currentDay} day records restored. Unread days hide their summaries.`, tone: 'accent' },
      { text: 'Deep-dive a day with: recap [day]', tone: 'dim' },
      '',
    ]);
  };

  const printRecap = async (targetDayNum: number) => {
    appendToHistory({ text: `COMPILING RECAP: DAY_${targetDayNum}...`, tone: 'dim' });
    const days = await ensureStoryData();
    const entry = days.get(targetDayNum);

    if (!entry) {
      appendToHistory({ text: `ERROR: No record exists for DAY_${targetDayNum}.`, tone: 'error' });
      return;
    }

    const vmRead = recoveredItems.includes(`vm:${targetDayNum}`);
    const noteFiled = recoveredItems.includes(getDayNoteRecoveryId(targetDayNum));
    const recoveredFragments = entry.fragments.filter(f => recoveredItems.includes(`fragment:${f.id}`));

    appendLines(['', { text: `=== RECAP: DAY ${String(targetDayNum).padStart(3, '0')} ===`, tone: 'header' }]);

    if (entry.prologueSentences?.length) {
      appendLines([
        { text: 'PROLOGUE TRANSMISSION:', tone: 'accent' },
        ...entry.prologueSentences.map(s => ({ text: `  ${s}`, tone: 'quote' as LineTone })),
        '',
      ]);
    }

    if ((vmRead || noteFiled) && entry.narrativeSummary) {
      appendLines([
        { text: 'FIELD NOTE:', tone: 'accent' },
        { text: `  "${entry.narrativeSummary}"`, tone: 'quote' },
        '',
      ]);
    } else {
      appendLines([
        { text: 'FIELD NOTE: not yet filed. Read the day log or check the clipboard in the cell.', tone: 'dim' },
        '',
      ]);
    }

    appendLines([
      {
        text: `VM LOG: ${entry.vmTitle || 'UNTITLED'} — ${vmRead ? 'READ' : `UNREAD (type: read ${targetDayNum})`}`,
        tone: vmRead ? 'default' : 'warn',
      },
      {
        text: `FRAGMENTS: ${recoveredFragments.length}/${entry.fragments.length} recovered${entry.fragments.length > recoveredFragments.length ? ` (type: fragment ${targetDayNum})` : ''}`,
        tone: recoveredFragments.length === entry.fragments.length && entry.fragments.length > 0 ? 'default' : 'warn',
      },
      '',
    ]);

    if (recoveredFragments.length > 0) {
      appendLines(recoveredFragments.map(f => ({ text: `  [${f.severity || 'UNCLASSIFIED'}] ${f.body}`, tone: 'quote' as LineTone })));
      appendToHistory('');
    }
  };

  const printProgress = async () => {
    const days = await ensureStoryData();
    const vmCount = countRecoveredVmLogs(recoveredItems);

    let fragmentsTotal = 0;
    let fragmentsRecovered = 0;
    for (let d = 1; d <= currentDay; d++) {
      const entry = days.get(d);
      if (!entry) continue;
      fragmentsTotal += entry.fragments.length;
      fragmentsRecovered += entry.fragments.filter(f => recoveredItems.includes(`fragment:${f.id}`)).length;
    }

    const verifiedSignals = recoveredItems.filter(id => id.startsWith('signal:')).length;
    const unverifiedSignals = recoveredItems.filter(id => id.startsWith('unverified:')).length;
    const residue = Math.max(0, observerState?.milligrams || 0);
    const coffeeClaimed = observerState?.lastCoffeeSignalDay === currentDay;
    const fridgeOpened = observerState?.lastFridgeSignalDay === currentDay;

    appendLines([
      '',
      { text: 'RECOVERY PROGRESS', tone: 'header' },
      { text: `  VM LOGS    [${formatBar(vmCount, currentDay)}] ${vmCount}/${currentDay}`, tone: 'default' },
      { text: `  FRAGMENTS  [${formatBar(fragmentsRecovered, fragmentsTotal)}] ${fragmentsRecovered}/${fragmentsTotal}`, tone: 'default' },
      { text: `  SIGNALS    ${verifiedSignals} verified / ${unverifiedSignals} unverified`, tone: 'default' },
      { text: `  RESIDUE    ${residue.toFixed(2)} mg`, tone: 'default' },
      '',
      { text: 'ROOM ACCESS', tone: 'header' },
      {
        text: vmCount >= BREAK_ROOM_LOGS_REQUIRED
          ? '  BREAK ROOM        UNLOCKED'
          : `  BREAK ROOM        LOCKED — read ${BREAK_ROOM_LOGS_REQUIRED - vmCount} more day log${BREAK_ROOM_LOGS_REQUIRED - vmCount === 1 ? '' : 's'} (${vmCount}/${BREAK_ROOM_LOGS_REQUIRED})`,
        tone: vmCount >= BREAK_ROOM_LOGS_REQUIRED ? 'bright' : 'warn',
      },
      {
        text: vmCount >= CARTOGRAPHY_LOGS_REQUIRED
          ? '  SIGNAL CARTOGRAPHY UNLOCKED'
          : `  SIGNAL CARTOGRAPHY LOCKED — ${vmCount}/${CARTOGRAPHY_LOGS_REQUIRED} day logs read`,
        tone: vmCount >= CARTOGRAPHY_LOGS_REQUIRED ? 'bright' : 'warn',
      },
      '',
      { text: 'TODAY', tone: 'header' },
      { text: `  COFFEE CLAIM      ${coffeeClaimed ? 'CLAIMED' : 'AVAILABLE — Break Room coffee station'}`, tone: coffeeClaimed ? 'dim' : 'accent' },
      { text: `  COLD STORAGE      ${fridgeOpened ? 'OPENED' : 'AVAILABLE — Break Room refrigerator'}`, tone: fridgeOpened ? 'dim' : 'accent' },
      '',
    ]);
  };

  const printNext = async () => {
    const days = await ensureStoryData();
    const vmCount = countRecoveredVmLogs(recoveredItems);
    const isPendingConfirm = returnSignal && !recoveredItems.includes(getReturnPacketRecoveryId(currentDay));

    const suggest = (lines: Array<string | Partial<TermLine>>) => {
      appendLines(['', { text: 'RECOMMENDED ACTION:', tone: 'header' }, ...lines, '']);
    };

    if (isPendingConfirm) {
      suggest([{ text: '  A return packet is buffered. Type: confirm', tone: 'bright' }]);
      return;
    }

    if (!recoveredItems.includes(`vm:${currentDay}`)) {
      suggest([
        { text: `  Today's VM log is unread. Type: read ${currentDay}`, tone: 'bright' },
        { text: '  The story moves one signal per day. Start here.', tone: 'dim' },
      ]);
      return;
    }

    const todayEntry = days.get(currentDay);
    if (todayEntry?.fragments.some(f => !recoveredItems.includes(`fragment:${f.id}`))) {
      suggest([
        { text: `  Today's fragments are unrecovered. Type: fragment ${currentDay}`, tone: 'bright' },
      ]);
      return;
    }

    for (let d = 1; d < currentDay; d++) {
      if (!recoveredItems.includes(`vm:${d}`)) {
        suggest([
          { text: `  An older record is unread. Type: read ${d}`, tone: 'bright' },
          { text: `  ${vmCount}/${currentDay} day records restored so far.`, tone: 'dim' },
        ]);
        return;
      }
    }

    for (let d = 1; d < currentDay; d++) {
      const entry = days.get(d);
      if (entry?.fragments.some(f => !recoveredItems.includes(`fragment:${f.id}`))) {
        suggest([{ text: `  Day ${d} still holds unrecovered fragments. Type: fragment ${d}`, tone: 'bright' }]);
        return;
      }
    }

    if (observerState?.lastCoffeeSignalDay !== currentDay) {
      suggest([
        { text: '  All records read. The Break Room coffee claim is still available today.', tone: 'bright' },
        { text: '  Residue mass fuels relay tuning in Signal Cartography.', tone: 'dim' },
      ]);
      return;
    }

    if (vmCount < CARTOGRAPHY_LOGS_REQUIRED) {
      suggest([
        { text: `  Hold attention. Signal Cartography opens at ${CARTOGRAPHY_LOGS_REQUIRED} day records (${vmCount} restored).`, tone: 'bright' },
        { text: '  A new signal arrives each day.', tone: 'dim' },
      ]);
      return;
    }

    suggest([
      { text: '  Everything reachable today is filed. Tune the relay in Signal Cartography,', tone: 'bright' },
      { text: '  or hold attention until the next signal arrives.', tone: 'dim' },
    ]);
  };

  const handleCommand = async (cmdStr: string) => {
    const trimmed = cmdStr.trim();
    if (!trimmed) return;

    appendToHistory({ text: `> ${trimmed}`, tone: 'input' });
    setInputVal('');
    commandHistoryRef.current.push(trimmed);
    historyCursorRef.current = null;

    const parts = trimmed.split(' ');
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    playClick();

    switch (command) {
      case 'guide':
      case 'start':
      case 'hint':
        printGuide();
        break;

      case 'help':
        printHelp();
        break;

      case 'story':
      case 'catchup':
        await printStory();
        break;

      case 'recap': {
        const targetDayNum = parseRequestedDay(args[0], activeTerminalDay);
        if (!assertValidDay(targetDayNum)) break;
        await printRecap(targetDayNum);
        break;
      }

      case 'progress':
        await printProgress();
        break;

      case 'next':
        await printNext();
        break;

      case 'status': {
        const observerResidue = Math.max(0, observerState?.milligrams || 0).toFixed(2);
        const recoveredCount = recoveredItems.filter(id => id.startsWith('signal:')).length;
        const unverifiedCount = recoveredItems.filter(id => id.startsWith('unverified:')).length;

        appendLines([
          { text: 'TELEMETRY STATUS:', tone: 'header' },
          `  COHERENCE:          ${score.toFixed(2)}%`,
          `  SIGNAL_STATE:       ${state}`,
          `  RESIDUE MASS:       ${observerResidue} mg`,
          `  RECOVERED SIGNALS:  ${recoveredCount}`,
          `  UNVERIFIED SIGNALS: ${unverifiedCount}`,
          `  CURRENT_DAY:        Day ${currentDay}`,
          { text: `  IDENTITY_LOCK:      ${isAnchored ? 'ANCHORED' : 'UNLINKED_BREACH'}`, tone: isAnchored ? 'default' : 'warn' },
          `  FREQUENCY_ID:       ${accessCode || 'UNASSIGNED'}`,
        ]);
        break;
      }

      case 'signals': {
        const subCommand = args[0]?.toLowerCase();

        appendToHistory({ text: 'FETCHING SIGNALS FROM SYSTEM ARCHIVE...', tone: 'dim' });
        try {
          const colRef = collection(db, 'system', 'cartography', 'tuning_signals');
          const snap = await getDocs(colRef);
          interface TuningSignal { id: string; type: string; category: string; title: string; text: string }
          const allSignals = snap.docs.map(d => ({ id: d.id, ...d.data() } as TuningSignal));

          const verified = allSignals.filter(sig => sig.type === 'verified' && recoveredItems.includes(`signal:${sig.id}`));
          const unverified = allSignals.filter(sig => sig.type === 'unverified' && recoveredItems.includes(`unverified:${sig.id}`));

          if (subCommand === 'read') {
            const targetId = args[1]?.toLowerCase();
            if (!targetId) {
              appendToHistory({ text: 'ERROR: Please specify a signal ID. Example: signals read sig_001', tone: 'error' });
              break;
            }
            const match = allSignals.find(s => s.id.toLowerCase() === targetId);
            if (match) {
              const isVerified = match.type === 'verified' && recoveredItems.includes(`signal:${match.id}`);
              const isUnverified = match.type === 'unverified' && recoveredItems.includes(`unverified:${match.id}`);
              if (isVerified || isUnverified) {
                appendLines([
                  '',
                  { text: `SIGNAL:    [${match.id}] ${match.title.toUpperCase()}`, tone: 'header' },
                  `TYPE:      ${match.type.toUpperCase()}`,
                  `CATEGORY:  ${match.category.toUpperCase()}`,
                  'CONTENT:',
                  { text: `  "${match.text}"`, tone: 'quote' },
                  '',
                ]);
              } else {
                appendToHistory({ text: `ERROR: Signal ID [${match.id}] is not coherent in this temporal node.`, tone: 'error' });
              }
            } else {
              appendToHistory({ text: `ERROR: Signal ID [${args[1]}] not found.`, tone: 'error' });
            }
            break;
          }

          if (verified.length === 0 && unverified.length === 0) {
            appendToHistory('NO RECOVERED OR UNVERIFIED SIGNALS RECORDED.');
            appendToHistory({ text: 'Tuning in Signal Cartography is required.', tone: 'dim' });
            break;
          }

          if (!subCommand || subCommand === 'verified' || subCommand === '--recovered') {
            if (verified.length > 0) {
              appendToHistory({ text: '--- RECOVERED SIGNALS (VERIFIED) ---', tone: 'header' });
              verified.forEach(sig => {
                appendToHistory(`  [${sig.id}] ${sig.title} (${sig.category.toUpperCase()})`);
              });
            } else if (subCommand) {
              appendToHistory('NO VERIFIED RECOVERED SIGNALS RECORDED.');
            }
          }

          if (!subCommand || subCommand === 'unverified' || subCommand === '--unverified') {
            if (unverified.length > 0) {
              if (!subCommand) appendToHistory('');
              appendToHistory({ text: '--- UNVERIFIED SIGNALS (OVERTUNED) ---', tone: 'warn' });
              unverified.forEach(sig => {
                appendToHistory(`  [${sig.id}] ${sig.title} (${sig.category.toUpperCase()})`);
              });
            } else if (subCommand) {
              appendToHistory('NO UNVERIFIED SIGNALS RECORDED.');
            }
          }

          appendToHistory('');
          appendToHistory({ text: 'To read a signal, type: signals read [id]', tone: 'dim' });
        } catch (err) {
          appendToHistory({ text: 'ERROR: Failed to retrieve signals from system database.', tone: 'error' });
          if (import.meta.env.DEV) console.error(err);
        }
        break;
      }

      case 'tuning': {
        const sub = args[0]?.toLowerCase();
        if (sub !== 'log') {
          appendToHistory('Usage: tuning log');
          break;
        }
        appendToHistory({ text: 'QUERYING COIL TUNING TRANSACTION HISTORY...', tone: 'dim' });
        try {
          const logsCol = collection(db, 'observer_tuning_logs');
          const q = query(logsCol, where('observerId', '==', visitorId || 'anon'));
          const snap = await getDocs(q);

          if (snap.empty) {
            appendToHistory('NO TUNING LOGS FOUND IN COIL MEMORY.');
            break;
          }

          interface TuningLogDoc { id: string; tuningType?: string; cost?: number; title?: string; elapsed?: string; dayProgress?: number; createdAt?: { toMillis?: () => number } }
          const logsList = snap.docs
            .map(d => ({ id: d.id, ...d.data() } as TuningLogDoc))
            .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));

          appendToHistory({ text: '--- COIL TUNING LOG ---', tone: 'header' });
          logsList.forEach(log => {
            const typeStr = log.tuningType === 'tune' ? 'TUNE' : 'OVERTUNE';
            const elapsedStr = log.elapsed || '1.0s';
            appendToHistory(`  [Day ${String(log.dayProgress).padStart(3, '0')}] ${typeStr} (-${log.cost} mg) -> ${log.title} (${elapsedStr} contact)`);
          });
        } catch (err) {
          appendToHistory({ text: 'ERROR: Failed to query tuning log.', tone: 'error' });
          if (import.meta.env.DEV) console.error(err);
        }
        break;
      }

      case 'mg':
      case 'residue': {
        appendLines([
          { text: 'RESIDUE MASS EXPLANATION:', tone: 'header' },
          { text: '  "Milligrams are a convenience label.', tone: 'quote' },
          { text: '   The system insists on measuring attention as mass.', tone: 'quote' },
          { text: '   I have stopped correcting it."', tone: 'quote' },
          { text: '      -- Dr. Kael, Cartography Notes', tone: 'dim' },
        ]);
        break;
      }

      case 'logs': {
        const days = await ensureStoryData();
        appendToHistory({ text: 'ARCHIVED SIGNAL LOGS IN CELL:', tone: 'header' });
        for (let i = 1; i <= currentDay; i++) {
          const entry = days.get(i);
          const vmRead = recoveredItems.includes(`vm:${i}`);
          appendToHistory({
            text: `  ${vmRead ? '#' : '·'} Day ${String(i).padStart(3, '0')}: ${entry?.vmTitle || 'UNTITLED RECORD'} ${vmRead ? '' : '— UNREAD'}`,
            tone: vmRead ? 'default' : 'dim',
          });
        }
        appendToHistory({ text: 'Read a record with: read [day]', tone: 'dim' });
        break;
      }

      case 'read': {
        const targetDayNum = parseRequestedDay(args[0], activeTerminalDay);
        if (!assertValidDay(targetDayNum)) break;

        appendToHistory({ text: `ACCESSING LOG ARCHIVE: DAY_${targetDayNum}...`, tone: 'dim' });
        try {
          const data = await resolveDayLog(targetDayNum);
          if (data) {
            const logObj = data.vm_logs?.[state] || data.vm_logs?.['FEED_STABLE'];
            if (logObj?.body) {
              const alreadyRecovered = recoveredItems.includes(`vm:${targetDayNum}`);
              await markRecovered(`vm:${targetDayNum}`);
              if (!alreadyRecovered) triggerRecoverySurge();
              appendToHistory({ text: `--- LOG: ${logObj.title || 'UNNAMED'} ---`, tone: 'header' });
              const paragraphs = logObj.body.split('\n');
              paragraphs.forEach(p => appendToHistory(p));
              appendToHistory({ text: '------------------------', tone: 'dim' });
              appendToHistory({ text: `Filed. Continue with: recap ${targetDayNum}, or "next" for your next move.`, tone: 'dim' });
            } else {
              appendToHistory({ text: 'ERROR: Log body empty for this state.', tone: 'error' });
            }
          } else {
            appendToHistory({ text: 'ERROR: Log document not found in archive.', tone: 'error' });
          }
        } catch {
          appendToHistory({ text: 'ERROR: Access denied. Remote database query failed.', tone: 'error' });
        }
        break;
      }

      case 'fragments': {
        const targetDayNum = parseRequestedDay(args[0], activeTerminalDay);
        if (!assertValidDay(targetDayNum)) break;

        let fragments: DayLog['fragments'] = [];
        try {
          const data = await resolveDayLog(targetDayNum);
          fragments = data?.fragments || [];
        } catch {
          appendToHistory({ text: 'ERROR: Fragment index could not be resolved.', tone: 'error' });
          break;
        }

        if (fragments.length === 0) {
          appendToHistory(`NO FRAGMENT SLOTS VISIBLE IN DAY_${targetDayNum}.`);
          break;
        }

        appendToHistory({ text: `VISIBLE FRAGMENT SLOTS: DAY_${targetDayNum}`, tone: 'header' });
        appendToHistory({ text: `  Read with: fragment ${targetDayNum}`, tone: 'dim' });
        fragments.forEach((fragment, index) => {
          appendToHistory(`  ${index + 1}. ${fragment.id} // ${fragment.severity || 'UNCLASSIFIED'}`);
        });
        break;
      }

      case 'fragment': {
        const targetDayNum = parseRequestedDay(args[0], activeTerminalDay);
        if (!assertValidDay(targetDayNum)) break;

        await revealFragmentsForDay(targetDayNum);
        break;
      }

      case 'decrypt': {
        const fragId = args[0];
        if (!fragId) {
          appendToHistory({ text: 'ERROR: Please specify a fragment. Try: fragment 1', tone: 'error' });
          appendToHistory({ text: 'Legacy exact ID example: decrypt frag_0001_a', tone: 'dim' });
          break;
        }

        const requestedDay = args[1] ? parseInt(args[1], 10) : getFragmentDayHint(fragId) || activeTerminalDay;
        if (isNaN(requestedDay) || requestedDay < 1 || requestedDay > currentDay) {
          appendToHistory({ text: `ERROR: Fragment day must be between 1 and ${currentDay}.`, tone: 'error' });
          break;
        }

        let match: DayLog['fragments'][number] | undefined;
        try {
          const data = await resolveDayLog(requestedDay);
          match = data?.fragments?.find((f) => f.id.toLowerCase() === fragId.toLowerCase());
        } catch {
          appendToHistory({ text: 'ERROR: Fragment index could not be resolved.', tone: 'error' });
          break;
        }

        if (match) {
          await markRecovered(`fragment:${match.id}`);
          appendToHistory(`DECRYPTING SIGNAL FRAGMENT: ${fragId}`);
          appendToHistory({ text: `[DECRYPTED]: "${match.body}"`, tone: 'quote' });
        } else {
          appendToHistory({ text: `ERROR: Fragment ID "${fragId}" is not visible in DAY_${requestedDay}.`, tone: 'error' });
        }
        break;
      }

      case 'confirm': {
        const isPendingConfirm = returnSignal && !recoveredItems.includes(getReturnPacketRecoveryId(currentDay));
        if (!isPendingConfirm) {
          appendToHistory('SYSTEM: No pending return packets require confirmation.');
          break;
        }

        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const beat = (ms: number) => (reducedMotion ? Promise.resolve() : new Promise<void>(r => setTimeout(r, ms)));

        // File the packets one at a time so the catch-up reads like an event,
        // not a dump.
        appendToHistory({ text: 'EXECUTING RETURN PACKETS...', tone: 'bright' });
        await beat(500);

        if (returnPackets && returnPackets.length > 0) {
          appendToHistory({ text: `${returnPackets.length} INTERVAL RECORD${returnPackets.length === 1 ? '' : 'S'} IN BUFFER.`, tone: 'dim' });
          appendToHistory({ text: '---------------------------------------------', tone: 'dim' });
          await beat(600);

          for (let i = 0; i < returnPackets.length; i++) {
            const pkt = returnPackets[i];
            appendToHistory({ text: `FILING [${i + 1}/${returnPackets.length}] — DAY ${String(pkt.day).padStart(3, '0')} INTERVAL RECORD:`, tone: 'header' });
            playBlip('mid');
            await beat(350);
            appendToHistory({ text: `  "${pkt.text}"`, tone: 'quote' });
            appendToHistory('');
            await beat(900);
          }
        } else {
          appendToHistory('No return packets found in buffer.');
        }

        appendToHistory({ text: '---------------------------------------------', tone: 'dim' });
        await beat(400);
        appendToHistory({ text: `RETURN SIGNAL PACKETS EXECUTED AND FILED${returnPackets && returnPackets.length > 0 ? ` (+${returnPackets.length} record${returnPackets.length === 1 ? '' : 's'})` : ''}.`, tone: 'bright' });
        appendToHistory('Coherence link stabilized.');
        appendToHistory({ text: 'Catch up on what you missed with: story', tone: 'accent' });
        appendToHistory('');
        playBlip('high');

        if (onConfirmReturnSignal) {
          void onConfirmReturnSignal();
        }
        break;
      }

      case 'recall': {
        const packetDay = dayData?.day || currentDay;
        const returnPacket = dayData?.prologueSentences?.[1]?.trim();

        if (!returnPacket) {
          appendToHistory('NO RETURN PACKET RESOLVED FOR THIS NODE.');
          break;
        }

        if (!recoveredItems.includes(getReturnPacketRecoveryId(packetDay))) {
          appendToHistory({ text: 'RETURN PACKET EXISTS. FILE ACCESS NOT YET RECOVERED.', tone: 'warn' });
          break;
        }

        appendToHistory({ text: `RETURN PACKET: DAY_${packetDay}`, tone: 'header' });
        appendToHistory({ text: returnPacket, tone: 'quote' });
        break;
      }

      case 'tune': {
        const code = args[0];
        if (!code) {
          appendToHistory({ text: 'ERROR: Missing frequency code. Usage: tune XXX-XXX', tone: 'error' });
          break;
        }
        appendToHistory({ text: `TUNING TO FREQUENCY: ${code}...`, tone: 'dim' });
        try {
          // Trigger matching routine
          await ensureUser();
          appendToHistory({ text: 'SIGNAL SYNCHRONIZED. IDENTITY ANCHOR VERIFIED.', tone: 'bright' });
        } catch {
          appendToHistory({ text: 'ERROR: Frequency alignment failed. Sync rejected.', tone: 'error' });
        }
        break;
      }

      case 'audio': {
        const mode = args[0]?.toLowerCase();
        if (mode === 'on') {
          if (!isAudioEnabled) toggleAudio();
          appendToHistory('AUDIO_STREAM: ACTIVE');
        } else if (mode === 'off') {
          if (isAudioEnabled) toggleAudio();
          appendToHistory('AUDIO_STREAM: MUTED');
        } else {
          appendToHistory(`Usage: audio [on/off]. Current state: ${isAudioEnabled ? 'ON' : 'OFF'}`);
        }
        break;
      }

      case 'clear':
        setHistory([]);
        break;

      case 'exit':
        onClose();
        break;

      default:
        appendToHistory({ text: `COMMAND NOT RECOGNIZED: "${command}".`, tone: 'error' });
        appendToHistory({ text: 'Type "story" to catch up, "next" for a recommendation, or "help" for protocols.', tone: 'dim' });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCommand(inputVal);
      return;
    }

    const commands = commandHistoryRef.current;
    if (e.key === 'ArrowUp') {
      if (commands.length === 0) return;
      e.preventDefault();
      const cursor = historyCursorRef.current === null
        ? commands.length - 1
        : Math.max(0, historyCursorRef.current - 1);
      historyCursorRef.current = cursor;
      setInputVal(commands[cursor]);
      return;
    }

    if (e.key === 'ArrowDown') {
      if (historyCursorRef.current === null) return;
      e.preventDefault();
      const cursor = historyCursorRef.current + 1;
      if (cursor >= commands.length) {
        historyCursorRef.current = null;
        setInputVal('');
      } else {
        historyCursorRef.current = cursor;
        setInputVal(commands[cursor]);
      }
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const fragment = inputVal.trim().toLowerCase();
      if (!fragment || fragment.includes(' ')) return;
      const matches = COMMAND_NAMES.filter(name => name.startsWith(fragment));
      if (matches.length === 1) {
        setInputVal(`${matches[0]} `);
      } else if (matches.length > 1) {
        appendToHistory({ text: matches.join('   '), tone: 'dim' });
      }
    }
  };

  const hasPendingConfirm = Boolean(returnSignal && !recoveredItems.includes(getReturnPacketRecoveryId(currentDay)));

  const quickCommands: Array<{
    label: string;
    command: string;
    title: string;
    icon: LucideIcon;
    highlight?: boolean;
  }> = hasPendingConfirm
    ? [
      { label: `File ${returnPackets?.length || ''} Packet${(returnPackets?.length || 0) === 1 ? '' : 's'}`.replace('  ', ' '), command: 'confirm', title: 'Execute and file buffered return packets', icon: Inbox, highlight: true },
      { label: 'Story', command: 'story', title: 'Catch up on the story so far', icon: BookOpen },
      { label: 'Progress', command: 'progress', title: 'Recovery progress and room access', icon: Activity },
      { label: 'Next', command: 'next', title: 'Recommend the best next action', icon: Compass },
    ]
    : [
      { label: 'Story', command: 'story', title: 'Catch up on the story so far', icon: BookOpen },
      { label: `Log ${activeTerminalDay}`, command: `read ${activeTerminalDay}`, title: `Read day ${activeTerminalDay} log`, icon: FileText },
      { label: 'Progress', command: 'progress', title: 'Recovery progress and room access', icon: Activity },
      { label: 'Next', command: 'next', title: 'Recommend the best next action', icon: Compass },
    ];

  return (
    <div className="fixed inset-0 z-[12000] flex min-h-dvh items-start justify-center bg-black/95 p-0 font-mono select-none sm:items-center sm:p-4">
      {/* Screen CRT Container */}
      <div className="relative flex h-[100dvh] max-h-[100dvh] w-full min-h-0 max-w-4xl flex-col justify-between overflow-hidden rounded-none border-none border-signal-green/40 bg-lab-black p-3 shadow-[0_0_50px_rgba(16,185,129,0.15)] sm:h-auto sm:aspect-[4/3] sm:max-h-[90dvh] sm:rounded-xl sm:border-2 sm:p-6">
        {/* CRT Scanline Overlay & Screen Glitch */}
        <div className="absolute inset-0 pointer-events-none bg-scanlines opacity-10 z-30" />
        <div className="absolute inset-0 pointer-events-none bg-radial-gradient z-20" />

        {/* Header bar inside monitor */}
        <div className="relative z-40 mb-2 flex shrink-0 items-center justify-between gap-3 border-b border-signal-green/20 pb-2 text-xs text-signal-green/60">
          <div className="flex min-w-0 items-center gap-2">
            <Terminal size={14} className="animate-pulse" />
            <span className="truncate">OBSERVATION_TERMINAL_D7</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-[10px] tracking-[0.18em] text-signal-green/40 sm:inline">
              DAY {String(currentDay).padStart(3, '0')} // {state}
            </span>
            <button
              onClick={() => {
                playClick();
                onClose();
              }}
              className="hover:text-signal-green hover:bg-signal-green/10 p-1 rounded transition-colors cursor-pointer"
              aria-label="Exit Terminal"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Console Log Area */}
        <div className="relative z-40 mb-3 min-h-0 flex-1 sm:mb-4">
          <div
            ref={consoleRef}
            onScroll={updateConsoleCue}
            className="h-full overflow-y-auto overscroll-contain pr-2 text-sm leading-6 space-y-1 custom-scrollbar"
            style={{ touchAction: 'pan-y' }}
            role="log"
            aria-live="polite"
          >
            {history.map((line, idx) => (
              <div key={idx} className={`break-words whitespace-pre-wrap leading-relaxed select-text ${TONE_CLASS[line.tone]}`}>
                {line.text}
              </div>
            ))}
            {isBooting && (
              <div className="text-signal-green/50 animate-pulse">▋</div>
            )}
            <div ref={consoleBottomRef} />
          </div>
          <div
            ref={consoleCueRef}
            className="room-scroll-cue pointer-events-none absolute inset-0 hidden"
            style={{ '--scroll-cue-base': 'rgba(5, 5, 5, 0.9)' } as React.CSSProperties}
            aria-hidden="true"
          >
            <div className="room-scroll-cue-fade absolute inset-x-0 bottom-0 h-10" />
            <div className="room-scroll-cue-tick absolute right-0 top-0 h-full w-[2px]" />
          </div>
        </div>

        {/* Input Panel */}
        {!isBooting && (
          <div className="relative z-40 shrink-0 space-y-3 border-t border-signal-green/20 pt-3 sm:space-y-4 sm:pt-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {quickCommands.map(({ label, command, title, icon: Icon, highlight }) => (
                <button
                  key={command}
                  onClick={() => void handleCommand(command)}
                  title={title}
                  aria-label={title}
                  className={`flex h-9 min-w-0 cursor-pointer items-center justify-center gap-2 rounded border px-2 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors hover:border-signal-green hover:bg-signal-green/10 hover:text-signal-green ${
                    highlight
                      ? 'border-amber-300/55 bg-amber-300/10 text-amber-200 animate-pulse'
                      : 'border-signal-green/25 text-signal-green/80'
                  }`}
                >
                  <Icon size={12} className="shrink-0" />
                  <span className="min-w-0 truncate">{label}</span>
                </button>
              ))}
            </div>

            {/* Input Line */}
            <div className="flex min-w-0 items-center gap-2 text-signal-green">
              <span className="text-sm font-bold animate-pulse">{">"}</span>
              <input
                ref={inputRef}
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={handleKeyDown}
                className="min-w-0 flex-1 bg-transparent border-none font-mono text-base uppercase text-signal-green outline-none caret-signal-green placeholder:text-[10px] placeholder:tracking-[0.1em] sm:text-sm"
                maxLength={60}
                placeholder="INPUT PROTOCOL COMMAND..."
                autoFocus
              />
              <button
                onClick={() => handleCommand(inputVal)}
                className="flex shrink-0 cursor-pointer items-center gap-1 rounded border border-signal-green/30 px-2 py-2 text-[10px] uppercase hover:border-signal-green hover:bg-signal-green/10 sm:py-1"
              >
                <CornerDownLeft size={10} />
                EXEC
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
