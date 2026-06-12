import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { Archive, FileText, Ghost, RefreshCw } from 'lucide-react';
import { db } from '../lib/firebase';
import type { DayLog } from '../types/schema';
import { getPrologueThresholdLabel } from '../lib/prologueThresholds';
import { buildDailyRecoveryState } from '../lib/dailyRecovery';

interface ArchiveShelfPanelProps {
    currentDay: number;
    recoveredItems: string[];
}

const hasRecovered = (items: string[], id: string) => items.includes(id);

export const ArchiveShelfPanel: React.FC<ArchiveShelfPanelProps> = ({ currentDay, recoveredItems }) => {
    const [days, setDays] = useState<DayLog[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        const fetchDays = async () => {
            setLoading(true);
            try {
                const daysQuery = query(collection(db, 'season1_days'), orderBy('day', 'asc'));
                const snap = await getDocs(daysQuery);
                if (!cancelled) {
                    setDays(snap.docs.map(doc => doc.data() as DayLog));
                }
            } catch (err) {
                if (import.meta.env.DEV) console.warn('[Delta-7] Archive shelf failed to load:', err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        void fetchDays();
        return () => {
            cancelled = true;
        };
    }, []);

    const visibleDays = useMemo(
        () => days.filter(day => day.day <= currentDay),
        [days, currentDay]
    );

    if (loading) {
        return (
            <div className="flex min-h-48 items-center justify-center gap-3 text-xs uppercase tracking-[0.22em] text-[#d8d2bd]/50">
                <RefreshCw size={16} className="animate-spin" />
                Resolving shelf index
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <div className="border-l border-emerald-100/35 pl-4 text-sm leading-relaxed text-[#f7f1dc]/84">
                Recovered material is filed in chronological order. Empty spaces are intentional; the archive does not reveal what the room has not returned.
            </div>

            <div className="space-y-4">
                {visibleDays.map(day => {
                    const recovery = buildDailyRecoveryState(day, recoveredItems);
                    const recoveredFragments = (day.fragments || []).filter(fragment => hasRecovered(recoveredItems, `fragment:${fragment.id}`));
                    const stableLog = day.vm_logs?.FEED_STABLE || Object.values(day.vm_logs || {})[0];
                    const statusLabel = recovery.archiveStatus === 'filed'
                        ? 'Filed'
                        : recovery.archiveStatus === 'partial'
                            ? `${recovery.recoveredCount}/${recovery.totalRecoverable} filed`
                            : 'Unresolved';

                    return (
                        <section key={day.day} className="border border-[#f2ead0]/14 bg-black/24 p-4">
                            <div className="mb-4 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#fff7df]">
                                    <Archive size={14} className="text-emerald-100/70" />
                                    Volume {String(day.day).padStart(2, '0')}
                                </div>
                                <div className="text-[10px] uppercase tracking-[0.18em] text-[#f7f1dc]/50">
                                    {statusLabel}
                                </div>
                            </div>

                            <div className="space-y-4 text-sm">
                                <div className="border-l border-white/10 pl-3">
                                    <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[#f7f1dc]/56">
                                        <FileText size={12} />
                                        {getPrologueThresholdLabel(day.day)}
                                    </div>
                                    {recovery.hasEntryPrologue ? (
                                        <p className="font-['EB_Garamond'] text-lg italic leading-relaxed text-[#fff7df]">
                                            {day.prologueSentences?.[0] || 'Recovered induction line unavailable.'}
                                        </p>
                                    ) : (
                                        <p className="text-xs italic text-[#f7f1dc]/48">An empty page remains in place.</p>
                                    )}
                                </div>

                                <div className="border-l border-white/10 pl-3">
                                    <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[#f7f1dc]/56">
                                        <FileText size={12} />
                                        Return Packet
                                    </div>
                                    {recovery.hasReturnPacket ? (
                                        <p className="font-['EB_Garamond'] text-base italic leading-relaxed text-[#fff7df]/90">
                                            {day.prologueSentences?.[1]}
                                        </p>
                                    ) : (
                                        <p className="text-xs italic text-[#f7f1dc]/48">
                                            {recovery.hasReturnPacketContent ? 'An interval page remains unfiled.' : 'No interval page is present in this volume.'}
                                        </p>
                                    )}
                                </div>

                                <div className="border-l border-white/10 pl-3">
                                    <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[#f7f1dc]/56">
                                        <FileText size={12} />
                                        Field Note
                                    </div>
                                    {recovery.hasNote ? (
                                        <p className="text-xs leading-relaxed text-[#f7f1dc]/78">
                                            {day.narrativeSummary || 'The note is present, but the writing has not resolved.'}
                                        </p>
                                    ) : (
                                        <p className="text-xs italic text-[#f7f1dc]/48">The clipboard has not been filed.</p>
                                    )}
                                </div>

                                <div className="border-l border-white/10 pl-3">
                                    <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[#f7f1dc]/56">
                                        <FileText size={12} />
                                        VM Log
                                    </div>
                                    {recovery.hasVmLog && stableLog ? (
                                        <div className="space-y-2">
                                            <div className="text-[10px] uppercase tracking-[0.18em] text-emerald-50/74">{stableLog.title}</div>
                                            <p className="whitespace-pre-wrap text-xs leading-relaxed text-[#f7f1dc]/78">{stableLog.body}</p>
                                        </div>
                                    ) : (
                                        <p className="text-xs italic text-[#f7f1dc]/48">No stable log has been filed.</p>
                                    )}
                                </div>

                                <div className="border-l border-white/10 pl-3">
                                    <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[#f7f1dc]/56">
                                        <Ghost size={12} />
                                        Fragments
                                    </div>
                                    {recoveredFragments.length > 0 ? (
                                        <div className="space-y-2">
                                            {recoveredFragments.map(fragment => (
                                                <p key={fragment.id} className="font-['EB_Garamond'] text-base italic leading-relaxed text-[#fff7df]/90">
                                                    {fragment.body}
                                                </p>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs italic text-[#f7f1dc]/48">Fragment slots are still dark.</p>
                                    )}
                                </div>

                                {recovery.hasEvidence && (
                                    <div className="border-l border-emerald-100/30 pl-3 text-xs text-emerald-50/72">
                                        Exterior evidence feed linked to this shelf.
                                    </div>
                                )}
                            </div>
                        </section>
                    );
                })}
            </div>
        </div>
    );
};
