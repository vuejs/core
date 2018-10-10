import { NOOP } from './utils'
import { computed, stop, ComputedGetter } from '@vue/observer'
import { ComponentClass, ComponentInstance } from './component'
import { ComponentComputedOptions } from './componentOptions'

export function resolveComputedOptions(
  comp: ComponentClass
): ComponentComputedOptions {
  const computedOptions: ComponentComputedOptions = {}
  const descriptors = Object.getOwnPropertyDescriptors(comp.prototype as any)
  for (const key in descriptors) {
    const d = descriptors[key]
    if (d.get) {
      computedOptions[key] = d.get
      // there's no need to do anything for the setter
      // as it's already defined on the prototype
    }
  }
  return computedOptions
}

export function initializeComputed(
  instance: ComponentInstance,
  computedOptions: ComponentComputedOptions | undefined
) {
  if (!computedOptions) {
    return
  }
  const handles: Record<
    string,
    ComputedGetter
  > = (instance._computedGetters = {})
  const proxy = instance.$proxy
  for (const key in computedOptions) {
    const option = computedOptions[key]
    const getter = typeof option === 'function' ? option : option.get || NOOP
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
