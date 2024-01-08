import {
  type ComputedGetter,
  type WritableComputedOptions,
  computed as _computed,
} from '@vue/reactivity'
import { isInSSRComponentSetup } from './component'
import { isFunction } from '@vue/shared'

/**
 * For dev warning only.
 * Context: https://github.com/vuejs/core/discussions/9974
 */
export let isInComputedGetter = false

function wrapComputedGetter(
  getter: ComputedGetter<unknown>,
): ComputedGetter<unknown> {
  return () => {
    isInComputedGetter = true
    try {
      return getter()
    } finally {
      isInComputedGetter = false
    }
  }
}

export const computed: typeof _computed = (
  getterOrOptions: ComputedGetter<unknown> | WritableComputedOptions<unknown>,
  debugOptions?: any,
) => {
  if (__DEV__) {
    if (isFunction(getterOrOptions)) {
      getterOrOptions = wrapComputedGetter(getterOrOptions)
    } else {
      getterOrOptions.get = wrapComputedGetter(getterOrOptions.get)
    }
  }

  // @ts-expect-error the 3rd argument is hidden from public types
  return _computed(getterOrOptions, debugOptions, isInSSRComponentSetup)
}
