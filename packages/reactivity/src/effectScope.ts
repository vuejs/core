import { ReactiveEffect } from './effect'
import { warn } from './warning'

let activeEffectScope: EffectScope | undefined
const effectScopeStack: EffectScope[] = []

export class EffectScope {
  active = true
  effects: ReactiveEffect[] = []
  cleanups: (() => void)[] = []
  parent: EffectScope | undefined
  private children: EffectScope[] | undefined
  private parentIndex: number | undefined

  constructor(detached = false) {
    if (!detached) {
      this.recordEffectScope()
    }
  }

  get scopes(): EffectScope[] {
    if (!this.children) this.children = []
    return this.children
  }

  run<T>(fn: () => T): T | undefined {
    if (this.active) {
      try {
        this.on()
        return fn()
      } finally {
        this.off()
      }
    } else if (__DEV__) {
      warn(`cannot run an inactive effect scope.`)
    }
  }

  on() {
    if (this.active) {
      effectScopeStack.push(this)
      activeEffectScope = this
    }
  }

  off() {
    if (this.active) {
      effectScopeStack.pop()
      activeEffectScope = effectScopeStack[effectScopeStack.length - 1]
    }
  }

  stop() {
    if (this.active) {
      this.effects.forEach(e => e.stop())
      this.children?.forEach(e => e.stop())
      this.cleanups.forEach(cleanup => cleanup())
      this.parent?.derefChildScope(this)
      this.active = false
    }
  }

  private recordEffectScope() {
    const parent = activeEffectScope
    if (parent && parent.active) {
      this.parent = parent
      this.parentIndex = parent.scopes.push(this) - 1
    }
  }

  private derefChildScope(scope: EffectScope) {
    // reuse the freed index by moving the last array entry
    const last = this.scopes.pop()
    if (last && last !== scope) {
      const childIndex = scope.parentIndex!
      this.scopes[childIndex] = last
      last.parentIndex = childIndex
    }
  }
}

export function effectScope(detached?: boolean) {
  return new EffectScope(detached)
}

export function recordEffectScope(
  effect: ReactiveEffect,
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
