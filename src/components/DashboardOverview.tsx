import React from 'react';
import {
    Activity,
    Users,
    Database,
    ShieldCheck,
    AlertCircle
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export const DashboardOverview: React.FC = () => {

    const stats = [
        { label: 'Active Observers', value: '1,284', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
        { label: 'Nexus Coherence', value: '94.2%', icon: Activity, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { label: 'Unstable Fragments', value: '12', icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50' },
        { label: 'Observation Points', value: '84.1k', icon: Database, color: 'text-purple-600', bg: 'bg-purple-50' },
    ];

    return (
        <div className="space-y-10">
            <header className="space-y-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-100">
                        <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    </div>
                    <span className="text-[10px] md:text-xs font-mono uppercase tracking-[0.2em] md:tracking-[0.3em] text-zinc-400">Observational Feed Status: NOMINAL</span>
                </div>
                <h1 className="text-2xl md:text-4xl font-bold text-zinc-900 tracking-tight">
                    Welcome back, <span className="text-emerald-600">Observer</span>.
                </h1>
                <p className="text-zinc-500 max-w-2xl leading-relaxed text-sm md:text-base">
                    The temporal anchor is stabilized. Observation Nexus is currently capturing primary neural feeds with standard deviation within nominal thresholds.
                </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat) => (
                    <div key={stat.label} className="bg-white border border-zinc-200 p-6 rounded-2xl hover:border-emerald-200 hover:shadow-md transition-all duration-300 group">
                        <div className="flex justify-between items-start mb-4">
                            <div className={`p-3 rounded-xl ${stat.bg} ${stat.color} transition-colors group-hover:scale-110 duration-200`}>
                                <stat.icon size={24} />
                            </div>
                            <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">ACTIVE_CAPTURE</span>
                        </div>
                        <div className="space-y-1">
                            <p className="text-3xl font-bold text-zinc-900 tracking-tight">{stat.value}</p>
                            <p className="text-xs font-medium text-zinc-500">{stat.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-zinc-900">Observation Feed History</h3>
                            <button className="text-xs font-mono text-emerald-600 hover:text-emerald-700 uppercase tracking-widest font-bold">Access Nexus Logs</button>
                        </div>
                        <div className="space-y-4">
                            {[
                                { time: '14:23:01', event: 'Neural feed Day_04 synchronized', status: 'NOMINAL' },
                                { time: '13:12:44', event: 'Minor coherence dip detected in sector 4', status: 'DEGRADED' },
                                { time: '11:05:12', event: 'Primary fragment backup complete', status: 'NOMINAL' },
                                { time: '09:44:33', event: 'Observer "X-993" initiated handoff', status: 'STABLE' },
                            ].map((activity, i) => (
                                <div key={i} className="flex items-center justify-between py-3 border-b border-zinc-100 last:border-0">
                                    <div className="flex items-center gap-4">
                                        <span className="text-[10px] font-mono text-zinc-400">{activity.time}</span>
                                        <span className="text-sm text-zinc-600 font-medium">{activity.event}</span>
                                    </div>
                                    <span className={cn(
                                        "text-[8px] font-mono font-bold px-2 py-1 rounded",
                                        activity.status === 'NOMINAL' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                                            activity.status === 'DEGRADED' ? "bg-amber-50 text-amber-600 border border-amber-100" :
                                                "bg-zinc-100 text-zinc-500"
                                    )}>
                                        {activity.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-gradient-to-br from-emerald-50 to-white border border-emerald-100 rounded-2xl p-6 relative overflow-hidden group shadow-sm">
                        <div className="relative z-10 space-y-4">
                            <h3 className="font-bold text-emerald-700">Nexus Integrity</h3>
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs font-mono text-emerald-600/70">
                                    <span>STABILITY_STATUS</span>
                                    <span>98%</span>
                                </div>
                                <div className="h-1.5 bg-emerald-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-600 w-[98%]" />
                                </div>
                            </div>
                            <p className="text-[10px] text-emerald-600/60 leading-relaxed font-mono font-medium">
                                Nexus cycle 07 complete. Captured data streams remain coherent and synchronized with the temporal baseline.
                            </p>
                        </div>
                        <Activity className="absolute -bottom-4 -right-4 w-32 h-32 text-emerald-600/5 group-hover:text-emerald-600/10 transition-colors" />
                    </div>

                    <div className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-4 shadow-sm">
                        <h3 className="font-bold text-zinc-900">Nexus Controls</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <button className="p-3 bg-zinc-50 hover:bg-zinc-100 rounded-xl text-xs font-semibold text-zinc-600 border border-zinc-100 transition-colors">Season Data</button>
                            <button className="p-3 bg-zinc-50 hover:bg-zinc-100 rounded-xl text-xs font-semibold text-zinc-600 border border-zinc-100 transition-colors">Log Nexus</button>
                            <button className="p-3 bg-zinc-50 hover:bg-zinc-100 rounded-xl text-xs font-semibold text-zinc-600 border border-zinc-100 transition-colors">Re-anchor</button>
                            <button className="p-3 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-xs font-mono text-white transition-colors shadow-sm font-bold">BROADCAST</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
