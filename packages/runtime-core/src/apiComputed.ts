import { type ComputedRefImpl, computed as _computed } from '@vue/reactivity'
import { getCurrentInstance, isInSSRComponentSetup } from './component'
import { isFunction } from '@vue/shared'
import { ErrorCodes, callWithErrorHandling } from './errorHandling'
export const computed: typeof _computed = (
  getterOrOptions: any,
  debugOptions?: any,
) => {
  const i = getCurrentInstance()
  const onlyGetter = isFunction(getterOrOptions)
  if (onlyGetter) {
    const getter = getterOrOptions
    getterOrOptions = function safeGetter(...args: any) {
      return callWithErrorHandling(getter, i, ErrorCodes.COMPUTED_GETTER, args)
    }
  } else {
    const { get: getter, set: setter } = getterOrOptions
    getterOrOptions.get = function safeGetter(...args: any) {
      return callWithErrorHandling(getter, i, ErrorCodes.COMPUTED_GETTER, args)
    }
    getterOrOptions.set = function safeSetter(...args: any) {
      callWithErrorHandling(setter, i, ErrorCodes.COMPUTED_SETTER, args)
    }
  }
  // @ts-expect-error
  const c = _computed(getterOrOptions, debugOptions, isInSSRComponentSetup)
  if (__DEV__) {
    if (i && i.appContext.config.warnRecursiveComputed) {
      ;(c as unknown as ComputedRefImpl<any>)._warnRecursive = true
    }
  }
  return c
}
