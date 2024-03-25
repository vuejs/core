import { getCurrentInstance, warn, watchPostEffect } from '@vue/runtime-core'

export function useCEStyleAttrs(
  getter: (ctx: any) => Array<Record<string, string | number>>,
) {
  if (!__BROWSER__ && !__TEST__) return

  const instance = getCurrentInstance()
  /* istanbul ignore next */
  if (!instance) {
    __DEV__ &&
      warn(
        `useCEStyleAttrs is called without current active component instance.`,
      )
    return
  }

  instance.hasStyleAttrs = true
  let oAttrs: undefined | Array<Record<string, string | number>> = undefined
  const setAttrs = () => {
    const attrs = getter(instance.proxy)
    if (instance.ceContext) {
      if (instance.isCE) {
        instance.ceContext.setStyleAttrs('root', attrs, oAttrs)
      } else {
        instance.ceContext.setStyleAttrs(instance.uid, attrs, oAttrs)
      }
      oAttrs = attrs
    }
  }
  watchPostEffect(setAttrs)
}
