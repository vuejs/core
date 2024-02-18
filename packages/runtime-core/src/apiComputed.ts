import { computed as _computed } from '@vue/reactivity'
import { isInSSRComponentSetup } from './component'

export const computed: typeof _computed = (
  getterOrOptions: any,
  debugOptions?: any,
) => {
  // @ts-expect-error
  return _computed(getterOrOptions, debugOptions, isInSSRComponentSetup)
}
