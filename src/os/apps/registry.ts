import { lazy } from 'react'
import { Film, Folder, Images, MessageCircleMore, RadioTower, ScrollText } from 'lucide-react'
import { WaveGlyph } from '../shell/glyphs'
import type { AppDefinition, AppId } from '../types'

const Delta7 = lazy(() => import('../delta7/Delta7App'))
const Tuner = lazy(() => import('../tuner/TunerApp'))
const GalleryBody = lazy(() => import('./GalleryApp'))
const VideoBody = lazy(() => import('./VideoApp'))
const MessagesBody = lazy(() => import('./MessagesApp'))
const FilesBody = lazy(() => import('./FilesApp'))
const LogsBody = lazy(() => import('./LogsApp'))

const STD = { defaultSize: { w: 720, h: 480 }, minSize: { w: 360, h: 280 } }

export const APPS: Record<AppId, AppDefinition> = {
  delta7: {
    id: 'delta7',
    label: 'delta7',
    tint: '#4A3A44',
    Glyph: WaveGlyph,
    component: Delta7,
    defaultSize: { w: 960, h: 620 },
    minSize: { w: 560, h: 380 },
  },
  tuner: {
    id: 'tuner',
    label: 'tuner',
    tint: '#5B5A60',
    Glyph: RadioTower,
    component: Tuner,
    defaultSize: { w: 560, h: 440 },
    minSize: { w: 420, h: 340 },
  },
  // Tints come from the `os` palette (tailwind.config.js); neighbours on the home never share one.
  gallery: { id: 'gallery', label: 'gallery', tint: '#84806C', Glyph: Images, component: GalleryBody, ...STD },
  video: { id: 'video', label: 'video', tint: '#5F7C7A', Glyph: Film, component: VideoBody, ...STD },
  messages: { id: 'messages', label: 'messages', tint: '#8A5F66', Glyph: MessageCircleMore, component: MessagesBody, ...STD },
  files: { id: 'files', label: 'files', tint: '#B07F4A', Glyph: Folder, component: FilesBody, ...STD },
  logs: { id: 'logs', label: 'logs', tint: '#7E615C', Glyph: ScrollText, component: LogsBody, ...STD },
}

export function getApp(id: AppId): AppDefinition {
  return APPS[id]
}

/** Is this a registered app? Saved state from an older build can name apps that no longer exist. */
export function isAppId(id: unknown): id is AppId {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(APPS, id)
}
