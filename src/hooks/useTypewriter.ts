import { useState, useEffect, useCallback } from 'react';
import { useSound } from './useSound';

interface TypewriterOptions {
    speed?: number;
    glitchProbability?: number;
}

const GLITCH_CHARS = '!@#$%^&*()_+-=[]{}|;:,.<>?/\\';

export const useTypewriter = (text: string, options: TypewriterOptions = {}) => {
    const { speed = 30, glitchProbability = 0 } = options;
    const [displayedText, setDisplayedText] = useState('');
    const [complete, setComplete] = useState(false);
    const { playClick } = useSound();

    const type = useCallback(() => {
        let index = 0;
        setComplete(false);
        setDisplayedText('');

        const interval = setInterval(() => {
            if (index >= text.length) {
                setComplete(true);
                clearInterval(interval);
                return;
            }

            const char = text[index];
            const isGlitch = Math.random() < glitchProbability;

            if (isGlitch) {
                const randomChar = GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
                setDisplayedText((prev) => prev + randomChar);
                playClick();

                // Quick correction
                setTimeout(() => {
                    setDisplayedText((prev) => prev.slice(0, -1) + char);
                }, speed / 2);
            } else {
                setDisplayedText((prev) => prev + char);
                playClick();
            }

            index++;
        }, speed);

        return () => clearInterval(interval);
    }, [text, speed, glitchProbability]);

    useEffect(() => {
        const cleanup = type();
        return cleanup;
    }, [type]);

    return { displayedText, complete };
};
