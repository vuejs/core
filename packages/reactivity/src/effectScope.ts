import { ReactiveEffect } from './effect'
import { warn } from './warning'

let activeEffectScope: EffectScope | undefined
const effectScopeStack: EffectScope[] = []

export class EffectScope {
  active = true
  effects: (ReactiveEffect | EffectScope)[] = []
  cleanups: (() => void)[] = []

  constructor(detached = false) {
    if (!detached) {
      recordEffectScope(this)
    }
  }

  run<T>(fn: () => T): T | undefined {
    if (this.active) {
      try {
        effectScopeStack.push(this)
        activeEffectScope = this
        return fn()
      } finally {
        effectScopeStack.pop()
        activeEffectScope = effectScopeStack[effectScopeStack.length - 1]
      }
    } else if (__DEV__) {
      warn(`cannot run an inactive effect scope.`)
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

export function effectScope(detached?: boolean) {
  return new EffectScope(detached)
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

export function onScopeDispose(fn: () => void) {
  if (activeEffectScope) {
    activeEffectScope.cleanups.push(fn)
  } else if (__DEV__) {
    warn(
      `onDispose() is called when there is no active effect scope ` +
        ` to be associated with.`
    )
  }
}
