import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { EDGE_CURSOR } from './useFrameGestures'
import type { Edge } from './useFrameGestures'

const T = 7 // edge thickness
const C = 16 // corner size
const O = -4 // how far handles reach outside the panel

const PLACE: Record<Edge, CSSProperties> = {
  n: { top: O, left: C + O, right: C + O, height: T },
  s: { bottom: O, left: C + O, right: C + O, height: T },
  w: { left: O, top: C + O, bottom: C + O, width: T },
  e: { right: O, top: C + O, bottom: C + O, width: T },
  nw: { top: O, left: O, width: C, height: C },
  ne: { top: O, right: O, width: C, height: C },
  sw: { bottom: O, left: O, width: C, height: C },
  se: { bottom: O, right: O, width: C, height: C },
}

const EDGES = Object.keys(PLACE) as Edge[]

/** Invisible resize handles on all four edges and corners. */
export default function ResizeHandles({
  appId,
  onEdgePointerDown,
}: {
  appId: string
  onEdgePointerDown: (edge: Edge) => (e: ReactPointerEvent) => void
}) {
  return (
    <>
      {EDGES.map((edge) => (
        <div
          key={edge}
          aria-hidden="true"
          data-testid={`window-resize-${edge}-${appId}`}
          onPointerDown={onEdgePointerDown(edge)}
          className="absolute z-30"
          style={{ ...PLACE[edge], cursor: EDGE_CURSOR[edge], touchAction: 'none' }}
        />
      ))}
    </>
  )
}
