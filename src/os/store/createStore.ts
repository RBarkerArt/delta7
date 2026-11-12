import { useSyncExternalStore } from 'react'

export type Updater<T> = Partial<T> | ((prev: T) => Partial<T>)

export interface Store<T> {
  get: () => T
  set: (next: Updater<T>) => void
  subscribe: (listener: () => void) => () => void
  /** Selector must return a stable value (primitive or a reference held in state). */
  use: <S>(selector: (state: T) => S) => S
}

/** Tiny external store on top of useSyncExternalStore. State is replaced shallowly. */
export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial
  const listeners = new Set<() => void>()

  const get = () => state
  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }
  const set = (next: Updater<T>) => {
    const partial = typeof next === 'function' ? next(state) : next
    let changed = false
    for (const key in partial) {
      if (!Object.is(partial[key], state[key])) {
        changed = true
        break
      }
    }
    if (!changed) return
    state = { ...state, ...partial }
    listeners.forEach((l) => l())
  }
  function use<S>(selector: (s: T) => S): S {
    return useSyncExternalStore(subscribe, () => selector(state), () => selector(state))
  }
  return { get, set, subscribe, use }
}
