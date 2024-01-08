import {
  type ComputedGetter,
  type WritableComputedOptions,
  computed as _computed,
} from '@vue/reactivity'
import {
  type ComponentInternalInstance,
  currentInstance,
  isInSSRComponentSetup,
  setCurrentInstance,
} from './component'
import { isFunction } from '@vue/shared'

function wrapComputedGetter(
  getter: ComputedGetter<unknown>,
  instance: ComponentInternalInstance,
): ComputedGetter<unknown> {
  return () => {
    const reset = setCurrentInstance(instance)
    try {
      return getter()
    } finally {
      reset()
    }
  }
}

export const computed: typeof _computed = (
  getterOrOptions: ComputedGetter<unknown> | WritableComputedOptions<unknown>,
  debugOptions?: any,
) => {
  if (currentInstance) {
    if (isFunction(getterOrOptions)) {
      getterOrOptions = wrapComputedGetter(getterOrOptions, currentInstance)
    } else {
      const { get, set } = getterOrOptions
      getterOrOptions = {
        get: wrapComputedGetter(get, currentInstance),
        set,
      }
    }
  }

  // @ts-expect-error the 3rd argument is hidden from public types
  return _computed(getterOrOptions, debugOptions, isInSSRComponentSetup)
}
