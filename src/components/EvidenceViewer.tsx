import React, { useState, useEffect, useRef } from 'react';
import { GlitchText } from './GlitchText';

interface EvidenceImage {
    id: string;
    caption: string;
    placeholder?: boolean;
}

interface EvidenceViewerProps {
    image: EvidenceImage;
    coherenceScore: number;
}

export const EvidenceViewer: React.FC<EvidenceViewerProps> = ({ image, coherenceScore }) => {
    const [noiseOffset, setNoiseOffset] = useState(0);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Noise animation
    useEffect(() => {
        let animationFrame: number;
        const animate = () => {
            if (Math.random() > 0.5) {
                setNoiseOffset(Math.random() * 100);
            }
            animationFrame = requestAnimationFrame(animate);
        };
        animate();
        return () => cancelAnimationFrame(animationFrame);
    }, []);

    // Visual calculations based purely on engine coherence
    const degradation = (100 - coherenceScore) / 100;
    const currentBlur = degradation * 15; // Up to 15px blur
    const currentNoise = 0.2 + (degradation * 0.6); // 0.2 to 0.8 opacity
    const currentBrightness = 1 - (degradation * 0.5); // 1 to 0.5 brightness
    const currentGrayscale = 0.5 + (degradation * 0.5); // Always somewhat grayscale, more at low coherence

    return (
        <div className="mt-8 border border-signal-green/10 p-1 relative group">
            <div className="absolute -top-3 left-2 bg-lab-black px-2 text-[10px] text-signal-green/30">
                EVIDENCE_ATTACHMENT
            </div>

            <div
                className="relative aspect-video w-full overflow-hidden bg-black/80"
                ref={wrapperRef}
            >
                {/* Image Content */}
                <div
                    className="w-full h-full flex items-center justify-center transition-all duration-1000"
                    style={{
                        filter: `blur(${currentBlur}px) brightness(${currentBrightness}) contrast(1.1) grayscale(${currentGrayscale})`,
                        transform: `scale(${1 + (degradation * 0.05)})` // Subtle breathing zoom based on entropy
                    }}
                >
                    {image.placeholder ? (
                        <div className="text-signal-green/20 flex flex-col items-center select-none">
                            <div className="text-4xl mb-2 animate-pulse">[ ? ]</div>
                            <div className="text-[10px] font-mono">SIGNAL_MISSING</div>
                        </div>
                    ) : (
                        <img src={`/assets/${image.id}.jpg`} alt="Evidence" className="w-full h-full object-cover" />
                    )}
                </div>

                {/* Noise Overlay */}
                <div
                    className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-50"
                    style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='${0.6 + Math.random() * 0.1}' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                        opacity: currentNoise,
                        transform: `translateY(${noiseOffset}px)`
                    }}
                />

                {/* Scanline for image specifically */}
                <div className={`absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-10 bg-[length:100%_4px,6px_100%] opacity-20`} />
            </div>

            <div className="mt-2 text-[10px] text-signal-green/40 font-mono flex justify-between uppercase tracking-widest">
                <span>FILE_ID: {image.id}</span>
                <span className="text-signal-green/60">
                    <GlitchText text={image.caption} coherenceScore={coherenceScore} />
                </span>
            </div>
        </div>
    );
};
