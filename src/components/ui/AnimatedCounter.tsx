import React, { useEffect, useRef, useState } from 'react';

interface AnimatedCounterProps {
    value: number;
    decimals?: number;
    duration?: number;
    prefix?: string;
    suffix?: string;
    className?: string;
    /** Fired once when a value transition finishes animating. */
    onSettled?: () => void;
}

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

/**
 * Odometer-style numeric readout: animates between values with an eased
 * roll-up instead of snapping. Respects prefers-reduced-motion.
 */
export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
    value,
    decimals = 2,
    duration = 900,
    prefix = '',
    suffix = '',
    className,
    onSettled,
}) => {
    const [display, setDisplay] = useState(value);
    const displayRef = useRef(value);
    const frameRef = useRef<number | null>(null);
    const onSettledRef = useRef(onSettled);

    useEffect(() => {
        onSettledRef.current = onSettled;
    }, [onSettled]);

    useEffect(() => {
        const from = displayRef.current;
        if (from === value) return undefined;

        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const start = performance.now();

        const tick = (now: number) => {
            const progress = reducedMotion ? 1 : Math.min(1, (now - start) / duration);
            const next = from + (value - from) * easeOutCubic(progress);
            displayRef.current = next;
            setDisplay(next);
            if (progress < 1) {
                frameRef.current = requestAnimationFrame(tick);
            } else {
                displayRef.current = value;
                setDisplay(value);
                onSettledRef.current?.();
            }
        };

        frameRef.current = requestAnimationFrame(tick);
        return () => {
            if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
        };
    }, [value, duration]);

    return (
        <span className={className}>
            {prefix}
            {display.toFixed(decimals)}
            {suffix}
        </span>
    );
};
