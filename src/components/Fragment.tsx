import React, { useState, useEffect, useRef } from 'react';
import type { CoherenceState } from '../types/schema';

interface FragmentProps {
    id: string;
    body: string;
    severity: CoherenceState;
    coherenceScore: number;
    isVisible?: boolean;
}

export const Fragment: React.FC<FragmentProps> = ({ body, isVisible = true }) => {
    // Initial random positions and velocities
    const [pos, setPos] = useState({
        x: 20 + Math.random() * 60,
        y: 20 + Math.random() * 60
    });

    const vel = useRef({
        x: (Math.random() - 0.5) * 0.08, // Slightly faster, still slow
        y: (Math.random() - 0.5) * 0.08
    });

    const requestRef = useRef<number>(0);
    const boundary = 10; // 10% padding

    const update = () => {
        setPos(prev => {
            let nextX = prev.x + vel.current.x;
            let nextY = prev.y + vel.current.y;

            // Bounce X
            if (nextX <= boundary) {
                nextX = boundary;
                vel.current.x *= -1;
            } else if (nextX >= 100 - boundary) {
                nextX = 100 - boundary;
                vel.current.x *= -1;
            }

            // Bounce Y
            if (nextY <= boundary) {
                nextY = boundary;
                vel.current.y *= -1;
            } else if (nextY >= 100 - boundary) {
                nextY = 100 - boundary;
                vel.current.y *= -1;
            }

            return { x: nextX, y: nextY };
        });
        requestRef.current = requestAnimationFrame(update);
    };

    useEffect(() => {
        requestRef.current = requestAnimationFrame(update);
        return () => cancelAnimationFrame(requestRef.current);
    }, []); // Always run physics once mounted

    // Opacity calculation based on distance from center (50, 50)
    const distFromCenter = Math.sqrt(Math.pow(pos.x - 50, 2) + Math.pow(pos.y - 50, 2));
    // Center is (50, 50). Max distance to any boundary point is roughly 40-56.
    // We want it to be ~0.3 at distance 50, and 1.0 at distance 0.
    const centerWeight = Math.max(0.2, 1 - (distFromCenter / 65));

    // Combine trigger visibility with spatial opacity
    const finalOpacity = isVisible ? centerWeight : 0;

    return (
        <div
            className="absolute pointer-events-none select-none z-[999] transition-opacity duration-[1200ms] ease-in-out"
            style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                transform: 'translate(-50%, -50%)',
                opacity: finalOpacity,
                width: 'max-content',
                maxWidth: '240px'
            }}
        >
            <div className="font-['EB_Garamond'] italic text-sm sm:text-lg text-white font-medium tracking-wide leading-relaxed drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
                {body}
            </div>

            {/* Subtle positioning indicator/ghostly light */}
            <div className="absolute -inset-4 bg-white/10 blur-2xl -z-10 rounded-full" />
        </div>
    );
};
