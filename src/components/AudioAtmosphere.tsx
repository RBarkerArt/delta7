import React, { useEffect, useRef } from 'react';
import { useCoherence } from '../context/CoherenceContext';
import { soundEngine } from '../lib/SoundEngine';

export const AudioAtmosphere: React.FC = () => {
    const { score, state } = useCoherence();
    const glitchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const phantomTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Sync hum with coherence score
    useEffect(() => {
        soundEngine.setCoherence(score);
    }, [score]);

    // Sporadic Glitches logic
    useEffect(() => {
        const scheduleNextGlitch = () => {
            // Base delay is 5s-20s when stable
            // Delay is 0.5s-3s when critical
            let minDelay = 5000;
            let maxDelay = 20000;

            if (state === 'COHERENCE_FRAYING') {
                minDelay = 3000;
                maxDelay = 10000;
            } else if (state === 'SIGNAL_FRAGMENTED') {
                minDelay = 1000;
                maxDelay = 5000;
            } else if (state === 'CRITICAL_INTERFERENCE') {
                minDelay = 500;
                maxDelay = 2500;
            }

            const delay = Math.random() * (maxDelay - minDelay) + minDelay;

            glitchTimerRef.current = setTimeout(() => {
                // Glitches only in mid/low coherence, not strictly "instability"
                if (score < 40 && score >= 20) {
                    soundEngine.playGlitch();
                }
                scheduleNextGlitch();
            }, delay);
        };

        scheduleNextGlitch();

        return () => {
            if (glitchTimerRef.current) clearTimeout(glitchTimerRef.current);
        };
    }, [state, score]);

    // Phantom Clicks logic (Tier 2/Low Coherence)
    useEffect(() => {
        const scheduleNextPhantom = () => {
            if (state !== 'SIGNAL_FRAGMENTED') return;

            const minDelay = 2000;
            const maxDelay = 8000;
            const delay = Math.random() * (maxDelay - minDelay) + minDelay;

            phantomTimerRef.current = setTimeout(() => {
                soundEngine.playPhantomClick();
                scheduleNextPhantom();
            }, delay);
        };

        scheduleNextPhantom();

        return () => {
            if (phantomTimerRef.current) clearTimeout(phantomTimerRef.current);
        };
    }, [state]);

    // This component renders nothing but manages global state
    return null;
};
