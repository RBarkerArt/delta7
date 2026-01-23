import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import type { UserProgress } from '../types/schema';
import { Search, Loader2, User as UserIcon, Calendar, Activity, ShieldCheck, ShieldAlert } from 'lucide-react';

interface ObserverWithId extends UserProgress {
    id: string;
}

export const ObserverDirectory: React.FC = () => {
    const [observers, setObservers] = useState<ObserverWithId[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchObservers = async () => {
            try {
                const obsRef = collection(db, 'observers');
                const q = query(obsRef, orderBy('lastSeenAt', 'desc'));
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

        fetchObservers();
    }, []);

    const filteredObservers = observers.filter(obs =>
        obs.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        obs.visitorId?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const formatDate = (ts: Timestamp | undefined) => {
        if (!ts) return 'Unknown';
        return ts.toDate().toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <Loader2 className="animate-spin text-emerald-600" size={32} />
                <p className="text-zinc-500 font-mono text-xs uppercase tracking-widest">Accessing_Observer_Vault...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header Secion */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Observer Directory</h1>
                    <p className="text-zinc-500 mt-1">Registry of all witness identities and temporal progress.</p>
                </div>

                <div className="relative w-full md:w-96">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search by ID or Trace..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all"
                    />
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm flex items-center gap-3">
                    <ShieldAlert size={18} />
                    {error}
                </div>
            )}

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredObservers.map((obs) => (
                    <div
                        key={obs.id}
                        className="bg-zinc-50 border border-zinc-200 rounded-3xl p-6 hover:shadow-xl hover:shadow-emerald-900/5 transition-all duration-300 group"
                    >
                        <div className="flex items-start justify-between mb-6">
                            <div className="w-12 h-12 bg-white border border-zinc-100 rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-500">
                                <UserIcon className="text-emerald-600" size={24} />
                            </div>
                            <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-colors ${obs.isAnchored
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                    : 'bg-zinc-100 text-zinc-500 border-zinc-200'
                                }`}>
                                {obs.isAnchored ? 'Stable_Anchor' : 'Volatile_Trace'}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <p className="text-[10px] text-zinc-400 font-mono uppercase tracking-widest mb-1">Observation_Subject</p>
                                <p className="font-mono text-sm font-bold truncate">{obs.id}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-1.5 text-zinc-400">
                                        <Calendar size={12} />
                                        <span className="text-[10px] font-mono uppercase">Last_Seen</span>
                                    </div>
                                    <p className="text-xs font-medium">{formatDate(obs.lastSeenAt)}</p>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-1.5 text-zinc-400">
                                        <Activity size={12} />
                                        <span className="text-[10px] font-mono uppercase">Coherence</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-full h-1 bg-zinc-200 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-emerald-500"
                                                style={{ width: `${obs.coherenceScore}%` }}
                                            />
                                        </div>
                                        <span className="text-[10px] font-bold text-emerald-600">{Math.round(obs.coherenceScore)}%</span>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-zinc-100 flex items-center justify-between">
                                <span className="text-[10px] text-zinc-400 font-mono uppercase tracking-widest">Progress</span>
                                <div className="flex items-center gap-2">
                                    <ShieldCheck size={14} className={obs.dayProgress >= 50 ? 'text-emerald-500' : 'text-zinc-300'} />
                                    <span className="text-sm font-bold">DAY_{obs.dayProgress}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {filteredObservers.length === 0 && !loading && (
                <div className="text-center py-20 bg-zinc-50 rounded-[40px] border-2 border-dashed border-zinc-200">
                    <UserIcon className="mx-auto text-zinc-300 mb-4" size={48} />
                    <h3 className="text-zinc-900 font-bold">No Observers Detected</h3>
                    <p className="text-zinc-500 text-sm mt-1">Try adjusting your temporal filters or registry ident.</p>
                </div>
            )}
        </div>
    );
};
