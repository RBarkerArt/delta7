import { Timestamp } from 'firebase/firestore';

export type CoherenceState = 'FEED_STABLE' | 'SYNC_RECOVERING' | 'COHERENCE_FRAYING' | 'SIGNAL_FRAGMENTED' | 'CRITICAL_INTERFERENCE';

export type ReturnSignalReason = 'same_day_return' | 'daily_signal_opened' | 'catchup_return';

export interface ReturnSignalReport {
    absenceMs: number;
    dayDelta: number;
    previousDay: number;
    currentDay: number;
    coherenceDelta: number;
    reason: ReturnSignalReason;
}

// Note: ObserverSession is defined in lib/visitor.ts - do not duplicate here

export interface UserProgress {
    startDate: Timestamp;
    lastSeenAt: Timestamp;
    visitCount: number;
    coherenceScore: number; // 0-100
    coherenceState: CoherenceState;
    seenFragments: string[];
    recoveredItems?: string[];
    dayProgress: number;
    isManualDayProgress?: boolean;
    isAnchored: boolean;
    email: string | null;
    visitorId?: string | null;
    anchoredFirebaseUid?: string | null;
    accessCode?: string; // Tuning Code for manual matching
    createdAt?: Timestamp; // Legacy support
    milligrams?: number;
    lastCoffeeSignalDay?: number;
    lastCoffeeClaimedAt?: Timestamp;
    lastFridgeSignalDay?: number;
    lastFridgeClaimedAt?: Timestamp;
    lastFridgeOutcome?: {
        signalDay: number;
        selectedSlot: number;
        selectedItemName: string;
        winningSlot: number;
        winningItemName: string;
        success: boolean;
        milligramsAwarded: number;
        message: string;
    };
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
        /**
         * Torn Halves (#7): two fragments sharing a pairId are two halves of one
         * document. Each renders torn (legible top, ragged edge, "[remainder
         * filed elsewhere]") until BOTH are recovered, then they knit together.
         */
        pairId?: string;
        /**
         * Fragment Sets (#7): the named collection this fragment belongs to
         * (keyed to a set defined in lib/fragmentSets.ts). Filled slots render
         * legible; empty slots render as titled silhouettes in the archive.
         */
        set?: string;
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
    // Rooms — when true, mobile/memory-safe runtime does a true SPA room swap
    // (react-router navigate) instead of the sessionStorage + location.replace
    // reload. Default falsey = keep the reload behavior.
    mobileSpaRooms?: boolean;
    particleSize?: number; // 0.4 to 1.6 (scale)
    particleDensity?: number; // 0.5 to 2.0 (multiplier)
    particleSpeed?: number; // 0.4 to 1.6 (multiplier)
    particleOpacity?: number; // 0.3 to 1.2 (multiplier)
    particleTint?: string; // Hex color override like #33ff00
    // Audio Protocols
    audioVolume?: number; // 0.0 to 1.0
    isAudioEnabled?: boolean;
    backgroundTrackUrl?: string;
    audioMode?: 'generative' | 'track' | 'hybrid';
    hybridTrackVolume?: number; // 0.0 to 1.0, specifically for background track in hybrid mode
    aiRules?: string;
    updatedAt?: Timestamp;
}
