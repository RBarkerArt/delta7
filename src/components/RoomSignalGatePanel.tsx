import React from 'react';
import { DoorOpen, LockKeyhole, RadioTower } from 'lucide-react';

interface RoomSignalGatePanelProps {
    collectedVmLogs: number;
    requiredVmLogs: number;
    onEnter: () => void;
    enterLabel?: string;
}

export const RoomSignalGatePanel: React.FC<RoomSignalGatePanelProps> = ({
    collectedVmLogs,
    requiredVmLogs,
    onEnter,
    enterLabel = 'Enter New Room'
}) => {
    const hasEnoughEvidence = collectedVmLogs >= requiredVmLogs;
    const displayCount = Math.min(collectedVmLogs, requiredVmLogs);

    if (!hasEnoughEvidence) {
        return (
            <div className="space-y-5 text-[#f7f1dc]">
                <div className="flex items-start gap-4 border border-[#f2ead0]/16 bg-black/28 p-4">
                    <LockKeyhole size={18} className="mt-0.5 shrink-0 text-amber-100/80" />
                    <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-[0.2em] text-[#f7f1dc]/58">
                            Evidence threshold
                        </div>
                        <div className="mt-2 text-sm font-semibold tracking-[0.14em] text-[#fff7df]">
                            Not Enough Evidence Has Been Collected
                        </div>
                    </div>
                </div>

                <div className="grid gap-3 text-xs text-[#f7f1dc]/72 sm:grid-cols-2">
                    <div className="border border-[#f2ead0]/12 bg-black/20 p-3">
                        <div className="uppercase tracking-[0.18em] text-[#f7f1dc]/46">VM logs filed</div>
                        <div className="mt-1 text-[#fff7df]">{displayCount} / {requiredVmLogs}</div>
                    </div>
                    <div className="border border-[#f2ead0]/12 bg-black/20 p-3">
                        <div className="uppercase tracking-[0.18em] text-[#f7f1dc]/46">Door state</div>
                        <div className="mt-1 text-amber-100/82">Signal locked</div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-5 text-[#f7f1dc]">
            <div className="flex items-start gap-4 border border-emerald-100/24 bg-emerald-100/10 p-4">
                <RadioTower size={18} className="mt-0.5 shrink-0 text-emerald-100/82" />
                <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-emerald-100/58">
                        Evidence threshold met
                    </div>
                    <div className="mt-2 text-sm font-semibold uppercase tracking-[0.14em] text-[#fff7df]">
                        New room signal available
                    </div>
                </div>
            </div>

            <div className="border border-[#f2ead0]/12 bg-black/20 p-3 text-xs text-[#f7f1dc]/72">
                <div className="uppercase tracking-[0.18em] text-[#f7f1dc]/46">VM logs filed</div>
                <div className="mt-1 text-[#fff7df]">{collectedVmLogs} / {requiredVmLogs}</div>
            </div>

            <button
                onClick={onEnter}
                className="flex w-full items-center justify-center gap-2 border border-emerald-100/35 bg-emerald-100/14 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-50 transition-colors hover:bg-emerald-100/24"
            >
                <DoorOpen size={15} />
                {enterLabel}
            </button>
        </div>
    );
};
