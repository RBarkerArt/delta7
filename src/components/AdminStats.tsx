import React, { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import {
    collection,
    query,
    where,
    getDocs,
    Timestamp,
    getCountFromServer
} from 'firebase/firestore';
import { Activity, Users, Calendar, Image, FileText, AlertTriangle, Sparkles } from 'lucide-react';
import type { DayLog } from '../types/schema';

interface ObserverStats {
    total: number;
    anchored: number;
    active24h: number;
    stable: number;
    fraying: number;
    critical: number;
}

interface DayStats {
    totalDays: number;
    missingPrologue: number;
    missingLogs: number;
    missingFragments: number;
    missingImages: number;
    avgLogs: number;
    avgFragments: number;
}

export const AdminStats: React.FC = () => {
    const [observerStats, setObserverStats] = useState<ObserverStats>({
        total: 0,
        anchored: 0,
        active24h: 0,
        stable: 0,
        fraying: 0,
        critical: 0
    });
    const [dayStats, setDayStats] = useState<DayStats>({
        totalDays: 0,
        missingPrologue: 0,
        missingLogs: 0,
        missingFragments: 0,
        missingImages: 0,
        avgLogs: 0,
        avgFragments: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            setLoading(true);
            try {
                const obsRef = collection(db, 'observers');
                const oneDayAgo = Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1000));

                const [
                    totalSnap,
                    anchoredSnap,
                    activeSnap,
                    stableSnap,
                    frayingSnap,
                    criticalSnap
                ] = await Promise.all([
                    getCountFromServer(obsRef),
                    getCountFromServer(query(obsRef, where('isAnchored', '==', true))),
                    getCountFromServer(query(obsRef, where('lastSeenAt', '>', oneDayAgo))),
                    getCountFromServer(query(obsRef, where('coherenceScore', '>=', 80))),
                    getCountFromServer(query(obsRef, where('coherenceScore', '>=', 20), where('coherenceScore', '<', 80))),
                    getCountFromServer(query(obsRef, where('coherenceScore', '<', 20)))
                ]);

                setObserverStats({
                    total: totalSnap.data().count,
                    anchored: anchoredSnap.data().count,
                    active24h: activeSnap.data().count,
                    stable: stableSnap.data().count,
                    fraying: frayingSnap.data().count,
                    critical: criticalSnap.data().count
                });

                const daysSnap = await getDocs(collection(db, 'season1_days'));
                const days = daysSnap.docs.map(doc => doc.data() as DayLog);

                let missingPrologue = 0;
                let missingLogs = 0;
                let missingFragments = 0;
                let missingImages = 0;
                let totalLogs = 0;
                let totalFragments = 0;

                days.forEach((day) => {
                    if (!day.prologueSentences || day.prologueSentences.length === 0) missingPrologue++;
                    if (!day.vm_logs || Object.keys(day.vm_logs).length === 0) missingLogs++;
                    if (!day.fragments || day.fragments.length === 0) missingFragments++;
                    if (!day.images || day.images.length === 0) missingImages++;

                    totalLogs += Object.keys(day.vm_logs || {}).length;
                    totalFragments += day.fragments?.length || 0;
                });

                const totalDays = days.length;

                setDayStats({
                    totalDays,
                    missingPrologue,
                    missingLogs,
                    missingFragments,
                    missingImages,
                    avgLogs: totalDays > 0 ? Math.round(totalLogs / totalDays) : 0,
                    avgFragments: totalDays > 0 ? Math.round(totalFragments / totalDays) : 0
                });
            } catch (error) {
                console.error('Error fetching admin stats:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    return (
        <div className="space-y-8">
            <header className="space-y-2">
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <Activity className="text-gray-400" /> System Stats
                </h1>
                <p className="text-sm text-gray-500">Observer health, story coverage, and content risk signals.</p>
            </header>

            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                {[
                    { label: 'Total Observers', value: observerStats.total, icon: Users },
                    { label: 'Anchored', value: observerStats.anchored, icon: Users },
                    { label: 'Active (24h)', value: observerStats.active24h, icon: Activity },
                    { label: 'Stable', value: observerStats.stable, icon: Sparkles },
                    { label: 'Fraying', value: observerStats.fraying, icon: AlertTriangle },
                    { label: 'Critical', value: observerStats.critical, icon: AlertTriangle }
                ].map((stat) => (
                    <div key={stat.label} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-gray-50 text-gray-500">
                                <stat.icon size={18} />
                            </div>
                            <div>
                                <div className="text-lg font-bold text-gray-900">{loading ? '-' : stat.value}</div>
                                <div className="text-xs text-gray-500 font-medium">{stat.label}</div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
                    <div className="flex items-center gap-2 text-gray-900 font-semibold">
                        <Calendar size={18} className="text-gray-400" /> Day Coverage
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="bg-gray-50 rounded-lg p-3">
                            <div className="text-xs text-gray-500">Total Days</div>
                            <div className="text-lg font-bold text-gray-900">{loading ? '-' : dayStats.totalDays}</div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3">
                            <div className="text-xs text-gray-500">Missing Prologue</div>
                            <div className="text-lg font-bold text-gray-900">{loading ? '-' : dayStats.missingPrologue}</div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3">
                            <div className="text-xs text-gray-500">Missing Logs</div>
                            <div className="text-lg font-bold text-gray-900">{loading ? '-' : dayStats.missingLogs}</div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3">
                            <div className="text-xs text-gray-500">Missing Fragments</div>
                            <div className="text-lg font-bold text-gray-900">{loading ? '-' : dayStats.missingFragments}</div>
                        </div>
                    </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
                    <div className="flex items-center gap-2 text-gray-900 font-semibold">
                        <FileText size={18} className="text-gray-400" /> Content Density
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="bg-gray-50 rounded-lg p-3">
                            <div className="text-xs text-gray-500">Avg Logs / Day</div>
                            <div className="text-lg font-bold text-gray-900">{loading ? '-' : dayStats.avgLogs}</div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3">
                            <div className="text-xs text-gray-500">Avg Fragments / Day</div>
                            <div className="text-lg font-bold text-gray-900">{loading ? '-' : dayStats.avgFragments}</div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3">
                            <div className="text-xs text-gray-500">Missing Images</div>
                            <div className="text-lg font-bold text-gray-900">{loading ? '-' : dayStats.missingImages}</div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3">
                            <div className="text-xs text-gray-500">Image Coverage</div>
                            <div className="text-lg font-bold text-gray-900">
                                {loading || dayStats.totalDays === 0 ? '-' : `${Math.max(0, dayStats.totalDays - dayStats.missingImages)}/${dayStats.totalDays}`}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-gray-900 font-semibold">
                    <Image size={18} className="text-gray-400" /> Risk Signals
                </div>
                <p className="text-sm text-gray-500">
                    Use missing content and low-coherence counts to prioritize narrative fixes and observer rescue flows.
                </p>
                <ul className="text-sm text-gray-600 list-disc pl-5">
                    <li>Focus on days with missing prologue or logs to prevent continuity breaks.</li>
                    <li>Critical observers should be targeted with stabilizing events or additional fragments.</li>
                </ul>
            </div>
        </div>
    );
};
