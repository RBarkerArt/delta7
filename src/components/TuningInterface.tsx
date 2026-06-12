import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useAuth } from '../hooks/useAuth';
import { Radio, Loader, RefreshCw, X, AlertTriangle } from 'lucide-react';

interface TuningInterfaceProps {
    isOpen: boolean;
    onClose: () => void;
}

export const TuningInterface: React.FC<TuningInterfaceProps> = ({ isOpen, onClose }) => {
    const { recoverSession, isAuthorizing } = useAuth();
    const [code, setCode] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Format code: XXX-XXX
    const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
        if (val.length > 3 && val.charAt(3) !== '-') {
            val = val.slice(0, 3) + '-' + val.slice(3);
        }
        if (val.length > 7) val = val.slice(0, 7);
        setCode(val);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        try {
            await recoverSession(code);
            setSuccess(true);
            setTimeout(() => {
                window.location.reload(); // Hard reload to ensure clean session state
            }, 1500);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Signal lost. Frequency invalid.');
        }
    };

    return (
        <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-[12000] bg-black/70 backdrop-blur-[3px] animate-fade-in" />
                <Dialog.Content className="fixed left-1/2 top-3 z-[12001] flex max-h-[calc(100dvh-1.5rem)] w-[calc(100vw-1.5rem)] max-w-sm -translate-x-1/2 flex-col overflow-hidden border border-[#f2ead0]/20 bg-[#1b1a15]/95 font-mono shadow-[0_24px_80px_rgba(0,0,0,0.72)] focus:outline-none animate-scale-in sm:top-1/2 sm:-translate-y-1/2">
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_0%,rgba(255,247,223,0.10),transparent_42%),linear-gradient(135deg,rgba(16,185,129,0.07),transparent_48%)]" />

                    <div className="relative shrink-0 flex items-start justify-between gap-4 border-b border-[#f2ead0]/20 bg-black/20 px-5 py-4">
                        <div className="min-w-0">
                            <div className="mb-1 text-[10px] uppercase tracking-[0.22em] text-emerald-100/70">
                                Security Box
                            </div>
                            <Dialog.Title className="flex items-center gap-3 text-base font-semibold uppercase tracking-[0.14em] text-[#fff7df]">
                                <Radio size={18} className={isAuthorizing ? "animate-pulse text-emerald-100" : "text-emerald-100/80"} />
                                Signal Tuning
                            </Dialog.Title>
                        </div>
                        <Dialog.Close asChild>
                            <button
                                className="shrink-0 border border-[#f2ead0]/20 bg-black/30 p-2 text-[#f7f1dc]/75 transition-colors hover:border-emerald-100/40 hover:text-[#fff7df]"
                                aria-label="Close tuning panel"
                            >
                                <X size={15} />
                            </button>
                        </Dialog.Close>
                    </div>

                    <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 custom-scrollbar">
                        <Dialog.Description className="mb-6 text-[13px] leading-relaxed tracking-wide text-[#f7f1dc]">
                            Your frequency code is an anonymous recovery key. Use it on another browser or device to restore the same observation record.
                        </Dialog.Description>

                        {success ? (
                            <div className="space-y-4 py-8 text-center">
                                <RefreshCw size={44} className="mx-auto animate-spin text-emerald-100" />
                                <p className="text-sm uppercase tracking-[0.2em] text-[#fff7df]">Signal locked. Realigning...</p>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="block text-[10px] uppercase tracking-[0.22em] text-emerald-100/70">
                                        Recovery Frequency (XXX-XXX)
                                    </label>
                                    <input
                                        type="text"
                                        value={code}
                                        onChange={handleInput}
                                        placeholder="___-___"
                                        className="w-full border border-[#f2ead0]/20 bg-black/40 py-4 text-center text-3xl font-bold uppercase tracking-widest text-[#fff7df] placeholder:text-[#f7f1dc]/25 transition-colors focus:border-emerald-100/60 focus:bg-black/50 focus:outline-none"
                                        autoFocus
                                    />
                                </div>

                                {error && (
                                    <div className="flex items-center gap-2 border border-red-300/30 bg-red-950/30 p-3 text-xs leading-relaxed text-red-100">
                                        <AlertTriangle size={13} className="shrink-0 text-red-200" />
                                        {error}
                                    </div>
                                )}

                                <p className="text-[10px] leading-relaxed tracking-wide text-[#f7f1dc]/70">
                                    Same device recovery happens automatically. This tuner is only needed when the room no longer recognizes your local record.
                                </p>

                                <button
                                    type="submit"
                                    disabled={code.length < 7 || isAuthorizing}
                                    className="group relative w-full overflow-hidden border border-emerald-100/40 bg-emerald-100/10 py-4 text-xs uppercase tracking-[0.2em] text-[#fff7df] transition-all hover:border-emerald-50/70 hover:bg-emerald-100/20 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {isAuthorizing ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <Loader size={12} className="animate-spin" /> Tuning...
                                        </span>
                                    ) : (
                                        <span className="transition-all duration-300 group-hover:tracking-[0.28em]">Restore Record</span>
                                    )}
                                </button>
                            </form>
                        )}
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};
