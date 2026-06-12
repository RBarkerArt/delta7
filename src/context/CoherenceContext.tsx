import React, { useCallback, useEffect, useState, useRef } from 'react';

import { arrayUnion, doc, getDoc, setDoc, updateDoc, Timestamp, onSnapshot, addDoc, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { UserProgress, CoherenceState, ReturnSignalReport, ReturnSignalReason } from '../types/schema';
import { useAuth } from '../hooks/useAuth';
import { CoherenceContext, type CoherenceContextType } from './contexts';
import { getFunctions, httpsCallable } from 'firebase/functions';

const DECAY_MS = 6 * 60 * 60 * 1000;
const DEFAULT_DECAY = 5;
const ANCHORED_DECAY = 3;

const REFRESH_MS = 3000;
const DEFAULT_RECOVERY = 0.8;
const ANCHORED_RECOVERY = 1.1;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const getCoherenceState = (score: number): CoherenceState => {
    if (score >= 90) return 'FEED_STABLE';
    if (score >= 70) return 'SYNC_RECOVERING';
    if (score >= 45) return 'COHERENCE_FRAYING';
    if (score >= 20) return 'SIGNAL_FRAGMENTED';
    return 'CRITICAL_INTERFERENCE';
};

const getNextDayAt = (startDate: Timestamp, day: number): number => (
    startDate.toMillis() + Math.max(1, day) * MS_PER_DAY
);


export const CoherenceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, loading: authLoading, ensureUser, visitorId } = useAuth();
    const [score, setScoreState] = useState<number>(100);
    const [state, setState] = useState<CoherenceState>('FEED_STABLE');
    const [loading, setLoading] = useState(true);
    const [currentDay, setCurrentDayState] = useState<number>(1);
    const [isAnchored, setIsAnchored] = useState(false);
    const [accessCode, setAccessCode] = useState<string | null>(null);
    const [isGlitching, setIsGlitching] = useState(false); // For day transition animation
    const [recoveredItems, setRecoveredItems] = useState<string[]>([]);
    const [nextDayAt, setNextDayAt] = useState<number | null>(null);
    const [arrivalDayDelta, setArrivalDayDelta] = useState(0);
    const [returnSignal, setReturnSignal] = useState<ReturnSignalReport | null>(null);

    const userProgressRef = useRef<UserProgress | null>(null);

    const lastSyncRef = useRef<{ score: number; day: number; time: number }>({ score: 100, day: 1, time: 0 });
    const lastEventRef = useRef<{ reason: string; time: number }>({ reason: '', time: 0 });
    const visitRecordedRef = useRef(false);

    // Stable refs for interval-based logic
    const scoreRef = useRef(score);
    const stateRef = useRef(state);
    const currentDayRef = useRef(currentDay);
    const isAnchoredRef = useRef(isAnchored); // Track anchored state for intervals
    const startDateRef = useRef<Timestamp>(Timestamp.now());
    const lastSeenRef = useRef<number>(0);

    // Keep refs in sync with state
    useEffect(() => { scoreRef.current = score; }, [score]);
    useEffect(() => { stateRef.current = state; }, [state]);
    useEffect(() => { currentDayRef.current = currentDay; }, [currentDay]);
    useEffect(() => { isAnchoredRef.current = isAnchored; }, [isAnchored]); // Sync isAnchored ref

    const deferLoadingComplete = useCallback(() => {
        queueMicrotask(() => setLoading(false));
    }, []);

    const logObserverEvent = useCallback(async (reason: string, dedupeMs = 60000) => {
        if (!visitorId) return;
        const now = Date.now();
        if (dedupeMs > 0 && reason === lastEventRef.current.reason && now - lastEventRef.current.time < dedupeMs) {
            return;
        }

        lastEventRef.current = { reason, time: now };

        try {
            await addDoc(collection(db, 'observer_events'), {
                observerId: visitorId,
                email: user?.email || null,
                isAnchored: isAnchoredRef.current,
                coherenceScore: scoreRef.current,
                coherenceState: stateRef.current,
                dayProgress: currentDayRef.current,
                reason,
                createdAt: Timestamp.now()
            });
        } catch (err) {
            if (import.meta.env.DEV) console.warn('[Delta-7] Event log deferred:', err);
        }
    }, [user, visitorId]);

    const triggerDailyPresenceClaim = useCallback(async () => {
        if (!visitorId) return;
        try {
            const fns = getFunctions();
            const claimFn = httpsCallable(fns, 'claimDailyPresence');
            await claimFn({ visitorId });
        } catch (err) {
            if (import.meta.env.DEV) console.warn('[Delta-7] Failed to claim daily presence residue:', err);
        }
    }, [visitorId]);

    const discoverRoom = useCallback(async (roomName: string) => {
        if (!visitorId) return null;
        try {
            const fns = getFunctions();
            const discoverFn = httpsCallable(fns, 'discoverRoom');
            const res = await discoverFn({ visitorId, room: roomName });
            return res.data as { success: boolean; message: string; milligrams: number; awarded: number };
        } catch (err) {
            if (import.meta.env.DEV) console.warn('[Delta-7] Room discovery failed:', err);
            return null;
        }
    }, [visitorId]);

    // INITIALIZATION & REAL-TIME SYNC
    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            deferLoadingComplete();
            return;
        }

        if (!visitorId) {
            deferLoadingComplete();
            return;
        }

        const userRef = doc(db, 'observers', visitorId);

        let initialLoadComplete = false;

        const unsubscribe = onSnapshot(userRef, { includeMetadataChanges: true }, async (snapshot) => {
            try {
                // IGNORE LOCAL WRITES: If this snapshot is just us writing to the DB, don't re-process it.
                // This prevents the "ping-pong" and overwrite of local state during our own saves.
                if (snapshot.metadata.hasPendingWrites) {
                    return;
                }

                if (!snapshot.exists()) {
                    // NEW USER CREATION (Only on initial load)
                    if (!initialLoadComplete) {
                        const hasProvider = user ? user.providerData.some(p => p.providerId === 'google.com' || p.providerId === 'password') : false;

	                        const initial: UserProgress = {
	                            coherenceScore: 100,
	                            coherenceState: 'FEED_STABLE',
	                            dayProgress: 1,
                            visitCount: 1,
                            startDate: Timestamp.now(),
                            lastSeenAt: Timestamp.now(),
                            seenFragments: [],
                            recoveredItems: [],
                            isAnchored: hasProvider,
                            email: user?.email || null,
	                            visitorId,
	                            anchoredFirebaseUid: hasProvider && user ? user.uid : null
	                        };

	                        const initialForWrite: Record<string, unknown> = {
	                            coherenceScore: initial.coherenceScore,
	                            coherenceState: initial.coherenceState,
	                            dayProgress: initial.dayProgress,
	                            visitCount: initial.visitCount,
	                            startDate: initial.startDate,
	                            lastSeenAt: initial.lastSeenAt,
	                            seenFragments: initial.seenFragments,
	                            recoveredItems: initial.recoveredItems,
	                            isAnchored: initial.isAnchored
	                        };

	                        initialForWrite.visitorId = visitorId;

	                        if (hasProvider && user?.email) {
	                            initialForWrite.email = user.email;
	                            initialForWrite.anchoredFirebaseUid = user.uid;
	                        }

	                        await setDoc(userRef, initialForWrite);

                        // Set State
                        setScoreState(100);
                        setState('FEED_STABLE');
                        setCurrentDayState(1);
                        setIsAnchored(hasProvider);
                        setRecoveredItems([]);
                        setNextDayAt(getNextDayAt(initial.startDate, 1));
                        setArrivalDayDelta(0);
                        setReturnSignal(null);

                        // Update Refs
                        scoreRef.current = 100;
                        stateRef.current = 'FEED_STABLE';
                        currentDayRef.current = 1;
                        startDateRef.current = initial.startDate;
                        userProgressRef.current = initial;
                        lastSyncRef.current = { score: 100, day: 1, time: Date.now() };
                        lastSeenRef.current = Date.now();
                        visitRecordedRef.current = true;
                        void logObserverEvent('daily_signal_opened');

                        // Project Signal: Frequency Assignment
                        try {
                            const functions = getFunctions();
                            const assignFrequencyFn = httpsCallable(functions, 'assignFrequency');
                            const result = await assignFrequencyFn({ visitorId });
                            const { code } = result.data as { code: string };
                            if (code) {
                                setAccessCode(code);
                                await setDoc(userRef, { accessCode: code }, { merge: true });
                            }
                        } catch (err) {
                            if (import.meta.env.DEV) console.error('[Delta-7] Frequency assignment failed:', err);
                        }
                    }
                    initialLoadComplete = true; // Mark as loaded even if we just created it
                    setLoading(false);
                    return;
                }

                // EXISTING USER - SYNC & UPDATE
                const data = snapshot.data() as UserProgress & { accessCode?: string };
                const now = Date.now();
                const nextRecoveredItems = data.recoveredItems || data.seenFragments || [];

                // 1. INITIAL LOAD LOGIC (Decay & Calculation)
                // We only run the aggressive "Decay" logic once per session start to avoid
                // constantly draining score while the user is active if a remote update arrives.
                if (!initialLoadComplete) {
                    if (data.accessCode) {
                        setAccessCode(data.accessCode);
                    } else {
                        // RETRY FREQUENCY ASSIGNMENT: User exists but missed code generation (e.g. closed tab too fast)
                        console.log('[Delta-7] Missing frequency detected. Retrying assignment...');
                        try {
                            const functions = getFunctions();
                            const assignFrequencyFn = httpsCallable(functions, 'assignFrequency');
                            // No await needed here, the Cloud Function will update Firestore -> triggers snapshot
                            assignFrequencyFn({ visitorId }).then((result) => {
                                const { code } = result.data as { code: string };
                                if (code) {
                                    console.log('[Delta-7] Frequency restored:', code);
                                    // Optimistic update
                                    setAccessCode(code);
                                }
                            });
                        } catch (err) {
                            if (import.meta.env.DEV) console.error('[Delta-7] Frequency retry failed:', err);
                        }
                    }

                    const observedStartDate = data.startDate || Timestamp.now();
                    const lastSeen = (data.lastSeenAt || Timestamp.now()).toMillis();
                    const startDate = observedStartDate.toMillis();

                    // Calculate Score Decay
                    const decayUnits = Math.floor((now - lastSeen) / DECAY_MS);
                    const decayPoints = !user?.isAnonymous ? ANCHORED_DECAY : DEFAULT_DECAY;
                    const totalDecay = decayUnits * decayPoints;
                    const finalScore = Math.max(0, data.coherenceScore - totalDecay);

                    // Calculate Day
                    const storedDay = data.dayProgress || 1;
                    let calculatedDay = Math.floor((now - startDate) / MS_PER_DAY) + 1;
                    if (calculatedDay < 1) calculatedDay = 1;
                    const calculatedDayBeforeOverride = calculatedDay;

                    let finalStartDate = observedStartDate;

                    if (storedDay > calculatedDay) {
                        calculatedDay = storedDay;
                        const newStartMillis = now - (storedDay - 1) * MS_PER_DAY;
                        finalStartDate = Timestamp.fromMillis(newStartMillis);
                    }

                    const dayDelta = Math.max(0, calculatedDayBeforeOverride - storedDay);
                    const nextVisitCount = visitRecordedRef.current
                        ? Math.max(1, data.visitCount || 1)
                        : Math.max(1, (data.visitCount || 0) + 1);
                    startDateRef.current = finalStartDate;
                    const absenceMs = Math.max(0, now - lastSeen);
                    const coherenceDelta = finalScore - data.coherenceScore;
                    const returnReason: ReturnSignalReason | null = dayDelta > 1
                        ? 'catchup_return'
                        : dayDelta === 1
                            ? 'daily_signal_opened'
                            : totalDecay > 0
                                ? 'same_day_return'
                                : null;

                    const updates: Partial<UserProgress> = {
                        coherenceScore: finalScore,
                        coherenceState: getCoherenceState(finalScore),
                        dayProgress: calculatedDay,
                        visitCount: nextVisitCount,
                        startDate: finalStartDate,
                        lastSeenAt: Timestamp.now()
                    };

                    // Anchoring Sync (Fix for Phantom Anchoring)
                    if (user) {
                        const hasProvider = user.providerData.some(p => p.providerId === 'google.com' || p.providerId === 'password');
                        if (hasProvider && !data.isAnchored) {
                            updates.isAnchored = true;
                            updates.anchoredFirebaseUid = user.uid;
                            updates.email = user.email || null;
                        } else if (!hasProvider && data.isAnchored) {
                            updates.isAnchored = false;
                            updates.anchoredFirebaseUid = null;
                            updates.email = null;
                        }
                        setIsAnchored(hasProvider);
                    }

                    // Apply Initial State
                    setScoreState(finalScore);
                    setState(getCoherenceState(finalScore));
                    setCurrentDayState(calculatedDay);
                    setRecoveredItems(nextRecoveredItems);
                    setNextDayAt(getNextDayAt(finalStartDate, calculatedDay));
                    setArrivalDayDelta(dayDelta);
                    setReturnSignal(returnReason ? {
                        absenceMs,
                        dayDelta,
                        previousDay: storedDay,
                        currentDay: calculatedDay,
                        coherenceDelta,
                        reason: returnReason
                    } : null);

                    // Update Refs
                    scoreRef.current = finalScore;
                    stateRef.current = getCoherenceState(finalScore);
                    currentDayRef.current = calculatedDay;
                    userProgressRef.current = { ...data, ...updates };
                    lastSyncRef.current = { score: finalScore, day: calculatedDay, time: now };
                    lastSeenRef.current = now;
                    visitRecordedRef.current = true;

                    // Execute the update
                    await updateDoc(userRef, updates);
                    void logObserverEvent(dayDelta > 1 ? 'catchup_return' : dayDelta === 1 ? 'daily_signal_opened' : 'same_day_return');

                    if (dayDelta > 0) {
                        void triggerDailyPresenceClaim();
                    }

                    initialLoadComplete = true; // MARK LOAD COMPLETE
                    setLoading(false);

                } else {
                    // 2. REMOTE UPDATE HANDLING
                    if (import.meta.env.DEV) console.log('[Delta-7] Remote update received:', data);

                    let stateChanged = false;

                    // Handle Day Update
                    if (data.dayProgress !== currentDayRef.current) {
                        console.log(`[Delta-7] Remote Day Change: ${currentDayRef.current} -> ${data.dayProgress}`);
                        setCurrentDayState(data.dayProgress);
                        currentDayRef.current = data.dayProgress;

                        // If start date also changed
                        if (data.startDate && !data.startDate.isEqual(startDateRef.current)) {
                            startDateRef.current = data.startDate;
                        }
                        setNextDayAt(getNextDayAt(startDateRef.current, data.dayProgress));
                        setArrivalDayDelta(0);
                        stateChanged = true;
                    }

                    setRecoveredItems(nextRecoveredItems);

                    // Handle Score Update
                    if (Math.abs(data.coherenceScore - scoreRef.current) > 1) {
                        console.log(`[Delta-7] Remote Score Change: ${scoreRef.current} -> ${data.coherenceScore}`);
                        setScoreState(data.coherenceScore);
                        scoreRef.current = data.coherenceScore;

                        const newState = getCoherenceState(data.coherenceScore);
                        setState(newState);
                        stateRef.current = newState;
                        stateChanged = true;
                    }

                    if (stateChanged) {
                        console.log('[Delta-7] State updated from remote. Resetting sync baseline.');
                        lastSyncRef.current = {
                            score: scoreRef.current,
                            day: currentDayRef.current,
                            time: Date.now()
                        };
                        lastSeenRef.current = Date.now();
                    }
                }
            } catch (err) {
                console.error('[Delta-7] Snapshot handling failed, falling back to local state:', err);
                initialLoadComplete = true;
                setLoading(false);
            }
        }, (error) => {
            console.error('[Delta-7] Real-time sync error, loading default fallback:', error);
            // Gracefully set loading to false so UI doesn't hang forever
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user, visitorId, authLoading, deferLoadingComplete, logObserverEvent]);

    // Recovery logic
    // FIXED: Use isAnchoredRef instead of user.isAnonymous to correctly handle Custom Token users
    useEffect(() => {
        if (!user || loading || !visitorId) return;

        const interval = setInterval(() => {
            const recovery = isAnchoredRef.current ? ANCHORED_RECOVERY : DEFAULT_RECOVERY;
            setScoreState(prev => {
                const next = Math.min(100, prev + recovery);
                setState(getCoherenceState(next));
                return next;
            });
        }, REFRESH_MS);

        return () => clearInterval(interval);
    }, [user, loading, visitorId]);

    // REAL-TIME DAY ADVANCEMENT
    // Calculates rollover time based on user's first visit time and sets timer
    useEffect(() => {
        if (loading || !user) return;

        const calculateMsUntilNextSignal = (): number => {
            const target = getNextDayAt(startDateRef.current, currentDayRef.current);
            setNextDayAt(target);
            return Math.max(0, target - Date.now());
        };

        const scheduleNextAdvancement = () => {
            const msUntilRollover = calculateMsUntilNextSignal();
            if (import.meta.env.DEV) console.log(`[Delta-7] Day rollover scheduled in ${Math.floor(msUntilRollover / 1000 / 60)} minutes`);

            return setTimeout(() => {
                // Trigger glitch effect
                setIsGlitching(true);
                if (import.meta.env.DEV) console.log('[Delta-7] TEMPORAL_SHIFT: Day advancement triggered');

                // Small coherence bump if under 100%
                setScoreState(prev => {
                    if (prev < 100) {
                        const boosted = Math.min(100, prev + 5);
                        setState(getCoherenceState(boosted));
                        return boosted;
                    }
                    return prev;
                });

                // Advance the day
                setCurrentDayState(prev => {
                    const nextDay = prev + 1;
                    const previousScore = scoreRef.current;
                    currentDayRef.current = nextDay;
                    setNextDayAt(getNextDayAt(startDateRef.current, nextDay));
                    setArrivalDayDelta(1);
                    setReturnSignal({
                        absenceMs: 0,
                        dayDelta: 1,
                        previousDay: prev,
                        currentDay: nextDay,
                        coherenceDelta: Math.min(100, previousScore + 5) - previousScore,
                        reason: 'daily_signal_opened'
                    });
                    if (import.meta.env.DEV) console.log(`[Delta-7] Day ${prev} → Day ${nextDay}`);
                    return nextDay;
                });
                void logObserverEvent('daily_signal_opened');
                void triggerDailyPresenceClaim();

                // End glitch after animation
                setTimeout(() => setIsGlitching(false), 1500);

                // Schedule next day's rollover
                const nextTimer = scheduleNextAdvancement();
                timerRef.current = nextTimer;
            }, msUntilRollover);
        };

        const timerRef = { current: scheduleNextAdvancement() };

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, [loading, user, currentDay, logObserverEvent]);

    // EVENT-DRIVEN FIRESTORE SYNC
    // Syncs on: visibility change, beforeunload, state threshold crossing, and 2-min backup
    // This reduces writes by ~95% while maintaining the observer experience
    useEffect(() => {
        if (!user || loading || !visitorId) return;

        // The sync function - writes current state to Firestore
        const syncToFirestore = async (reason: string) => {
            const currentScore = scoreRef.current;
            const currentState = stateRef.current;
            const currentDayVal = currentDayRef.current;

            try {
                const userRef = doc(db, 'observers', visitorId);

                await updateDoc(userRef, {
                    coherenceScore: currentScore,
                    coherenceState: currentState,
                    dayProgress: currentDayVal,
                    startDate: startDateRef.current,
                    lastSeenAt: Timestamp.now()
                });

                lastSyncRef.current = { score: currentScore, day: currentDayVal, time: Date.now() };
                lastSeenRef.current = Date.now();
                if (import.meta.env.DEV) console.log(`[Delta-7] Sync: ${reason} (score: ${currentScore.toFixed(1)}, day: ${currentDayVal})`);

                if (reason === 'session_start' || reason === 'session_end' || reason === 'visibility_visible' || reason === 'visibility_hidden' || reason.startsWith('state_change_')) {
                    void logObserverEvent(reason);
                }
            } catch (err) {
                if (import.meta.env.DEV) console.warn('[Delta-7] Sync deferred:', err);
            }
        };

        // 1. VISIBILITY CHANGE - "The lab notices when you look away"
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                syncToFirestore('visibility_hidden');
            } else if (document.visibilityState === 'visible') {
                // Recalculate day on tab focus - setTimeout is unreliable for background tabs
                const startMs = startDateRef.current?.toMillis() || Date.now();
                const now = Date.now();
                // Calculate expected day based on start date
                let expectedDay = Math.floor((now - startMs) / MS_PER_DAY) + 1;
                if (expectedDay < 1) expectedDay = 1;

                const currentDayVal = currentDayRef.current;
                const lastSeen = lastSeenRef.current;
                const previousScore = scoreRef.current;
                const decayUnits = Math.floor((now - lastSeen) / DECAY_MS);
                const decayPoints = isAnchoredRef.current ? ANCHORED_DECAY : DEFAULT_DECAY;
                const totalDecay = decayUnits * decayPoints;
                const nextScore = totalDecay > 0 ? Math.max(0, previousScore - totalDecay) : previousScore;
                const scoreChanged = nextScore !== previousScore;
                const dayChanged = expectedDay > currentDayVal;
                const dayDelta = dayChanged ? expectedDay - currentDayVal : 0;

                if (scoreChanged) {
                    setScoreState(nextScore);
                    setState(getCoherenceState(nextScore));
                    scoreRef.current = nextScore;
                    stateRef.current = getCoherenceState(nextScore);
                }

                if (dayChanged) {
                    if (import.meta.env.DEV) console.log(`[Delta-7] Tab visible: Day catch-up ${currentDayVal} → ${expectedDay}`);
                    // Trigger glitch effect for day advancement
                    setIsGlitching(true);
                    setCurrentDayState(expectedDay);
                    currentDayRef.current = expectedDay;
                    setNextDayAt(getNextDayAt(startDateRef.current, expectedDay));
                    setArrivalDayDelta(dayDelta);
                    void logObserverEvent(dayDelta > 1 ? 'catchup_return' : 'daily_signal_opened');
                    void triggerDailyPresenceClaim();
                    setTimeout(() => setIsGlitching(false), 1500);
                }
                if (dayChanged || totalDecay > 0) {
                    setReturnSignal({
                        absenceMs: Math.max(0, now - lastSeen),
                        dayDelta,
                        previousDay: currentDayVal,
                        currentDay: dayChanged ? expectedDay : currentDayVal,
                        coherenceDelta: nextScore - previousScore,
                        reason: dayDelta > 1 ? 'catchup_return' : dayDelta === 1 ? 'daily_signal_opened' : 'same_day_return'
                    });
                }
                if (dayChanged || scoreChanged) {
                    syncToFirestore('visibility_visible');
                }
            }
        };

        // 2. BEFOREUNLOAD - "Your final observation is recorded"
        const handleBeforeUnload = () => {
            // Note: We can't await here, but the sync on visibility_hidden usually catches this
            syncToFirestore('session_end');
        };

        // 3. STATE THRESHOLD CROSSING - Track previous state to detect crossings
        let lastSyncedState = stateRef.current;
        const checkThresholdCrossing = () => {
            const currentState = stateRef.current;
            if (currentState !== lastSyncedState) {
                lastSyncedState = currentState;
                syncToFirestore(`state_change_${currentState}`);
            }
        };

        // 4. BACKUP INTERVAL - Every 2 minutes as safety net
        const backupInterval = setInterval(() => {
            const now = Date.now();
            const timeSinceSync = now - lastSyncRef.current.time;

            // Only sync if significant time passed and score changed meaningfully
            if (timeSinceSync > 120000) {
                const scoreDiff = Math.abs(scoreRef.current - lastSyncRef.current.score);
                if (scoreDiff > 5 || currentDayRef.current !== lastSyncRef.current.day) {
                    syncToFirestore('backup_interval');
                }
            }
        }, 30000); // Check every 30s, but only actually sync if 2min passed

        // 5. THRESHOLD CHECK INTERVAL - Check for state changes every 10s
        const thresholdInterval = setInterval(checkThresholdCrossing, 10000);

        // Register event listeners
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('beforeunload', handleBeforeUnload);

        // Initial sync after a short delay
        const initialSyncTimer = setTimeout(() => syncToFirestore('session_start'), 2000);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('beforeunload', handleBeforeUnload);
            clearInterval(backupInterval);
            clearInterval(thresholdInterval);
            clearTimeout(initialSyncTimer);
            // Final sync on unmount
            syncToFirestore('unmount');
        };
    }, [user, loading, visitorId, logObserverEvent]);

    const markRecoveredMany = useCallback(async (ids: string[]) => {
        const cleanIds = Array.from(new Set(ids.map(id => id.trim()).filter(Boolean)));
        if (cleanIds.length === 0 || loading || !visitorId) return;
        const activeUser = user || await ensureUser();
        const hasNewRecovery = cleanIds.some(id => !recoveredItems.includes(id));

        setRecoveredItems(prev => {
            const next = cleanIds.filter(id => !prev.includes(id));
            return next.length > 0 ? [...prev, ...next] : prev;
        });

        try {
            const userRef = doc(db, 'observers', visitorId);
            const snapshot = await getDoc(userRef);

            if (!snapshot.exists()) {
                const hasProvider = activeUser.providerData.some(p => p.providerId === 'google.com' || p.providerId === 'password');
                const initial: Record<string, unknown> = {
                    coherenceScore: scoreRef.current || 100,
                    coherenceState: stateRef.current || 'FEED_STABLE',
                    dayProgress: currentDayRef.current || 1,
                    visitCount: 1,
                    startDate: startDateRef.current,
                    lastSeenAt: Timestamp.now(),
                    seenFragments: cleanIds,
                    recoveredItems: cleanIds,
                    isAnchored: hasProvider,
                    visitorId
                };

                if (hasProvider && activeUser.email) {
                    initial.email = activeUser.email;
                    initial.anchoredFirebaseUid = activeUser.uid;
                }

                await setDoc(userRef, initial, { merge: true });
                visitRecordedRef.current = true;
                if (hasNewRecovery) {
                    void logObserverEvent('artifact_recovered', 0);
                }
                return;
            }

            await updateDoc(userRef, {
                recoveredItems: arrayUnion(...cleanIds),
                seenFragments: arrayUnion(...cleanIds)
            });
            if (hasNewRecovery) {
                void logObserverEvent('artifact_recovered', 0);
            }
        } catch (err) {
            if (import.meta.env.DEV) console.warn('[Delta-7] Recovery mark deferred:', err);
        }
    }, [ensureUser, loading, logObserverEvent, recoveredItems, user, visitorId]);

    const markRecovered = useCallback(async (id: string) => {
        await markRecoveredMany([id]);
    }, [markRecoveredMany]);

    const value: CoherenceContextType = {
        score,
        state,
        loading,
        user,
        currentDay,
        nextDayAt,
        arrivalDayDelta,
        returnSignal,
        isAnchored,
        isGlitching,
        recoveredItems,
        markRecovered,
        markRecoveredMany,
        ensureUser,
        accessCode,
        discoverRoom
    };

    return (
        <CoherenceContext.Provider value={value}>
            {children}
        </CoherenceContext.Provider>
    );
};
