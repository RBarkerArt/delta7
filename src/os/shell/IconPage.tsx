import AppIcon from './AppIcon'
import type { AppId } from '../types'

interface Props {
  apps: AppId[]
  isMobile: boolean
}

/**
 * One page of icons. Desktop: centred, wrapping rows of 5 (a short last row stays centred).
 * Phone: a 4-column grid, last row left-aligned like a home screen.
 */
export default function IconPage({ apps, isMobile }: Props) {
  return (
    <div className={`flex h-full w-full justify-center px-3 ${isMobile ? 'items-start pt-[13vh]' : 'items-center'}`}>
      {isMobile ? (
        <div className="grid grid-cols-4 gap-x-1 gap-y-5">
          {apps.map((id) => (
            <AppIcon key={id} appId={id} isMobile />
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap justify-center gap-x-9 gap-y-8" style={{ maxWidth: 5 * 136 + 4 * 36, marginTop: '-4vh' }}>
          {apps.map((id) => (
            <AppIcon key={id} appId={id} isMobile={false} />
          ))}
        </div>
      )}
    </div>
  )
}
