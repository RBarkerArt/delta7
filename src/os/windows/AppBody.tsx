import { Suspense, memo } from 'react'
import { getApp } from '../apps/registry'
import { AppVisibleContext } from './appVisibility'
import type { AppId, AppParams } from '../types'

interface Props {
  id: AppId
  params: AppParams | undefined
  isMobile: boolean
  /** False while the host window is minimized or closing: the app's loops pause. */
  visible: boolean
}

/**
 * Lazy app body behind a quiet cream fallback. Memoised on plain props, so a focus or z-order change in the window
 * around it never re-renders the app.
 */
export default memo(function AppBody({ id, params, isMobile, visible }: Props) {
  const Component = getApp(id).component
  return (
    <AppVisibleContext value={visible}>
      <Suspense fallback={<div className="h-full bg-os-cream" />}>
        <Component appId={id} params={params} isMobile={isMobile} />
      </Suspense>
    </AppVisibleContext>
  )
})
