import { clamp01, levelFor } from '../store/coherenceMath.ts'
import { seeded } from '../lib/seeded.ts'
import { D7_LABELS, D7_LOGS, D7_LOG_REWRITES, D7_MESSAGE } from '../mock/delta7Content.ts'
import type { D7LabelKey } from '../mock/delta7Content.ts'
import type { DecayLevel } from '../types'

/**
 * Pure mapping coherence → how the Delta7 dashboard looks. No React, no time, no Math.random.
 * Same (bucket, seed, badStretch) → same plan, so nothing flickers between renders.
 *
 * Players live between 1.0 and the absence floors (0.70, or 0.75 in a bad stretch), so that is where the VISIBLE
 * range is: `mood` runs 0 → 1 over 0.95 → 0.70 in 0.025 steps, and every step down adds a small, visible change.
 * Below 0.70 (dev slider / scripted moments only) `depth` adds the heavier effects. Effects are driven by coherence
 * itself, not by the level names (those stay the owner's definitions for `data-level`).
 *
 * Choices (which panel tilts or tears, which nav item ghosts…) come from the seed only, and their strength from the
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
  /** coherence floored to 0.025 steps */
  bucket: number
  /** 0..1 over 0.95 → 0.70: the gentle, everyday unwellness */
  mood: number
  /** 0..1 over 0.70 → 0.10: the heavier effects, out of normal play */
  depth: number
  /** 0 when healthy → 1 at the bottom; drives the sticker peel */
  severity: number
  blurPx: number
  grain: number
  vignette: number
  panels: Record<PanelId, PanelFx>
  nav: Record<DecayableNav, NavState>
  /** nav opacity (decayable items only); hover / focus brings an item back */
  navOpacity: Record<DecayableNav, number>
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

const STEP = 0.025

const round = (v: number, p = 100) => Math.round(v * p) / p
const lerp = (a: number, b: number, t: number) => a + (b - a) * clamp01(t)
/** 0 below `from`, rising to 1 at `to` (for effects that arrive part-way down). */
const ramp = (v: number, from: number, to: number) => clamp01((v - from) / (to - from))

/** Floors to 0.025 steps. Floor (not round) so the bucket's level always equals the store's level. */
export function bucketOf(c: number): number {
  return round(Math.floor(clamp01(c) / STEP + 1e-6) * STEP, 1000)
}

/** 0 at ≥ 0.95 → 1 at 0.70. */
export function moodOf(bucket: number): number {
  return round(clamp01((0.95 - bucket) / 0.25), 1000)
}

/** 0 at ≥ 0.70 → 1 at 0.10. */
export function depthOf(bucket: number): number {
  return round(clamp01((0.7 - bucket) / 0.6), 1000)
}

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

/** How many labels are misspelled: one by ~0.875, a couple by 0.80, three at 0.70, more only below. */
export function misspellCountFor(mood: number, depth: number): number {
  const everyday = mood >= 0.95 ? 3 : mood >= 0.55 ? 2 : mood >= 0.3 ? 1 : 0
  return everyday + Math.round(depth * 6)
}

