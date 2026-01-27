import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Lock } from 'lucide-react';

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
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl space-y-8 border border-gray-100">
                <div className="text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-100 rounded-xl mb-4 text-emerald-600">
                        <Lock size={24} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">Delta-7 Admin</h2>
                    <p className="text-gray-500 text-sm mt-2">Sign in to manage station content</p>
                </div>

                <div className="space-y-6">
                    {error && (
                        <div className="p-4 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm">
                            {error}
                        </div>
                    )}

                    <button
                        onClick={handleGoogleSignIn}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-700 font-medium py-3 px-4 rounded-xl border border-gray-200 transition-all shadow-sm hover:shadow-md"
                    >
                        {loading ? 'Signing in...' : (
                            <>
                                <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
                                <span>Sign in with Google</span>
                            </>
                        )}
                    </button>

                    <button
                        onClick={() => navigate('/')}
                        className="w-full text-center text-sm text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        ← Back to Site
                    </button>
                </div>
            </div>
        </div>
    );
};
