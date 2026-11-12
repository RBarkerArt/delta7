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
import { useSheetRaised } from './store/ui'
import { useDevOpen } from './store/dev'
import { DEV_MODE } from './lib/devMode'
import { useReducedMotionPref } from './lib/useReducedMotionPref'

// Build-time constant: a production build drops the dev panel chunk entirely.
const DevPanel = DEV_MODE ? lazy(() => import('./dev/DevPanel')) : null

export default function OSApp() {
  const isMobile = useIsMobile()
  const page = useCurrentPage()
  const reduced = useReducedMotionPref()
  const devOpen = useDevOpen()
  const sheetRaised = useSheetRaised()
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
          {/* First in the DOM so keyboard order on the home is top bar → icons → page dots (stacking is by z-index). */}
          <TopBar isMobile={isMobile} />
          <main className={`absolute inset-x-0 ${isMobile ? 'bottom-[64px] top-12' : 'bottom-[64px] top-16'}`}>
            <HomePager isMobile={isMobile} />
          </main>
          <PageDots isMobile={isMobile} />
          <div className={`pointer-events-none absolute inset-0 isolate ${sheetRaised ? 'z-[45]' : 'z-30'}`}>
            <WindowLayer isMobile={isMobile} />
          </div>
          <NotificationBanner />
          {DevPanel && devOpen ? (
            <Suspense fallback={null}>
              <DevPanel />
            </Suspense>
          ) : null}
        </div>
      </BootGate>
    </MotionConfig>
  )
}
