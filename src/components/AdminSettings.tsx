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
    Sparkles
} from 'lucide-react';
import type { SystemSettings } from '../types/schema';

// Default settings if document doesn't exist
const DEFAULT_SETTINGS: SystemSettings = {
    maintenanceMode: false,
    registrationOpen: true,
    glitchIntensity: 1.0
};

export const AdminSettings: React.FC = () => {
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

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

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="animate-spin text-emerald-600" size={32} />
            </div>
        );
    }

    const currentSettings = settings || DEFAULT_SETTINGS;

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

                {/* Narrative Engine Rules Card */}
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                        <h3 className="font-bold text-gray-900 flex items-center gap-2">
                            <Sparkles size={18} className="text-gray-500" /> Narrative Engine Rules
                        </h3>
                    </div>
                    <div className="p-6 space-y-6">
                        <div>
                            <h4 className="text-sm font-medium text-gray-900">Core Directives</h4>
                            <p className="text-xs text-gray-500 mt-1 mb-3">
                                Detailed instructions for the AI agent regarding tone, lore accuracy, and formatting.
                            </p>
                            <textarea
                                value={currentSettings.aiRules || ''}
                                onChange={(e) => {
                                    if (settings) {
                                        setSettings({ ...settings, aiRules: e.target.value });
                                    }
                                }}
                                onBlur={() => settings && handleSave(settings)}
                                className="w-full h-48 p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-y text-sm font-mono"
                                placeholder="Enter system prompts and narrative constraints here..."
                            />
                            <p className="text-xs text-gray-400 mt-2">
                                * Changes are saved automatically when you click outside the text area.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
