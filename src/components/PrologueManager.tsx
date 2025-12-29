import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import type { PrologueData } from '../types/schema';
import {
    Plus,
    Search,
    Edit3,
    Trash2,
    History,
    Save,
    X,
    MessageSquare,
    Layers,
    MoveUp,
    MoveDown
} from 'lucide-react';

export const PrologueManager: React.FC = () => {
    const [prologues, setPrologues] = useState<PrologueData[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Editor State
    const [editingPrologue, setEditingPrologue] = useState<PrologueData | null>(null);

    useEffect(() => {
        fetchPrologues();
    }, []);

    const fetchPrologues = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, 'season1_prologues'), orderBy('day', 'asc'));
            const querySnapshot = await getDocs(q);
            const data = querySnapshot.docs.map(doc => doc.data() as PrologueData);
            setPrologues(data);
        } catch (error) {
            console.error('Error fetching prologues:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (prologue: PrologueData) => {
        if (!window.confirm(`Permanently terminate sequence for Day ${prologue.day}?`)) return;
        setIsSaving(true);
        try {
            const docRef = doc(db, 'season1_prologues', `prologue_day_${prologue.day}`);
            await deleteDoc(docRef);

            setPrologues(prev => prev.filter(p => p.day !== prologue.day));
        } catch (error) {
            console.error('Error deleting prologue:', error);
            alert('Failed to terminate sequence.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSave = async () => {
        if (!editingPrologue) return;
        setIsSaving(true);
        try {
            const docRef = doc(db, 'season1_prologues', `prologue_day_${editingPrologue.day}`);
            await setDoc(docRef, editingPrologue, { merge: true });

            setPrologues(prev => {
                const exists = prev.some(p => p.day === editingPrologue.day);
                if (exists) {
                    return prev.map(p => p.day === editingPrologue.day ? editingPrologue : p);
                }
                return [...prev, editingPrologue].sort((a, b) => a.day - b.day);
            });
            setEditingPrologue(null);
        } catch (error) {
            console.error('Error saving prologue:', error);
            alert('Failed to sync sequence.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleCreateNew = () => {
        const nextDay = prologues.length > 0 ? Math.max(...prologues.map(p => p.day)) + 1 : 1;
        setEditingPrologue({
            day: nextDay,
            sentences: ['Station induction initializing...']
        });
    };

    const reorderSentence = (idx: number, direction: 'up' | 'down') => {
        if (!editingPrologue) return;
        const newSentences = [...editingPrologue.sentences];
        const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= newSentences.length) return;

        [newSentences[idx], newSentences[targetIdx]] = [newSentences[targetIdx], newSentences[idx]];
        setEditingPrologue({ ...editingPrologue, sentences: newSentences });
    };

    const filteredPrologues = prologues.filter(p =>
        p.day.toString().includes(searchTerm) ||
        p.sentences.some(s => s.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-pulse text-zinc-400 font-mono text-sm uppercase tracking-widest">
                    Synchronizing_Sequential_Pool...
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Prologue Sequences</h1>
                    <p className="text-sm text-zinc-500 mt-1">Manage the station induction sentences for initial coherence.</p>
                </div>
                <button
                    onClick={handleCreateNew}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-all shadow-sm shadow-emerald-200 active:scale-95 group"
                >
                    <Plus size={18} className="group-hover:rotate-90 transition-transform duration-300" />
                    <span>Append_Sequence</span>
                </button>
            </div>

            {/* Search */}
            <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-emerald-500 transition-colors" size={20} />
                <input
                    type="text"
                    placeholder="Search sentences or day markers..."
                    className="w-full pl-12 pr-4 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Prologue List */}
            <div className="space-y-4">
                {filteredPrologues.map((prologue) => (
                    <div
                        key={prologue.day}
                        className="bg-white border border-zinc-200 rounded-2xl p-6 hover:border-emerald-200 transition-all duration-300"
                    >
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-zinc-100 rounded-xl flex items-center justify-center">
                                    <Layers size={20} className="text-zinc-400" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-zinc-900">DAY_{prologue.day.toString().padStart(2, '0')}</h3>
                                    <p className="text-[10px] text-zinc-400 font-mono tracking-widest uppercase">{prologue.sentences.length} INDUCTION_LINES</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setEditingPrologue(prologue)}
                                    className="p-2 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                >
                                    <Edit3 size={18} />
                                </button>
                                <button
                                    onClick={() => handleDelete(prologue)}
                                    disabled={isSaving}
                                    className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all disabled:opacity-30"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            {prologue.sentences.slice(0, 3).map((sentence, idx) => (
                                <div
                                    key={idx}
                                    className="group flex items-start gap-4 p-3 bg-zinc-50 rounded-xl border border-transparent hover:border-emerald-100 hover:bg-emerald-50/30 transition-all"
                                >
                                    <span className="text-[10px] font-mono text-zinc-300 pt-1">{(idx + 1).toString().padStart(2, '0')}</span>
                                    <p className="text-sm text-zinc-600 line-clamp-1">
                                        {sentence}
                                    </p>
                                </div>
                            ))}
                            {prologue.sentences.length > 3 && (
                                <p className="text-[10px] text-zinc-400 font-mono px-3 italic tracking-widest">+ {prologue.sentences.length - 3} MORE_CHUNKS...</p>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Editor Sidebar/Overlay */}
            {editingPrologue && (
                <div className="fixed inset-0 z-[100] flex">
                    <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => !isSaving && setEditingPrologue(null)} />

                    <div className="relative ml-auto h-full w-full max-w-2xl bg-white shadow-2xl animate-in slide-in-from-right duration-500 overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-zinc-100 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-zinc-100 rounded-xl flex items-center justify-center">
                                    <History size={20} className="text-zinc-400" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-zinc-900 tracking-tight">PROLOGUE: DAY_{editingPrologue.day}</h2>
                                    <p className="text-[10px] text-zinc-400 font-mono tracking-widest uppercase">Sequential_Induction_Editor</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setEditingPrologue(null)}
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
                                    <span>{isSaving ? 'SYNCING...' : 'SAVE_POOL'}</span>
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-8">
                            <div className="space-y-3">
                                <label className="text-[10px] text-zinc-400 font-mono tracking-[0.2em] font-bold uppercase flex items-center gap-2">
                                    <MessageSquare size={12} /> Sequence_Chunks
                                </label>

                                <div className="space-y-4">
                                    {editingPrologue.sentences.map((sentence, idx) => (
                                        <div key={idx} className="group flex gap-4 items-start bg-zinc-50 p-4 rounded-xl border border-zinc-200">
                                            <div className="flex flex-col gap-1 shrink-0 pt-1">
                                                <button
                                                    onClick={() => reorderSentence(idx, 'up')}
                                                    disabled={idx === 0}
                                                    className="p-1 text-zinc-300 hover:text-emerald-500 disabled:opacity-0 transition-colors"
                                                >
                                                    <MoveUp size={14} />
                                                </button>
                                                <span className="text-[10px] font-mono font-bold text-center text-zinc-400">
                                                    {(idx + 1).toString().padStart(2, '0')}
                                                </span>
                                                <button
                                                    onClick={() => reorderSentence(idx, 'down')}
                                                    disabled={idx === editingPrologue.sentences.length - 1}
                                                    className="p-1 text-zinc-300 hover:text-emerald-500 disabled:opacity-0 transition-colors"
                                                >
                                                    <MoveDown size={14} />
                                                </button>
                                            </div>

                                            <div className="flex-1 space-y-2">
                                                <textarea
                                                    className="w-full bg-white border border-zinc-100 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/10 min-h-[60px]"
                                                    value={sentence}
                                                    onChange={(e) => {
                                                        const sents = [...editingPrologue.sentences];
                                                        sents[idx] = e.target.value;
                                                        setEditingPrologue({ ...editingPrologue, sentences: sents });
                                                    }}
                                                    placeholder="Enter induction sentence..."
                                                />
                                                <div className="flex justify-end">
                                                    <button
                                                        onClick={() => {
                                                            const sents = editingPrologue.sentences.filter((_, i) => i !== idx);
                                                            setEditingPrologue({ ...editingPrologue, sentences: sents });
                                                        }}
                                                        className="text-[10px] text-red-400 hover:text-red-500 font-mono font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        TERMINATE_CHUNK
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    <button
                                        onClick={() => {
                                            setEditingPrologue({
                                                ...editingPrologue,
                                                sentences: [...editingPrologue.sentences, '']
                                            });
                                        }}
                                        className="w-full py-4 border-2 border-dashed border-zinc-200 rounded-xl text-[10px] font-mono text-zinc-400 hover:border-emerald-500 hover:text-emerald-600 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Plus size={14} />
                                        APPEND_SEQUENTIAL_DATA
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
