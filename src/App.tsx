import React, { useEffect, useState, useCallback, useRef, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HelmetProvider, Helmet } from 'react-helmet-async';
import { initAppCheck } from './lib/appCheck';
import { useCoherence } from './hooks/useCoherence';
import { CoherenceProvider } from './context/CoherenceContext';
import { AuthProvider } from './context/AuthContext';
import { db } from './lib/firebase';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import type { DayLog } from './types/schema';
import { Activity, Terminal, Volume2, VolumeX, Lock, Shield } from 'lucide-react';
import { GlitchText } from './components/GlitchText';

import { Fragment } from './components/Fragment';
import { ScreenEffects } from './components/ScreenEffects';
import { BackgroundAtmosphere } from './components/BackgroundAtmosphere';
import { EvidenceViewer } from './components/EvidenceViewer';
import { Prologue } from './components/Prologue';
import { AudioAtmosphere } from './components/AudioAtmosphere';
import { AuthModal } from './components/AuthModal';
import { GlitchOverlay } from './components/GlitchOverlay';
import { AtmosphereManager } from './components/AtmosphereManager';
import { TuningInterface } from './components/TuningInterface'; // Project Signal
import { useSound } from './hooks/useSound';
import { DebugPanel } from './components/DebugPanel';
import { SystemStatusModal } from './components/SystemStatusModal';
import { ProtectedRoute } from './components/ProtectedRoute';
import prologueData from './season1_prologues.json';

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

const AUTO_PROGRESS_DELAY = 4000;
const TYPING_SPEED = 30;
const GLITCH_CHARS = '!@#$%^&*()_+-=[]{}|;:,.<>?/\\';

