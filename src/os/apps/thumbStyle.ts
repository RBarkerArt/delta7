import { seeded } from '../lib/seeded'

/** Muted OS palette for placeholder thumbnails. */
const PALETTE = ['#9B5E5E', '#8A5F66', '#B07F4A', '#84806C', '#5F7C7A', '#B79F8E', '#B08378', '#7E615C', '#6E6168', '#C9A48A']

/** Deterministic soft gradient for a file name: a warm glow over a two-tone haze. */
export function thumbBackground(name: string): string {
  const rnd = seeded(`thumb:${name}`)
  const pick = () => PALETTE[Math.floor(rnd() * PALETTE.length)]
  const a = pick()
  const b = pick()
  const c = pick()
  const gx = Math.round(20 + rnd() * 60)
  const gy = Math.round(15 + rnd() * 55)
  const angle = Math.round(rnd() * 360)
  return [
    `radial-gradient(ellipse at ${gx}% ${gy}%, rgba(255, 226, 196, 0.55) 0%, rgba(255, 226, 196, 0) 55%)`,
    `radial-gradient(ellipse at ${100 - gx}% ${100 - gy}%, ${c}cc 0%, ${c}00 60%)`,
    `linear-gradient(${angle}deg, ${a}, ${b})`,
  ].join(', ')
}
