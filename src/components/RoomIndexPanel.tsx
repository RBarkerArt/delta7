import React from 'react';
import { useSound } from '../hooks/useSound';

interface RoomIndexItem {
    id: string;
    name: string;
    index: string;
    thresholdText: string;
    requiredLogs: number;
    isInteractable: boolean;
}

const ROOM_INDEX_ITEMS: RoomIndexItem[] = [
    {
        id: 'lab',
        name: 'Observation Cell',
        index: '01',
        thresholdText: '--',
        requiredLogs: 0,
        isInteractable: true,
    },
    {
        id: 'break-room',
        name: 'Break Room',
        index: '02',
        thresholdText: '5 Logs',
        requiredLogs: 5,
        isInteractable: true,
    },
    {
        id: 'signal-cartography',
        name: 'Signal Cartography',
        index: '03',
        thresholdText: '15 Logs',
        requiredLogs: 15,
        isInteractable: true,
    },
    {
        id: 'archive-wing',
        name: 'Archive Wing',
        index: '04',
        thresholdText: '30 Logs',
        requiredLogs: 30,
        isInteractable: false,
    }
];

interface RoomIndexPanelProps {
    vmLogRecoveryCount: number;
    activeRoom: string;
    onNavigate: (roomId: 'lab' | 'break-room' | 'signal-cartography') => void;
    isAdmin?: boolean;
    onClose: () => void;
}

export const RoomIndexPanel: React.FC<RoomIndexPanelProps> = ({
    vmLogRecoveryCount = 0,
    activeRoom,
    onNavigate,
    isAdmin = false,
    onClose,
}) => {
    const { playClick } = useSound();

    return (
        <div className="flex flex-col p-4 space-y-6">
            <div className="border border-emerald-500/25 bg-black/40 rounded overflow-hidden">
                <table className="w-full text-left font-mono text-xs">
                    <thead>
                        <tr className="border-b border-emerald-500/25 bg-emerald-950/20 text-[10px] text-emerald-100/60 uppercase tracking-wider">
                            <th className="p-3">INDEX</th>
                            <th className="p-3">SECTOR / ROOM</th>
                            <th className="p-3">THRESHOLD</th>
                            <th className="p-3 text-right">STATUS</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-500/10">
                        {ROOM_INDEX_ITEMS.map((room) => {
                            const isUnlocked = isAdmin || vmLogRecoveryCount >= room.requiredLogs;
                            const isCurrent = activeRoom === room.id;
                            const canNavigate = isUnlocked && room.isInteractable && !isCurrent;

                            return (
                                <tr 
                                    key={room.id}
                                    className={`transition-colors ${
                                        canNavigate 
                                            ? "hover:bg-emerald-500/5" 
                                            : !isUnlocked 
                                                ? "bg-red-950/5 hover:bg-red-950/10" 
                                                : ""
                                    }`}
                                >
                                    <td className={`p-3 ${isUnlocked ? "text-emerald-500/60" : "text-red-500/60"}`}>
                                        {room.index}
                                    </td>
                                    <td className="p-3 font-semibold">
                                        {canNavigate ? (
                                            <button
                                                onClick={() => {
                                                    playClick();
                                                    onClose();
                                                    onNavigate(room.id as 'lab' | 'break-room' | 'signal-cartography');
                                                }}
                                                className="text-left text-emerald-100 hover:text-emerald-400 active:text-emerald-300 hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500/50 transition-colors cursor-pointer"
                                                aria-label={`Navigate to ${room.name}`}
                                            >
                                                {room.name}
                                            </button>
                                        ) : isCurrent ? (
                                            <span className="text-emerald-100/70 italic cursor-default">
                                                {room.name} (Current)
                                            </span>
                                        ) : isUnlocked ? (
                                            <span className="text-emerald-100">
                                                {room.name}
                                            </span>
                                        ) : (
                                            <span className="text-red-400/80">
                                                {room.name}
                                            </span>
                                        )}
                                    </td>
                                    <td className={`p-3 ${isUnlocked ? "text-emerald-100/40" : "text-red-400/30"}`}>
                                        {room.thresholdText}
                                    </td>
                                    <td className="p-3 text-right font-bold uppercase tracking-wider">
                                        {isUnlocked ? (
                                            <span className="text-emerald-400">ACTIVE</span>
                                        ) : (
                                            <span className="text-red-500 animate-pulse">
                                                LOCKED ({vmLogRecoveryCount}/{room.requiredLogs})
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <p className="text-[10px] text-[#d8d2bd]/50 italic leading-relaxed">
                * Select an active room to transition telemetry sensors immediately. Locked sectors require additional recovered signal fragments to establish coherence.
            </p>
        </div>
    );
};
