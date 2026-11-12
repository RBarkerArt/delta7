import { useAlternate } from './hooks'

interface Props {
  text: string
  /** when set, the line slowly cross-fades between `text` and `alt` */
  alt: string | null
  /** reduced motion: the line holds still on `text` (never rewrites itself) */
  reduced?: boolean
  className?: string
}

/** A line of text that, in a bad state, keeps quietly rewriting itself. */
export default function RewritingLine({ text, alt, reduced = false, className = '' }: Props) {
  const rewriting = alt !== null && !reduced
  const flipped = useAlternate(rewriting, 3600)
  if (alt === null) return <span className={className}>{text}</span>
  if (!rewriting) {
    return (
      <span className={`d7-rewrite relative inline-grid ${className}`} data-testid="d7-rewrite">
        <span className="col-start-1 row-start-1">{text}</span>
      </span>
    )
  }
  return (
    <span className={`d7-rewrite relative inline-grid ${className}`} data-testid="d7-rewrite">
      <span className="col-start-1 row-start-1" style={{ opacity: flipped ? 0 : 1 }} aria-hidden={flipped}>
        {text}
      </span>
      <span className="col-start-1 row-start-1" style={{ opacity: flipped ? 1 : 0 }} aria-hidden={!flipped}>
        {alt}
      </span>
    </span>
  )
}
