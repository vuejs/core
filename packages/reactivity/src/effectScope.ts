import { ReactiveEffect } from './effect'
import { warn } from './warning'

export type EffectScopeOnStopHook = (fn: (() => void)) => void

let activeEffectScope: EffectScope | undefined
const effectScopeStack: EffectScope[] = []

export class EffectScope {
  active = true
  effects: (ReactiveEffect | EffectScope)[] = []
  cleanups: (() => void)[] = []

  constructor(fn?: (onStop: EffectScopeOnStopHook) => any, detached?: boolean) {
    if (!detached) {
      recordEffectScope(this)
    }
    if (fn) {
      this.extend(fn)
    }
  }

  extend(fn: (onStop: EffectScopeOnStopHook) => any) {
    if (this.active) {
      try {
        effectScopeStack.push(this)
        activeEffectScope = this
        fn(cleanup => this.cleanups.push(cleanup))
      } finally {
        effectScopeStack.pop()
        activeEffectScope = effectScopeStack[effectScopeStack.length - 1]
      }
    } else if (__DEV__) {
      warn(`cannot extend an inactive effect scope.`)
    }
  }

  stop() {
    if (this.active) {
      this.effects.forEach(e => e.stop())
      this.cleanups.forEach(cleanup => cleanup())
      this.active = false
    }
  }
}

export function recordEffectScope(
  effect: ReactiveEffect | EffectScope,
  scope?: EffectScope | null
) {
  scope = scope || activeEffectScope
  if (scope && scope.active) {
    scope.effects.push(effect)
  }
}

export function getCurrentScope() {
  return activeEffectScope
}

export function onDispose(fn: () => void) {
  if (activeEffectScope) {
    activeEffectScope.cleanups.push(fn)
  } else if (__DEV__) {
    warn(
      `onDispose() is called when there is no active effect scope ` +
        ` to be associated with.`
    )
  }
}
