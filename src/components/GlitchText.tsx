import React, { useState, useEffect, useMemo } from 'react';

interface GlitchTextProps {
    text: string;
    coherenceScore: number;
    className?: string;
}

const GLITCH_CHARS = '!@#$%^&*()_+-=[]{}|;:,.<>?/\\0123456789';

export const GlitchText: React.FC<GlitchTextProps> = ({ text, coherenceScore, className }) => {
    const [glitchedText, setGlitchedText] = useState(text);

    // Calculate glitch intensity
    const intensity = useMemo(() => {
        if (coherenceScore >= 90) return 0;
        if (coherenceScore >= 70) return 0.015; // Refined subtle
        if (coherenceScore >= 45) return 0.04;  // Fraying but readable
        if (coherenceScore >= 20) return 0.08;  // Fragmented
        return 0.18; // Critical but shape-preserved
    }, [coherenceScore]);

    useEffect(() => {
        if (intensity === 0) {
            return;
        }

        const interval = setInterval(() => {
            const chars = text.split('');
            const newChars = chars.map((char) => {
                // Space preservation is critical for readability
                if (char === ' ' || char === '\n') return char;

                if (Math.random() < intensity) {
                    return GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
                }
                return char;
            });

            setGlitchedText(newChars.join(''));

            // Brief "settling" effect - return to original text quickly
            setTimeout(() => {
                setGlitchedText(text);
            }, 50 + Math.random() * 100);

        }, 1000 + Math.random() * 2000); // Glitch occasionally

        return () => clearInterval(interval);
    }, [text, intensity]);

    return <span className={className}>{glitchedText}</span>;
};
