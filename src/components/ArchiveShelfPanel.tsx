import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { Archive, FileText, Ghost, RefreshCw } from 'lucide-react';
import { db } from '../lib/firebase';
import type { DayLog } from '../types/schema';
import { getPrologueThresholdLabel } from '../lib/prologueThresholds';
import { buildDailyRecoveryState } from '../lib/dailyRecovery';
import { FRAGMENT_SETS, ENDOWED_SET_RECOVERY_ID } from '../lib/fragmentSets';

interface ArchiveShelfPanelProps {
    currentDay: number;
    recoveredItems: string[];
    /** Used once to grant the endowed set slot on first archive view. */
    markRecovered: (id: string) => Promise<void>;
}

const hasRecovered = (items: string[], id: string) => items.includes(id);

// A fragment is "held" if its own recovery id is present, or — for the endowed
// slot — the pre-arrival grant stands in. Endowed handling keeps the set from
// ever opening as a wall of blanks.
const isFragmentHeld = (items: string[], fragmentId: string): boolean =>
    items.includes(`fragment:${fragmentId}`) ||
    (items.includes(ENDOWED_SET_RECOVERY_ID) &&
        FRAGMENT_SETS.some((set) => set.endowedFragmentId === fragmentId));

export const ArchiveShelfPanel: React.FC<ArchiveShelfPanelProps> = ({ currentDay, recoveredItems, markRecovered }) => {
    const [days, setDays] = useState<DayLog[]>([]);
    const [loading, setLoading] = useState(true);

    // Endowed progress (#7): on first archive view, hand over one set slot —
    // "recovered before you arrived" — so the collection never opens empty.
    useEffect(() => {
        if (recoveredItems.includes(ENDOWED_SET_RECOVERY_ID)) return;
        void markRecovered(ENDOWED_SET_RECOVERY_ID);
    }, [recoveredItems, markRecovered]);

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

    // Torn Halves (#7): map each pairId to its member fragment ids so a half can
    // ask whether its partner has been recovered — the partner may live in a
    // different volume entirely.
    const pairMembers = useMemo(() => {
        const map = new Map<string, string[]>();
        for (const day of days) {
            for (const fragment of day.fragments || []) {
                if (!fragment.pairId) continue;
                const list = map.get(fragment.pairId) || [];
                if (!list.includes(fragment.id)) list.push(fragment.id);
                map.set(fragment.pairId, list);
            }
        }
        return map;
    }, [days]);

    const isPairComplete = (pairId: string): boolean => {
        const members = pairMembers.get(pairId) || [];
        return members.length > 0 && members.every(id => isFragmentHeld(recoveredItems, id));
    };

    // Fragment bodies by id, for filling set slots that are held.
    const fragmentBodies = useMemo(() => {
        const map = new Map<string, string>();
        for (const day of days) {
            for (const fragment of day.fragments || []) map.set(fragment.id, fragment.body);
        }
        return map;
    }, [days]);

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
                                            {recoveredFragments.map(fragment => {
                                                // Torn Halves (#7): a paired fragment whose partner is not
                                                // yet recovered renders torn — legible top, ragged clipped
                                                // edge, and a quiet "[remainder filed elsewhere]". Once both
                                                // halves are in, it knits together (reduced-motion: instant).
                                                const torn = fragment.pairId ? !isPairComplete(fragment.pairId) : false;
                                                const joined = fragment.pairId ? isPairComplete(fragment.pairId) : false;
                                                if (torn) {
                                                    return (
                                                        <div key={fragment.id} className="fragment-torn relative">
                                                            <p className="font-['EB_Garamond'] text-base italic leading-relaxed text-[#fff7df]/90">
                                                                {fragment.body}
                                                            </p>
                                                            <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[#f7f1dc]/42">
                                                                [remainder filed elsewhere]
                                                            </p>
                                                        </div>
                                                    );
                                                }
                                                return (
                                                    <p
                                                        key={fragment.id}
                                                        className={`font-['EB_Garamond'] text-base italic leading-relaxed text-[#fff7df]/90 ${joined ? 'fragment-knit' : ''}`}
                                                    >
                                                        {fragment.body}
                                                    </p>
                                                );
                                            })}
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

            {/* Fragment Sets index (#7): named collections as slots — filled slots
                legible, empty ones titled silhouettes you can still read. One
                slot arrives pre-filled ("recovered before you arrived"). */}
            {FRAGMENT_SETS.map(set => {
                const filledCount = set.slots.filter(slot => isFragmentHeld(recoveredItems, slot.fragmentId)).length;
                return (
                    <section key={set.id} className="border border-emerald-100/16 bg-black/24 p-4">
                        <div className="mb-1 flex items-center justify-between gap-3">
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#fff7df]">
                                {set.name}
                            </div>
                            <div className="text-[10px] uppercase tracking-[0.18em] text-emerald-100/55">
                                {filledCount}/{set.slots.length} filed
                            </div>
                        </div>
                        <p className="mb-4 text-xs italic leading-relaxed text-[#f7f1dc]/60">{set.caption}</p>
                        <div className="space-y-2.5">
                            {set.slots.map((slot, index) => {
                                const filled = isFragmentHeld(recoveredItems, slot.fragmentId);
                                const endowed = slot.fragmentId === set.endowedFragmentId;
                                return (
                                    <div
                                        key={slot.fragmentId}
                                        className={`flex gap-3 border-l pl-3 ${filled ? 'border-emerald-100/35' : 'border-white/8'}`}
                                    >
                                        <div className={`mt-1 shrink-0 font-mono text-[10px] ${filled ? 'text-emerald-100/60' : 'text-[#f7f1dc]/28'}`}>
                                            {String(index + 1).padStart(2, '0')}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-[#f7f1dc]/56">
                                                {slot.title}
                                                {endowed && (
                                                    <span className="text-[8px] tracking-[0.14em] text-emerald-100/45">// recovered before you arrived</span>
                                                )}
                                            </div>
                                            {filled ? (
                                                <p className="mt-1 font-['EB_Garamond'] text-base italic leading-relaxed text-[#fff7df]/90">
                                                    {fragmentBodies.get(slot.fragmentId) || 'Held, but the writing has not resolved.'}
                                                </p>
                                            ) : (
                                                // Silhouette: title stays readable, body is a dark blank.
                                                <p className="mt-1 select-none font-['EB_Garamond'] text-base italic leading-relaxed text-[#f7f1dc]/20 [filter:blur(1.5px)]">
                                                    ▓▓▓▓▓ ▓▓▓▓▓▓▓ ▓▓▓ ▓▓▓▓▓▓▓▓▓▓
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                );
            })}
        </div>
    );
};
