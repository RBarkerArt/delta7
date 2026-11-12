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
import { useBackGuard } from './shell/useBackGuard'
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
  useBackGuard(isMobile)

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
          {/* The bottom band is reserved for the page dots (phone: their 44px hit area), so no label sits under them. */}
          <main
            aria-label="desktop"
            data-os-region="desktop"
            className={`absolute inset-x-0 ${isMobile ? 'top-12' : 'top-16'}`}
            style={{ bottom: isMobile ? 'calc(env(safe-area-inset-bottom, 0px) + 84px)' : 64 }}
          >
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
