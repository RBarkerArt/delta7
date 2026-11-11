// Mock engine values for the OS shell. Nothing here talks to Firebase.

/**
 * Coherence lost per hour of absence (before the floor clamps it).
 * TODO(engine): the real value comes from `CoherenceContext` (src/context) — the engine's coherence
 * plugs in at `src/os/store/coherence.ts` (initial load), replacing this mocked decay.
 */
export const MOCK_DECAY_PER_HOUR = 0.02

/**
 * Story day shown in the dev panel.
 * TODO(engine): replace with `CoherenceContext.currentDay` (the player's own day clock).
 */
export const MOCK_DAY = 1
