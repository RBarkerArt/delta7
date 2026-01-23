import { Timestamp } from 'firebase/firestore';

export type CoherenceState = 'FEED_STABLE' | 'SYNC_RECOVERING' | 'COHERENCE_FRAYING' | 'SIGNAL_FRAGMENTED' | 'CRITICAL_INTERFERENCE';

export interface ObserverSession {
    visitorId: string;        // Our generated UUID - primary identifier
    visitorToken: string;     // Secret token for session validation
    firebaseUid?: string;     // Current Firebase UID (changes are okay now)
    isAnchored: boolean;      // Completed Day 30 anchoring?
    anchoredEmail?: string;   // Email if anchored
}

export interface UserProgress {
    startDate: Timestamp;
    lastSeenAt: Timestamp;
    visitCount: number;
    coherenceScore: number; // 0-100
    coherenceState: CoherenceState;
    seenFragments: string[];
    dayProgress: number;
    isManualDayProgress?: boolean;
    isAnchored: boolean;
    email: string | null;
    visitorId?: string;
    anchoredFirebaseUid?: string | null;
    createdAt?: Timestamp; // Legacy support
}

export interface DayLog {
    day: number;
    narrativeSummary: string;
    vm_logs: Partial<Record<CoherenceState, {
        id: string;
        title: string;
        body: string;
    }>>;
    fragments: Array<{
        id: string;
        body: string;
        severity: CoherenceState;
    }>;
    images?: Array<{
        id: string;
        url: string;
        caption: string;
        description?: string;
        placeholder?: boolean;
    }>;
    variables?: {
        flicker: number;
        drift: number;
        audioDistortion: number;
        textCorruption: number;
        kaelCoherence: number;
        kaelMood?: string; // Optional expansion
    };
}

export interface PrologueData {
    day: number;
    sentences: string[];
}
