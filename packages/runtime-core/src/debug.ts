import {reactive} from '@vue/reactivity'
import {getCurrentInstance} from './component'

/**
 * this debug function is helper for watching states in the vue devtool (it runs only in dev mode)
 * @example
 * const Component = defineComponent({
 *   setup() {
 *  const name = ref('foo')
 *     debug({
 *       // watch states in the vue devtool
 *       name,
 *     })
 *     return h('div', name.value)
 *   },
 * })
 * @param states any states you want to see in the vue devtool
 */
export const debug = (states: Record<string, any>) => {
  if (!__DEV__) {
    return
  }
  const instance = getCurrentInstance()
  if (instance) {
    instance.setupState = reactive(Object.assign({}, states, instance.setupState))
  }
}
