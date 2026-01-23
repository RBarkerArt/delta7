import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Terminal, Shield, AlertTriangle } from 'lucide-react';

export const AdminLogin: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { loginWithGoogle, user, isAdmin } = useAuth();
    const navigate = useNavigate();

    // If already admin, redirect
    React.useEffect(() => {
        if (user && isAdmin) {
            navigate('/admin');
        }
    }, [user, isAdmin, navigate]);

    const handleGoogleSignIn = async () => {
        setLoading(true);
        setError(null);
        try {
            await loginWithGoogle();
        } catch (err: unknown) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-lab-black flex items-center justify-center p-4">
            <div className="max-w-md w-full space-y-8 bg-zinc-900/50 p-8 rounded-2xl border border-emerald-900/20 backdrop-blur-sm">
                <div className="text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-900/20 rounded-full mb-4">
                        <Terminal size={32} className="text-emerald-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-zinc-100 tracking-tight">Analytical Nexus</h2>
                    <p className="text-zinc-500 text-sm mt-2 font-mono uppercase tracking-widest">Authorized_Personnel_Only</p>
                </div>

                <div className="mt-8 space-y-6">
                    {error && (
                        <div className="flex items-center gap-3 p-4 bg-red-900/20 border border-red-900/50 rounded-xl text-red-500 text-sm">
                            <AlertTriangle size={18} className="shrink-0" />
                            <p>{error}</p>
                        </div>
                    )}

                    <div className="p-4 bg-zinc-950/50 border border-zinc-800 rounded-xl text-zinc-400 text-xs font-mono leading-relaxed">
                        Access to the Admin Core requires a verified administrative identity. Ensure you are using an authorized Google account.
                    </div>

                    <button
                        onClick={handleGoogleSignIn}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-3 bg-white hover:bg-zinc-100 text-zinc-900 font-bold py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] group"
                    >
                        {loading ? 'Validating...' : (
                            <>
                                <div className="w-5 h-5 flex items-center justify-center">
                                    <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /><path d="M1 1h22v22H1z" fill="none" /></svg>
                                </div>
                                <Shield size={18} className="text-emerald-600" />
                                <span>Sign in with Google</span>
                            </>
                        )}
                    </button>

                    <button
                        onClick={() => navigate('/')}
                        className="w-full text-zinc-600 hover:text-zinc-400 text-xs font-mono uppercase tracking-[0.2em] transition-colors"
                    >
                        Return to Laboratory
                    </button>
                </div>
            </div>
        </div>
    );
};
