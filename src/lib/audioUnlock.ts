import { soundEngine } from './SoundEngine';

/**
 * Diegetic audio unlock. The user's first "enter" gesture (RoomEntryTransition
 * click or the prologue's advance) doubles as the Web Audio unlock: opening the
 * monitoring channel. Persists the opt-in in localStorage so the choice sticks
 * across reloads, and routes through the single soundEngine mute source of truth.
 */
export const AUDIO_OPTIN_KEY = 'delta7_audio_optin';

/** Read the persisted audio opt-in. null = never chosen; '1' = on; '0' = muted. */
export function getAudioOptIn(): '1' | '0' | null {
    try {
        const v = localStorage.getItem(AUDIO_OPTIN_KEY);
        return v === '1' || v === '0' ? v : null;
    } catch {
        return null;
    }
}

export function setAudioOptIn(enabled: boolean): void {
    try {
        localStorage.setItem(AUDIO_OPTIN_KEY, enabled ? '1' : '0');
    } catch { /* best effort */ }
}

/**
 * Fire the channel-open unlock from an entry gesture. Initializes/resumes the
 * SoundEngine, un-mutes, plays the channel-open swell, and persists opt-in.
 * If the user has explicitly muted before (opt-in '0'), this is a no-op unless
 * `force` is set — so a prior mute choice is respected on prologue-path visits.
 */
export async function openAudioChannel(options: { force?: boolean; silent?: boolean } = {}): Promise<void> {
    const optIn = getAudioOptIn();
    if (!options.force && optIn === '0') {
        // User previously muted; honour it but still resume the context so a
        // later un-mute is instant. Do not un-mute or play.
        try { await soundEngine.init({ ambience: true }); } catch { /* best effort */ }
        return;
    }

    try {
        // Un-mute synchronously inside the gesture: setMuted(false) resumes the
        // context and starts the background track (in 'track'/'hybrid' modes)
        // before any await could break the user-activation chain on iOS.
        soundEngine.setMuted(false);
        setAudioOptIn(true);
        await soundEngine.init({ ambience: true });
        // `silent` re-opens the channel without the swell — used by the
        // first-gesture resume on returning opted-in sessions, where a random
        // click shouldn't trigger the ceremony.
        if (!options.silent) soundEngine.playChannelOpen();
    } catch { /* best effort */ }
}

/**
 * Relink path: the channel is already open, just make sure the context is
 * running again (iOS suspends when backgrounded). Never changes mute state.
 */
export async function resumeAudioChannel(): Promise<void> {
    try {
        await soundEngine.init({ ambience: true });
    } catch { /* best effort */ }
}
