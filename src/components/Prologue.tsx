import React, { useState, useEffect } from 'react';

interface PrologueProps {
    sentence: string;
    onComplete: () => void;
}

export const Prologue: React.FC<PrologueProps> = ({ sentence, onComplete }) => {
    const [phase, setPhase] = useState<'reveal' | 'hold' | 'fade-out' | 'final-sequence'>('reveal');

    useEffect(() => {
        if (phase === 'reveal') {
            const timer = setTimeout(() => setPhase('hold'), 6000);
            return () => clearTimeout(timer);
        }

        if (phase === 'hold') {
            const timer = setTimeout(() => setPhase('fade-out'), 3000);
            return () => clearTimeout(timer);
        }

        if (phase === 'fade-out') {
            const timer = setTimeout(() => setPhase('final-sequence'), 3000);
            return () => clearTimeout(timer);
        }

        if (phase === 'final-sequence') {
            // Show both texts for 3 seconds, then complete
            const timer = setTimeout(onComplete, 3000);
            return () => clearTimeout(timer);
        }
    }, [phase, onComplete]);

    return (
        <div className="fixed inset-0 bg-lab-black z-[100] flex items-center justify-center p-8 sm:p-24 overflow-hidden">
            <div className={`
                max-w-3xl w-full text-center transition-all duration-[4000ms] ease-in-out
                ${(phase === 'fade-out' || phase === 'final-sequence') ? 'opacity-0 scale-95 blur-sm' : 'opacity-100 scale-100'}
                animate-memory-float
            `}>
                <div className={`
                    relative transition-all duration-[6000ms] ease-out
                    ${phase === 'reveal' ? 'prologue-mask-revealing' : 'prologue-mask-visible'}
                `}>
                    <p
                        className="font-['EB_Garamond'] italic text-2xl sm:text-4xl text-[#d1d1c7] leading-relaxed tracking-widest select-none"
                        style={{ textShadow: '0 0 20px rgba(209, 209, 199, 0.15)' }}
                    >
                        {sentence}
                    </p>
                </div>
            </div>

            {phase === 'final-sequence' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                    <div className="font-mono text-emerald-500 text-sm sm:text-base animate-pulse tracking-widest">
                        FREQUENCY FOUND?: TUNING...
                    </div>
                    <div className="font-mono text-signal-green text-sm sm:text-base animate-pulse">
                        {">"} INITIALIZING SCREEN...
                    </div>
                </div>
            )}
        </div>
    );
};
