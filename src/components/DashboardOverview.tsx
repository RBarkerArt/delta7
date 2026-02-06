import React, { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import {
    collection,
    getDocs,
    query,
    orderBy,
    limit,
    Timestamp,
    where,
    getCountFromServer,
    getAggregateFromServer,
    sum
} from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import {
    Activity,
    Users,
    FileText,
    Calendar,
    Clock,
    UserCheck,
    Zap
} from 'lucide-react';
import type { UserProgress } from '../types/schema';

interface DashboardStats {
    totalUsers: number;
    anchoredUsers: number;
    activeToday: number;
    avgCoherence: number;
}

interface ActivityItem {
    id: string;
    email?: string | null;
    lastSeenAt: Timestamp;
    event: string;
    status: string;
}

interface ObserverEvent {
    observerId: string;
    email?: string | null;
    isAnchored?: boolean;
    coherenceState?: string;
    coherenceScore?: number;
    dayProgress?: number;
    reason: string;
    createdAt: Timestamp;
}

export const DashboardOverview: React.FC = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState<DashboardStats>({
        totalUsers: 0,
        anchoredUsers: 0,
        activeToday: 0,
        avgCoherence: 0
    });
    const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const now = new Date();
                const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                const obsRef = collection(db, 'observers');
                const oneDayAgoTs = Timestamp.fromDate(oneDayAgo);

                const [
                    totalSnap,
                    anchoredSnap,
                    activeSnap,
                    coherenceSnap
                ] = await Promise.all([
                    getCountFromServer(obsRef),
                    getCountFromServer(query(obsRef, where('isAnchored', '==', true))),
                    getCountFromServer(query(obsRef, where('lastSeenAt', '>', oneDayAgoTs))),
                    getAggregateFromServer(obsRef, { totalCoherence: sum('coherenceScore') })
                ]);

                const total = totalSnap.data().count;
                const anchored = anchoredSnap.data().count;
                const active = activeSnap.data().count;
                const totalCoherence = (coherenceSnap.data().totalCoherence as number | null) || 0;

                setStats({
                    totalUsers: total,
                    anchoredUsers: anchored,
                    activeToday: active,
                    avgCoherence: total > 0 ? Math.round(totalCoherence / total) : 0
                });

                // Activity feed from observer events (fallback to latest users if empty)
                const activity: ActivityItem[] = [];
                const eventsRef = collection(db, 'observer_events');
                const eventsQuery = query(eventsRef, orderBy('createdAt', 'desc'), limit(20));
                const eventsSnap = await getDocs(eventsQuery);

                eventsSnap.forEach((docSnap) => {
                    if (activity.length >= 8) return;
                    const data = docSnap.data() as ObserverEvent;
                    const name = data.email ? data.email.split('@')[0] : `Observer ${data.observerId?.substring(0, 6) || '???'}`;
                    const eventLabel = data.reason.startsWith('state_change_')
                        ? `State shift: ${data.reason.replace('state_change_', '')}`
                        : data.reason === 'session_start'
                            ? 'Session started'
                            : data.reason === 'session_end'
                                ? 'Session ended'
                                : data.reason === 'visibility_visible'
                                    ? 'Returned to session'
                                    : data.reason === 'visibility_hidden'
                                        ? 'Session backgrounded'
                                        : data.reason;

                    activity.push({
                        id: docSnap.id,
                        email: data.email,
                        lastSeenAt: data.createdAt,
                        event: `${name} • ${eventLabel}`,
                        status: data.isAnchored ? 'Anchored' : 'Ghost'
                    });
                });

                if (activity.length === 0) {
                    const q = query(obsRef, orderBy('lastSeenAt', 'desc'), limit(5));
                    const snapshot = await getDocs(q);
                    snapshot.forEach(doc => {
                        const data = doc.data() as UserProgress;
                        activity.push({
                            id: doc.id,
                            email: data.email,
                            lastSeenAt: data.lastSeenAt,
                            event: data.email ? `User ${data.email.split('@')[0]} Active` : `Observer ${doc.id.substring(0, 6)} Active`,
                            status: data.isAnchored ? 'Anchored' : 'Ghost'
                        });
                    });
                }

                setRecentActivity(activity);
            } catch (error) {
                console.error("Error fetching dashboard stats:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    const statCards = [
        { label: 'Total Users', value: stats.totalUsers.toString(), icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
        { label: 'Anchored Users', value: stats.anchoredUsers.toString(), icon: UserCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { label: 'Active (24h)', value: stats.activeToday.toString(), icon: Zap, color: 'text-amber-600', bg: 'bg-amber-50' },
        { label: 'Avg Coherence', value: `${stats.avgCoherence}%`, icon: Activity, color: 'text-purple-600', bg: 'bg-purple-50' },
    ];

    return (
        <div className="space-y-8">
            <header className="space-y-2">
                <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-gray-500 text-sm">
                    System Overview and Real-time Metrics
                </p>
            </header>

            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {statCards.map((stat) => (
                    <div key={stat.label} className="bg-white border border-gray-200 p-4 sm:p-6 rounded-xl shadow-sm transition-all hover:shadow-md">
                        <div className="flex justify-between items-start mb-3 sm:mb-4">
                            <div className={`p-3 rounded-lg ${stat.bg} ${stat.color}`}>
                                <stat.icon size={24} />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xl sm:text-2xl font-bold text-gray-900">
                                {loading ? '-' : stat.value}
                            </p>
                            <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-6">
                            <h3 className="font-bold text-gray-900">Recent Activity</h3>
                            <button onClick={() => navigate('/admin/observers')} className="text-sm font-medium text-emerald-600 hover:text-emerald-700">View Directory</button>
                        </div>
                        <div className="space-y-0 divide-y divide-gray-100">
                            {loading ? (
                                <div className="py-8 text-center text-gray-400">Loading activity...</div>
                            ) : recentActivity.length > 0 ? (
                                recentActivity.map((activity, i) => (
                                    <div key={i} className="flex items-center justify-between py-4 hover:bg-gray-50/50 transition-colors px-2 -mx-2 rounded-lg">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2 bg-gray-50 rounded-lg text-gray-400">
                                                <Clock size={16} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">{activity.event}</p>
                                                <p className="text-xs text-gray-500">
                                                    {activity.lastSeenAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        </div>
                                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${activity.status === 'Anchored' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                                            }`}>
                                            {activity.status}
                                        </span>
                                    </div>
                                ))
                            ) : (
                                <div className="py-8 text-center text-gray-400">No recent activity found</div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
                        <h3 className="font-bold text-gray-900">Quick Actions</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => navigate('/admin/narrative')} className="p-3 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm font-medium text-gray-700 border border-gray-200 transition-colors flex flex-col items-center gap-2">
                                <Calendar size={20} className="text-gray-400" />
                                Narrative
                            </button>
                            <button onClick={() => navigate('/admin/logs')} className="p-3 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm font-medium text-gray-700 border border-gray-200 transition-colors flex flex-col items-center gap-2">
                                <FileText size={20} className="text-gray-400" />
                                Logs
                            </button>
                            <button onClick={() => navigate('/admin/observers')} className="p-3 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm font-medium text-gray-700 border border-gray-200 transition-colors flex flex-col items-center gap-2">
                                <Users size={20} className="text-gray-400" />
                                Users
                            </button>
                            <button onClick={() => navigate('/admin/stats')} className="p-3 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm font-medium text-gray-700 border border-gray-200 transition-colors flex flex-col items-center gap-2">
                                <Activity size={20} className="text-gray-400" />
                                Stats
                            </button>
                            <button onClick={() => navigate('/admin/settings')} className="p-3 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-medium text-white transition-colors shadow-sm flex flex-col items-center gap-2">
                                <Activity size={20} />
                                Settings
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
