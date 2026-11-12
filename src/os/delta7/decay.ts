import { clamp01, levelFor } from '../store/coherenceMath'
import { seeded } from '../lib/seeded'
import { D7_LABELS, D7_LOGS, D7_LOG_REWRITES, D7_MESSAGE } from '../mock/delta7Content'
import type { D7LabelKey } from '../mock/delta7Content'
import type { DecayLevel } from '../types'

/**
 * Pure mapping coherence → how the Delta7 dashboard looks. No React, no time, no Math.random.
 * Same (bucketed coherence, seed) → same plan, so nothing flickers between renders.
 *
 * Choices (which panel tears, which nav item fades…) come from the seed only, and their strength from the
 * bucket, so as coherence falls the SAME things get progressively worse instead of jumping around.
 */

export const PANEL_IDS = ['toolbar', 'signal', 'message', 'files', 'feed', 'list'] as const
export type PanelId = (typeof PANEL_IDS)[number]

/** Nav items the decay may touch. `overview` and `tuner` are never in here. */
export const DECAYABLE_NAV = ['memories', 'messages', 'files', 'logs', 'archive'] as const
export type DecayableNav = (typeof DECAYABLE_NAV)[number]
export type NavState = 'normal' | 'faded' | 'dropped'

export interface PanelFx {
  x: number
  y: number
  rot: number
  opacity: number
  /** CSS clip-path polygon for a torn edge, or null. */
  tear: string | null
}

export interface ChartFx {
  /** 0..1 — how often the trace freezes (frames skip). */
  stutter: number
  /** 0..1 — chance a segment drops out of the line. */
  gaps: number
  /** 1 = healthy amplitude; smaller flattens the trace. */
  amp: number
  /** extra jitter on the trace. */
  noise: number
}

export interface DecayPlan {
  level: DecayLevel
  /** coherence floored to 0.05 steps */
  bucket: number
  /** 0 at ≥0.9, rising to 1 at 0 */
  severity: number
  blurPx: number
  grain: number
  vignette: number
  panels: Record<PanelId, PanelFx>
  nav: Record<DecayableNav, NavState>
  /** nav x-offsets in px (decayable items only) */
  navShift: Record<DecayableNav, number>
  labels: Record<D7LabelKey, string>
  chart: ChartFx
  /** indices of words in the latest message that have gone faint */
  fadedWords: number[]
  /** the feed image's faint double, px offset (0 = none) */
  ghost: number
  /** how washed-out the feed image is (0..1) */
  wash: number
  /** a log line that slowly rewrites itself, or null */
  logRewrite: { index: number; alt: string } | null
  /** label keys that are misspelled at this step (for labels whose text changes at runtime, see decayedLabel) */
  misspelt: D7LabelKey[]
}

const STEP = 0.05

