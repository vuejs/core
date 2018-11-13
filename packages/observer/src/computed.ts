import { effect } from './index'
import { ReactiveEffect, activeReactiveEffectStack } from './effect'

export interface ComputedGetter<T = any> {
  (): T
  effect: ReactiveEffect
}

export function computed<T, C = null>(
  getter: (this: C, ctx: C) => T,
  context?: C
): ComputedGetter<T> {
  let dirty: boolean = true
  let value: any = undefined
  const runner = effect(() => getter.call(context, context), {
    lazy: true,
    scheduler: () => {
      dirty = true
    }
  })
  const computedGetter = (() => {
    if (dirty) {
      value = runner()
      dirty = false
    }
    // When computed effects are accessed in a parent effect, the parent
    // should track all the dependencies the computed property has tracked.
    // This should also apply for chained computed properties.
    trackChildRun(runner)
    return value
  }) as ComputedGetter
  // expose effect so computed can be stopped
  computedGetter.effect = runner
  // mark effect as computed so that it gets priority during trigger
  runner.computed = true
  return computedGetter
}

function trackChildRun(childRunner: ReactiveEffect) {
  const parentRunner =
    activeReactiveEffectStack[activeReactiveEffectStack.length - 1]
  if (parentRunner) {
    for (let i = 0; i < childRunner.deps.length; i++) {
      const dep = childRunner.deps[i]
      if (!dep.has(parentRunner)) {
        dep.add(parentRunner)
        parentRunner.deps.push(dep)
      }
    }
  }
}
