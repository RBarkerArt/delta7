import type { ReactNode } from 'react'

/**
 * STUB — the Phase-6 builder replaces this file.
 * Boot animation (< 2s) + lock screen go here; `?skipboot=1` must bypass both and go straight to the desktop.
 * For now it renders the shell directly.
 */
export default function BootGate({ children }: { children: ReactNode }) {
  return <>{children}</>
}
