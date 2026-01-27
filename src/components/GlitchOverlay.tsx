import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useSound } from '../hooks/useSound';

interface GlitchOverlayProps {
    coherence: number;
    isGlitching?: boolean; // From day transition
}

/**
 * GlitchOverlay - Creates random coherence-reactive visual glitches
 * The lower the coherence, the more frequent and intense the glitches
 */
export const GlitchOverlay: React.FC<GlitchOverlayProps> = ({ coherence, isGlitching = false }) => {
    const [activeGlitch, setActiveGlitch] = useState<'none' | 'micro' | 'medium' | 'heavy' | 'critical'>('none');
    const [rgbShift, setRgbShift] = useState(false);
    const [scanlineGlitch, setScanlineGlitch] = useState(false);
    const [invertFlash, setInvertFlash] = useState(false);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const { playSignalNoise, playTemporalShift } = useSound();

    // Calculate glitch parameters based on coherence
    const getGlitchParams = useCallback(() => {
        if (coherence >= 80) {
            // Stable: Very rare, very subtle
            return {
                chance: 0.02,
                interval: 30000,
                types: ['micro'] as const,
                duration: 80
            };
        } else if (coherence >= 60) {
            // Recovering: Occasional micro-glitches
            return {
                chance: 0.08,
                interval: 15000,
                types: ['micro', 'micro', 'medium'] as const,
                duration: 120
            };
        } else if (coherence >= 40) {
            // Fraying: More frequent, RGB shift possible
            return {
                chance: 0.15,
                interval: 8000,
                types: ['micro', 'medium', 'medium', 'heavy'] as const,
                duration: 200
            };
        } else if (coherence >= 20) {
            // Fragmented: Heavy glitches
            return {
                chance: 0.25,
                interval: 4000,
                types: ['medium', 'heavy', 'heavy', 'critical'] as const,
                duration: 300
            };
        } else {
            // Critical: Intense, frequent
            return {
                chance: 0.4,
                interval: 2000,
                types: ['heavy', 'critical', 'critical'] as const,
                duration: 500
            };
        }
    }, [coherence]);

    // Random glitch trigger
    useEffect(() => {
        const scheduleNextGlitch = () => {
            const params = getGlitchParams();
            const nextInterval = params.interval * (0.5 + Math.random());

            timeoutRef.current = setTimeout(() => {
                if (Math.random() < params.chance) {
                    // Trigger a glitch
                    const glitchType = params.types[Math.floor(Math.random() * params.types.length)];
                    setActiveGlitch(glitchType);

                    // Play audio based on glitch type
                    const intensityMap = { micro: 0.1, medium: 0.3, heavy: 0.6, critical: 1.0 };
                    playSignalNoise(intensityMap[glitchType]);

                    // RGB shift chance increases with intensity
                    if (glitchType !== 'micro' && Math.random() < 0.3) {
                        setRgbShift(true);
                    }

                    // Scanline disruption for heavy glitches
                    if ((glitchType === 'heavy' || glitchType === 'critical') && Math.random() < 0.4) {
                        setScanlineGlitch(true);
                    }

                    // Invert flash for critical only
                    if (glitchType === 'critical' && Math.random() < 0.2) {
                        setInvertFlash(true);
                        setTimeout(() => setInvertFlash(false), 50);
                    }

                    // Clear glitch after duration
                    setTimeout(() => {
                        setActiveGlitch('none');
                        setRgbShift(false);
                        setScanlineGlitch(false);
                    }, params.duration * (0.8 + Math.random() * 0.4));
                }

                scheduleNextGlitch();
            }, nextInterval);
        };

        scheduleNextGlitch();

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [getGlitchParams, playSignalNoise]);

    // Force glitch when isGlitching (day transition)
    useEffect(() => {
        if (isGlitching) {
            setActiveGlitch('critical');
            setRgbShift(true);
            setScanlineGlitch(true);
            // Play the day transition sound
            playTemporalShift();
        }
    }, [isGlitching, playTemporalShift]);

    // No visual if stable
    if (activeGlitch === 'none' && !isGlitching) return null;

    return (
        <>
            {/* Main glitch overlay */}
            <div
                className={`
                    fixed inset-0 pointer-events-none z-[100]
                    ${activeGlitch === 'micro' ? 'glitch-overlay-micro' : ''}
                    ${activeGlitch === 'medium' ? 'glitch-overlay-medium' : ''}
                    ${activeGlitch === 'heavy' ? 'glitch-overlay-heavy' : ''}
                    ${activeGlitch === 'critical' || isGlitching ? 'glitch-overlay-critical' : ''}
                `}
            />

            {/* RGB Chromatic aberration layer */}
            {rgbShift && (
                <div className="fixed inset-0 pointer-events-none z-[101] glitch-rgb-shift" />
            )}

            {/* Scanline disruption */}
            {scanlineGlitch && (
                <div className="fixed pointer-events-none z-[102] glitch-scanline-tear"
                    style={{ top: `${20 + Math.random() * 60}%` }}
                />
            )}

            {/* Invert flash */}
            {invertFlash && (
                <div className="fixed inset-0 pointer-events-none z-[103] bg-white mix-blend-difference opacity-80" />
            )}
        </>
    );
};
