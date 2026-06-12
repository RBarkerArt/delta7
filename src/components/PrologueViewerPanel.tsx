import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { BookOpen, RefreshCw } from 'lucide-react';
import { db } from '../lib/firebase';
import type { DayLog } from '../types/schema';
import {
    buildPrologueThresholdsFromDays,
    buildPrologueThresholdsFromLocalData,
    getPrologueThresholdLabel,
    isPrologueThresholdRecovered,
    type PrologueThreshold
} from '../lib/prologueThresholds';
import prologueData from '../season1_prologues.json';

interface PrologueViewerPanelProps {
    recoveredItems: string[];
}

export const PrologueViewerPanel: React.FC<PrologueViewerPanelProps> = ({ recoveredItems }) => {
    const [thresholds, setThresholds] = useState<PrologueThreshold[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        const fetchDays = async () => {
            setLoading(true);
            try {
                const daysQuery = query(collection(db, 'season1_days'), orderBy('day', 'asc'));
                const snap = await getDocs(daysQuery);
                if (!cancelled) {
                    const firestoreThresholds = buildPrologueThresholdsFromDays(snap.docs.map(doc => doc.data() as DayLog));
                    setThresholds(firestoreThresholds.length > 0 ? firestoreThresholds : buildPrologueThresholdsFromLocalData(prologueData));
                }
            } catch (err) {
                if (import.meta.env.DEV) console.warn('[Delta-7] Prologue shelf failed to load:', err);
                if (!cancelled) {
                    setThresholds(buildPrologueThresholdsFromLocalData(prologueData));
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        void fetchDays();
        return () => {
            cancelled = true;
        };
    }, []);

    const visibleThresholds = useMemo(
        () => thresholds,
        [thresholds]
    );

    if (loading) {
        return (
            <div className="flex min-h-48 items-center justify-center gap-3 text-xs uppercase tracking-[0.2em] text-[#f7f1dc]/62">
                <RefreshCw size={16} className="animate-spin" />
                Resolving prologue index
            </div>
        );
    }

    return (
        <div className="space-y-5 text-[#f7f1dc]">
            <div className="border-l border-emerald-100/35 pl-4 text-sm leading-relaxed text-[#f7f1dc]/84">
                Recovered prologues are filed in order. Missing pages remain in place, but the room does not reveal their contents early.
            </div>

            <div className="grid gap-3">
                {visibleThresholds.map(threshold => {
                    const recovered = isPrologueThresholdRecovered(recoveredItems, threshold.canonicalDay);

                    return (
                        <section key={threshold.id} className="border border-[#f2ead0]/14 bg-black/24 p-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#fff7df]">
                                    <BookOpen size={14} className="text-emerald-100/70" />
                                    {getPrologueThresholdLabel(threshold.canonicalDay)}
                                </div>
                                <div className="text-[10px] uppercase tracking-[0.18em] text-[#f7f1dc]/50">
                                    {recovered ? 'Recovered' : 'Unrecovered'}
                                </div>
                            </div>

                            {recovered ? (
                                <p className="font-['EB_Garamond'] text-xl italic leading-relaxed text-[#fff7df]">
                                    {threshold.text}
                                </p>
                            ) : (
                                <p className="text-sm italic leading-relaxed text-[#f7f1dc]/48">
                                    A blank divider marks where this threshold record will return.
                                </p>
                            )}
                        </section>
                    );
                })}
            </div>
        </div>
    );
};
