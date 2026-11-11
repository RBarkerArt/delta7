/** Read-once URL params for dev / screenshot conveniences. */
const params = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search)

export function urlParam(name: string): string | null {
  return params.get(name)
}

export function urlFlag(name: string): boolean {
  const v = params.get(name)
  return v === '1' || v === 'true'
}
