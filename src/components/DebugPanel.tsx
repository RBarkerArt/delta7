import React, { useState, useCallback } from 'react';
import { useCoherence } from '../hooks/useCoherence';
import { useAuth } from '../hooks/useAuth';
import { Activity, Shield, Hammer, RefreshCcw, Database } from 'lucide-react';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

// Debounce timer for slider updates
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export const DebugPanel: React.FC = () => {
    // Read-only from context - diagnostic displays current state, writers for optimistic updates
    const { score, currentDay, state, setScore, setCurrentDay } = useCoherence();
    const { user, visitorId } = useAuth();
    const [isOpen, setIsOpen] = useState(false);

    // Local state for sliders (immediate UI feedback)
    const [localScore, setLocalScore] = useState(score);
    const [localDay, setLocalDay] = useState(currentDay);
    const [isSyncing, setIsSyncing] = useState(false);

    // Sync local state when context changes
    React.useEffect(() => { setLocalScore(score); }, [score]);
    React.useEffect(() => { setLocalDay(currentDay); }, [currentDay]);

    // DIRECT FIRESTORE UPDATE - Independent from app logic
    const updateFirestore = useCallback(async (field: string, value: number) => {
        if (!visitorId) return;

        const docRef = doc(db, 'observers', visitorId);

        try {
            setIsSyncing(true);

            if (field === 'coherenceScore') {
                await updateDoc(docRef, {
                    coherenceScore: value,
                    coherenceState: value >= 80 ? 'FEED_STABLE' : value >= 60 ? 'SYNC_RECOVERING' : value >= 40 ? 'COHERENCE_FRAYING' : value >= 20 ? 'SIGNAL_FRAGMENTED' : 'CRITICAL_INTERFERENCE'
                });
            } else if (field === 'dayProgress') {
                // When changing day, also adjust startDate so calculation holds
                const msPerDay = 24 * 60 * 60 * 1000;
                const newStartTime = Date.now() - (value - 1) * msPerDay;
                await updateDoc(docRef, {
                    dayProgress: value,
                    startDate: Timestamp.fromMillis(newStartTime)
                });
            }

            console.log(`[Nexus_Diagnostic] Firestore updated: ${field} = ${value}`);
        } catch (err) {
            console.error('[Nexus_Diagnostic] Firestore update failed:', err);
        } finally {
            setIsSyncing(false);
        }
    }, [visitorId]);

    // Debounced handler for sliders
    const handleSliderChange = (field: 'coherenceScore' | 'dayProgress', value: number) => {
        // Update local state immediately for smooth UI
        if (field === 'coherenceScore') {
            setLocalScore(value);
            // OPTIMISTIC UPDATE: Tell context to update immediately
            setScore(value);
        } else {
            setLocalDay(value);
            // OPTIMISTIC UPDATE: Tell context to update immediately
            setCurrentDay(value);
        }

        // Debounce Firestore write
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            updateFirestore(field, value);
        }, 300);
    };

    // Nexus Diagnostic: Admin testing tool that writes directly to database
    // App will pick up changes on next Firestore sync cycle

    return (
        <div className={`fixed bottom-4 right-4 z-[5000] flex flex-col items-end gap-2 transition-transform duration-500 ${isOpen ? 'translate-y-0' : 'translate-y-[calc(100%-48px)]'}`}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-4 py-3 bg-zinc-900 border border-emerald-900/40 rounded-xl text-emerald-500 hover:bg-zinc-800 transition-all font-mono text-[10px] tracking-widest uppercase shadow-2xl"
            >
                <Hammer size={16} />
                Nexus_Diagnostic {isOpen ? '[CLOSE]' : '[OPEN]'}
                {isSyncing && <Database size={12} className="animate-pulse text-amber-500" />}
            </button>

            <div className="w-80 bg-zinc-900 border border-emerald-900/40 rounded-2xl p-6 shadow-2xl space-y-6 backdrop-blur-md">
                <div className="space-y-4">
                    <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                        <span>Metrics_Control</span>
                        <div className="flex items-center gap-2">
                            <Database size={10} className={isSyncing ? 'text-amber-500 animate-pulse' : 'text-zinc-600'} />
                            <Shield size={12} className="text-emerald-500/50" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between text-xs font-mono">
                            <span className="text-zinc-400">Coherence_Level</span>
                            <span className="text-emerald-500">{localScore.toFixed(1)}%</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={localScore}
                            onChange={(e) => handleSliderChange('coherenceScore', Number(e.target.value))}
                            className="w-full accent-emerald-500 bg-zinc-800 rounded-lg h-1.5 appearance-none"
                        />
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between text-xs font-mono">
                            <span className="text-zinc-400">Temporal_Day</span>
                            <span className="text-emerald-500">{localDay}</span>
                        </div>
                        <input
                            type="range"
                            min="1"
                            max="50"
                            value={localDay}
                            onChange={(e) => handleSliderChange('dayProgress', Number(e.target.value))}
                            className="w-full accent-emerald-500 bg-zinc-800 rounded-lg h-1.5 appearance-none"
                        />
                    </div>
                </div>

                <div className="pt-4 border-t border-emerald-900/20 space-y-3">
                    <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                        <span>Identity_Trace</span>
                        <Activity size={12} className="text-emerald-500/50" />
                    </div>

                    <div className="bg-zinc-950/50 rounded-xl p-3 border border-emerald-900/10 space-y-2">
                        <div className="flex flex-col gap-1">
                            <span className="text-[8px] text-zinc-600 font-mono uppercase">Visitor_ID</span>
                            <span className="text-[10px] text-emerald-500/70 font-mono truncate">{visitorId || 'NULL'}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-[8px] text-zinc-600 font-mono uppercase">Firebase_UID</span>
                            <span className="text-[10px] text-emerald-500/70 font-mono truncate">{user?.uid || 'NOT_LINKED'}</span>
                        </div>
                        <div className="flex items-center gap-2 pt-1 border-t border-emerald-900/5">
                            <span className="text-[8px] text-zinc-600 font-mono uppercase">Status:</span>
                            <span className="text-[10px] text-emerald-500 font-bold">{state}</span>
                        </div>
                    </div>
                </div>

                <div className="pt-2">
                    <button
                        onClick={() => window.location.reload()}
                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-zinc-400 text-[10px] font-mono uppercase tracking-widest transition-all"
                    >
                        <RefreshCcw size={12} />
                        Hard_Reset_Signal
                    </button>
                </div>
            </div>
        </div>
    );
};
