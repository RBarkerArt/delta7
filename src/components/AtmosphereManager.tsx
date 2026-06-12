import React, { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { GhostParticles } from './GhostParticles';
import { useSound } from '../hooks/useSound';
import { BlackoutMessage } from './BlackoutMessage';
import type { SystemSettings } from '../types/schema';

interface AtmosphereManagerProps {
    coherence: number;
    roomRestoration?: number;
    suspendParticles?: boolean;
}

const isMobileOrTabletDevice = () => {
    if (typeof window === 'undefined') return false;
    const userAgent = navigator.userAgent || '';
    const isMobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    const isIPadDesktopMode = /Macintosh/i.test(userAgent) && navigator.maxTouchPoints > 1;
    const isCoarse = window.matchMedia('(pointer: coarse)').matches;
    const shortestSide = Math.min(window.innerWidth, window.innerHeight);

    return isMobileUserAgent || isIPadDesktopMode || isCoarse || shortestSide <= 820;
};

const shouldUseReducedAtmosphere = () => {
    if (typeof window === 'undefined') return false;

    return (
        isMobileOrTabletDevice() ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
};

export const AtmosphereManager: React.FC<AtmosphereManagerProps> = ({ coherence, roomRestoration = 1, suspendParticles = false }) => {
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    const [reducedAtmosphere, setReducedAtmosphere] = useState(() => shouldUseReducedAtmosphere());

    // Sync with Global Settings
    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'system', 'settings'), (doc) => {
            if (doc.exists()) {
                setSettings(doc.data() as SystemSettings);
            }
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        const pointerQuery = window.matchMedia('(pointer: coarse)');
        const updatePreference = () => setReducedAtmosphere(shouldUseReducedAtmosphere());

        motionQuery.addEventListener('change', updatePreference);
        pointerQuery.addEventListener('change', updatePreference);
        window.addEventListener('resize', updatePreference);
        updatePreference();

        return () => {
            motionQuery.removeEventListener('change', updatePreference);
            pointerQuery.removeEventListener('change', updatePreference);
            window.removeEventListener('resize', updatePreference);
        };
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
    const runtimeParticleScale = reducedAtmosphere ? 0.28 : 1;

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
    const particleColor = tintColor || (particles === 'dust' ? '222, 221, 216' : activeColor);

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
            {!isBlackout && !suspendParticles && !reducedAtmosphere && (
                <GhostParticles
                    key={theme} // Force remount on theme change to read new CSS var
                    coherence={coherence}
                    variant={particles}
                    color={particleColor}
                    sizeScale={particleSize}
                    density={particleDensity * (1.15 - roomRestoration * 0.35) * runtimeParticleScale}
                    speed={particleSpeed * (1.1 - roomRestoration * 0.25) * (reducedAtmosphere ? 0.75 : 1)}
                    opacity={particleOpacity * (0.45 + (1 - roomRestoration) * 0.45) * (reducedAtmosphere ? 0.55 : 1)}
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
