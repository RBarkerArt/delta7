import React from 'react';
import { Archive, KeyRound, Radio, ShieldAlert, ShieldCheck } from 'lucide-react';
import type { CoherenceState } from '../types/schema';

interface SecurityGatewayPanelProps {
    accessCode: string | null;
    isAnchored: boolean;
    email?: string | null;
    score: number;
    state: CoherenceState;
    recoveredCount: number;
    onAnchor: () => void;
    onTune: () => void;
}

export const SecurityGatewayPanel: React.FC<SecurityGatewayPanelProps> = ({
    accessCode,
    isAnchored,
    email,
    score,
    state,
    recoveredCount,
    onAnchor,
    onTune
}) => {
    return (
        <div className="space-y-6 text-[#f7f1dc]">
            <div className="grid gap-3 sm:grid-cols-3">
                <div className="border border-[#f2ead0]/16 bg-black/28 p-4">
                    <KeyRound size={18} className="mb-3 text-emerald-100/75" />
                    <div className="text-[10px] uppercase tracking-[0.2em] text-[#f7f1dc]/62">Recovery Frequency</div>
                    <div className="mt-2 text-lg font-semibold tracking-[0.16em] text-[#fff7df]">
                        {accessCode || 'ASSIGNING'}
                    </div>
                </div>

                <div className="border border-[#f2ead0]/16 bg-black/28 p-4">
                    {isAnchored ? (
                        <ShieldCheck size={18} className="mb-3 text-emerald-100/75" />
                    ) : (
                        <ShieldAlert size={18} className="mb-3 text-amber-100/80" />
                    )}
                    <div className="text-[10px] uppercase tracking-[0.2em] text-[#f7f1dc]/62">Anchor State</div>
                    <div className="mt-2 text-sm uppercase tracking-[0.12em] text-[#fff7df]">
                        {isAnchored ? 'Anchored' : 'Local Only'}
                    </div>
                </div>

                <div className="border border-[#f2ead0]/16 bg-black/28 p-4">
                    <Archive size={18} className="mb-3 text-emerald-100/75" />
                    <div className="text-[10px] uppercase tracking-[0.2em] text-[#f7f1dc]/62">Recovered</div>
                    <div className="mt-2 text-sm uppercase tracking-[0.12em] text-[#fff7df]">
                        {recoveredCount} items
                    </div>
                </div>
            </div>

            <div className="border-l border-emerald-100/35 pl-4 text-sm leading-relaxed text-[#f7f1dc]/86">
                <p>
                    This security box is the room's recovery surface. The frequency restores this anonymous observation record on another browser or device.
                </p>
                <p className="mt-3">
                    Anchoring is optional. It links the same record to Google or email while keeping the frequency visible as the fallback key.
                </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
                <button
                    onClick={onTune}
                    className="flex items-center justify-center gap-2 border border-emerald-100/35 bg-emerald-100/14 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-50 transition-colors hover:bg-emerald-100/24"
                >
                    <Radio size={15} />
                    Restore Frequency
                </button>
                <button
                    onClick={onAnchor}
                    className="flex items-center justify-center gap-2 border border-[#f2ead0]/20 bg-[#f2ead0]/10 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#fff7df] transition-colors hover:bg-[#f2ead0]/16"
                >
                    {isAnchored ? <ShieldCheck size={15} /> : <ShieldAlert size={15} />}
                    {isAnchored ? 'View Anchor' : 'Anchor Record'}
                </button>
            </div>

            <div className="grid gap-3 border-t border-[#f2ead0]/14 pt-5 text-xs text-[#f7f1dc]/72 sm:grid-cols-2">
                <div>
                    <div className="uppercase tracking-[0.18em] text-[#f7f1dc]/50">Current Signal</div>
                    <div className="mt-1 text-[#fff7df]">{score.toFixed(1)}% / {state}</div>
                </div>
                <div>
                    <div className="uppercase tracking-[0.18em] text-[#f7f1dc]/50">Linked Signal</div>
                    <div className="mt-1 truncate text-[#fff7df]">{email || 'No account anchor established'}</div>
                </div>
            </div>
        </div>
    );
};
