import React, { useEffect, useState, useRef, useCallback } from 'react';
import type { User } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, Timestamp } from 'firebase/firestore';
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

const ADMIN_EMAIL = 'robert.barker2008@gmail.com';

export const CoherenceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, loading: authLoading, ensureUser, visitorId } = useAuth();
    const [score, setScoreState] = useState<number>(100);
    const [state, setState] = useState<CoherenceState>('FEED_STABLE');
    const [loading, setLoading] = useState(true);
    const [currentDay, setCurrentDayState] = useState<number>(1);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isAnchored, setIsAnchored] = useState(false);
    const [accessCode, setAccessCode] = useState<string | null>(null);
    const [isGlitching, setIsGlitching] = useState(false); // For day transition animation

    const userProgressRef = useRef<UserProgress | null>(null);
    const initializationLockRef = useRef<string | null>(null);
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

    const initializeUserProgress = useCallback(async (currentUser: User) => {
        // Check admin status FIRST before requiring visitorId
        const idTokenResult = await currentUser.getIdTokenResult();
        const isAdminRole = idTokenResult.claims.role === 'admin' || currentUser.email === ADMIN_EMAIL;
        setIsAdmin(isAdminRole);

        // Only require visitorId for non-admin users
        if (!isAdminRole && !visitorId) {
            setLoading(false);
            return;
        }

        // FIXED: Include provider count in lock key so linking an account (adding a provider) breaks the lock and triggers a sync
        const lockKey = `${currentUser.uid}_${visitorId || 'admin'}_${currentUser.providerData.length}`;
        if (initializationLockRef.current === lockKey) return;
        initializationLockRef.current = lockKey;

        try {
            // PROJECT SIGNAL REFINEMENT:
            // "Anchored" now means explicitly linked to a provider (Google/Email), NOT just "not anonymous".
            // Custom Tokens (Access Codes) make isAnonymous=false, but we want to treat them as "Unanchored" for UI purposes until Day 28.
            const hasProvider = currentUser.providerData.some(p => p.providerId === 'google.com' || p.providerId === 'password');
            // setIsAnchored(hasProvider); // MOVED: Late-bind this after DB sync to ensure consistency.

            const collectionName = isAdminRole ? 'users' : 'observers';
            const docId = isAdminRole ? currentUser.uid : visitorId!;
            const userRef = doc(db, collectionName, docId);
            const userDoc = await getDoc(userRef);

            let retrievedCode: string | null = null;

            if (userDoc.exists()) {
                const data = userDoc.data() as UserProgress & { accessCode?: string };
                retrievedCode = data.accessCode || null;

                // Handle decay & temporal progression
                const lastSeen = (data.lastSeenAt || Timestamp.now()).toMillis();
                const startDate = (data.startDate || Timestamp.now()).toMillis();
                const now = Date.now();

                // 1. Calculate Score Decay
                const decayUnits = Math.floor((now - lastSeen) / DECAY_MS);
                const decayPoints = isAdminRole ? 0 : (!currentUser.isAnonymous ? ANCHORED_DECAY : DEFAULT_DECAY);
                const totalDecay = decayUnits * decayPoints;
                const finalScore = Math.max(0, data.coherenceScore - totalDecay);

                // 2. Calculate Temporal Progress (Day) - UTC Midnight Rollover
                const storedDay = data.dayProgress || 1;
                const msPerDay = 24 * 60 * 60 * 1000;

                // Convert timestamps to UTC Midnight to count calendar days
                const startMidnight = new Date(startDate).setUTCHours(0, 0, 0, 0);
                const nowMidnight = new Date(now).setUTCHours(0, 0, 0, 0);
                let calculatedDay = Math.floor((nowMidnight - startMidnight) / msPerDay) + 1;

                let finalStartDate = data.startDate;
                if (!isAdminRole) {
                    // Logic Loop: If stored day (e.g. manual debug set) is ahead of calc day, respect it by shifting start date
                    if (storedDay > calculatedDay) {
                        if (import.meta.env.DEV) console.log(`[Delta-7] Day override detected (${storedDay} vs ${calculatedDay}). Realigning temporal origin...`);
                        calculatedDay = storedDay;
                        // Shift start date back to ensure calculation holds
                        const newStartMillis = now - (storedDay - 1) * msPerDay;
                        finalStartDate = Timestamp.fromMillis(newStartMillis);
                    }

                    if (!data.isAnchored) {
                        calculatedDay = Math.min(calculatedDay, 30);
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

                // FIX: Bidirectional Sync for Anchored State
                // The DB might be "poisoned" with isAnchored: true from the previous bug.
                // We must ensure the DB reflects the TRUE reality of the Auth Providers.
                if (!isAdminRole) {
                    if (hasProvider && !data.isAnchored) {
                        if (import.meta.env.DEV) console.log('[Delta-7] Syncing anchored identity to persistent record (FALSE -> TRUE)...');
                        updates.isAnchored = true;
                        updates.anchoredFirebaseUid = currentUser.uid;
                        updates.email = currentUser.email || null;
                    } else if (!hasProvider && data.isAnchored) {
                        if (import.meta.env.DEV) console.log('[Delta-7] Correcting persistent anchored record (TRUE -> FALSE)...');
                        // Fix for users who were accidentally marked as Anchored via Access Code
                        updates.isAnchored = false;
                        updates.anchoredFirebaseUid = null;
                        updates.email = null;
                    }
                }

                // Debug Log to help trace "Phantom Anchoring"
                if (import.meta.env.DEV) console.log('[Delta-7] Auth/Anchored State:', {
                    uid: currentUser.uid,
                    hasProvider,
                    dbAnchored: data.isAnchored,
                    finalAnchored: hasProvider,
                    providers: currentUser.providerData
                });

                // Set UI state to match the final calculated reality
                setIsAnchored(hasProvider);

                setScoreState(finalScore);
                setState(getCoherenceState(finalScore));
                setCurrentDayState(calculatedDay);

                scoreRef.current = finalScore;
                stateRef.current = getCoherenceState(finalScore);
                currentDayRef.current = calculatedDay;

                userProgressRef.current = { ...data, ...updates };
                lastSyncRef.current = { score: finalScore, day: calculatedDay, time: now };

                await updateDoc(userRef, updates);
            } else {
                // New user: Compute hasProvider BEFORE creating initial record
                const hasProvider = currentUser.providerData.some(p =>
                    p.providerId === 'google.com' || p.providerId === 'password'
                );

                const initial: UserProgress = {
                    coherenceScore: 100,
                    coherenceState: 'FEED_STABLE',
                    dayProgress: 1,
                    visitCount: 1,
                    startDate: Timestamp.now(),
                    lastSeenAt: Timestamp.now(),
                    seenFragments: [],
                    isAnchored: hasProvider, // FIXED: Use same logic as existing users
                    email: currentUser.email || null,
                    visitorId: isAdminRole ? null : visitorId,
                    anchoredFirebaseUid: (!isAdminRole && hasProvider) ? currentUser.uid : null // FIXED: Only set if truly anchored
                };
                await setDoc(userRef, initial);
                setScoreState(100);
                setState('FEED_STABLE');
                setCurrentDayState(1);

                scoreRef.current = 100;
                stateRef.current = 'FEED_STABLE';
                currentDayRef.current = 1;

                userProgressRef.current = initial;
                startDateRef.current = initial.startDate;
                lastSyncRef.current = { score: 100, day: 1, time: Date.now() };
            }

            // PROJECT SIGNAL: Assign Frequency if missing and user is Anonymous or Anchored
            if (!retrievedCode && !isAdminRole) {
                try {
                    const functions = getFunctions();
                    const assignFrequencyFn = httpsCallable(functions, 'assignFrequency');
                    if (import.meta.env.DEV) console.log('[Delta-7] Generating signal frequency...');
                    // FIXED: Pass visitorId so function writes to correct document
                    const result = await assignFrequencyFn({ visitorId });
                    const { code } = result.data as { code: string };
                    if (code) {
                        retrievedCode = code;
                        // Optimistic update to avoid refetch
                        await setDoc(userRef, { accessCode: code }, { merge: true });
                    }
                } catch (err) {
                    if (import.meta.env.DEV) console.error('[Delta-7] Frequency assignment failed:', err);
                }
            }

            setAccessCode(retrievedCode);

        } finally {
            setLoading(false);
        }
    }, [visitorId]);

    useEffect(() => {
        if (!authLoading) {
            if (user) {
                initializeUserProgress(user);
            } else {
                setLoading(false);
            }
        }
    }, [user, authLoading, initializeUserProgress]);

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
                const isAdminRole = idTokenResult.claims.role === 'admin' || user.email === ADMIN_EMAIL;

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
