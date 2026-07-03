import React, { useState, useEffect } from 'react';
import { ThreePrologueAtmosphere } from './ThreePrologueAtmosphere';
import { openAudioChannel } from '../lib/audioUnlock';

// The WebGL atmosphere costs a ~730KB three.js download plus a GL context on
// the very first screen. Phones and tablets get a cheap CSS glow instead so
// the prologue loads fast and never pressures mobile browser memory.
const shouldUseThreeAtmosphere = () => {
    if (typeof window === 'undefined') return false;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    if (window.matchMedia('(pointer: coarse)').matches) return false;
    const userAgent = navigator.userAgent || '';
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)) return false;
    if (/Macintosh/i.test(userAgent) && navigator.maxTouchPoints > 1) return false;
    return true;
};

interface PrologueProps {
    sentence: string;
    onComplete: () => void;
    eyebrow?: string;
    actionLabel?: string;
    coherence?: number;
}

export const Prologue: React.FC<PrologueProps> = ({ sentence, onComplete, eyebrow, actionLabel = 'Enter Room', coherence = 70 }) => {
    const [phase, setPhase] = useState<'reveal' | 'hold' | 'fade-out'>('reveal');
    const [canEnter, setCanEnter] = useState(false);
    const [useThreeAtmosphere] = useState(() => shouldUseThreeAtmosphere());

    const enterRoom = () => {
        if (phase === 'fade-out') return;
        // Prologue-path users skip RoomEntryTransition, so the advance click is
        // their audio-unlock gesture. openAudioChannel no-ops if the user
        // previously muted (opt-in '0'), so a mute choice stays sticky.
        void openAudioChannel();
        setPhase('fade-out');
    };

    useEffect(() => {
        if (phase === 'reveal') {
            const enterTimer = setTimeout(() => setCanEnter(true), 1200);
            const phaseTimer = setTimeout(() => setPhase('hold'), 5200);
            return () => {
                clearTimeout(enterTimer);
                clearTimeout(phaseTimer);
            };
        }

        if (phase === 'hold') {
            const timer = setTimeout(() => setPhase('fade-out'), 1100);
            return () => clearTimeout(timer);
        }

        if (phase === 'fade-out') {
            const timer = setTimeout(onComplete, 850);
            return () => clearTimeout(timer);
        }
    }, [phase, onComplete]);

    return (
        <div className="fixed inset-0 bg-lab-black z-[100] flex items-center justify-center p-8 sm:p-24 overflow-hidden">
            <div
                className={`
                    absolute inset-0 z-0 pointer-events-none bg-lab-black transition-all duration-[4000ms] ease-out
                    ${phase === 'fade-out' ? 'opacity-0 scale-105 blur-sm' : 'opacity-100'}
                `}
            />

            {useThreeAtmosphere ? (
                <ThreePrologueAtmosphere phase={phase} coherence={coherence} />
            ) : (
                <div
                    aria-hidden="true"
                    className={`absolute inset-0 z-0 pointer-events-none transition-opacity duration-[3000ms] ${phase === 'fade-out' ? 'opacity-0' : 'opacity-100'}`}
                    style={{
                        background:
                            'radial-gradient(ellipse at 50% 42%, rgba(242,234,208,0.10), transparent 55%), radial-gradient(ellipse at 48% 55%, rgba(16,185,129,0.06), transparent 62%)',
                    }}
                />
            )}

            <div className={`
                max-w-3xl w-full text-center transition-all duration-[4000ms] ease-in-out relative z-10
                ${phase === 'fade-out' ? 'opacity-0 scale-95 blur-sm' : 'opacity-100 scale-100'}
                animate-memory-float
            `}>
                <div className={`
                    relative transition-all duration-[6000ms] ease-out
                    ${phase === 'reveal' ? 'prologue-mask-revealing' : 'prologue-mask-visible'}
                `}>
                    {eyebrow && (
                        <div className="mb-6 font-mono text-[10px] uppercase tracking-[0.28em] text-[#d8d2bd]/42">
                            {eyebrow}
                        </div>
                    )}
                    <p
                        className="font-['EB_Garamond'] italic text-3xl sm:text-5xl text-[#d1d1c7] leading-relaxed tracking-widest select-none"
                        style={{ textShadow: '0 0 20px rgba(209, 209, 199, 0.15)' }}
                    >
                        {sentence}
                    </p>
                </div>

                <button
                    onClick={enterRoom}
                    className={`
                        mt-10 border border-[#d8d2bd]/20 bg-black/20 px-5 py-3 font-mono text-[10px] uppercase tracking-[0.24em] text-[#d8d2bd]/60 transition-all duration-700
                        ${canEnter ? 'opacity-100 hover:border-emerald-200/35 hover:text-[#f2ead0]' : 'pointer-events-none opacity-0'}
                    `}
                >
                    {actionLabel}
                </button>
            </div>
        </div>
    );
};
