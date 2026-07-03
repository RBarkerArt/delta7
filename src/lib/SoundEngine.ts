interface WindowWithWebkitAudio extends Window {
    webkitAudioContext?: typeof AudioContext;
}

/**
 * SoundEngine handles all audio synthesis for the Delta-7 atmosphere.
 * Designed to represent a living, breathing machine.
 */
/** Room ambience profiles layered over the coherence breath drone. */
type RoomProfileId = 'observation' | 'break-room' | 'signal-cartography';

/**
 * A self-contained ambience layer graph. Each profile owns its own gain node
 * (routed into ambienceGain) plus whatever oscillators/timers it needs, so it
 * can be crossfaded in and torn down independently of the breath system.
 */
interface AmbienceProfile {
    id: RoomProfileId;
    gain: GainNode;
    nodes: AudioScheduledSourceNode[];
    timer: number | null;
    /** Target gain when fully faded in (the profile's "voiced" level). */
    level: number;
}

class SoundEngine {
    private ctx: AudioContext | null = null;
    private masterGain: GainNode | null = null;

    // Sub-busses between sources and masterGain (all gain flows through master,
    // so the existing mute/volume plumbing is untouched).
    private ambienceGain: GainNode | null = null; // breath, room profiles, bg track
    private sfxGain: GainNode | null = null;       // clicks, blips, noise, stingers
    private uiGain: GainNode | null = null;         // distinctly-UI one-shots

    // Shared room reverb (procedural impulse) sitting on the sfx bus.
    private convolver: ConvolverNode | null = null;
    private reverbWetGain: GainNode | null = null;

    // Active room ambience profile (crossfaded on setRoomProfile).
    private currentProfile: AmbienceProfile | null = null;
    private duckAmount = 1; // multiplier on ambience bus for modal ducking
    private ambienceModeActive = true; // generative ambient layer allowed by audioMode
    private desiredProfile: RoomProfileId | null = null; // remembered until init

    // Core breath system
    private breathOsc: OscillatorNode | null = null;
    private breathGain: GainNode | null = null;
    private breathFilter: BiquadFilterNode | null = null;

    // Harmonic layer (adds body)
    private harmonicOsc: OscillatorNode | null = null;
    private harmonicGain: GainNode | null = null;

    // LFO for breathing modulation
    private lfoOsc: OscillatorNode | null = null;
    private lfoGain: GainNode | null = null;

    private initialized = false;
    private muted = false;
    private currentScore = 100;

    // Background Track System
    private bgAudio: HTMLAudioElement | null = null;
    private bgTrackUrl: string | null = null;
    private globalVolume: number = 1.0;
    private audioMode: 'generative' | 'track' | 'hybrid' = 'generative';
    private isGlobalEnabled: boolean = true;
    private hybridTrackVolume: number = 0.02;

