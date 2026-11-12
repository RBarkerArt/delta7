import type { WallpaperName } from '../store/settings'

/**
 * Generated wallpapers: layered CSS gradients (sky + glows, sized in % so they reflow on any aspect)
 * plus one static SVG (blurred clouds, a horizon glow and hill silhouettes; shapes in geometry.ts)
 * plus a grain tile. No images, no recognisable objects.
 */

export interface Blob {
  cx: number
  cy: number
  rx: number
  ry: number
  color: string
  opacity: number
  blur: number
  rotate?: number
}

export interface Hill {
  /** Colour at the ridge crest… */
  top: string
  /** …fading to this lower down, so the body melts into haze. */
  bottom: string
  opacity: number
  blur: number
}

export interface WallpaperSpec {
  name: WallpaperName
  /** CSS `background` (comma-separated layers, top first). */
  sky: string
  clouds: Blob[]
  /** Low glow that sits between the far and the near hills. */
  horizonGlow: Blob
  hills: Hill[]
  /** Haze band laid over the hills so they melt into the air. */
  fog: string
  /** Bottom shade colour. */
  floor: string
  grain: number
}

interface Palette {
  /** Vertical sky stops, top → bottom. */
  sky: [string, string, string, string, string, string]
  /** Cool shade drifting in from the top-left. */
  shade: string
  /** Warm diffuse light off-centre right (the sun behind fog). */
  sun: string
  sunStrength: number
  /** Rose body light in the middle of the sky. */
  rose: string
  cloudDark: string
  cloudLight: string
  glow: string
  glowStrength: number
  ridges: [Hill['top'], Hill['bottom']][]
  fog: string
  floor: string
  grain: number
}

const a = (hex: string, alpha: number) => {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}

function build(name: WallpaperName, p: Palette): WallpaperSpec {
  const [s0, s1, s2, s3, s4, s5] = p.sky
  return {
    name,
    sky: [
      `radial-gradient(ellipse 22% 30% at 72% 34%, ${a(p.sun, 0.62 * p.sunStrength)} 0%, ${a(p.sun, 0.24 * p.sunStrength)} 48%, ${a(p.sun, 0)} 80%)`,
      `radial-gradient(ellipse 42% 52% at 74% 40%, ${a(p.sun, 0.3 * p.sunStrength)} 0%, ${a(p.sun, 0)} 72%)`,
      `radial-gradient(ellipse 62% 58% at 8% 6%, ${a(p.shade, 0.6)} 0%, ${a(p.shade, 0)} 72%)`,
      `radial-gradient(ellipse 58% 42% at 38% 48%, ${a(p.rose, 0.42)} 0%, ${a(p.rose, 0)} 72%)`,
      `radial-gradient(ellipse 50% 60% at 100% 62%, ${a(p.rose, 0.35)} 0%, ${a(p.rose, 0)} 70%)`,
      `linear-gradient(180deg, ${s0} 0%, ${s1} 20%, ${s2} 42%, ${s3} 58%, ${s4} 78%, ${s5} 100%)`,
    ].join(', '),
    clouds: [
      { cx: 330, cy: 170, rx: 560, ry: 110, color: p.cloudDark, opacity: 0.5, blur: 60, rotate: -4 },
      { cx: 980, cy: 110, rx: 460, ry: 70, color: p.cloudDark, opacity: 0.35, blur: 50, rotate: 3 },
      { cx: 640, cy: 380, rx: 640, ry: 70, color: p.cloudLight, opacity: 0.32, blur: 46, rotate: -5 },
      { cx: 260, cy: 470, rx: 360, ry: 60, color: p.cloudDark, opacity: 0.22, blur: 50, rotate: 6 },
      { cx: 1250, cy: 300, rx: 120, ry: 300, color: p.sun, opacity: 0.32 * p.sunStrength, blur: 70, rotate: 32 },
      { cx: 1418, cy: 470, rx: 340, ry: 70, color: p.cloudLight, opacity: 0.25, blur: 46, rotate: -10 },
    ],
    horizonGlow: { cx: 1130, cy: 752, rx: 250, ry: 62, color: p.glow, opacity: p.glowStrength, blur: 30 },
    hills: [0, 1, 2, 3].map((i) => ({
      top: p.ridges[i][0],
      bottom: p.ridges[i][1],
      opacity: [0.78, 0.82, 0.86, 0.9][i],
      blur: [7, 6, 6, 5][i],
    })),
    fog: p.fog,
    floor: p.floor,
    grain: p.grain,
  }
}

