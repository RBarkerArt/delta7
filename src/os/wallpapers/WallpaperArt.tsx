import { useId } from 'react'
import { GRAIN_URL, WALLPAPERS } from './specs'
import { LANDSCAPE, PORTRAIT } from './geometry'
import type { Blob } from './specs'
import type { WallpaperName } from '../store/settings'

interface Props {
  name: WallpaperName
  className?: string
  /** Swatches skip the grain (it does not scale down nicely). */
  grain?: boolean
  /** Tall screens get their own composition (see geometry.ts). */
  portrait?: boolean
}

/**
 * The static wallpaper picture. Nothing in here animates — blur is baked once by the SVG filters,
 * so a parent may move it with transforms only.
 */
export default function WallpaperArt({ name, className, grain = true, portrait = false }: Props) {
  const spec = WALLPAPERS[name]
  const geo = portrait ? PORTRAIT : LANDSCAPE
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const fid = (k: string) => `wp-${uid}-${k}`
  const url = (k: string) => `url(#${fid(k)})`

  const blob = (b: Blob, key: string) => (
    <ellipse
      key={key}
      cx={b.cx}
      cy={b.cy}
      rx={b.rx}
      ry={b.ry}
      fill={b.color}
      opacity={b.opacity}
      filter={url(`b${b.blur}`)}
      transform={b.rotate ? `rotate(${b.rotate} ${b.cx} ${b.cy})` : undefined}
    />
  )
  const blurs = Array.from(
    new Set([...spec.clouds.map((c) => c.blur), spec.horizonGlow.blur, spec.horizonGlow.blur * 3, Math.round(spec.horizonGlow.blur * 0.6), ...spec.hills.map((h) => h.blur)]),
  )
  const hill = (i: number) => {
    const h = spec.hills[i]
    return <path key={`h${i}`} d={geo.hills[i]} fill={url(`h${i}`)} opacity={h.opacity} filter={url(`b${h.blur}`)} />
  }
  const g = { ...spec.horizonGlow, ...geo.glow }
  const W = geo.width

  return (
    <div className={`absolute inset-0 overflow-hidden ${className ?? ''}`} style={{ background: spec.sky }} aria-hidden="true">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={geo.viewBox}
        preserveAspectRatio="none"
      >
        <defs>
          {blurs.map((b) => (
            <filter key={b} id={fid(`b${b}`)} x="-60%" y="-60%" width="220%" height="220%" colorInterpolationFilters="sRGB">
              <feGaussianBlur stdDeviation={b} />
            </filter>
          ))}
          {spec.hills.map((h, i) => (
            <linearGradient key={i} id={fid(`h${i}`)} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={h.top} />
              <stop offset="0.55" stopColor={h.bottom} />
              <stop offset="1" stopColor={h.bottom} />
            </linearGradient>
          ))}
          <linearGradient id={fid('fog')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={spec.fog} stopOpacity="0" />
            <stop offset="0.45" stopColor={spec.fog} stopOpacity="0.38" />
            <stop offset="1" stopColor={spec.fog} stopOpacity="0" />
          </linearGradient>
          <linearGradient id={fid('floor')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={spec.floor} stopOpacity="0" />
            <stop offset="1" stopColor={spec.floor} stopOpacity="0.7" />
          </linearGradient>
        </defs>

        {spec.clouds.map((c, i) => blob(geo.mapBlob(c), `c${i}`))}

        {/* far ridge, then the low light in the valley, then the ridges in front of it */}
        {hill(0)}
        {blob({ ...g, rx: g.rx * 2.4, ry: g.ry * 2.6, opacity: g.opacity * 0.45, blur: g.blur * 3 }, 'glow-wide')}
        {hill(1)}
        <rect x="-20" y={geo.fogY[0]} width={W + 40} height={geo.fogY[1] - geo.fogY[0]} fill={url('fog')} />
        {/* the light itself sits just behind the near ridge, in front of the haze */}
        {blob(g, 'glow')}
        {blob({ ...g, rx: g.rx * 0.5, ry: g.ry * 0.55, color: '#ffe0bc', opacity: g.opacity * 0.55, blur: Math.round(g.blur * 0.6) }, 'glow-core')}
        {hill(2)}
        {blob({ ...g, cy: g.cy + (portrait ? 160 : 110), rx: g.rx * 1.6, ry: g.ry * 0.7, opacity: g.opacity * 0.22, blur: g.blur * 3 }, 'glow-low')}
        {hill(3)}
        <rect x="-20" y={geo.floorY[0]} width={W + 40} height={geo.floorY[1] - geo.floorY[0]} fill={url('floor')} />
      </svg>

      {/* soft vignette */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 90% 85% at 50% 42%, rgba(0,0,0,0) 58%, rgba(40,26,34,0.26) 100%)' }}
      />
      {grain ? (
        <div
          className="absolute inset-0 mix-blend-overlay"
          style={{ backgroundImage: GRAIN_URL, backgroundSize: '220px 220px', opacity: spec.grain }}
        />
      ) : null}
    </div>
  )
}
