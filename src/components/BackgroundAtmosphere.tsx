import React, { useMemo } from 'react';

interface BackgroundAtmosphereProps {
    score: number;
}

export const BackgroundAtmosphere: React.FC<BackgroundAtmosphereProps> = ({ score }) => {
    // Persistent rules: never remove blur/darkness
    // Min blur 4px, Max blur 12px
    const blurAmount = useMemo(() => 4 + (100 - score) * 0.08, [score]);

    // Min darkness 0.7, Max darkness 0.95
    const darknessAmount = useMemo(() => 0.7 + (100 - score) * 0.0025, [score]);

    // Vignette intensity: stronger at low coherence (more claustrophobic)
    // Base: 150px spread, increases to 250px at low coherence
    const vignetteIntensity = useMemo(() => {
        const base = 150;
        const additional = (100 - score) * 1.5; // +150px at 0 coherence
        return base + additional;
    }, [score]);

    // Breathing animation speed: faster at low coherence (more anxious)
    const breathingDuration = useMemo(() => {
        if (score >= 80) return 12; // Calm, slow
        if (score >= 60) return 10;
        if (score >= 40) return 7;
        if (score >= 20) return 5;
        return 3; // Rapid, stressed
    }, [score]);

    // Breathing intensity: more pronounced at low coherence
    const breathingIntensity = useMemo(() => {
        if (score >= 80) return 0.02;
        if (score >= 60) return 0.04;
        if (score >= 40) return 0.06;
        if (score >= 20) return 0.08;
        return 0.12;
    }, [score]);

    // Instability logic: slight jitter at low coherence
    const jitterStyle = useMemo(() => {
        if (score > 40) return {};
        const intensity = (40 - score) / 40;
        return {
            '--jitter-intensity': `${intensity * 2}px`,
            animation: 'background-jitter 4s infinite linear'
        } as React.CSSProperties;
    }, [score]);

    return (
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden select-none bg-black">
            {/* The Image Layer */}
            <div
                className="absolute inset-0 transition-transform duration-[4000ms] linear scale-110"
                style={{
                    backgroundImage: `url('https://firebasestorage.googleapis.com/v0/b/delta7-3fede.firebasestorage.app/o/site%20images%2FScreenshot%202025-12-20%20at%209.50.58%E2%80%AFPM.png?alt=media&token=56908937-e9ad-4e3c-a0ee-2bbab4595af0')`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    filter: `blur(${blurAmount}px)`,
                    opacity: 0.8,
                    ...jitterStyle
                }}
            />

            {/* The Dark Overlay with breathing effect */}
            <div
                className="absolute inset-0 transition-colors duration-[2000ms]"
                style={{
                    backgroundColor: `rgba(0, 0, 0, ${darknessAmount})`,
                    animation: `background-breathe ${breathingDuration}s ease-in-out infinite`,
                    '--breathe-intensity': breathingIntensity
                } as React.CSSProperties}
            />

            {/* Coherence-reactive vignette - darkens edges more at low coherence */}
            <div
                className="absolute inset-0 transition-shadow duration-[2000ms]"
                style={{
                    boxShadow: `inset 0 0 ${vignetteIntensity}px rgba(0, 0, 0, 0.85)`
                }}
            />

            {/* Inner glow that pulses with breathing */}
            <div
                className="absolute inset-0"
                style={{
                    boxShadow: score < 60
                        ? `inset 0 0 100px rgba(16, 185, 129, ${0.02 + (60 - score) * 0.001})`
                        : 'none',
                    animation: score < 60
                        ? `vignette-pulse ${breathingDuration}s ease-in-out infinite`
                        : 'none'
                }}
            />

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes background-jitter {
                    0%, 100% { transform: translate(0, 0) scale(1.1); }
                    10% { transform: translate(calc(var(--jitter-intensity) * -1), var(--jitter-intensity)) scale(1.11); }
                    20% { transform: translate(var(--jitter-intensity), calc(var(--jitter-intensity) * -1)) scale(1.1); }
                    30% { transform: translate(calc(var(--jitter-intensity) * 0.5), var(--jitter-intensity)) scale(1.105); }
                    40% { transform: translate(calc(var(--jitter-intensity) * -1), calc(var(--jitter-intensity) * -0.5)) scale(1.1); }
                    50% { transform: translate(var(--jitter-intensity), var(--jitter-intensity)) scale(1.115); }
                }
                
                @keyframes background-breathe {
                    0%, 100% { 
                        opacity: 1;
                    }
                    50% { 
                        opacity: calc(1 - var(--breathe-intensity, 0.04));
                    }
                }
                
                @keyframes vignette-pulse {
                    0%, 100% {
                        opacity: 0.5;
                    }
                    50% {
                        opacity: 1;
                    }
                }
            `}} />
        </div>
    );
};
