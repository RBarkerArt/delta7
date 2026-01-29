import React, { useState } from 'react';
import { Activity, X } from 'lucide-react';

interface SystemStatusModalProps {
    visible: boolean;
}

export const SystemStatusModal: React.FC<SystemStatusModalProps> = ({ visible }) => {
    const [isOpen, setIsOpen] = useState(false);

    if (!visible) return null;

    return (
        <div className={`fixed bottom-4 right-4 left-4 md:left-auto z-[9999] flex flex-col items-end gap-2 transition-all duration-500 ${isOpen ? 'translate-y-0' : 'translate-y-[calc(100%-48px)]'}`}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-4 py-3 bg-zinc-900 border border-emerald-900/40 rounded-xl text-emerald-500 hover:bg-zinc-800 transition-all font-mono text-xs tracking-widest uppercase shadow-2xl"
            >
                <Activity size={16} />
                System Status {isOpen ? '[CLOSE]' : '[OPEN]'}
            </button>

            <div className="w-full md:w-[90vw] md:max-w-4xl max-h-[85vh] overflow-y-auto bg-zinc-900 border border-emerald-900/40 rounded-2xl p-6 md:p-8 shadow-2xl backdrop-blur-md custom-scrollbar">
                <div className="flex items-start justify-between mb-6">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                        System_Status_Feed
                    </span>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                        <X size={14} />
                    </button>
                </div>

                {/* Headline */}
                <h2 className="text-emerald-500 font-mono text-sm tracking-wide leading-relaxed mb-4">
                    This System Persists Through Quiet Participation.
                </h2>

                {/* Subtitle */}
                <div className="space-y-1 mb-8 border-l-2 border-emerald-900/30 pl-4">
                    <p className="text-zinc-400 font-mono text-xs tracking-wide">Nothing here is required.</p>
                    <p className="text-zinc-400 font-mono text-xs tracking-wide">Nothing is withheld.</p>
                    <p className="text-zinc-400 font-mono text-xs tracking-wide">Some simply choose to help the signal continue.</p>
                </div>

                {/* Tier 1 */}
                <div className="mb-6 p-4 bg-zinc-800/50 rounded-xl border border-emerald-900/20">
                    <h3 className="text-emerald-500 font-mono text-xs uppercase tracking-widest mb-3">
                        A Moment of Holding
                    </h3>
                    <div className="space-y-2 mb-4">
                        <p className="text-zinc-400 font-mono text-xs leading-relaxed">
                            Sometimes all a system needs is a single breath of support.
                        </p>
                        <p className="text-zinc-400 font-mono text-xs leading-relaxed">
                            A small, one-time gesture that says, "I see this. I want it to continue."
                        </p>
                        <p className="text-zinc-400 font-mono text-xs leading-relaxed">
                            No commitment. No expectation. Just a moment of care.
                        </p>
                    </div>
                    <a
                        href="https://buy.stripe.com/4gMeVea4hgOe81feq6eIw02"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block py-2 px-4 bg-zinc-700 hover:bg-zinc-600 border border-emerald-900/30 rounded-lg text-emerald-500 font-mono text-xs tracking-widest uppercase transition-all hover:border-emerald-500/50"
                    >
                        [ Offer a Moment ]
                    </a>
                </div>

                {/* Tier 2 */}
                <div className="mb-6 p-4 bg-zinc-800/50 rounded-xl border border-emerald-900/20">
                    <h3 className="text-emerald-500 font-mono text-xs uppercase tracking-widest mb-3">
                        Those Who Keep Watch
                    </h3>
                    <div className="space-y-2 mb-4">
                        <p className="text-zinc-400 font-mono text-xs leading-relaxed">
                            A few choose to stand quietly in the background,
                        </p>
                        <p className="text-zinc-400 font-mono text-xs leading-relaxed">
                            not for recognition, not for reward,
                        </p>
                        <p className="text-zinc-400 font-mono text-xs leading-relaxed">
                            but because continuity matters to them.
                        </p>
                        <p className="text-zinc-400 font-mono text-xs leading-relaxed mt-2">
                            They help in small, steady ways —
                        </p>
                        <p className="text-zinc-400 font-mono text-xs leading-relaxed">
                            so the signal does not fade between days.
                        </p>
                    </div>
                    <a
                        href="https://buy.stripe.com/eVqcN6foB7dEa9neq6eIw01"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block py-2 px-4 bg-zinc-700 hover:bg-zinc-600 border border-emerald-900/30 rounded-lg text-emerald-500 font-mono text-xs tracking-widest uppercase transition-all hover:border-emerald-500/50"
                    >
                        [ Keep Watch ]
                    </a>
                </div>

                {/* Tier 3 */}
                <div className="mb-8 p-4 bg-zinc-800/50 rounded-xl border border-emerald-900/20">
                    <h3 className="text-emerald-500 font-mono text-xs uppercase tracking-widest mb-3">
                        The Ones Who Hold the Line
                    </h3>
                    <div className="space-y-2 mb-4">
                        <p className="text-zinc-400 font-mono text-xs leading-relaxed">
                            There are rare individuals who carry weight not meant to be seen.
                        </p>
                        <p className="text-zinc-400 font-mono text-xs leading-relaxed">
                            They do not gain access.
                        </p>
                        <p className="text-zinc-400 font-mono text-xs leading-relaxed">
                            They do not gain privilege.
                        </p>
                        <p className="text-zinc-400 font-mono text-xs leading-relaxed">
                            They simply choose to help bear the long-term cost of keeping something gentle alive in a hard world.
                        </p>
                    </div>
                    <a
                        href="https://buy.stripe.com/5kQfZi0tH55wchveq6eIw00"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block py-2 px-4 bg-zinc-700 hover:bg-zinc-600 border border-emerald-900/30 rounded-lg text-emerald-500 font-mono text-xs tracking-widest uppercase transition-all hover:border-emerald-500/50"
                    >
                        [ Hold the Line ]
                    </a>
                </div>

                {/* Ethical Grounding */}
                <div className="pt-6 border-t border-emerald-900/20">
                    <div className="space-y-2 text-zinc-500 font-mono text-[10px] italic leading-relaxed">
                        <p>This is not a transaction.</p>
                        <p>Nothing here is locked.</p>
                        <p>Nothing is withheld.</p>
                        <p>Nothing is made conditional.</p>
                        <p className="pt-2">The work continues regardless.</p>
                        <p>Support exists only so the work can continue at all.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
