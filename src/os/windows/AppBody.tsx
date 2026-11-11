import { Suspense } from 'react'
import { getApp } from '../apps/registry'
import type { OpenApp } from '../store/windows'

/** Lazy app body behind a quiet cream fallback. */
export default function AppBody({ app, isMobile }: { app: OpenApp; isMobile: boolean }) {
  const Component = getApp(app.id).component
  return (
    <Suspense fallback={<div className="h-full bg-os-cream" />}>
      <Component appId={app.id} params={app.params} isMobile={isMobile} />
    </Suspense>
  )
}
