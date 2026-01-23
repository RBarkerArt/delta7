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
        x: 10 + Math.random() * 80,
        y: 10 + Math.random() * 80
    }));

    if (!isVisible) return null;

    // Ghost thoughts are more glitched when they appear
    const displayOpacity = Math.max(0.1, (100 - coherenceScore) / 200);

    return (
        <div
            className="absolute transition-all duration-1000 pointer-events-none p-4 max-w-xs"
            style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                opacity: displayOpacity,
                transform: `translate(-50%, -50%)`,
            }}
        >
            <div className={`p-4 rounded-xl backdrop-blur-sm border ${severity === 'CRITICAL_INTERFERENCE' ? 'bg-red-950/10 border-red-900/20 text-red-400' :
                    'bg-emerald-950/10 border-emerald-900/20 text-emerald-400'
                }`}>
                <div className="text-[10px] font-mono uppercase tracking-widest opacity-40 mb-2">Memory_Leak::{severity}</div>
                <GlitchText
                    text={body}
                    coherenceScore={coherenceScore}
                    className="text-sm italic font-mono leading-relaxed"
                />
            </div>
        </div>
    );
};
