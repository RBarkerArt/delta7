import React, { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { GhostParticles } from './GhostParticles';
import { useSound } from '../hooks/useSound';
import { BlackoutMessage } from './BlackoutMessage';
import type { SystemSettings } from '../types/schema';

interface AtmosphereManagerProps {
    coherence: number;
}

export const AtmosphereManager: React.FC<AtmosphereManagerProps> = ({ coherence }) => {
    const [settings, setSettings] = useState<SystemSettings | null>(null);

    // Sync with Global Settings
    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'system', 'settings'), (doc) => {
            if (doc.exists()) {
                setSettings(doc.data() as SystemSettings);
            }
        });
        return () => unsub();
    }, []);

    const theme = settings?.theme || 'green';
    const particles = settings?.particleEffect || 'dust';
    const cursor = settings?.cursorStyle || 'crosshair';
    const isBlackout = settings?.isBlackout || false;
    const particleSize = settings?.particleSize ?? 0.85;
    const particleDensity = settings?.particleDensity ?? 1.0;
    const particleSpeed = settings?.particleSpeed ?? 1.0;
    const particleOpacity = settings?.particleOpacity ?? 1.0;
    const particleTint = settings?.particleTint;

    const THEME_COLORS: Record<string, string> = {
        green: '51, 255, 0',
        amber: '255, 176, 0',
        red: '255, 51, 51',
        blue: '0, 255, 255',
        white: '255, 255, 255'
    };
    const activeColor = THEME_COLORS[theme] || THEME_COLORS['green'];

    const hexToRgb = (hex?: string) => {
        if (!hex) return null;
        const normalized = hex.trim().replace('#', '');
        if (!(normalized.length === 6 || normalized.length === 3)) return null;
        const full = normalized.length === 3
            ? normalized.split('').map((c) => c + c).join('')
            : normalized;
        const r = parseInt(full.slice(0, 2), 16);
        const g = parseInt(full.slice(2, 4), 16);
        const b = parseInt(full.slice(4, 6), 16);
        if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
        return `${r}, ${g}, ${b}`;
    };

    const tintColor = hexToRgb(particleTint);
    const particleColor = tintColor || activeColor;

    // Audio Controls
    const { setGlobalVolume, setAudioMode, setBackgroundTrack, setIsGlobalEnabled, setHybridTrackVolume } = useSound();

    useEffect(() => {
        if (!settings) return;

        // Apply Audio Settings
        setGlobalVolume(settings.audioVolume ?? 1.0);
        setAudioMode(settings.audioMode || 'generative');
        setBackgroundTrack(settings.backgroundTrackUrl || null);
        setIsGlobalEnabled(settings.isAudioEnabled ?? true);
        setHybridTrackVolume(settings.hybridTrackVolume ?? 0.02);

    }, [settings, setGlobalVolume, setAudioMode, setBackgroundTrack, setIsGlobalEnabled, setHybridTrackVolume]);

    // Apply Global CSS Variables & Classes to Body
    useEffect(() => {
        const body = document.body;

        // 1. Reset Themes
        body.classList.remove('theme-green', 'theme-amber', 'theme-red', 'theme-blue', 'theme-white');
        body.classList.add(`theme-${theme}`);

        // 2. Cursor
        if (cursor === 'none') body.style.cursor = 'none';
        else if (cursor === 'default') body.style.cursor = 'default';
        else body.style.cursor = 'crosshair';

        // 3. Blackout (Handled by Overlay below, but maybe disable scrolling?)
        if (isBlackout) {
            body.style.overflow = 'hidden';
        } else {
            body.style.overflowY = 'auto';
            body.style.overflowX = 'hidden';
        }

    }, [theme, cursor, isBlackout]);

    // Force re-render particles when theme changes to pick up new color
    return (
        <>
            {/* Particle System */}
            {!isBlackout && (
                <GhostParticles
                    key={theme} // Force remount on theme change to read new CSS var
                    coherence={coherence}
                    variant={particles}
                    color={particleColor}
                    sizeScale={particleSize}
                    density={particleDensity}
                    speed={particleSpeed}
                    opacity={particleOpacity}
                />
            )}

            {/* Blackout Overlay */}
            {isBlackout && (
                <div className="fixed inset-0 bg-black z-[20000] flex items-center justify-center pointer-events-none">
                    <BlackoutMessage />
                </div>
            )}
        </>
    );
};
