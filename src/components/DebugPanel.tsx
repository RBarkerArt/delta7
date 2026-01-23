import React, { useState } from 'react';
import { useCoherence } from '../hooks/useCoherence';
import { useAuth } from '../hooks/useAuth';
import { Activity, Shield, Hammer, RefreshCcw } from 'lucide-react';

export const DebugPanel: React.FC = () => {
    const { score, setScore, currentDay, setCurrentDay, state } = useCoherence();
    const { user, visitorId } = useAuth();
    const [isOpen, setIsOpen] = useState(false);

    // Nexus Diagnostic Tool is kept visible for real-time performance and narrative testing.

    return (
        <div className={`fixed bottom-4 right-4 z-[5000] flex flex-col items-end gap-2 transition-transform duration-500 ${isOpen ? 'translate-y-0' : 'translate-y-[calc(100%-48px)]'}`}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-4 py-3 bg-zinc-900 border border-emerald-900/40 rounded-xl text-emerald-500 hover:bg-zinc-800 transition-all font-mono text-[10px] tracking-widest uppercase shadow-2xl"
            >
                <Hammer size={16} />
                Nexus_Diagnostic {isOpen ? '[CLOSE]' : '[OPEN]'}
            </button>

            <div className="w-80 bg-zinc-900 border border-emerald-900/40 rounded-2xl p-6 shadow-2xl space-y-6 backdrop-blur-md">
                <div className="space-y-4">
                    <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                        <span>Metrics_Control</span>
                        <Shield size={12} className="text-emerald-500/50" />
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between text-xs font-mono">
                            <span className="text-zinc-400">Coherence_Level</span>
                            <span className="text-emerald-500">{score.toFixed(1)}%</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={score}
                            onChange={(e) => setScore(Number(e.target.value))}
                            className="w-full accent-emerald-500 bg-zinc-800 rounded-lg h-1.5 appearance-none"
                        />
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between text-xs font-mono">
                            <span className="text-zinc-400">Temporal_Day</span>
                            <span className="text-emerald-500">{currentDay}</span>
                        </div>
                        <input
                            type="range"
                            min="1"
                            max="50"
                            value={currentDay}
                            onChange={(e) => setCurrentDay(Number(e.target.value))}
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