export const WALLPAPERS: Record<WallpaperName, WallpaperSpec> = {
  // Closest to the reference: dusty rose + mauve + warm grey, amber light behind fog.
  haze: build('haze', {
    sky: ['#736770', '#887279', '#a7837f', '#b38883', '#a27b7c', '#8a6a6f'],
    shade: '#625a68',
    sun: '#f2a676',
    sunStrength: 1.2,
    rose: '#c4928c',
    cloudDark: '#6c6470',
    cloudLight: '#cfa39a',
    glow: '#ffb47c',
    glowStrength: 0.95,
    ridges: [
      ['#957178', '#b08a89'],
      ['#936f76', '#ab8584'],
      ['#87656d', '#9b7a7c'],
      ['#6f525b', '#7d6068'],
    ],
    fog: '#c39b96',
    floor: '#5d464d',
    grain: 0.16,
  }),
  // Later, cooler: violet greys, a low red-amber glow.
  dusk: build('dusk', {
    sky: ['#4b4357', '#5c4f66', '#7a5e6e', '#8b6670', '#76596a', '#5a4655'],
    shade: '#3d3750',
    sun: '#e48a6c',
    sunStrength: 0.75,
    rose: '#9a6e7a',
    cloudDark: '#463f58',
    cloudLight: '#9c7380',
    glow: '#f49468',
    glowStrength: 0.85,
    ridges: [
      ['#76586a', '#866474'],
      ['#6c5064', '#7b5c6c'],
      ['#5a4356', '#694f60'],
      ['#463444', '#523d4d'],
    ],
    fog: '#946e7c',
    floor: '#352833',
    grain: 0.13,
  }),
  // Warmer and brighter: peach and amber.
  ember: build('ember', {
    sky: ['#866b6e', '#a07a76', '#c0927f', '#c8937e', '#b07d74', '#8f6466'],
    shade: '#7a6066',
    sun: '#ffb070',
    sunStrength: 1.25,
    rose: '#dca088',
    cloudDark: '#806670',
    cloudLight: '#e6b29a',
    glow: '#ffc07a',
    glowStrength: 1,
    ridges: [
      ['#b38880', '#c3998c'],
      ['#a77c78', '#b88d84'],
      ['#91676b', '#a47b79'],
      ['#77535b', '#866066'],
    ],
    fog: '#d6a690',
    floor: '#62434a',
    grain: 0.11,
  }),
  // Pale and grey, very little colour; hills barely there.
  fog: build('fog', {
    sky: ['#7f777d', '#90858a', '#a49593', '#a99794', '#9c898c', '#86757d'],
    shade: '#7c767f',
    sun: '#ecc0a0',
    sunStrength: 0.7,
    rose: '#c8b2ad',
    cloudDark: '#857e87',
    cloudLight: '#d8cbc6',
    glow: '#f4c8a2',
    glowStrength: 0.6,
    ridges: [
      ['#a8989a', '#b5a6a6'],
      ['#a19093', '#ae9e9f'],
      ['#928184', '#a09091'],
      ['#7e6d74', '#8b7b80'],
    ],
    fog: '#cfc2be',
    floor: '#6c5d63',
    grain: 0.1,
  }),
}

/** Grain tile (feTurbulence), used at low opacity. */
export const GRAIN_URL =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.5  0 0 0 0 0.45  0 0 0 0 0.45  0 0 0 1.6 -0.35'/></filter><rect width='220' height='220' filter='url(%23n)'/></svg>\")"
