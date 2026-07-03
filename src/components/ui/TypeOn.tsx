import React, { useEffect, useRef, useState } from 'react';

interface TypeOnProps {
    text: string;
    /** Milliseconds per character (slight random jitter is added). */
    speed?: number;
    /** Delay before typing starts. */
    startDelay?: number;
    className?: string;
    showCursor?: boolean;
    onDone?: () => void;
}

/**
 * Types text on character-by-character with a terminal cursor.
 * Re-runs when `text` changes. Respects prefers-reduced-motion.
 */
export const TypeOn: React.FC<TypeOnProps> = ({
    text,
    speed = 16,
    startDelay = 0,
    className,
    showCursor = true,
    onDone,
}) => {
    const [count, setCount] = useState(0);
    const [prevText, setPrevText] = useState(text);
    const onDoneRef = useRef(onDone);

    // Render-phase reset so a new text never shows a stale slice for a frame.
    if (prevText !== text) {
        setPrevText(text);
        setCount(0);
    }

    useEffect(() => {
        onDoneRef.current = onDone;
    }, [onDone]);

    useEffect(() => {
        if (!text) return undefined;

        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        let cancelled = false;
        let timer: number;

        const typeNext = (index: number) => {
            if (cancelled) return;
            setCount(index);
            if (index >= text.length) {
                onDoneRef.current?.();
                return;
            }
            const jitter = speed * (0.5 + Math.random());
            timer = window.setTimeout(() => typeNext(index + 1), jitter);
        };

        timer = window.setTimeout(
            () => typeNext(reducedMotion ? text.length : 1),
            reducedMotion ? 0 : startDelay
        );
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [text, speed, startDelay]);

    const isTyping = count < text.length;

    return (
        <span className={className}>
            {text.slice(0, count)}
            {showCursor && (
                <span
                    className={`ml-0.5 inline-block h-[1em] w-[0.45em] translate-y-[0.15em] bg-current ${isTyping ? '' : 'animate-pulse'}`}
                    style={{ opacity: isTyping ? 0.9 : 0.5 }}
                    aria-hidden="true"
                />
            )}
        </span>
    );
};
