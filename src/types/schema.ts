import { Timestamp } from 'firebase/firestore';

export type CoherenceState = 'FEED_STABLE' | 'SYNC_RECOVERING' | 'COHERENCE_FRAYING' | 'SIGNAL_FRAGMENTED' | 'CRITICAL_INTERFERENCE';

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
        caption: string;
        placeholder?: boolean;
    }>;
    variables?: {
        flicker: number;
        drift: number;
        audioDistortion: number;
        textCorruption: number;
        kaelCoherence: number;
    };
}

export interface PrologueData {
    day: number;
    sentences: string[];
}
