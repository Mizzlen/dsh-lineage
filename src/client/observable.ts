// Minimal observable source compatible with the slots renderer's reserved
// `hooks` compartment (getSnapshot/subscribe; slots.md L105).
export interface Source<T> {
  getSnapshot(): T
  subscribe(listener: () => void): () => void
}

export function createSource<T>(initial: T): Source<T> & { set(value: T): void } {
  let value = initial
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => value,
    subscribe: listener => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    set: next => {
      if (Object.is(next, value)) return
      value = next
      for (const listener of listeners) listener()
    },
  }
}
