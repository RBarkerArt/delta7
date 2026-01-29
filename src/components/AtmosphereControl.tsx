import React, { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { doc, updateDoc, Timestamp, onSnapshot } from 'firebase/firestore';
import {
    Settings,
    AlertTriangle,
    Save,
    Loader2
} from 'lucide-react';
import type { SystemSettings } from '../types/schema';

const DEFAULT_SETTINGS: SystemSettings = {
    maintenanceMode: false,
    registrationOpen: true,
    glitchIntensity: 1.0,
    theme: 'green',
    particleEffect: 'dust',
    cursorStyle: 'crosshair',
    isBlackout: false
};

export const AtmosphereControl: React.FC = () => {
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    useEffect(() => {
        const settingsRef = doc(db, 'system', 'settings');
        const unsubscribe = onSnapshot(settingsRef, (docSnap) => {
            if (docSnap.exists()) {
                setSettings(docSnap.data() as SystemSettings);
            } else {
                setSettings(DEFAULT_SETTINGS);
            }
            setLoading(false);
        }, (err) => {
            console.error("Error watching settings:", err);
            setError("Failed to sync settings.");
            setLoading(false);
        });
        return () => unsubscribe();
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
            });
            setSuccessMessage("Atmosphere updated.");
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
        handleSave({ ...settings, [key]: !settings[key as keyof SystemSettings] });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="animate-spin text-emerald-600" size={32} />
            </div>
        );
    }

    const currentSettings = settings || DEFAULT_SETTINGS;

    return (
        <div className="space-y-6 max-w-4xl">
            <header className="space-y-2 mb-6">
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <Settings className="text-gray-400" /> Director's Console
                </h1>
                <p className="text-gray-500 text-sm">
                    Manage global atmosphere, themes, and override protocols.
                </p>
            </header>

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
                                    onClick={() => handleSave({ ...currentSettings, theme: color })}
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
                                onChange={(e) => handleSave({ ...currentSettings, particleEffect: e.target.value as any })}
                                className="w-full p-2 border border-gray-300 rounded-lg bg-gray-50 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                            >
                                <option value="dust">Dust (Floating, Evasive)</option>
                                <option value="ash">Ash (Falling, Heavy)</option>
                                <option value="digital-rain">Digital Rain (Vertical)</option>
                                <option value="none">None</option>
                            </select>
                        </div>

                        {/* Audio Protocols */}


                        {/* Cursor Style (Moved below audio for grouping) */}
                        <div>
                            <h4 className="text-sm font-medium text-gray-900 mb-2">Cursor Style</h4>
                            <select
                                value={currentSettings.cursorStyle || 'crosshair'}
                                onChange={(e) => handleSave({ ...currentSettings, cursorStyle: e.target.value as any })}
                                className="w-full p-2 border border-gray-300 rounded-lg bg-gray-50 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                            >
                                <option value="crosshair">Crosshair (Precision)</option>
                                <option value="default">Default Pointer</option>
                                <option value="none">Hidden</option>
                            </select>
                        </div>

                    </div> {/* Closing div for the surrounding container, previously closed randomly by me in the replacement block logic? No, let's be careful. */}

                    {/* Audio Protocols */}
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mt-6 mb-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full animate-pulse ${currentSettings.isAudioEnabled !== false ? 'bg-emerald-500' : 'bg-red-500'}`} /> Audio Protocols
                            </h4>
                            <button
                                onClick={() => handleSave({ ...currentSettings, isAudioEnabled: !(currentSettings.isAudioEnabled ?? true) })}
                                className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${currentSettings.isAudioEnabled !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-500'}`}
                            >
                                {currentSettings.isAudioEnabled !== false ? 'SYSTEM ACTIVE' : 'MUTED'}
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Global Volume</label>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.05"
                                    value={currentSettings.audioVolume ?? 1.0}
                                    onChange={(e) => handleSave({ ...currentSettings, audioVolume: parseFloat(e.target.value) })}
                                    className="w-full accent-emerald-500"
                                />
                                <div className="flex justify-between text-xs text-gray-400">
                                    <span>0%</span>
                                    <span>{Math.round((currentSettings.audioVolume ?? 1.0) * 100)}%</span>
                                    <span>100%</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Operational Mode</label>
                                <select
                                    value={currentSettings.audioMode || 'generative'}
                                    onChange={(e) => handleSave({ ...currentSettings, audioMode: e.target.value as any })}
                                    className="w-full p-2 border border-gray-300 rounded text-sm bg-white"
                                >
                                    <option value="generative">Generative (Breathing)</option>
                                    <option value="track">Background Track Only</option>
                                    <option value="hybrid">Hybrid (Layered)</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Background Track URL (MP3/WAV)</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={currentSettings.backgroundTrackUrl || ''}
                                    onChange={(e) => setSettings(settings ? { ...settings, backgroundTrackUrl: e.target.value } : null)}
                                    onBlur={(e) => handleSave({ ...currentSettings, backgroundTrackUrl: e.target.value })}
                                    placeholder="https://example.com/audio.mp3"
                                    className="flex-1 p-2 border border-gray-300 rounded text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                />
                                {currentSettings.backgroundTrackUrl && (
                                    <button
                                        onClick={() => handleSave({ ...currentSettings, backgroundTrackUrl: '' })}
                                        className="px-3 py-2 text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 rounded transition-colors"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                        </div>

                        {currentSettings.audioMode === 'hybrid' && (
                            <div className="bg-emerald-50 p-3 rounded border border-emerald-100 animate-fade-in mt-4 transition-all">
                                <label className="block text-xs font-bold text-emerald-800 mb-1">Hybrid Mix Balance (Background Track vs Generative)</label>
                                <input
                                    type="range"
                                    min="0"
                                    max="0.5"
                                    step="0.01"
                                    value={currentSettings.hybridTrackVolume ?? 0.02}
                                    onChange={(e) => handleSave({ ...currentSettings, hybridTrackVolume: parseFloat(e.target.value) })}
                                    className="w-full accent-emerald-600 cursor-pointer"
                                />
                                <div className="flex justify-between text-xs text-emerald-600 mt-1">
                                    <span>Silent (0%)</span>
                                    <span className="font-bold">{Math.round((currentSettings.hybridTrackVolume ?? 0.02) * 100)}%</span>
                                    <span>Max (50%)</span>
                                </div>
                                <p className="text-[10px] text-emerald-600 mt-2 opacity-80">
                                    Use this to ensure the background music doesn't overpower the generative effects.
                                </p>
                            </div>
                        )}
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
        </div>
    );
};
