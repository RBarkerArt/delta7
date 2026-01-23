import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import type { AuthUser } from '../context/AuthContext';
import * as Dialog from '@radix-ui/react-dialog';
import {
    LayoutDashboard,
    Settings,
    LogOut,
    ChevronLeft,
    ChevronRight,
    Database,
    History,
    Activity,
    Menu,
    X,
    Users,
    BookOpen,
    type LucideIcon
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface NavItem {
    icon: LucideIcon;
    label: string;
    path: string;
}

interface SidebarContentProps {
    collapsed: boolean;
    isMobileOpen: boolean;
    onNavClick?: () => void;
    handleLogout: () => Promise<void>;
    user: AuthUser | null;
    navItems: NavItem[];
    setCollapsed: (v: boolean) => void;
}

const SidebarContent: React.FC<SidebarContentProps> = ({
    collapsed,
    isMobileOpen,
    onNavClick,
    handleLogout,
    user,
    navItems,
    setCollapsed
}) => (
    <>
        {/* Sidebar Header */}
        <div className="p-6 flex items-center gap-4">
            <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center shrink-0 shadow-sm">
                <span className="font-bold text-white text-xl">D7</span>
            </div>
            {(!collapsed || isMobileOpen) && (
                <div className="overflow-hidden whitespace-nowrap">
                    <h2 className="font-bold text-zinc-900 leading-tight">DELTA-7</h2>
                    <p className="text-[10px] text-zinc-400 font-mono tracking-widest uppercase">Research_Station</p>
                </div>
            )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto custom-scrollbar">
            {navItems.map((item) => (
                <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/admin'}
                    onClick={onNavClick}
                    className={({ isActive }) => cn(
                        "flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 group relative",
                        isActive
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                            : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/50 border border-transparent"
                    )}
                >
                    <item.icon size={20} className="shrink-0" />
                    {(!collapsed || isMobileOpen) && (
                        <span className="font-medium text-sm">{item.label}</span>
                    )}
                    {(collapsed && !isMobileOpen) && (
                        <div className="absolute left-full ml-4 px-2 py-1 bg-white text-zinc-900 text-xs rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap border border-zinc-200 shadow-lg z-50">
                            {item.label}
                        </div>
                    )}
                </NavLink>
            ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-zinc-200 space-y-4">
            {!isMobileOpen && (
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="w-full flex items-center gap-4 px-4 py-2 hover:bg-zinc-200/50 rounded-lg text-zinc-400 hover:text-zinc-900 transition-colors hidden lg:flex"
                >
                    {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
                    {!collapsed && <span className="text-xs font-mono uppercase">Compress</span>}
                </button>
            )}

            <button
                onClick={handleLogout}
                className="w-full flex items-center gap-4 px-4 py-3 text-red-600/70 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200"
            >
                <LogOut size={20} className="shrink-0" />
                {(!collapsed || isMobileOpen) && <span className="text-sm font-semibold">Terminate Observer Session</span>}
            </button>

            {(!collapsed || isMobileOpen) && user && (
                <div className="flex items-center gap-3 px-4 py-3 mt-4 bg-zinc-50 rounded-xl border border-zinc-100">
                    <div className="w-8 h-8 rounded-full bg-zinc-200 flex items-center justify-center text-zinc-600 uppercase font-bold text-xs">
                        {user.email?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-zinc-900 font-mono truncate">{user.email}</p>
                        <p className="text-[8px] text-emerald-600 font-mono uppercase tracking-widest font-bold">Observer_Certified</p>
                    </div>
                </div>
            )}
        </div>
    </>
);

export const AdminLayout: React.FC = () => {
    const { logout, user } = useAuth();
    const [collapsed, setCollapsed] = useState(false);
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate('/');
    };

    const navItems: NavItem[] = [
        { icon: LayoutDashboard, label: 'Overview', path: '/admin' },
        { icon: BookOpen, label: 'Narrative Reader', path: '/admin/narrative' },
        { icon: Users, label: 'Observer Directory', path: '/admin/observers' },
        { icon: Database, label: 'Observation Logs', path: '/admin/logs' },
        { icon: History, label: 'Prologue Sequences', path: '/admin/prologues' },
        { icon: Activity, label: 'Temporal Metrics', path: '/admin/stats' },
        { icon: Settings, label: 'Station Config', path: '/admin/settings' },
    ];

    return (
        <div className="flex h-screen bg-white overflow-hidden flex-col lg:flex-row text-zinc-900">
            {/* Mobile Header */}
            <header className="lg:hidden flex items-center justify-between p-4 bg-zinc-50 border-b border-zinc-200 z-30">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-emerald-600 rounded-md flex items-center justify-center shadow-sm">
                        <span className="font-bold text-white text-sm">D7</span>
                    </div>
                    <span className="font-bold text-zinc-900 text-sm tracking-tight capitalize">Observation Hub</span>
                </div>

                <Dialog.Root open={isMobileOpen} onOpenChange={setIsMobileOpen}>
                    <Dialog.Trigger asChild>
                        <button className="p-2 text-zinc-500 hover:text-zinc-900 transition-colors">
                            <Menu size={24} />
                        </button>
                    </Dialog.Trigger>
                    <Dialog.Portal>
                        <Dialog.Overlay className="fixed inset-0 bg-zinc-900/40 backdrop-blur-[2px] z-40 animate-fade-in" />
                        <Dialog.Content className="fixed top-0 left-0 bottom-0 w-72 bg-white border-r border-zinc-200 z-50 animate-slide-in-left flex flex-col shadow-2xl">
                            <Dialog.Title className="sr-only">Observation Controls</Dialog.Title>
                            <Dialog.Description className="sr-only">Analytical tools and nexus parameters.</Dialog.Description>
                            <Dialog.Close asChild>
                                <button className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-zinc-100 transition-colors">
                                    <X size={24} />
                                </button>
                            </Dialog.Close>
                            <SidebarContent
                                collapsed={collapsed}
                                isMobileOpen={isMobileOpen}
                                onNavClick={() => setIsMobileOpen(false)}
                                handleLogout={handleLogout}
                                user={user}
                                navItems={navItems}
                                setCollapsed={setCollapsed}
                            />
                        </Dialog.Content>
                    </Dialog.Portal>
                </Dialog.Root>
            </header>

            {/* Desktop Sidebar */}
            <aside className={cn(
                "bg-zinc-50/50 border-r border-zinc-200 transition-all duration-300 flex flex-col relative z-20 hidden lg:flex",
                collapsed ? "w-20" : "w-64"
            )}>
                <SidebarContent
                    collapsed={collapsed}
                    isMobileOpen={isMobileOpen}
                    handleLogout={handleLogout}
                    user={user}
                    navItems={navItems}
                    setCollapsed={setCollapsed}
                />
            </aside>

            {/* Main Content */}
            <main className="flex-1 relative overflow-y-auto custom-scrollbar bg-white">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_rgba(16,185,129,0.03),_transparent)] pointer-events-none" />
                <div className="p-4 md:p-10 max-w-7xl mx-auto">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};
