import { EMPTY_OBJ } from './utils'
import { computed, ComputedGetter } from '@vue/observer'
import { Component, ComponentClass } from './component'
import { ComponentComputedOptions } from './componentOptions'

const extractionCache: WeakMap<
  ComponentClass,
  ComponentComputedOptions
> = new WeakMap()

export function getComputedOptions(
  comp: ComponentClass
): ComponentComputedOptions {
  let computedOptions = extractionCache.get(comp)
  if (computedOptions) {
    return computedOptions
  }
  computedOptions = {}
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
  instance: Component,
  computedOptions: ComponentComputedOptions | undefined
) {
  if (!computedOptions) {
    instance.$computed = EMPTY_OBJ
    return
  }
  const handles: Record<
    string,
    ComputedGetter
  > = (instance._computedGetters = {})
  const proxy = instance.$proxy
  for (const key in computedOptions) {
    handles[key] = computed(computedOptions[key], proxy)
  }
  instance.$computed = new Proxy(
    {},
    {
      get(_, key: any) {
        return handles[key]()
      }
      // TODO should be readonly
    }
  )
}

export function teardownComputed(instance: Component) {
  const handles = instance._computedGetters
  if (handles !== null) {
    for (const key in handles) {
      handles[key].stop()
    }
  }
}
