import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Slider from '@radix-ui/react-slider';
import * as Switch from '@radix-ui/react-switch';
import { useCoherence } from '../context/CoherenceContext';
import { useAuth } from '../context/AuthContext';
import {
    Menu,
    X,
    ChevronDown,
    ChevronUp,
    FastForward,
    RotateCcw,
    Clock
} from 'lucide-react';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

export const DebugPanel: React.FC = () => {
    const { score, setScore, currentDay, setCurrentDay, state } = useCoherence();
    const { isAdmin, user: authUser } = useAuth();
    const [mockHours, setMockHours] = useState(24);
    const [isProcessing, setIsProcessing] = useState(false);

    // If not admin, don't show the debug panel at all
    if (!isAdmin) return null;

    const handleTimeMachine = async () => {
        if (!authUser) return;
        setIsProcessing(true);
        try {
            const userRef = doc(db, 'users', authUser.uid);
            const userDoc = await getDoc(userRef);
            if (userDoc.exists()) {
                const data = userDoc.data();
                const msToSubtract = mockHours * 60 * 60 * 1000;

                // Safety fallbacks for legacy users
                const startTimestamp = data.startDate || (data as any).createdAt || Timestamp.now();
                const lastSeenTimestamp = data.lastSeenAt || Timestamp.now();

                const newStart = new Date(startTimestamp.toMillis() - msToSubtract);
                const newLastSeen = new Date(lastSeenTimestamp.toMillis() - msToSubtract);

                await updateDoc(userRef, {
                    startDate: Timestamp.fromDate(newStart),
                    lastSeenAt: Timestamp.fromDate(newLastSeen)
                });

                window.location.reload();
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleResetAuto = async () => {
        if (!authUser) return;
        setIsProcessing(true);
        try {
            const userRef = doc(db, 'users', authUser.uid);
            await updateDoc(userRef, {
                isManualDayProgress: false
            });
            window.location.reload();
        } catch (error) {
            console.error(error);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Dialog.Root>
            <Dialog.Trigger asChild>
                <button
                    className="fixed top-4 right-4 z-[9999] p-2 bg-lab-black border border-signal-green text-signal-green rounded-md hover:bg-signal-green hover:text-lab-black transition-colors shadow-lg"
                    title="Open Debug Panel"
                >
                    <Menu size={20} />
                </button>
            </Dialog.Trigger>

            <Dialog.Portal>
                <Dialog.Content className="fixed top-0 right-0 h-screen w-80 bg-lab-black border-l border-signal-green/30 p-6 z-[10001] shadow-2xl focus:outline-none flex flex-col font-mono text-signal-green">
                    <div className="flex justify-between items-center mb-8 border-b border-signal-green/20 pb-4">
                        <Dialog.Title className="text-sm font-bold tracking-widest text-signal-amber">
                            LAB_DEBUG_OS_v1.0
                        </Dialog.Title>
                        <Dialog.Description className="sr-only">
                            Laboratory oversight and neural feed manipulation tools.
                        </Dialog.Description>
                        <Dialog.Close asChild>
                            <button className="p-1 hover:text-decay-red transition-colors">
                                <X size={20} />
                            </button>
                        </Dialog.Close>
                    </div>

                    <div className="space-y-8 overflow-y-auto pr-2 custom-scrollbar">
                        {/* Coherence Score Control */}
                        <section className="space-y-4">
                            <div className="flex justify-between text-[10px] tracking-tighter">
                                <span className="text-signal-green/60">COHERENCE_BIAS</span>
                                <span className="text-signal-amber">{score}%</span>
                            </div>
                            <Slider.Root
                                className="relative flex items-center select-none touch-none w-full h-5"
                                value={[score]}
                                onValueChange={(vals) => setScore(vals[0])}
                                max={100}
                                step={1}
                            >
                                <Slider.Track className="bg-lab-gray relative grow rounded-full h-[3px]">
                                    <Slider.Range className="absolute bg-signal-green rounded-full h-full" />
                                </Slider.Track>
                                <Slider.Thumb
                                    className="block w-4 h-4 bg-signal-green shadow-[0_0_10px_rgba(0,255,159,0.5)] rounded-[2px] hover:bg-white focus:outline-none"
                                    aria-label="Score"
                                />
                            </Slider.Root>
                            <div className="text-[10px] text-signal-green/40 italic">
                                STATE_RESULT: {state}
                            </div>
                        </section>

                        {/* Day Control */}
                        <section className="space-y-4">
                            <label className="text-[10px] text-signal-green/60 uppercase tracking-widest block">
                                Temporal_Anchor (Day)
                            </label>
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => setCurrentDay(Math.max(1, currentDay - 1))}
                                    className="p-1 border border-signal-green/30 hover:bg-signal-green/10"
                                >
                                    <ChevronDown size={16} />
                                </button>
                                <span className="text-xl font-bold text-signal-amber min-w-[2ch] text-center">
                                    {currentDay}
                                </span>
                                <button
                                    onClick={() => setCurrentDay(Math.min(30, currentDay + 1))}
                                    className="p-1 border border-signal-green/30 hover:bg-signal-green/10"
                                >
                                    <ChevronUp size={16} />
                                </button>
                                <button
                                    onClick={handleResetAuto}
                                    disabled={isProcessing}
                                    title="Reset to Automatic Progression"
                                    className="ml-auto p-1 border border-signal-green/30 hover:bg-signal-green/10 text-signal-green/60 hover:text-signal-green disabled:opacity-50"
                                >
                                    <RotateCcw size={16} />
                                </button>
                            </div>
                        </section>

                        {/* Time Machine */}
                        <section className="space-y-4 border-t border-signal-green/10 pt-6">
                            <div className="flex items-center gap-2 mb-2">
                                <Clock size={14} className="text-signal-amber" />
                                <label className="text-[10px] text-signal-green/60 uppercase tracking-widest">
                                    Time_Machine
                                </label>
                            </div>
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    value={mockHours}
                                    onChange={(e) => setMockHours(parseInt(e.target.value) || 0)}
                                    className="w-20 px-2 py-1 bg-lab-black border border-signal-green/30 text-xs focus:border-signal-green outline-none"
                                />
                                <button
                                    onClick={handleTimeMachine}
                                    disabled={isProcessing}
                                    className="flex-1 flex items-center justify-center gap-2 py-1 bg-signal-green text-lab-black text-[10px] font-bold hover:bg-white transition-colors disabled:opacity-50"
                                >
                                    <FastForward size={14} />
                                    SUBTRACT_HOURS
                                </button>
                            </div>
                            <p className="text-[9px] text-signal-green/40 leading-tight italic">
                                Simulates hours away to test narrative decay and day graduation.
                            </p>
                        </section>

                        {/* Visual Overrides */}
                        <section className="space-y-4 border-t border-signal-green/10 pt-6">
                            <div className="flex items-center justify-between">
                                <label className="text-[10px] text-signal-green/60 uppercase" htmlFor="scanlines-toggle">
                                    Scanline_Overlay
                                </label>
                                <Switch.Root
                                    className="w-[42px] h-[25px] bg-lab-gray rounded-full relative shadow-inner focus:outline-none data-[state=checked]:bg-signal-green transition-colors"
                                    id="scanlines-toggle"
                                    defaultChecked
                                >
                                    <Switch.Thumb className="block w-[21px] h-[21px] bg-white rounded-full transition-transform duration-100 translate-x-0.5 will-change-transform data-[state=checked]:translate-x-[19px]" />
                                </Switch.Root>
                            </div>

                            <div className="flex items-center justify-between">
                                <label className="text-[10px] text-signal-green/60 uppercase" htmlFor="glitch-toggle">
                                    Procedural_Glitch
                                </label>
                                <Switch.Root
                                    className="w-[42px] h-[25px] bg-lab-gray rounded-full relative shadow-inner focus:outline-none data-[state=checked]:bg-signal-green transition-colors"
                                    id="glitch-toggle"
                                    defaultChecked
                                >
                                    <Switch.Thumb className="block w-[21px] h-[21px] bg-white rounded-full transition-transform duration-100 translate-x-0.5 will-change-transform data-[state=checked]:translate-x-[19px]" />
                                </Switch.Root>
                            </div>
                        </section>
                    </div>

                    <div className="mt-auto pt-6 border-t border-signal-green/10 text-[9px] text-signal-green/30 flex flex-col gap-1">
                        <div>DEBUG_SESSION: ACTIVE</div>
                        <div>AUTH_UID: {authUser?.uid.slice(0, 12)}...</div>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};
