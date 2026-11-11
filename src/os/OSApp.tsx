import { Suspense, lazy } from 'react'
import { MotionConfig } from 'motion/react'
import BootGate from './boot/BootGate'
import Wallpaper from './wallpapers/Wallpaper'
import TopBar from './shell/TopBar'
import HomePager from './shell/HomePager'
import PageDots from './shell/PageDots'
import NotificationBanner from './shell/NotificationBanner'
import WindowLayer from './windows/WindowLayer'
import { useGlobalKeys } from './shell/useGlobalKeys'
import { useIsMobile } from './store/device'
import { useCurrentPage } from './store/layout'
import { devEnabled, useDevOpen } from './store/dev'
import { useReducedMotionPref } from './lib/useReducedMotionPref'

const DevPanel = lazy(() => import('./dev/DevPanel'))

export default function OSApp() {
  const isMobile = useIsMobile()
  const page = useCurrentPage()
  const reduced = useReducedMotionPref()
  const devOpen = useDevOpen()
  useGlobalKeys()

  return (
    <MotionConfig reducedMotion={reduced ? 'always' : 'never'}>
      <BootGate>
        <div
          data-testid="os-root"
          data-mobile={isMobile ? 'true' : 'false'}
          data-page={page}
          className="os-chrome fixed inset-0 overflow-clip font-os-sans text-os-cream"
        >
          <Wallpaper />
          <main className={`absolute inset-x-0 ${isMobile ? 'bottom-[64px] top-12' : 'bottom-[64px] top-16'}`}>
            <HomePager isMobile={isMobile} />
          </main>
          <PageDots isMobile={isMobile} />
          <div className="pointer-events-none absolute inset-0 z-30 isolate">
            <WindowLayer isMobile={isMobile} />
          </div>
          <TopBar isMobile={isMobile} />
          <NotificationBanner />
          {devEnabled && devOpen ? (
            <Suspense fallback={null}>
              <DevPanel />
            </Suspense>
          ) : null}
        </div>
      </BootGate>
    </MotionConfig>
  )
}
