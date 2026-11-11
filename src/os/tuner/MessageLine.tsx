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
          // A soft ink bar instead of the font's shade glyph (which some monospace fonts lack). The ▒ characters stay
          // in the DOM (transparent) so the text content is unchanged; the bar is exactly one `ch` per character.
          <span
            key={i}
            aria-hidden="true"
            className="inline-block overflow-hidden whitespace-pre rounded-[3px] bg-os-ink/[0.11] align-[-0.14em] text-transparent"
            style={{ width: `${[...r].length}ch`, height: '1.02em', lineHeight: '1.02em', boxShadow: 'inset 0 0 0 0.5px rgba(58,48,52,0.06)' }}
          >
            {r}
          </span>
        ) : (
          <span key={i}>{r}</span>
        ),
      )}
    </p>
  )
}
