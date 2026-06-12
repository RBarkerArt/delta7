import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useAuth } from '../hooks/useAuth';
import { useCoherence } from '../hooks/useCoherence';
import { X, Lock, Shield, ArrowRight, AlertTriangle } from 'lucide-react';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const getAuthErrorMessage = (err: unknown) => {
    return err instanceof Error && err.message ? err.message : 'Authentication failed';
};

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
    const { login, signup, loginWithGoogle, anchorIdentity, logout, user, isAuthorizing } = useAuth();
    const { isAnchored } = useCoherence();
    const isAnonymous = user?.isAnonymous;

    const [mode, setMode] = useState<'login' | 'signup'>(isAnonymous ? 'signup' : 'login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);

    const title = isAnonymous && mode === 'signup' ? 'Anchor Record' : (mode === 'login' ? 'Restore Anchor' : 'Initialize Anchor');
    const submitText = isAnonymous && mode === 'signup' ? 'Establish Anchor' : (mode === 'login' ? 'Access Record' : 'Create Anchor');
    const description = isAnonymous && mode === 'signup'
        ? 'Connect this anonymous observation record to an email or Google account. The frequency key remains available as a fallback.'
        : 'Access an anchored observer record and restore its recovered prologues, fragments, logs, and evidence.';

    const handleGoogleLogin = async () => {
        setError(null);
        try {
            if (isAnonymous) {
                await anchorIdentity('google');
            } else {
                await loginWithGoogle();
            }
            onClose();
        } catch (err: unknown) {
            setError(getAuthErrorMessage(err));
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
        } catch (err: unknown) {
            setError(getAuthErrorMessage(err));
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
                <Dialog.Overlay className="fixed inset-0 z-[12000] bg-black/70 backdrop-blur-[3px] animate-fade-in" />
                <Dialog.Content className="fixed left-1/2 top-3 z-[12001] flex max-h-[calc(100dvh-1.5rem)] w-[calc(100vw-1.5rem)] max-w-md -translate-x-1/2 flex-col overflow-hidden border border-[#f2ead0]/20 bg-[#1b1a15]/95 font-mono shadow-[0_24px_80px_rgba(0,0,0,0.72)] focus:outline-none data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-300 sm:top-1/2 sm:-translate-y-1/2">
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_0%,rgba(255,247,223,0.10),transparent_42%),linear-gradient(135deg,rgba(16,185,129,0.07),transparent_48%)]" />

                    <div className="relative shrink-0 flex items-start justify-between gap-4 border-b border-[#f2ead0]/20 bg-black/20 px-5 py-4 sm:px-6">
                        <div className="min-w-0">
                            <div className="mb-1 text-[10px] uppercase tracking-[0.22em] text-emerald-100/70">
                                Observer File
                            </div>
                            <Dialog.Title className="flex items-center gap-3 text-base font-semibold uppercase tracking-[0.14em] text-[#fff7df]">
                                <Lock size={18} className="text-emerald-100/80" />
                                {title}
                            </Dialog.Title>
                        </div>
                        <Dialog.Close asChild>
                            <button
                                className="shrink-0 border border-[#f2ead0]/20 bg-black/30 p-2 text-[#f7f1dc]/75 transition-colors hover:border-emerald-100/40 hover:text-[#fff7df]"
                                aria-label="Close authentication panel"
                            >
                                <X size={15} />
                            </button>
                        </Dialog.Close>
                    </div>

                    <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 text-[#f7f1dc] custom-scrollbar sm:px-6">
                        <Dialog.Description className="text-[13px] leading-relaxed tracking-wide text-[#f7f1dc]">
                            {description}
                        </Dialog.Description>

                        <div className="mt-6 space-y-6">
                            {error && (
                                <div className="flex items-center gap-3 border border-red-300/30 bg-red-950/30 p-3 text-xs leading-relaxed text-red-100 animate-in fade-in slide-in-from-top-1">
                                    <AlertTriangle size={15} className="shrink-0 text-red-200" />
                                    <p>{error}</p>
                                </div>
                            )}

                            {showAnchoredState ? (
                                <div className="flex flex-col items-center gap-6 border border-emerald-100/25 bg-emerald-100/10 p-6 text-center">
                                    <div className="relative">
                                        <Shield size={56} className="text-emerald-100 drop-shadow-[0_0_18px_rgba(16,185,129,0.35)]" />
                                        <div className="absolute inset-0 animate-ping rounded-full border border-emerald-100/20" />
                                    </div>

                                    <div className="space-y-2">
                                        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#fff7df]">Identity Anchored</p>
                                        <p className="mx-auto max-w-[240px] truncate text-[11px] tracking-wide text-[#f7f1dc]/75">
                                            {user?.email || 'Anchored observer record active'}
                                        </p>
                                    </div>

                                    <div className="w-full space-y-3 pt-2">
                                        <button
                                            onClick={onClose}
                                            className="w-full border border-[#f2ead0]/20 bg-black/30 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#fff7df] transition-all hover:border-emerald-100/40 hover:bg-emerald-100/10"
                                        >
                                            Return to Room
                                        </button>
                                        <button
                                            onClick={handleLogout}
                                            disabled={isAuthorizing}
                                            className="w-full py-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-red-100/60 transition-colors hover:text-red-100 disabled:opacity-50"
                                        >
                                            Unlink Anchor
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <button
                                        onClick={handleGoogleLogin}
                                        disabled={isAuthorizing}
                                        className="group flex w-full items-center justify-between border border-[#f2ead0]/20 bg-black/30 p-4 transition-all hover:border-emerald-100/40 hover:bg-emerald-100/10 disabled:opacity-50"
                                    >
                                        <div className="flex items-center gap-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#fff7df]">
                                            <svg viewBox="0 0 24 24" width="18" height="18" className="text-[#f7f1dc]/75 transition-colors group-hover:text-[#fff7df]" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="currentColor" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="currentColor" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="currentColor" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="currentColor" /></svg>
                                            <span>Anchor via Google</span>
                                        </div>
                                        <ArrowRight size={16} className="text-[#f7f1dc]/50 transition-all group-hover:translate-x-1 group-hover:text-[#fff7df]" />
                                    </button>

                                    <div className="relative">
                                        <div className="absolute inset-0 flex items-center">
                                            <div className="w-full border-t border-[#f2ead0]/10" />
                                        </div>
                                        <div className="relative flex justify-center text-[9px] uppercase tracking-[0.22em]">
                                            <span className="bg-[#1b1a15] px-3 text-emerald-100/60">Email Anchor</span>
                                        </div>
                                    </div>

                                    <form onSubmit={handleSubmit} className="space-y-5">
                                        <div className="space-y-2">
                                            <label className="ml-1 block text-[10px] uppercase tracking-[0.22em] text-emerald-100/70">
                                                Observer Identifier
                                            </label>
                                            <input
                                                type="email"
                                                placeholder="email address"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                required
                                                className="w-full border border-[#f2ead0]/20 bg-black/40 px-4 py-3 text-[13px] tracking-wide text-[#fff7df] placeholder:text-[#f7f1dc]/30 transition-colors focus:border-emerald-100/60 focus:bg-black/50 focus:outline-none"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="ml-1 block text-[10px] uppercase tracking-[0.22em] text-emerald-100/70">
                                                Encryption Key
                                            </label>
                                            <input
                                                type="password"
                                                placeholder="password"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                required
                                                className="w-full border border-[#f2ead0]/20 bg-black/40 px-4 py-3 text-[13px] tracking-wide text-[#fff7df] placeholder:text-[#f7f1dc]/30 transition-colors focus:border-emerald-100/60 focus:bg-black/50 focus:outline-none"
                                            />
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={isAuthorizing}
                                            className="w-full border border-emerald-100/40 bg-emerald-100/10 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#fff7df] shadow-[0_0_20px_rgba(16,185,129,0.08)] transition-all hover:border-emerald-50/70 hover:bg-emerald-100/20 disabled:opacity-50"
                                        >
                                            {submitText}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                                            className="w-full py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#f7f1dc]/60 transition-colors hover:text-[#fff7df]"
                                        >
                                            {mode === 'login' ? 'Create Anchored Record' : 'Return to Sign In'}
                                        </button>
                                    </form>
                                </div>
                            )}
                        </div>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};
