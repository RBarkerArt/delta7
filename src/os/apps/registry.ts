import { lazy } from 'react'
import { Archive, AudioLines, Bookmark, FlaskConical, Folder, Images, MessageCircleMore, RadioTower, Search, Text } from 'lucide-react'
import { WaveGlyph } from '../shell/glyphs'
import type { AppDefinition, AppId } from '../types'

const Placeholder = lazy(() => import('./PlaceholderApp'))
const Delta7 = lazy(() => import('../delta7/Delta7App'))
const Tuner = lazy(() => import('../tuner/TunerApp'))

const STD = { defaultSize: { w: 720, h: 480 }, minSize: { w: 420, h: 300 } }

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
  audio: { id: 'audio', label: 'audio', tint: '#9B5E5E', Glyph: AudioLines, component: Placeholder, ...STD },
  memories: { id: 'memories', label: 'memories', tint: '#84806C', Glyph: Images, component: Placeholder, ...STD },
  messages: { id: 'messages', label: 'messages', tint: '#8A5F66', Glyph: MessageCircleMore, component: Placeholder, ...STD },
  notes: { id: 'notes', label: 'notes', tint: '#B79F8E', Glyph: Text, component: Placeholder, ...STD },
  files: { id: 'files', label: 'files', tint: '#B07F4A', Glyph: Folder, component: Placeholder, ...STD },
  lab: { id: 'lab', label: 'lab', tint: '#6E6168', Glyph: FlaskConical, component: Placeholder, ...STD },
  archive: { id: 'archive', label: 'archive', tint: '#5F7C7A', Glyph: Archive, component: Placeholder, ...STD },
  keep: { id: 'keep', label: 'keep', tint: '#B08378', Glyph: Bookmark, component: Placeholder, ...STD },
  find: { id: 'find', label: 'find', tint: '#7E615C', Glyph: Search, component: Placeholder, ...STD },
}

export function getApp(id: AppId): AppDefinition {
  return APPS[id]
}
