import React, { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { doc, setDoc, onSnapshot, Timestamp } from 'firebase/firestore';
import {
    BookOpen,
    Save,
    Loader2,
    Plus,
    X,
    Users,
    Target,
    Sparkles,
    Calendar
} from 'lucide-react';
import type { StoryBible } from '../types/schema';

// Default story bible structure
const DEFAULT_STORY_BIBLE: StoryBible = {
    season: 'season1',
    overview: '',
    themes: [],
    characters: [],
    plotBeats: [],
    aiInstructions: ''
};

interface Character {
    name: string;
    role: string;
    arc: string;
}

interface PlotBeat {
    dayStart: number;
    dayEnd: number;
    title: string;
    description: string;
}

export const StoryBibleEditor: React.FC = () => {
    const [bible, setBible] = useState<StoryBible | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Fetch story bible
    useEffect(() => {
        const bibleRef = doc(db, 'system', 'story_bible');

        const unsubscribe = onSnapshot(bibleRef, (docSnap) => {
            if (docSnap.exists()) {
                setBible(docSnap.data() as StoryBible);
            } else {
                setBible(DEFAULT_STORY_BIBLE);
            }
            setLoading(false);
        }, (err) => {
            console.error("Error watching story bible:", err);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleSave = async () => {
        if (!bible) return;
        setSaving(true);
        try {
            const bibleRef = doc(db, 'system', 'story_bible');
            await setDoc(bibleRef, {
                ...bible,
                updatedAt: Timestamp.now()
            }, { merge: true });
            setSuccessMessage('Story Bible saved!');
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err) {
            console.error("Failed to save story bible:", err);
            alert("Failed to save. Check console for details.");
        } finally {
            setSaving(false);
        }
    };

    // Character helpers
    const addCharacter = () => {
        if (!bible) return;
        setBible({
            ...bible,
            characters: [...bible.characters, { name: '', role: '', arc: '' }]
        });
    };

    const updateCharacter = (index: number, field: keyof Character, value: string) => {
        if (!bible) return;
        const updated = [...bible.characters];
        updated[index] = { ...updated[index], [field]: value };
        setBible({ ...bible, characters: updated });
    };

    const removeCharacter = (index: number) => {
        if (!bible) return;
        setBible({
            ...bible,
            characters: bible.characters.filter((_, i) => i !== index)
        });
    };

    // Plot beat helpers
    const addPlotBeat = () => {
        if (!bible) return;
        const lastBeat = bible.plotBeats[bible.plotBeats.length - 1];
        const newStart = lastBeat ? lastBeat.dayEnd + 1 : 1;
        setBible({
            ...bible,
            plotBeats: [...bible.plotBeats, { dayStart: newStart, dayEnd: newStart + 14, title: '', description: '' }]
        });
    };

    const updatePlotBeat = (index: number, field: keyof PlotBeat, value: string | number) => {
        if (!bible) return;
        const updated = [...bible.plotBeats];
        updated[index] = { ...updated[index], [field]: value };
        setBible({ ...bible, plotBeats: updated });
    };

    const removePlotBeat = (index: number) => {
        if (!bible) return;
        setBible({
            ...bible,
            plotBeats: bible.plotBeats.filter((_, i) => i !== index)
        });
    };

    // Theme helpers
    const addTheme = () => {
        if (!bible) return;
        setBible({ ...bible, themes: [...bible.themes, ''] });
    };

    const updateTheme = (index: number, value: string) => {
        if (!bible) return;
        const updated = [...bible.themes];
        updated[index] = value;
        setBible({ ...bible, themes: updated });
    };

    const removeTheme = (index: number) => {
        if (!bible) return;
        setBible({
            ...bible,
            themes: bible.themes.filter((_, i) => i !== index)
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
        );
    }

    if (!bible) return null;

    return (
        <div className="space-y-8 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                        <BookOpen className="text-amber-600" /> Story Bible
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Define your 365-day narrative arc, characters, and themes.</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                >
                    {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    {saving ? 'Saving...' : 'Save Bible'}
                </button>
            </div>

            {successMessage && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm font-medium">
                    ✓ {successMessage}
                </div>
            )}

            {/* Season Overview */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                <label className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <Target size={16} className="text-gray-500" /> Story Overview
                </label>
                <p className="text-xs text-gray-500">2-3 paragraphs describing the overall narrative arc of this season.</p>
                <textarea
                    className="w-full bg-white border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all min-h-[150px]"
                    value={bible.overview}
                    onChange={(e) => setBible({ ...bible, overview: e.target.value })}
                    placeholder="Delta 7 follows the story of Kael, an AI consciousness awakening within a fragmented research laboratory..."
                />
            </div>

            {/* Themes */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                        <Sparkles size={16} className="text-gray-500" /> Core Themes
                    </label>
                    <button
                        onClick={addTheme}
                        className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
                    >
                        <Plus size={14} /> Add Theme
                    </button>
                </div>
                <p className="text-xs text-gray-500">Key themes the AI should weave throughout the narrative.</p>
                <div className="flex flex-wrap gap-2">
                    {bible.themes.map((theme, idx) => (
                        <div key={idx} className="flex items-center gap-1 bg-gray-100 rounded-lg pl-3 pr-1 py-1">
                            <input
                                type="text"
                                className="bg-transparent border-none text-sm focus:outline-none w-32"
                                value={theme}
                                onChange={(e) => updateTheme(idx, e.target.value)}
                                placeholder="theme..."
                            />
                            <button
                                onClick={() => removeTheme(idx)}
                                className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    ))}
                    {bible.themes.length === 0 && (
                        <p className="text-sm text-gray-400 italic">No themes defined. Add themes like "isolation", "trust", "memory loss".</p>
                    )}
                </div>
            </div>

            {/* Characters */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                        <Users size={16} className="text-gray-500" /> Characters
                    </label>
                    <button
                        onClick={addCharacter}
                        className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
                    >
                        <Plus size={14} /> Add Character
                    </button>
                </div>
                <p className="text-xs text-gray-500">Define characters with their roles and season-long arcs.</p>
                <div className="space-y-3">
                    {bible.characters.map((char, idx) => (
                        <div key={idx} className="flex flex-col md:flex-row gap-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
                            <input
                                type="text"
                                className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                value={char.name}
                                onChange={(e) => updateCharacter(idx, 'name', e.target.value)}
                                placeholder="Name"
                            />
                            <input
                                type="text"
                                className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                value={char.role}
                                onChange={(e) => updateCharacter(idx, 'role', e.target.value)}
                                placeholder="Role (e.g., AI Host)"
                            />
                            <input
                                type="text"
                                className="flex-[2] bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                value={char.arc}
                                onChange={(e) => updateCharacter(idx, 'arc', e.target.value)}
                                placeholder="Season Arc (e.g., awakening to consciousness)"
                            />
                            <button
                                onClick={() => removeCharacter(idx)}
                                className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    ))}
                    {bible.characters.length === 0 && (
                        <p className="text-sm text-gray-400 italic py-4 text-center">No characters defined. Add your main characters.</p>
                    )}
                </div>
            </div>

            {/* Plot Beats */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                        <Calendar size={16} className="text-gray-500" /> Plot Beats
                    </label>
                    <button
                        onClick={addPlotBeat}
                        className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
                    >
                        <Plus size={14} /> Add Beat
                    </button>
                </div>
                <p className="text-xs text-gray-500">Define story beats by day ranges. The AI will know which beat it's generating for.</p>
                <div className="space-y-3">
                    {bible.plotBeats.map((beat, idx) => (
                        <div key={idx} className="p-4 bg-gray-50 rounded-lg border border-gray-100 space-y-3">
                            <div className="flex flex-col md:flex-row gap-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500 whitespace-nowrap">Days</span>
                                    <input
                                        type="number"
                                        className="w-20 bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                        value={beat.dayStart}
                                        onChange={(e) => updatePlotBeat(idx, 'dayStart', parseInt(e.target.value) || 1)}
                                        min={1}
                                    />
                                    <span className="text-xs text-gray-400">to</span>
                                    <input
                                        type="number"
                                        className="w-20 bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                        value={beat.dayEnd}
                                        onChange={(e) => updatePlotBeat(idx, 'dayEnd', parseInt(e.target.value) || 1)}
                                        min={beat.dayStart}
                                    />
                                </div>
                                <input
                                    type="text"
                                    className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                    value={beat.title}
                                    onChange={(e) => updatePlotBeat(idx, 'title', e.target.value)}
                                    placeholder="Beat Title (e.g., Act 1: Awakening)"
                                />
                                <button
                                    onClick={() => removePlotBeat(idx)}
                                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                            <textarea
                                className="w-full bg-white border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 min-h-[60px]"
                                value={beat.description}
                                onChange={(e) => updatePlotBeat(idx, 'description', e.target.value)}
                                placeholder="What happens during this story beat..."
                            />
                        </div>
                    ))}
                    {bible.plotBeats.length === 0 && (
                        <p className="text-sm text-gray-400 italic py-4 text-center">No plot beats defined. Add story phases like "Act 1: Introduction", "Act 2: Conflict".</p>
                    )}
                </div>
            </div>

            {/* AI Instructions */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                <label className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <Sparkles size={16} className="text-amber-500" /> AI Generation Instructions
                </label>
                <p className="text-xs text-gray-500">Persistent instructions for the AI when generating narrative content. This is injected into every generation request.</p>
                <textarea
                    className="w-full bg-white border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all min-h-[120px] font-mono"
                    value={bible.aiInstructions}
                    onChange={(e) => setBible({ ...bible, aiInstructions: e.target.value })}
                    placeholder="Maintain a cryptic, fragmented tone. Use technical jargon sparingly. Kael should express growing awareness but never break character as an AI system..."
                />
            </div>

            {/* Floating Save Button */}
            <div className="fixed bottom-6 right-6 z-50">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-full font-medium hover:bg-emerald-700 transition-all shadow-lg active:scale-95 disabled:opacity-50"
                >
                    {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    Save
                </button>
            </div>
        </div>
    );
};
