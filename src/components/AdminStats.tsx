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
import type { CoherenceState, DayLog } from '../types/schema';

const REQUIRED_LOG_STATES: CoherenceState[] = [
    'FEED_STABLE',
    'SYNC_RECOVERING',
    'COHERENCE_FRAYING',
    'SIGNAL_FRAGMENTED',
    'CRITICAL_INTERFERENCE'
];

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
    missingReturnPacket: number;
    incompleteLogSet: number;
    missingEvidence: number;
    completeRitualDays: number;
    avgLogs: number;
    avgFragments: number;
}

interface RitualIssue {
    day: number;
    missing: string[];
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
        missingReturnPacket: 0,
        incompleteLogSet: 0,
        missingEvidence: 0,
        completeRitualDays: 0,
        avgLogs: 0,
        avgFragments: 0
    });
    const [ritualIssues, setRitualIssues] = useState<RitualIssue[]>([]);
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
                let missingReturnPacket = 0;
                let incompleteLogSet = 0;
                let missingEvidence = 0;
                let completeRitualDays = 0;
                let totalLogs = 0;
                let totalFragments = 0;
                const nextRitualIssues: RitualIssue[] = [];

                days.forEach((day) => {
                    const missing: string[] = [];
                    const hasEntryPrologue = !!day.prologueSentences?.[0]?.trim();
                    const hasReturnPacket = !!day.prologueSentences?.[1]?.trim();
                    const hasAllLogs = REQUIRED_LOG_STATES.every(logState => !!day.vm_logs?.[logState]?.body?.trim());
                    const hasFragments = !!day.fragments?.length;
                    const hasEvidence = !!day.images?.some(image => !!image.url && !image.placeholder);

                    if (!day.prologueSentences || day.prologueSentences.length === 0) missingPrologue++;
                    if (!day.vm_logs || Object.keys(day.vm_logs).length === 0) missingLogs++;
                    if (!day.fragments || day.fragments.length === 0) missingFragments++;
                    if (!day.images || day.images.length === 0) missingImages++;
                    if (!hasReturnPacket) missingReturnPacket++;
                    if (!hasAllLogs) incompleteLogSet++;
                    if (!hasEvidence) missingEvidence++;

                    if (!hasEntryPrologue) missing.push('entry prologue');
                    if (!hasReturnPacket) missing.push('return packet');
                    if (!hasAllLogs) missing.push('five-state logs');
                    if (!hasFragments) missing.push('fragments');
                    if (!hasEvidence) missing.push('evidence');

                    if (missing.length === 0) {
                        completeRitualDays++;
                    } else {
                        nextRitualIssues.push({ day: day.day, missing });
                    }

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
                    missingReturnPacket,
                    incompleteLogSet,
                    missingEvidence,
                    completeRitualDays,
                    avgLogs: totalDays > 0 ? Math.round(totalLogs / totalDays) : 0,
                    avgFragments: totalDays > 0 ? Math.round(totalFragments / totalDays) : 0
                });
                setRitualIssues(nextRitualIssues.sort((a, b) => a.day - b.day));
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

            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-5">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-gray-900 font-semibold">
                        <Sparkles size={18} className="text-gray-400" /> Ritual Coverage
                    </div>
                    <div className="text-xs font-medium text-gray-500">
                        {loading ? '-' : `${dayStats.completeRitualDays}/${dayStats.totalDays}`} complete
                    </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 text-sm">
                    {[
                        { label: 'Entry gaps', value: dayStats.missingPrologue },
                        { label: 'Return gaps', value: dayStats.missingReturnPacket },
                        { label: 'Log gaps', value: dayStats.incompleteLogSet },
                        { label: 'Fragment gaps', value: dayStats.missingFragments },
                        { label: 'Evidence gaps', value: dayStats.missingEvidence }
                    ].map(item => (
                        <div key={item.label} className="bg-gray-50 rounded-lg p-3">
                            <div className="text-xs text-gray-500">{item.label}</div>
                            <div className="text-lg font-bold text-gray-900">{loading ? '-' : item.value}</div>
                        </div>
                    ))}
                </div>

                <div className="border-t border-gray-100 pt-4">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Open Ritual Issues</div>
                    {loading ? (
                        <p className="text-sm text-gray-400">Checking coverage...</p>
                    ) : ritualIssues.length === 0 ? (
                        <p className="text-sm text-gray-500">All visible days have entry, return, log, fragment, and evidence coverage.</p>
                    ) : (
                        <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-100 divide-y divide-gray-100">
                            {ritualIssues.slice(0, 16).map(issue => (
                                <div key={issue.day} className="flex items-start justify-between gap-4 px-3 py-2 text-sm">
                                    <span className="font-mono text-gray-700">Day {String(issue.day).padStart(3, '0')}</span>
                                    <span className="text-right text-gray-500">{issue.missing.join(', ')}</span>
                                </div>
                            ))}
                            {ritualIssues.length > 16 && (
                                <div className="px-3 py-2 text-xs text-gray-400">
                                    {ritualIssues.length - 16} additional days omitted from this view.
                                </div>
                            )}
                        </div>
                    )}
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
