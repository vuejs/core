// SFC scoped style ID management.
// These are only used in esm-bundler builds, but since exports cannot be
// conditional, we can only drop inner implementations in non-bundler builds.

export let currentScopeId: string | null = null
const scopeIdStack: string[] = []

export function pushScopeId(id: string) {
  if (__BUNDLER__) {
    scopeIdStack.push((currentScopeId = id))
  }
}

export function popScopeId() {
  if (__BUNDLER__) {
    scopeIdStack.pop()
    currentScopeId = scopeIdStack[scopeIdStack.length - 1] || null
  }
}

export function withScopeId(id: string): <T extends Function>(fn: T) => T {
  if (__BUNDLER__) {
    return ((fn: Function) => {
      return function(this: any) {
        pushScopeId(id)
        const res = fn.apply(this, arguments)
        popScopeId()
        return res
      }
    }) as any
  } else {
    return undefined as any
  }
}
