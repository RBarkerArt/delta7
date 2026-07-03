import React, { useEffect, useState } from 'react';

interface DecodeTextProps {
    text: string;
    /** Milliseconds per character lock-in. */
    speed?: number;
    startDelay?: number;
    className?: string;
}

const GLYPHS = '!<>-_\\/[]{}—=+*^?#01';

const randomGlyph = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)];

/**
 * Scramble-to-resolve text: every character churns through noise glyphs and
 * locks in left to right, like a cipher resolving. Respects reduced motion.
 */
export const DecodeText: React.FC<DecodeTextProps> = ({
    text,
    speed = 28,
    startDelay = 0,
    className,
}) => {
    const [display, setDisplay] = useState(text);
    const [resolved, setResolved] = useState(false);
    const [prevText, setPrevText] = useState(text);

    // Render-phase reset so a changed text never flashes the old scramble.
    if (prevText !== text) {
        setPrevText(text);
        setDisplay(text);
        setResolved(false);
    }

    useEffect(() => {
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        let locked = reducedMotion ? text.length : 0;
        let frame: number;
        let timer: number;

        const churn = () => {
            setDisplay(
                text
                    .split('')
                    .map((char, i) => (i < locked || char === ' ' ? char : randomGlyph()))
                    .join('')
            );
            if (locked < text.length) {
                frame = requestAnimationFrame(churn);
            } else {
                setDisplay(text);
                setResolved(true);
            }
        };

        const lockNext = () => {
            locked += 1;
            if (locked <= text.length) {
                timer = window.setTimeout(lockNext, speed * (0.6 + Math.random() * 0.8));
            }
        };

        timer = window.setTimeout(() => {
            frame = requestAnimationFrame(churn);
            if (!reducedMotion) lockNext();
        }, reducedMotion ? 0 : startDelay);

        return () => {
            window.clearTimeout(timer);
            cancelAnimationFrame(frame);
        };
    }, [text, speed, startDelay]);

    return (
        <span className={className} style={{ opacity: resolved ? 1 : 0.85 }}>
            {display}
        </span>
    );
};
