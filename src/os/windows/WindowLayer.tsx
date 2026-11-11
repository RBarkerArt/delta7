import { AnimatePresence } from 'motion/react'
import AppBody from './AppBody'
import DesktopWindow from './DesktopWindow'
import { useWindowKeys } from './useWindowKeys'
import { useFocusedAppId, useOpenApps } from '../store/windows'

/**
 * Where open apps live. Desktop: free windows (minimized ones stay mounted so they keep their state).
 * Phone: plain full-screen panel for the front app (the real mobile presentation lands in phase 3).
 */
export default function WindowLayer({ isMobile }: { isMobile: boolean }) {
  const apps = useOpenApps()
  const focused = useFocusedAppId()
  useWindowKeys(!isMobile)

  if (isMobile) {
    const front = apps.find((a) => a.id === focused && !a.minimized)
    return front ? (
      <section
        data-testid={`window-${front.id}`}
        data-os-window={front.id}
        className="pointer-events-auto absolute inset-x-0 bottom-0 top-12 overflow-auto rounded-t-[18px] bg-os-cream text-os-ink"
      >
        <AppBody app={front} isMobile />
      </section>
    ) : null
  }
  return (
    <AnimatePresence>
      {apps.map((app, i) => (
        <DesktopWindow key={app.id} app={app} focused={app.id === focused} cascadeIndex={i} />
      ))}
    </AnimatePresence>
  )
}
