import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { CloseGlyph, MaximizeGlyph, MinimizeGlyph, RestoreGlyph } from './controlGlyphs'
import type { AppDefinition } from '../types'

interface Props {
  def: AppDefinition
  focused: boolean
  maximized: boolean
  onPointerDown: (e: ReactPointerEvent) => void
  onToggleMaximize: () => void
  onMinimize: () => void
  onClose: () => void
}

function Control({ label, testId, onClick, children }: { label: string; testId: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      data-testid={testId}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      onDoubleClick={(e) => e.stopPropagation()}
      className="flex h-8 w-8 items-center justify-center rounded-[9px] text-os-ink/70 outline-none transition-colors duration-150 hover:bg-[#e9dccd] hover:text-os-ink active:bg-[#e2d2c1] focus-visible:ring-2 focus-visible:ring-os-ink/30"
    >
      {children}
    </button>
  )
}

/** Title area: glyph + lowercase mono title on the left (drag zone), three quiet controls on the right. */
export default function TitleBar({ def, focused, maximized, onPointerDown, onToggleMaximize, onMinimize, onClose }: Props) {
  return (
    <div
      data-testid={`window-title-${def.id}`}
      onPointerDown={onPointerDown}
      onDoubleClick={onToggleMaximize}
      className={`flex h-12 shrink-0 cursor-default items-center justify-between border-b border-os-ink/[0.08] pl-4 pr-2 transition-colors duration-200 ${focused ? 'bg-[#ebe3d8]' : 'bg-[#efe8de]'}`}
      style={{ touchAction: 'none' }}
    >
      <div className={`flex min-w-0 items-center gap-2.5 transition-opacity duration-200 ${focused ? 'opacity-100' : 'opacity-60'}`}>
        <def.Glyph size={18} strokeWidth={1.5} className="shrink-0 text-os-ink/80" />
        <h2 className="truncate font-os-mono text-[13.5px] lowercase tracking-[0.02em] text-os-ink">{def.label}</h2>
      </div>
      <div className="flex items-center gap-0.5">
        <Control label={`minimize ${def.label}`} testId={`window-min-${def.id}`} onClick={onMinimize}>
          <MinimizeGlyph />
        </Control>
        <Control
          label={maximized ? `restore ${def.label}` : `maximize ${def.label}`}
          testId={`window-max-${def.id}`}
          onClick={onToggleMaximize}
        >
          {maximized ? <RestoreGlyph /> : <MaximizeGlyph />}
        </Control>
        <Control label={`close ${def.label}`} testId={`window-close-${def.id}`} onClick={onClose}>
          <CloseGlyph />
        </Control>
      </div>
    </div>
  )
}
