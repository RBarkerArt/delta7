import type { CSSProperties, ReactNode } from 'react'
import type { PanelFx } from './decay'

interface Props {
  fx: PanelFx
  blurPx: number
  testId?: string
  className?: string
  /** classes for the outer (transformed) wrapper, e.g. grid placement */
  outerClassName?: string
  /** stacking: panels with controls sit above decorative ones so a slipped panel never eats clicks */
  z?: number
  children: ReactNode
}

/**
 * A dashboard panel. The outer wrapper carries the drift/rotation/opacity (transitioned), the inner
 * sheet carries the static per-step blur and the torn edge.
 */
export default function Panel({ fx, blurPx, testId, className = '', outerClassName = '', z = 1, children }: Props) {
  const outer: CSSProperties = {
    transform: fx.x || fx.y || fx.rot ? `translate(${fx.x}px, ${fx.y}px) rotate(${fx.rot}deg)` : undefined,
    opacity: fx.opacity,
    zIndex: z,
  }
  const inner: CSSProperties = {
    filter: blurPx > 0 ? `blur(${blurPx}px)` : undefined,
    clipPath: fx.tear ?? undefined,
  }
  return (
    <div className={`d7-fx relative ${fx.tear ? 'd7-torn' : ''} ${outerClassName}`} style={outer} data-testid={testId}>
      <section className={`d7-panel h-full ${className}`} style={inner}>
        {children}
      </section>
    </div>
  )
}
