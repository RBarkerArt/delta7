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
        } catch (err: any) {
            setError(err.message || 'Signal lost. Frequency invalid.');
        }
    };

    return (
        <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[10000] animate-fade-in" />
                <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-black border-2 border-emerald-900/50 p-8 rounded-none shadow-[0_0_50px_rgba(16,185,129,0.1)] z-[10001] focus:outline-none animate-scale-in font-mono">

                    <Dialog.Title className="text-xl text-emerald-500 uppercase tracking-widest flex items-center gap-3 mb-6">
                        <Radio size={20} className={isAuthorizing ? "animate-pulse" : ""} />
                        Signal_Tuning
                    </Dialog.Title>

                    <Dialog.Description className="text-[10px] text-emerald-900/50 uppercase tracking-widest font-mono mb-6 sr-only">
                        Enter a frequency code to recover an existing session.
                    </Dialog.Description>

                    {success ? (
                        <div className="text-center space-y-4 py-8">
                            <RefreshCw size={48} className="mx-auto text-emerald-500 animate-spin" />
                            <p className="text-emerald-500 tracking-widest uppercase text-sm">Signal Locked. Realigning...</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] text-zinc-500 uppercase tracking-widest block">
                                    Input_Frequency (XXX-XXX)
                                </label>
                                <input
                                    type="text"
                                    value={code}
                                    onChange={handleInput}
                                    placeholder="___-___"
                                    className="w-full bg-black border border-emerald-900 text-emerald-500 text-center text-3xl font-bold py-4 tracking-widest focus:outline-none focus:border-emerald-500 transition-colors uppercase placeholder:text-emerald-900/30"
                                    autoFocus
                                />
                            </div>

                            {error && (
                                <div className="flex items-center gap-2 text-red-500 text-xs border border-red-900/30 bg-red-900/10 p-3">
                                    <AlertTriangle size={12} />
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={code.length < 7 || isAuthorizing}
                                className="w-full py-4 bg-emerald-900/20 border border-emerald-900/50 hover:bg-emerald-500/20 hover:border-emerald-500 text-emerald-500 uppercase tracking-widest text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden"
                            >
                                {isAuthorizing ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <Loader size={12} className="animate-spin" /> Tuning...
                                    </span>
                                ) : (
                                    <span className="group-hover:tracking-[0.3em] transition-all duration-300"> establish_uplink </span>
                                )}
                            </button>
                        </form>
                    )}

                    <Dialog.Close asChild>
                        <button className="absolute top-4 right-4 text-emerald-900 hover:text-emerald-500 transition-colors">
                            <X size={20} />
                        </button>
                    </Dialog.Close>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};
