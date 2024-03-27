import { type ComputedRefImpl, computed as _computed } from '@vue/reactivity'
import { getCurrentInstance, isInSSRComponentSetup } from './component'

export const computed: typeof _computed = (
  getterOrOptions: any,
  debugOptions?: any,
) => {
  // @ts-expect-error
  const c = _computed(getterOrOptions, debugOptions, isInSSRComponentSetup)
  if (__DEV__) {
    const i = getCurrentInstance()
    if (i && i.appContext.config.warnRecursiveComputed) {
      ;(c as unknown as ComputedRefImpl<any>)._warnRecursive = true
    }
  }
  return c
}
