import { createContext } from 'react';
import type { User } from 'firebase/auth';
import type { AuthUser } from '../context/AuthContext';
import type { CoherenceState } from '../types/schema';

export interface AuthContextType {
    user: AuthUser | null;
    loading: boolean;
    isAdmin: boolean;
    login: (email: string, pass: string) => Promise<void>;
    signup: (email: string, pass: string) => Promise<void>;
    loginWithGoogle: () => Promise<void>;
    logout: () => Promise<void>;
    ensureUser: () => Promise<AuthUser>;
    migrationPayload: { day: number; score: number } | null;
    clearMigration: () => void;
    isAuthorizing: boolean;
    visitorId: string | null;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export interface CoherenceContextType {
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

export const CoherenceContext = createContext<CoherenceContextType | undefined>(undefined);
