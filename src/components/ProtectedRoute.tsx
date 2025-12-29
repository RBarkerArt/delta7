import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute: React.FC = () => {
    const { user, loading, isAdmin } = useAuth();

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-zinc-950 text-emerald-500 font-mono">
                <div className="animate-pulse">{">"} VERIFYING AUTHORIZATION...</div>
            </div>
        );
    }

    if (!user || !isAdmin) {
        return <Navigate to="/admin/login" replace />;
    }

    return <Outlet />;
};
