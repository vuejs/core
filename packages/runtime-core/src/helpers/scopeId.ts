// SFC scoped style ID management.
// These are only used in esm-bundler builds, but since exports cannot be
// conditional, we can only drop inner implementations in non-bundler builds.

import { withCtx } from './withRenderContext'

export let currentScopeId: string | null = null
const scopeIdStack: string[] = []

/**
 * @internal
 */
export function pushScopeId(id: string) {
  scopeIdStack.push((currentScopeId = id))
}

/**
 * @internal
 */
export function popScopeId() {
  scopeIdStack.pop()
  currentScopeId = scopeIdStack[scopeIdStack.length - 1] || null
}

/**
 * @internal
 */
export function withScopeId(id: string): <T extends Function>(fn: T) => T {
  return ((fn: Function) =>
    withCtx(function(this: any) {
      pushScopeId(id)
      const res = fn.apply(this, arguments)
      popScopeId()
      return res
    })) as any
}
