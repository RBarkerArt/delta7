import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import type { DayLog, CoherenceState } from '../types/schema';
import {
    Plus,
    Search,
    ChevronRight,
    Trash2,
    Image as ImageIcon,
    Ghost,
    BookOpen,
    Save,
    X,
    Layout,
    Archive,
    Activity
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const COHERENCE_STATES: CoherenceState[] = [
    'FEED_STABLE',
    'SYNC_RECOVERING',
    'COHERENCE_FRAYING',
    'SIGNAL_FRAGMENTED',
    'CRITICAL_INTERFERENCE'
];

export const NarrativeManager: React.FC = () => {
    const [days, setDays] = useState<DayLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Editor State
    const [editingDay, setEditingDay] = useState<DayLog | null>(null);
    const [isCreatingNew, setIsCreatingNew] = useState(false);
    const [activeLogTab, setActiveLogTab] = useState<CoherenceState>('FEED_STABLE');

    useEffect(() => {
        fetchDays();
    }, []);

    const fetchDays = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, 'season1_days'), orderBy('day', 'asc'));
            const querySnapshot = await getDocs(q);
            const daysData = querySnapshot.docs.map(doc => doc.data() as DayLog);
            setDays(daysData);
        } catch (error) {
            console.error('Error fetching days:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!editingDay || !window.confirm(`Permanently terminate transmission for Day ${editingDay.day}?`)) return;
        setIsSaving(true);
        try {
            const dayRef = doc(db, 'season1_days', `day_${editingDay.day}`);
            await deleteDoc(dayRef);

            setDays(prev => prev.filter(d => d.day !== editingDay.day));
            setEditingDay(null);
        } catch (error) {
            console.error('Error deleting day:', error);
            alert('Failed to terminate sequence.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSave = async () => {
        if (!editingDay) return;
        setIsSaving(true);
        try {
            const dayRef = doc(db, 'season1_days', `day_${editingDay.day}`);
            await setDoc(dayRef, editingDay, { merge: true });

            setDays(prev => {
                const exists = prev.some(d => d.day === editingDay.day);
                if (exists) {
                    return prev.map(d => d.day === editingDay.day ? editingDay : d);
                }
                return [...prev, editingDay].sort((a, b) => a.day - b.day);
            });
            setEditingDay(null);
            setIsCreatingNew(false);
        } catch (error) {
            console.error('Error saving day:', error);
            alert('Failed to save neural data.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleCreateNew = () => {
        const nextDayNum = days.length > 0 ? Math.max(...days.map(d => d.day)) + 1 : 1;
        const newDay: DayLog = {
            day: nextDayNum,
            narrativeSummary: 'New observation period initiated...',
            vm_logs: {
                'FEED_STABLE': { id: `day${nextDayNum}_stable`, title: `vm5:00${nextDayNum}`, body: '' }
            },
            fragments: [],
            images: [],
            variables: {
                flicker: 0.1,
                drift: 0.1,
                audioDistortion: 0,
                textCorruption: 0,
                kaelCoherence: 100
            }
        };
        setIsCreatingNew(true);
        setEditingDay(newDay);
    };

    const handleDayChange = (newDayNum: number) => {
        if (!editingDay) return;

        const logs = { ...editingDay.vm_logs };
        const currentTitle = logs['FEED_STABLE']?.title || '';

        // Auto-populate ONLY if the title is empty or matches the old vm5:00 pattern
        const isDefaultTitle = !currentTitle ||
            currentTitle === 'SYSTEM_STATUS: NOMINAL' ||
            currentTitle.startsWith('vm5:00');

        if (isDefaultTitle) {
            logs['FEED_STABLE'] = {
                ...(logs['FEED_STABLE'] || { id: `day${newDayNum}_stable`, body: '' }),
                title: `vm5:00${newDayNum}`
            };
        }

        setEditingDay({ ...editingDay, day: newDayNum, vm_logs: logs });
    };

    const filteredDays = days.filter(day =>
        day.day.toString().includes(searchTerm) ||
        day.narrativeSummary.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-pulse text-zinc-400 font-mono text-sm uppercase tracking-widest">
                    Initializing_Archive_Stream...
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Observation Logs</h1>
                    <p className="text-sm text-zinc-500 mt-1">Manage the core narrative lifecycle of the station.</p>
                </div>
                <button
                    onClick={handleCreateNew}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-all shadow-sm shadow-emerald-200 active:scale-95 group"
                >
                    <Plus size={18} className="group-hover:rotate-90 transition-transform duration-300" />
                    <span>Initiate_New_Induction</span>
                </button>
            </div>

            {/* Search and Filters */}
            <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-emerald-500 transition-colors" size={20} />
                <input
                    type="text"
                    placeholder="Search logs by day or summary..."
                    className="w-full pl-12 pr-4 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Logs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredDays.map((day) => (
                    <div
                        key={day.day}
                        onClick={() => {
                            setIsCreatingNew(false);
                            setEditingDay(day);
                        }}
                        className="group bg-white border border-zinc-200 rounded-2xl p-6 hover:shadow-xl hover:shadow-zinc-200/50 hover:border-emerald-200 transition-all duration-300 cursor-pointer relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <ChevronRight size={20} className="text-emerald-500" />
                        </div>

                        <div className="flex items-start justify-between mb-4">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-mono text-emerald-600 uppercase tracking-[0.2em] font-bold">Temporal_Marker</span>
                                <span className="text-2xl font-black text-zinc-900 italic">DAY_{day.day.toString().padStart(2, '0')}</span>
                            </div>
                        </div>

                        <p className="text-zinc-600 text-sm leading-relaxed line-clamp-3 mb-6 font-medium italic">
                            "{day.narrativeSummary || 'No summary recorded.'}"
                        </p>

                        <div className="grid grid-cols-2 gap-3 pt-4 border-t border-zinc-100">
                            <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-mono uppercase tracking-widest">
                                <Layout size={12} className="text-zinc-300" />
                                <span>{Object.keys(day.vm_logs || {}).length} VM_STATES</span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-mono uppercase tracking-widest">
                                <Ghost size={12} className="text-zinc-300" />
                                <span>{day.fragments?.length || 0} FRAGMENTS</span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-mono uppercase tracking-widest">
                                <ImageIcon size={12} className="text-zinc-300" />
                                <span>{day.images?.length || 0} ARTIFACTS</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Editor Sidebar/Overlay */}
            {editingDay && (
                <div className="fixed inset-0 z-[100] flex">
                    <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => !isSaving && setEditingDay(null)} />

                    <div className="relative ml-auto h-full w-full max-w-4xl bg-white shadow-2xl animate-in slide-in-from-right duration-500 overflow-hidden flex flex-col">
                        {/* Editor Header */}
                        <div className="p-6 border-b border-zinc-100 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-zinc-100 rounded-xl flex items-center justify-center">
                                    <Archive size={20} className="text-zinc-400" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-zinc-900 tracking-tight flex items-center gap-2">
                                        NARRATIVE_LOG:
                                        {isCreatingNew ? (
                                            <div className="flex items-center gap-2 bg-zinc-100 px-3 py-1 rounded-lg">
                                                <span className="text-zinc-400">DAY_</span>
                                                <input
                                                    type="number"
                                                    className="w-16 bg-transparent focus:outline-none text-emerald-600"
                                                    value={editingDay.day}
                                                    onChange={(e) => handleDayChange(parseInt(e.target.value) || 0)}
                                                    autoFocus
                                                />
                                            </div>
                                        ) : (
                                            <span>DAY_{editingDay.day}</span>
                                        )}
                                    </h2>
                                    <p className="text-[10px] text-zinc-400 font-mono tracking-widest uppercase">Biological_Artifact_Matrix_v2.0</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => {
                                        setEditingDay(null);
                                        setIsCreatingNew(false);
                                    }}
                                    disabled={isSaving}
                                    className="p-2 text-zinc-400 hover:text-zinc-900 transition-colors"
                                >
                                    <X size={24} />
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all disabled:opacity-50 active:scale-95"
                                >
                                    {isSaving ? (
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <Save size={18} />
                                    )}
                                    <span>{isSaving ? 'SYNCING...' : 'SAVE_DATA'}</span>
                                </button>
                            </div>
                        </div>

                        {/* Status Bar */}
                        <div className="bg-zinc-50 border-b border-zinc-100 px-8 py-2 flex items-center justify-between">
                            <div className="flex items-center gap-4 text-[9px] font-mono text-zinc-400 uppercase tracking-widest">
                                <span className="flex items-center gap-1"><div className="w-1 h-1 bg-emerald-500 rounded-full" /> ARCHIVE_ACTIVE</span>
                                <span>SYNC_READY: YES</span>
                            </div>
                            <button
                                onClick={handleDelete}
                                disabled={isSaving}
                                className="text-[9px] font-mono text-red-400 hover:text-red-600 uppercase tracking-widest font-bold flex items-center gap-1"
                            >
                                <Trash2 size={10} />
                                TERMINATE_DAY
                            </button>
                        </div>

                        {/* Editor Content */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-10">
                            {/* Narrative Summary */}
                            <div className="space-y-3">
                                <label className="text-[10px] text-zinc-400 font-mono tracking-[0.2em] font-bold uppercase flex items-center gap-2">
                                    <BookOpen size={12} /> Narrative_Summary (Observer Internal)
                                </label>
                                <textarea
                                    className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all min-h-[100px] font-medium"
                                    value={editingDay.narrativeSummary}
                                    onChange={(e) => setEditingDay({ ...editingDay, narrativeSummary: e.target.value })}
                                    placeholder="Summarize the biological events for this period..."
                                />
                            </div>

                            {/* VM Logs Manager */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] text-zinc-400 font-mono tracking-[0.2em] font-bold uppercase flex items-center gap-2">
                                        <Activity size={12} /> State-Reactive_VM_Logs
                                    </label>
                                    <span className="text-[10px] text-emerald-600 font-bold font-mono">ENCRYPTED_FEED</span>
                                </div>

                                {/* Tabs */}
                                <div className="flex gap-2 p-1 bg-zinc-50 rounded-xl border border-zinc-200 overflow-x-auto no-scrollbar">
                                    {COHERENCE_STATES.map(state => (
                                        <button
                                            key={state}
                                            onClick={() => setActiveLogTab(state)}
                                            className={cn(
                                                "px-4 py-2 rounded-lg text-[10px] font-bold font-mono uppercase tracking-widest transition-all whitespace-nowrap",
                                                activeLogTab === state
                                                    ? "bg-white text-emerald-600 shadow-sm border border-emerald-100"
                                                    : "text-zinc-400 hover:text-zinc-600"
                                            )}
                                        >
                                            {state.replace('_', ' ')}
                                        </button>
                                    ))}
                                </div>

                                {/* Tab Content */}
                                <div className="p-6 bg-zinc-50 rounded-2xl border border-zinc-200 space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] text-zinc-400 font-mono uppercase">Header_Transmission</label>
                                        <input
                                            type="text"
                                            className="w-full bg-white border border-emerald-100 rounded-lg p-3 text-xs font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/10"
                                            value={editingDay.vm_logs?.[activeLogTab]?.title || ''}
                                            onChange={(e) => {
                                                const logs = { ...editingDay.vm_logs };
                                                const current = logs[activeLogTab] || { id: `${editingDay.day}_${activeLogTab.toLowerCase()}`, title: '', body: '' };
                                                logs[activeLogTab] = { ...current, title: e.target.value };
                                                setEditingDay({ ...editingDay, vm_logs: logs });
                                            }}
                                            placeholder="Transmission Header..."
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] text-zinc-400 font-mono uppercase">Log_Body</label>
                                        <textarea
                                            className="w-full bg-white border border-emerald-100 rounded-lg p-4 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/10 min-h-[150px]"
                                            value={editingDay.vm_logs?.[activeLogTab]?.body || ''}
                                            onChange={(e) => {
                                                const logs = { ...editingDay.vm_logs };
                                                const current = logs[activeLogTab] || { id: `${editingDay.day}_${activeLogTab.toLowerCase()}`, title: '', body: '' };
                                                logs[activeLogTab] = { ...current, body: e.target.value };
                                                setEditingDay({ ...editingDay, vm_logs: logs });
                                            }}
                                            placeholder="Enter narrative body... Use periods for rhythmic pacing."
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Fragments Manager */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] text-zinc-400 font-mono tracking-[0.2em] font-bold uppercase flex items-center gap-2">
                                        <Ghost size={12} /> Neural_Fragments (Ghost Thoughts)
                                    </label>
                                    <button
                                        onClick={() => {
                                            const frags = [...(editingDay.fragments || [])];
                                            frags.push({ id: `frag_${Date.now()}`, body: '', severity: 'COHERENCE_FRAYING' });
                                            setEditingDay({ ...editingDay, fragments: frags });
                                        }}
                                        className="text-[10px] text-emerald-600 font-bold hover:underline font-mono uppercase tracking-widest"
                                    >
                                        + Apparate_Fragment
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {(editingDay.fragments || []).map((frag, idx) => (
                                        <div key={frag.id} className="flex gap-4 p-4 bg-zinc-50 rounded-xl border border-zinc-200 items-start">
                                            <div className="w-8 h-8 rounded-lg bg-zinc-200 flex items-center justify-center shrink-0 text-[10px] font-bold">{idx + 1}</div>
                                            <div className="flex-1 space-y-3">
                                                <textarea
                                                    className="w-full bg-white border border-zinc-100 rounded-lg p-3 text-xs focus:outline-none"
                                                    value={frag.body}
                                                    onChange={(e) => {
                                                        const frags = [...editingDay.fragments!];
                                                        frags[idx] = { ...frag, body: e.target.value };
                                                        setEditingDay({ ...editingDay, fragments: frags });
                                                    }}
                                                    placeholder="Enter fragment text..."
                                                />
                                                <div className="flex items-center gap-4">
                                                    <select
                                                        className="bg-transparent text-[10px] font-mono text-zinc-400 border-none focus:ring-0 cursor-pointer"
                                                        value={frag.severity}
                                                        onChange={(e) => {
                                                            const frags = [...editingDay.fragments!];
                                                            frags[idx] = { ...frag, severity: e.target.value as CoherenceState };
                                                            setEditingDay({ ...editingDay, fragments: frags });
                                                        }}
                                                    >
                                                        {COHERENCE_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                                                    </select>
                                                    <button
                                                        onClick={() => {
                                                            const frags = editingDay.fragments!.filter(f => f.id !== frag.id);
                                                            setEditingDay({ ...editingDay, fragments: frags });
                                                        }}
                                                        className="text-[10px] text-red-400 hover:text-red-500 font-mono"
                                                    >
                                                        DELETE
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {(editingDay.fragments || []).length === 0 && (
                                        <p className="text-center py-6 text-[10px] text-zinc-400 font-mono italic">NO_FRAGMENTS_TRIGGERED_FOR_THIS_PERIOD</p>
                                    )}
                                </div>
                            </div>

                            {/* Images Manager */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] text-zinc-400 font-mono tracking-[0.2em] font-bold uppercase flex items-center gap-2">
                                        <ImageIcon size={12} /> Biological_Artifacts (Evidence)
                                    </label>
                                    <button
                                        onClick={() => {
                                            const imgs = [...(editingDay.images || [])];
                                            imgs.push({ id: '', url: '', caption: '', placeholder: false });
                                            setEditingDay({ ...editingDay, images: imgs });
                                        }}
                                        className="text-[10px] text-emerald-600 font-bold hover:underline font-mono uppercase tracking-widest"
                                    >
                                        + Capture_Artifact
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {(editingDay.images || []).map((img, idx) => (
                                        <div key={idx} className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-mono font-bold text-zinc-300 uppercase">Artifact_{idx + 1}</span>
                                                <button
                                                    onClick={() => {
                                                        const imgs = editingDay.images!.filter((_, i) => i !== idx);
                                                        setEditingDay({ ...editingDay, images: imgs });
                                                    }}
                                                    className="text-red-400 hover:text-red-500"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                            <input
                                                type="text"
                                                className="w-full bg-white border border-zinc-100 rounded-lg p-2 text-xs font-mono"
                                                value={img.id}
                                                onChange={(e) => {
                                                    const imgs = [...editingDay.images!];
                                                    imgs[idx] = { ...img, id: e.target.value };
                                                    setEditingDay({ ...editingDay, images: imgs });
                                                }}
                                                placeholder="Asset ID (e.g. artifact_01)"
                                            />
                                            <input
                                                type="text"
                                                className="w-full bg-white border border-zinc-100 rounded-lg p-2 text-xs"
                                                value={img.caption}
                                                onChange={(e) => {
                                                    const imgs = [...editingDay.images!];
                                                    imgs[idx] = { ...img, caption: e.target.value };
                                                    setEditingDay({ ...editingDay, images: imgs });
                                                }}
                                                placeholder="Caption/Label..."
                                            />
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={img.placeholder}
                                                    onChange={(e) => {
                                                        const imgs = [...editingDay.images!];
                                                        imgs[idx] = { ...img, placeholder: e.target.checked };
                                                        setEditingDay({ ...editingDay, images: imgs });
                                                    }}
                                                    className="w-3 h-3 rounded border-zinc-200 text-emerald-600 focus:ring-emerald-500"
                                                />
                                                <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Mark_As_Placeholder</span>
                                            </label>
                                        </div>
                                    ))}
                                    {(editingDay.images || []).length === 0 && (
                                        <div className="col-span-full py-6 text-center text-[10px] text-zinc-400 font-mono italic bg-zinc-50/50 rounded-xl border border-dashed border-zinc-200">
                                            NO_VISUAL_AUTHENTICATION_DATA
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
