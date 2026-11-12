import AppIcon from './AppIcon'
import type { GridFit } from './gridFit'
import type { AppId } from '../types'

interface Props {
  apps: AppId[]
  isMobile: boolean
  /** Columns and vertical placement for the space the page has (see gridFit). */
  fit: GridFit | null
}

/**
 * One page of icons. Desktop: centred, wrapping rows (a short last row stays centred).
 * Phone: a grid, last row left-aligned like a home screen. Columns follow the available space.
 */
export default function IconPage({ apps, isMobile, fit }: Props) {
  if (isMobile) {
    const cols = fit?.cols ?? 4
    return (
      <div className="flex w-full justify-center px-3" style={{ paddingTop: fit?.offsetY ?? '13vh' }}>
        <div className="grid gap-x-1 gap-y-5" style={{ gridTemplateColumns: `repeat(${cols}, 82px)` }}>
          {apps.map((id) => (
            <AppIcon key={id} appId={id} isMobile />
          ))}
        </div>
      </div>
    )
  }
  return (
    <div className="flex min-h-full w-full items-center justify-center px-3">
      <div
        className="flex flex-wrap justify-center gap-x-9 gap-y-8"
        style={{ maxWidth: fit?.width ?? 5 * 136 + 4 * 36, marginTop: fit ? fit.offsetY : '-4vh' }}
      >
        {apps.map((id) => (
          <AppIcon key={id} appId={id} isMobile={false} />
        ))}
      </div>
    </div>
  )
}
