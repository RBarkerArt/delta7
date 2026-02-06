import React, { useState, useEffect } from 'react';
import { db, functions, storage } from '../lib/firebase';
import { collection, query, orderBy, getDocs, doc, setDoc, deleteDoc, addDoc, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
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
    Loader2,
    LayoutGrid,
    List,
    ChevronsLeft,
    ChevronsRight,
    Hash
} from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAuth } from '../hooks/useAuth';

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
    const { user } = useAuth();
    const [days, setDays] = useState<DayLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    // Editor State
    const [editingDay, setEditingDay] = useState<DayLog | null>(null);
    const [isCreatingNew, setIsCreatingNew] = useState(false);
    const [activeLogTab, setActiveLogTab] = useState<CoherenceState>('FEED_STABLE');

    // View & Pagination State
    const [viewMode, setViewMode] = useState<'grid' | 'list'>(
        typeof window !== 'undefined' && window.innerWidth < 768 ? 'list' : 'grid'
    );
    const [currentPage, setCurrentPage] = useState(1);
    const [jumpToDay, setJumpToDay] = useState('');
    const ITEMS_PER_PAGE = 50;

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

    // Image Compression Helper (Client-Side WebP Conversion)
    const compressImage = (file: File): Promise<Blob> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.src = URL.createObjectURL(file);
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Max dimension constraint
                const MAX_DIM = 1920;
                if (width > MAX_DIM || height > MAX_DIM) {
                    if (width > height) {
                        height = (height / width) * MAX_DIM;
                        width = MAX_DIM;
                    } else {
                        width = (width / height) * MAX_DIM;
                        height = MAX_DIM;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Canvas context failed'));
                    return;
                }

                ctx.drawImage(img, 0, 0, width, height);

                // Convert to WebP at 80% quality
                canvas.toBlob((blob) => {
                    if (blob) resolve(blob);
                    else reject(new Error('Compression failed'));
                }, 'image/webp', 0.8);
            };
            img.onerror = error => reject(error);
        });
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !e.target.files[0] || !editingDay) return;
        const file = e.target.files[0];
        setIsUploading(true);

        try {
            // 1. Compress/Convert
            const compressedBlob = await compressImage(file);
            const filename = `${Date.now()}_${file.name.split('.')[0]}.webp`;

            // 2. Upload
            const imageRef = ref(storage, `evidence/season1/day_${editingDay.day}/${filename}`);
            await uploadBytes(imageRef, compressedBlob);
            const url = await getDownloadURL(imageRef);

            // 3. Add to UI
            const newImage = {
                id: `img_${Date.now()}`,
                url: url,
                caption: 'Evidence',
                description: '',
                placeholder: false // Real evidence
            };

            setEditingDay({
                ...editingDay,
                images: [...(editingDay.images || []), newImage]
            });

        } catch (error) {
            console.error('Upload failed:', error);
            alert('Image upload failed.');
        } finally {
            setIsUploading(false);
            // Reset input
            e.target.value = '';
        }
    };

    const handleDelete = async () => {
        if (!editingDay || !window.confirm(`Are you sure you want to delete Day ${editingDay.day}?`)) return;
        setIsSaving(true);
        try {
            const dayRef = doc(db, 'season1_days', `day_${editingDay.day}`);
            await deleteDoc(dayRef);

            await addDoc(collection(db, 'admin_events'), {
                action: 'day_delete',
                day: editingDay.day,
                actorEmail: user?.email || null,
                createdAt: Timestamp.now()
            });

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

            await addDoc(collection(db, 'admin_events'), {
                action: isCreatingNew ? 'day_create' : 'day_update',
                day: editingDay.day,
                actorEmail: user?.email || null,
                createdAt: Timestamp.now()
            });

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

    // Pagination
    const totalPages = Math.ceil(filteredDays.length / ITEMS_PER_PAGE);
    const paginatedDays = filteredDays.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    const handleJumpToDay = () => {
        const dayNum = parseInt(jumpToDay, 10);
        if (isNaN(dayNum)) return;

        const dayIndex = filteredDays.findIndex(d => d.day === dayNum);
        if (dayIndex >= 0) {
            const targetPage = Math.floor(dayIndex / ITEMS_PER_PAGE) + 1;
            setCurrentPage(targetPage);
            // Also open the day editor
            const foundDay = filteredDays[dayIndex];
            if (foundDay) {
                setEditingDay(foundDay);
                setIsCreatingNew(false);
            }
        } else {
            alert(`Day ${dayNum} not found.`);
        }
        setJumpToDay('');
    };

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
            // Call Cloud Function with day number for auto-context
            const generateFn = httpsCallable(functions, 'generateNarrativeContent');
            const result = await generateFn({
                prompt: aiPrompt,
                context: aiContext,
                dayNumber: editingDay?.day || days.length + 1
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

        // Update the current editing state with all generated content
        setEditingDay(prev => {
            if (!prev) return null;
            return {
                ...prev,
                narrativeSummary: generatedContent.narrativeSummary,
                prologueSentences: generatedContent.prologueSentences || [],
                vm_logs: generatedContent.vm_logs,
                fragments: generatedContent.fragments,
                variables: generatedContent.variables || prev.variables
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
            {/* Sticky Header */}
            <div className="sticky top-0 z-20 bg-gray-50/95 backdrop-blur-sm -mx-6 px-6 -mt-6 pt-6 pb-4 space-y-4 border-b border-gray-200/50">
                {/* Title Row */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Days</h1>
                        <p className="text-sm text-gray-500 mt-1">{filteredDays.length} days • Page {currentPage} of {totalPages || 1}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* View Toggle */}
                        <div className="flex bg-gray-100 rounded-lg p-1">
                            <button
                                onClick={() => setViewMode('list')}
                                className={cn(
                                    "p-2 rounded-md transition-all",
                                    viewMode === 'list' ? "bg-white shadow-sm text-emerald-600" : "text-gray-400 hover:text-gray-600"
                                )}
                                title="List view"
                            >
                                <List size={18} />
                            </button>
                            <button
                                onClick={() => setViewMode('grid')}
                                className={cn(
                                    "p-2 rounded-md transition-all",
                                    viewMode === 'grid' ? "bg-white shadow-sm text-emerald-600" : "text-gray-400 hover:text-gray-600"
                                )}
                                title="Grid view"
                            >
                                <LayoutGrid size={18} />
                            </button>
                        </div>
                        <button
                            onClick={handleCreateNew}
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-all shadow-sm active:scale-95"
                        >
                            <Plus size={18} />
                            <span className="hidden sm:inline">New Day</span>
                        </button>
                    </div>
                </div>

                {/* Search & Jump Row */}
                <div className="flex gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search days..."
                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                type="number"
                                placeholder="Day"
                                className="w-20 pl-8 pr-2 py-2.5 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
                                value={jumpToDay}
                                onChange={(e) => setJumpToDay(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleJumpToDay()}
                            />
                        </div>
                        <button
                            onClick={handleJumpToDay}
                            className="px-3 py-2.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors text-sm whitespace-nowrap"
                        >
                            Go
                        </button>
                    </div>
                </div>
            </div>

            {/* List View */}
            {viewMode === 'list' && (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <div className="divide-y divide-gray-100">
                        {paginatedDays.map((day) => (
                            <div
                                key={day.day}
                                onClick={() => {
                                    setIsCreatingNew(false);
                                    setEditingDay(day);
                                }}
                                className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors group"
                            >
                                {/* Day Number */}
                                <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-lg font-bold flex items-center justify-center shrink-0">
                                    {day.day}
                                </div>

                                {/* Title & Summary */}
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-gray-900 truncate">
                                        {day.vm_logs?.['FEED_STABLE']?.title || `Day ${day.day}`}
                                    </p>
                                    <p className="text-sm text-gray-500 truncate">
                                        {day.narrativeSummary || 'No summary'}
                                    </p>
                                </div>

                                {/* Indicators */}
                                <div className="flex items-center gap-2 shrink-0">
                                    {/* Prologue */}
                                    <span className={cn(
                                        "px-2 py-1 rounded text-xs font-medium",
                                        day.prologueSentences?.length ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-400"
                                    )}>
                                        P{day.prologueSentences?.length || 0}
                                    </span>
                                    {/* Logs */}
                                    <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700 hidden sm:block">
                                        {Object.keys(day.vm_logs || {}).length}L
                                    </span>
                                    {/* Fragments */}
                                    <span className="px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-700 hidden sm:block">
                                        {day.fragments?.length || 0}F
                                    </span>
                                    {/* Images */}
                                    <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700 hidden sm:block">
                                        {day.images?.length || 0}I
                                    </span>
                                    <ChevronRight size={18} className="text-gray-300 group-hover:text-emerald-500 transition-colors" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Grid View */}
            {viewMode === 'grid' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {paginatedDays.map((day) => (
                        <div
                            key={day.day}
                            onClick={() => {
                                setIsCreatingNew(false);
                                setEditingDay(day);
                            }}
                            className="group bg-white border border-gray-200 rounded-xl p-5 hover:shadow-lg hover:border-emerald-200 transition-all duration-300 cursor-pointer relative overflow-hidden"
                        >
                            <div className="absolute top-4 right-4 text-gray-300 group-hover:text-emerald-500 transition-colors">
                                <ChevronRight size={20} />
                            </div>

                            <div className="flex items-center gap-3 mb-3">
                                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg font-bold text-lg w-11 h-11 flex items-center justify-center">
                                    {day.day}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Day Log</p>
                                    <p className="text-sm font-bold text-gray-900 truncate">{day.vm_logs?.['FEED_STABLE']?.title || 'Untitled'}</p>
                                </div>
                            </div>

                            <p className="text-gray-600 text-sm leading-relaxed line-clamp-2 mb-4">
                                {day.narrativeSummary || 'No summary recorded.'}
                            </p>

                            <div className="grid grid-cols-4 gap-1.5 pt-3 border-t border-gray-100">
                                <div className={cn(
                                    "flex flex-col items-center py-1.5 rounded text-xs",
                                    day.prologueSentences?.length ? "bg-purple-50 text-purple-600" : "bg-gray-50 text-gray-400"
                                )}>
                                    <span className="font-semibold">{day.prologueSentences?.length || 0}</span>
                                    <span className="text-[10px]">Prol</span>
                                </div>
                                <div className="flex flex-col items-center py-1.5 rounded bg-blue-50 text-blue-600 text-xs">
                                    <span className="font-semibold">{Object.keys(day.vm_logs || {}).length}</span>
                                    <span className="text-[10px]">Logs</span>
                                </div>
                                <div className="flex flex-col items-center py-1.5 rounded bg-amber-50 text-amber-600 text-xs">
                                    <span className="font-semibold">{day.fragments?.length || 0}</span>
                                    <span className="text-[10px]">Frag</span>
                                </div>
                                <div className="flex flex-col items-center py-1.5 rounded bg-green-50 text-green-600 text-xs">
                                    <span className="font-semibold">{day.images?.length || 0}</span>
                                    <span className="text-[10px]">Imgs</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                    <button
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className="p-2 rounded-lg bg-white border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                    >
                        <ChevronsLeft size={18} />
                    </button>
                    <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-4 py-2 rounded-lg bg-white border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors text-sm"
                    >
                        Previous
                    </button>
                    <span className="px-4 py-2 text-sm text-gray-600">
                        Page {currentPage} of {totalPages}
                    </span>
                    <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-4 py-2 rounded-lg bg-white border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors text-sm"
                    >
                        Next
                    </button>
                    <button
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                        className="p-2 rounded-lg bg-white border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                    >
                        <ChevronsRight size={18} />
                    </button>
                </div>
            )}

            {/* Editor Sidebar/Overlay */}
            {editingDay && (
                <div className="fixed inset-0 z-[100] flex">
                    <div className="absolute inset-0 bg-black/20 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => !isSaving && setEditingDay(null)} />

                    <div className="relative ml-auto h-full w-full max-w-4xl bg-white shadow-2xl animate-in slide-in-from-right duration-300 overflow-hidden flex flex-col">
                        {/* Editor Header */}
                        <div className="p-4 sm:p-6 border-b border-gray-100 flex items-center justify-between shrink-0 bg-white">
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
                                    className="flex items-center gap-2 px-3 sm:px-5 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-all disabled:opacity-50 active:scale-95 shadow-sm"
                                >
                                    {isSaving ? (
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <Save size={18} />
                                    )}
                                    <span className="hidden sm:inline">{isSaving ? 'Saving...' : 'Save Changes'}</span>
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
                                <span className="hidden sm:inline">Delete Day</span>
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

                            {/* Prologue Sentences */}
                            <div className="space-y-3 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                                        <FileText size={16} className="text-gray-500" /> Prologue Sentences
                                    </label>
                                    <button
                                        onClick={() => setEditingDay({
                                            ...editingDay,
                                            prologueSentences: [...(editingDay.prologueSentences || []), '']
                                        })}
                                        className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
                                    >
                                        <Plus size={14} /> Add Sentence
                                    </button>
                                </div>
                                <p className="text-xs text-gray-500">These sentences are revealed one-by-one when users enter the day.</p>
                                <div className="space-y-2">
                                    {(editingDay.prologueSentences || []).map((sentence, idx) => (
                                        <div key={idx} className="flex gap-2 items-start">
                                            <span className="text-xs text-gray-400 mt-2.5 w-6">{idx + 1}.</span>
                                            <textarea
                                                className="flex-1 bg-white border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all min-h-[60px]"
                                                value={sentence}
                                                onChange={(e) => {
                                                    const updated = [...(editingDay.prologueSentences || [])];
                                                    updated[idx] = e.target.value;
                                                    setEditingDay({ ...editingDay, prologueSentences: updated });
                                                }}
                                                placeholder={`Prologue sentence ${idx + 1}...`}
                                            />
                                            <button
                                                onClick={() => {
                                                    const updated = (editingDay.prologueSentences || []).filter((_, i) => i !== idx);
                                                    setEditingDay({ ...editingDay, prologueSentences: updated });
                                                }}
                                                className="p-1.5 text-gray-400 hover:text-red-500 transition-colors mt-1"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}
                                    {(!editingDay.prologueSentences || editingDay.prologueSentences.length === 0) && (
                                        <p className="text-sm text-gray-400 italic py-4 text-center">No prologue sentences yet. Click "Add Sentence" or generate with AI.</p>
                                    )}
                                </div>
                            </div>

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
                                    <div className="flex gap-2">
                                        <input
                                            type="file"
                                            id="image-upload"
                                            className="hidden"
                                            accept="image/*"
                                            onChange={handleImageUpload}
                                            disabled={isUploading}
                                        />
                                        <label
                                            htmlFor="image-upload"
                                            className={cn(
                                                "text-xs px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5",
                                                isUploading
                                                    ? "bg-gray-100 text-gray-400 cursor-wait"
                                                    : "bg-purple-100 text-purple-700 hover:bg-purple-200"
                                            )}
                                        >
                                            {isUploading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                            {isUploading ? 'Comp. & Uploading...' : 'Upload Evidence'}
                                        </label>
                                        <button
                                            onClick={() => {
                                                const imgs = [...(editingDay.images || [])];
                                                imgs.push({ id: `img_${Date.now()}`, url: '', caption: '', placeholder: true });
                                                setEditingDay({ ...editingDay, images: imgs });
                                            }}
                                            className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg font-bold hover:bg-gray-200 transition-colors"
                                        >
                                            + Placeholder
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {(editingDay.images || []).map((img, idx) => (
                                        <div key={idx} className={cn(
                                            "p-4 rounded-lg border space-y-3 relative group",
                                            !img.placeholder ? "bg-purple-50 border-purple-100" : "bg-gray-50 border-gray-100"
                                        )}>
                                            {/* Preview/Thumbnail */}
                                            {!img.placeholder && img.url && (
                                                <div className="w-full h-32 bg-gray-900 rounded-lg mb-3 overflow-hidden relative">
                                                    <img src={img.url} alt="Evidence" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                                    <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/50 text-white text-[10px] font-mono rounded backdrop-blur-sm">
                                                        WEBP
                                                    </div>
                                                </div>
                                            )}

                                            <div className="flex items-center justify-between">
                                                <span className={cn(
                                                    "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded",
                                                    !img.placeholder ? "bg-purple-200 text-purple-800" : "bg-gray-200 text-gray-500"
                                                )}>
                                                    {!img.placeholder ? '✨ Evidence' : 'Placeholder'}
                                                </span>
                                                <button
                                                    onClick={() => {
                                                        const imgs = editingDay.images!.filter((_, i) => i !== idx);
                                                        setEditingDay({ ...editingDay, images: imgs });
                                                    }}
                                                    className="text-red-400 hover:text-red-500 p-1 bg-white rounded-md shadow-sm opacity-50 group-hover:opacity-100 transition-all"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>

                                            <div className="space-y-2">
                                                <input
                                                    type="text"
                                                    className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs font-mono text-gray-500"
                                                    value={img.id}
                                                    onChange={(e) => {
                                                        const imgs = [...editingDay.images!];
                                                        imgs[idx] = { ...img, id: e.target.value };
                                                        setEditingDay({ ...editingDay, images: imgs });
                                                    }}
                                                    placeholder="Asset ID..."
                                                />
                                                <textarea
                                                    className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs resize-y min-h-[60px]"
                                                    value={img.caption}
                                                    onChange={(e) => {
                                                        const imgs = [...editingDay.images!];
                                                        imgs[idx] = { ...img, caption: e.target.value };
                                                        setEditingDay({ ...editingDay, images: imgs });
                                                    }}
                                                    placeholder="Caption / Alt Text..."
                                                />
                                            </div>

                                            <label className="flex items-center gap-2 cursor-pointer pt-2 border-t border-gray-200/50">
                                                <input
                                                    type="checkbox"
                                                    className="rounded text-purple-600 focus:ring-purple-500 border-gray-300"
                                                    checked={img.placeholder}
                                                    onChange={(e) => {
                                                        const imgs = [...editingDay.images!];
                                                        imgs[idx] = { ...img, placeholder: e.target.checked };
                                                        setEditingDay({ ...editingDay, images: imgs });
                                                    }}
                                                />
                                                <span className="text-xs text-gray-500">Is Placeholder?</span>
                                            </label>
                                        </div>
                                    ))}
                                </div>

                                {(editingDay.images || []).length === 0 && (
                                    <div className="col-span-full py-8 text-center text-gray-400 border-2 border-dashed border-gray-100 rounded-lg">
                                        <div className="flex flex-col items-center gap-2">
                                            <ImageIcon size={24} className="opacity-20" />
                                            <span className="text-xs">No images added. Upload evidence or add placeholders.</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
