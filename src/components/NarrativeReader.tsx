import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import type { DayLog } from '../types/schema';
import {
    BookOpen,
    Layers,
    Activity,
    Ghost,
    ArrowRight,
    Search,
    RefreshCw,
    Clipboard,
    CheckCircle2,
    Sparkles
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

type ReaderTab = 'PROLOGUE' | 'VM_LOG' | 'FRAGMENT' | 'ARC';

export const NarrativeReader: React.FC = () => {
    const [days, setDays] = useState<DayLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<ReaderTab>('PROLOGUE');
    const [searchTerm, setSearchTerm] = useState('');
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        fetchAllContent();
    }, []);

    const fetchAllContent = async () => {
        setLoading(true);
        try {
            const daysQuery = query(collection(db, 'season1_days'), orderBy('day', 'asc'));
            const daysSnapshot = await getDocs(daysQuery);
            setDays(daysSnapshot.docs.map(doc => doc.data() as DayLog));
        } catch (error) {
            console.error('Error fetching narrative content:', error);
        } finally {
            setLoading(false);
        }
    };

    const getStableVMLog = (day: DayLog) => {
        if (!day.vm_logs) return null;
        return day.vm_logs['FEED_STABLE'] || Object.values(day.vm_logs)[0];
    };

    const getStableFragment = (day: DayLog) => {
        if (!day.fragments || day.fragments.length === 0) return null;
        return day.fragments.find(f => f.severity === 'FEED_STABLE') || day.fragments[0];
    };

    const filteredDays = days.filter(d =>
        d.day.toString().includes(searchTerm) ||
        d.narrativeSummary?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.prologueSentences?.some(s => s.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-96 gap-4">
                <RefreshCw className="animate-spin text-emerald-500" size={32} />
                <div className="text-zinc-400 font-mono text-xs uppercase tracking-widest">
                    Synthesizing_Narrative_Stream...
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Narrative Reader</h1>
                    <p className="text-sm text-zinc-500 mt-1">Review the story in a sequential, stable temporal format.</p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl">
                    <BookOpen size={16} className="text-emerald-600" />
                    <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest">
                        {days.length} Days Processed
                    </span>
                </div>
            </div>

            {/* Navigation & Search */}
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                <div className="flex items-center p-1 bg-zinc-100 rounded-2xl border border-zinc-200">
                    <button
                        onClick={() => setActiveTab('PROLOGUE')}
                        className={cn(
                            "flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold font-mono transition-all",
                            activeTab === 'PROLOGUE'
                                ? "bg-white text-emerald-600 shadow-sm border border-emerald-100"
                                : "text-zinc-400 hover:text-zinc-600"
                        )}
                    >
                        <Layers size={14} />
                        PROLOGUES
                    </button>
                    <button
                        onClick={() => setActiveTab('VM_LOG')}
                        className={cn(
                            "flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold font-mono transition-all",
                            activeTab === 'VM_LOG'
                                ? "bg-white text-emerald-600 shadow-sm border border-emerald-100"
                                : "text-zinc-400 hover:text-zinc-600"
                        )}
                    >
                        <Activity size={14} />
                        VM_LOGS
                    </button>
                    <button
                        onClick={() => setActiveTab('FRAGMENT')}
                        className={cn(
                            "flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold font-mono transition-all",
                            activeTab === 'FRAGMENT'
                                ? "bg-white text-emerald-600 shadow-sm border border-emerald-100"
                                : "text-zinc-400 hover:text-zinc-600"
                        )}
                    >
                        <Ghost size={14} />
                        FRAGMENTS
                    </button>
                    <button
                        onClick={() => setActiveTab('ARC')}
                        className={cn(
                            "flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold font-mono transition-all",
                            activeTab === 'ARC'
                                ? "bg-white text-emerald-600 shadow-sm border border-emerald-100"
                                : "text-zinc-400 hover:text-zinc-600"
                        )}
                    >
                        <Sparkles size={14} />
                        NARRATIVE_ARC
                    </button>
                </div>

                <div className="relative w-full lg:w-96 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-emerald-500 transition-colors" size={18} />
                    <input
                        type="text"
                        placeholder="Search sequence..."
                        className="w-full pl-11 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Content Feed */}
            <div className="max-w-4xl mx-auto space-y-12">
                {activeTab === 'PROLOGUE' && filteredDays.map((day) => (
                    <section key={day.day} className="relative pl-12 border-l-2 border-zinc-100 last:border-l-0 pb-12">
                        <div className="absolute left-0 top-0 -translate-x-1/2 w-8 h-8 rounded-full bg-white border-4 border-zinc-100 flex items-center justify-center text-[10px] font-bold text-zinc-400">
                            {day.day}
                        </div>
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-mono font-bold text-emerald-600 uppercase tracking-widest">Temporal_Induction</span>
                                <div className="h-px flex-1 bg-zinc-100" />
                            </div>
                            <div className="bg-zinc-50/50 rounded-2xl p-8 border border-zinc-100 space-y-3">
                                {(day.prologueSentences && day.prologueSentences.length > 0) ? (
                                    day.prologueSentences.map((sentence, idx) => (
                                        <p key={idx} className="text-zinc-700 leading-relaxed font-serif text-lg">
                                            {sentence}
                                        </p>
                                    ))
                                ) : (
                                    <p className="text-zinc-400 italic font-mono text-sm">No prologue data initialized for this day.</p>
                                )}
                            </div>
                        </div>
                    </section>
                ))}

                {activeTab === 'VM_LOG' && filteredDays.map((day) => {
                    const log = getStableVMLog(day);
                    if (!log) return null;
                    return (
                        <section key={day.day} className="relative pl-12 border-l-2 border-zinc-100 last:border-l-0 pb-12">
                            <div className="absolute left-0 top-0 -translate-x-1/2 w-8 h-8 rounded-full bg-white border-4 border-zinc-100 flex items-center justify-center text-[10px] font-bold text-zinc-400">
                                {day.day}
                            </div>
                            <div className="space-y-6">
                                <div className="flex items-center gap-3">
                                    <span className="text-[10px] font-mono font-bold text-emerald-600 uppercase tracking-widest">Diagnostic_Log_Stable</span>
                                    <div className="h-px flex-1 bg-zinc-100" />
                                </div>
                                <div className="bg-white rounded-3xl p-10 shadow-sm border border-zinc-100 space-y-8">
                                    <div className="space-y-2">
                                        <h3 className="text-emerald-600 font-mono text-xs font-bold uppercase flex items-center gap-2">
                                            <ArrowRight size={12} /> {log.title}
                                        </h3>
                                        <div className="h-1 w-12 bg-emerald-500/20" />
                                    </div>
                                    <p className="text-zinc-800 leading-relaxed font-mono text-sm whitespace-pre-wrap">
                                        {log.body}
                                    </p>
                                    <div className="pt-8 border-t border-zinc-50">
                                        <p className="text-[10px] font-mono text-zinc-400 uppercase italic">
                                            Summary: {day.narrativeSummary}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </section>
                    );
                })}

                {activeTab === 'FRAGMENT' && filteredDays.map((day) => {
                    const frag = getStableFragment(day);
                    if (!frag) return null;
                    return (
                        <section key={day.day} className="relative pl-12 border-l-2 border-zinc-100 last:border-l-0 pb-12">
                            <div className="absolute left-0 top-0 -translate-x-1/2 w-8 h-8 rounded-full bg-white border-4 border-zinc-100 flex items-center justify-center text-[10px] font-bold text-zinc-400">
                                {day.day}
                            </div>
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <span className="text-[10px] font-mono font-bold text-emerald-600 uppercase tracking-widest">Ghost_Thread_Origin</span>
                                    <div className="h-px flex-1 bg-zinc-100" />
                                </div>
                                <div className="bg-zinc-900 rounded-3xl p-12 text-zinc-300 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <Ghost size={80} />
                                    </div>
                                    <p className="text-xl font-serif italic relative z-10 leading-relaxed">
                                        "{frag.body}"
                                    </p>
                                    <div className="mt-8 flex items-center gap-3">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Stable Neural Trace Detected</span>
                                    </div>
                                </div>
                            </div>
                        </section>
                    );
                })}

                {activeTab === 'ARC' && (
                    <div className="space-y-6">
                        <div className="flex justify-end">
                            <button
                                onClick={() => {
                                    const arcText = days.map(day => {
                                        const prologue = day.prologueSentences?.[0] || '';
                                        const log = getStableVMLog(day);
                                        const frag = getStableFragment(day);
                                        return `DAY ${day.day}\nPROLOGUE: ${prologue}\nLOG: ${log?.body || ''}\nFRAGMENT: ${frag?.body || ''}\n\n`;
                                    }).join('---\n');
                                    navigator.clipboard.writeText(arcText);
                                    setCopied(true);
                                    setTimeout(() => setCopied(false), 2000);
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded-lg text-xs font-mono hover:bg-zinc-800 transition-all"
                            >
                                {copied ? <CheckCircle2 size={14} /> : <Clipboard size={14} />}
                                {copied ? 'COPIED_TO_CLIPBOARD' : 'COPY_NARRATIVE_ARC'}
                            </button>
                        </div>
                        <div className="bg-zinc-900 rounded-3xl p-8 border border-zinc-800 font-mono text-sm text-zinc-300 overflow-auto max-h-[70vh] custom-scrollbar">
                            {days.map((day) => {
                                const prologue = day.prologueSentences?.[0] || '';
                                const log = getStableVMLog(day);
                                const frag = getStableFragment(day);
                                return (
                                    <div key={day.day} className="mb-12 last:mb-0 space-y-4">
                                        <div className="flex items-center gap-4 text-emerald-500 font-bold">
                                            <span>[DAY_{day.day}]</span>
                                            <div className="h-px flex-1 bg-zinc-800" />
                                        </div>
                                        <div className="space-y-2 pl-4 border-l border-zinc-800">
                                            <p className="text-zinc-500 text-[10px] uppercase tracking-widest">Temporal_Induction</p>
                                            <p className="italic text-zinc-400">"{prologue}"</p>
                                        </div>
                                        <div className="space-y-2 pl-4 border-l border-zinc-800 text-xs">
                                            <p className="text-zinc-500 text-[10px] uppercase tracking-widest">Neural_Log_Stable</p>
                                            <p className="whitespace-pre-wrap">{log?.body}</p>
                                        </div>
                                        <div className="space-y-2 pl-4 border-l border-zinc-800 text-xs text-emerald-400/80">
                                            <p className="text-zinc-500 text-[10px] uppercase tracking-widest">Stable_Neural_Trace</p>
                                            <p>"{frag?.body}"</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {(activeTab === 'FRAGMENT' || activeTab === 'VM_LOG' || activeTab === 'PROLOGUE' || activeTab === 'ARC') &&
                    filteredDays.length === 0 && (
                        <div className="text-center py-20 px-8 bg-zinc-50 rounded-3xl border-2 border-dashed border-zinc-200">
                            <p className="text-zinc-400 font-mono text-sm uppercase tracking-widest">
                                No matching sequences found for filter: "{searchTerm}"
                            </p>
                        </div>
                    )}
            </div>
        </div>
    );
};
