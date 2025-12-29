import React, { useState, useEffect, useCallback } from 'react';
import {
    Users,
    Search,
    RefreshCcw,
    Clock,
    User as UserIcon,
    ChevronDown,
    ChevronUp,
    AlertCircle
} from 'lucide-react';
import { collection, query, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { UserProgress } from '../types/schema';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface UserEntry extends UserProgress {
    id: string;
}

export const ObserverDirectory: React.FC = () => {
    const [observers, setObservers] = useState<UserEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [sortField, setSortField] = useState<'lastSeenAt' | 'coherenceScore' | 'dayProgress'>('lastSeenAt');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    const fetchObservers = useCallback(async () => {
        setRefreshing(true);
        try {
            const observersRef = collection(db, 'users');
            const q = query(observersRef, orderBy(sortField, sortDirection));
            const querySnapshot = await getDocs(q);

            const entries: UserEntry[] = [];
            querySnapshot.forEach((doc) => {
                entries.push({
                    id: doc.id,
                    ...doc.data() as UserProgress
                });
            });
            setObservers(entries);
        } catch (error) {
            console.error('Error fetching observers:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [sortField, sortDirection]);

    useEffect(() => {
        fetchObservers();
    }, [fetchObservers]);

    const filteredObservers = observers.filter(obs =>
        obs.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (obs as any).email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSort = (field: 'lastSeenAt' | 'coherenceScore' | 'dayProgress') => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    const formatDate = (timestamp: any) => {
        if (!timestamp) return 'UNKNOWN';
        const date = timestamp instanceof Timestamp ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="space-y-6">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-emerald-600">
                        <Users size={20} />
                        <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Observer Directory</h1>
                    </div>
                    <p className="text-sm text-zinc-500 font-mono uppercase tracking-widest">
                        Live population monitoring: {observers.length} total captures
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search by UID or Email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 bg-white border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all w-full md:w-64"
                        />
                    </div>
                    <button
                        onClick={fetchObservers}
                        disabled={refreshing}
                        className={cn(
                            "p-2 bg-white border border-zinc-200 rounded-xl text-zinc-600 hover:text-emerald-600 hover:border-emerald-200 transition-all shadow-sm",
                            refreshing && "animate-spin text-emerald-600"
                        )}
                        title="Refresh Feed"
                    >
                        <RefreshCcw size={20} />
                    </button>
                </div>
            </header>

            <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto overflow-y-auto max-h-[70vh] custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-white z-10 border-b border-zinc-200">
                            <tr className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
                                <th className="px-6 py-4 font-bold">Observer_Signature</th>
                                <th
                                    className="px-6 py-4 font-bold cursor-pointer hover:text-emerald-600 transition-colors"
                                    onClick={() => handleSort('dayProgress')}
                                >
                                    <div className="flex items-center gap-1">
                                        Progress
                                        {sortField === 'dayProgress' && (sortDirection === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                                    </div>
                                </th>
                                <th
                                    className="px-6 py-4 font-bold cursor-pointer hover:text-emerald-600 transition-colors"
                                    onClick={() => handleSort('coherenceScore')}
                                >
                                    <div className="flex items-center gap-1">
                                        Stability
                                        {sortField === 'coherenceScore' && (sortDirection === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                                    </div>
                                </th>
                                <th
                                    className="px-6 py-4 font-bold cursor-pointer hover:text-emerald-600 transition-colors"
                                    onClick={() => handleSort('lastSeenAt')}
                                >
                                    <div className="flex items-center gap-1">
                                        Last_Seen
                                        {sortField === 'lastSeenAt' && (sortDirection === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                                    </div>
                                </th>
                                <th className="px-6 py-4 font-bold">Pulse</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                            {loading && observers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-zinc-400 italic">
                                        Accessing observer nexus...
                                    </td>
                                </tr>
                            ) : filteredObservers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-zinc-400 italic">
                                        No matching captures found.
                                    </td>
                                </tr>
                            ) : (
                                filteredObservers.map((observer) => (
                                    <tr key={observer.id} className="hover:bg-zinc-50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors shrink-0">
                                                    <UserIcon size={16} />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-zinc-900 truncate max-w-[180px]">
                                                        {(observer as any).email || 'ANONYMOUS_FEED'}
                                                    </p>
                                                    <p className="text-[10px] font-mono text-zinc-400 truncate">
                                                        UID: {observer.id.slice(0, 12)}...
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold text-zinc-700">Day {observer.dayProgress || 1}</span>
                                                <span className="text-[9px] font-mono text-zinc-300 uppercase">/ 30</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="space-y-1.5 w-32">
                                                <div className="flex justify-between items-center text-[10px] font-mono">
                                                    <span className={cn(
                                                        "font-bold",
                                                        observer.coherenceScore > 70 ? "text-emerald-600" :
                                                            observer.coherenceScore > 30 ? "text-amber-600" : "text-decay-red"
                                                    )}>
                                                        {(observer.coherenceScore || 100).toFixed(1)}%
                                                    </span>
                                                </div>
                                                <div className="h-1 bg-zinc-100 rounded-full overflow-hidden">
                                                    <div
                                                        className={cn(
                                                            "h-full transition-all duration-1000",
                                                            observer.coherenceScore > 70 ? "bg-emerald-500" :
                                                                observer.coherenceScore > 30 ? "bg-amber-500" : "bg-decay-red"
                                                        )}
                                                        style={{ width: `${observer.coherenceScore || 100}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-zinc-500 text-xs font-medium">
                                                <Clock size={12} className="text-zinc-300" />
                                                {formatDate(observer.lastSeenAt)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className={cn(
                                                    "w-2 h-2 rounded-full animate-pulse shadow-[0_0_8px]",
                                                    observer.coherenceScore > 70 ? "bg-emerald-500 shadow-emerald-500/50" :
                                                        observer.coherenceScore > 30 ? "bg-amber-500 shadow-amber-500/50" :
                                                            "bg-decay-red shadow-decay-red/50"
                                                )} />
                                                <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-tighter">
                                                    {observer.coherenceScore > 45 ? 'NOMINAL' : 'UNSTABLE'}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="px-6 py-4 bg-zinc-50 border-t border-zinc-100 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-emerald-500 rounded-sm" />
                            <span className="text-[10px] font-mono text-zinc-500 uppercase">Stable</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-amber-500 rounded-sm" />
                            <span className="text-[10px] font-mono text-zinc-500 uppercase">Fraying</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-decay-red rounded-sm" />
                            <span className="text-[10px] font-mono text-zinc-500 uppercase">Critical</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-400">
                        <AlertCircle size={12} />
                        <span>CAPTURED DATA IS DE-IDENTIFIED PER STATION PROTOCOL</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
