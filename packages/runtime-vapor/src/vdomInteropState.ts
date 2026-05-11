// if vdom interop plugin is not installed, isInteropEnabled will be false
// the interop code path will be tree-shaken out by bundlers
export let isInteropEnabled = false

export function setInteropEnabled(): void {
  isInteropEnabled = true
}

export const interopKey: unique symbol = Symbol(`interop`)

// Active while probing a Vapor slot for VDOM child metadata. This dry pass must
// not mount or hydrate the real slot output.
export let isCollectingVdomSlotVNodes = false

export function withVdomSlotVNodeCollection<T>(fn: () => T): T {
  const prev = isCollectingVdomSlotVNodes
  isCollectingVdomSlotVNodes = true
  try {
    return fn()
  } finally {
    isCollectingVdomSlotVNodes = prev
  }
}
