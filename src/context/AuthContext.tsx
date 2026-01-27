import React, { useEffect, useState, useCallback } from 'react';
import {
    onAuthStateChanged,
    signInAnonymously,
    GoogleAuthProvider,
    signInWithPopup,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    linkWithPopup,
    linkWithCredential,
    signInWithCustomToken,
    EmailAuthProvider,
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

const ADMIN_EMAIL = 'robert.barker2008@gmail.com';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [isAuthorizing, setIsAuthorizing] = useState(false);
    const [visitorId, setVisitorId] = useState<string | null>(null);
    const [migrationPayload, setMigrationPayload] = useState<{ day: number; score: number } | null>(null);

    const clearMigration = () => setMigrationPayload(null);

    const ensureUser = useCallback(async (): Promise<AuthUser> => {
        if (auth.currentUser) return auth.currentUser as AuthUser;
        setIsAuthorizing(true);
        try {
            const result = await signInAnonymously(auth);
            return result.user as AuthUser;
        } finally {
            setIsAuthorizing(false);
        }
    }, []);

    useEffect(() => {
        const session = getObserverSession();
        setVisitorId(session.visitorId);

        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                const idTokenResult = await firebaseUser.getIdTokenResult();
                let role = idTokenResult.claims.role as 'admin' | 'observer' || 'observer';

                // Hardcoded admin override for specific email
                if (firebaseUser.email === ADMIN_EMAIL) {
                    role = 'admin';
                }

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
            if (auth.currentUser?.isAnonymous) {
                if (import.meta.env.DEV) console.log('[Delta-7] Anchoring anonymous session to Email identity...');
                await signInWithEmailAndPassword(auth, email, pass);
            } else {
                await signInWithEmailAndPassword(auth, email, pass);
            }
        } finally {
            setIsAuthorizing(false);
        }
    };

    const signup = async (email: string, pass: string) => {
        setIsAuthorizing(true);
        try {
            await createUserWithEmailAndPassword(auth, email, pass);
        } finally {
            setIsAuthorizing(false);
        }
    };

    const loginWithGoogle = async () => {
        setIsAuthorizing(true);
        try {
            const provider = new GoogleAuthProvider();
            if (import.meta.env.DEV) console.log('[Delta-7] Initiating Google Authentication...');
            await signInWithPopup(auth, provider);
        } finally {
            setIsAuthorizing(false);
        }
    };

    const anchorIdentity = useCallback(async (method: 'google' | 'email', payload?: any) => {
        if (!auth.currentUser) throw new Error('No active session to anchor');
        setIsAuthorizing(true);
        try {
            if (method === 'google') {
                const provider = new GoogleAuthProvider();
                if (import.meta.env.DEV) console.log('[Delta-7] Anchoring: Linking anonymous session to Google...');
                await linkWithPopup(auth.currentUser, provider);
            } else if (method === 'email') {
                const { email, password } = payload;
                if (!email || !password) throw new Error('Missing credentials');
                const credential = EmailAuthProvider.credential(email, password);
                if (import.meta.env.DEV) console.log('[Delta-7] Anchoring: Linking anonymous session to Email...');
                await linkWithCredential(auth.currentUser, credential);
            }

            // Force token refresh
            await auth.currentUser.getIdToken(true);
            if (import.meta.env.DEV) console.log('[Delta-7] Anchoring complete. Identity preserved.');
        } catch (error: any) {
            if (import.meta.env.DEV) console.error('[Delta-7] Anchoring failed:', error);
            if (error.code === 'auth/credential-already-in-use') {
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
            } else {
                throw new Error('Signal degraded. timestamp_mismatch.');
            }
        } catch (error: any) {
            if (import.meta.env.DEV) console.error('Recovery failed:', error);
            throw new Error('Signal recovery failed. Frequency invalid.');
        } finally {
            setIsAuthorizing(false);
        }
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
