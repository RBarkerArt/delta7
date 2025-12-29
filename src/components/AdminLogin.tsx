import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Navigate } from 'react-router-dom';
import { LogIn, Mail, Lock, Chrome, ShieldAlert } from 'lucide-react';

export const AdminLogin: React.FC = () => {
    const { user, isAdmin, signInWithGoogle } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    if (user && isAdmin) {
        return <Navigate to="/admin" replace />;
    }

    const handleGoogleSignIn = async () => {
        try {
            await signInWithGoogle();
            navigate('/admin');
        } catch (err: any) {
            setError(err.message);
        }
    };

    return (
        <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md space-y-8">
                <div className="text-center space-y-2 mb-2 md:mb-8">
                    <div className="inline-flex items-center justify-center p-2 md:p-3 bg-emerald-500/10 rounded-xl mb-2 md:mb-4 border border-emerald-500/20">
                        <ShieldAlert className="w-6 h-6 md:w-8 md:h-8 text-emerald-400" />
                    </div>
                    <h1 className="text-2xl md:text-3xl font-bold text-zinc-100 tracking-tight px-4">Delta-7 System Access</h1>
                    <p className="text-zinc-500 text-[10px] md:text-sm uppercase tracking-widest font-mono">Authorized Administrative Personnel Only</p>
                </div>

                <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 backdrop-blur-sm">
                    {error && (
                        <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs flex items-center gap-2">
                            <ShieldAlert size={14} />
                            {error}
                        </div>
                    )}

                    <div className="space-y-6">
                        <button
                            onClick={handleGoogleSignIn}
                            className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white hover:bg-zinc-100 text-zinc-900 font-semibold rounded-xl transition-all duration-200"
                        >
                            <Chrome size={20} />
                            Continue with Google
                        </button>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-zinc-800"></div>
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-zinc-950 px-2 text-zinc-600 font-mono tracking-widest">or secure link</span>
                            </div>
                        </div>

                        <form
                            onSubmit={(e) => e.preventDefault()}
                            className="space-y-4"
                        >
                            <div className="space-y-2">
                                <label className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-500 px-1">Identity_Token</label>
                                <div className="relative group">
                                    <Mail className="absolute left-3 top-3 w-5 h-5 text-zinc-600 group-focus-within:text-emerald-500 transition-colors" />
                                    <input
                                        type="email"
                                        placeholder="name@agency.gov"
                                        className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl py-3 pl-11 pr-4 text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all font-mono text-sm"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-500 px-1">Access_Key</label>
                                <div className="relative group">
                                    <Lock className="absolute left-3 top-3 w-5 h-5 text-zinc-600 group-focus-within:text-emerald-500 transition-colors" />
                                    <input
                                        type="password"
                                        placeholder="••••••••"
                                        className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl py-3 pl-11 pr-4 text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all font-mono text-sm"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold rounded-xl transition-all duration-200 shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_25px_rgba(16,185,129,0.3)] disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden"
                                disabled={!email || !password}
                            >
                                <span className="relative z-10 flex items-center justify-center gap-2">
                                    <LogIn size={20} />
                                    Authenticate
                                </span>
                                <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/0 via-white/20 to-emerald-400/0 translate-x-[-100%] group-hover:animate-shimmer" />
                            </button>
                        </form>
                    </div>
                </div>

                <p className="text-center text-zinc-600 text-[10px] font-mono tracking-widest uppercase">
                    Signal encrypted • Terminal node: EL-9
                </p>
            </div>
        </div>
    );
};
