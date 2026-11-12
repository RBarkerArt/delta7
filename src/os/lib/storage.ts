const PREFIX = 'd7os:'

/** Safe localStorage read. Keys are prefixed with `d7os:`. */
export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(PREFIX + key)
    if (raw == null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

/** Safe localStorage write. Silently ignores quota / privacy-mode errors. */
export function writeJSON(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    /* storage unavailable */
  }
}

/** Safe localStorage delete. */
export function removeKey(key: string): void {
  try {
    window.localStorage.removeItem(PREFIX + key)
  } catch {
    /* storage unavailable */
  }
}

/** Safe delete of every `d7os:<prefix>…` key. */
export function removeKeysWithPrefix(prefix: string): void {
  try {
    const ls = window.localStorage
    const doomed: string[] = []
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i)
      if (k && k.startsWith(PREFIX + prefix)) doomed.push(k)
    }
    doomed.forEach((k) => ls.removeItem(k))
  } catch {
    /* storage unavailable */
  }
}
