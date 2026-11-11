import { useAlternate } from './hooks'

interface Props {
  text: string
  /** when set, the line slowly cross-fades between `text` and `alt` */
  alt: string | null
  className?: string
}

/** A line of text that, in a bad state, keeps quietly rewriting itself. */
export default function RewritingLine({ text, alt, className = '' }: Props) {
  const flipped = useAlternate(alt !== null, 3600)
  if (alt === null) return <span className={className}>{text}</span>
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
