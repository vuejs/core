import { NOOP, isFunction } from '@vue/shared'
import { computed, stop, ComputedGetter } from '@vue/observer'
import { ComponentInstance } from './component'
import { ComponentComputedOptions } from './componentOptions'

export type ComputedHandles = Record<string, ComputedGetter>

export function initializeComputed(
  instance: ComponentInstance,
  computedOptions: ComponentComputedOptions | undefined
) {
  if (!computedOptions) {
    return
  }
  const handles: ComputedHandles = (instance._computedGetters = {})
  const proxy = instance.$proxy
  for (const key in computedOptions) {
    const option = computedOptions[key]
    const getter = isFunction(option) ? option : option.get || NOOP
    handles[key] = computed(getter, proxy)
  }
}

export function teardownComputed(instance: ComponentInstance) {
  const handles = instance._computedGetters
  if (handles !== null) {
    for (const key in handles) {
      stop(handles[key].runner)
    }
  }
}
