import { useEffect } from 'react'
import { dialTouchMayStartSound, resetTransportOnClose, startFromDialTouch, tunerStore } from '../store/tuner'
import { settingsStore } from '../store/settings'
import { coherenceStore } from '../store/coherence'
import { TARGET, clarity, transportAudible } from './tunerMath'

/**
 * Tiny Web Audio voice for the tuner: band-passed static that thins out, and a soft low tone that
 * steadies, as the dial approaches the target (both follow clarity()). No AudioContext exists before a user gesture:
 * it is created inside the gesture that starts the sound, either a Play tap or the first touch of the dial while the
 * transport is still `open` (and only with the Sound setting on). Always quiet, closed when the last tuner unmounts.
 * No audio files.
 */

interface Voice {
  ctx: AudioContext
  master: GainNode
  noiseGain: GainNode
  noiseFilter: BiquadFilterNode
  toneGain: GainNode
  tone: OscillatorNode
  wobble: OscillatorNode
  wobbleDepth: GainNode
}

const MASTER = 0.07
/** Base tone: a plain G (G3). It detunes gently with distance from the target. */
const TONE_HZ = 196
/** Extra static during a bad stretch. */
const BAD_STRETCH_STATIC = 0.12
const RAMP = 0.12 // setTargetAtTime time constant (s): no clicks

let voice: Voice | null = null
let mounts = 0

function makeNoise(ctx: AudioContext): AudioBufferSourceNode {
  const len = Math.floor(ctx.sampleRate * 2)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  const src = ctx.createBufferSource()
  src.buffer = buf
  src.loop = true
  return src
}

function build(): Voice | null {
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  const ctx = new Ctor()
  const master = ctx.createGain()
  master.gain.value = 0
  master.connect(ctx.destination)

  const noise = makeNoise(ctx)
  const noiseFilter = ctx.createBiquadFilter()
  noiseFilter.type = 'bandpass'
  noiseFilter.frequency.value = 1800
  noiseFilter.Q.value = 0.7
  const noiseGain = ctx.createGain()
  noiseGain.gain.value = 0
  noise.connect(noiseFilter).connect(noiseGain).connect(master)
  noise.start()

  const tone = ctx.createOscillator()
  tone.type = 'sine'
  tone.frequency.value = TONE_HZ
  // A slow vibrato that is wide off-lock and dies away at the lock.
  const wobble = ctx.createOscillator()
  wobble.frequency.value = 5.5
  const wobbleDepth = ctx.createGain()
  wobbleDepth.gain.value = 0
  wobble.connect(wobbleDepth).connect(tone.frequency)
  const toneGain = ctx.createGain()
  toneGain.gain.value = 0
  tone.connect(toneGain).connect(master)
  tone.start()
  wobble.start()

  return { ctx, master, noiseGain, noiseFilter, toneGain, tone, wobble, wobbleDepth }
}

/** Call from inside a user gesture only (the Play click, or startSoundOnDialTouch): browsers' autoplay rules. */
export function ensureTunerAudio() {
  if (!voice) voice = build()
  if (voice && voice.ctx.state === 'suspended') void voice.ctx.resume().catch(() => {})
  sync()
}

interface UserActivationLike {
  isActive: boolean
}

/**
 * Call from the dial's gesture handlers (pointer, wheel, keys). The first touch of the dial while the transport is
 * still `open` starts the sound exactly as Play would, if the Sound setting is on. `activating`: the event is one
 * browsers count as a user activation (a key, a mouse button press, a touch/pen lift). A wheel is not: there the
 * sound starts only if the page has a live activation anyway; otherwise nothing happens (no context, no error) and
 * the next qualifying gesture on the dial starts it. Pause / Stop disarm this: then only Play brings sound back.
 */
export function startSoundOnDialTouch(activating: boolean) {
  if (!dialTouchMayStartSound()) {
    // Already playing but the context could not start before (no activation then): this gesture can resume it.
    const v = voice
    if (activating && v && v.ctx.state === 'suspended' && transportAudible(tunerStore.get().transport, settingsStore.get().sound)) {
      void v.ctx.resume().catch(() => {})
    }
    return
  }
  if (!settingsStore.get().sound) return
  const ua = (navigator as Navigator & { userActivation?: UserActivationLike }).userActivation
  if (!activating && !ua?.isActive) return
  if (startFromDialTouch()) ensureTunerAudio()
}

function sync() {
  const v = voice
  if (!v || v.ctx.state === 'closed') return
  const { value, transport, locked } = tunerStore.get()
  const audible = transportAudible(transport, settingsStore.get().sound) && document.visibilityState === 'visible'
  const s = locked ? 1 : clarity(value)
  const now = v.ctx.currentTime
  v.master.gain.setTargetAtTime(audible ? MASTER : 0, now, RAMP)
  const bad = !locked && coherenceStore.get().badStretch
  v.noiseGain.gain.setTargetAtTime(0.6 * (1 - s) ** 1.3 + 0.02 + (bad ? BAD_STRETCH_STATIC : 0), now, RAMP)
  v.noiseFilter.frequency.setTargetAtTime(900 + 2200 * (1 - s), now, RAMP)
  // Off the zones there is no tone at all, only static; it fades in through the zones.
  v.toneGain.gain.setTargetAtTime(0.6 * s ** 1.5, now, RAMP)
  v.tone.frequency.setTargetAtTime(TONE_HZ + (value - TARGET) * 80, now, RAMP)
  v.wobbleDepth.gain.setTargetAtTime(locked ? 0 : 9 * (1 - s), now, RAMP)
  if (audible && v.ctx.state === 'suspended') void v.ctx.resume().catch(() => {})
}

function close() {
  const v = voice
  voice = null
  if (!v) return
  try {
    v.master.gain.setTargetAtTime(0, v.ctx.currentTime, 0.03)
  } catch {
    /* already closed */
  }
  setTimeout(() => void v.ctx.close().catch(() => {}), 150)
}

/** Keeps the voice in step with the tuner + Sound setting; closes it when the last tuner unmounts. */
export function useTunerAudio() {
  useEffect(() => {
    mounts++
    const unsubs = [tunerStore.subscribe(sync), settingsStore.subscribe(sync), coherenceStore.subscribe(sync)]
    document.addEventListener('visibilitychange', sync)
    sync()
    return () => {
      unsubs.forEach((u) => u())
      document.removeEventListener('visibilitychange', sync)
      mounts--
      // Nothing is listening any more: close the voice and put the transport back to its initial `open` state (the
      // lock itself keeps holding). The voice comes back on Play, or on the first dial touch next time.
      if (mounts === 0) {
        close()
        resetTransportOnClose()
      }
    }
  }, [])
}
