import React, { useState } from 'react';
import type { CoherenceState } from '../types/schema';
import { GlitchText } from './GlitchText';

interface FragmentProps {
    id: string;
    body: string;
    severity: CoherenceState;
    coherenceScore: number;
    isVisible: boolean;
}

export const Fragment: React.FC<FragmentProps> = ({ body, severity, coherenceScore, isVisible }) => {
    // Lazy initializer is pure-safe and avoids set-state-in-effect
    const [pos] = useState(() => ({
        // Keep them a bit more centralized to avoid edge cropping
        x: 15 + Math.random() * 70,
        y: 20 + Math.random() * 60
    }));

    if (!isVisible) return null;

    // Ghost thoughts should be more visible now
    // Base 0.5 opacity + up to 0.5 more based on chaos
    const displayOpacity = Math.max(0.5, 0.5 + ((100 - coherenceScore) / 200));

    return (
        <div
            className="absolute transition-all duration-1000 pointer-events-none p-4 max-w-sm"
            style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                opacity: displayOpacity,
                transform: `translate(-50%, -50%)`,
                zIndex: 50 // Ensure it floats above standard content
            }}
        >
            <div className={`
                p-6 rounded-xl backdrop-blur-md border animate-float shadow-lg
                ${severity === 'CRITICAL_INTERFERENCE'
                    ? 'bg-red-950/40 border-red-500/30 text-red-200 shadow-red-900/20'
                    : 'bg-emerald-950/40 border-emerald-400/30 text-emerald-100 shadow-emerald-900/20'
                }
            `}>
                <div className="flex items-center justify-between mb-2 opacity-70">
                    <span className="text-[10px] font-mono uppercase tracking-widest">Memory_Leak::{severity}</span>
                </div>
                <GlitchText
                    text={body}
                    coherenceScore={coherenceScore}
                    className="text-base italic font-['EB_Garamond'] leading-relaxed drop-shadow-md"
                />
            </div>
        </div>
    );
};
