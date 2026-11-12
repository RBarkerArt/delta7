import type { ComponentType, LazyExoticComponent } from 'react'

export type AppId =
  | 'delta7'
  | 'tuner'
  | 'gallery'
  | 'video'
  | 'messages'
  | 'files'
  | 'logs'
  | 'audio'
  | 'notes'
  | 'lab'
  | 'archive'
  | 'keep'

export type AppParams = Record<string, string>

export interface AppProps {
  appId: AppId
  params?: AppParams
  isMobile: boolean
}

export interface AppDefinition {
  id: AppId
  /** lowercase label */
  label: string
  /** CSS colour for the icon tile */
  tint: string
  Glyph: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
  component: LazyExoticComponent<ComponentType<AppProps>>
  defaultSize: { w: number; h: number }
  minSize: { w: number; h: number }
}

export interface IconPlacement {
  appId: AppId
  page: number
  index: number
}

export type DecayLevel = 'stable' | 'recovering' | 'fraying' | 'fragmented'
