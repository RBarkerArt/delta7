import React, { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, query, orderBy, limit, Timestamp } from 'firebase/firestore';
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
                const obsRef = collection(db, 'observers');
                const q = query(obsRef, orderBy('lastSeenAt', 'desc'), limit(100)); // Limit to 100 for heavy stats calc on client for now
                const snapshot = await getDocs(q);

                const now = new Date();
                const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

                let total = 0;
                let anchored = 0;
                let active = 0;
                let totalCoherence = 0;
                const activity: ActivityItem[] = [];

                snapshot.forEach(doc => {
                    const data = doc.data() as UserProgress;
                    total++;
                    if (data.isAnchored) anchored++;
                    if (data.lastSeenAt.toDate() > oneDayAgo) active++;
                    totalCoherence += data.coherenceScore || 0;

                    // Build activity feed from recent users
                    if (activity.length < 5) {
                        activity.push({
                            id: doc.id,
                            email: data.email,
                            lastSeenAt: data.lastSeenAt,
                            event: data.email ? `User ${data.email.split('@')[0]} Active` : `Observer ${doc.id.substring(0, 6)} Active`,
                            status: data.isAnchored ? 'Anchored' : 'Ghost'
                        });
                    }
                });

                setStats({
                    totalUsers: total,
                    anchoredUsers: anchored,
                    activeToday: active,
                    avgCoherence: total > 0 ? Math.round(totalCoherence / total) : 0
                });
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {statCards.map((stat) => (
                    <div key={stat.label} className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm transition-all hover:shadow-md">
                        <div className="flex justify-between items-start mb-4">
                            <div className={`p-3 rounded-lg ${stat.bg} ${stat.color}`}>
                                <stat.icon size={24} />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <p className="text-2xl font-bold text-gray-900">
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
                        <div className="flex justify-between items-center mb-6">
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
