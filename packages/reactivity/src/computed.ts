import { effect, ReactiveEffect, activeReactiveEffectStack } from './effect'
import { UnwrapNestedRefs, knownRefs, Ref } from './ref'
import { isFunction } from '@vue/shared'

export interface ComputedRef<T> {
  readonly value: UnwrapNestedRefs<T>
  readonly effect: ReactiveEffect
}

export interface ComputedOptions<T> {
  get: () => T
  set: (v: T) => void
}

export function computed<T>(getter: () => T): ComputedRef<T>
export function computed<T>(options: ComputedOptions<T>): Ref<T>
export function computed<T>(
  getterOrOptions: (() => T) | ComputedOptions<T>
): Ref<T> {
  const isReadonly = isFunction(getterOrOptions)
  const getter = isReadonly
    ? (getterOrOptions as (() => T))
    : (getterOrOptions as ComputedOptions<T>).get
  const setter = isReadonly ? null : (getterOrOptions as ComputedOptions<T>).set

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
  knownRefs.add(computedValue)
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
