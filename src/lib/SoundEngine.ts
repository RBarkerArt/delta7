/**
 * SoundEngine handles all audio synthesis for the Delta-7 atmosphere.
 * Designed to represent a living, breathing machine.
 */
class SoundEngine {
    private ctx: AudioContext | null = null;
    private masterGain: GainNode | null = null;

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

    public async init(): Promise<boolean> {
        if (this.initialized && this.ctx?.state === 'running') return true;

        try {
            if (!this.ctx) {
                this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            }

            if (this.ctx.state === 'suspended') {
                await this.ctx.resume();
            }

            if (!this.masterGain) {
                this.masterGain = this.ctx.createGain();
                this.masterGain.connect(this.ctx.destination);
                this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.3, this.ctx.currentTime);
            }

            this.setupBreathSystem();
            this.initialized = true;
            console.log('[SoundEngine] Living nexus audio link established.');
            return true;
        } catch (err) {
            console.warn('[SoundEngine] Nexus audio failure:', err);
            return false;
        }
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

            this.breathOsc.connect(this.breathFilter);
            this.breathFilter.connect(this.breathGain);
            this.breathGain.connect(this.masterGain);

            this.harmonicOsc.connect(this.harmonicGain);
            this.harmonicGain.connect(this.masterGain);

            this.breathOsc.start();
            this.harmonicOsc.start();
            this.lfoOsc.start();
        } catch (e) {
            // Silent fail
        }
    }

    setMuted(muted: boolean) {
        this.muted = muted;
        if (this.masterGain && this.ctx) {
            try {
                this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.3, this.ctx.currentTime, 0.1);
            } catch (e) { /* silent */ }
        }
    }

    getMuted(): boolean {
        return this.muted;
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
        } catch (e) { /* silent */ }
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
            gain.connect(this.masterGain);

            noise.start(now);
            noise.stop(now + 0.3);
        } catch (e) { /* silent */ }
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
            gain.connect(this.masterGain);

            osc.start(now);
            osc.stop(now + 0.05);
        } catch (e) { /* silent */ }
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
            gain.connect(this.masterGain);

            noise.start(now);
            noise.stop(now + duration);
        } catch (e) { /* silent */ }
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
            gain.connect(this.masterGain);

            osc.start(now);
            osc.stop(now + 0.15);
        } catch (e) { /* silent */ }
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
            osc1.connect(gain1);
            gain1.connect(this.masterGain);

            osc2.connect(gain2);
            gain2.connect(this.masterGain);

            noise.connect(noiseFilter);
            noiseFilter.connect(noiseGain);
            noiseGain.connect(this.masterGain);

            // Start all
            osc1.start(now);
            osc2.start(now);
            noise.start(now);

            osc1.stop(now + 1.5);
            osc2.stop(now + 1.5);
            noise.stop(now + 0.5);

            console.log('[SoundEngine] Temporal shift audio triggered');
        } catch (e) { /* silent */ }
    }

    public dispose() {
        try {
            if (this.breathOsc) this.breathOsc.stop();
            if (this.harmonicOsc) this.harmonicOsc.stop();
            if (this.lfoOsc) this.lfoOsc.stop();
            if (this.ctx) this.ctx.close();
            this.initialized = false;
        } catch (e) { /* silent */ }
    }
}

export const soundEngine = new SoundEngine();
