/**
 * Delta-7 Generative Audio Engine
 * Pure Web Audio API implementation to avoid external assets.
 */

class SoundEngine {
    private ctx: AudioContext | null = null;
    private humOsc: OscillatorNode | null = null;
    private humGain: GainNode | null = null;
    private breathOsc: OscillatorNode | null = null;
    private breathGain: GainNode | null = null;
    private initialized = false;
    private isMuted = false;
    private currentScore = 100;

    constructor() { }

    public async init() {
        if (this.initialized && this.ctx?.state === 'running') return;

        if (!this.ctx) {
            this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        }

        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }

        if (!this.initialized) {
            this.initialized = true;
            this.startHum();
        }
    }

    public async setMuted(muted: boolean) {
        this.isMuted = muted;
        if (!this.ctx) return;

        if (!muted && this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }

        if (this.humGain) {
            const targetVolume = muted ? 0 : (0.015 + (100 - this.currentScore) * 0.0003);
            this.humGain.gain.setTargetAtTime(targetVolume, this.ctx.currentTime, 0.1);
        }
    }

    private startHum() {
        if (!this.ctx) return;

        this.humOsc = this.ctx.createOscillator();
        this.humGain = this.ctx.createGain();

        // Breath LFO (Mechanical Oscillation)
        this.breathOsc = this.ctx.createOscillator();
        this.breathGain = this.ctx.createGain();
        this.breathOsc.type = 'sine';
        this.breathOsc.frequency.setValueAtTime(0.2, this.ctx.currentTime); // 5s breath cycle
        this.breathGain.gain.setValueAtTime(0, this.ctx.currentTime);
        this.breathOsc.connect(this.breathGain);

        // Initial waveform: confident sawtooth
        this.humOsc.type = 'sawtooth';
        this.humOsc.frequency.setValueAtTime(50, this.ctx.currentTime);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(150, this.ctx.currentTime);

        const initialVolume = this.isMuted ? 0 : (0.02 + (100 - this.currentScore) * 0.0003);
        this.humGain.gain.setValueAtTime(initialVolume, this.ctx.currentTime);

        // Connect hum through breath gain for oscillation
        this.humOsc.connect(filter);
        filter.connect(this.humGain);
        this.breathGain.connect(this.humGain.gain); // Modulate hum volume
        this.humGain.connect(this.ctx.destination);

        this.humOsc.start();
        this.breathOsc.start();
    }

    public setCoherence(score: number) {
        this.currentScore = score;
        if (!this.ctx || !this.humOsc || !this.humGain || !this.breathGain) return;

        // TIERED BEHAVIOR:
        // Tier 5/4 (100-70): Steady, sawtooth, no movement
        // Tier 3 (69-45): Detuning, timing off (handled in component)
        // Tier 2 (44-20): Mechanical breath (oscillation)
        // Tier 1 (19-0): Thinning (sine wave), frequencies drop out

        // 1. Waveform Control
        if (score < 20) {
            this.humOsc.type = 'sine'; // Thinning
        } else {
            this.humOsc.type = 'sawtooth';
        }

        // 2. Frequency Control
        // In the new model, frequency doesn't "panic" (rise sharply).
        // It subtly detunes or settles.
        const baseFreq = score < 20 ? 40 : 50; // Dropping out/lower energy at critical
        const detune = score < 70 ? (Math.random() - 0.5) * 2 * (1 - score / 100) : 0;
        this.humOsc.frequency.setTargetAtTime(baseFreq + detune, this.ctx.currentTime, 0.5);

        // 3. Breath Oscillation (Tier 2/Low Coherence)
        const breathIntensity = (score < 45 && score >= 20) ? 0.005 : 0;
        this.breathGain.gain.setTargetAtTime(breathIntensity, this.ctx.currentTime, 2.0);

        // 4. Volume Control
        if (!this.isMuted) {
            // Volume thins out at critical, stays steady otherwise
            const baseVol = score < 20 ? 0.015 : 0.02;
            this.humGain.gain.setTargetAtTime(baseVol, this.ctx.currentTime, 1.0);
        }
    }

    public playClick() {
        if (!this.ctx || this.isMuted) return;

        // Critical: Softens or chooses not to speak
        if (this.currentScore < 20 && Math.random() > 0.7) return;

        if (this.ctx.state === 'suspended') this.ctx.resume();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'square';
        osc.frequency.setValueAtTime(120 + Math.random() * 30, this.ctx.currentTime);

        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(800, this.ctx.currentTime);
        filter.Q.setValueAtTime(10, this.ctx.currentTime);

        // Volume thins out at critical
        const vol = this.currentScore < 20 ? 0.005 : 0.015;
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.05);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.05);
    }

    public playPhantomClick() {
        if (!this.ctx || this.isMuted || this.currentScore > 45) return;

        const gain = this.ctx.createGain();
        const osc = this.ctx.createOscillator();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, this.ctx.currentTime);

        gain.gain.setValueAtTime(0.003, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.1);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
    }

    public playGlitch() {
        // Refined guidance says "no glitch blasts". Glitches are now just "uncertainty".
        if (!this.ctx || this.isMuted || this.currentScore > 40) return;

        const duration = 0.03 + Math.random() * 0.07;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine'; // Pure, thinning
        osc.frequency.setValueAtTime(Math.random() * 500 + 100, this.ctx.currentTime);

        gain.gain.setValueAtTime(0.005, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }
}

export const soundEngine = new SoundEngine();
