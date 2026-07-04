import React from 'react';
import { Archive, Eye, KeyRound, Radio, ShieldAlert, ShieldCheck } from 'lucide-react';
import type { CoherenceState } from '../types/schema';
import { DecodeText } from './ui/DecodeText';
import { TypeOn } from './ui/TypeOn';
import {
    checkAcrostic,
    getAcrosticRejection,
    ACROSTIC_REVEAL,
    buildObserverRecord,
    deriveObserverTraits,
    OBSERVER_RECORD_RECOVERY_ID,
} from '../lib/kaelMarginalia';
import { getObserverSession } from '../lib/visitor';

interface SecurityGatewayPanelProps {
    accessCode: string | null;
    isAnchored: boolean;
    email?: string | null;
    score: number;
    state: CoherenceState;
    recoveredCount: number;
    /** Full recovery set + current day — for the Observer Record (Behavioral Echo). */
    recoveredItems: string[];
    currentDay: number;
    /** Files lore:observer-record on first view of the Observer Record. */
    markRecovered: (id: string) => void;
    /** True once `lore:acrostic` has been recovered — reveals the hidden log. */
    acrosticSolved: boolean;
    /** Called on a correct override phrase; recovers the acrostic lore. */
    onAcrosticSolved: () => void;
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
    recoveredItems,
    currentDay,
    markRecovered,
    acrosticSolved,
    onAcrosticSolved,
    onAnchor,
    onTune
}) => {
    // The override-phrase surface. Diegetic: restoring a frequency that only the
    // margins carried. A wrong entry gets a quiet, unstyled rejection; a correct
    // one recovers the hidden Kael log. Never blocks anything — pure bonus.
    const [phrase, setPhrase] = React.useState('');
    const [rejection, setRejection] = React.useState<string | null>(null);
    const seed = getObserverSession().visitorId;

    // Behavioral Echo — Kael reads the observer's own pattern back to them, from
    // traits derived entirely from existing persisted data. Files
    // lore:observer-record once on first view (ref-guarded against StrictMode).
    const observerRecord = React.useMemo(
        () => buildObserverRecord(deriveObserverTraits(recoveredItems, currentDay)),
        [recoveredItems, currentDay]
    );
    const observerRecordMarkedRef = React.useRef(false);
    React.useEffect(() => {
        if (observerRecordMarkedRef.current) return;
        if (recoveredItems.includes(OBSERVER_RECORD_RECOVERY_ID)) { observerRecordMarkedRef.current = true; return; }
        observerRecordMarkedRef.current = true;
        markRecovered(OBSERVER_RECORD_RECOVERY_ID);
    }, [recoveredItems, markRecovered]);

    const submitPhrase = (event: React.FormEvent) => {
        event.preventDefault();
        if (acrosticSolved) return;
        if (checkAcrostic(phrase)) {
            setRejection(null);
            onAcrosticSolved();
        } else {
            setRejection(getAcrosticRejection(seed + phrase.trim().toUpperCase()));
        }
    };

    return (
        <div className="space-y-6 text-[#f7f1dc]">
            <div className="grid gap-3 sm:grid-cols-3">
                <div className="border border-[#f2ead0]/16 bg-black/28 p-4">
                    <KeyRound size={18} className="mb-3 text-emerald-100/75" />
                    <div className="text-[10px] uppercase tracking-[0.2em] text-[#f7f1dc]/62">Recovery Frequency</div>
                    <div className="mt-2 text-lg font-semibold tracking-[0.16em] text-[#fff7df]">
                        {accessCode ? (
                            <DecodeText text={accessCode} speed={55} startDelay={350} />
                        ) : (
                            <span className="animate-pulse">ASSIGNING</span>
                        )}
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

            {/* Override phrase — the margins carried a word for anyone reading down
                the edge. Restoring it here recovers what Kael was really doing. */}
            <div className="border-t border-[#f2ead0]/14 pt-5">
                {acrosticSolved ? (
                    <div className="border border-emerald-100/25 bg-[#11110e]/72 p-4">
                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-emerald-100/58">
                            <Radio size={13} />
                            {ACROSTIC_REVEAL.title}
                        </div>
                        <p className="mt-3 whitespace-pre-wrap font-['EB_Garamond'] text-sm italic leading-relaxed text-[#f2ead0]/82">
                            <TypeOn text={ACROSTIC_REVEAL.body} speed={9} startDelay={200} showCursor={false} />
                        </p>
                    </div>
                ) : (
                    <form onSubmit={submitPhrase} className="space-y-2">
                        <label className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[#f7f1dc]/50" htmlFor="override-phrase">
                            <Radio size={13} className="text-emerald-100/60" />
                            Override Phrase
                        </label>
                        <div className="flex gap-2">
                            <input
                                id="override-phrase"
                                type="text"
                                value={phrase}
                                onChange={(e) => { setPhrase(e.target.value); setRejection(null); }}
                                autoComplete="off"
                                autoCapitalize="characters"
                                spellCheck={false}
                                placeholder="restore frequency…"
                                className="min-w-0 flex-1 border border-[#f2ead0]/16 bg-black/28 px-3 py-2 font-mono text-sm uppercase tracking-[0.16em] text-[#fff7df] placeholder:text-[#f7f1dc]/28 outline-none transition-colors focus:border-emerald-100/40"
                            />
                            <button
                                type="submit"
                                className="shrink-0 border border-emerald-100/30 bg-emerald-100/12 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-50 transition-colors hover:bg-emerald-100/22"
                            >
                                Send
                            </button>
                        </div>
                        {rejection && (
                            <p className="font-['EB_Garamond'] text-[12px] italic leading-snug text-[#d1d1c7]/62">
                                {rejection}
                            </p>
                        )}
                    </form>
                )}
            </div>

            {/* Observer Record (Behavioral Echo) — Kael reads your pattern back
                to you from what the record already knows. Curiosity, never a
                task list. Pure bonus. */}
            {observerRecord.length > 0 && (
                <div className="border-t border-[#f2ead0]/14 pt-5">
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-emerald-100/58">
                        <Eye size={13} />
                        Observer Record
                    </div>
                    <div className="mt-3 space-y-3 border-l border-emerald-100/25 pl-4">
                        {observerRecord.map((line, index) => (
                            <p key={index} className="font-['EB_Garamond'] text-sm italic leading-relaxed text-[#f2ead0]/84">
                                {line}
                            </p>
                        ))}
                    </div>
                </div>
            )}

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
