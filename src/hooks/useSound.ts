import { soundEngine } from '../lib/SoundEngine';

/**
 * useSound hook provides a safe interface for components to interact
 * with the Delta-7 generative audio engine.
 */
export const useSound = () => {
    return {
        initializeAudio: () => soundEngine.init(),
        playClick: () => soundEngine.playClick(),
        playBreathSurge: () => soundEngine.playBreathSurge(),
        playSignalNoise: (intensity?: number) => soundEngine.playSignalNoise(intensity),
        playBlip: (pitch?: 'high' | 'mid' | 'low') => soundEngine.playBlip(pitch),
        playTemporalShift: () => soundEngine.playTemporalShift(),
        setMuted: (muted: boolean) => soundEngine.setMuted(muted),
        isMuted: () => soundEngine.getMuted(),
        isReady: () => soundEngine.isReady(),
        setGlobalVolume: (vol: number) => soundEngine.setGlobalVolume(vol),
        setAudioMode: (mode: 'generative' | 'track' | 'hybrid') => soundEngine.setAudioMode(mode),
        setBackgroundTrack: (url: string | null) => soundEngine.setBackgroundTrack(url),
        setIsGlobalEnabled: (enabled: boolean) => soundEngine.setIsGlobalEnabled(enabled),
        setHybridTrackVolume: (vol: number) => soundEngine.setHybridTrackVolume(vol),
    };
};