export function decayPlan(coherence: number, seed: string, badStretch = false): DecayPlan {
  const bucket = bucketOf(coherence)
  const level = levelFor(bucket)
  const m = moodOf(bucket)
  const d = depthOf(bucket)
  const severity = round(clamp01(m * 0.45 + d * 0.55))

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
  // The one panel that starts to lean first.
  const tilted = (['signal', 'message', 'files', 'feed'] as const)[Math.floor(choose() * 4)]

  /* ---- panels ---- */
  const drift = m > 0 ? 3 * m + 6 * d : 0
  const rotAll = 0.9 * ramp(m, 0.5, 1) + 0.9 * d // everyone leans a little from ~0.825
  const dip = 0.06 * ramp(m, 0.6, 1) + 0.16 * d
  const panels = {} as Record<PanelId, PanelFx>
  for (const id of PANEL_IDS) {
    const r = seeded(`${seed}:panel:${id}`)
    const ax = r() * 2 - 1
    const ay = r() * 2 - 1
    const ar = r() < 0.5 ? -1 : 1
    const rotScale = 0.45 + r() * 0.55
    const dipScale = 0.4 + r() * 0.6
    const toolbar = id === 'toolbar'
    // The tilted panel leans from ~0.875 (0.4° by 0.85, ~1° at 0.70).
    const lean = id === tilted ? lerp(0.25, 1, ramp(m, 0.2, 1)) * (m >= 0.2 ? 1 : 0) : 0
    panels[id] = {
      x: round(ax * drift * (toolbar ? 0.4 : 1), 10),
      y: round(ay * drift * (toolbar ? 0.3 : 0.7), 10),
      rot: round(ar * (lean + rotAll * rotScale) * (toolbar ? 0.3 : 1)),
      opacity: round(1 - dip * dipScale),
      tear: null,
    }
  }
  // Torn card edges: one from ~0.775 (a few px), a second and third only below 0.70.
  const tears = (m >= 0.7 ? 1 : 0) + (d >= 0.15 ? 1 : 0) + (d >= 0.5 ? 1 : 0)
  for (let i = 0; i < tears; i++) {
    const id = tearOrder[i]
    const r = seeded(`${seed}:tear:${id}`)
    const depthPx = i === 0 ? lerp(2.5, 5, ramp(m, 0.7, 1)) + 5 * d : lerp(4, 10, d)
    panels[id].tear = tearPolygon(id === 'files' ? 'bottom' : r() < 0.5 ? 'bottom' : 'right', depthPx, r)
  }
  if (d > 0) {
    // Below 0.70 the feed slips clearly out of line — down and to the left, away from anything clickable.
    panels.feed = {
      ...panels.feed,
      x: round(panels.feed.x - lerp(3, 18, d), 10),
      y: round(panels.feed.y + lerp(5, 26, d), 10),
      rot: round(panels.feed.rot - lerp(0.6, 2.2, d)),
    }
  }

  /* ---- nav ---- */
  const nav = Object.fromEntries(DECAYABLE_NAV.map((n) => [n, 'normal'])) as Record<DecayableNav, NavState>
  const navOpacity = Object.fromEntries(DECAYABLE_NAV.map((n) => [n, 1])) as Record<DecayableNav, number>
  const navShift = Object.fromEntries(DECAYABLE_NAV.map((n) => [n, 0])) as Record<DecayableNav, number>
  // [fades from, ghosts from] for the first three items in seeded order: one by 0.80 / 0.75, the others below 0.70.
  const steps: [boolean, boolean][] = [
    [m >= 0.55, m >= 0.8],
    [d >= 0.1, d >= 0.3],
    [d >= 0.4, d >= 0.7],
  ]
  steps.forEach(([faded, ghost], i) => {
    const n = navOrder[i]
    if (ghost) {
      nav[n] = 'dropped'
      navOpacity[n] = round(lerp(0.5, 0.42, d))
    } else if (faded) {
      nav[n] = 'faded'
      navOpacity[n] = i === 0 ? round(lerp(0.78, 0.62, ramp(m, 0.55, 0.8))) : 0.62
    }
  })
  if (drift > 0) {
    for (const n of DECAYABLE_NAV) {
      const r = seeded(`${seed}:nav:${n}`)
      navShift[n] = round((r() * 2 - 1) * drift * 0.5 + (nav[n] === 'dropped' ? 5 : 0), 10)
    }
  }

  /* ---- labels ---- */
  const labelKeys = labelOrder.length
  const misspellCount = Math.min(labelKeys, misspellCountFor(m, d) + (badStretch ? badStretchMisspellings(seed) : 0))
  const labels = { ...D7_LABELS } as Record<D7LabelKey, string>
  const misspelt = labelOrder.slice(0, misspellCount)
  for (const key of misspelt) labels[key] = misspell(D7_LABELS[key], seeded(`${seed}:label:${key}`))

  /* ---- chart ---- */
  const chart: ChartFx = {
    stutter: round((m >= 0.5 ? lerp(0.1, 0.35, ramp(m, 0.5, 1)) : 0) + 0.45 * d),
    gaps: d > 0 ? round(lerp(0.04, 0.18, d)) : 0,
    amp: round(1 - 0.12 * m - 0.3 * d),
    noise: round(0.12 + 0.2 * m + 0.2 * d),
  }

  /* ---- blanked words ---- */
  const blanked = (m >= 0.95 ? 2 : m >= 0.7 ? 1 : 0) + Math.round(d * 6)

  return {
    level,
    bucket,
    mood: m,
    depth: d,
    severity,
    // Soft type: ≤0.35px in normal play (the spec's ≤0.4), a little more only below 0.70.
    blurPx: m > 0 ? round(0.06 + 0.29 * m + 0.2 * d) : 0,
    grain: m > 0 ? round(0.035 + 0.07 * m + 0.08 * d) : 0,
    vignette: round(0.26 * m ** 1.5 + 0.44 * d),
    panels,
    nav,
    navOpacity,
    navShift,
    labels,
    chart,
    fadedWords: wordOrder.slice(0, Math.min(wordOrder.length, blanked)),
    ghost: m >= 0.6 ? round(lerp(1.5, 3, ramp(m, 0.6, 1)) + 9 * d, 10) : 0,
    wash: round(0.16 * m + 0.4 * d),
    logRewrite: d >= 0.25 ? { index: logIndex, alt: logAlt } : null,
    misspelt,
  }
}

/** A label whose healthy text changes at runtime (e.g. the status line), misspelled the same way the plan would. */
export function decayedLabel(plan: DecayPlan, key: D7LabelKey, text: string, seed: string): string {
  return plan.misspelt.includes(key) ? misspell(text, seeded(`${seed}:label:${key}`)) : text
}
