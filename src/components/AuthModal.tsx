import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCoherence } from '../context/CoherenceContext';
import { X, Mail, Lock, Shield, ArrowRight } from 'lucide-react';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
    const { signInWithGoogle, signInWithEmail, signUpWithEmail, logout, setMigrationProgress } = useAuth();
    const { isAnchored, currentDay, score } = useCoherence();
    const [mode, setMode] = useState<'LOGIN' | 'SIGNUP'>('SIGNUP');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const mapError = (code: string) => {
        switch (code) {
            case 'auth/popup-closed-by-user':
            case 'auth/cancelled-popup-request':
                return 'SYNCHRONIZATION_INTERRUPTED_BY_WITNESS';
            case 'auth/popup-blocked':
                return 'SYNCHRONIZATION_PORT_BLOCKED';
            case 'auth/invalid-email':
                return 'IDENTIFIER_RECOGNITION_ERROR';
            case 'auth/user-not-found':
            case 'auth/wrong-password':
            case 'auth/invalid-credential':
                return 'LINK_ESTABLISHMENT_DENIED';
            case 'auth/email-already-in-use':
                return 'IDENTIFIER_COLLISION_DETECTED';
            case 'auth/weak-password':
                return 'INSUFFICIENT_SECURITY_SEQUENCE';
            default:
                return 'PROTOCOL_SYNC_FAILURE';
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            if (mode === 'LOGIN') {
                await signInWithEmail(email, password);
            } else {
                await signUpWithEmail(email, password);
            }
            onClose();
        } catch (err: any) {
            setError(mapError(err.code || 'unknown'));
        } finally {
            setLoading(false);
        }
    };

    const handleGoogle = async () => {
        setLoading(true);
        setError(null);
        try {
            await signInWithGoogle(() => {
                // CAPTURE STATE: Allow capture of values from CoherenceContext before redirect
                setMigrationProgress(currentDay, score);
            });
            onClose();
        } catch (err: any) {
            // Only show error if it's not a simple cancellation, or show the specialized interrupted message
            setError(mapError(err.code || 'unknown'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />

            <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 p-8 shadow-2xl animate-in zoom-in-95 duration-300">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-zinc-500 hover:text-emerald-500 transition-colors"
                >
                    <X size={20} />
                </button>

                <div className="space-y-6">
                    <div className="space-y-2 text-center">
                        <div className="flex justify-center mb-4 text-emerald-500">
                            <Shield size={32} />
                        </div>
                        <h2 className="text-emerald-500 font-mono text-xs font-bold tracking-[0.3em] uppercase">
                            Anchor_Synchronization
                        </h2>
                        <div className="h-px bg-zinc-800 w-full" />
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest pl-1">
                                [Neural_Index_Email]
                            </label>
                            <div className="relative group">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-emerald-500 transition-colors" size={16} />
                                <input
                                    type="email"
                                    required
                                    autoComplete="email"
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-none pl-10 pr-4 py-3 text-zinc-300 font-mono text-sm focus:outline-none focus:border-emerald-500 transition-all"
                                    placeholder="Enter identifier..."
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest pl-1">
                                [Crypt_Key_Password]
                            </label>
                            <div className="relative group">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-emerald-500 transition-colors" size={16} />
                                <input
                                    type="password"
                                    required
                                    autoComplete={mode === 'LOGIN' ? 'current-password' : 'new-password'}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-none pl-10 pr-4 py-3 text-zinc-300 font-mono text-sm focus:outline-none focus:border-emerald-500 transition-all"
                                    placeholder="Enter sequence..."
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="text-[10px] font-mono text-red-500/80 bg-red-500/5 p-2 border border-red-500/20">
                                SIGNAL_ERROR: {error.toUpperCase()}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold py-4 uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
                        >
                            {loading ? (
                                <span className="animate-pulse">Processing...</span>
                            ) : (
                                <>
                                    {mode === 'LOGIN' ? 'Initiate_Session' : 'Establish_Anchor'}
                                    <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="flex items-center gap-4 py-2">
                        <div className="h-px flex-1 bg-zinc-800" />
                        <span className="text-[10px] font-mono text-zinc-600 font-bold uppercase">Alternate_Protocol</span>
                        <div className="h-px flex-1 bg-zinc-800" />
                    </div>

                    <button
                        onClick={handleGoogle}
                        className="w-full border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 font-mono text-xs py-3 uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                    >
                        Merge_via_Google
                    </button>

                    <div className="pt-4 text-center">
                        <button
                            onClick={() => setMode(mode === 'LOGIN' ? 'SIGNUP' : 'LOGIN')}
                            className="text-[10px] font-mono text-zinc-500 hover:text-emerald-500 uppercase tracking-widest transition-colors"
                        >
                            {mode === 'LOGIN' ? '[Request_New_Induction]' : '[Access_Existing_Stream]'}
                        </button>
                    </div>
                </div>

                {isAnchored && (
                    <div className="absolute inset-0 bg-zinc-900 border border-zinc-800 p-8 flex flex-col items-center justify-center text-center space-y-8 animate-in fade-in duration-500">
                        <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                            <Shield size={32} />
                        </div>

                        <div className="space-y-4 max-w-xs">
                            <h2 className="text-emerald-500 font-mono text-xs font-bold tracking-[0.3em] uppercase">
                                Identity_Synchronized
                            </h2>
                            <div className="space-y-2">
                                <p className="text-[11px] font-mono text-zinc-300 leading-relaxed">
                                    "The anchor does not change what appears. It allows the system to recover more gently."
                                </p>
                                <p className="text-[10px] font-mono text-emerald-500/60 uppercase italic tracking-wider">
                                    [STATION_RECOVERY_ENHANCED]
                                </p>
                            </div>
                        </div>

                        <div className="w-full h-px bg-zinc-800" />

                        <div className="w-full space-y-4">
                            <button
                                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold py-4 uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 group"
                            >
                                Maintain The Anchor - $3/Month
                            </button>

                            <div className="flex flex-col gap-3">
                                <button className="text-[10px] font-mono text-zinc-400 hover:text-emerald-400 uppercase tracking-widest transition-colors">
                                    Manage Your Anchor
                                </button>
                                <button
                                    onClick={async () => {
                                        await logout();
                                        onClose();
                                    }}
                                    className="text-[10px] font-mono text-zinc-500 hover:text-red-400 uppercase tracking-widest transition-colors"
                                >
                                    Disengage Anchor
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="mt-8 border-t border-zinc-800 pt-4 opacity-30 select-none">
                    <p className="text-[10px] font-mono text-zinc-600 leading-tight">
                        SYSTEM://ID_SYNC_PROTOCOL_V4.1<br />
                        COHERENCE_REQUIRED: TRUE<br />
                        BY_SIGNING_IN_YOU_ACKNOWLEDGE_WITNESS_RESPONSIBILITY
                    </p>
                </div>
            </div>
        </div>
    );
};
