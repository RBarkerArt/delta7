import React, { useState, useEffect, useMemo } from 'react';
import { GlitchText } from './GlitchText';

interface EvidenceImage {
    url: string;
    caption: string;
    description?: string;
    id: string;
}

interface EvidenceViewerProps {
    image: EvidenceImage;
    coherenceScore: number;
}

export const EvidenceViewer: React.FC<EvidenceViewerProps> = ({ image, coherenceScore }) => {
    const [noiseOffset, setNoiseOffset] = useState(0);
    // Use lazy initializer for noiseFreq to fix set-state-in-effect and satisfy purity lint
    const [noiseFreq] = useState(() => 0.6 + Math.random() * 0.1);

    useEffect(() => {
        const interval = setInterval(() => {
            setNoiseOffset(Math.random() * 200);
        }, 100);
        return () => clearInterval(interval);
    }, []);

    // Displacement and degradation calculations
    const degradation = (100 - coherenceScore) / 100;
    const blurAmount = degradation * 8; // Max 8px blur
    const currentNoise = 0.05 + (degradation * 0.3); // 5% to 35% noise
    const currentBrightness = 1 - (degradation * 0.5); // 1 to 0.5 brightness
    const currentGrayscale = 0.5 + (degradation * 0.5); // Always somewhat grayscale, more at low coherence

    const noiseBg = useMemo(() => {
        return `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='${noiseFreq}' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`;
    }, [noiseFreq]);

    return (
        <div className="relative w-full aspect-video bg-zinc-900 rounded-lg overflow-hidden border border-emerald-900/30 group">
            {/* Base Image with Filters */}
            <div
                className="absolute inset-0 transition-all duration-500 ease-in-out bg-cover bg-center"
                style={{
                    backgroundImage: `url(${image.url})`,
                    filter: `blur(${blurAmount}px) brightness(${currentBrightness}) grayscale(${currentGrayscale}) contrast(1.2)`,
                }}
            />

            {/* Static Noise Overlay */}
            <div
                className="absolute inset-0 pointer-events-none mix-blend-overlay transition-opacity duration-300"
                style={{
                    backgroundImage: noiseBg,
                    opacity: currentNoise,
                    transform: `translateY(${noiseOffset}px)`
                }}
            />

            {/* Scanline Effect */}
            <div className="absolute inset-0 pointer-events-none bg-scanlines opacity-[0.15]" />

            {/* Dial-Up Reveal Mask */}
            <div className="absolute inset-x-0 bottom-0 z-40 w-full bg-zinc-950 animate-dial-up-reveal pointer-events-none" />

            {/* Content Overlay */}
            <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent">
                <div className="flex flex-col gap-2 translate-y-2 group-hover:translate-y-0 transition-transform duration-500">
                    <div className="flex items-center gap-3">
                        <div className="h-[1px] w-8 bg-emerald-500/50" />
                        <span className="text-[10px] text-emerald-500 font-mono tracking-widest uppercase">Visual_Data_Captured</span>
                    </div>
                    <GlitchText
                        text={image.caption}
                        coherenceScore={coherenceScore}
                        className="text-lg font-bold text-zinc-100"
                    />
                    {image.description && (
                        <p className="text-sm text-zinc-400 font-mono leading-relaxed line-clamp-2 italic">
                            {image.description}
                        </p>
                    )}
                </div>
            </div>

            {/* HUD Elements */}
            <div className="absolute top-4 right-4 flex items-center gap-2">
                <div className="flex gap-1">
                    {[1, 2, 3].map(i => (
                        <div
                            key={i}
                            className={`w-1 h-3 rounded-full transition-colors duration-500 ${i <= (coherenceScore / 33) ? 'bg-emerald-500' : 'bg-emerald-500/20'
                                }`}
                        />
                    ))}
                </div>
                <span className="text-[10px] text-emerald-500/70 font-mono">SIGNAL_{coherenceScore}%</span>
            </div>
        </div>
    );
};
