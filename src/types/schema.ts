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
    prologueSentences?: string[]; // NEW: Unified prologues with day entries
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

// Story Bible for 365-day narrative continuity
export interface StoryBible {
    season: string;             // "season1"
    overview: string;           // 2-3 paragraph story synopsis
    themes: string[];           // ["isolation", "trust", "memory loss"]
    characters: Array<{
        name: string;
        role: string;
        arc: string;            // Character progression across season
    }>;
    plotBeats: Array<{
        dayStart: number;
        dayEnd: number;
        title: string;          // "Act 1: Awakening"
        description: string;    // What happens in this beat
    }>;
    aiInstructions: string;     // Persistent AI guidance for generation
    updatedAt?: Timestamp;
}

export interface SystemSettings {
    maintenanceMode: boolean;
    registrationOpen: boolean;
    glitchIntensity: number;
    // Atmosphere Controls
    theme?: 'green' | 'amber' | 'red' | 'blue' | 'white';
    particleEffect?: 'dust' | 'ash' | 'digital-rain' | 'none';
    cursorStyle?: 'crosshair' | 'default' | 'none';
    isBlackout?: boolean;
    // Audio Protocols
    audioVolume?: number; // 0.0 to 1.0
    isAudioEnabled?: boolean;
    backgroundTrackUrl?: string;
    audioMode?: 'generative' | 'track' | 'hybrid';
    hybridTrackVolume?: number; // 0.0 to 1.0, specifically for background track in hybrid mode
    aiRules?: string;
    updatedAt?: Timestamp;
}