    public async init(options: { ambience?: boolean } = {}): Promise<boolean> {
        const shouldRunAmbience = options.ambience ?? false;

        if (this.initialized && this.ctx?.state === 'running') {
            if (shouldRunAmbience && !this.breathOsc) {
                this.setupBreathSystem();
            }
            this.applyDesiredProfile();
            return true;
        }

        try {
            if (!this.ctx) {
                const AudioContextCtor = window.AudioContext || (window as WindowWithWebkitAudio).webkitAudioContext;
                if (!AudioContextCtor) throw new Error('Web Audio API unavailable');
                this.ctx = new AudioContextCtor();
            }

            if (this.ctx.state === 'suspended' && !this.muted) {
                await this.ctx.resume();
            }

            if (!this.masterGain) {
                this.masterGain = this.ctx.createGain();
                this.masterGain.connect(this.ctx.destination);
                this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.3, this.ctx.currentTime);
            }

            this.setupBusses();

            if (shouldRunAmbience) {
                this.setupBreathSystem();
            }
            this.initialized = true;
            this.setupVisibilityResume();
            this.applyDesiredProfile();
            console.log('[SoundEngine] Audio link established.');
            return true;
        } catch (err) {
            console.warn('[SoundEngine] Audio failure:', err);
            return false;
        }
    }

    /**
     * Insert three sub-busses between sources and masterGain. Non-breaking:
     * everything still terminates at masterGain, so global mute/volume is
     * unchanged. Ambience = breath/room profiles; sfx = clicks/blips/stingers
     * (with a shared reverb send); ui = distinctly-UI one-shots.
     */
    private setupBusses() {
        if (!this.ctx || !this.masterGain) return;
        if (this.ambienceGain && this.sfxGain && this.uiGain) return;

        try {
            const now = this.ctx.currentTime;

            this.ambienceGain = this.ctx.createGain();
            this.ambienceGain.gain.setValueAtTime(1, now);
            this.ambienceGain.connect(this.masterGain);

            this.sfxGain = this.ctx.createGain();
            this.sfxGain.gain.setValueAtTime(1, now);
            this.sfxGain.connect(this.masterGain);

            this.uiGain = this.ctx.createGain();
            this.uiGain.gain.setValueAtTime(1, now);
            this.uiGain.connect(this.masterGain);

            // Shared room reverb on the sfx bus: procedural impulse generated
            // once. Clicks/blips can route a wet copy through it so interactions
            // sound like they happen in the room.
            this.convolver = this.ctx.createConvolver();
            this.convolver.buffer = this.createReverbImpulse(0.7);
            this.reverbWetGain = this.ctx.createGain();
            this.reverbWetGain.gain.setValueAtTime(1, now);
            this.convolver.connect(this.reverbWetGain);
            this.reverbWetGain.connect(this.sfxGain);
        } catch { /* best effort */ }
    }

    /**
     * Procedural impulse response: exponentially decaying stereo noise. Built
     * once into an AudioBuffer and reused by the shared convolver.
     */
    private createReverbImpulse(seconds: number): AudioBuffer {
        const rate = this.ctx!.sampleRate;
        const length = Math.max(1, Math.floor(rate * seconds));
        const impulse = this.ctx!.createBuffer(2, length, rate);
        for (let ch = 0; ch < 2; ch++) {
            const data = impulse.getChannelData(ch);
            for (let i = 0; i < length; i++) {
                const decay = Math.pow(1 - i / length, 2.6);
                data[i] = (Math.random() * 2 - 1) * decay;
            }
        }
        return impulse;
    }

    /**
     * Route a short one-shot node through the room reverb with a wet/dry mix
     * (~25% wet). `source` is the node to tap; it should already be started by
     * the caller. Returns nothing — connects dry to sfx and wet to convolver.
     */
    private connectWithReverb(source: AudioNode, wet = 0.25) {
        if (!this.sfxGain) return;
        try {
            const dry = this.ctx!.createGain();
            dry.gain.value = 1 - wet;
            source.connect(dry);
            dry.connect(this.sfxGain);

            if (this.convolver) {
                const send = this.ctx!.createGain();
                send.gain.value = wet;
                source.connect(send);
                send.connect(this.convolver);
            }
        } catch { /* best effort */ }
    }

    /**
     * iOS suspends the AudioContext when the page is backgrounded; resume it
     * when we become visible again (respecting the user's mute choice).
     */
    private visibilityHandlerBound = false;
    private setupVisibilityResume() {
        if (this.visibilityHandlerBound || typeof document === 'undefined') return;
        this.visibilityHandlerBound = true;
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState !== 'visible') return;
            if (this.muted || !this.ctx) return;
            if (this.ctx.state === 'suspended') {
                this.ctx.resume().catch(() => { /* best effort */ });
            }
        });
    }

    private setupBreathSystem() {
        if (!this.ctx || !this.masterGain) return;

        try {
            const now = this.ctx.currentTime;

            // Main Breath
            this.breathOsc = this.ctx.createOscillator();
            this.breathGain = this.ctx.createGain();
            this.breathFilter = this.ctx.createBiquadFilter();

            this.breathOsc.type = 'sawtooth';
            this.breathOsc.frequency.setValueAtTime(48, now);

            this.breathFilter.type = 'lowpass';
            this.breathFilter.frequency.setValueAtTime(120, now);
            this.breathFilter.Q.setValueAtTime(1, now);

            this.breathGain.gain.setValueAtTime(0.04, now);

            // Harmonic
            this.harmonicOsc = this.ctx.createOscillator();
            this.harmonicGain = this.ctx.createGain();
            this.harmonicOsc.type = 'sine';
            this.harmonicOsc.frequency.setValueAtTime(96, now);
            this.harmonicGain.gain.setValueAtTime(0.015, now);

            // LFO
            this.lfoOsc = this.ctx.createOscillator();
            this.lfoGain = this.ctx.createGain();
            this.lfoOsc.frequency.setValueAtTime(0.12, now);
            this.lfoGain.gain.setValueAtTime(0, now);

            // Connections
            this.lfoOsc.connect(this.lfoGain);
            this.lfoGain.connect(this.breathGain.gain);

            const ambienceBus = this.ambienceGain ?? this.masterGain;

            this.breathOsc.connect(this.breathFilter);
            this.breathFilter.connect(this.breathGain);
            this.breathGain.connect(ambienceBus);

            this.harmonicOsc.connect(this.harmonicGain);
            this.harmonicGain.connect(ambienceBus);

            this.breathOsc.start();
            this.harmonicOsc.start();
            this.lfoOsc.start();
        } catch {
            // Silent fail
        }
    }

    setMuted(muted: boolean) {
        this.muted = muted;

        // Immediate mute/unmute for master gain (generative audio)
        if (this.masterGain && this.ctx) {
            const now = this.ctx.currentTime;
            if (muted) {
                // Immediate silence
                this.masterGain.gain.cancelScheduledValues(now);
                this.masterGain.gain.setValueAtTime(0, now);
                // Suspend AudioContext to guarantee silence
                this.ctx.suspend().catch(() => { /* best effort */ });
            } else {
                // Resume AudioContext first
                this.ctx.resume().then(() => {
                    if (this.masterGain && this.ctx) {
                        // Restore with short ramp
                        this.masterGain.gain.setTargetAtTime(0.3 * this.globalVolume, this.ctx.currentTime, 0.1);
                    }
                }).catch(() => { /* best effort */ });
            }
        }

        // Immediately pause/resume background track
        if (this.bgAudio) {
            if (muted) {
                this.bgAudio.pause();
            } else if (this.isGlobalEnabled && (this.audioMode === 'track' || this.audioMode === 'hybrid')) {
                this.bgAudio.play().catch(() => { /* best effort */ });
            }
        }

        this.updateVolumes();
    }

    getMuted(): boolean {
        return this.muted;
    }

    setGlobalVolume(volume: number) {
        this.globalVolume = Math.max(0, Math.min(1, volume));
        this.updateVolumes();
    }

    setAudioMode(mode: 'generative' | 'track' | 'hybrid') {
        this.audioMode = mode;
        this.updateVolumes();
    }

    setBackgroundTrack(url: string | null) {
        if (this.bgTrackUrl === url) return;

        this.bgTrackUrl = url;

        if (this.bgAudio) {
            this.bgAudio.pause();
            this.bgAudio = null;
        }

        if (url) {
            this.bgAudio = new Audio(url);
            this.bgAudio.loop = true;

            // Debug listeners
            this.bgAudio.addEventListener('canplay', () => console.log('[SoundEngine] Track loaded and ready to play'));
            this.bgAudio.addEventListener('playing', () => console.log('[SoundEngine] Track is playing'));
            this.bgAudio.addEventListener('error', () => {
                const error = this.bgAudio?.error;
                console.error('[SoundEngine] Track error:', error?.code, error?.message);
            });

            console.log('[SoundEngine] Background track set:', url);
            this.updateVolumes();

            // Attempt to play if allowed
            if (this.initialized && !this.muted && this.isGlobalEnabled) {
                const playPromise = this.bgAudio.play();
                if (playPromise !== undefined) {
                    playPromise
                        .then(() => console.log("[SoundEngine] Playback started successfully"))
                        .catch(e => console.warn("[SoundEngine] Autoplay blocked/failed:", e));
                }
            }
        }
    }

    setIsGlobalEnabled(enabled: boolean) {
        this.isGlobalEnabled = enabled;

        // DO NOT override user's mute state. 
        // Audio plays only if (isGlobalEnabled && !muted).
        // This decouples the system switch (admin) from the user switch (mute).

        // Handle background track play/pause specifically
        if (this.bgAudio) {
            if (enabled && !this.muted && (this.audioMode === 'track' || this.audioMode === 'hybrid')) {
                this.bgAudio.play().catch(() => { /* best effort */ });
            } else {
                this.bgAudio.pause();
            }
        }

        this.updateVolumes();
    }

    setHybridTrackVolume(volume: number) {
        this.hybridTrackVolume = Math.max(0, Math.min(1, volume));
        this.updateVolumes();
    }

    private updateVolumes() {
        const now = this.ctx?.currentTime || 0;
        const rampTime = 0.5;
        const isAudible = !this.muted && this.isGlobalEnabled;
        const isGenActive = (this.audioMode === 'generative' || this.audioMode === 'hybrid') && isAudible;
        const isTrackActive = (this.audioMode === 'track' || this.audioMode === 'hybrid') && isAudible;

        // 1. Master gain carries ALL Web Audio output (sfx, UI, ambience buses).
        // It is gated only by mute/global-enable — the audioMode chooses which
        // AMBIENT layer plays (generative bus vs background track), not whether
        // interactions sound: a 'track' mode room must still click and blip.
        if (this.masterGain && this.ctx) {
            const targetGain = isAudible ? (0.3 * this.globalVolume) : 0;
            try {
                this.masterGain.gain.setTargetAtTime(targetGain, now, rampTime);
            } catch { /* best effort */ }
        }

        // 1b. The generative ambient layer (breath drone + room profiles) follows
        // the mode via the ambience bus, composed with any active duck.
        this.ambienceModeActive = isGenActive;
        this.applyAmbienceGain(rampTime);

        // 2. Update Background Track Volume
        if (this.bgAudio) {
            let baseVol = 1.0;
            if (this.audioMode === 'hybrid') {
                baseVol = this.hybridTrackVolume; // Use configurable hybrid volume
            }

            const targetBgVol = isTrackActive ? (baseVol * this.globalVolume) : 0;
            this.bgAudio.volume = targetBgVol;
            // console.log(`[SoundEngine] Vol Update: Global=${this.globalVolume}, Mode=${this.audioMode}, BG Target=${targetBgVol.toFixed(4)}`);
        }
    }

    isReady(): boolean {
        return this.initialized && this.ctx?.state === 'running';
    }

    setCoherence(score: number) {
        this.currentScore = score;
        if (!this.isReady() || !this.breathOsc || !this.breathFilter || !this.lfoGain || !this.lfoOsc || !this.breathGain) return;

        try {
            const now = this.ctx!.currentTime;
            const t = 1.5; // Time constant for transitions

            if (score >= 70) {
                // STABLE
                this.breathOsc.type = 'sawtooth';
                this.breathOsc.frequency.setTargetAtTime(48, now, t);
                this.breathFilter.frequency.setTargetAtTime(120, now, t);
                this.breathFilter.Q.setTargetAtTime(1, now, t);
                this.lfoGain.gain.setTargetAtTime(0, now, t);
                this.breathGain.gain.setTargetAtTime(0.04, now, t);
            } else if (score >= 45) {
                // FRAYING
                const instability = (70 - score) / 25;
                this.breathOsc.type = 'sawtooth';
                this.breathOsc.frequency.setTargetAtTime(48 + (Math.random() * 4 - 2) * instability, now, t);
                this.breathFilter.frequency.setTargetAtTime(100 + instability * 20, now, t);
                this.lfoGain.gain.setTargetAtTime(0.003 * instability, now, t);
                this.lfoOsc.frequency.setTargetAtTime(0.12, now, t);
            } else if (score >= 20) {
                // FRAGMENTED
                const struggle = (45 - score) / 25;
                this.breathOsc.type = 'sawtooth';
                this.breathOsc.frequency.setTargetAtTime(45 - struggle * 3, now, t);
                this.breathFilter.frequency.setTargetAtTime(80 + struggle * 40, now, t);
                this.breathFilter.Q.setTargetAtTime(2 + struggle * 3, now, t);
                this.lfoGain.gain.setTargetAtTime(0.008 + struggle * 0.006, now, t);
                this.lfoOsc.frequency.setTargetAtTime(0.25 + struggle * 0.15, now, t);
            } else {
                // CRITICAL
                const withdrawal = (20 - score) / 20;
                this.breathOsc.type = 'sine';
                this.breathOsc.frequency.setTargetAtTime(40 - withdrawal * 8, now, t);
                this.breathGain.gain.setTargetAtTime(0.012 - withdrawal * 0.008, now, t);
                this.lfoGain.gain.setTargetAtTime(0.004 - withdrawal * 0.003, now, t);
                this.lfoOsc.frequency.setTargetAtTime(0.08, now, t);
            }
        } catch { /* silent */ }
    }

    public playBreathSurge(): void {
        if (!this.ctx || !this.masterGain || this.muted) return;
        if (this.currentScore > 50) return;

        try {
            if (this.ctx.state === 'suspended') this.ctx.resume();
            const now = this.ctx.currentTime;
            const intensity = (50 - this.currentScore) / 50;

            const bufferSize = this.ctx.sampleRate * 0.3;
            const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const output = noiseBuffer.getChannelData(0);

            let lastOut = 0;
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                output[i] = (lastOut + (0.02 * white)) / 1.02;
                lastOut = output[i];
                output[i] *= 3.5;
            }

            const noise = this.ctx.createBufferSource();
            noise.buffer = noiseBuffer;

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(200 + intensity * 300, now);
            filter.Q.setValueAtTime(2 + intensity * 3, now);

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.015 + intensity * 0.02, now + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.sfxGain ?? this.masterGain);

            noise.start(now);
            noise.stop(now + 0.3);
        } catch { /* silent */ }
    }

    playGlitch() {
        this.playBreathSurge();
    }

    playPhantomClick() {
        this.playClick();
    }

    playClick() {
        if (!this.isReady() || !this.ctx || !this.masterGain || this.muted) return;

        try {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const filter = this.ctx.createBiquadFilter();

            filter.type = 'bandpass';

            if (this.currentScore >= 70) {
                // Confident
                osc.type = 'square';
                osc.frequency.setValueAtTime(180, now);
                osc.frequency.exponentialRampToValueAtTime(80, now + 0.045);
                filter.frequency.setValueAtTime(1200, now);
                gain.gain.setValueAtTime(0.08, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
            } else if (this.currentScore >= 45) {
                // Unsteady
                osc.type = 'square';
                const detune = Math.random() * 30 - 15;
                osc.frequency.setValueAtTime(180 + detune, now);
                osc.frequency.exponentialRampToValueAtTime(80 + detune, now + 0.045);
                filter.frequency.setValueAtTime(1200 + (Math.random() * 200 - 100), now);
                gain.gain.setValueAtTime(0.06, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
            } else if (this.currentScore >= 20) {
                // Glitchy
                osc.type = Math.random() > 0.5 ? 'square' : 'sawtooth';
                const detune = Math.random() * 60 - 30;
                osc.frequency.setValueAtTime(180 + detune, now);
                filter.frequency.setValueAtTime(1200 + detune * 5, now);
                gain.gain.setValueAtTime(0.04 + Math.random() * 0.02, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

                // Occasional double click
                if (Math.random() < 0.15) {
                    setTimeout(() => this.playClick(), 30 + Math.random() * 40);
                }
            } else {
                // Weak
                osc.type = 'sine';
                osc.frequency.setValueAtTime(100, now);
                gain.gain.setValueAtTime(0.015, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
            }

            osc.connect(filter);
            filter.connect(gain);
            // Interactions happen in the room: send clicks through the reverb.
            this.connectWithReverb(gain);

            osc.start(now);
            osc.stop(now + 0.05);
        } catch { /* silent */ }
    }

    /**
     * Signal Noise - Static burst that increases with low coherence
     * Call this during glitch events for auditory feedback
     */
    playSignalNoise(intensity: number = 0.5) {
        if (!this.isReady() || !this.ctx || !this.masterGain || this.muted) return;

        try {
            const now = this.ctx.currentTime;
            const duration = 0.1 + intensity * 0.2;

            // Create noise buffer
            const bufferSize = this.ctx.sampleRate * duration;
            const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const output = noiseBuffer.getChannelData(0);

            for (let i = 0; i < bufferSize; i++) {
                output[i] = (Math.random() * 2 - 1) * 0.5;
            }

            const noise = this.ctx.createBufferSource();
            noise.buffer = noiseBuffer;

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.setValueAtTime(2000 + intensity * 3000, now);

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.03 * intensity, now + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.sfxGain ?? this.masterGain);

            noise.start(now);
            noise.stop(now + duration);
        } catch { /* silent */ }
    }

    /**
     * Blip - Subtle notification tone for events (fragments appearing, etc)
     */
    playBlip(pitch: 'high' | 'mid' | 'low' = 'mid') {
        if (!this.isReady() || !this.ctx || !this.masterGain || this.muted) return;

        try {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';

            const frequencies = { high: 880, mid: 440, low: 220 };
            const baseFreq = frequencies[pitch];

            osc.frequency.setValueAtTime(baseFreq, now);
            osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.8, now + 0.1);

            gain.gain.setValueAtTime(0.04, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

            osc.connect(gain);
            this.connectWithReverb(gain);

            osc.start(now);
            osc.stop(now + 0.15);
        } catch { /* silent */ }
    }

    /**
     * Temporal Shift - Day transition sound effect
     * Creates an otherworldly sweep with harmonics
     */
    playTemporalShift() {
        if (!this.isReady() || !this.ctx || !this.masterGain || this.muted) return;

        try {
            const now = this.ctx.currentTime;

            // Main sweep oscillator
            const osc1 = this.ctx.createOscillator();
            const gain1 = this.ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(100, now);
            osc1.frequency.exponentialRampToValueAtTime(800, now + 0.5);
            osc1.frequency.exponentialRampToValueAtTime(200, now + 1.5);

            gain1.gain.setValueAtTime(0, now);
            gain1.gain.linearRampToValueAtTime(0.06, now + 0.3);
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

            // Harmonic layer
            const osc2 = this.ctx.createOscillator();
            const gain2 = this.ctx.createGain();
            osc2.type = 'triangle';
            osc2.frequency.setValueAtTime(200, now);
            osc2.frequency.exponentialRampToValueAtTime(1600, now + 0.5);
            osc2.frequency.exponentialRampToValueAtTime(400, now + 1.5);

            gain2.gain.setValueAtTime(0, now);
            gain2.gain.linearRampToValueAtTime(0.03, now + 0.3);
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

            // Noise burst
            const noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.5, this.ctx.sampleRate);
            const noiseData = noiseBuffer.getChannelData(0);
            for (let i = 0; i < noiseData.length; i++) {
                noiseData[i] = (Math.random() * 2 - 1) * 0.3;
            }

            const noise = this.ctx.createBufferSource();
            noise.buffer = noiseBuffer;

            const noiseFilter = this.ctx.createBiquadFilter();
            noiseFilter.type = 'bandpass';
            noiseFilter.frequency.setValueAtTime(400, now);
            noiseFilter.frequency.exponentialRampToValueAtTime(2000, now + 0.3);
            noiseFilter.Q.setValueAtTime(5, now);

            const noiseGain = this.ctx.createGain();
            noiseGain.gain.setValueAtTime(0, now);
            noiseGain.gain.linearRampToValueAtTime(0.04, now + 0.1);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

            // Connections
            const bus = this.sfxGain ?? this.masterGain;
            osc1.connect(gain1);
            gain1.connect(bus);

            osc2.connect(gain2);
            gain2.connect(bus);

            noise.connect(noiseFilter);
            noiseFilter.connect(noiseGain);
            noiseGain.connect(bus);

            // Start all
            osc1.start(now);
            osc2.start(now);
            noise.start(now);

            osc1.stop(now + 1.5);
            osc2.stop(now + 1.5);
            noise.stop(now + 0.5);

            console.log('[SoundEngine] Temporal shift audio triggered');
        } catch { /* silent */ }
    }

    /**
     * Channel Open - the diegetic audio-unlock gesture. A filtered-noise swell
     * that resolves into the breath drone over ~1.5s: opening the monitoring
     * channel. Ensures the context is running and the breath system exists.
     */
    public playChannelOpen(): void {
        if (!this.ctx || !this.masterGain) return;

        try {
            if (this.ctx.state === 'suspended') this.ctx.resume();
            this.setupBusses();
            // Bring up the persistent breath drone underneath the swell.
            if (!this.breathOsc) this.setupBreathSystem();

            const now = this.ctx.currentTime;
            const bus = this.ambienceGain ?? this.masterGain;

            // Filtered-noise swell: brown noise sweeping open through a lowpass,
            // resolving as the drone settles in (same noise-buffer idiom as
            // playBreathSurge / playTemporalShift).
            const bufferSize = Math.floor(this.ctx.sampleRate * 1.5);
            const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const output = noiseBuffer.getChannelData(0);
            let lastOut = 0;
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                output[i] = (lastOut + (0.02 * white)) / 1.02;
                lastOut = output[i];
                output[i] *= 3.5;
            }

            const noise = this.ctx.createBufferSource();
            noise.buffer = noiseBuffer;

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(180, now);
            filter.frequency.exponentialRampToValueAtTime(1400, now + 0.6);
            filter.frequency.exponentialRampToValueAtTime(220, now + 1.5);
            filter.Q.setValueAtTime(1.5, now);

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.05, now + 0.5);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

            // Confirming sine that resolves into the drone's harmonic register.
            const osc = this.ctx.createOscillator();
            const oscGain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(320, now);
            osc.frequency.exponentialRampToValueAtTime(96, now + 1.3);
            oscGain.gain.setValueAtTime(0, now);
            oscGain.gain.linearRampToValueAtTime(0.02, now + 0.4);
            oscGain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(bus);

            osc.connect(oscGain);
            oscGain.connect(bus);

            noise.start(now);
            noise.stop(now + 1.5);
            osc.start(now);
            osc.stop(now + 1.5);

            console.log('[SoundEngine] Channel open triggered.');
        } catch { /* silent */ }
    }

    // ---------------------------------------------------------------------
    // Modal ducking: attenuate the ambience bus while a modal is open, then
    // release. duckAmount is the multiplier the caller wants; the ambience bus
    // base gain is otherwise 1, so ducking and any future ambience-level
    // changes compose by writing the composed value rather than overwriting.
    // ---------------------------------------------------------------------

    /** Apply the composed ambience-bus gain (mode gate * duck) with a smooth ramp. */
    private applyAmbienceGain(seconds: number) {
        if (!this.ctx || !this.ambienceGain) return;
        try {
            const now = this.ctx.currentTime;
            const target = (this.ambienceModeActive ? 1 : 0) * this.duckAmount;
            // setTargetAtTime uses a time-constant; ~1/3 of the desired glide.
            this.ambienceGain.gain.setTargetAtTime(target, now, Math.max(0.01, seconds / 3));
        } catch { /* best effort */ }
    }

    /** Duck the ambience bus to `amount` (0..1) over `seconds` (e.g. modal open). */
    public duck(amount: number, seconds: number): void {
        this.duckAmount = Math.max(0, Math.min(1, amount));
        this.applyAmbienceGain(seconds);
    }

    /** Release a prior duck, returning the ambience bus to full over `seconds`. */
    public releaseDuck(seconds: number): void {
        this.duckAmount = 1;
        this.applyAmbienceGain(seconds);
    }

    // ---------------------------------------------------------------------
    // Room ambience profiles. Each profile is a self-contained node graph with
    // its own gain routed into the ambience bus, crossfaded in over ~2s. They
    // layer OVER the persistent breath drone (which plays everywhere). Passing
    // null tears the active profile down. Callable before init (remembered).
    // ---------------------------------------------------------------------

    private static readonly PROFILE_FADE = 2; // seconds

    /** Apply the profile requested before init once the engine is ready. */
    private applyDesiredProfile() {
        if (this.desiredProfile !== (this.currentProfile?.id ?? null)) {
            const desired = this.desiredProfile;
            this.setRoomProfile(desired);
        }
    }

    public setRoomProfile(roomId: RoomProfileId | null): void {
        this.desiredProfile = roomId;

        // Not ready yet — remember; init() will apply once busses exist.
        if (!this.isReady() || !this.ctx || !this.ambienceGain) return;

        // Already showing this profile: nothing to do.
        if (this.currentProfile && this.currentProfile.id === roomId) return;

        // Tear down whatever is currently voiced (crossfade out + cleanup).
        if (this.currentProfile) {
            this.teardownProfile(this.currentProfile, SoundEngine.PROFILE_FADE);
            this.currentProfile = null;
        }

        if (!roomId || roomId === 'observation') {
            // Observation = breath alone; no extra layer.
            return;
        }

        try {
            const profile = roomId === 'break-room'
                ? this.buildBreakRoomProfile()
                : this.buildSignalCartographyProfile();
            if (profile) this.currentProfile = profile;
        } catch { /* best effort */ }
    }

    /** Fade an ambience profile out over `seconds`, then stop + free its nodes. */
    private teardownProfile(profile: AmbienceProfile, seconds: number) {
        if (!this.ctx) return;
        try {
            const now = this.ctx.currentTime;
            profile.gain.gain.cancelScheduledValues(now);
            profile.gain.gain.setValueAtTime(profile.gain.gain.value, now);
            profile.gain.gain.setTargetAtTime(0, now, Math.max(0.01, seconds / 3));

            if (profile.timer !== null) {
                clearTimeout(profile.timer);
                profile.timer = null;
            }

            const stopAt = now + seconds + 0.5;
            for (const node of profile.nodes) {
                try { node.stop(stopAt); } catch { /* already stopped */ }
            }
            // Disconnect the gain once faded so it stops touching the bus.
            window.setTimeout(() => {
                try { profile.gain.disconnect(); } catch { /* best effort */ }
            }, (seconds + 0.6) * 1000);
        } catch { /* best effort */ }
    }

    /**
     * Break room: a very quiet ~60Hz sine "fridge hum" with a subtle ~0.5Hz
     * amplitude-mod LFO, plus a soft compressor click-off every 40-90s.
     *
     * Graph: hum(60Hz sine) -> humGain(base ~0.024, modulated by LFO) -> profileGain -> ambienceBus
     *        modLfo(0.5Hz) -> modDepth(~0.01) -> humGain.gain (amplitude wobble)
     */
    private buildBreakRoomProfile(): AmbienceProfile | null {
        if (!this.ctx || !this.ambienceGain) return null;
        const now = this.ctx.currentTime;
        const level = 0.03;

        const profileGain = this.ctx.createGain();
        profileGain.gain.setValueAtTime(0, now);
        profileGain.gain.setTargetAtTime(level, now, SoundEngine.PROFILE_FADE / 3);
        profileGain.connect(this.ambienceGain);

        const hum = this.ctx.createOscillator();
        hum.type = 'sine';
        hum.frequency.setValueAtTime(60, now);

        const humGain = this.ctx.createGain();
        humGain.gain.setValueAtTime(0.024, now);

        // ~0.5Hz amplitude wobble.
        const modLfo = this.ctx.createOscillator();
        modLfo.type = 'sine';
        modLfo.frequency.setValueAtTime(0.5, now);
        const modDepth = this.ctx.createGain();
        modDepth.gain.setValueAtTime(0.01, now);
        modLfo.connect(modDepth);
        modDepth.connect(humGain.gain);

        hum.connect(humGain);
        humGain.connect(profileGain);

        hum.start(now);
        modLfo.start(now);

        const profile: AmbienceProfile = {
            id: 'break-room',
            gain: profileGain,
            nodes: [hum, modLfo],
            timer: null,
            level,
        };

        // Soft compressor click-off every 40-90s (random-interval scheduling).
        const scheduleClickOff = () => {
            const delay = 40000 + Math.random() * 50000;
            profile.timer = window.setTimeout(() => {
                this.playFridgeClickOff(profileGain);
                scheduleClickOff();
            }, delay);
        };
        scheduleClickOff();

        return profile;
    }

    /** Soft thunk of a fridge compressor cutting out: short lowpassed click. */
    private playFridgeClickOff(dest: AudioNode) {
        if (!this.ctx) return;
        try {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(120, now);
            osc.frequency.exponentialRampToValueAtTime(40, now + 0.08);

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(200, now);

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.03, now);
            gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.12);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(dest);

            osc.start(now);
            osc.stop(now + 0.14);
        } catch { /* best effort */ }
    }

    /**
     * Signal cartography: a shortwave heterodyne whistle — two detuned sines
     * (~410/413Hz) beating at ~3Hz through a bandpass, very quiet, plus sparse
     * needle ticks (short filtered clicks) every 8-20s.
     *
     * Graph: oscA(410) + oscB(413) -> bandpass(~410, Q~8) -> profileGain -> ambienceBus
     */
    private buildSignalCartographyProfile(): AmbienceProfile | null {
        if (!this.ctx || !this.ambienceGain) return null;
        const now = this.ctx.currentTime;
        const level = 0.022;

        const profileGain = this.ctx.createGain();
        profileGain.gain.setValueAtTime(0, now);
        profileGain.gain.setTargetAtTime(level, now, SoundEngine.PROFILE_FADE / 3);

        const bandpass = this.ctx.createBiquadFilter();
        bandpass.type = 'bandpass';
        bandpass.frequency.setValueAtTime(410, now);
        bandpass.Q.setValueAtTime(8, now);
        bandpass.connect(profileGain);
        profileGain.connect(this.ambienceGain);

        const oscA = this.ctx.createOscillator();
        oscA.type = 'sine';
        oscA.frequency.setValueAtTime(410, now);
        const oscB = this.ctx.createOscillator();
        oscB.type = 'sine';
        oscB.frequency.setValueAtTime(413, now); // ~3Hz beat

        const mix = this.ctx.createGain();
        mix.gain.setValueAtTime(0.5, now);
        oscA.connect(mix);
        oscB.connect(mix);
        mix.connect(bandpass);

        oscA.start(now);
        oscB.start(now);

        const profile: AmbienceProfile = {
            id: 'signal-cartography',
            gain: profileGain,
            nodes: [oscA, oscB],
            timer: null,
            level,
        };

        // Sparse needle ticks every 8-20s.
        const scheduleTick = () => {
            const delay = 8000 + Math.random() * 12000;
            profile.timer = window.setTimeout(() => {
                this.playNeedleTick(profileGain);
                scheduleTick();
            }, delay);
        };
        scheduleTick();

        return profile;
    }

    /** Short filtered click: a plotter needle ticking against paper. */
    private playNeedleTick(dest: AudioNode) {
        if (!this.ctx) return;
        try {
            const now = this.ctx.currentTime;
            const bufferSize = Math.floor(this.ctx.sampleRate * 0.02);
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1);

            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer;

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(2600, now);
            filter.Q.setValueAtTime(6, now);

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.04, now);
            gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.02);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(dest);

            noise.start(now);
            noise.stop(now + 0.03);
        } catch { /* best effort */ }
    }

    // ---------------------------------------------------------------------
    // One-shots (through the sfx bus; some via the shared reverb).
    // ---------------------------------------------------------------------

    /** Near-silent 30ms filtered tick for hotspot hover. */
    public playHotspotHover(): void {
        if (!this.isReady() || !this.ctx || this.muted) return;
        try {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(2200, now);
            osc.frequency.exponentialRampToValueAtTime(1400, now + 0.03);

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.setValueAtTime(1200, now);

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.012, now);
            gain.gain.exponentialRampToValueAtTime(0.0006, now + 0.03);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.sfxGain ?? this.masterGain!);

            osc.start(now);
            osc.stop(now + 0.035);
        } catch { /* best effort */ }
    }

    /**
     * Modal open cue. paper = low filtered-noise "shf" (~120ms). instrument =
     * a blip routed through the convolver (sounds like it's in the room).
     */
    public playModalOpen(kind: 'paper' | 'instrument'): void {
        if (!this.isReady() || !this.ctx || this.muted) return;
        try {
            const now = this.ctx.currentTime;

            if (kind === 'paper') {
                const bufferSize = Math.floor(this.ctx.sampleRate * 0.12);
                const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1);

                const noise = this.ctx.createBufferSource();
                noise.buffer = buffer;

                const filter = this.ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(900, now);
                filter.Q.setValueAtTime(0.7, now);

                const gain = this.ctx.createGain();
                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(0.05, now + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.12);

                noise.connect(filter);
                filter.connect(gain);
                this.connectWithReverb(gain, 0.2);

                noise.start(now);
                noise.stop(now + 0.13);
            } else {
                const osc = this.ctx.createOscillator();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(660, now);
                osc.frequency.exponentialRampToValueAtTime(880, now + 0.09);

                const gain = this.ctx.createGain();
                gain.gain.setValueAtTime(0.05, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

                osc.connect(gain);
                // Route heavier into the room reverb for an instrument feel.
                this.connectWithReverb(gain, 0.4);

                osc.start(now);
                osc.stop(now + 0.16);
            }
        } catch { /* best effort */ }
    }

    /**
     * Day stinger: a variant of playTemporalShift whose pitch/darkness scales
     * with the number of missed days (capped at 5). More days = lower, darker.
     */
    public playDayStinger(dayDelta: number): void {
        if (!this.isReady() || !this.ctx || !this.masterGain || this.muted) return;
        try {
            const now = this.ctx.currentTime;
            const scaled = Math.min(5, Math.max(0, Math.abs(dayDelta)));
            const darkness = scaled / 5; // 0 = bright, 1 = darkest

            const bus = this.sfxGain ?? this.masterGain;

            // Main sweep — starts lower and resolves lower as darkness rises.
            const osc1 = this.ctx.createOscillator();
            const gain1 = this.ctx.createGain();
            osc1.type = 'sine';
            const peak = 800 - darkness * 500;
            const settle = 200 - darkness * 100;
            osc1.frequency.setValueAtTime(100, now);
            osc1.frequency.exponentialRampToValueAtTime(Math.max(120, peak), now + 0.5);
            osc1.frequency.exponentialRampToValueAtTime(Math.max(70, settle), now + 1.6);
            gain1.gain.setValueAtTime(0, now);
            gain1.gain.linearRampToValueAtTime(0.05 + darkness * 0.02, now + 0.3);
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 1.6);

            // Harmonic layer, dimmed by darkness via a lowpass.
            const osc2 = this.ctx.createOscillator();
            const gain2 = this.ctx.createGain();
            osc2.type = 'triangle';
            osc2.frequency.setValueAtTime(200, now);
            osc2.frequency.exponentialRampToValueAtTime(Math.max(240, peak * 2), now + 0.5);
            osc2.frequency.exponentialRampToValueAtTime(Math.max(140, settle * 2), now + 1.6);

            const dimFilter = this.ctx.createBiquadFilter();
            dimFilter.type = 'lowpass';
            dimFilter.frequency.setValueAtTime(4000 - darkness * 3200, now);

            gain2.gain.setValueAtTime(0, now);
            gain2.gain.linearRampToValueAtTime(0.03, now + 0.3);
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.6);

            osc1.connect(gain1);
            gain1.connect(bus);
            osc2.connect(dimFilter);
            dimFilter.connect(gain2);
            gain2.connect(bus);

            osc1.start(now);
            osc2.start(now);
            osc1.stop(now + 1.6);
            osc2.stop(now + 1.6);
        } catch { /* best effort */ }
    }

    /**
     * Thunder: a lowpassed brown-noise rumble ~2s. `intensity` (0..1) scales
     * both amplitude and lowpass cutoff (louder + brighter when closer).
     */
    public playThunder(intensity: number): void {
        if (!this.isReady() || !this.ctx || !this.masterGain || this.muted) return;
        try {
            const now = this.ctx.currentTime;
            const amt = Math.max(0, Math.min(1, intensity));
            const duration = 2;

            const bufferSize = Math.floor(this.ctx.sampleRate * duration);
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const output = buffer.getChannelData(0);
            let lastOut = 0;
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                output[i] = (lastOut + (0.02 * white)) / 1.02;
                lastOut = output[i];
                output[i] *= 3.5;
            }

            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer;

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            const cutoff = 120 + amt * 380; // 120..500 Hz
            filter.frequency.setValueAtTime(cutoff, now);
            filter.frequency.exponentialRampToValueAtTime(Math.max(60, cutoff * 0.4), now + duration);
            filter.Q.setValueAtTime(0.7, now);

            const gain = this.ctx.createGain();
            const peakGain = 0.04 + amt * 0.09;
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(peakGain, now + 0.25);
            gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.sfxGain ?? this.masterGain);

            noise.start(now);
            noise.stop(now + duration);
        } catch { /* best effort */ }
    }

    /**
     * Stabilize: a descending sweep resolving to a clean fifth (two sines
     * settling to ~220Hz + 330Hz) over ~1.2s. Hopeful, resolving cadence.
     */
    public playStabilize(): void {
        if (!this.isReady() || !this.ctx || !this.masterGain || this.muted) return;
        try {
            const now = this.ctx.currentTime;
            const dur = 1.2;
            const bus = this.sfxGain ?? this.masterGain;

            const makeVoice = (start: number, end: number, level: number) => {
                const osc = this.ctx!.createOscillator();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(start, now);
                osc.frequency.exponentialRampToValueAtTime(end, now + dur * 0.75);

                const gain = this.ctx!.createGain();
                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(level, now + 0.2);
                gain.gain.setValueAtTime(level, now + dur * 0.75);
                gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

                osc.connect(gain);
                gain.connect(bus);
                osc.start(now);
                osc.stop(now + dur + 0.05);
            };

            // Root and fifth descend from a bright register into 220 + 330.
            makeVoice(660, 220, 0.045);
            makeVoice(990, 330, 0.035);
        } catch { /* best effort */ }
    }

    /**
     * Void heartbeat: a bare ~40Hz sine at very low gain with a slow ~1.2Hz
     * amplitude pulse, for the dead-zone swallow takeover. Routed via the sfx
     * bus so it sounds even in 'track' mode (like playThunder/playStabilize).
     * Self-contained and auto-cleaned after `seconds`.
     */
    public playVoidHeartbeat(seconds: number): void {
        if (!this.isReady() || !this.ctx || !this.masterGain || this.muted) return;
        try {
            const now = this.ctx.currentTime;
            const dur = Math.max(0.1, seconds);
            const bus = this.sfxGain ?? this.masterGain;

            // Sub-bass sine — the void's pulse.
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(40, now);

            // Base gain, gently faded in and out so there's no click.
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.05, now + 0.3);
            gain.gain.setValueAtTime(0.05, now + dur - 0.4);
            gain.gain.exponentialRampToValueAtTime(0.0008, now + dur);

            // ~1.2Hz amplitude pulse: a slow heartbeat over the base level.
            const pulseLfo = this.ctx.createOscillator();
            pulseLfo.type = 'sine';
            pulseLfo.frequency.setValueAtTime(1.2, now);
            const pulseDepth = this.ctx.createGain();
            pulseDepth.gain.setValueAtTime(0.03, now);
            pulseLfo.connect(pulseDepth);
            pulseDepth.connect(gain.gain);

            osc.connect(gain);
            gain.connect(bus);

            osc.start(now);
            pulseLfo.start(now);
            osc.stop(now + dur + 0.05);
            pulseLfo.stop(now + dur + 0.05);
        } catch { /* best effort */ }
    }

    public dispose() {
        try {
            if (this.currentProfile) {
                if (this.currentProfile.timer !== null) clearTimeout(this.currentProfile.timer);
                this.currentProfile = null;
            }
            if (this.breathOsc) this.breathOsc.stop();
            if (this.harmonicOsc) this.harmonicOsc.stop();
            if (this.lfoOsc) this.lfoOsc.stop();
            if (this.ctx) this.ctx.close();
            this.initialized = false;
        } catch { /* silent */ }
    }
}

export const soundEngine = new SoundEngine();
