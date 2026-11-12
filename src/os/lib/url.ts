import { DEV_MODE } from './devMode'

/**
 * Read-once URL params for dev / screenshot conveniences. Dev builds only: in a production build every flag reads
 * as absent, so `?skipboot`, `?time`, `?wallpaper`… do nothing. Nothing else in `src/os/` reads the query string.
 */
const params =
  !DEV_MODE || typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search)

export function urlParam(name: string): string | null {
  if (!DEV_MODE) return null
  return params.get(name)
}

export function urlFlag(name: string): boolean {
  if (!DEV_MODE) return false
  const v = params.get(name)
  return v === '1' || v === 'true'
}
