import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useAuth } from '../hooks/useAuth';
import { useCoherence } from '../hooks/useCoherence';
import { X, Lock, Shield, ArrowRight, AlertTriangle } from 'lucide-react';
import { GlitchText } from './GlitchText';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
    const { login, signup, loginWithGoogle, anchorIdentity, logout, user, isAuthorizing } = useAuth();
    const { isAnchored } = useCoherence();

    const [mode, setMode] = useState<'login' | 'signup'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);

    const isAnonymous = user?.isAnonymous;
    const title = isAnonymous && mode === 'signup' ? 'ANCHOR IDENTITY' : (mode === 'login' ? 'AUTHENTICATE' : 'INITIALIZE');
    const submitText = isAnonymous && mode === 'signup' ? 'ESTABLISH ANCHOR' : (mode === 'login' ? 'ACCESS' : 'REGISTER');

    const handleGoogleLogin = async () => {
        setError(null);
        try {
            if (isAnonymous) {
                await anchorIdentity('google');
            } else {
                await loginWithGoogle();
            }
            onClose();
        } catch (err: any) {
            setError(err.message || 'Authentication failed');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        try {
            if (isAnonymous && mode === 'signup') {
                await anchorIdentity('email', { email, password });
            } else if (mode === 'login') {
                await login(email, password);
            } else {
                await signup(email, password);
            }
            onClose();
        } catch (err: any) {
            setError(err.message || 'Authentication failed');
        }
    };

    const handleLogout = async () => {
        await logout();
        onClose();
    };

    const showAnchoredState = user && isAnchored;

    return (
        <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-lab-black/80 backdrop-blur-md z-[10000] animate-fade-in" />
                <Dialog.Content className="fixed left-[50%] top-[50%] z-[10001] w-[90vw] max-w-md -translate-x-[50%] -translate-y-[50%] focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] duration-300">
                    <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-lab-black shadow-2xl">
                        {/* Scanline Overlay */}
                        <div className="pointer-events-none absolute inset-0 z-10 bg-scanlines opacity-[0.03]" />

                        <div className="relative z-20 p-8 pt-10">
                            <Dialog.Title className="flex items-center gap-4 font-mono text-2xl font-bold tracking-tighter text-emerald-500">
                                <Lock className="animate-pulse text-emerald-400" size={28} />
                                <GlitchText text={title} coherenceScore={100} />
                            </Dialog.Title>

                            <Dialog.Description className="mt-6 font-mono text-[11px] leading-relaxed tracking-widest text-white/60 uppercase">
                                [Inducting_Observation_Anchor]<br />
                                Establishing persistent temporal link to secure metrics across terminal sessions.
                            </Dialog.Description>

                            <div className="mt-10 space-y-8">
                                {error && (
                                    <div className="flex items-center gap-4 rounded-lg border border-red-500/20 bg-red-500/5 p-4 font-mono text-[10px] tracking-widest text-red-500 uppercase animate-in fade-in slide-in-from-top-1">
                                        <AlertTriangle size={18} className="shrink-0" />
                                        <p>{error}</p>
                                    </div>
                                )}

                                {showAnchoredState ? (
                                    <div className="flex flex-col items-center gap-6 rounded-xl border border-emerald-500/10 bg-emerald-500/5 p-8 text-center font-mono">
                                        <div className="relative">
                                            <Shield size={64} className="text-emerald-500 drop-shadow-[0_0_15px_rgba(16,185,129,0.4)]" />
                                            <div className="absolute inset-0 animate-ping rounded-full border border-emerald-500/20" />
                                        </div>

                                        <div className="space-y-2">
                                            <p className="text-sm font-bold tracking-widest text-white uppercase">Identity_Anchored</p>
                                            <p className="text-[10px] tracking-widest text-white/60 truncate max-w-[200px] mx-auto">{user?.email}</p>
                                        </div>

                                        <div className="w-full space-y-3 pt-4">
                                            <button
                                                onClick={onClose}
                                                className="w-full rounded-md border border-white/20 bg-white/5 py-3 text-xs font-bold tracking-widest text-white transition-all hover:bg-white/10 uppercase"
                                            >
                                                Return_to_Induction
                                            </button>
                                            <button
                                                onClick={handleLogout}
                                                disabled={isAuthorizing}
                                                className="w-full py-2 text-[9px] font-bold tracking-[0.3em] text-red-500/50 hover:text-red-500 transition-colors uppercase"
                                            >
                                                Unlink_Anchor
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-8">
                                        <button
                                            onClick={handleGoogleLogin}
                                            disabled={isAuthorizing}
                                            className="group flex w-full items-center justify-between rounded-md border border-white/10 bg-white/5 p-4 transition-all hover:bg-white/10 disabled:opacity-50"
                                        >
                                            <div className="flex items-center gap-4 font-mono text-[10px] font-bold tracking-widest text-white uppercase">
                                                <svg viewBox="0 0 24 24" width="18" height="18" className="opacity-70 group-hover:opacity-100 transition-opacity" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="currentColor" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="currentColor" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="currentColor" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="currentColor" /></svg>
                                                <span>Anchor via Google</span>
                                            </div>
                                            <ArrowRight size={16} className="text-white/40 group-hover:text-white group-hover:translate-x-1 transition-all" />
                                        </button>

                                        <div className="relative">
                                            <div className="absolute inset-0 flex items-center">
                                                <div className="w-full border-t border-white/5"></div>
                                            </div>
                                            <div className="relative flex justify-center font-mono text-[8px] uppercase tracking-[0.3em]">
                                                <span className="bg-lab-black px-3 text-white/30">Alternate_Entry</span>
                                            </div>
                                        </div>

                                        <form onSubmit={handleSubmit} className="space-y-6">
                                            <div className="space-y-2">
                                                <label className="block font-mono text-[10px] tracking-[0.3em] text-white/40 uppercase ml-1">
                                                    Observer_Identifier
                                                </label>
                                                <input
                                                    type="email"
                                                    placeholder="EMAIL_ADDRESS"
                                                    value={email}
                                                    onChange={(e) => setEmail(e.target.value)}
                                                    required
                                                    className="w-full rounded-md border border-white/20 bg-lab-black px-4 py-3 font-mono text-[12px] tracking-widest text-white placeholder:text-white/20 focus:border-white/40 focus:outline-none transition-colors"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="block font-mono text-[10px] tracking-[0.3em] text-white/40 uppercase ml-1">
                                                    Encryption_Key
                                                </label>
                                                <input
                                                    type="password"
                                                    placeholder="PASSWORD"
                                                    value={password}
                                                    onChange={(e) => setPassword(e.target.value)}
                                                    required
                                                    className="w-full rounded-md border border-white/20 bg-lab-black px-4 py-3 font-mono text-[12px] tracking-widest text-white placeholder:text-white/20 focus:border-white/40 focus:outline-none transition-colors"
                                                />
                                            </div>
                                            <button
                                                type="submit"
                                                disabled={isAuthorizing}
                                                className="w-full rounded-md bg-white/5 border border-white/20 py-4 text-xs font-bold tracking-[0.2em] text-white transition-all hover:bg-white/10 disabled:opacity-50 uppercase shadow-[0_0_15px_rgba(255,255,255,0.05)] hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                                            >
                                                {submitText}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                                                className="w-full py-2 font-mono text-[9px] font-medium tracking-[0.25em] text-white/40 hover:text-white transition-colors uppercase"
                                            >
                                                {mode === 'login' ? '-> Enter_Induction_Phase' : '-> Re-establish_Signal'}
                                            </button>
                                        </form>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <Dialog.Close asChild>
                        <button className="absolute top-6 right-6 p-2 text-white/40 hover:text-white transition-colors z-[10002]">
                            <X size={20} />
                        </button>
                    </Dialog.Close>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};
