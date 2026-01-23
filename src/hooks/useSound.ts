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
        setMuted: (muted: boolean) => soundEngine.setMuted(muted),
        isMuted: () => soundEngine.getMuted(),
        isReady: () => soundEngine.isReady(),
    };
};
