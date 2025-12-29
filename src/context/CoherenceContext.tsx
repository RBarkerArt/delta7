import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import type { User } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { UserProgress, CoherenceState } from '../types/schema';
import { useAuth, type AuthUser } from './AuthContext';

interface CoherenceContextType {
    score: number;
    state: CoherenceState;
    loading: boolean;
    user: User | null;
    currentDay: number;
    isAnchored: boolean;
    isAdmin: boolean;
    setScore: (score: number) => void;
    setCurrentDay: (day: number) => void;
    ensureUser: () => Promise<AuthUser>;
}

const CoherenceContext = createContext<CoherenceContextType | undefined>(undefined);

const DECAY_MS = 6 * 60 * 60 * 1000; // 6 hours
const DEFAULT_DECAY = 5;
const ANCHORED_DECAY = 3;

const REFRESH_MS = 3000; // 3 seconds
const DEFAULT_RECOVERY = 0.1; // +1 per 30s
const ANCHORED_RECOVERY = 0.4; // +4 per 30s

const getCoherenceState = (score: number): CoherenceState => {
    if (score >= 90) return 'FEED_STABLE';
    if (score >= 70) return 'SYNC_RECOVERING';
    if (score >= 45) return 'COHERENCE_FRAYING';
    if (score >= 20) return 'SIGNAL_FRAGMENTED';
    return 'CRITICAL_INTERFERENCE';
};

// Global guard for browser-level sessions to prevent any race conditions with React state batching
let GLOBAL_SESSION_OVERRIDE = false;

const getStorySessionId = () => {
    let sessionId = localStorage.getItem('delta7_story_session_id');
    if (!sessionId) {
        sessionId = `sess_${Math.random().toString(36).slice(2, 11)}_${Date.now()}`;
        localStorage.setItem('delta7_story_session_id', sessionId);
    }
    return sessionId;
};

