import React, { useEffect, useRef } from 'react';
import { useCoherence } from '../hooks/useCoherence';
import { soundEngine } from '../lib/SoundEngine';

export const AudioAtmosphere: React.FC = () => {
    const { score, state } = useCoherence();
    const surgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const phantomTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const initAttemptedRef = useRef(false);

    // Auto-Initialization on first interaction
    useEffect(() => {
        const handleUserInteraction = async () => {
            if (initAttemptedRef.current) return;

            const success = await soundEngine.init();
            if (success) {
                initAttemptedRef.current = true;
                document.removeEventListener('click', handleUserInteraction);
                document.removeEventListener('keydown', handleUserInteraction);
                document.removeEventListener('touchstart', handleUserInteraction);
            }
        };

        document.addEventListener('click', handleUserInteraction, { passive: true });
        document.addEventListener('keydown', handleUserInteraction, { passive: true });
        document.addEventListener('touchstart', handleUserInteraction, { passive: true });

        return () => {
            document.removeEventListener('click', handleUserInteraction);
            document.removeEventListener('keydown', handleUserInteraction);
            document.removeEventListener('touchstart', handleUserInteraction);
        };
    }, []);

    // Sync hum with coherence score
    useEffect(() => {
        if (soundEngine.isReady()) {
            soundEngine.setCoherence(score);
        }
    }, [score]);

    // Breath Surge scheduling
    useEffect(() => {
        const scheduleNextSurge = () => {
            if (!soundEngine.isReady()) {
                surgeTimerRef.current = setTimeout(scheduleNextSurge, 2000);
                return;
            }

            // STABLE: No surges
            // FRAYING: 10-25s
            // FRAGMENTED: 4-12s
            // CRITICAL: 2-6s
            let minDelay = 0;
            let maxDelay = 0;

            if (state === 'FEED_STABLE') return;

            if (state === 'COHERENCE_FRAYING') {
                minDelay = 10000;
                maxDelay = 25000;
            } else if (state === 'SIGNAL_FRAGMENTED') {
                minDelay = 4000;
                maxDelay = 12000;
            } else if (state === 'CRITICAL_INTERFERENCE') {
                minDelay = 2000;
                maxDelay = 6000;
            }

            if (minDelay === 0) return;

            const delay = Math.random() * (maxDelay - minDelay) + minDelay;

            surgeTimerRef.current = setTimeout(() => {
                soundEngine.playBreathSurge();
                scheduleNextSurge();
            }, delay);
        };

        scheduleNextSurge();

        return () => {
            if (surgeTimerRef.current) clearTimeout(surgeTimerRef.current);
        };
    }, [state, score]);

    // Phantom Clicks (Low Coherence artifacts)
    useEffect(() => {
        const scheduleNextPhantom = () => {
            if (state !== 'SIGNAL_FRAGMENTED' && state !== 'CRITICAL_INTERFERENCE') return;
            if (!soundEngine.isReady()) {
                phantomTimerRef.current = setTimeout(scheduleNextPhantom, 2000);
                return;
            }

            const minDelay = state === 'CRITICAL_INTERFERENCE' ? 1000 : 3000;
            const maxDelay = state === 'CRITICAL_INTERFERENCE' ? 4000 : 10000;
            const delay = Math.random() * (maxDelay - minDelay) + minDelay;

            phantomTimerRef.current = setTimeout(() => {
                soundEngine.playClick();
                scheduleNextPhantom();
            }, delay);
        };

        scheduleNextPhantom();

        return () => {
            if (phantomTimerRef.current) clearTimeout(phantomTimerRef.current);
        };
    }, [state]);

    return null;
};
