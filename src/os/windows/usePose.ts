import { useMemo } from 'react'
import { animate, useMotionValue, useTransform } from 'motion/react'
import type { MotionValue, Transition } from 'motion/react'
import { veilFor } from './pose'
import type { Pose } from './pose'

export interface PoseValues {
  x: MotionValue<number>
  y: MotionValue<number>
  sx: MotionValue<number>
  sy: MotionValue<number>
  r: MotionValue<number>
  o: MotionValue<number>
}

export interface PoseController {
  values: PoseValues
  /** Counter-scaled `border-radius` so corners keep their visual radius under non-uniform scale. */
  radius: MotionValue<string>
  veil: MotionValue<number>
  invSx: MotionValue<number>
  invSy: MotionValue<number>
  get: () => Pose
  set: (p: Pose) => void
  stop: () => void
  /** Animates every channel; opacity can get its own transition. Resolves when all channels settle. */
  to: (p: Pose, t: Transition, opts?: { opacity?: Transition; velocity?: Partial<Record<keyof Pose, number>> }) => Promise<void>
}

const KEYS = ['x', 'y', 'sx', 'sy', 'r', 'o'] as const

/** Motion values for a surface's launch/close/gesture pose. Values never cause React renders. */
export function usePose(initial: Pose): PoseController {
  const x = useMotionValue(initial.x)
  const y = useMotionValue(initial.y)
  const sx = useMotionValue(initial.sx)
  const sy = useMotionValue(initial.sy)
  const r = useMotionValue(initial.r)
  const o = useMotionValue(initial.o)
  const radius = useTransform([r, sx, sy], ([rv, a, b]: number[]) => {
    const rx = rv / Math.max(0.02, a)
    const ry = rv / Math.max(0.02, b)
    return `${rx.toFixed(2)}px / ${ry.toFixed(2)}px`
  })
  const veil = useTransform(sx, veilFor)
  const invSx = useTransform(sx, (v) => 1 / Math.max(0.02, v))
  const invSy = useTransform(sy, (v) => 1 / Math.max(0.02, v))

  return useMemo<PoseController>(() => {
    const values: PoseValues = { x, y, sx, sy, r, o }
    const get = (): Pose => ({ x: x.get(), y: y.get(), sx: sx.get(), sy: sy.get(), r: r.get(), o: o.get() })
    const stop = () => KEYS.forEach((k) => values[k].stop())
    const set = (p: Pose) => {
      stop()
      KEYS.forEach((k) => values[k].set(p[k]))
    }
    const to: PoseController['to'] = (p, t, opts) => {
      stop()
      const runs = KEYS.map((k) => {
        const base = k === 'o' && opts?.opacity ? opts.opacity : t
        const velocity = opts?.velocity?.[k]
        return animate(values[k], p[k], velocity !== undefined ? { ...base, velocity } : base)
      })
      return Promise.all(runs.map((c) => c.finished)).then(() => undefined)
    }
    return { values, radius, veil, invSx, invSy, get, set, stop, to }
  }, [x, y, sx, sy, r, o, radius, veil, invSx, invSy])
}
