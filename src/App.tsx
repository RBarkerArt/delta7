import React, { useEffect, useState, useCallback, useRef } from 'react';
import { CoherenceProvider, useCoherence } from './context/CoherenceContext';
import { db } from './lib/firebase';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import type { DayLog } from './types/schema';
import { Activity, Terminal, Volume2, VolumeX, Lock, Shield } from 'lucide-react';
import { DebugPanel } from './components/DebugPanel';
import { GlitchText } from './components/GlitchText';

import { Fragment } from './components/Fragment';
import { ScreenEffects } from './components/ScreenEffects';
import { BackgroundAtmosphere } from './components/BackgroundAtmosphere';
import { EvidenceViewer } from './components/EvidenceViewer';
import { Prologue } from './components/Prologue';
import { soundEngine } from './lib/SoundEngine';
import { AudioAtmosphere } from './components/AudioAtmosphere';
import { AuthModal } from './components/AuthModal';
import prologueData from './season1_prologues.json';

const AUTO_PROGRESS_DELAY = 4000; // Slightly longer to allow reading through glitches
const TYPING_SPEED = 30;
const GLITCH_CHARS = '!@#$%^&*()_+-=[]{}|;:,.<>?/\\';

const LabInterface: React.FC = () => {
  const { score, state, loading, user, currentDay, isAnchored, isAdmin, ensureUser } = useCoherence();
  const [dayData, setDayData] = useState<DayLog | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [isPrologueActive, setIsPrologueActive] = useState(true);
  const [selectedPrologue, setSelectedPrologue] = useState<string>('');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Sequencer state
  const [lines, setLines] = useState<string[]>([]);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isComplete, setIsComplete] = useState(false);

  const autoProgressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const scoreRef = useRef(score);

  // Keep scoreRef in sync
  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  // Effect 1: Handle Prologue Setup when day changes
  useEffect(() => {
    if (loading) return;
    const fetchPrologue = async () => {
      try {
        const prologueRef = doc(db, 'season1_prologues', `day_${currentDay}`);
        const prologueDoc = await getDoc(prologueRef);

        if (prologueDoc.exists()) {
          const data = prologueDoc.data() as { sentences: string[] };
          const randomIndex = Math.floor(Math.random() * data.sentences.length);
          setSelectedPrologue(data.sentences[randomIndex]);
        } else {
          throw new Error('Firestore document missing');
        }
      } catch (error) {
        console.warn('Falling back to local prologue data:', error);
        const dayPrologue = prologueData.find(p => p.day === currentDay);
        if (dayPrologue && dayPrologue.sentences.length > 0) {
          const randomIndex = Math.floor(Math.random() * dayPrologue.sentences.length);
          setSelectedPrologue(dayPrologue.sentences[randomIndex]);
        } else {
          setSelectedPrologue(prologueData[0].sentences[0]);
        }
      }
    };

    fetchPrologue();

    // Reset state for new day
    setIsPrologueActive(true);
    setDayData(null);
    setLines([]);
    setCurrentLineIndex(0);
    setDisplayedText('');
    setIsComplete(false);
  }, [currentDay]);

  // Effect 2: Real-time listener for day data
  useEffect(() => {
    if (isPrologueActive) return;

    setDataLoading(true);
    const dayId = `day_${currentDay}`;
    const dayRef = doc(db, 'season1_days', dayId);

    const unsubscribe = onSnapshot(dayRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data() as DayLog;
        setDayData(data);
      }
      setDataLoading(false);
    }, (error) => {
      console.error('Error listening to day data:', error);
      setDataLoading(false);
    });

    return () => unsubscribe();
  }, [currentDay, isPrologueActive]);

  // Effect 3: Sequence builder
  useEffect(() => {
    if (!dayData || isPrologueActive) return;

    const currentLog = dayData.vm_logs?.[state] || dayData.vm_logs?.['FEED_STABLE'];
    const logBody = currentLog?.body || '';
    // Split by period followed by space, or by double newline.
    // We replace the period/delimiter with a marker to split while keeping the delimiter.
    const newLines = logBody
      .replace(/([.!?])\s+/g, "$1|")
      .split("|")
      .filter(l => l.trim() !== '');

    // Only reset if the content for the current state actually changed
    // This prevents jarring resets when other states or images are edited
    const currentLinesJoined = lines.join('|');
    const newLinesJoined = newLines.join('|');

    if (currentLinesJoined !== newLinesJoined) {
      setLines(newLines);
      setCurrentLineIndex(0);
      setDisplayedText('');
      setIsComplete(false);
    }

    // Trigger "glitch" transition visual feedback
    const interface_el = document.querySelector('.scanlines');
    if (interface_el) {
      interface_el.classList.add('glitch-intense');
      setTimeout(() => interface_el.classList.remove('glitch-intense'), 1000);
    }
  }, [state, dayData, isPrologueActive, lines]);

  // Progression logic
  const moveToNextLine = useCallback(() => {
    if (autoProgressTimer.current) clearTimeout(autoProgressTimer.current);

    if (currentLineIndex < lines.length - 1) {
      setCurrentLineIndex(prev => prev + 1);
      setDisplayedText('');
      setIsComplete(false);
    } else {
      setIsComplete(true);
    }
  }, [currentLineIndex, lines.length]);

  const finishCurrentLine = useCallback(() => {
    if (typingTimer.current) clearTimeout(typingTimer.current);
    setDisplayedText(lines[currentLineIndex]);
    setIsTyping(false);

    // Dynamic delay: Silence between lines feels longer as coherence drops
    const currentScore = scoreRef.current;
    const dynamicDelay = AUTO_PROGRESS_DELAY + (100 - currentScore) * 40;

    // Start auto-progress timer
    if (currentLineIndex < lines.length - 1) {
      autoProgressTimer.current = setTimeout(moveToNextLine, dynamicDelay);
    } else {
      setIsComplete(true);
    }
  }, [lines, currentLineIndex, moveToNextLine]);



  // Stabilize prologue finish callback to prevent re-renders in child
  const handlePrologueComplete = useCallback(async () => {
    console.log('[Delta-7] Prologue stabilized. Inducing witness identity...');
    try {
      await ensureUser();
    } catch (err) {
      console.error('[Delta-7] Feed induction failure:', err);
    }
    setIsPrologueActive(false);
  }, [ensureUser]);

  // Auto-progress timer for ambient feel
  useEffect(() => {
    if (isPrologueActive || isComplete || dataLoading || !dayData) return;

    const timer = setInterval(() => {
      if (!isTyping) {
        moveToNextLine();
      }
    }, 12000); // Progress every 12s if nothing manual happens

    return () => clearInterval(timer);
  }, [isPrologueActive, isComplete, dataLoading, dayData, isTyping, moveToNextLine]);

  // Handle automatic audio initialization on first user interaction
  useEffect(() => {
    const initAudio = () => {
      soundEngine.init();
      // Only need to do this once
      window.removeEventListener('click', initAudio);
      window.removeEventListener('keydown', initAudio);
    };

    window.addEventListener('click', initAudio);
    window.addEventListener('keydown', initAudio);

    return () => {
      window.removeEventListener('click', initAudio);
      window.removeEventListener('keydown', initAudio);
    };
  }, []);

  // Typing effect
  useEffect(() => {
    if (lines.length === 0 || currentLineIndex >= lines.length || isComplete) return;

    const textToType = lines[currentLineIndex];
    let index = 0;
    setIsTyping(true);

    // Capture score AT THE START of the sentence for stable timing
    const sentenceStartScore = scoreRef.current;

    const typeNextChar = () => {
      if (index >= textToType.length) {
        finishCurrentLine();
        return;
      }

      const char = textToType[index];
      const variance = sentenceStartScore < 60 ? Math.random() * (100 - sentenceStartScore) * 0.5 : 0;
      const glitchProbability = sentenceStartScore < 30 ? 0.15 : sentenceStartScore < 60 ? 0.05 : 0.01;
      const isGlitch = Math.random() < glitchProbability;

      if (isGlitch) {
        const randomChar = GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
        setDisplayedText(prev => prev + randomChar);
        if (isAudioEnabled) soundEngine.playClick();
        setTimeout(() => {
          setDisplayedText(prev => prev.slice(0, -1) + char);
        }, TYPING_SPEED / 2);
      } else {
        setDisplayedText(prev => prev + char);
        if (isAudioEnabled) soundEngine.playClick();
      }

      index++;

      const nextDelay = (sentenceStartScore < 40 ? TYPING_SPEED * 1.5 : TYPING_SPEED) + variance + (sentenceStartScore < 70 ? Math.random() * 20 : 0);
      typingTimer.current = setTimeout(typeNextChar, nextDelay);
    };

    typingTimer.current = setTimeout(typeNextChar, TYPING_SPEED);

    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLineIndex, lines, finishCurrentLine, isComplete]);

  // Debug visibility
  useEffect(() => {
    if (user) {
      console.log('[Delta-7] Anchor Visibility Check:', {
        day: currentDay,
        anchored: isAnchored,
        anonymous: user.isAnonymous,
        uid: user.uid.slice(0, 8),
        visible: (currentDay >= 30 || isAdmin || isAnchored || !user.isAnonymous)
      });
    }
  }, [currentDay, isAdmin, isAnchored, user]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-lab-black text-signal-green font-mono">
        <div className="animate-pulse">{">"} INITIALIZING FEED...</div>
      </div>
    );
  }

  // Refined penalties: Less blur, higher minimum opacity
  const blurAmount = Math.min(0.8, Math.max(0, (100 - score) / 80));
  const opacityAmount = Math.max(0.7, score / 100);

  // Variable Logic
  // @ts-ignore
  const flickerDelay = dayData?.variables?.flicker || 1;
  // @ts-ignore
  const driftIntensity = dayData?.variables?.drift || 1;

  // Use live score for visual effects
  const glitchClass = score < 20 ? 'glitch-heavy' : score < 70 ? 'glitch-subtle' : '';
  const scanlineClass = score < 50 ? 'scanlines-active' : '';
  const driftClass = driftIntensity > 1 ? 'animate-drift-screen' : '';

  return (
    <>
      {isPrologueActive && (
        <Prologue
          sentence={selectedPrologue}
          onComplete={handlePrologueComplete}
        />
      )}

      {isAudioEnabled && <AudioAtmosphere />}

      <div
        className={`relative min-h-screen w-full bg-lab-black text-signal-green font-mono scanlines p-4 sm:p-8 flex flex-col transition-colors duration-1000 overflow-x-hidden ${glitchClass} ${scanlineClass} ${driftClass}`}
      >
        <div className="fixed inset-0 z-0 opacity-0 sm:opacity-100" />
        <BackgroundAtmosphere score={score} />
        <ScreenEffects flickerLevel={flickerDelay} driftLevel={driftIntensity} />

        {/* Header */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-signal-green/30 pb-4 mb-4 sm:mb-8 select-none relative z-10">
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <Terminal size={24} className="text-signal-green shrink-0" />
            <div className="min-w-0 flex items-center gap-3">
              <div className={`text-sm sm:text-base font-bold truncate ${score < 30 ? 'text-decay-red' : 'text-signal-green'}`}>
                <GlitchText text={state} coherenceScore={score} />
              </div>

              <button
                onClick={() => {
                  const newState = !isAudioEnabled;
                  setIsAudioEnabled(newState);
                  soundEngine.setMuted(!newState);
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-all duration-300 border ${isAudioEnabled
                  ? 'border-signal-green text-signal-green bg-signal-green/5 opacity-100 shadow-[0_0_10px_rgba(20,184,166,0.1)]'
                  : 'border-white/10 text-white/30 hover:border-white/30 hover:text-white/60 bg-white/5'
                  }`}
                title={isAudioEnabled ? "Silence Feed" : "Initialize Audio"}
              >
                {isAudioEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                <span className="text-[10px] font-mono tracking-[0.2em] uppercase hidden sm:inline">
                  {isAudioEnabled ? 'Audio_Active' : 'Audio_Offline'}
                </span>
              </button>

              {(currentDay >= 30 || isAdmin || isAnchored || (user && !user.isAnonymous)) && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      // ENSURE_IDENTITY: Before showing the anchor interface, we must
                      // guarantee a session exists (anonymous or otherwise) to allow linking.
                      try {
                        await ensureUser();
                        setIsAuthModalOpen(true);
                      } catch (err) {
                        console.error('[Delta-7] Auth: Pre-synchronization failure:', err);
                      }
                    }}
                    className={`flex items-center justify-center w-8 h-8 rounded-full transition-all duration-1000 group hover:scale-110 ${isAnchored
                      ? 'bg-emerald-500/10 border border-emerald-500/50 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                      : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/20 animate-pulse-gentle'
                      }`}
                    title={isAnchored ? "Connection Stable" : "Establish Anchor"}
                  >
                    {isAnchored ? (
                      <Shield size={14} className="drop-shadow-[0_0_2px_rgba(16,185,129,1)]" />
                    ) : (
                      <Lock size={14} />
                    )}
                  </button>
                  {/* DIAGNOSTIC COMPONENT: Only visible if isAnchored is true to confirm state */}
                  {isAnchored && (
                    <span className="text-[8px] text-emerald-500/40 font-mono uppercase tracking-tighter hidden lg:inline">
                      [ANCHOR_LOCKED]
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-1 w-full sm:w-64">
            <div className="flex justify-between items-end w-full px-1">
              <span className={`text-[9px] uppercase tracking-widest animate-pulse ${score < 100 ? 'opacity-40' : 'opacity-0'}`}>
                {score < 100 ? 'STABILIZING...' : ''}
              </span>
              <span className="text-[10px] text-signal-green/50">
                {(score).toFixed(1)}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-lab-gray border border-signal-green/10 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-[3000ms] linear ${score > 70 ? 'bg-signal-green' : score > 30 ? 'bg-signal-amber' : 'bg-decay-red'
                  }`}
                style={{ width: `${score}%` }}
              />
            </div>
          </div>
        </header>

        {/* Main Display */}
        <main className="flex-1 flex flex-col max-w-4xl mx-auto w-full relative z-10">
          <div className="absolute top-0 left-0 text-[10px] text-signal-green/20 select-none">
            FEED_07_VM5_COH:{score}
          </div>

          <div
            className="mt-8 sm:mt-12 transition-all duration-700"
            style={{
              filter: `blur(${blurAmount}px)`,
              opacity: opacityAmount
            }}
          >
            {dataLoading ? (
              <div className="text-signal-green/50 italic">{">"} ACCESSING ARCHIVE...</div>
            ) : (
              <div className="space-y-6 sm:space-y-8">
                <div className="flex items-center gap-2 text-signal-amber text-xs border-l-2 border-signal-amber pl-2 select-none">
                  <Activity size={14} />
                  <span>
                    <GlitchText text={dayData?.vm_logs?.[state]?.title || dayData?.vm_logs?.['FEED_STABLE']?.title || 'UNNAMED_LOG'} coherenceScore={score} />
                  </span>
                </div>

                <div className="text-base sm:text-lg leading-relaxed space-y-4 sm:space-y-6">
                  {lines.slice(0, isComplete ? lines.length : currentLineIndex).map((line, i) => (
                    <p key={i} className="opacity-70">
                      <GlitchText text={line} coherenceScore={score} />
                    </p>
                  ))}

                  {!isComplete && (
                    <p className="relative min-h-[1.5em]">
                      {displayedText}
                      {isTyping && <span className="inline-block w-2 h-5 bg-signal-green ml-1 animate-pulse align-middle" />}
                    </p>
                  )}
                </div>

                {dayData?.images && dayData.images.filter(img => !img.placeholder && img.id && img.id.trim() !== '').length > 0 && (
                  <div className="space-y-6 sm:space-y-8 mt-8 sm:mt-12 animate-in fade-in duration-1000">
                    {dayData.images
                      .filter(img => !img.placeholder && img.id && img.id.trim() !== '')
                      .map((img) => (
                        <EvidenceViewer key={img.id} image={img} coherenceScore={score} />
                      ))}
                  </div>
                )}

                {isComplete && (
                  <div className="pt-8 sm:pt-12 text-center select-none">
                    <span className="text-signal-green/30 text-[10px] animate-pulse">
                      --- END OF TRANSMISSION ---
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>

        <footer className="mt-8 pt-4 border-t border-signal-green/10 flex flex-col sm:flex-row justify-between gap-2 text-[10px] text-signal-green/30 select-none relative z-10">
          <div>DELTA-7_LAB_ENV: PROXIMITY_LOCK_ACTIVE</div>
          <div className="sm:text-right">OBSERVER_RECORD: {user?.uid.slice(0, 8)}...</div>
        </footer>
      </div>

      {/* Ghost Thoughts Layer - Higher than everything else, placed last in DOM */}
      <div className="fixed inset-0 pointer-events-none z-[9999]">
        {!dataLoading && dayData?.fragments?.map((frag, idx) => {
          // EXCLUSIVE STATE CYCLING:
          // 1. Check if ANY fragment in the list matches the current state exactly
          const hasExactMatch = dayData.fragments.some(f => f.severity === state);

          // 2. If an exact match exists, only show fragments matching that state
          // 3. If no exact match exists, fallback to displaying the first fragment (legacy/original support)
          const isCorrectState = hasExactMatch
            ? frag.severity === state
            : idx === 0;

          // STAGGERED MANIFESTATION:
          // For a natural feel, we still use reading progress thresholds
          const triggerThreshold = (idx + 1) * 0.12;
          const logProgress = lines.length > 0 ? (currentLineIndex + 1) / lines.length : 0;

          // Immediate manifestation if it's an exact state match (for testing/responsive feedback)
          // or if the progress threshold is met (for visitor immersion)
          const isManifested = (hasExactMatch && isCorrectState) || logProgress >= triggerThreshold || isComplete;

          const isVisible = isCorrectState && isManifested;

          // DIAGNOSTIC_TAP: Log lifecycle for every fragment to the console
          console.debug(`[Ghost_Trace] ID:${frag.id} | State:${state} | Need:${frag.severity || 'DEFAULT'} | Match:${isCorrectState} | FinalVisible:${isVisible}`);

          return (
            <Fragment
              key={frag.id}
              id={frag.id}
              body={frag.body}
              severity={frag.severity}
              coherenceScore={score}
              isVisible={isVisible}
            />
          );
        })}
      </div>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </>
  );
};

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AdminLogin } from './components/AdminLogin';
import { AdminLayout } from './components/AdminLayout';
import { DashboardOverview } from './components/DashboardOverview';
import { NarrativeManager } from './components/NarrativeManager';
import { PrologueManager } from './components/PrologueManager';
import { ObserverDirectory } from './components/ObserverDirectory';
import { NarrativeReader } from './components/NarrativeReader';
import { ProtectedRoute } from './components/ProtectedRoute';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Lab Feed */}
          <Route path="/" element={
            <CoherenceProvider>
              <LabInterface />
              <DebugPanel />
            </CoherenceProvider>
          } />

          {/* Admin Routes */}
          <Route path="/admin/login" element={<AdminLogin />} />

          <Route path="/admin" element={<ProtectedRoute />}>
            <Route element={<AdminLayout />}>
              <Route index element={<DashboardOverview />} />
              <Route path="logs" element={<NarrativeManager />} />
              <Route path="prologues" element={<PrologueManager />} />
              <Route path="narrative" element={<NarrativeReader />} />
              <Route path="observers" element={<ObserverDirectory />} />
              {/* Future admin routes will go here */}
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
