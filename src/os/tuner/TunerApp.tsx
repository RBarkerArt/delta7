import './tuner.css'
import { useElementSize } from '../lib/useElementSize'
import { useReducedMotionPref } from '../lib/useReducedMotionPref'
import { useBadStretch } from '../store/coherence'
import {
  useLockNonce,
  useTransport,
  useTunerHoldMs,
  useTunerHoldSince,
  useTunerHolding,
  useEverLocked,
  useTunerLock,
  useTunerValue,
} from '../store/tuner'
import type { AppProps } from '../types'
import LockBadge from './LockBadge'
import MessageLine from './MessageLine'
import Readout from './Readout'
import TickStrip from './TickStrip'
import Transport from './Transport'
import Waveform from './Waveform'
import ClarityStatus from './ClarityStatus'
import { SIGNAL_TARGET, clarity, clarityBucket, clarityWords, decodeState, pxPerUnitFor } from './tunerMath'
import { useTunerAudio } from './tunerAudio'

/**
 * The tuner: one plain card, rendered both as its own app and inside Delta7's tuner view. All state lives in
 * `store/tuner.ts`, so every mount shows the same dial. Sizes follow the CONTAINER, never the viewport.
 * No decay styling here, ever: it must stay readable and usable at every coherence level.
 */
export default function TunerApp({ isMobile }: AppProps) {
  const { ref, width, height } = useElementSize<HTMLDivElement>()
  const value = useTunerValue()
  const locked = useTunerLock()
  const holding = useTunerHolding()
  const holdSince = useTunerHoldSince()
  const holdMs = useTunerHoldMs()
  const badStretch = useBadStretch()
  const lockNonce = useLockNonce()
  const transport = useTransport()
  const everLocked = useEverLocked()
  const reduced = useReducedMotionPref()
  useTunerAudio()

  const shown = locked ? SIGNAL_TARGET : value
  // Stopped: input closed, nothing comes through (the trace idles too). Stop always releases the lock first.
  const inputClosed = transport === 'stopped'
  const strength = locked ? 1 : inputClosed ? 0 : clarity(value)
  const decode = decodeState(strength, locked)
  const bucket = inputClosed && !locked ? 'none' : clarityBucket(value, locked)
  // The words lag the wave a little: they only really clear in the last stretch, and fully at the lock.
  const messageClarity = locked ? 1 : Math.min(0.95, strength * strength)
  const readoutText = shown.toFixed(2)
  // Until the first lock ever, the program doesn't know what it's listening for.
  const holdText = everLocked ? SIGNAL_TARGET.toFixed(2) : '?'

  // Container-driven sizing (width 0 on the first frame → use the compact layout).
  const w = width || 360
  const h = height || 600
  const compact = w < 440
  // Short containers (a squat window) get a tighter rhythm; tiny ones (a landscape phone) tighter still. The card
  // scrolls inside its container if it still doesn't fit; the dial and transport never shrink.
  const tiny = h < 320
  const short = h < 440
  const roomy = w >= 720 && h >= 520
  const pad = tiny ? 10 : short ? (compact ? 14 : 18) : compact ? 16 : roomy ? 32 : 22
  const gap = tiny ? 7 : short ? 10 : compact ? 14 : 16
  const digit = tiny ? 36 : short ? (compact ? 40 : 48) : compact ? 44 : roomy ? 76 : 58
  const waveMin = tiny ? 40 : short ? 56 : 96
  const badge = tiny ? 36 : compact ? 40 : 44
  const pxPerUnit = pxPerUnitFor(w)
  const btn = isMobile || compact ? 44 : 34
  // The trace takes the spare height first (up to a cap); what is left sits mostly below the card's content.
  const waveMax = Math.min(380, Math.max(140, h * 0.48))

  return (
    <div
      ref={ref}
      data-testid="tuner-root"
      data-locked={locked ? 'true' : 'false'}
      data-bad-stretch={badStretch ? 'true' : 'false'}
      className="tuner-root relative h-full w-full overflow-y-auto overflow-x-hidden bg-os-cream/[0.97] font-os-sans text-os-ink"
    >
      {/* Not quite opaque on purpose: Chromium treats a fully opaque, composited (canvas inside) card as covering its whole
          rectangle and skips drawing the window below at the parent's rounded corners → square wallpaper "triangles". */}
      {/* Warm wash: grows faintly with the signal, settles in fully at the lock. */}
      <div
        aria-hidden="true"
        className="tuner-wash pointer-events-none absolute inset-0 transition-opacity duration-[1200ms] ease-out"
        style={{ opacity: locked ? 1 : messageClarity * 0.3 }}
      />
      <div className="relative mx-auto flex min-h-full max-w-[880px] flex-col" style={{ padding: pad, gap }}>
        <div aria-hidden="true" className="min-h-0" style={{ flexGrow: 1, marginBottom: -gap }} />
        <div className="flex shrink-0 items-start justify-between gap-3">
          <Readout text={readoutText} locked={locked} lockNonce={lockNonce} reduced={reduced} size={digit} />
          <LockBadge
            locked={locked}
            holding={holding}
            holdSince={holdSince}
            holdMs={holdMs}
            lockNonce={lockNonce}
            reduced={reduced}
            size={badge}
          />
        </div>

        <div
          className="tuner-wave-panel relative overflow-hidden rounded-[12px]"
          style={{ flex: '40 1 0px', minHeight: waveMin, maxHeight: waveMax }}
        >
          <Waveform reduced={reduced} />
        </div>

        <TickStrip
          value={shown}
          locked={locked}
          pxPerUnit={pxPerUnit}
          ariaText={`${readoutText} megahertz, ${clarityWords(bucket)}${!locked && holding ? ', holding' : ''}`}
        />
        <ClarityStatus bucket={bucket} />

        <div className="shrink-0">
          <MessageLine strength={messageClarity} size={compact ? 13 : 14} />
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <Transport state={transport} size={btn} />
          <p
            data-testid="tuner-debug"
            data-input={inputClosed ? 'closed' : 'open'}
            className="os-selectable font-os-mono text-[11.5px] leading-tight text-[#6a5e60]"
          >
            rk: input {inputClosed ? 'closed' : 'open'} hold={holdText} decode: {decode} lock={locked ? 1 : 0}
          </p>
        </div>
        <div aria-hidden="true" className="min-h-0" style={{ flexGrow: 2, marginTop: -gap }} />
      </div>
    </div>
  )
}
