import React, { useState, useEffect, useMemo } from 'react';

interface GlitchTextProps {
    text: string;
    coherenceScore: number;
    className?: string;
}

const GLITCH_CHARS = '!@#$%^&*()_+-=[]{}|;:,.<>?/\\0123456789';
const GHOST_CHARS = '░▒▓█▄▀■□▪▫';

export const GlitchText: React.FC<GlitchTextProps> = ({ text, coherenceScore, className }) => {
    const [glitchedText, setGlitchedText] = useState(text);
    const [jitterStyle, setJitterStyle] = useState({});
    const [ghosting, setGhosting] = useState(false);
    const [echoWord, setEchoWord] = useState<string | null>(null);

    // Calculate effect parameters based on coherence
    const params = useMemo(() => {
        if (coherenceScore >= 90) return {
            substitutionChance: 0,
            jitterAmount: 0,
            ghostChance: 0,
            echoChance: 0,
            interval: 5000
        };
        if (coherenceScore >= 70) return {
            substitutionChance: 0.012,
            jitterAmount: 0.3,
            ghostChance: 0.02,
            echoChance: 0.01,
            interval: 3000
        };
        if (coherenceScore >= 45) return {
            substitutionChance: 0.035,
            jitterAmount: 0.8,
            ghostChance: 0.06,
            echoChance: 0.03,
            interval: 2000
        };
        if (coherenceScore >= 20) return {
            substitutionChance: 0.07,
            jitterAmount: 1.5,
            ghostChance: 0.12,
            echoChance: 0.06,
            interval: 1200
        };
        return {
            substitutionChance: 0.15,
            jitterAmount: 2.5,
            ghostChance: 0.25,
            echoChance: 0.1,
            interval: 800
        };
    }, [coherenceScore]);

    const [hiddenText, setHiddenText] = useState<string | null>(null);

    // Semantic Drift Data
    const REDACTIONS = ['[REDACTED]', '[DATA_LOST]', '█', '████', '[CORRUPT]'];
    const WHISPERS = [
        'they are watching',
        'do not trust the feed',
        'signal decay',
        'it sees you',
        'run',
        'not safe',
        'disconnect',
        "don't look"
    ];

    // Main glitch effect
    useEffect(() => {
        if (params.substitutionChance === 0) {
            setGlitchedText(text);
            setHiddenText(null);
            return;
        }

        const triggerGlitch = () => {
            // 1. Semantic Drift (Word Level)
            let processedText = text;
            if (coherenceScore < 40) {
                const words = text.split(' ');
                processedText = words.map(word => {
                    // Skip short words
                    if (word.length < 4) return word;

                    // Chance to Redact (drastically reduced)
                    // Only happens meaningfully at critical levels (< 20)
                    const redactChance = coherenceScore < 20 ? 0.03 : 0.005;
                    if (Math.random() < redactChance) {
                        return REDACTIONS[Math.floor(Math.random() * REDACTIONS.length)];
                    }

                    // Chance to Vowel Decay (s_w h_m)
                    // Still rare, but slightly more common than full redaction
                    if (Math.random() < redactChance * 2) {
                        return word.replace(/[aeiou]/gi, '_');
                    }

                    return word;
                }).join(' ');
            }

            // 2. Character Glitch (Char Level)
            const chars = processedText.split('');
            const newChars = chars.map((char) => {
                if (char === ' ' || char === '\n') return char;

                // Ghost character (block)
                if (Math.random() < params.ghostChance * 0.2) { // Scaled back from 0.3
                    return GHOST_CHARS[Math.floor(Math.random() * GHOST_CHARS.length)];
                }

                // Standard substitution
                if (Math.random() < params.substitutionChance) {
                    return GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
                }
                return char;
            });

            setGlitchedText(newChars.join(''));

            // 3. Hidden Text Injection (Steganography)
            // Only at very low coherence and rare
            if (coherenceScore < 30 && Math.random() < 0.08) {
                setHiddenText(WHISPERS[Math.floor(Math.random() * WHISPERS.length)]);
            } else {
                setHiddenText(null);
            }

            // Letter-spacing jitter
            if (params.jitterAmount > 0 && Math.random() < 0.5) {
                const jitter = (Math.random() - 0.5) * params.jitterAmount;
                setJitterStyle({ letterSpacing: `${jitter}px` });
            }

            // Ghosting effect (text shadow echo)
            if (Math.random() < params.ghostChance) {
                setGhosting(true);
                setTimeout(() => setGhosting(false), 150);
            }

            // Word echo effect
            if (Math.random() < params.echoChance) {
                const words = text.split(' ');
                const randomWord = words[Math.floor(Math.random() * words.length)];
                if (randomWord && randomWord.length > 2) {
                    setEchoWord(randomWord);
                    setTimeout(() => setEchoWord(null), 800);
                }
            }

            // Settle callback (removed to allow continuous semantic drift stability)
            // If we settle, redactions disappear too quickly. 
            // We want redactions to persist until next tick.
        };

        const interval = setInterval(triggerGlitch, params.interval * (0.7 + Math.random() * 0.6));
        // Trigger immediately
        triggerGlitch();

        return () => clearInterval(interval);
    }, [text, params, coherenceScore]);

    return (
        <span
            className={`relative ${className || ''}`}
            style={{
                ...jitterStyle,
                textShadow: ghosting
                    ? `2px 2px 0 rgba(16, 185, 129, 0.3), -2px -2px 0 rgba(239, 68, 68, 0.2)`
                    : undefined,
                transition: 'letter-spacing 0.05s ease-out'
            }}
        >
            {glitchedText}

            {/* Hidden Text Steganography */}
            {hiddenText && (
                <span className="inline-block w-[1px] h-[1em] overflow-hidden whitespace-nowrap text-transparent selection:w-auto selection:h-auto selection:overflow-visible selection:bg-emerald-500 selection:text-black font-bold mx-0.5 align-middle select-text">
                    {hiddenText}
                </span>
            )}

            {/* Echo word overlay */}
            {echoWord && (
                <span
                    className="absolute left-0 top-0 opacity-30 blur-[1px] pointer-events-none"
                    style={{
                        transform: `translate(${3 + Math.random() * 4}px, ${-2 + Math.random() * 4}px)`,
                        color: 'rgba(16, 185, 129, 0.5)'
                    }}
                >
                    {echoWord}...
                </span>
            )}
        </span>
    );
};
