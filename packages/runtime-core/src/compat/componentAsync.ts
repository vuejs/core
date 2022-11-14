import { isArray, isObject, isPromise } from '@vue/shared'
import { defineAsyncComponent } from '../apiAsyncComponent'
import { Component } from '../component'
import { isVNode } from '../vnode'

interface LegacyAsyncOptions {
  component: Promise<Component>
  loading?: Component
  error?: Component
  delay?: number
  timeout?: number
}

type LegacyAsyncReturnValue = Promise<Component> | LegacyAsyncOptions

type LegacyAsyncComponent = (
  resolve?: (res: LegacyAsyncReturnValue) => void,
  reject?: (reason?: any) => void
) => LegacyAsyncReturnValue | undefined

const normalizedAsyncComponentMap = new Map<LegacyAsyncComponent, Component>()

export function convertLegacyAsyncComponent(comp: LegacyAsyncComponent) {
  if (normalizedAsyncComponentMap.has(comp)) {
    return normalizedAsyncComponentMap.get(comp)!
  }

  // we have to call the function here due to how v2's API won't expose the
  // options until we call it
  let resolve: (res: LegacyAsyncReturnValue) => void
  let reject: (reason?: any) => void
  const fallbackPromise = new Promise<Component>((r, rj) => {
    ;(resolve = r), (reject = rj)
  })

  const res = comp(resolve!, reject!)

  let converted: Component
  if (isPromise(res)) {
    converted = defineAsyncComponent(() => res)
  } else if (isObject(res) && !isVNode(res) && !isArray(res)) {
    converted = defineAsyncComponent({
      loader: () => res.component,
      loadingComponent: res.loading,
      errorComponent: res.error,
      delay: res.delay,
      timeout: res.timeout
    })
  } else if (res == null) {
    converted = defineAsyncComponent(() => fallbackPromise)
  } else {
    converted = comp as any // probably a v3 functional comp
  }
  normalizedAsyncComponentMap.set(comp, converted)
  return converted
}
