import React, { useEffect, useState } from 'react';

interface ScreenEffectsProps {
    flickerLevel: number; // 1-3
    driftLevel: number;   // 1-3
}

export const ScreenEffects: React.FC<ScreenEffectsProps> = ({ flickerLevel, driftLevel }) => {
    const [flareOpacity, setFlareOpacity] = useState(0);

    // Flicker / Flare Logic
    useEffect(() => {
        if (flickerLevel <= 0) return;

        const loop = () => {
            // Random interval based on level (higher level = more frequent)
            const baseInterval = flickerLevel === 3 ? 2000 : flickerLevel === 2 ? 5000 : 12000;
            const randomDelay = Math.random() * baseInterval;

            setTimeout(() => {
                // Trigger flare
                const intensity = flickerLevel === 3 ? 0.3 : 0.15;
                setFlareOpacity(Math.random() * intensity);

                // Reset quickly
                setTimeout(() => {
                    setFlareOpacity(0);
                    loop();
                }, 100 + Math.random() * 200);
            }, randomDelay);
        };

        const timer = setTimeout(loop, 1000);
        return () => clearTimeout(timer);
    }, [flickerLevel]);

    // Drift Logic (applied via class to parent or self)
    // We'll apply it to this overlay, but for "container drift" we might need to apply styles up the tree.
    // However, visual "burn-in" or "dirt" drifting is cool too.

    return (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
            {/* Screen Flare Overlay */}
            <div
                className="absolute inset-0 bg-white transition-opacity duration-100 mix-blend-overlay"
                style={{ opacity: flareOpacity }}
            />

            {/* Drift / Burn-in simulation (Static dirt texture moving) */}
            {driftLevel > 1 && (
                <div
                    className="absolute inset-0 opacity-[0.03] bg-repeat"
                    style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                        animation: `float ${30 / driftLevel}s ease-in-out infinite alternate`
                    }}
                />
            )}
        </div>
    );
};
