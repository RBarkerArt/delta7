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
import { SIGNAL_TARGET, clarity, clarityBucket, clarityWords, decodeState } from './tunerMath'
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
  const strength = locked ? 1 : clarity(value)
  const decode = decodeState(strength, locked)
  const bucket = clarityBucket(strength, locked)
  // The words lag the wave a little: they only really clear in the last stretch, and fully at the lock.
  const messageClarity = locked ? 1 : Math.min(0.95, strength * strength)
  const readoutText = shown.toFixed(2)
  // Until the first lock ever, the program doesn't know what it's listening for.
  const holdText = everLocked ? SIGNAL_TARGET.toFixed(2) : '?'

  // Container-driven sizing (width 0 on the first frame → use the compact layout).
  const w = width || 360
  const compact = w < 440
  const roomy = w >= 720 && height >= 520
  const pad = compact ? 16 : roomy ? 32 : 22
  const digit = compact ? 44 : roomy ? 76 : 58
  const pxPerUnit = Math.min(900, Math.max(520, w * 1.5))
  const btn = isMobile || compact ? 44 : 34

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
      <div
        className="relative mx-auto flex h-full min-h-[340px] max-w-[880px] flex-col justify-center"
        style={{ padding: pad, gap: compact ? 14 : 16 }}
      >
        <div className="flex items-start justify-between gap-3">
          <Readout text={readoutText} locked={locked} lockNonce={lockNonce} reduced={reduced} size={digit} />
          <LockBadge
            locked={locked}
            holding={holding}
            holdSince={holdSince}
            holdMs={holdMs}
            lockNonce={lockNonce}
            reduced={reduced}
            size={compact ? 40 : 44}
          />
        </div>

        <div className="tuner-wave-panel relative min-h-[72px] flex-1 overflow-hidden rounded-[12px]" style={{ maxHeight: Math.min(340, Math.max(160, (height || 400) * 0.4)) }}>
          <Waveform reduced={reduced} />
        </div>

        <TickStrip
          value={shown}
          locked={locked}
          pxPerUnit={pxPerUnit}
          ariaText={`${readoutText} megahertz, ${clarityWords(bucket)}${!locked && holding ? ', holding' : ''}`}
        />
        <ClarityStatus bucket={bucket} />

        <MessageLine strength={messageClarity} size={compact ? 13 : 14} />

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <Transport state={transport} size={btn} />
          <p
            data-testid="tuner-debug"
            className="os-selectable font-os-mono text-[11.5px] leading-tight text-[#6a5e60]"
          >
            rk: input open hold={holdText} decode: {decode} lock={locked ? 1 : 0}
          </p>
        </div>
      </div>
    </div>
  )
}
