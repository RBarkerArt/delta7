import React, { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { doc, updateDoc, Timestamp, onSnapshot } from 'firebase/firestore';
import {
    Settings,
    Shield,
    Zap,
    Save,
    Loader2,
    Wifi,
    Clock,
    Server,
    AlertTriangle,
    Trash2
} from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';
import type { SystemSettings } from '../types/schema';

// Default settings if document doesn't exist
const DEFAULT_SETTINGS: SystemSettings = {
    maintenanceMode: false,
    registrationOpen: true,
    glitchIntensity: 1.0,
    theme: 'green',
    particleEffect: 'dust',
    cursorStyle: 'crosshair',
    isBlackout: false,
    particleSize: 0.85,
    particleDensity: 1.0,
    particleSpeed: 1.0,
    particleOpacity: 1.0
};

export const AdminSettings: React.FC = () => {
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Pruning State
    const [pruneStats, setPruneStats] = useState<any>(null);
    const [isPruning, setIsPruning] = useState(false);

    // System Monitor State
    const [serverTime, setServerTime] = useState<string>('');
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    // Initial Data Fetch
    useEffect(() => {
        const settingsRef = doc(db, 'system', 'settings');

        const unsubscribe = onSnapshot(settingsRef, (docSnap) => {
            if (docSnap.exists()) {
                setSettings(docSnap.data() as SystemSettings);
            } else {
                // Initialize if missing (this happens only once ideally)
                setSettings(DEFAULT_SETTINGS);
                // Optionally create the doc here, but cleaner to do on first save
            }
            setLoading(false);
        }, (err) => {
            console.error("Error watching settings:", err);
            setError("Failed to sync settings.");
            setLoading(false);
        });

        // Online status listener
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Clock interval
        const interval = setInterval(() => {
            setServerTime(new Date().toLocaleTimeString('en-US', {
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                timeZoneName: 'short'
            }));
        }, 1000);

        return () => {
            unsubscribe();
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            clearInterval(interval);
        };
    }, []);

    const handleSave = async (newSettings: SystemSettings) => {
        setSaving(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const settingsRef = doc(db, 'system', 'settings');
            await updateDoc(settingsRef, {
                ...newSettings,
                updatedAt: Timestamp.now()
            }).catch(async (err) => {
                // If doc doesn't exist, create it (likely first run)
                if (err.code === 'not-found') {
                    const { setDoc } = await import('firebase/firestore');
                    await setDoc(settingsRef, {
                        ...newSettings,
                        updatedAt: Timestamp.now()
                    });
                } else {
                    throw err;
                }
            });

            // Local update strictly for UI feedback (snapshot handles real data)
            setSuccessMessage("Configuration updated successfully.");
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err: any) {
            console.error("Error saving settings:", err);
            setError(err.message || "Failed to save settings.");
        } finally {
            setSaving(false);
        }
    };

    const toggleSetting = (key: keyof SystemSettings) => {
        if (!settings) return;
        const newSettings = { ...settings, [key]: !settings[key as keyof SystemSettings] };
        // Optimistic update handled by snapshot, but we trigger save
        handleSave(newSettings);
    };

    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!settings) return;
        setSettings({ ...settings, glitchIntensity: parseFloat(e.target.value) });
    };

    const handleSliderCommit = () => {
        if (settings) handleSave(settings);
    }

    const handlePrune = async (dryRun: boolean) => {
        setIsPruning(true);
        setError(null);
        try {
            const pruneFn = httpsCallable(functions, 'pruneStaleUsers');
            const result = await pruneFn({ dryRun });
            setPruneStats(result.data);
            if (!dryRun) {
                setSuccessMessage(`Action Complete. Removed users.`);
            }
        } catch (err: any) {
            console.error("Prune failed:", err);
            setError(err.message || "Prune failed.");
        } finally {
            setIsPruning(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="animate-spin text-emerald-600" size={32} />
            </div>
        );
    }

    const currentSettings = settings || DEFAULT_SETTINGS;
    const THEME_HEX: Record<string, string> = {
        green: '#33ff00',
        amber: '#ffb000',
        red: '#ff3333',
        blue: '#00ffff',
        white: '#ffffff'
    };
    const themeHex = THEME_HEX[currentSettings.theme || 'green'];

    return (
        <div className="space-y-8 max-w-4xl">
            <header className="space-y-2">
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <Settings className="text-gray-400" /> System Configuration
                </h1>
                <p className="text-gray-500 text-sm">
                    Manage global environment variables and access controls.
                </p>
            </header>

            {/* System Monitor */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                    <div className={`p-3 rounded-lg ${isOnline ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                        <Wifi size={20} />
                    </div>
                    <div>
                        <p className="text-xs text-gray-400 uppercase font-semibold">Connectivity</p>
                        <p className={`font-medium ${isOnline ? 'text-emerald-700' : 'text-red-700'}`}>
                            {isOnline ? 'ONLINE' : 'OFFLINE'}
                        </p>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-blue-50 text-blue-600">
                        <Clock size={20} />
                    </div>
                    <div>
                        <p className="text-xs text-gray-400 uppercase font-semibold">Server Time</p>
                        <p className="font-medium text-gray-900 font-mono">
                            {serverTime || '--:--:--'}
                        </p>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-purple-50 text-purple-600">
                        <Server size={20} />
                    </div>
                    <div>
                        <p className="text-xs text-gray-400 uppercase font-semibold">Environment</p>
                        <p className="font-medium text-gray-900">Production (v1.2)</p>
                    </div>
                </div>
            </div>

            {/* Notifications */}
            {error && (
                <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-2 text-sm border border-red-100">
                    <AlertTriangle size={16} /> {error}
                </div>
            )}
            {successMessage && (
                <div className="bg-emerald-50 text-emerald-700 p-4 rounded-lg flex items-center gap-2 text-sm border border-emerald-100 animate-fade-in">
                    <Save size={16} /> {successMessage}
                </div>
            )}

            {/* Controls */}
            <div className="grid grid-cols-1 gap-6">

                {/* Access Control Card */}
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                        <h3 className="font-bold text-gray-900 flex items-center gap-2">
                            <Shield size={18} className="text-gray-500" /> Access Control
                        </h3>
                    </div>
                    <div className="p-6 space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="text-sm font-medium text-gray-900">Maintenance Mode</h4>
                                <p className="text-xs text-gray-500 mt-1">
                                    When active, only admins can access the application. Users see a "System Offline" message.
                                </p>
                            </div>
                            <button
                                onClick={() => toggleSetting('maintenanceMode')}
                                disabled={saving}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${currentSettings.maintenanceMode ? 'bg-emerald-600' : 'bg-gray-200'
                                    }`}
                            >
                                <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${currentSettings.maintenanceMode ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                />
                            </button>
                        </div>

                        <div className="h-px bg-gray-100" />

                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="text-sm font-medium text-gray-900">New User Registration</h4>
                                <p className="text-xs text-gray-500 mt-1">
                                    Allow new users to sign up via Google or Email.
                                </p>
                            </div>
                            <button
                                onClick={() => toggleSetting('registrationOpen')}
                                disabled={saving}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${currentSettings.registrationOpen ? 'bg-emerald-600' : 'bg-gray-200'
                                    }`}
                            >
                                <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${currentSettings.registrationOpen ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Reality Parameters Card */}
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                        <h3 className="font-bold text-gray-900 flex items-center gap-2">
                            <Zap size={18} className="text-gray-500" /> Reality Parameters
                        </h3>
                    </div>
                    <div className="p-6 space-y-6">
                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <div>
                                    <h4 className="text-sm font-medium text-gray-900">Global Glitch Intensity</h4>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Multiplies the visual distortion effects across all user sessions.
                                    </p>
                                </div>
                                <span className="font-mono text-sm font-bold bg-gray-100 px-2 py-1 rounded text-gray-700">
                                    {currentSettings.glitchIntensity.toFixed(1)}x
                                </span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="2"
                                step="0.1"
                                value={currentSettings.glitchIntensity}
                                onChange={handleSliderChange}
                                onMouseUp={handleSliderCommit}
                                onTouchEnd={handleSliderCommit}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                            />
                            <div className="flex justify-between text-xs text-gray-400 mt-2 font-mono">
                                <span>0.0 (Stable)</span>
                                <span>1.0 (Normal)</span>
                                <span>2.0 (Critical)</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Director's Console (Atmosphere) */}
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                        <h3 className="font-bold text-gray-900 flex items-center gap-2">
                            <Settings size={18} className="text-gray-500" /> Atmosphere Control
                        </h3>
                    </div>
                    <div className="p-6 space-y-6">

                        {/* Theme Selector */}
                        <div>
                            <h4 className="text-sm font-medium text-gray-900 mb-3">Transmission Color</h4>
                            <div className="flex gap-3">
                                {(['green', 'amber', 'red', 'blue', 'white'] as const).map(color => (
                                    <button
                                        key={color}
                                        onClick={() => {
                                            if (settings) handleSave({ ...settings, theme: color });
                                        }}
                                        className={`w-10 h-10 rounded-full border-2 transition-all ${currentSettings.theme === color ? 'border-gray-900 scale-110' : 'border-transparent opacity-70 hover:opacity-100'
                                            }`}
                                        style={{ backgroundColor: color === 'green' ? '#33ff00' : color === 'amber' ? '#ffb000' : color === 'red' ? '#ff3333' : color === 'blue' ? '#00ffff' : '#ffffff' }}
                                        title={color.charAt(0).toUpperCase() + color.slice(1)}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Particle Effect */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h4 className="text-sm font-medium text-gray-900 mb-2">Particle System</h4>
                                <select
                                    value={currentSettings.particleEffect || 'dust'}
                                    onChange={(e) => {
                                        if (settings) handleSave({ ...settings, particleEffect: e.target.value as any });
                                    }}
                                    className="w-full p-2 border border-gray-300 rounded-lg bg-gray-50 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                >
                                    <option value="dust">Dust (Floating, Evasive)</option>
                                    <option value="ash">Ash (Falling, Heavy)</option>
                                    <option value="digital-rain">Digital Rain (Vertical)</option>
                                    <option value="none">None</option>
                                </select>
                            </div>

                            <div>
                                <h4 className="text-sm font-medium text-gray-900 mb-2">Cursor Style</h4>
                                <select
                                    value={currentSettings.cursorStyle || 'crosshair'}
                                    onChange={(e) => {
                                        if (settings) handleSave({ ...settings, cursorStyle: e.target.value as any });
                                    }}
                                    className="w-full p-2 border border-gray-300 rounded-lg bg-gray-50 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                >
                                    <option value="crosshair">Crosshair (Precision)</option>
                                    <option value="default">Default Pointer</option>
                                    <option value="none">Hidden</option>
                                </select>
                            </div>
                        </div>

                        {/* Particle Tuning */}
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-4">
                            <h4 className="text-sm font-bold text-gray-900">Particle Tuning</h4>

                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Dust Size</label>
                                <input
                                    type="range"
                                    min="0.5"
                                    max="1.4"
                                    step="0.05"
                                    value={currentSettings.particleSize ?? 0.85}
                                    onChange={(e) => {
                                        if (settings) handleSave({ ...settings, particleSize: parseFloat(e.target.value) });
                                    }}
                                    className="w-full accent-emerald-500"
                                />
                                <div className="flex justify-between text-[10px] text-gray-400">
                                    <span>Fine</span>
                                    <span>{(currentSettings.particleSize ?? 0.85).toFixed(2)}</span>
                                    <span>Thick</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Density</label>
                                <input
                                    type="range"
                                    min="0.6"
                                    max="1.8"
                                    step="0.05"
                                    value={currentSettings.particleDensity ?? 1.0}
                                    onChange={(e) => {
                                        if (settings) handleSave({ ...settings, particleDensity: parseFloat(e.target.value) });
                                    }}
                                    className="w-full accent-emerald-500"
                                />
                                <div className="flex justify-between text-[10px] text-gray-400">
                                    <span>Sparse</span>
                                    <span>{(currentSettings.particleDensity ?? 1.0).toFixed(2)}</span>
                                    <span>Dense</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Drift Speed</label>
                                <input
                                    type="range"
                                    min="0.5"
                                    max="1.6"
                                    step="0.05"
                                    value={currentSettings.particleSpeed ?? 1.0}
                                    onChange={(e) => {
                                        if (settings) handleSave({ ...settings, particleSpeed: parseFloat(e.target.value) });
                                    }}
                                    className="w-full accent-emerald-500"
                                />
                                <div className="flex justify-between text-[10px] text-gray-400">
                                    <span>Still</span>
                                    <span>{(currentSettings.particleSpeed ?? 1.0).toFixed(2)}</span>
                                    <span>Restless</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Opacity</label>
                                <input
                                    type="range"
                                    min="0.4"
                                    max="1.2"
                                    step="0.05"
                                    value={currentSettings.particleOpacity ?? 1.0}
                                    onChange={(e) => {
                                        if (settings) handleSave({ ...settings, particleOpacity: parseFloat(e.target.value) });
                                    }}
                                    className="w-full accent-emerald-500"
                                />
                                <div className="flex justify-between text-[10px] text-gray-400">
                                    <span>Ghostly</span>
                                    <span>{(currentSettings.particleOpacity ?? 1.0).toFixed(2)}</span>
                                    <span>Bright</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="flex-1">
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Particle Tint</label>
                                    <input
                                        type="color"
                                        value={currentSettings.particleTint || themeHex}
                                        onChange={(e) => {
                                            if (settings) handleSave({ ...settings, particleTint: e.target.value });
                                        }}
                                        className="h-9 w-full rounded border border-gray-300 bg-white"
                                    />
                                </div>
                                <button
                                    onClick={() => {
                                        if (settings) handleSave({ ...settings, particleTint: '' });
                                    }}
                                    className="mt-6 px-3 py-2 text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 rounded transition-colors"
                                >
                                    Use Theme
                                </button>
                            </div>
                        </div>

                        {/* Blackout Toggle */}
                        <div className="flex items-center justify-between bg-red-50 p-4 rounded-lg border border-red-100">
                            <div>
                                <h4 className="text-sm font-bold text-red-900 flex items-center gap-2">
                                    <AlertTriangle size={16} /> Global Blackout
                                </h4>
                                <p className="text-xs text-red-700 mt-1">
                                    "Pull the plug". Turns screen black for all users.
                                </p>
                            </div>
                            <button
                                onClick={() => toggleSetting('isBlackout')}
                                disabled={saving}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 ${currentSettings.isBlackout ? 'bg-red-600' : 'bg-gray-300'
                                    }`}
                            >
                                <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${currentSettings.isBlackout ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                />
                            </button>
                        </div>

                    </div>
                </div>

                {/* Database Hygiene */}
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                        <h3 className="font-bold text-gray-900 flex items-center gap-2">
                            <Trash2 size={18} className="text-gray-500" /> Database Hygiene
                        </h3>
                    </div>
                    <div className="p-6 space-y-4">
                        <div>
                            <h4 className="text-sm font-medium text-gray-900">Stale User Pruning</h4>
                            <p className="text-xs text-gray-500 mt-1">
                                Identify and remove anonymous "Ghost" users who have not visited in over 90 days.
                                Anchored users are never affected. Results are logged to console.
                            </p>
                        </div>

                        {pruneStats && (
                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 font-mono text-sm space-y-1">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Found Stale Users:</span>
                                    <span className="font-bold">{pruneStats.foundStale}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Eligible (Unanchored):</span>
                                    <span className="font-bold text-amber-600">{pruneStats.eligibleForDeletion}</span>
                                </div>
                                {pruneStats.deleted !== undefined && (
                                    <div className="flex justify-between pt-2 border-t border-gray-200 mt-2">
                                        <span className="text-gray-500">Deleted:</span>
                                        <span className="font-bold text-red-600">{pruneStats.deleted}</span>
                                    </div>
                                )}
                                <div className="text-[10px] text-gray-400 mt-2 text-right">
                                    Cutoff: {new Date(pruneStats.cutoffDate).toLocaleDateString()}
                                </div>
                            </div>
                        )}

                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => handlePrune(true)} // Dry Run
                                disabled={isPruning}
                                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 font-medium transition-colors"
                            >
                                {isPruning ? <Loader2 className="animate-spin" size={16} /> : 'Scan for Stale Users'}
                            </button>

                            {pruneStats?.eligibleForDeletion > 0 && (
                                <button
                                    onClick={() => {
                                        if (confirm(`Are you sure you want to permanently delete ${pruneStats.eligibleForDeletion} users? This cannot be undone.`)) {
                                            handlePrune(false);
                                        }
                                    }}
                                    disabled={isPruning}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50 flex items-center gap-2 font-medium transition-colors shadow-sm"
                                >
                                    <Trash2 size={16} /> Prune {pruneStats.eligibleForDeletion} Users
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
