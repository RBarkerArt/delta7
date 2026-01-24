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

    const userProgressRef = useRef<UserProgress | null>(null);
    const initializationLockRef = useRef<string | null>(null);
    const lastSyncRef = useRef<{ score: number; day: number; time: number }>({ score: 100, day: 1, time: 0 });

    // Stable refs for interval-based logic
    const scoreRef = useRef(score);
    const stateRef = useRef(state);
    const currentDayRef = useRef(currentDay);
    const startDateRef = useRef<Timestamp>(Timestamp.now());

    // Keep refs in sync with state
    useEffect(() => { scoreRef.current = score; }, [score]);
    useEffect(() => { stateRef.current = state; }, [state]);
    useEffect(() => { currentDayRef.current = currentDay; }, [currentDay]);

    const initializeUserProgress = useCallback(async (currentUser: User) => {
        if (!visitorId) {
            setLoading(false);
            return;
        }
        const lockKey = `${currentUser.uid}_${visitorId}`;
        if (initializationLockRef.current === lockKey) return;
        initializationLockRef.current = lockKey;

        try {
            const idTokenResult = await currentUser.getIdTokenResult();
            const isAdminRole = idTokenResult.claims.role === 'admin' || currentUser.email === ADMIN_EMAIL;
            setIsAdmin(isAdminRole);

            // PROJECT SIGNAL REFINEMENT:
            // "Anchored" now means explicitly linked to a provider (Google/Email), NOT just "not anonymous".
            // Custom Tokens (Access Codes) make isAnonymous=false, but we want to treat them as "Unanchored" for UI purposes until Day 28.
            const hasProvider = currentUser.providerData.some(p => p.providerId === 'google.com' || p.providerId === 'password');
            const anchored = hasProvider;
            setIsAnchored(anchored);

            const collectionName = isAdminRole ? 'users' : 'observers';
            const docId = isAdminRole ? currentUser.uid : visitorId;
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
                        console.log(`[Delta-7] Day override detected (${storedDay} vs ${calculatedDay}). Realigning temporal origin...`);
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

                if (!isAdminRole && !currentUser.isAnonymous && !data.isAnchored) {
                    console.log('[Delta-7] Syncing anchored identity to persistent record...');
                    updates.isAnchored = true;
                    updates.anchoredFirebaseUid = currentUser.uid;
                    updates.email = currentUser.email || null;
                }

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
                const initial: UserProgress = {
                    coherenceScore: 100,
                    coherenceState: 'FEED_STABLE',
                    dayProgress: 1,
                    visitCount: 1,
                    startDate: Timestamp.now(),
                    lastSeenAt: Timestamp.now(),
                    seenFragments: [],
                    isAnchored: !currentUser.isAnonymous,
                    email: currentUser.email || null,
                    visitorId: isAdminRole ? undefined : visitorId,
                    anchoredFirebaseUid: (!isAdminRole && !currentUser.isAnonymous) ? currentUser.uid : null
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
                    const assignFrequency = httpsCallable(functions, 'assignFrequency');
                    console.log('[Delta-7] Generating signal frequency...');
                    const result = await assignFrequency();
                    const { code } = result.data as { code: string };
                    if (code) {
                        retrievedCode = code;
                        // Optimistic update to avoid refetch
                        await setDoc(userRef, { accessCode: code }, { merge: true });
                    }
                } catch (err) {
                    console.error('[Delta-7] Frequency assignment failed:', err);
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
    useEffect(() => {
        if (!user || loading || !visitorId) return;

        const interval = setInterval(() => {
            const recovery = !user.isAnonymous ? ANCHORED_RECOVERY : DEFAULT_RECOVERY;
            setScoreState(prev => {
                const next = Math.min(100, prev + recovery);
                setState(getCoherenceState(next));
                return next;
            });
        }, REFRESH_MS);

        return () => clearInterval(interval);
    }, [user, loading, visitorId]);

    // Firestore Sync Logic (Interval-based)
    useEffect(() => {
        if (!user || loading || !visitorId) return;

        const syncProgress = async () => {
            const currentScore = scoreRef.current;
            const currentState = stateRef.current;
            const currentDayVal = currentDayRef.current;

            const now = Date.now();
            const scoreDiff = Math.abs(currentScore - lastSyncRef.current.score);
            const timeSinceSync = now - lastSyncRef.current.time;

            if (scoreDiff > 0.5 || timeSinceSync > 15000 || currentDayVal !== lastSyncRef.current.day) {
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

                    lastSyncRef.current = { score: currentScore, day: currentDayVal, time: now };
                } catch (err) {
                    console.warn('[Delta-7] Coherence sync deferred:', err);
                }
            }
        };

        const interval = setInterval(syncProgress, 5000);
        return () => clearInterval(interval);
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
