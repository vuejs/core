import {
  currentHydrationNode,
  enterHydrationBoundary,
  isComment,
  locateEndAnchor,
  locateHydrationNode,
  setCurrentHydrationNode,
} from './hydration'

interface HydratingSlotBoundaryState {
  endAnchor: Node | null
  fallbackActive: boolean
}

let currentHydratingSlotBoundaryState: HydratingSlotBoundaryState | null = null

function setCurrentHydratingSlotBoundaryState(
  state: HydratingSlotBoundaryState | null,
): HydratingSlotBoundaryState | null {
  try {
    return currentHydratingSlotBoundaryState
  } finally {
    currentHydratingSlotBoundaryState = state
  }
}

export function getCurrentSlotEndAnchor(): Node | null {
  return currentHydratingSlotBoundaryState
    ? currentHydratingSlotBoundaryState.endAnchor
    : null
}

export function withHydratingSlotBoundary<R>(fn: () => R): R {
  let endAnchor = getCurrentSlotEndAnchor()
  let exitHydrationBoundary: (() => void) | undefined

  locateHydrationNode()
  if (isComment(currentHydrationNode!, '[')) {
    endAnchor = locateEndAnchor(currentHydrationNode)
    setCurrentHydrationNode(currentHydrationNode.nextSibling)
    exitHydrationBoundary = enterHydrationBoundary(endAnchor)
  }
  const prevState = setCurrentHydratingSlotBoundaryState({
    endAnchor,
    fallbackActive: false,
  })

  try {
    return fn()
  } finally {
    setCurrentHydratingSlotBoundaryState(prevState)
    exitHydrationBoundary && exitHydrationBoundary()
  }
}

// Tracks hydration while a slot boundary is resolving fallback through inner
// empty control-flow fragments, e.g.
// - `<slot><template v-if="false" /></slot>`
// - `<slot><span v-for="item in items" /></slot>`.
// We need a boundary-level marker because the inner empty fragment can hydrate
// before slot render finishes deciding whether fallback will take over. While
// active, empty inner fragments should create their own runtime anchor instead
// of assuming SSR already provided the final insertion point.
export function isHydratingSlotFallbackActive(): boolean {
  return !!(
    currentHydratingSlotBoundaryState &&
    currentHydratingSlotBoundaryState.fallbackActive
  )
}

export function setCurrentHydratingSlotFallbackActive(
  active: boolean,
): boolean {
  try {
    return isHydratingSlotFallbackActive()
  } finally {
    if (currentHydratingSlotBoundaryState) {
      currentHydratingSlotBoundaryState.fallbackActive = active
    }
  }
}

export function withHydratingSlotFallbackActive<R>(fn: () => R): R {
  const prevState = setCurrentHydratingSlotFallbackActive(true)
  try {
    return fn()
  } finally {
    setCurrentHydratingSlotFallbackActive(prevState)
  }
}
