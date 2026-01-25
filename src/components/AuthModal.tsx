import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useAuth } from '../hooks/useAuth';
import { useCoherence } from '../hooks/useCoherence';
import { X, Lock, Shield, ArrowRight, AlertTriangle } from 'lucide-react';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
    const { login, signup, loginWithGoogle, anchorIdentity, logout, user, isAuthorizing } = useAuth();
    // Use centralized anchoring logic which correctly handles Access Codes (Custom Tokens)
    const { isAnchored } = useCoherence();

    const [mode, setMode] = useState<'login' | 'signup'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);

    const isAnonymous = user?.isAnonymous;
    const title = isAnonymous && mode === 'signup' ? 'ANCHOR IDENTITY' : (mode === 'login' ? 'AUTHENTICATE' : 'INITIALIZE');
    const submitText = isAnonymous && mode === 'signup' ? 'ESTABLISH ANCHOR' : (mode === 'login' ? 'ACCESS' : 'REGISTER');

    // ... handlers ...

    // FIX: Rely on centralized 'isAnchored' to determine UI state, NOT just !user.isAnonymous
    const showAnchoredState = user && isAnchored;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        try {
            if (mode === 'login') {
                await login(email, password);
            } else {
                if (isAnonymous) {
                    // Anchor Mode: Link existing anon session
                    await anchorIdentity('email', { email, password });
                } else {
                    // Standard Signup
                    await signup(email, password);
                }
            }
            onClose();
        } catch (err: any) {
            setError(err.message || 'Authentication failed');
        }
    };

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
            setError(err.message || 'Google Auth failed');
        }
    };

    const handleLogout = async () => {
        setError(null);
        try {
            await logout();
            onClose();
        } catch (err: unknown) {
            setError((err as Error).message);
        }
    };

    return (
        <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-lab-black/80 backdrop-blur-md z-[10000] animate-fade-in" />
                <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-zinc-900 border border-emerald-900/30 p-8 rounded-2xl shadow-2xl z-[10001] focus:outline-none animate-scale-in">
                    <Dialog.Title className="text-2xl font-bold text-zinc-100 flex items-center gap-3">
                        <Lock className="text-emerald-500" size={24} />
                        {title}
                    </Dialog.Title>
                    <Dialog.Description className="mt-4 text-zinc-400 font-mono text-sm leading-relaxed">
                        Anchor your current observation metrics to a persistent identity.
                        This ensures data integrity across terminal sessions.
                    </Dialog.Description>

                    <div className="mt-8 space-y-6">
                        {error && (
                            <div className="p-4 bg-red-900/10 border border-red-900/30 rounded-xl flex items-center gap-3 text-red-500 text-sm">
                                <AlertTriangle size={18} className="shrink-0" />
                                <p>{error}</p>
                            </div>
                        )}

                        {showAnchoredState ? (
                            <div className="p-6 bg-emerald-900/10 border border-emerald-900/20 rounded-xl text-center space-y-4 text-emerald-500 font-mono text-[10px] tracking-widest uppercase">
                                <Shield className="mx-auto" size={48} />
                                <div>
                                    <p className="text-zinc-100 font-bold normal-case text-base tracking-normal">Identity Anchored</p>
                                    <p className="text-emerald-500/70 mt-1 truncate">{user.email}</p>
                                </div>
                                <div className="space-y-2 pt-2">
                                    <button
                                        onClick={onClose}
                                        className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition-colors font-bold"
                                    >
                                        Return to Feed
                                    </button>
                                    <button
                                        onClick={handleLogout}
                                        disabled={isAuthorizing}
                                        className="w-full py-2.5 text-red-500/70 hover:text-red-500 hover:bg-red-500/5 rounded-xl transition-all border border-transparent hover:border-red-500/10"
                                    >
                                        Unlink Account
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <button
                                    onClick={handleGoogleLogin}
                                    disabled={isAuthorizing}
                                    className="w-full flex items-center justify-between p-4 bg-white hover:bg-zinc-100 text-zinc-900 rounded-xl transition-all group disabled:opacity-50"
                                >
                                    <div className="flex items-center gap-3 font-bold">
                                        <div className="w-6 h-6 flex items-center justify-center">
                                            <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /><path d="M1 1h22v22H1z" fill="none" /></svg>
                                        </div>
                                        <span>Link Google Account</span>
                                    </div>
                                    <ArrowRight size={18} className="text-zinc-400 group-hover:translate-x-1 transition-transform" />
                                </button>

                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center">
                                        <div className="w-full border-t border-emerald-900/10"></div>
                                    </div>
                                    <div className="relative flex justify-center text-[8px] uppercase tracking-[0.2em] font-mono">
                                        <span className="bg-zinc-900 px-2 text-zinc-600">OR</span>
                                    </div>
                                </div>

                                <form onSubmit={handleSubmit} className="space-y-3">
                                    <div className="space-y-1">
                                        <input
                                            type="email"
                                            placeholder="TERMINAL_EMAIL"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            required
                                            className="w-full bg-zinc-950/50 border border-emerald-900/20 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/30 transition-colors font-mono"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <input
                                            type="password"
                                            placeholder="ACCESS_CODE"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                            className="w-full bg-zinc-950/50 border border-emerald-900/20 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/30 transition-colors font-mono"
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={isAuthorizing}
                                        className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-lab-black rounded-xl transition-all font-bold disabled:opacity-50"
                                    >
                                        {submitText}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                                        className="w-full text-[10px] text-zinc-500 hover:text-emerald-500/70 font-mono uppercase tracking-widest transition-colors py-1"
                                    >
                                        {mode === 'login' ? 'New Observer? Create Identity Anchor' : 'Already anchored? Signal Login'}
                                    </button>
                                </form>
                            </div>
                        )}
                    </div>

                    <Dialog.Close asChild>
                        <button className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-zinc-100 transition-colors">
                            <X size={20} />
                        </button>
                    </Dialog.Close>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};
