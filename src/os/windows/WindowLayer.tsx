import { useEffect } from 'react'
import { AnimatePresence } from 'motion/react'
import DesktopWindow from './DesktopWindow'
import MobileSheet from './MobileSheet'
import { useWindowKeys } from './useWindowKeys'
import { backgroundAllExcept, useFocusedAppId, useOpenApps } from '../store/windows'

/**
 * Where open apps live. Desktop: free windows (minimized ones stay mounted so they keep their state).
 * Phone: one full-screen sheet for the front app; other open apps are backgrounded in the store.
 */
export default function WindowLayer({ isMobile }: { isMobile: boolean }) {
  const apps = useOpenApps()
  const focused = useFocusedAppId()
  useWindowKeys(!isMobile)

  const front = isMobile ? apps.find((a) => a.id === focused && !a.minimized) : undefined
  const othersVisible = isMobile && front ? apps.some((a) => a.id !== front.id && !a.minimized) : false
  useEffect(() => {
    if (othersVisible && front) backgroundAllExcept(front.id)
  }, [othersVisible, front])

  if (isMobile) {
    return <AnimatePresence>{front ? <MobileSheet key={front.id} app={front} /> : null}</AnimatePresence>
  }
  return (
    <AnimatePresence>
      {apps.map((app, i) => (
        <DesktopWindow key={app.id} app={app} focused={app.id === focused} cascadeIndex={i} />
      ))}
    </AnimatePresence>
  )
}
