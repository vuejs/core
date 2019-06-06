import { effect } from './index'
import { ReactiveEffect, activeReactiveEffectStack } from './effect'
import { knownValues } from './value'

export interface ComputedValue<T> {
  readonly value: T
  readonly effect: ReactiveEffect
}

export function computed<T>(
  getter: () => T,
  setter?: (v: T) => void
): ComputedValue<T> {
  let dirty: boolean = true
  let value: any = undefined
  const runner = effect(getter, {
    lazy: true,
    // mark effect as computed so that it gets priority during trigger
    computed: true,
    scheduler: () => {
      dirty = true
    }
  })
  const computedValue = {
    // expose effect so computed can be stopped
    effect: runner,
    get value() {
      if (dirty) {
        value = runner()
        dirty = false
      }
      // When computed effects are accessed in a parent effect, the parent
      // should track all the dependencies the computed property has tracked.
      // This should also apply for chained computed properties.
      trackChildRun(runner)
      return value
    },
    set value(newValue) {
      if (setter) {
        setter(newValue)
      } else {
        // TODO warn attempting to mutate readonly computed value
      }
    }
  }
  knownValues.add(computedValue)
  return computedValue
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
