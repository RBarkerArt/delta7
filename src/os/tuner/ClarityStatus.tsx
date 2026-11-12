import { useEffect, useState } from 'react'
import { clarityWords } from './tunerMath'
import type { ClarityBucket } from './tunerMath'

const DEBOUNCE_MS = 400

/**
 * Visually hidden live region so a keyboard / screen-reader player can find the signal too. `data-clarity` follows the
 * bucket at once; the spoken text only changes once a bucket has held for ~400ms, so a quick sweep doesn't chatter.
 * The words describe clarity only, never direction.
 */
export default function ClarityStatus({ bucket }: { bucket: ClarityBucket }) {
  const [spoken, setSpoken] = useState<ClarityBucket>(bucket)
  useEffect(() => {
    if (bucket === spoken) return
    const id = setTimeout(() => setSpoken(bucket), DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [bucket, spoken])
  return (
    <p role="status" aria-live="polite" data-testid="tuner-clarity" data-clarity={bucket} className="sr-only">
      {clarityWords(spoken)}
    </p>
  )
}
