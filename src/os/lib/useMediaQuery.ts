import { useSyncExternalStore } from 'react'

function subscribeTo(query: string) {
  return (cb: () => void) => {
    const mql = window.matchMedia(query)
    mql.addEventListener('change', cb)
    return () => mql.removeEventListener('change', cb)
  }
}

const cache = new Map<string, (cb: () => void) => () => void>()

export function matches(query: string): boolean {
  return typeof window !== 'undefined' && window.matchMedia(query).matches
}

export function useMediaQuery(query: string): boolean {
  let sub = cache.get(query)
  if (!sub) {
    sub = subscribeTo(query)
    cache.set(query, sub)
  }
  return useSyncExternalStore(sub, () => matches(query), () => false)
}
