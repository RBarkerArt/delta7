import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import {
    signInWithPopup,
    GoogleAuthProvider,
    onAuthStateChanged,
    signOut,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInAnonymously,
    EmailAuthProvider,
    linkWithCredential,
    linkWithPopup,
    type User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

export interface AuthUser extends FirebaseUser {
    role?: 'admin' | 'visitor';
}

interface AuthContextType {
    user: AuthUser | null;
    loading: boolean;
    isAuthorizing: boolean; // Flag to prevent race conditions
    isAdmin: boolean;
    signInWithGoogle: (captureState?: () => void) => Promise<void>;
    signInWithEmail: (email: string, pass: string) => Promise<void>;
    signUpWithEmail: (email: string, pass: string) => Promise<void>;
    logout: () => Promise<void>;
    ensureUser: () => Promise<AuthUser>;
    migrationPayload: { day: number; score: number } | null;
    clearMigration: () => void;
    setMigrationProgress: (day: number, score: number) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [isAuthorizing, setIsAuthorizing] = useState(false);

    const [authInitialized, setAuthInitialized] = useState<Promise<AuthUser | null> | null>(null);
    const resolveAuthRef = useRef<((u: AuthUser | null) => void) | null>(null);
    const isInducingRef = useRef<Promise<AuthUser> | null>(null);

    const [migrationPayload, setMigrationPayload] = useState<{ day: number; score: number } | null>(null);

    const setMigrationProgress = (day: number, score: number) => {
        console.log(`[Delta-7] Auth: Capturing migration progress (Day ${day}, Score ${score})`);
        setMigrationPayload({ day, score });
    };

    const clearMigration = () => {
        setMigrationPayload(null);
    };

    useEffect(() => {
        console.log('[Delta-7] Auth: Initializing observer...');
        const initPromise = new Promise<AuthUser | null>((resolve) => {
            resolveAuthRef.current = resolve;
        });
        setAuthInitialized(initPromise);

        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            console.log('[Delta-7] Auth: State Change detected:', firebaseUser?.uid || 'NONE');
            try {
                if (firebaseUser) {
                    const idTokenResult = await firebaseUser.getIdTokenResult();
                    const claimRole = idTokenResult.claims.role as 'admin' | 'visitor' | undefined;

                    // Get user role from Firestore
                    const userRef = doc(db, 'users', firebaseUser.uid);
                    const userDoc = await getDoc(userRef);

                    let role: 'admin' | 'visitor' = 'visitor';

                    if (claimRole === 'admin') {
                        role = 'admin';
                    } else if (userDoc.exists()) {
                        role = userDoc.data().role || 'visitor';
                    }

                    const extendedUser = firebaseUser as AuthUser;
                    extendedUser.role = role;
                    setUser(extendedUser);
                    if (resolveAuthRef.current) resolveAuthRef.current(extendedUser);
                } else {
                    setUser(null);
                    if (resolveAuthRef.current) resolveAuthRef.current(null);
                }
            } catch (err) {
                console.error('[Delta-7] Auth: Error processing user state:', err);
                setUser(null);
                if (resolveAuthRef.current) resolveAuthRef.current(null);
            } finally {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    const ensureUser = async (): Promise<AuthUser> => {
        // 1. Wait for initial onAuthStateChanged to fire
        console.log('[Delta-7] Auth: ensureUser called, awaiting initialization...');
        let currentUser = authInitialized ? await authInitialized : null;

        // 2. If still no user, perform anonymous induction
        if (!currentUser) {
            // CONCURRENCY LOCK: Prevent multiple induction calls from overlapping
            if (isInducingRef.current) {
                console.log('[Delta-7] Auth: Induction already in progress, awaiting...');
                return await isInducingRef.current;
            }

            const inductionPromise = (async () => {
                try {
                    console.log('[Delta-7] Auth: No witness detected. Initializing anonymous induction.');
                    const result = await signInAnonymously(auth);
                    const newUser = result.user as AuthUser;
                    newUser.role = 'visitor'; // Initial assumption for anon
                    setUser(newUser);
                    return newUser;
                } finally {
                    isInducingRef.current = null;
                }
            })();

            isInducingRef.current = inductionPromise;
            currentUser = await inductionPromise;
        }
        return currentUser;
    };

    const signInWithGoogle = async (captureState?: () => void) => {
        setIsAuthorizing(true);
        try {
            // 1. Capture anonymous state BEFORE any auth redirect/popup
            // This is our safety net if a collision forces a UID shift
            if (captureState) {
                console.log('[Delta-7] Auth: Capturing pre-auth state for potential migration...');
                captureState();
            }

            const provider = new GoogleAuthProvider();

            // 2. STABLE IDENTITY PATH: If anonymous, we MUST link to keep the UID
            if (auth.currentUser?.isAnonymous) {
                try {
                    console.log('[Delta-7] Auth: Attempting STABLE LINK (UID will not change)...');
                    await linkWithPopup(auth.currentUser, provider);
                    console.log('[Delta-7] Auth: Stable link successful. Identity anchored.');
                } catch (err: any) {
                    // 3. COLLISION PATH: Account already exists. We must shift UIDs and rely on Migration.
                    if (err.code === 'auth/credential-already-in-use' || err.code === 'auth/email-already-in-use') {
                        console.warn('[Delta-7] Auth: Identity collision. Switching to existing anchor. Migration payload will be applied.');
                        await signInWithPopup(auth, provider);
                    } else {
                        throw err;
                    }
                }
            } else {
                // Not anonymous (already anchored or something else), just sign in normally
                await signInWithPopup(auth, provider);
            }
        } finally {
            setIsAuthorizing(false);
        }
    };

    const signInWithEmail = async (email: string, pass: string) => {
        // NOTE: In Delta-7, we don't 'Sign In' to upgrade. We 'Link'.
        // If a user is already anonymous and tries to "Login", we should ask them to Merge?
        // For now, if they are anonymous, we treat "Login" as an attempt to switch to an existing account.
        setIsAuthorizing(true);
        try {
            if (auth.currentUser?.isAnonymous) {
                console.log('[Delta-7] Auth: Login requested during anonymous session. Attempting switch...');
            }
            await signInWithEmailAndPassword(auth, email, pass);
        } finally {
            setIsAuthorizing(false);
        }
    };

    const signUpWithEmail = async (email: string, pass: string) => {
        setIsAuthorizing(true);
        try {
            const credential = EmailAuthProvider.credential(email, pass);

            if (auth.currentUser?.isAnonymous) {
                try {
                    console.log('[Delta-7] Auth: Attempting STABLE EMAIL LINK...');
                    await linkWithCredential(auth.currentUser, credential);
                    console.log('[Delta-7] Auth: Stable email link successful.');
                } catch (err: any) {
                    // Collision during signup usually means "User already exists", so we sign in instead
                    if (err.code === 'auth/email-already-in-use' || err.code === 'auth/credential-already-in-use') {
                        console.warn('[Delta-7] Auth: Email collision during anchor establishment. Switching to existing.');
                        await signInWithEmailAndPassword(auth, email, pass);
                    } else {
                        throw err;
                    }
                }
            } else {
                await createUserWithEmailAndPassword(auth, email, pass);
            }
        } finally {
            setIsAuthorizing(false);
        }
    };

    const logout = async () => {
        setIsAuthorizing(true);
        try {
            await signOut(auth);
        } finally {
            setIsAuthorizing(false);
        }
    };

    return (
        <AuthContext.Provider value={{
            user,
            loading,
            isAuthorizing,
            isAdmin: user?.role === 'admin',
            signInWithGoogle,
            signInWithEmail,
            signUpWithEmail,
            logout,
            ensureUser,
            migrationPayload,
            clearMigration,
            setMigrationProgress
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