export const CoherenceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, loading: authLoading, ensureUser, migrationPayload, clearMigration, setMigrationProgress, isAuthorizing } = useAuth();
    const [score, setScoreState] = useState<number>(100);
    const [state, setState] = useState<CoherenceState>('FEED_STABLE');
    const [loading, setLoading] = useState(true);
    const [currentDay, setCurrentDayState] = useState<number>(1);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isAnchored, setIsAnchored] = useState(false);

    // We use a ref for the override flag to ensure the interval always sees the absolute latest value
    // synchronously, bypassing React's closure/batching logic.
    const isOverrideRef = useRef(false);

    const userProgressRef = useRef<{
        startDate: Timestamp;
        isManualDayProgress?: boolean;
    } | null>(null);

    const initializationLockRef = useRef<string | null>(null);

    const initializeUserProgress = async (currentUser: User, manualMigration?: { day: number; score: number } | null) => {
        try {
            console.log(`[Delta-7] initializeUserProgress START: UID=${currentUser.uid}${manualMigration ? ' (MIGRATION PENDING)' : ''}`);
            const sessionId = getStorySessionId();

            // PREVENTION: Ensure we only run initialization once per UID/Anonymous state pair.
            // This prevents React Strict Mode cycles but ALLOWS re-init when a user links (same UID, different anon state).
            const lockKey = `${currentUser.uid}_${currentUser.isAnonymous}`;
            if (initializationLockRef.current === lockKey) {
                console.log('[Delta-7] Initialization locked for this state');
                return;
            }
            setLoading(true); // Ensure we show loading while switching identities
            initializationLockRef.current = lockKey;

            const userRef = doc(db, 'users', currentUser.uid);
            const userDoc = await getDoc(userRef);
            const idTokenResult = await currentUser.getIdTokenResult();
            const isAdminRole = idTokenResult.claims.role === 'admin';
            setIsAdmin(isAdminRole);

            console.log(`[Delta-7] Auth Diagnostic: UID=${currentUser.uid}, SID=${sessionId}, isAdmin=${isAdminRole}`);

            let currentScore = 100;
            let dayProgress = 1;

            if (userDoc.exists()) {
                const data = userDoc.data() as UserProgress;
                const now = Date.now();

                // RAW DIAGNOSTICS: Log what is ACTUALLY in the database before any logic
                console.log('[Delta-7] Raw DB State:', {
                    db_lastSeenAt: data.lastSeenAt ? (data.lastSeenAt as any).toDate?.() : 'MISSING',
                    db_startDate: data.startDate ? (data.startDate as any).toDate?.() : 'MISSING',
                    db_score: data.coherenceScore,
                    db_day: data.dayProgress
                });

                // FALLBACK LOGIC: If lastSeenAt is missing, it defaults to startDate.
                const start = (data.startDate || (data as any).createdAt || Timestamp.now()).toMillis();
                const lastSeen = (data.lastSeenAt || data.startDate || (data as any).createdAt || Timestamp.now()).toMillis();

                const diffLastSeen = now - lastSeen;
                const diffStart = now - start;

                // CLEAN SLATE LOGIC: Authoritative Admin Check
                // FIX: Only force Day 1 if the admin HAS NO progress or is explicitly at Day 1.
                // If they have Day 30, let them keep it.
                if (isAdminRole && (!data.dayProgress || data.dayProgress === 1)) {
                    currentScore = 100;
                    dayProgress = 1;
                    console.log('[Delta-7] Admin Session: Enforcing Clean Slate baseline.');
                } else {
                    // Natural Evolution Logic for Site Visitors (or Admins with progress)
                    const decayUnits = Math.max(0, Math.floor(diffLastSeen / DECAY_MS));
                    const decayPoints = isAdminRole ? 0 : (!currentUser.isAnonymous ? ANCHORED_DECAY : DEFAULT_DECAY);
                    const decay = decayUnits * decayPoints;
                    const baseScore = typeof data.coherenceScore === 'number' ? data.coherenceScore : 100;

                    currentScore = Math.max(0, baseScore - decay);

                    if (data.isManualDayProgress) {
                        dayProgress = data.dayProgress;
                    } else {
                        dayProgress = Math.floor(diffStart / (24 * 60 * 60 * 1000)) + 1;
                    }

                    console.log('[Delta-7] Natural Evolution Logic Path:', {
                        absense_gap: (diffLastSeen / (60 * 60 * 1000)).toFixed(2) + ' hours',
                        decayTarget: decay,
                        initialBase: baseScore,
                        resultingScore: currentScore,
                        resultingDay: dayProgress
                    });
                }

                // OVERWRITE MIGRATION CHECK: "Post-Auth Migration"
                // If we signed into an existing account (Day 1) but have brought Migration Data (Day 30)...
                // We MUST respect the incoming data and overwrite the stale account.
                const payload = manualMigration || migrationPayload;
                if (payload && dayProgress < payload.day) {
                    console.log(`[Delta-7] FORCE MIGRATION: Overwriting DB Day ${dayProgress} with Payload Day ${payload.day}`);
                    dayProgress = payload.day;
                    currentScore = payload.score;

                    // Update current logic vars to ensure correct DB writes below
                    userProgressRef.current = {
                        startDate: Timestamp.fromMillis(Date.now() - ((dayProgress - 1) * 24 * 60 * 60 * 1000)),
                        isManualDayProgress: true
                    };

                    // Clear state to prevent re-trigger
                    clearMigration();
                }

                userProgressRef.current = {
                    startDate: data.startDate || (data as any).createdAt || Timestamp.now(),
                    isManualDayProgress: data.isManualDayProgress
                };

                await updateDoc(userRef, {
                    coherenceScore: currentScore,
                    coherenceState: getCoherenceState(currentScore),
                    lastSeenAt: Timestamp.now(),
                    startDate: userProgressRef.current?.startDate || Timestamp.now(),
                    dayProgress: dayProgress,
                    isManualDayProgress: data.isManualDayProgress ?? false,
                    visitCount: (data.visitCount || 0) + 1,
                    isAnchored: !currentUser.isAnonymous,
                    email: currentUser.email || (data as any).email || null
                });
            } else {
                console.log('[Delta-7] Init: No existing record found. Checking for migration...');

                let startScore = 100;
                let startDay = 1;

                // Use manualMigration (direct pass) or migrationPayload (context state)
                const payload = manualMigration || migrationPayload;

                if (payload) {
                    console.log(`[Delta-7] CRITICAL BRIDGE: Migrating Day ${payload.day} (Score ${payload.score}) to new identity ${currentUser.uid}`);
                    startDay = payload.day;
                    startScore = payload.score;
                    clearMigration(); // Clear context state
                }

                const initialProgress: UserProgress = {
                    startDate: Timestamp.fromMillis(Date.now() - ((startDay - 1) * 24 * 60 * 60 * 1000)),
                    lastSeenAt: Timestamp.now(),
                    visitCount: 1,
                    coherenceScore: startScore,
                    coherenceState: getCoherenceState(startScore),
                    seenFragments: [],
                    dayProgress: startDay,
                    isAnchored: !currentUser.isAnonymous,
                    email: currentUser.email || null
                };
                console.log('[Delta-7] Coherence: Initializing observer with Day', startDay);
                await setDoc(userRef, initialProgress);

                currentScore = startScore;
                dayProgress = startDay;
            }

            setScoreState(currentScore);
            setState(getCoherenceState(currentScore));
            setCurrentDayState(dayProgress);
            console.log(`[Delta-7] initializeUserProgress COMPLETE: Day=${dayProgress}, Score=${currentScore}`);
        } catch (err) {
            console.error('[Delta-7] initializeUserProgress CRITICAL FAILURE:', err);
            initializationLockRef.current = null; // UNLOCK ON FAILURE
        } finally {
            setLoading(false);
        }
    };
    const prevUserRef = useRef<{ uid: string; isAnonymous: boolean } | null>(null);
    const logoutGhostRef = useRef<{ day: number; score: number } | null>(null);

    useEffect(() => {
        console.log('[Delta-7] Coherence: Auth State change observed:', { authLoading, userUid: user?.uid });

        if (!authLoading) {
            let localMigration = null;

            // PERSISTENT GHOST LOAD: If we just refreshed and are anonymous, check localStorage
            if (user?.isAnonymous && !logoutGhostRef.current) {
                const cached = localStorage.getItem('delta7_logout_ghost');
                if (cached) {
                    try {
                        const parsed = JSON.parse(cached);
                        console.log('[Delta-7] GHOST RETRIEVAL: Found persistent ghost session in localStorage.');
                        logoutGhostRef.current = parsed;
                        localStorage.removeItem('delta7_logout_ghost'); // Use it once
                    } catch (e) {
                        localStorage.removeItem('delta7_logout_ghost');
                    }
                }
            }

            // DETECT LOGOUT/IDENTITY SHIFT: If we had an anonymous user and now we have a NEW user...
            if (prevUserRef.current && prevUserRef.current.isAnonymous && user && prevUserRef.current.uid !== user.uid) {
                console.log('[Delta-7] Coherence: Identity shift detected. Bridging progress...');
                localMigration = { day: currentDay, score: score };
                localMigration = { day: currentDay, score: score };
                setMigrationProgress(currentDay, score);
            }

            // GHOST PROTOCOL: If we have a cached ghost from a recent logout, apply it to the new user immediately
            if (!localMigration && user?.isAnonymous && logoutGhostRef.current) {
                console.log('[Delta-7] GHOST RESTORATION: Applying cached session to new anonymous user...');
                localMigration = logoutGhostRef.current;
                logoutGhostRef.current = null; // Clear after use
            }

            if (user) {
                console.log('[Delta-7] Coherence: Proceeding to initializeUserProgress');
                setIsAnchored(!user.isAnonymous);
                initializeUserProgress(user, localMigration);
                prevUserRef.current = { uid: user.uid, isAnonymous: user.isAnonymous };
            } else {
                console.log('[Delta-7] Coherence: User is null, assessing state transition...');

                // GUARD: Prevent logout logic if we are just switching accounts (isAuthorizing)
                if (isAuthorizing) {
                    console.log('[Delta-7] Auth Transition: User null but isAuthorizing. Holding state...');
                    return;
                }

                // GHOST OVERWRITE GUARD: Only cache a ghost if we ACTUALLY had a user session just now
                // This prevents hard-refreshes (where user starts null) from overwriting Day 30 with Day 1.
                const wasActiveSession = prevUserRef.current !== null;

                if (wasActiveSession) {
                    console.log('[Delta-7] Coherence: Disengaged from active session. Caching Ghost for persistence...');
                    const ghost = { day: currentDay, score: score };
                    logoutGhostRef.current = ghost;
                    localStorage.setItem('delta7_logout_ghost', JSON.stringify(ghost));
                } else {
                    console.log('[Delta-7] Coherence: Disengaged from null state. Skipping ghost cache (Persistence preserved).');
                }

                // RESET STATE ON LOGOUT
                setIsAnchored(false);
                setIsAdmin(false);
                setScoreState(100);
                setState('FEED_STABLE');
                setCurrentDayState(1);
                initializationLockRef.current = null;
                prevUserRef.current = null;

                // RE-INDUCE ON LOGOUT: Wait for observer to stabilize
                setTimeout(() => {
                    ensureUser().catch(err => console.error('[Delta-7] Re-induction failure:', err));
                }, 500);
            }
        }
    }, [user, authLoading]);

    const handleSetScore = (val: number) => {
        const next = Math.max(0, Math.min(100, val));
        setScoreState(next);
        setState(getCoherenceState(next));
        isOverrideRef.current = true;
        GLOBAL_SESSION_OVERRIDE = true;
        console.log('[Delta-7] Session Override Active: Score Manual Adjustment');
    };

    const handleSetCurrentDay = (val: number) => {
        setCurrentDayState(val);
        isOverrideRef.current = true;
        GLOBAL_SESSION_OVERRIDE = true;
        console.log('[Delta-7] Session Override Active: Day Manual Adjustment');
    };

    useEffect(() => {
        if (!user || loading) return;

        let tickCount = 0;
        const interval = setInterval(async () => {
            // 1. Calculate next score (local state only)
            let nextScore = 0;
            const recoveryPoints = !user.isAnonymous ? ANCHORED_RECOVERY : DEFAULT_RECOVERY;

            setScoreState((prev) => {
                const next = Math.min(100, prev + recoveryPoints);
                nextScore = next;
                setState(getCoherenceState(next));
                return next;
            });

            // 2. Perform background sync every 15s (5 ticks)
            tickCount++;
            if (tickCount >= 5) {
                tickCount = 0;

                // DOUBLE GUARD: Check both React Ref and Global variable
                if (isOverrideRef.current || GLOBAL_SESSION_OVERRIDE) {
                    console.log('[Delta-7] Skipping Firestore Sync: Session Override Detected');
                    return;
                }

                const userRef = doc(db, 'users', user.uid);
                let dayToUpdate = currentDay;

                if (userProgressRef.current && !userProgressRef.current.isManualDayProgress) {
                    const nowMs = Date.now();
                    const startDate = userProgressRef.current.startDate;

                    if (startDate && typeof startDate.toMillis === 'function') {
                        const startMs = startDate.toMillis();
                        const autoDay = Math.floor((nowMs - startMs) / (24 * 60 * 60 * 1000)) + 1;

                        // ADMIN EXEMPTION: If an admin is in a Clean Slate session (Day 1),
                        // we do not auto-graduate them to keep the test environment stable.
                        // However, we still log the calculation for verification.
                        const skipGraduation = isAdmin && currentDay === 1;

                        if (autoDay !== currentDay) {
                            console.log(`[Delta-7] Graduation Check: Target=Day ${autoDay}, Current=Day ${currentDay}, Skip=${skipGraduation}`);
                            if (autoDay > currentDay && !skipGraduation) {
                                dayToUpdate = autoDay;
                                setCurrentDayState(autoDay);
                                console.log(`[Delta-7] LIVE_GRADUATION: Moving to Day ${autoDay}`);
                            }
                        }
                    }
                }

                updateDoc(userRef, {
                    coherenceScore: nextScore,
                    coherenceState: getCoherenceState(nextScore),
                    lastSeenAt: Timestamp.now(),
                    dayProgress: dayToUpdate,
                    isAnchored: !user.isAnonymous
                }).catch(console.error);
            }
        }, REFRESH_MS);

        return () => clearInterval(interval);
    }, [user, loading, currentDay, isAdmin]);

    return (
        <CoherenceContext.Provider value={{
            score,
            state,
            loading,
            user,
            currentDay,
            isAnchored,
            isAdmin,
            setScore: handleSetScore,
            setCurrentDay: handleSetCurrentDay,
            ensureUser
        }}>
            {children}
        </CoherenceContext.Provider>
    );
};

export const useCoherence = () => {
    const context = useContext(CoherenceContext);
    if (context === undefined) {
        throw new Error('useCoherence must be used within a CoherenceProvider');
    }
    return context;
};
