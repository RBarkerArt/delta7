import React, { useEffect, useState, useRef } from 'react';

import { doc, setDoc, updateDoc, Timestamp, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { UserProgress, CoherenceState } from '../types/schema';
import { useAuth } from '../hooks/useAuth';
import { CoherenceContext, type CoherenceContextType } from './contexts';
import { getFunctions, httpsCallable } from 'firebase/functions';

const DECAY_MS = 6 * 60 * 60 * 1000;
const DEFAULT_DECAY = 5;
const ANCHORED_DECAY = 3;

const REFRESH_MS = 3000;
const DEFAULT_RECOVERY = 0.1;
const ANCHORED_RECOVERY = 0.4;

const getCoherenceState = (score: number): CoherenceState => {
    if (score >= 90) return 'FEED_STABLE';
    if (score >= 70) return 'SYNC_RECOVERING';
    if (score >= 45) return 'COHERENCE_FRAYING';
    if (score >= 20) return 'SIGNAL_FRAGMENTED';
    return 'CRITICAL_INTERFERENCE';
};


export const CoherenceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, loading: authLoading, ensureUser, visitorId, isAdmin } = useAuth();
    const [score, setScoreState] = useState<number>(100);
    const [state, setState] = useState<CoherenceState>('FEED_STABLE');
    const [loading, setLoading] = useState(true);
    const [currentDay, setCurrentDayState] = useState<number>(1);
    const [isAnchored, setIsAnchored] = useState(false);
    const [accessCode, setAccessCode] = useState<string | null>(null);
    const [isGlitching, setIsGlitching] = useState(false); // For day transition animation

    const userProgressRef = useRef<UserProgress | null>(null);

    const lastSyncRef = useRef<{ score: number; day: number; time: number }>({ score: 100, day: 1, time: 0 });

    // Stable refs for interval-based logic
    const scoreRef = useRef(score);
    const stateRef = useRef(state);
    const currentDayRef = useRef(currentDay);
    const isAnchoredRef = useRef(isAnchored); // Track anchored state for intervals
    const startDateRef = useRef<Timestamp>(Timestamp.now());

    // Keep refs in sync with state
    useEffect(() => { scoreRef.current = score; }, [score]);
    useEffect(() => { stateRef.current = state; }, [state]);
    useEffect(() => { currentDayRef.current = currentDay; }, [currentDay]);
    useEffect(() => { isAnchoredRef.current = isAnchored; }, [isAnchored]); // Sync isAnchored ref

    // INITIALIZATION & REAL-TIME SYNC
    // Modified to listen for Admin updates (fixing the overwrite bug)
    useEffect(() => {
        if (authLoading) return;
        if (!user && !isAdmin) { // If not logged in and not admin (unlikely combo but safe)
            setLoading(false);
            return;
        }

        // Only require visitorId for non-admin users
        if (!isAdmin && !visitorId) {
            setLoading(false);
            return;
        }

        const collectionName = isAdmin ? 'users' : 'observers';
        const docId = isAdmin ? user!.uid : visitorId!;
        const userRef = doc(db, collectionName, docId);

        let initialLoadComplete = false;

        const unsubscribe = onSnapshot(userRef, { includeMetadataChanges: true }, async (snapshot) => {
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
                        isAnchored: hasProvider,
                        email: user?.email || null,
                        visitorId: isAdmin ? null : visitorId,
                        anchoredFirebaseUid: (!isAdmin && hasProvider) && user ? user.uid : null
                    };

                    await setDoc(userRef, initial);

                    // Set State
                    setScoreState(100);
                    setState('FEED_STABLE');
                    setCurrentDayState(1);

                    // Update Refs
                    scoreRef.current = 100;
                    stateRef.current = 'FEED_STABLE';
                    currentDayRef.current = 1;
                    startDateRef.current = initial.startDate;
                    userProgressRef.current = initial;
                    lastSyncRef.current = { score: 100, day: 1, time: Date.now() };

                    // Project Signal: Frequency Assignment
                    if (!isAdmin) {
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
                }
                initialLoadComplete = true; // Mark as loaded even if we just created it
                setLoading(false);
                return;
            }

            // EXISTING USER - SYNC & UPDATE
            const data = snapshot.data() as UserProgress & { accessCode?: string };
            const now = Date.now();

            // 1. INITIAL LOAD LOGIC (Decay & Calculation)
            // We only run the aggressive "Decay" logic once per session start to avoid
            // constantly draining score while the user is active if the admin updates something.
            if (!initialLoadComplete) {
                if (data.accessCode) {
                    setAccessCode(data.accessCode);
                } else if (!isAdmin) {
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

                const lastSeen = (data.lastSeenAt || Timestamp.now()).toMillis();
                const startDate = (data.startDate || Timestamp.now()).toMillis();

                // Calculate Score Decay
                const decayUnits = Math.floor((now - lastSeen) / DECAY_MS);
                const decayPoints = isAdmin ? 0 : (!user?.isAnonymous ? ANCHORED_DECAY : DEFAULT_DECAY);
                const totalDecay = decayUnits * decayPoints;
                const finalScore = Math.max(0, data.coherenceScore - totalDecay);

                // Calculate Day
                const storedDay = data.dayProgress || 1;
                const msPerDay = 24 * 60 * 60 * 1000;
                const startMidnight = new Date(startDate).setUTCHours(0, 0, 0, 0);
                const nowMidnight = new Date(now).setUTCHours(0, 0, 0, 0);
                let calculatedDay = Math.floor((nowMidnight - startMidnight) / msPerDay) + 1;

                let finalStartDate = data.startDate;

                // Day Override Logic
                if (!isAdmin) {
                    if (storedDay > calculatedDay) {
                        calculatedDay = storedDay;
                        const newStartMillis = now - (storedDay - 1) * msPerDay;
                        finalStartDate = Timestamp.fromMillis(newStartMillis);
                    }
                }

                startDateRef.current = finalStartDate;

                const updates: Partial<UserProgress> = {
                    coherenceScore: finalScore,
                    coherenceState: getCoherenceState(finalScore),
                    dayProgress: calculatedDay,
                    startDate: finalStartDate,
                    lastSeenAt: Timestamp.now()
                };

                // Anchoring Sync (Fix for Phantom Anchoring)
                if (user && !isAdmin) {
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

                // Update Refs
                scoreRef.current = finalScore;
                stateRef.current = getCoherenceState(finalScore);
                currentDayRef.current = calculatedDay;
                userProgressRef.current = { ...data, ...updates };
                lastSyncRef.current = { score: finalScore, day: calculatedDay, time: now };

                // Execute the update
                // Note: This write WILL trigger the listener again, but 'hasPendingWrites' will be true, so it will be ignored block above.
                await updateDoc(userRef, updates); // Use await here? It's inside a non-async callback wrapper but we can fire and forget or wrap to async IIFE.
                // Actually the callback passed to onSnapshot can't implementation async directly. 
                // But since we don't return anything relevant, it's fine.

                initialLoadComplete = true; // MARK LOAD COMPLETE
                setLoading(false);

            } else {
                // 2. REMOTE UPDATE HANDLING (Admin changed something)
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
                    stateChanged = true;
                }

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
                }
            }
        }, (error) => {
            console.error('[Delta-7] Real-time sync error:', error);
        });

        return () => unsubscribe();
    }, [user, isAdmin, visitorId, authLoading]);

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
        if (loading || !user || isAdmin) return;

        const calculateNextRollover = (): number => {
            const startMs = startDateRef.current.toMillis();
            const startDate = new Date(startMs);
            const rolloverHour = startDate.getUTCHours();
            const rolloverMinute = startDate.getUTCMinutes();
            const rolloverSecond = startDate.getUTCSeconds();

            const now = new Date();
            const nextRollover = new Date(now);
            nextRollover.setUTCHours(rolloverHour, rolloverMinute, rolloverSecond, 0);

            // If we've passed today's rollover time, schedule for tomorrow
            if (now.getTime() >= nextRollover.getTime()) {
                nextRollover.setDate(nextRollover.getDate() + 1);
            }

            return nextRollover.getTime() - now.getTime();
        };

        const scheduleNextAdvancement = () => {
            const msUntilRollover = calculateNextRollover();
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
                    currentDayRef.current = nextDay;
                    if (import.meta.env.DEV) console.log(`[Delta-7] Day ${prev} → Day ${nextDay}`);
                    return nextDay;
                });

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
    }, [loading, user, isAdmin]);

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
                const idTokenResult = await user.getIdTokenResult();
                const isAdminRole = idTokenResult.claims.role === 'admin';

                const collectionName = isAdminRole ? 'users' : 'observers';
                const docId = isAdminRole ? user.uid : visitorId;
                const userRef = doc(db, collectionName, docId);

                await updateDoc(userRef, {
                    coherenceScore: currentScore,
                    coherenceState: currentState,
                    dayProgress: currentDayVal,
                    startDate: startDateRef.current,
                    lastSeenAt: Timestamp.now()
                });

                lastSyncRef.current = { score: currentScore, day: currentDayVal, time: Date.now() };
                if (import.meta.env.DEV) console.log(`[Delta-7] Sync: ${reason} (score: ${currentScore.toFixed(1)}, day: ${currentDayVal})`);
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
                const msPerDay = 24 * 60 * 60 * 1000;

                // Calculate expected day based on start date
                const startMidnight = new Date(startMs).setUTCHours(0, 0, 0, 0);
                const nowMidnight = new Date(now).setUTCHours(0, 0, 0, 0);
                const expectedDay = Math.floor((nowMidnight - startMidnight) / msPerDay) + 1;

                const currentDayVal = currentDayRef.current;

                if (expectedDay > currentDayVal) {
                    if (import.meta.env.DEV) console.log(`[Delta-7] Tab visible: Day catch-up ${currentDayVal} → ${expectedDay}`);
                    // Trigger glitch effect for day advancement
                    setIsGlitching(true);
                    setCurrentDayState(expectedDay);
                    currentDayRef.current = expectedDay;
                    setTimeout(() => setIsGlitching(false), 1500);

                    // Also sync the new day to Firestore
                    syncToFirestore('day_catchup');
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
    }, [user, loading, visitorId]);

    const setScore = (val: number) => {
        setScoreState(val);
        setState(getCoherenceState(val));
    };

    const setCurrentDay = (val: number) => {
        setCurrentDayState(val);
        currentDayRef.current = val;

        const msPerDay = 24 * 60 * 60 * 1000;
        const newStartTime = Date.now() - (val - 1) * msPerDay;
        startDateRef.current = Timestamp.fromMillis(newStartTime);
        console.log(`[Delta-7] Temporal shift: Day ${val} selected. Realigned origin.`);
    };

    const value: CoherenceContextType = {
        score,
        state,
        loading,
        user,
        currentDay,
        isAnchored,
        isAdmin,
        isGlitching,
        setScore,
        setCurrentDay,
        ensureUser,
        accessCode
    };

    return (
        <CoherenceContext.Provider value={value}>
            {children}
        </CoherenceContext.Provider>
    );
};
