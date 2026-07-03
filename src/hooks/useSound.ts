import { soundEngine } from '../lib/SoundEngine';

/**
 * useSound hook provides a safe interface for components to interact
 * with the Delta-7 generative audio engine.
 */
export const useSound = () => {
    return {
        initializeAudio: (ambience = false) => soundEngine.init({ ambience }),
        playClick: () => soundEngine.playClick(),
        playBreathSurge: () => soundEngine.playBreathSurge(),
        playSignalNoise: (intensity?: number) => soundEngine.playSignalNoise(intensity),
        playBlip: (pitch?: 'high' | 'mid' | 'low') => soundEngine.playBlip(pitch),
        playTemporalShift: () => soundEngine.playTemporalShift(),
        playChannelOpen: () => soundEngine.playChannelOpen(),
        duck: (amount: number, seconds: number) => soundEngine.duck(amount, seconds),
        releaseDuck: (seconds: number) => soundEngine.releaseDuck(seconds),
        setRoomProfile: (roomId: 'observation' | 'break-room' | 'signal-cartography' | null) => soundEngine.setRoomProfile(roomId),
        playHotspotHover: () => soundEngine.playHotspotHover(),
        playModalOpen: (kind: 'paper' | 'instrument') => soundEngine.playModalOpen(kind),
        playDayStinger: (dayDelta: number) => soundEngine.playDayStinger(dayDelta),
        playThunder: (intensity: number) => soundEngine.playThunder(intensity),
        playStabilize: () => soundEngine.playStabilize(),
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
