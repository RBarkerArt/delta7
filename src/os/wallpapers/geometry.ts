import type { Blob } from './specs'

/**
 * Scene geometry for the generated wallpapers. Landscape uses a 1600×1000 box; tall screens get their
 * own 1000×2000 composition (gentle ridges low on the screen, the glow bottom-right) instead of a
 * squashed copy. Both are drawn with preserveAspectRatio="none".
 */
export interface Geometry {
  viewBox: string
  width: number
  /** far → near */
  hills: [string, string, string, string]
  glow: Pick<Blob, 'cx' | 'cy'>
  /** Maps a landscape sky blob into this box. */
  mapBlob: (b: Blob) => Blob
  fogY: [number, number]
  floorY: [number, number]
}

export const LANDSCAPE: Geometry = {
  viewBox: '0 0 1600 1000',
  width: 1600,
  hills: [
    // FAR descends left → right; RISE climbs on the right; the low glow sits in the valley between them.
    'M-20 575 C 180 556 420 572 640 620 C 860 668 1040 728 1240 752 C 1400 770 1520 772 1620 768 L1620 1000 L-20 1000 Z',
    'M520 900 C 760 860 960 808 1150 772 C 1310 742 1440 676 1620 600 L1620 1000 L520 1000 Z',
    'M-20 790 C 200 752 420 750 660 786 C 900 822 1120 868 1360 872 C 1480 874 1560 862 1620 852 L1620 1000 L-20 1000 Z',
    'M-20 905 C 320 872 640 880 940 916 C 1180 944 1418 946 1620 920 L1620 1000 L-20 1000 Z',
  ],
  glow: { cx: 1120, cy: 812 },
  mapBlob: (b) => b,
  fogY: [640, 900],
  floorY: [760, 1000],
}

export const PORTRAIT: Geometry = {
  viewBox: '0 0 1000 2000',
  width: 1000,
  hills: [
    'M-20 1440 C 200 1404 430 1418 640 1480 C 800 1526 920 1556 1020 1562 L1020 2000 L-20 2000 Z',
    'M320 1720 C 500 1680 660 1620 780 1580 C 880 1546 950 1500 1020 1466 L1020 2000 L320 2000 Z',
    'M-20 1650 C 220 1606 460 1614 680 1676 C 840 1720 950 1736 1020 1732 L1020 2000 L-20 2000 Z',
    'M-20 1840 C 300 1796 660 1810 1020 1856 L1020 2000 L-20 2000 Z',
  ],
  glow: { cx: 790, cy: 1665 },
  mapBlob: (b) => ({ ...b, cx: b.cx * 0.625, cy: b.cy * 1.45, rx: b.rx * 0.7, ry: b.ry * 1.25 }),
  fogY: [1320, 1780],
  floorY: [1560, 2000],
}
