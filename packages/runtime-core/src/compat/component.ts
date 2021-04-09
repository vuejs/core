import { isArray, isFunction, isObject, isPromise } from '@vue/shared'
import { defineAsyncComponent } from '../apiAsyncComponent'
import {
  Component,
  ComponentOptions,
  FunctionalComponent,
  getCurrentInstance
} from '../component'
import { resolveInjections } from '../componentOptions'
import { InternalSlots } from '../componentSlots'
import { isVNode } from '../vnode'
import { isCompatEnabled, softAssertCompatEnabled } from './compatConfig'
import { DeprecationTypes, warnDeprecation } from './deprecations'
import { getCompatListeners } from './instanceListeners'
import { compatH } from './renderFn'

export function convertLegacyComponent(comp: any): Component {
  // 2.x async component
  // since after disabling this, plain functions are still valid usage, do not
  // use softAssert here.
  if (isFunction(comp) && isCompatEnabled(DeprecationTypes.COMPONENT_ASYNC)) {
    __DEV__ && warnDeprecation(DeprecationTypes.COMPONENT_ASYNC, comp)
    return convertLegacyAsyncComponent(comp)
  }

  // 2.x functional component
  if (
    isObject(comp) &&
    comp.functional &&
    softAssertCompatEnabled(DeprecationTypes.COMPONENT_FUNCTIONAL, comp)
  ) {
    return convertLegacyFunctionalComponent(comp)
  }

  return comp
}

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

function convertLegacyAsyncComponent(comp: LegacyAsyncComponent) {
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

const normalizedFunctionalComponentMap = new Map<
  ComponentOptions,
  FunctionalComponent
>()

const legacySlotProxyHandlers: ProxyHandler<InternalSlots> = {
  get(target, key: string) {
    const slot = target[key]
    return slot && slot()
  }
}

function convertLegacyFunctionalComponent(comp: ComponentOptions) {
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
      get slots() {
        return new Proxy(ctx.slots, legacySlotProxyHandlers)
      },
      get listeners() {
        return getCompatListeners(instance)
      },
      get injections() {
        if (comp.inject) {
          const injections = {}
          resolveInjections(comp.inject, {})
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
