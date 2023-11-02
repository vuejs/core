import {getCurrentInstance, warn} from "@vue/runtime-core";

export function useCEStyleAttrs(getter: (ctx: any) => Record<string, string>) {
  debugger
  if (!__BROWSER__ && !__TEST__) return

  const instance = getCurrentInstance()
  /* istanbul ignore next */
  if (!instance) {
    __DEV__ &&
    warn(`useCEStyleAttrs is called without current active component instance.`)
    return
  }
}
