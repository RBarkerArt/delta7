import React, { useEffect, useState, useMemo } from 'react';


const BLACKOUT_QUOTES = [
    "Presence retained. Processes paused.",
    "You are still here. The system is holding.",
    "Observation acknowledged. State suspended.",
    "Continuity is intact. Activity is paused.",
    "This witness remains. Time does not.",
    "The system has not lost you.",
    "Hold. You are recognized.",
    "State preserved. Observer present.",
    "Nothing is advancing. You are still seen.",
    "This is a holding interval. You are accounted for."
];

export const BlackoutMessage: React.FC = () => {
    // Select a random quote only once on mount
    const quote = useMemo(() => {
        const randomIndex = Math.floor(Math.random() * BLACKOUT_QUOTES.length);
        return BLACKOUT_QUOTES[randomIndex];
    }, []);

    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Small delay before showing text to simulate system processing
        const timer = setTimeout(() => {
            setIsVisible(true);
        }, 1000);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="flex flex-col items-center justify-center p-8 max-w-2xl text-center">
            <div
                className={`transition-opacity duration-[2000ms] ${isVisible ? 'opacity-100' : 'opacity-0'}`}
            >
                {/* 
                    Container for the pulsing effect 
                    Uses 'animate-pulse-gentle' from global CSS for the "pulse and hold" feel
                */}
                <div className="animate-pulse-gentle transition-all duration-[4000ms]">
                    <p
                        className="font-['EB_Garamond'] italic text-2xl sm:text-4xl text-[#d1d1c7] leading-relaxed tracking-widest select-none"
                        style={{ textShadow: '0 0 20px rgba(209, 209, 199, 0.15)' }}
                    >
                        {quote}
                    </p>
                </div>

                {/* Optional decorative separator like prologue */}
                <div className="w-12 h-px bg-signal-green/30 mt-8 mx-auto" />
            </div>
        </div>
    );
};
