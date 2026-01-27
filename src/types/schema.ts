import { Timestamp } from 'firebase/firestore';

export type CoherenceState = 'FEED_STABLE' | 'SYNC_RECOVERING' | 'COHERENCE_FRAYING' | 'SIGNAL_FRAGMENTED' | 'CRITICAL_INTERFERENCE';

// Note: ObserverSession is defined in lib/visitor.ts - do not duplicate here

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
    visitorId?: string | null;
    anchoredFirebaseUid?: string | null;
    accessCode?: string; // Tuning Code for manual matching
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

export interface SystemSettings {
    maintenanceMode: boolean;
    registrationOpen: boolean;
    glitchIntensity: number;
    aiRules?: string;
    updatedAt?: Timestamp;
}