const LabInterface: React.FC = () => {
  const { score, state, loading, currentDay, isAnchored, isGlitching, ensureUser, accessCode } = useCoherence();
  const [dayData, setDayData] = useState<DayLog | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [isPrologueActive, setIsPrologueActive] = useState(true);
  const [selectedPrologue, setSelectedPrologue] = useState<string>('');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isTuningOpen, setIsTuningOpen] = useState(false);

  const [lines, setLines] = useState<string[]>([]);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isComplete, setIsComplete] = useState(false);
  const { playClick, setMuted } = useSound();

  const autoProgressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const scoreRef = useRef(score);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  useEffect(() => {
    if (loading) return;
    const fetchPrologue = async () => {
      try {
        // Fetch from unified day document
        const dayRef = doc(db, 'season1_days', `day_${currentDay}`);
        const dayDoc = await getDoc(dayRef);

        if (dayDoc.exists()) {
          const data = dayDoc.data() as { prologueSentences?: string[] };
          if (data.prologueSentences && data.prologueSentences.length > 0) {
            const randomIndex = Math.floor(Math.random() * data.prologueSentences.length);
            setSelectedPrologue(data.prologueSentences[randomIndex]);
          } else {
            throw new Error('No prologue sentences in day document');
          }
        } else {
          throw new Error('Firestore day document missing');
        }
      } catch (error) {
        if (import.meta.env.DEV) console.warn('Falling back to local prologue data:', error);
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
    setIsPrologueActive(true);
    setDayData(null);
    setLines([]);
    setCurrentLineIndex(0);
    setDisplayedText('');
    setIsComplete(false);
  }, [currentDay, loading]);

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
      if (import.meta.env.DEV) console.error('Error listening to day data:', error);
      setDataLoading(false);
    });

    return () => unsubscribe();
  }, [currentDay, isPrologueActive]);

  useEffect(() => {
    if (!dayData || isPrologueActive) return;

    const currentLog = dayData.vm_logs?.[state] || dayData.vm_logs?.['FEED_STABLE'];
    const logBody = currentLog?.body || '';
    const newLines = logBody
      .replace(/([.!?])\s+/g, "$1|")
      .split("|")
      .filter(l => l.trim() !== '');

    const currentLinesJoined = lines.join('|');
    const newLinesJoined = newLines.join('|');

    if (currentLinesJoined !== newLinesJoined) {
      setLines(newLines);
      setCurrentLineIndex(0);
      setDisplayedText('');
      setIsComplete(false);
    }

    const interface_el = document.querySelector('.scanlines');
    if (interface_el) {
      interface_el.classList.add('glitch-intense');
      setTimeout(() => interface_el.classList.remove('glitch-intense'), 1000);
    }
  }, [state, dayData, isPrologueActive, lines]);

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

    const currentScore = scoreRef.current;
    const dynamicDelay = AUTO_PROGRESS_DELAY + (100 - currentScore) * 40;

    if (currentLineIndex < lines.length - 1) {
      autoProgressTimer.current = setTimeout(moveToNextLine, dynamicDelay);
    } else {
      setIsComplete(true);
    }
  }, [lines, currentLineIndex, moveToNextLine]);

  const handlePrologueComplete = useCallback(async () => {
    try {
      await ensureUser();
    } catch (err) {
      if (import.meta.env.DEV) console.error('[Delta-7] Feed induction failure:', err);
    }
    setIsPrologueActive(false);
  }, [ensureUser]);

  useEffect(() => {
    if (isPrologueActive || isComplete || dataLoading || !dayData) return;

    const timer = setInterval(() => {
      if (!isTyping) {
        moveToNextLine();
      }
    }, 12000);

    return () => clearInterval(timer);
  }, [isPrologueActive, isComplete, dataLoading, dayData, isTyping, moveToNextLine]);


  useEffect(() => {
    if (lines.length === 0 || currentLineIndex >= lines.length || isComplete) return;

    const textToType = lines[currentLineIndex];
    let index = 0;
    setIsTyping(true);
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
        if (isAudioEnabled) playClick();
        setTimeout(() => {
          setDisplayedText(prev => prev.slice(0, -1) + char);
        }, TYPING_SPEED / 2);
      } else {
        setDisplayedText(prev => prev + char);
        if (isAudioEnabled) playClick();
      }
      index++;
      const nextDelay = (sentenceStartScore < 40 ? TYPING_SPEED * 1.5 : TYPING_SPEED) + variance + (sentenceStartScore < 70 ? Math.random() * 20 : 0);
      typingTimer.current = setTimeout(typeNextChar, nextDelay);
    };
    typingTimer.current = setTimeout(typeNextChar, TYPING_SPEED);
    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
  }, [currentLineIndex, lines, finishCurrentLine, isComplete, isAudioEnabled]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-lab-black text-signal-green font-mono">
        {/* Silent loading to prioritize Prologue */}
      </div>
    );
  }

  // Apply extra blur when glitching (day transition)
  const baseBlur = Math.min(0.8, Math.max(0, (100 - score) / 80));
  const blurAmount = isGlitching ? Math.max(2, baseBlur) : baseBlur;
  const opacityAmount = Math.max(0.7, score / 100);

  const glitchClass = score < 20 ? 'glitch-heavy' : score < 70 ? 'glitch-subtle' : '';
  const scanlineClass = score < 50 ? 'scanlines-active' : '';

  return (
    <>
      {isPrologueActive && (
        <Prologue
          sentence={selectedPrologue}
          onComplete={handlePrologueComplete}
        />
      )}

      {isAudioEnabled && <AudioAtmosphere />}

      {/* Atmosphere Control System (Theme, Particles, Blackout) */}
      <AtmosphereManager coherence={score} />

      <div
        className={`relative min-h-screen w-full bg-lab-black text-signal-green font-mono scanlines p-4 sm:p-8 flex flex-col transition-colors duration-1000 overflow-x-hidden ${glitchClass} ${scanlineClass}`}
      >
        <div className="fixed inset-0 z-0 opacity-0 sm:opacity-100" />
        <BackgroundAtmosphere score={score} />

        <ScreenEffects flickerLevel={1} driftLevel={1} />
        <GlitchOverlay coherence={score} isGlitching={isGlitching} />

        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-signal-green/30 pb-4 mb-4 sm:mb-8 select-none relative z-10">

          {/* LEFT SIDE: Frequency, User, Audio */}
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <div className="flex items-center gap-3">
              {/* 1. Frequency Input/Display (Highlighted & Pulsing) */}
              <button
                onClick={() => setIsTuningOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md transition-all duration-300 border border-emerald-500/30 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 animate-pulse-gentle group"
              >
                <span className="text-[10px] font-mono tracking-[0.2em] uppercase group-hover:text-emerald-400 transition-colors">
                  {accessCode ? `FREQ:${accessCode}` : 'TUNING...'}
                </span>
              </button>

              {/* 2. User Icon (Lock/Shield) */}
              {(isAnchored || currentDay >= 28) && (
                <button
                  onClick={async () => {
                    // if (isAnchored) return; // Removed to allow accessing Unlink/Logout menu
                    try {
                      await ensureUser();
                      setIsAuthModalOpen(true);
                    } catch (err) {
                      if (import.meta.env.DEV) console.error('[Delta-7] Auth: Pre-synchronization failure:', err);
                    }
                  }}
                  className={`flex items-center justify-center w-8 h-8 rounded-full transition-all duration-1000 group hover:scale-110 ${isAnchored
                    ? 'bg-emerald-500/10 border border-emerald-500/50 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)] cursor-default'
                    : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/20 animate-pulse-gentle cursor-pointer'
                    }`}
                  aria-label={isAnchored ? "Connection Secured" : "Authenticate Session"}
                >
                  {isAnchored ? (
                    <Shield size={14} className="drop-shadow-[0_0_2px_rgba(16,185,129,1)]" />
                  ) : (
                    <Lock size={14} /> // Blinking Lock for Day 28+
                  )}
                </button>
              )}

              {/* 3. Audio Control (Dimmed/Subtle) */}
              <button
                onClick={() => {
                  const newState = !isAudioEnabled;
                  setIsAudioEnabled(newState);
                  setMuted(!newState);
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-all duration-300 border ${isAudioEnabled
                  ? 'border-emerald-900/40 text-emerald-700/60 bg-emerald-900/5'
                  : 'border-white/5 text-white/20 bg-white/5'
                  } hover:border-emerald-500/30 hover:text-emerald-500/50`}
                aria-label={isAudioEnabled ? "Mute Audio" : "Enable Audio"}
              >
                {isAudioEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                <span className="text-[10px] font-mono tracking-[0.2em] uppercase hidden sm:inline">
                  {isAudioEnabled ? 'AUDIO_ON' : 'AUDIO_OFF'}
                </span>
              </button>
            </div>
          </div>

          {/* RIGHT SIDE: Feed Status (Terminal) + Coherence Bar */}
          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-4 w-full sm:w-auto">
            {/* Feed Status Moved Here */}
            <div className="flex items-center gap-2 order-last sm:order-first">
              <Terminal size={20} className="text-signal-green shrink-0" />
              <div className={`text-sm sm:text-base font-bold truncate ${score < 30 ? 'text-decay-red' : 'text-signal-green'}`}>
                <GlitchText text={state} coherenceScore={score} />
              </div>
            </div>

            {/* Coherence Bar Container */}
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
          </div>
        </header>

        <main className="flex-1 flex flex-col max-w-4xl mx-auto w-full relative z-10">
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

                {isComplete && dayData?.images && dayData.images.filter(img => !img.placeholder && img.id && img.id.trim() !== '').length > 0 && (
                  <div className="space-y-6 sm:space-y-8 mt-8 sm:mt-12">
                    {dayData.images
                      .filter(img => !img.placeholder && img.id && img.id.trim() !== '')
                      .map((img) => (
                        <div key={img.id}>
                          <EvidenceViewer image={img} coherenceScore={score} />
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      <div className="fixed inset-0 pointer-events-none z-[9999]">
        {!dataLoading && dayData?.fragments?.map((frag, idx) => {
          const hasExactMatch = dayData.fragments.some(f => f.severity === state);
          const isCorrectState = hasExactMatch ? frag.severity === state : idx === 0;
          const triggerThreshold = (idx + 1) * 0.12;
          const logProgress = lines.length > 0 ? (currentLineIndex + 1) / lines.length : 0;
          const isVisible = isCorrectState && (logProgress >= triggerThreshold || isComplete);

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

      <TuningInterface
        isOpen={isTuningOpen}
        onClose={() => setIsTuningOpen(false)}
      />

      <DebugPanel />
      <SystemStatusModal visible={!isPrologueActive} />
    </>
  );
};

import { GlobalErrorBoundary } from './components/GlobalErrorBoundary';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { WifiOff } from 'lucide-react';

function App() {
  const isOnline = useOnlineStatus();

  useEffect(() => {
    initAppCheck();
  }, []);

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
              <Route path="/" element={
                <CoherenceProvider>
                  <LabInterface />
                </CoherenceProvider>
              } />
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
                  <Route path="settings" element={<AdminSettings />} />
                  <Route path="director" element={<AtmosphereControl />} />
                </Route>
              </Route>
            </Routes>
          </BrowserRouter>
        </HelmetProvider>
      </AuthProvider>
    </GlobalErrorBoundary>
  );
}

export default App;
