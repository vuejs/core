import {getCurrentInstance, warn, watchPostEffect} from "@vue/runtime-core";

export function useCEStyleAttrs(getter: (ctx: any) => Array<Record<string, string | number>>) {
  if (!__BROWSER__ && !__TEST__) return

  const instance = getCurrentInstance()
  /* istanbul ignore next */
  if (!instance) {
    __DEV__ &&
    warn(`useCEStyleAttrs is called without current active component instance.`)
    return
  }


  const setAttrs = () => {
    const attrs = getter(instance.proxy)
    if(instance.ceContext){
      if(instance.isCE){
        instance.ceContext.setStyleAttrs('root', attrs)
      } else {
        instance.ceContext.setStyleAttrs(instance.uid, attrs)
      }
    }
  }
  watchPostEffect(setAttrs)

}
