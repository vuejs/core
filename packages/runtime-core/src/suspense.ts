import { warn } from './warning'

export const SuspenseSymbol = __DEV__ ? Symbol('Suspense key') : Symbol()

export interface SuspenseBoundary {
  deps: number
  isResolved: boolean
  parent: SuspenseBoundary | null
  ping(): void
  resolve(): void
  onResolve(cb: () => void): void
}

export function createSuspenseBoundary(
  parent: SuspenseBoundary | null
): SuspenseBoundary {
  let onResolve: () => void

  if (parent && !parent.isResolved) {
    parent.deps++
  }

  const boundary: SuspenseBoundary = {
    deps: 0,
    isResolved: false,
    parent: parent && parent.isResolved ? parent : null,
    ping() {
      // one of the deps resolved - re-entry from root suspense
      if (boundary.parent) {
      }
      if (__DEV__ && boundary.deps < 0) {
        warn(`Suspense boundary pinged when deps === 0. This is a bug.`)
      }
    },
    resolve() {
      boundary.isResolved = true
      if (parent && !parent.isResolved) {
        parent.ping()
      } else {
        onResolve && onResolve()
      }
    },
    onResolve(cb: () => void) {
      onResolve = cb
    }
  }
  return boundary
}
