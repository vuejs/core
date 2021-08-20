import {
  ComponentOptions,
  FunctionalComponent,
  getCurrentInstance
} from '../component'
import { resolveInjections } from '../componentOptions'
import { InternalSlots } from '../componentSlots'
import { getCompatListeners } from './instanceListeners'
import { compatH } from './renderFn'

const normalizedFunctionalComponentMap = new Map<
  ComponentOptions,
  FunctionalComponent
>()

export const legacySlotProxyHandlers: ProxyHandler<
  InternalSlots<Record<string, null>>
> = {
  get(target, key: string) {
    const slot = target[key]
    return slot && slot()
  }
}

export function convertLegacyFunctionalComponent(comp: ComponentOptions) {
  if (normalizedFunctionalComponentMap.has(comp)) {
    return normalizedFunctionalComponentMap.get(comp)!
  }

  const legacyFn = comp.render as any

  const Func: FunctionalComponent = (props, ctx) => {
    const instance = getCurrentInstance()!

    const legacyCtx = {
      props,
      children: instance.vnode.children || [],
      data: instance.vnode.props || {},
      scopedSlots: ctx.slots,
      parent: instance.parent && instance.parent.proxy,
      slots() {
        return new Proxy(ctx.slots, legacySlotProxyHandlers)
      },
      get listeners() {
        return getCompatListeners(instance)
      },
      get injections() {
        if (comp.inject) {
          const injections = {}
          resolveInjections(comp.inject, injections)
          return injections
        }
        return {}
      }
    }
    return legacyFn(compatH, legacyCtx)
  }
  Func.props = comp.props
  Func.displayName = comp.name
  // v2 functional components do not inherit attrs
  Func.inheritAttrs = false

  normalizedFunctionalComponentMap.set(comp, Func)
  return Func
}
