import { Suspense, lazy } from 'react'
import type { ComponentType, LazyExoticComponent } from 'react'
import type { AppProps } from '../types'

const Tuner: LazyExoticComponent<ComponentType<AppProps>> = lazy(() => import('../tuner/TunerApp'))

/**
 * The Tuner inside Delta7. Deliberately outside every decay effect: no blur, rotation, tearing, opacity dips,
 * grain or misspelling — it must always be readable and clickable so recovery is always possible.
 */
export default function TunerView({ isMobile }: { isMobile: boolean }) {
  return (
    <div data-testid="d7-tuner-view" className="h-full min-h-full">
      <Suspense fallback={<div className="h-full" />}>
        <Tuner appId="tuner" isMobile={isMobile} />
      </Suspense>
    </div>
  )
}
