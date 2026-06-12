import React, { useEffect, useState, useCallback } from 'react';
import {
    onAuthStateChanged,
    signInAnonymously,
    GoogleAuthProvider,
    signInWithPopup,
    signInWithRedirect,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    linkWithPopup,
    linkWithRedirect,
    linkWithCredential,
    signInWithCustomToken,
    EmailAuthProvider,
    getRedirectResult,
    type User
} from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getObserverSession, setObserverSession } from '../lib/visitor';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { AuthContext, type AuthContextType } from './contexts';

export interface AuthUser extends User {
    role?: 'admin' | 'observer';
}

const getErrorCode = (error: unknown): string | undefined => {
    if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
};

const createGoogleProvider = () => new GoogleAuthProvider();

const shouldUseRedirectForGoogleAuth = () => {
    const userAgent = navigator.userAgent || '';
    const isMobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    const isIPadDesktopMode = /Macintosh/i.test(userAgent) && navigator.maxTouchPoints > 1;

    return isMobileUserAgent || isIPadDesktopMode;
};

const shouldFallbackToRedirect = (error: unknown) => {
    const code = getErrorCode(error);

    return code === 'auth/popup-blocked' ||
        code === 'auth/cancelled-popup-request' ||
        code === 'auth/operation-not-supported-in-this-environment';
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [isAuthorizing, setIsAuthorizing] = useState(false);
    const [visitorId, setVisitorId] = useState<string | null>(null);
    const [migrationPayload, setMigrationPayload] = useState<{ day: number; score: number } | null>(null);

    const clearMigration = () => setMigrationPayload(null);

    const ensureVisitorMapping = useCallback(async (firebaseUser: User) => {
        const session = getObserverSession();
        if (!session.visitorId) return;

        setVisitorId(session.visitorId);
        const mappingRef = doc(db, 'firebase_uid_mapping', firebaseUser.uid);
        await setDoc(mappingRef, {
            visitorId: session.visitorId,
            lastUpdated: serverTimestamp()
        }, { merge: true });
    }, []);

    const ensureUser = useCallback(async (): Promise<AuthUser> => {
        if (auth.currentUser) {
            await ensureVisitorMapping(auth.currentUser);
            return auth.currentUser as AuthUser;
        }
        setIsAuthorizing(true);
        try {
            const result = await signInAnonymously(auth);
            await ensureVisitorMapping(result.user);
            return result.user as AuthUser;
        } finally {
            setIsAuthorizing(false);
        }
    }, [ensureVisitorMapping]);

    useEffect(() => {
        const session = getObserverSession();
        setVisitorId(session.visitorId);

        void getRedirectResult(auth)
            .then(async (result) => {
                if (!result?.user) return;

                await result.user.getIdToken(true);

                if (result.operationType === 'link' && result.providerId === GoogleAuthProvider.PROVIDER_ID) {
                    const functions = getFunctions();
                    const welcomeFn = httpsCallable(functions, 'sendAnchorWelcome');
                    await welcomeFn();
                }
            })
            .catch((error: unknown) => {
                if (import.meta.env.DEV) console.error('[Delta-7] Redirect authentication failed:', error);
            });

        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                const idTokenResult = await firebaseUser.getIdTokenResult();
                const role = idTokenResult.claims.role as 'admin' | 'observer' || 'observer';

                const authUser = firebaseUser as AuthUser;
                authUser.role = role;

                if (role === 'observer') {
                    // IDENTITY_ANCHORING: Link Firebase UID to persistent Visitor ID
                    if (import.meta.env.DEV) console.log('[Delta-7] Syncing identity mapping for observer:', firebaseUser.uid);
                    const mappingRef = doc(db, 'firebase_uid_mapping', firebaseUser.uid);

                    try {
                        const mappingDoc = await getDoc(mappingRef);
                        if (mappingDoc.exists()) {
                            const existingVisitorId = mappingDoc.data().visitorId;
                            if (existingVisitorId !== session.visitorId) {
                                if (import.meta.env.DEV) console.log('[Delta-7] Re-anchoring to known Visitor ID:', existingVisitorId);
                                setVisitorId(existingVisitorId);
                                setObserverSession(existingVisitorId);
                            }
                        } else {
                            if (import.meta.env.DEV) console.log('[Delta-7] Establishing new identity anchor:', session.visitorId);
                            if (session.visitorId) {
                                await setDoc(mappingRef, {
                                    visitorId: session.visitorId,
                                    lastUpdated: serverTimestamp()
                                });
                            } else {
                                if (import.meta.env.DEV) console.warn('[Delta-7] Skipping identity anchor: visitorId is undefined');
                            }
                        }
                    } catch (err) {
                        if (import.meta.env.DEV) console.error('[Delta-7] Identity anchoring failure. Progress may not persist.', err);
                    }
                }

                setUser(authUser);
            } else {
                setUser(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const login = async (email: string, pass: string) => {
        setIsAuthorizing(true);
        try {
            await signInWithEmailAndPassword(auth, email, pass);
        } finally {
            setIsAuthorizing(false);
        }
    };

    const signup = async (email: string, pass: string) => {
        setIsAuthorizing(true);
        try {
            await createUserWithEmailAndPassword(auth, email, pass);
            // Trigger welcome email
            const functions = getFunctions();
            const welcomeFn = httpsCallable(functions, 'sendAnchorWelcome');
            await welcomeFn();
        } finally {
            setIsAuthorizing(false);
        }
    };

    const loginWithGoogle = async () => {
        setIsAuthorizing(true);
        try {
            const provider = createGoogleProvider();
            if (import.meta.env.DEV) console.log('[Delta-7] Initiating Google Authentication...');
            if (shouldUseRedirectForGoogleAuth()) {
                await signInWithRedirect(auth, provider);
                return;
            }

            try {
                await signInWithPopup(auth, provider);
            } catch (error: unknown) {
                if (!shouldFallbackToRedirect(error)) throw error;
                await signInWithRedirect(auth, provider);
            }
        } finally {
            setIsAuthorizing(false);
        }
    };

    const anchorIdentity = useCallback(async (method: 'google' | 'email', payload?: { email: string; password: string }) => {
        if (!auth.currentUser) throw new Error('No active session to anchor');
        setIsAuthorizing(true);
        try {
            if (method === 'google') {
                const provider = createGoogleProvider();
                if (import.meta.env.DEV) console.log('[Delta-7] Anchoring: Linking anonymous session to Google...');
                if (shouldUseRedirectForGoogleAuth()) {
                    await linkWithRedirect(auth.currentUser, provider);
                    return;
                }

                try {
                    await linkWithPopup(auth.currentUser, provider);
                } catch (error: unknown) {
                    if (!shouldFallbackToRedirect(error)) throw error;
                    await linkWithRedirect(auth.currentUser, provider);
                    return;
                }
            } else if (method === 'email') {
                if (!payload?.email || !payload.password) throw new Error('Missing credentials');
                const { email, password } = payload;
                const credential = EmailAuthProvider.credential(email, password);
                if (import.meta.env.DEV) console.log('[Delta-7] Anchoring: Linking anonymous session to Email...');
                await linkWithCredential(auth.currentUser, credential);
            }

            // Force token refresh
            await auth.currentUser.getIdToken(true);

            // Trigger welcome email
            const functions = getFunctions();
            const welcomeFn = httpsCallable(functions, 'sendAnchorWelcome');
            await welcomeFn();

            if (import.meta.env.DEV) console.log('[Delta-7] Anchoring complete. Identity preserved.');
        } catch (error: unknown) {
            if (import.meta.env.DEV) console.error('[Delta-7] Anchoring failed:', error);
            if (getErrorCode(error) === 'auth/credential-already-in-use') {
                throw new Error('This account is already linked. Please sign in (current progress will be replaced).');
            }
            throw error;
        } finally {
            setIsAuthorizing(false);
        }
    }, []);

    const recoverSession = useCallback(async (code: string) => {
        setIsAuthorizing(true);
        try {
            const functions = getFunctions();
            const recoverSignalFn = httpsCallable(functions, 'recoverSignal');

            if (import.meta.env.DEV) console.log(`[Delta-7] Attempting signal recovery: ${code}`);
            const result = await recoverSignalFn({ code });
            const { token, visitorId: recoveredVisitorId } = result.data as { token: string; visitorId?: string };

            if (token) {
                if (import.meta.env.DEV) console.log('[Delta-7] Signal locked. Re-authenticating...');

                // FIXED: Restore the visitorId from the recovered session
                if (recoveredVisitorId) {
                    if (import.meta.env.DEV) console.log(`[Delta-7] Restoring visitorId: ${recoveredVisitorId}`);
                    setVisitorId(recoveredVisitorId);
                    setObserverSession(recoveredVisitorId);
                }

                await signInWithCustomToken(auth, token);

                // FIX: Option B - Page reload to ensure clean state initialization
                // This eliminates all race conditions between AuthContext and CoherenceContext
                // The visitorId is now safely stored in LocalStorage, so a reload will pick it up correctly.
                if (import.meta.env.DEV) console.log('[Delta-7] SIGNAL_LOCKED: Initiating re-synchronization...');

                // Allow a brief moment for the auth state to settle, then reload
                setTimeout(() => {
                    window.location.reload();
                }, 300);
            } else {
                throw new Error('Signal degraded. timestamp_mismatch.');
            }
        } catch (error: unknown) {
            if (import.meta.env.DEV) console.error('Recovery failed:', error);
            setIsAuthorizing(false); // Only reset on failure; success leads to reload
            throw new Error('Signal recovery failed. Frequency invalid.');
        }
        // Note: setIsAuthorizing(false) is intentionally NOT called on success
        // because the page will reload before this would matter.
    }, []);

    const logout = async () => {
        setIsAuthorizing(true);
        try {
            await auth.signOut();
            if (import.meta.env.DEV) console.log('[Delta-7] Soft logout initiated. Reverting to anonymous observer...');
            await signInAnonymously(auth);
        } finally {
            setIsAuthorizing(false);
        }
    };

    const value: AuthContextType = {
        user,
        loading,
        isAdmin: user?.role === 'admin',
        login,
        signup,
        loginWithGoogle,
        logout,
        ensureUser,
        migrationPayload,
        clearMigration,
        isAuthorizing,
        visitorId,
        anchorIdentity,
        recoverSession
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
