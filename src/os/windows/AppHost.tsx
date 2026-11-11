// CRUDE PLACEHOLDER — the window-manager builder deletes and replaces this file.
// No drag, no resize, no icon animations: just enough to see apps open.
import { Suspense } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'
import { getApp } from '../apps/registry'
import { closeApp, focusApp, useFocusedAppId, useOpenApps } from '../store/windows'
import type { OpenApp } from '../store/windows'
import { fadeFast } from '../lib/motion'

function Body({ app, isMobile }: { app: OpenApp; isMobile: boolean }) {
  const def = getApp(app.id)
  const Component = def.component
  return (
    <Suspense fallback={<div className="h-full bg-os-cream" />}>
      <Component appId={app.id} params={app.params} isMobile={isMobile} />
    </Suspense>
  )
}

function CloseButton({ app }: { app: OpenApp }) {
  return (
    <button
      type="button"
      aria-label={`close ${getApp(app.id).label}`}
      data-testid={`window-close-${app.id}`}
      onClick={(e) => {
        e.stopPropagation()
        closeApp(app.id)
      }}
      className="flex h-7 w-7 items-center justify-center rounded-md text-os-ink-soft outline-none hover:bg-os-ink/[0.06] focus-visible:ring-2 focus-visible:ring-os-ink/30"
    >
      <X size={15} strokeWidth={1.5} />
    </button>
  )
}

export default function AppHost({ isMobile }: { isMobile: boolean }) {
  const apps = useOpenApps()
  const focused = useFocusedAppId()
  const visible = apps.filter((a) => !a.minimized)

  return (
    <AnimatePresence>
      {visible.map((app, i) => {
        const def = getApp(app.id)
        if (isMobile) {
          return (
            <motion.section
              key={app.id}
              data-testid={`window-${app.id}`}
              data-os-window={app.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={fadeFast}
              onPointerDown={() => focusApp(app.id)}
              className="pointer-events-auto absolute inset-x-0 bottom-0 top-12 flex flex-col overflow-hidden rounded-t-[16px] bg-os-cream font-os-sans text-os-ink"
              style={{ zIndex: app.z }}
            >
              <div className="flex h-11 shrink-0 items-center justify-between border-b border-os-ink/[0.08] px-3">
                <span className="flex items-center gap-2 font-os-mono text-[13px] lowercase">
                  <def.Glyph size={16} strokeWidth={1.5} /> {def.label}
                </span>
                <CloseButton app={app} />
              </div>
              <div className="min-h-0 flex-1 overflow-auto">
                <Body app={app} isMobile />
              </div>
            </motion.section>
          )
        }
        const w = `min(${def.defaultSize.w}px, 100vw - 80px)`
        const h = `min(${def.defaultSize.h}px, 100vh - 140px)`
        return (
          <motion.section
            key={app.id}
            data-testid={`window-${app.id}`}
            data-os-window={app.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={fadeFast}
            onPointerDown={() => focusApp(app.id)}
            className={`os-panel pointer-events-auto absolute flex flex-col overflow-hidden rounded-[16px] font-os-sans text-os-ink ${focused === app.id ? '' : 'brightness-[0.98]'}`}
            style={{
              width: `calc(${w})`,
              height: `calc(${h})`,
              left: `calc(50% - (${w}) / 2 + ${i * 28}px)`,
              top: `calc(50% - (${h}) / 2 + ${20 + i * 28}px)`,
              zIndex: app.z,
            }}
          >
            <div className="flex h-11 shrink-0 items-center justify-between border-b border-os-ink/[0.08] bg-os-cream-dim/40 pl-4 pr-2">
              <span className="flex items-center gap-2 font-os-mono text-[13px] lowercase">
                <def.Glyph size={16} strokeWidth={1.5} /> {def.label}
              </span>
              <CloseButton app={app} />
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              <Body app={app} isMobile={false} />
            </div>
          </motion.section>
        )
      })}
    </AnimatePresence>
  )
}