/** Floors to 0.05 steps. Floor (not round) so the bucket's level always equals the store's level. */
export function bucketOf(c: number): number {
  return Math.floor(clamp01(c) / STEP + 1e-6) * STEP
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * clamp01(t)
const round = (v: number, p = 100) => Math.round(v * p) / p

function shuffled<T>(items: readonly T[], rnd: () => number): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Swap two neighbouring letters or drop one. Never touches the first letter, digits or punctuation. */
export function misspell(text: string, rnd: () => number): string {
  const spots: number[] = []
  for (let i = 1; i < text.length - 1; i++) if (/[a-z]/.test(text[i]) && /[a-z]/.test(text[i + 1])) spots.push(i)
  if (spots.length === 0) return text
  const i = spots[Math.floor(rnd() * spots.length)]
  if (rnd() < 0.55) return text.slice(0, i) + text[i + 1] + text[i] + text.slice(i + 2)
  return text.slice(0, i) + text.slice(i + 1)
}

/** A jagged edge along the bottom or right of a panel, `depth` px deep at most. */
export function tearPolygon(edge: 'bottom' | 'right', depth: number, rnd: () => number): string {
  const pts: string[] = []
  const jag = () => `calc(100% - ${round(1 + rnd() * depth, 10)}px)`
  if (edge === 'bottom') {
    pts.push('0 0', '100% 0', `100% ${jag()}`)
    for (let p = 96; p > 0; p -= 3 + rnd() * 6) pts.push(`${round(p, 10)}% ${jag()}`)
    pts.push(`0 ${jag()}`)
  } else {
    pts.push('0 0', `${jag()} 0`)
    for (let p = 4; p < 100; p += 3 + rnd() * 6) pts.push(`${jag()} ${round(p, 10)}%`)
    pts.push(`${jag()} 100%`, '0 100%')
  }
  return `polygon(${pts.join(', ')})`
}

/** Extra misspellings during a bad stretch (2 or 3, fixed per seed). */
export function badStretchMisspellings(seed: string): number {
  return seeded(`${seed}:bad-stretch`)() < 0.5 ? 2 : 3
}

export function decayPlan(coherence: number, seed: string, badStretch = false): DecayPlan {
  const bucket = round(bucketOf(coherence))
  const level = levelFor(bucket)
  // severity: 0 at 0.9 and above → 1 at 0.
  const severity = round(clamp01((0.9 - bucket) / 0.9))
  const recovering = bucket < 0.9
  const fraying = bucket < 0.75
  const fragmented = bucket < 0.55
  // depth within the fragmented band: 0 at 0.5 → 1 at 0
  const deep = clamp01((0.55 - bucket) / 0.55)

  // Seed-only choices (stable across buckets).
  const choose = seeded(`${seed}:choices`)
  const navOrder = shuffled(DECAYABLE_NAV, choose)
  const tearOrder = shuffled(['message', 'signal', 'files'] as const, choose)
  const labelOrder = shuffled(Object.keys(D7_LABELS) as D7LabelKey[], choose)
  const wordOrder = shuffled(
    D7_MESSAGE.body.split(' ').map((_, i) => i),
    choose,
  )
  const logIndex = 1 + Math.floor(choose() * (D7_LOGS.length - 2))
  const logAlt = D7_LOG_REWRITES[Math.floor(choose() * D7_LOG_REWRITES.length)]

  /* ---- panels ---- */
  const drift = !recovering ? 0 : fragmented ? lerp(5, 8, deep) : fraying ? lerp(3, 5, (0.75 - bucket) / 0.2) : lerp(1, 3, (0.9 - bucket) / 0.15)
  const rotMax = !fraying ? 0 : fragmented ? lerp(1.5, 1.8, deep) : lerp(0.5, 1.5, (0.75 - bucket) / 0.2)
  const dip = !fraying ? 0 : fragmented ? lerp(0.16, 0.24, deep) : lerp(0.05, 0.14, (0.75 - bucket) / 0.2)
  const tears = fragmented ? (bucket >= 0.35 ? 1 : 2) : 0

  const panels = {} as Record<PanelId, PanelFx>
  for (const id of PANEL_IDS) {
    const r = seeded(`${seed}:panel:${id}`)
    const ax = r() * 2 - 1
    const ay = r() * 2 - 1
    const ar = r() < 0.5 ? -1 : 1
    const rotScale = 0.45 + r() * 0.55
    const dipScale = 0.4 + r() * 0.6
    const toolbar = id === 'toolbar'
    panels[id] = {
      x: round(ax * drift * (toolbar ? 0.4 : 1), 10),
      y: round(ay * drift * (toolbar ? 0.3 : 0.7), 10),
      rot: round(ar * rotMax * rotScale * (toolbar ? 0.3 : 1)),
      opacity: round(1 - dip * dipScale),
      tear: null,
    }
  }
  for (let i = 0; i < tears; i++) {
    const id = tearOrder[i]
    const r = seeded(`${seed}:tear:${id}`)
    panels[id].tear = tearPolygon(id === 'files' ? 'bottom' : r() < 0.5 ? 'bottom' : 'right', lerp(5, 9, deep), r)
  }
  if (fragmented) {
    // The feed slips clearly out of line — down and to the left, away from anything clickable.
    panels.feed = { ...panels.feed, x: round(-lerp(10, 18, deep), 10), y: round(lerp(14, 26, deep), 10), rot: round(-lerp(1.6, 2.2, deep)) }
  }

  /* ---- nav ---- */
  const nav = Object.fromEntries(DECAYABLE_NAV.map((n) => [n, 'normal'])) as Record<DecayableNav, NavState>
  const navShift = Object.fromEntries(DECAYABLE_NAV.map((n) => [n, 0])) as Record<DecayableNav, number>
  if (fragmented) {
    nav[navOrder[0]] = 'dropped'
    nav[navOrder[1]] = 'dropped'
    nav[navOrder[2]] = 'faded'
  } else if (fraying) {
    nav[navOrder[0]] = bucket < 0.65 ? 'dropped' : 'faded'
  }
  if (recovering) {
    for (const n of DECAYABLE_NAV) {
      const r = seeded(`${seed}:nav:${n}`)
      navShift[n] = round((r() * 2 - 1) * drift * 0.5, 10)
    }
  }

  /* ---- labels ---- */
  const labelKeys = Object.keys(D7_LABELS).length
  const misspellCount = Math.min(
    labelKeys,
    (fragmented ? 5 : fraying ? (bucket < 0.65 ? 3 : 2) : 0) + (badStretch ? badStretchMisspellings(seed) : 0),
  )
  const labels = { ...D7_LABELS } as Record<D7LabelKey, string>
  const misspelt = labelOrder.slice(0, misspellCount)
  for (const key of misspelt) labels[key] = misspell(D7_LABELS[key], seeded(`${seed}:label:${key}`))

  /* ---- chart ---- */
  const chart: ChartFx = {
    stutter: fragmented ? lerp(0.5, 0.8, deep) : fraying ? lerp(0.15, 0.4, (0.75 - bucket) / 0.2) : 0,
    gaps: fragmented ? lerp(0.07, 0.16, deep) : 0,
    amp: fragmented ? lerp(0.6, 0.35, deep) : fraying ? 0.85 : 1,
    noise: round(lerp(0.12, 0.5, severity)),
  }

  return {
    level,
    bucket,
    severity,
    blurPx: !recovering ? 0 : fragmented ? round(lerp(0.45, 0.55, deep)) : fraying ? 0.4 : round(lerp(0.15, 0.35, (0.9 - bucket) / 0.15)),
    grain: !recovering ? 0 : fragmented ? round(lerp(0.12, 0.17, deep)) : fraying ? 0.09 : 0.05,
    vignette: !fraying ? 0 : fragmented ? round(lerp(0.45, 0.7, deep)) : round(lerp(0.12, 0.3, (0.75 - bucket) / 0.2)),
    panels,
    nav,
    navShift,
    labels,
    chart,
    fadedWords: fragmented ? wordOrder.slice(0, 3 + Math.round(deep * 4)) : fraying && bucket < 0.65 ? wordOrder.slice(0, 1) : [],
    ghost: fragmented ? round(lerp(5, 9, deep), 10) : 0,
    wash: !fraying ? 0 : fragmented ? round(lerp(0.35, 0.55, deep)) : 0.15,
    logRewrite: fragmented ? { index: logIndex, alt: logAlt } : null,
    misspelt,
  }
}

/** A label whose healthy text changes at runtime (e.g. the status line), misspelled the same way the plan would. */
export function decayedLabel(plan: DecayPlan, key: D7LabelKey, text: string, seed: string): string {
  return plan.misspelt.includes(key) ? misspell(text, seeded(`${seed}:label:${key}`)) : text
}
