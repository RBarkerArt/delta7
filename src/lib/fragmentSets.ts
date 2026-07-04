// Fragment Sets (#7) — named collections that ache.
//
// The set MEMBERSHIP lives on the fragments themselves (the `set` field in
// season1_days.json / the DayLog fragment type). This module holds the set's
// display METADATA: its title, the readable titles of each slot (so an
// un-recovered slot can render as a titled silhouette, not a blank), and the
// order the slots fill in. Keeping membership in the data and presentation here
// mirrors how the rest of the archive is authored — the least-disruption fit
// for the existing schema, since fragments are already objects.
//
// One slot is seeded pre-filled via a special recovery id granted on first view
// of the archive ("recovered before you arrived") — endowed progress, the
// design's gift so the first set is never empty.

export interface FragmentSlot {
    /** The fragment id this slot resolves to, matched against `fragment:${id}`. */
    fragmentId: string;
    /** Readable title shown even while the slot is an empty silhouette. */
    title: string;
}

export interface FragmentSetDefinition {
    /** Key matched against a fragment's `set` field. */
    id: string;
    /** Set name shown as the collection header. */
    name: string;
    /** One-line, in-voice description of what the set is. */
    caption: string;
    /** Ordered slots — filled ones legible, empty ones titled silhouettes. */
    slots: FragmentSlot[];
    /**
     * The slot pre-filled on first view. Granting `endowedRecoveryId` marks this
     * fragment recovered so the set opens already one-fifth complete.
     */
    endowedFragmentId: string;
}

// Recovery id granted on first archive view so the endowed slot reads as filled.
// Rides recoveredItems like everything else (lore:* namespace).
export const ENDOWED_SET_RECOVERY_ID = 'lore:set-endowed:coherence-thesis';

export const FRAGMENT_SETS: FragmentSetDefinition[] = [
    {
        id: 'coherence-thesis',
        name: 'The Coherence Thesis',
        caption: 'Five lines Kael kept returning to. Read together, they are an argument. Read apart, they are a man talking himself into being seen.',
        slots: [
            { fragmentId: 'frag_0002_a', title: 'On the rules sharpening' },
            { fragmentId: 'frag_0005_a', title: 'On purpose as a force' },
            { fragmentId: 'frag_0008_a', title: 'On the fragile overlap' },
            { fragmentId: 'frag_0009_a', title: 'On attention as structure' },
            { fragmentId: 'frag_0015_a', title: 'On needing a witness' },
        ],
        // Endowed: the fourth line is the thesis itself; the room hands it over
        // first so the collection is never a wall of blanks.
        endowedFragmentId: 'frag_0009_a',
    },
];

/** Is this fragment the endowed slot of any set? */
export const isEndowedFragment = (fragmentId: string): boolean =>
    FRAGMENT_SETS.some((set) => set.endowedFragmentId === fragmentId);
