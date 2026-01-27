import React, { useState, useEffect } from 'react';
import { db, functions } from '../lib/firebase';
import { collection, query, orderBy, getDocs, doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';
import type { DayLog, CoherenceState } from '../types/schema';
import {
    Plus,
    Search,
    ChevronRight,
    Trash2,
    Image as ImageIcon,
    MessageSquare,
    BookOpen,
    Save,
    X,
    FileText,
    Archive,
    Layers,
    Sparkles,
    Loader2
} from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
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
        if (!editingDay || !window.confirm(`Are you sure you want to delete Day ${editingDay.day}?`)) return;
        setIsSaving(true);
        try {
            const dayRef = doc(db, 'season1_days', `day_${editingDay.day}`);
            await deleteDoc(dayRef);

            setDays(prev => prev.filter(d => d.day !== editingDay.day));
            setEditingDay(null);
        } catch (error) {
            console.error('Error deleting day:', error);
            alert('Failed to delete day.');
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
            alert('Failed to save data.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleCreateNew = () => {
        const nextDayNum = days.length > 0 ? Math.max(...days.map(d => d.day)) + 1 : 1;
        const newDay: DayLog = {
            day: nextDayNum,
            narrativeSummary: 'New day description...',
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

    // AI Generation State
    const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [aiContext, setAiContext] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedContent, setGeneratedContent] = useState<any | null>(null);

    const handleGenerateAI = async () => {
        if (!aiPrompt) return;
        setIsGenerating(true);
        try {
            // 1. Fetch AI Rules from Settings
            const settingsRef = doc(db, 'system', 'settings');
            const settingsSnap = await getDoc(settingsRef);
            const aiRules = settingsSnap.exists() ? settingsSnap.data().aiRules : '';

            // 2. Call Cloud Function
            const generateFn = httpsCallable(functions, 'generateNarrativeContent');
            const result = await generateFn({
                prompt: aiPrompt,
                context: aiContext,
                aiRules: aiRules
            });

            const content = result.data as any;
            setGeneratedContent(content);
        } catch (error) {
            console.error("AI Generation failed:", error);
            alert("Failed to generate content. See console for details.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleAcceptAI = () => {
        if (!generatedContent) return;

        // Update the current editing state instead of creating a new object
        // This keeps the user in the flow
        setEditingDay(prev => {
            if (!prev) return null;
            return {
                ...prev,
                narrativeSummary: generatedContent.narrativeSummary,
                vm_logs: generatedContent.vm_logs,
                fragments: generatedContent.fragments
            };
        });

        setIsAIPanelOpen(false);
        setGeneratedContent(null);
        setAiPrompt('');
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-400 text-sm">
                    Loading content...
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Narrative Manager</h1>
                    <p className="text-sm text-gray-500 mt-1">Create and edit daily narrative content.</p>
                </div>
                <button
                    onClick={handleCreateNew}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-all shadow-sm active:scale-95"
                >
                    <Plus size={18} />
                    <span>New Day</span>
                </button>
            </div>

            {/* Search and Filters */}
            <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                    type="text"
                    placeholder="Search days..."
                    className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
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
                        className="group bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg hover:border-emerald-200 transition-all duration-300 cursor-pointer relative overflow-hidden"
                    >
                        <div className="absolute top-4 right-4 text-gray-300 group-hover:text-emerald-500 transition-colors">
                            <ChevronRight size={20} />
                        </div>

                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg font-bold text-lg w-12 h-12 flex items-center justify-center">
                                {day.day}
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Day Log</p>
                                <p className="text-sm font-bold text-gray-900 line-clamp-1">{day.vm_logs?.['FEED_STABLE']?.title || 'Untitled'}</p>
                            </div>
                        </div>

                        <p className="text-gray-600 text-sm leading-relaxed line-clamp-3 mb-6">
                            {day.narrativeSummary || 'No summary recorded.'}
                        </p>

                        <div className="grid grid-cols-3 gap-2 pt-4 border-t border-gray-100">
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                <FileText size={14} className="text-gray-400" />
                                <span>{Object.keys(day.vm_logs || {}).length} Logs</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                <MessageSquare size={14} className="text-gray-400" />
                                <span>{day.fragments?.length || 0} Frags</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                <ImageIcon size={14} className="text-gray-400" />
                                <span>{day.images?.length || 0} Imgs</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Editor Sidebar/Overlay */}
            {editingDay && (
                <div className="fixed inset-0 z-[100] flex">
                    <div className="absolute inset-0 bg-black/20 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => !isSaving && setEditingDay(null)} />

                    <div className="relative ml-auto h-full w-full max-w-4xl bg-white shadow-2xl animate-in slide-in-from-right duration-300 overflow-hidden flex flex-col">
                        {/* Editor Header */}
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between shrink-0 bg-white">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                                    <Archive size={20} className="text-gray-500" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                        Editing Day:
                                        {isCreatingNew ? (
                                            <input
                                                type="number"
                                                className="w-16 bg-gray-50 border border-gray-200 rounded px-2 py-0.5 text-emerald-600 focus:outline-none focus:border-emerald-500"
                                                value={editingDay.day}
                                                onChange={(e) => handleDayChange(parseInt(e.target.value) || 0)}
                                                autoFocus
                                            />
                                        ) : (
                                            <span>{editingDay.day}</span>
                                        )}
                                    </h2>
                                    <p className="text-xs text-gray-500">Manage daily content and artifacts</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => {
                                        setEditingDay(null);
                                        setIsCreatingNew(false);
                                    }}
                                    disabled={isSaving}
                                    className="p-2 text-gray-400 hover:text-gray-900 transition-colors"
                                >
                                    <X size={24} />
                                </button>
                                <button
                                    onClick={() => setIsAIPanelOpen(true)}
                                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors shadow-sm"
                                >
                                    <Sparkles size={18} />
                                    <span className="hidden sm:inline">Ask Agent</span>
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="flex items-center gap-2 px-5 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-all disabled:opacity-50 active:scale-95 shadow-sm"
                                >
                                    {isSaving ? (
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <Save size={18} />
                                    )}
                                    <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
                                </button>
                            </div>
                        </div>

                        {/* Status Bar */}
                        <div className="bg-gray-50 border-b border-gray-100 px-8 py-2 flex items-center justify-between">
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                                <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> Ready to Edit</span>
                            </div>
                            <button
                                onClick={handleDelete}
                                disabled={isSaving}
                                className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1"
                            >
                                <Trash2 size={14} />
                                Delete Day
                            </button>
                        </div>

                        {/* Editor Content */}
                        <div className="flex-1 overflow-y-auto p-8 space-y-10 bg-gray-50/50">

                            {/* AI Agent Panel (Inline) */}
                            {isAIPanelOpen && (
                                <div className="bg-white rounded-xl border-2 border-purple-100 shadow-sm overflow-hidden animate-in slide-in-from-top-4 duration-300">
                                    <div className="p-4 bg-purple-50 border-b border-purple-100 flex items-center justify-between">
                                        <h3 className="font-bold text-purple-900 flex items-center gap-2">
                                            <Sparkles size={18} className="text-purple-600" /> Narrative Agent
                                        </h3>
                                        <button
                                            onClick={() => setIsAIPanelOpen(false)}
                                            className="text-gray-400 hover:text-purple-700 transition-colors"
                                        >
                                            <X size={18} />
                                        </button>
                                    </div>

                                    <div className="p-6 space-y-6">
                                        {!generatedContent ? (
                                            <>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div className="space-y-2">
                                                        <label className="block text-xs font-bold text-gray-500 uppercase">Context / Situation</label>
                                                        <textarea
                                                            value={aiContext}
                                                            onChange={(e) => setAiContext(e.target.value)}
                                                            className="w-full h-32 p-3 bg-purple-50/50 border border-purple-100 rounded-lg text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 resize-none transition-all"
                                                            placeholder="Current state of system, recent events..."
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="block text-xs font-bold text-gray-500 uppercase">Agent Instructions</label>
                                                        <textarea
                                                            value={aiPrompt}
                                                            onChange={(e) => setAiPrompt(e.target.value)}
                                                            className="w-full h-32 p-3 bg-purple-50/50 border border-purple-100 rounded-lg text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 resize-none transition-all"
                                                            placeholder="What should happen today? Tone? Key events?"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex justify-end">
                                                    <button
                                                        onClick={handleGenerateAI}
                                                        disabled={isGenerating || !aiPrompt}
                                                        className="px-6 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2 text-sm font-bold shadow-sm active:scale-95 transition-all"
                                                    >
                                                        {isGenerating ? (
                                                            <><Loader2 size={16} className="animate-spin" /> Generating Narrative...</>
                                                        ) : (
                                                            <><Sparkles size={16} /> Generate Content</>
                                                        )}
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="space-y-6 animate-in fade-in duration-300">
                                                <div className="bg-purple-50 p-5 rounded-lg border border-purple-100">
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                                                        <span className="text-xs font-bold text-purple-800 uppercase">AI Suggestion</span>
                                                    </div>
                                                    <p className="text-sm text-gray-800 leading-relaxed font-medium">{generatedContent.narrativeSummary}</p>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-100 flex flex-col items-center justify-center text-center">
                                                        <span className="text-2xl font-bold text-gray-900 mb-1">{Object.keys(generatedContent.vm_logs).length}</span>
                                                        <span className="text-xs text-gray-500 uppercase font-medium">Logs Generated</span>
                                                    </div>
                                                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-100 flex flex-col items-center justify-center text-center">
                                                        <span className="text-2xl font-bold text-gray-900 mb-1">{generatedContent.fragments.length}</span>
                                                        <span className="text-xs text-gray-500 uppercase font-medium">Fragments Generated</span>
                                                    </div>
                                                </div>

                                                <div className="flex justify-end gap-3 pt-2">
                                                    <button
                                                        onClick={() => setGeneratedContent(null)}
                                                        className="px-4 py-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors"
                                                    >
                                                        Discard
                                                    </button>
                                                    <button
                                                        onClick={handleAcceptAI}
                                                        className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2 text-sm font-bold shadow-sm active:scale-95 transition-all"
                                                    >
                                                        <Save size={16} /> Apply to Editor
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Narrative Summary */}
                            <div className="space-y-3 bg-white p-6 rounded-xl border border-gray-200 shadow-sm relative group">
                                <label className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                                    <BookOpen size={16} className="text-gray-500" /> Internal Summary
                                </label>
                                <textarea
                                    className="w-full bg-white border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all min-h-[80px]"
                                    value={editingDay.narrativeSummary}
                                    onChange={(e) => setEditingDay({ ...editingDay, narrativeSummary: e.target.value })}
                                    placeholder="Brief description of this day's events..."
                                />
                            </div>

                            {/* VM Logs Manager */}
                            <div className="space-y-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                                        <Layers size={16} className="text-gray-500" /> Content Blocks (Log States)
                                    </label>
                                </div>

                                {/* Tabs */}
                                <div className="flex gap-1 p-1 bg-gray-100 rounded-lg overflow-x-auto">
                                    {COHERENCE_STATES.map(state => (
                                        <button
                                            key={state}
                                            onClick={() => setActiveLogTab(state)}
                                            className={cn(
                                                "px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap",
                                                activeLogTab === state
                                                    ? "bg-white text-emerald-700 shadow-sm"
                                                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-200"
                                            )}
                                        >
                                            {state.replace('_', ' ')}
                                        </button>
                                    ))}
                                </div>

                                {/* Tab Content */}
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-gray-500 uppercase">Title / Heading</label>
                                        <input
                                            type="text"
                                            className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                            value={editingDay.vm_logs?.[activeLogTab]?.title || ''}
                                            onChange={(e) => {
                                                const logs = { ...editingDay.vm_logs };
                                                const current = logs[activeLogTab] || { id: `${editingDay.day}_${activeLogTab.toLowerCase()}`, title: '', body: '' };
                                                logs[activeLogTab] = { ...current, title: e.target.value };
                                                setEditingDay({ ...editingDay, vm_logs: logs });
                                            }}
                                            placeholder="e.g. System Log..."
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-gray-500 uppercase">Body Content</label>
                                        <textarea
                                            className="w-full bg-white border border-gray-200 rounded-lg p-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 min-h-[150px]"
                                            value={editingDay.vm_logs?.[activeLogTab]?.body || ''}
                                            onChange={(e) => {
                                                const logs = { ...editingDay.vm_logs };
                                                const current = logs[activeLogTab] || { id: `${editingDay.day}_${activeLogTab.toLowerCase()}`, title: '', body: '' };
                                                logs[activeLogTab] = { ...current, body: e.target.value };
                                                setEditingDay({ ...editingDay, vm_logs: logs });
                                            }}
                                            placeholder="Enter log content..."
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Fragments Manager */}
                            <div className="space-y-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                                        <MessageSquare size={16} className="text-gray-500" /> Fragments (Floating Text)
                                    </label>
                                    <button
                                        onClick={() => {
                                            const frags = [...(editingDay.fragments || [])];
                                            frags.push({ id: `frag_${Date.now()}`, body: '', severity: 'COHERENCE_FRAYING' });
                                            setEditingDay({ ...editingDay, fragments: frags });
                                        }}
                                        className="text-xs text-emerald-600 font-bold hover:text-emerald-700"
                                    >
                                        + Add Fragment
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {(editingDay.fragments || []).map((frag, idx) => (
                                        <div key={frag.id} className="flex gap-4 p-4 bg-gray-50 rounded-lg border border-gray-100 items-start">
                                            <div className="w-6 h-6 rounded bg-gray-200 flex items-center justify-center shrink-0 text-xs font-bold text-gray-600">{idx + 1}</div>
                                            <div className="flex-1 space-y-3">
                                                <textarea
                                                    className="w-full bg-white border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:border-emerald-500"
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
                                                        className="bg-transparent text-xs text-gray-500 border-none focus:ring-0 cursor-pointer"
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
                                                        className="text-xs text-red-500 hover:text-red-700"
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {(editingDay.fragments || []).length === 0 && (
                                        <p className="text-center py-4 text-xs text-gray-400 italic">No fragments added.</p>
                                    )}
                                </div>
                            </div>

                            {/* Images Manager */}
                            <div className="space-y-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                                        <ImageIcon size={16} className="text-gray-500" /> Images
                                    </label>
                                    <button
                                        onClick={() => {
                                            const imgs = [...(editingDay.images || [])];
                                            imgs.push({ id: '', url: '', caption: '', placeholder: false });
                                            setEditingDay({ ...editingDay, images: imgs });
                                        }}
                                        className="text-xs text-emerald-600 font-bold hover:text-emerald-700"
                                    >
                                        + Add Image
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {(editingDay.images || []).map((img, idx) => (
                                        <div key={idx} className="p-4 bg-gray-50 rounded-lg border border-gray-100 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-gray-500 uppercase">Image {idx + 1}</span>
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
                                                className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs"
                                                value={img.id}
                                                onChange={(e) => {
                                                    const imgs = [...editingDay.images!];
                                                    imgs[idx] = { ...img, id: e.target.value };
                                                    setEditingDay({ ...editingDay, images: imgs });
                                                }}
                                                placeholder="Asset ID..."
                                            />
                                            <input
                                                type="text"
                                                className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs"
                                                value={img.caption}
                                                onChange={(e) => {
                                                    const imgs = [...editingDay.images!];
                                                    imgs[idx] = { ...img, caption: e.target.value };
                                                    setEditingDay({ ...editingDay, images: imgs });
                                                }}
                                                placeholder="Caption..."
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
                                                    className="w-3 h-3 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                                />
                                                <span className="text-xs text-gray-500">Placeholder Image</span>
                                            </label>
                                        </div>
                                    ))}
                                    {(editingDay.images || []).length === 0 && (
                                        <div className="col-span-full py-4 text-center text-xs text-gray-400 italic">
                                            No images added.
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
