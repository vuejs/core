import { ReactiveEffect } from './effect'
import { warn } from './warning'

export type EffectScopeOnStopHook = (fn: (() => void)) => void

export interface EffectScope {
  _isEffectScope: true
  extend<T extends object | undefined | void>(
    fn?: (onStop: EffectScopeOnStopHook) => T
  ): EffectScopeReturns<T>
  id: number
  active: boolean
  effects: (ReactiveEffect | EffectScope)[]
  onStopHooks: ((scope: EffectScope) => void)[]
}

export interface EffectScopeReturnsWrapper {
  /**
   * @internal the scope instance
   */
  _scope: EffectScope
}

export type EffectScopeReturns<
  T extends object | undefined | void = undefined
> = T extends {} ? T & EffectScopeReturnsWrapper : EffectScopeReturnsWrapper

export interface EffectScopeOptions {
  detached?: boolean
}

let uid = 0
let activeEffectScope: EffectScope | null = null
const effectScopeStack: EffectScope[] = []

export function recordEffectScope(
  effect: ReactiveEffect | EffectScope,
  scope: EffectScope | null = activeEffectScope
) {
  if (scope && scope.active) {
    scope.effects.push(effect)
  }
}

export function effectScope<T extends object | undefined | void = undefined>(
  fn?: (onCleanup: EffectScopeOnStopHook) => T,
  options: EffectScopeOptions = {}
): EffectScopeReturns<T> {
  let scope: EffectScope = {
    _isEffectScope: true,
    id: uid++,
    active: true,
    effects: [],
    onStopHooks: [],
    extend(fn): any {
      const wrapper: EffectScopeReturnsWrapper = { _scope: scope }
      if (!fn) {
        return wrapper
      }
      if (!scope.active) {
        if (__DEV__) {
          warn('can not extend on an inactive scope.')
        }
        return wrapper
      }
      try {
        if (!options.detached) {
          recordEffectScope(scope)
        }
        effectScopeStack.push(scope)
        activeEffectScope = scope
        const returns = fn((fn: () => void) => {
          scope.onStopHooks.push(fn)
        })
        if (returns) {
          return Object.assign(returns, wrapper)
        } else {
          return wrapper
        }
      } finally {
        effectScopeStack.pop()
        activeEffectScope = effectScopeStack[effectScopeStack.length - 1]
      }
    }
  }

  return scope.extend(fn)
}

export function isEffectScope(obj: any): obj is EffectScope {
  return obj && obj._isEffectScope === true
}

export function isEffectScopeReturns(obj: any): obj is EffectScopeReturns {
  return obj && obj._scope && obj._scope._isEffectScope === true
}

export function extendScope<T extends object | undefined | void = undefined>(
  scope: EffectScopeReturns | EffectScope,
  fn?: (onCleanup: EffectScopeOnStopHook) => T
): EffectScopeReturns<T> {
  if (isEffectScope(scope)) {
    return scope.extend<T>(fn)
  } else if (isEffectScopeReturns(scope)) {
    return scope._scope.extend<T>(fn)
  } else {
    if (__DEV__) {
      warn('extendScope() called with a non scope target')
    }
    return undefined as any
  }
}

export function getCurrentScope() {
  return activeEffectScope
}

export function onScopeStopped(fn: (scope: EffectScope) => void) {
  const scope = activeEffectScope
  if (scope) {
    scope.onStopHooks.push(fn)
  } else if (__DEV__) {
    warn(
      'onScopeStopped() is called when there is no active scope instance to be associated with.'
    )
  }
}
