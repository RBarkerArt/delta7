import React, { useState, useEffect, useRef } from 'react';
import { useCoherence } from '../hooks/useCoherence';
import { useSound } from '../hooks/useSound';
import { Terminal, CornerDownLeft, X, BookOpen, FileText, Ghost, Search, type LucideIcon } from 'lucide-react';
import type { DayLog, ReturnSignalReport } from '../types/schema';
import { db } from '../lib/firebase';
import { doc, getDoc, collection, query, getDocs, where } from 'firebase/firestore';
import { getReturnPacketRecoveryId } from '../lib/dailyRecovery';
import { useAuth } from '../hooks/useAuth';
import type { BreakRoomObserverState } from '../lib/breakRoom';

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
  const { playClick } = useSound();
  const [history, setHistory] = useState<string[]>([]);
  const [inputVal, setInputVal] = useState('');
  const [isBooting, setIsBooting] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const consoleBottomRef = useRef<HTMLDivElement>(null);

  const activeTerminalDay = dayData?.day || currentDay;

  const resolveDayLog = async (targetDay: number): Promise<DayLog | null> => {
    if (dayData?.day === targetDay) {
      return dayData;
    }

    const dayDocRef = doc(db, 'season1_days', `day_${targetDay}`);
    const snap = await getDoc(dayDocRef);
    return snap.exists() ? snap.data() as DayLog : null;
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

  // Sound and booting triggers + dynamic history setup
  useEffect(() => {
    if (isOpen) {
      const isPendingConfirm = returnSignal && !recoveredItems.includes(getReturnPacketRecoveryId(currentDay));

      const lines = [
        'DELTA-7 COHERENCE LINK ESTABLISHED.',
        'MONITOR STATUS: NOMINAL',
        `COHERENCE RATING: ${score.toFixed(1)}% (${state})`,
        'CONNECTION: ' + (isAnchored ? 'SECURED_ANCHOR' : 'UNVERIFIED_TEMPORAL_BREACH'),
        'Type "guide" for a discovery path or "help" for active protocols.',
        ''
      ];

      if (isPendingConfirm) {
        if (returnSignal.reason === 'catchup_return') {
          lines.push(
            '*** WARNING: TEMPORAL DRIFT DETECTED ***',
            `The system registered a drift of +${returnSignal.dayDelta} days since last verification.`,
            'Unfiled interval packets are buffered in local memory.',
            '',
            'To execute and file the return packets, type: "confirm"',
            '*****************************************',
            ''
          );
        } else {
          lines.push(
            '*** WARNING: NEW RETURN SIGNAL DETECTED ***',
            'The system registered a new interval return signal.',
            'An unfiled interval packet is buffered in local memory.',
            '',
            'To execute and file the return packet, type: "confirm"',
            '*****************************************',
            ''
          );
        }
      }

      setHistory(lines);
      setIsBooting(true);
      const timer = setTimeout(() => {
        setIsBooting(false);
        // Focus input after boot
        setTimeout(() => inputRef.current?.focus(), 100);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [isOpen, returnSignal, recoveredItems, currentDay]);

  // Keep scrolled to bottom
  useEffect(() => {
    consoleBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  if (!isOpen) return null;

  const appendToHistory = (line: string) => {
    setHistory((prev) => [...prev, line]);
  };

  const printGuide = () => {
    appendToHistory('DISCOVERY GUIDE:');
    appendToHistory('  1. status - Check the current signal state.');
    appendToHistory('  2. logs - See which daily records are available.');
    appendToHistory(`  3. read ${activeTerminalDay} - Read today's VM log.`);
    appendToHistory(`  4. fragment ${activeTerminalDay} - Recover today's fragment text.`);
    appendToHistory('  5. recall - Read the return packet once it is filed.');
    appendToHistory('');
    appendToHistory('Day numbers work across story commands: read 1, fragments 1, fragment 1.');
  };

  const printHelp = () => {
    appendToHistory('ACTIVE PROTOCOLS:');
    appendToHistory('  guide - Show a recommended story discovery path.');
    appendToHistory('  status - Query signal telemetry and coherence logs.');
    appendToHistory('  logs - List recorded logs in this temporal node.');
    appendToHistory('  read [day] - Print VM log body. Example: read 1');
    appendToHistory('  fragment [day] - Recover fragment text. Example: fragment 1');
    appendToHistory('  fragments [day] - List visible fragment slots for a day.');
    appendToHistory('  decrypt [id] - Legacy resolver for exact fragment IDs.');
    appendToHistory('  recall - Print the filed return packet.');
    appendToHistory('  confirm - Execute and file pending return signal packets.');
    appendToHistory('  tune [code] - Restore an observation record by frequency.');
    appendToHistory('  signals - List all recovered signals.');
    appendToHistory('  signals verified - List verified signals.');
    appendToHistory('  signals unverified - List unverified/overtuned signals.');
    appendToHistory('  signals read [id] - Read a recovered signal. Example: signals read sig_001');
    appendToHistory('  tuning log - View coil tuning transaction logs.');
    appendToHistory('  mg - Explain Residue Mass (mg).');
    appendToHistory('  audio [on/off] - Toggle audio signals.');
    appendToHistory('  clear - Flush terminal screen memory.');
    appendToHistory('  exit - Disconnect terminal link.');
  };

  const assertValidDay = (targetDayNum: number): boolean => {
    if (isNaN(targetDayNum) || targetDayNum < 1 || targetDayNum > currentDay) {
      appendToHistory(`ERROR: Day must be a number between 1 and ${currentDay}.`);
      return false;
    }

    return true;
  };

  const revealFragmentsForDay = async (targetDayNum: number) => {
    appendToHistory(`ACCESSING FRAGMENT ARCHIVE: DAY_${targetDayNum}...`);

    let fragments: DayLog['fragments'] = [];
    try {
      const data = await resolveDayLog(targetDayNum);
      fragments = data?.fragments || [];
    } catch {
      appendToHistory('ERROR: Fragment index could not be resolved.');
      return;
    }

    if (fragments.length === 0) {
      appendToHistory(`NO FRAGMENTS VISIBLE IN DAY_${targetDayNum}.`);
      return;
    }

    appendToHistory(`--- FRAGMENTS: DAY_${targetDayNum} ---`);
    for (const fragment of fragments) {
      await markRecovered(`fragment:${fragment.id}`);
      appendToHistory(`[${fragment.severity || 'UNCLASSIFIED'}] ${fragment.body}`);
    }
    appendToHistory('------------------------');
  };

  const handleCommand = async (cmdStr: string) => {
    const trimmed = cmdStr.trim();
    if (!trimmed) return;

    appendToHistory(`> ${trimmed}`);
    setInputVal('');

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

      case 'status': {
        const observerResidue = Math.max(0, observerState?.milligrams || 0).toFixed(2);
        const recoveredCount = recoveredItems.filter(id => id.startsWith('signal:')).length;
        const unverifiedCount = recoveredItems.filter(id => id.startsWith('unverified:')).length;

        appendToHistory('TELEMETRY STATUS:');
        appendToHistory(`  COHERENCE:          ${score.toFixed(2)}%`);
        appendToHistory(`  SIGNAL_STATE:       ${state}`);
        appendToHistory(`  RESIDUE MASS:       ${observerResidue} mg`);
        appendToHistory(`  RECOVERED SIGNALS:  ${recoveredCount}`);
        appendToHistory(`  UNVERIFIED SIGNALS: ${unverifiedCount}`);
        appendToHistory(`  CURRENT_DAY:        Day ${currentDay}`);
        appendToHistory(`  IDENTITY_LOCK:      ${isAnchored ? 'ANCHORED' : 'UNLINKED_BREACH'}`);
        appendToHistory(`  FREQUENCY_ID:       ${accessCode || 'UNASSIGNED'}`);
        break;
      }

      case 'signals': {
        const subCommand = args[0]?.toLowerCase();
        
        appendToHistory('FETCHING SIGNALS FROM SYSTEM ARCHIVE...');
        try {
          const colRef = collection(db, 'system', 'cartography', 'tuning_signals');
          const snap = await getDocs(colRef);
          const allSignals = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));

          const verified = allSignals.filter(sig => sig.type === 'verified' && recoveredItems.includes(`signal:${sig.id}`));
          const unverified = allSignals.filter(sig => sig.type === 'unverified' && recoveredItems.includes(`unverified:${sig.id}`));

          if (subCommand === 'read') {
            const targetId = args[1]?.toLowerCase();
            if (!targetId) {
              appendToHistory('ERROR: Please specify a signal ID. Example: signals read sig_001');
              break;
            }
            const match = allSignals.find(s => s.id.toLowerCase() === targetId);
            if (match) {
              const isVerified = match.type === 'verified' && recoveredItems.includes(`signal:${match.id}`);
              const isUnverified = match.type === 'unverified' && recoveredItems.includes(`unverified:${match.id}`);
              if (isVerified || isUnverified) {
                appendToHistory('');
                appendToHistory(`SIGNAL:    [${match.id}] ${match.title.toUpperCase()}`);
                appendToHistory(`TYPE:      ${match.type.toUpperCase()}`);
                appendToHistory(`CATEGORY:  ${match.category.toUpperCase()}`);
                appendToHistory(`CONTENT:`);
                appendToHistory(`  "${match.text}"`);
                appendToHistory('');
              } else {
                appendToHistory(`ERROR: Signal ID [${match.id}] is not coherent in this temporal node.`);
              }
            } else {
              appendToHistory(`ERROR: Signal ID [${args[1]}] not found.`);
            }
            break;
          }

          if (verified.length === 0 && unverified.length === 0) {
            appendToHistory('NO RECOVERED OR UNVERIFIED SIGNALS RECORDED.');
            appendToHistory('Tuning in Signal Cartography is required.');
            break;
          }

          if (!subCommand || subCommand === 'verified' || subCommand === '--recovered') {
            if (verified.length > 0) {
              appendToHistory('--- RECOVERED SIGNALS (VERIFIED) ---');
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
              appendToHistory('--- UNVERIFIED SIGNALS (OVERTUNED) ---');
              unverified.forEach(sig => {
                appendToHistory(`  [${sig.id}] ${sig.title} (${sig.category.toUpperCase()})`);
              });
            } else if (subCommand) {
              appendToHistory('NO UNVERIFIED SIGNALS RECORDED.');
            }
          }
          
          appendToHistory('');
          appendToHistory('To read a signal, type: signals read [id]');
        } catch (err) {
          appendToHistory('ERROR: Failed to retrieve signals from system database.');
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
        appendToHistory('QUERYING COIL TUNING TRANSACTION HISTORY...');
        try {
          const logsCol = collection(db, 'observer_tuning_logs');
          const q = query(logsCol, where('observerId', '==', visitorId || 'anon'));
          const snap = await getDocs(q);

          if (snap.empty) {
            appendToHistory('NO TUNING LOGS FOUND IN COIL MEMORY.');
            break;
          }

          const logsList = snap.docs
            .map(d => ({ id: d.id, ...d.data() } as any))
            .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));

          appendToHistory('--- COIL TUNING LOG ---');
          logsList.forEach(log => {
            const typeStr = log.tuningType === 'tune' ? 'TUNE' : 'OVERTUNE';
            const elapsedStr = log.elapsed || '1.0s';
            appendToHistory(`  [Day ${String(log.dayProgress).padStart(3, '0')}] ${typeStr} (-${log.cost} mg) -> ${log.title} (${elapsedStr} contact)`);
          });
        } catch (err) {
          appendToHistory('ERROR: Failed to query tuning log.');
          if (import.meta.env.DEV) console.error(err);
        }
        break;
      }

      case 'mg':
      case 'residue': {
        appendToHistory('RESIDUE MASS EXPLANATION:');
        appendToHistory('  "Milligrams are a convenience label.');
        appendToHistory('   The system insists on measuring attention as mass.');
        appendToHistory('   I have stopped correcting it."');
        appendToHistory('      -- Dr. Kael, Cartography Notes');
        break;
      }

      case 'logs':
        appendToHistory('ARCHIVED SIGNAL LOGS IN CELL:');
        for (let i = 1; i <= currentDay; i++) {
          appendToHistory(`  - Day ${i}: LOG_RECORDS_ACTIVE`);
        }
        break;

      case 'read': {
        const targetDayNum = parseRequestedDay(args[0], activeTerminalDay);
        if (!assertValidDay(targetDayNum)) break;

        appendToHistory(`ACCESSING LOG ARCHIVE: DAY_${targetDayNum}...`);
        try {
          const data = await resolveDayLog(targetDayNum);
          if (data) {
            const logObj = data.vm_logs?.[state] || data.vm_logs?.['FEED_STABLE'];
            if (logObj?.body) {
              await markRecovered(`vm:${targetDayNum}`);
              appendToHistory(`--- LOG: ${logObj.title || 'UNNAMED'} ---`);
              const paragraphs = logObj.body.split('\n');
              paragraphs.forEach(p => appendToHistory(p));
              appendToHistory('------------------------');
            } else {
              appendToHistory('ERROR: Log body empty for this state.');
            }
          } else {
            appendToHistory('ERROR: Log document not found in Firestore.');
          }
        } catch {
          appendToHistory('ERROR: Access denied. Remote database query failed.');
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
          appendToHistory('ERROR: Fragment index could not be resolved.');
          break;
        }

        if (fragments.length === 0) {
          appendToHistory(`NO FRAGMENT SLOTS VISIBLE IN DAY_${targetDayNum}.`);
          break;
        }

        appendToHistory(`VISIBLE FRAGMENT SLOTS: DAY_${targetDayNum}`);
        appendToHistory(`  Read with: fragment ${targetDayNum}`);
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
          appendToHistory('ERROR: Please specify a fragment. Try: fragment 1');
          appendToHistory('Legacy exact ID example: decrypt frag_0001_a');
          break;
        }

        const requestedDay = args[1] ? parseInt(args[1], 10) : getFragmentDayHint(fragId) || activeTerminalDay;
        if (isNaN(requestedDay) || requestedDay < 1 || requestedDay > currentDay) {
          appendToHistory(`ERROR: Fragment day must be between 1 and ${currentDay}.`);
          break;
        }

        let match: DayLog['fragments'][number] | undefined;
        try {
          const data = await resolveDayLog(requestedDay);
          match = data?.fragments?.find((f) => f.id.toLowerCase() === fragId.toLowerCase());
        } catch {
          appendToHistory('ERROR: Fragment index could not be resolved.');
          break;
        }

        if (match) {
          await markRecovered(`fragment:${match.id}`);
          appendToHistory(`DECRYPTING SIGNAL FRAGMENT: ${fragId}`);
          appendToHistory(`[DECRYPTED]: "${match.body}"`);
        } else {
          appendToHistory(`ERROR: Fragment ID "${fragId}" is not visible in DAY_${requestedDay}.`);
        }
        break;
      }

      case 'confirm': {
        const isPendingConfirm = returnSignal && !recoveredItems.includes(getReturnPacketRecoveryId(currentDay));
        if (!isPendingConfirm) {
          appendToHistory('SYSTEM: No pending return packets require confirmation.');
          break;
        }

        appendToHistory('EXECUTING RETURN PACKETS...');
        appendToHistory('---------------------------------------------');

        if (returnPackets && returnPackets.length > 0) {
          returnPackets.forEach(pkt => {
            appendToHistory(`DAY ${String(pkt.day).padStart(3, '0')} INTERVAL RECORD:`);
            appendToHistory(`  "${pkt.text}"`);
            appendToHistory('');
          });
        } else {
          appendToHistory('No return packets found in buffer.');
        }

        appendToHistory('---------------------------------------------');
        appendToHistory('RETURN SIGNAL PACKETS EXECUTED AND FILED.');
        appendToHistory('Coherence link stabilized.');
        appendToHistory('');

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
          appendToHistory('RETURN PACKET EXISTS. FILE ACCESS NOT YET RECOVERED.');
          break;
        }

        appendToHistory(`RETURN PACKET: DAY_${packetDay}`);
        appendToHistory(returnPacket);
        break;
      }

      case 'tune': {
        const code = args[0];
        if (!code) {
          appendToHistory('ERROR: Missing frequency code. Usage: tune XXX-XXX');
          break;
        }
        appendToHistory(`TUNING TO FREQUENCY: ${code}...`);
        try {
          // Trigger matching routine
          await ensureUser();
          appendToHistory('SIGNAL SYNCHRONIZED. IDENTITY ANCHOR VERIFIED.');
        } catch {
          appendToHistory('ERROR: Frequency alignment failed. Sync rejected.');
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
        appendToHistory(`COMMAND NOT RECOGNIZED: "${command}". Type "guide" for a discovery path or "help" for protocols.`);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCommand(inputVal);
    }
  };

  const quickCommands: Array<{
    label: string;
    command: string;
    title: string;
    icon: LucideIcon;
  }> = [
    { label: 'Guide', command: 'guide', title: 'Show discovery guide', icon: BookOpen },
    { label: `Log ${activeTerminalDay}`, command: `read ${activeTerminalDay}`, title: `Read day ${activeTerminalDay} log`, icon: FileText },
    { label: `Fragment ${activeTerminalDay}`, command: `fragment ${activeTerminalDay}`, title: `Read day ${activeTerminalDay} fragments`, icon: Ghost },
    { label: 'Index', command: `fragments ${activeTerminalDay}`, title: `List day ${activeTerminalDay} fragment slots`, icon: Search },
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

        {/* Console Log Area */}
        <div className="relative z-40 mb-3 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-2 text-sm leading-6 text-signal-green space-y-1 custom-scrollbar sm:mb-4" role="log" aria-live="polite">
          {isBooting ? (
            <div className="flex flex-col items-center justify-center h-full space-y-2">
              <div className="w-12 h-12 border-2 border-t-transparent border-signal-green rounded-full animate-spin" />
              <div className="text-xs tracking-widest animate-pulse">CONNECTING PROTOCOL TRANSMISSION...</div>
            </div>
          ) : (
            <>
              {history.map((line, idx) => (
                <div key={idx} className="break-words whitespace-pre-wrap leading-relaxed select-text">
                  {line}
                </div>
              ))}
              <div ref={consoleBottomRef} />
            </>
          )}
        </div>

        {/* Input Panel */}
        {!isBooting && (
          <div className="relative z-40 shrink-0 space-y-3 border-t border-signal-green/20 pt-3 sm:space-y-4 sm:pt-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {quickCommands.map(({ label, command, title, icon: Icon }) => (
                <button
                  key={command}
                  onClick={() => void handleCommand(command)}
                  title={title}
                  aria-label={title}
                  className="flex h-9 min-w-0 cursor-pointer items-center justify-center gap-2 rounded border border-signal-green/25 px-2 text-[10px] font-bold uppercase tracking-[0.12em] text-signal-green/80 transition-colors hover:border-signal-green hover:bg-signal-green/10 hover:text-signal-green"
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
                onKeyDown={handleKeyPress}
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
