import { useMemo } from 'react'
import { degradeMessage } from './tunerMath'

// TODO(copy): placeholder line; the real text comes from the story later.
const MESSAGE = 'you came back. the signal [▒▒▒▒] steadier when you stay.'
const SEED = 'tuner-message'

/** The message line: clears in calm steps as the lock strengthens; fully clear (bar one redaction) at lock. */
export default function MessageLine({ strength, size }: { strength: number; size: number }) {
  const text = degradeMessage(MESSAGE, strength, SEED)
  const runs = useMemo(() => text.split(/(▒+)/).filter(Boolean), [text])
  return (
    <p
      data-testid="tuner-message"
      data-clear={strength >= 1 ? 'true' : 'false'}
      aria-label={text.replace(/▒+/g, '…')}
      className="os-selectable whitespace-pre-wrap break-words font-os-mono leading-relaxed text-os-ink/85"
      style={{ fontSize: size }}
    >
      {runs.map((r, i) =>
        r.startsWith('▒') ? (
          <span key={i} className="text-os-ink-soft/45" aria-hidden="true">
            {r}
          </span>
        ) : (
          <span key={i}>{r}</span>
        ),
      )}
    </p>
  )
}
