import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import type { AuthUser } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { soundEngine } from '../lib/SoundEngine';
import * as Dialog from '@radix-ui/react-dialog';
import {
    LayoutDashboard,
    Settings,
    LogOut,
    ChevronLeft,
    ChevronRight,
    Database,
    Activity,
    Menu,
    X,
    Users,
    BookOpen,
    Zap,
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
        <div className="p-6 flex items-center gap-4 border-b border-gray-100">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center shrink-0 shadow-sm text-white font-bold">
                D7
            </div>
            {(!collapsed || isMobileOpen) && (
                <div className="overflow-hidden whitespace-nowrap">
                    <h2 className="font-bold text-gray-900">Delta-7</h2>
                    <p className="text-xs text-gray-500">Admin Panel</p>
                </div>
            )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
                <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/admin'}
                    onClick={onNavClick}
                    className={({ isActive }) => cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group relative",
                        isActive
                            ? "bg-gray-100 text-emerald-700 font-medium"
                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                    )}
                >
                    <item.icon size={20} className={cn("shrink-0", ({ isActive }: any) => isActive ? "text-emerald-600" : "text-gray-400 group-hover:text-gray-600")} />
                    {(!collapsed || isMobileOpen) && (
                        <span className="text-sm">{item.label}</span>
                    )}
                    {(collapsed && !isMobileOpen) && (
                        <div className="absolute left-full ml-4 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                            {item.label}
                        </div>
                    )}
                </NavLink>
            ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-gray-100 space-y-2">
            {!isMobileOpen && (
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="w-full flex items-center gap-4 px-3 py-2 text-gray-400 hover:text-gray-600 transition-colors hidden lg:flex"
                >
                    {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
                    {!collapsed && <span className="text-xs font-medium">Collapse</span>}
                </button>
            )}

            <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
                <LogOut size={20} className="shrink-0" />
                {(!collapsed || isMobileOpen) && <span className="text-sm font-medium">Sign Out</span>}
            </button>

            {(!collapsed || isMobileOpen) && user && (
                <div className="flex items-center gap-3 px-3 py-2 mt-2">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs">
                        {user.email?.[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 font-medium truncate">{user.email}</p>
                        <p className="text-xs text-gray-500">Administrator</p>
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

    // Audio Sync for Admin (Director Mode)
    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'system', 'settings'), (docSnap) => {
            if (docSnap.exists()) {
                const settings = docSnap.data() as any; // Using any to avoid importing schema if not needed, or better import it
                soundEngine.setGlobalVolume(settings.audioVolume ?? 1.0);
                soundEngine.setAudioMode(settings.audioMode || 'generative');
                soundEngine.setBackgroundTrack(settings.backgroundTrackUrl || null);
                soundEngine.setIsGlobalEnabled(settings.isAudioEnabled ?? true);
                soundEngine.setHybridTrackVolume(settings.hybridTrackVolume ?? 0.02);
            }
        });

        // Ensure audio engine is initialized on any click in admin
        const enableAudio = () => {
            if (soundEngine.isReady()) return;
            soundEngine.init().catch(() => { });
        };
        document.addEventListener('click', enableAudio, { once: true });

        return () => {
            unsub();
            document.removeEventListener('click', enableAudio);
        };
    }, []);

    const navItems: NavItem[] = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/admin' },
        { icon: BookOpen, label: 'Narrative', path: '/admin/narrative' },
        { icon: Users, label: 'Users', path: '/admin/observers' },
        { icon: Database, label: 'Days', path: '/admin/logs' },
        { icon: BookOpen, label: 'Story Bible', path: '/admin/story-bible' },
        { icon: Activity, label: 'Stats', path: '/admin/stats' },
        { icon: Zap, label: 'Director', path: '/admin/director' }, // Atmosphere Control
        { icon: Settings, label: 'Settings', path: '/admin/settings' },
    ];

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden flex-col lg:flex-row text-gray-900 font-sans">
            {/* Mobile Header */}
            <header className="lg:hidden flex items-center justify-between p-4 bg-white border-b border-gray-200 z-30">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-bold">D7</div>
                    <span className="font-bold text-gray-900">Admin Panel</span>
                </div>

                <Dialog.Root open={isMobileOpen} onOpenChange={setIsMobileOpen}>
                    <Dialog.Trigger asChild>
                        <button className="p-2 text-gray-500 hover:text-gray-900 transition-colors">
                            <Menu size={24} />
                        </button>
                    </Dialog.Trigger>
                    <Dialog.Portal>
                        <Dialog.Overlay className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 animate-fade-in" />
                        <Dialog.Content className="fixed top-0 left-0 bottom-0 w-72 bg-white border-r border-gray-200 z-50 animate-slide-in-left flex flex-col shadow-xl">
                            <Dialog.Title className="sr-only">Admin Menu</Dialog.Title>
                            <Dialog.Close asChild>
                                <button className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600">
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
                "bg-white border-r border-gray-200 transition-all duration-300 flex flex-col relative z-20 hidden lg:flex",
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
            <main className="flex-1 relative overflow-y-auto bg-gray-50">
                <div className="p-4 md:p-8 max-w-7xl mx-auto">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};
