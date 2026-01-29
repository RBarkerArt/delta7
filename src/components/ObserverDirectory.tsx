import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, getDocs, Timestamp, limit, doc, updateDoc } from 'firebase/firestore';
import type { UserProgress } from '../types/schema';
import { Search, Loader2, User as UserIcon, CheckCircle, Edit2, Save, X } from 'lucide-react';

interface ObserverWithId extends Omit<UserProgress, 'email'> {
    id: string;
    email?: string | null;
}

export const ObserverDirectory: React.FC = () => {
    const [observers, setObservers] = useState<ObserverWithId[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [error, setError] = useState<string | null>(null);

    // Editing state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<{
        dayProgress: number;
        coherenceScore: number;
    }>({ dayProgress: 1, coherenceScore: 100 });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        fetchObservers();
    }, []);

    const fetchObservers = async () => {
        setLoading(true);
        setError(null);
        try {
            const obsRef = collection(db, 'observers');
            const q = query(obsRef, orderBy('lastSeenAt', 'desc'), limit(100));
            const querySnapshot = await getDocs(q);

            const data = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as ObserverWithId[];

            setObservers(data);
        } catch (err: unknown) {
            console.error('Error fetching observers:', err);
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const handleEditStart = (obs: ObserverWithId) => {
        setEditingId(obs.id);
        setEditForm({
            dayProgress: obs.dayProgress,
            coherenceScore: Math.round(obs.coherenceScore)
        });
    };

    const handleSave = async () => {
        if (!editingId) return;
        setIsSaving(true);
        try {
            const obsRef = doc(db, 'observers', editingId);
            await updateDoc(obsRef, {
                dayProgress: editForm.dayProgress,
                coherenceScore: editForm.coherenceScore,
                isManualDayProgress: true  // Tells CoherenceContext to respect this value
            });

            // Update local state
            setObservers(prev => prev.map(o =>
                o.id === editingId
                    ? { ...o, dayProgress: editForm.dayProgress, coherenceScore: editForm.coherenceScore }
                    : o
            ));
            setEditingId(null);
        } catch (err) {
            console.error('Failed to update observer:', err);
            alert('Failed to save changes. Check console.');
        } finally {
            setIsSaving(false);
        }
    };

    const filteredObservers = observers.filter(obs =>
        obs.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        obs.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const formatDate = (ts: Timestamp | undefined) => {
        if (!ts) return '-';
        return ts.toDate().toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-400 text-sm flex items-center gap-2">
                    <Loader2 className="animate-spin" size={16} /> Loading Directory...
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">User Directory</h1>
                    <p className="text-sm text-gray-500">Manage registered users and their progress states.</p>
                </div>
                <div className="relative w-full md:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                        type="text"
                        placeholder="Search email or ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm">
                    {error}
                </div>
            )}

            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm min-w-[800px]">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 font-semibold text-gray-900">User / Identity</th>
                                <th className="px-6 py-4 font-semibold text-gray-900">Code</th>
                                <th className="px-6 py-4 font-semibold text-gray-900">Status</th>
                                <th className="px-6 py-4 font-semibold text-gray-900">Day Progress</th>
                                <th className="px-6 py-4 font-semibold text-gray-900">Coherence</th>
                                <th className="px-6 py-4 font-semibold text-gray-900">Last Seen</th>
                                <th className="px-6 py-4 font-semibold text-gray-900 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredObservers.map((obs) => (
                                <tr key={obs.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                                                <UserIcon size={14} />
                                            </div>
                                            <div>
                                                <div className="font-medium text-gray-900">
                                                    {obs.email || <span className="text-gray-400 italic">Anonymous</span>}
                                                </div>
                                                {/* ID removed to prevent duplication with Code column */}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="font-mono text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded border border-gray-200">
                                            {obs.accessCode || '-'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            {obs.isAnchored ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">
                                                    <CheckCircle size={12} /> Anchored
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
                                                    Ghost
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {editingId === obs.id ? (
                                            <input
                                                type="number"
                                                className="w-16 border rounded px-2 py-1 text-sm"
                                                value={editForm.dayProgress}
                                                onChange={(e) => setEditForm({ ...editForm, dayProgress: parseInt(e.target.value) || 1 })}
                                            />
                                        ) : (
                                            <span className="font-medium text-gray-900">Day {obs.dayProgress}</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {editingId === obs.id ? (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="range"
                                                    min="0" max="100"
                                                    value={editForm.coherenceScore}
                                                    onChange={(e) => setEditForm({ ...editForm, coherenceScore: parseInt(e.target.value) })}
                                                    className="w-24 accent-emerald-600"
                                                />
                                                <span className="text-xs w-8">{editForm.coherenceScore}%</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${obs.coherenceScore > 80 ? 'bg-emerald-500' :
                                                            obs.coherenceScore > 40 ? 'bg-amber-500' : 'bg-red-500'
                                                            }`}
                                                        style={{ width: `${obs.coherenceScore}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs text-gray-600">{Math.round(obs.coherenceScore)}%</span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-gray-500 text-xs">
                                        {formatDate(obs.lastSeenAt)}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {editingId === obs.id ? (
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={handleSave}
                                                    disabled={isSaving}
                                                    className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded"
                                                    title="Save"
                                                >
                                                    <Save size={16} />
                                                </button>
                                                <button
                                                    onClick={() => setEditingId(null)}
                                                    className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
                                                    title="Cancel"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => handleEditStart(obs)}
                                                className="text-gray-400 hover:text-emerald-600 transition-colors"
                                                title="Edit User"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {filteredObservers.length === 0 && !loading && (
                    <div className="p-12 text-center">
                        <UserIcon className="mx-auto text-gray-300 mb-3" size={48} />
                        <h3 className="text-gray-900 font-medium">No users found</h3>
                        <p className="text-gray-500 text-sm mt-1">Try adjusting your search.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
