import { ComponentInternalInstance, Data } from './component'
import { nextTick, queueJob } from './scheduler'
import { instanceWatch } from './apiWatch'
import { EMPTY_OBJ, hasOwn, isGloballyWhitelisted, NOOP } from '@vue/shared'
import { ReactiveEffect, UnwrapRef, toRaw } from '@vue/reactivity'
import {
  ExtractComputedReturns,
  ComponentOptionsBase,
  ComputedOptions,
  MethodOptions,
  resolveMergedOptions
} from './componentOptions'
import { normalizePropsOptions } from './componentProps'
import { EmitsOptions, EmitFn } from './componentEmits'
import { Slots } from './componentSlots'
import {
  currentRenderingInstance,
  markAttrsAccessed
} from './componentRenderUtils'
import { warn } from './warning'

// public properties exposed on the proxy, which is used as the render context
// in templates (as `this` in the render option)
export type ComponentPublicInstance<
  P = {}, // props type extracted from props option
  B = {}, // raw bindings returned from setup()
  D = {}, // return from data()
  C extends ComputedOptions = {},
  M extends MethodOptions = {},
  E extends EmitsOptions = {},
  PublicProps = P
> = {
  $: ComponentInternalInstance
  $data: D
  $props: PublicProps
  $attrs: Data
  $refs: Data
  $slots: Slots
  $root: ComponentInternalInstance | null
  $parent: ComponentInternalInstance | null
  $emit: EmitFn<E>
  $el: any
  $options: ComponentOptionsBase<P, B, D, C, M, E>
  $forceUpdate: ReactiveEffect
  $nextTick: typeof nextTick
  $watch: typeof instanceWatch
} & P &
  UnwrapRef<B> &
  D &
  ExtractComputedReturns<C> &
  M

const publicPropertiesMap: Record<
  string,
  (i: ComponentInternalInstance) => any
> = {
  $: i => i,
  $el: i => i.vnode.el,
  $data: i => i.data,
  $props: i => i.props,
  $attrs: i => i.attrs,
  $slots: i => i.slots,
  $refs: i => i.refs,
  $parent: i => i.parent && i.parent.proxy,
  $root: i => i.root && i.root.proxy,
  $emit: i => i.emit,
  $options: i => (__FEATURE_OPTIONS__ ? resolveMergedOptions(i) : i.type),
  $forceUpdate: i => () => queueJob(i.update),
  $nextTick: () => nextTick,
  $watch: __FEATURE_OPTIONS__ ? i => instanceWatch.bind(i) : NOOP
}

const enum AccessTypes {
  DATA,
  CONTEXT,
  PROPS,
  OTHER
}

export interface ComponentPublicProxyTarget {
  [key: string]: any
  _: ComponentInternalInstance
}

export const PublicInstanceProxyHandlers: ProxyHandler<any> = {
  get({ _: instance }: ComponentPublicProxyTarget, key: string) {
    const {
      renderContext,
      data,
      props,
      accessCache,
      type,
      sink,
      appContext
    } = instance

    // data / props / renderContext
    // This getter gets called for every property access on the render context
    // during render and is a major hotspot. The most expensive part of this
    // is the multiple hasOwn() calls. It's much faster to do a simple property
    // access on a plain object, so we use an accessCache object (with null
    // prototype) to memoize what access type a key corresponds to.
    if (key[0] !== '$') {
      const n = accessCache![key]
      if (n !== undefined) {
        switch (n) {
          case AccessTypes.DATA:
            return data[key]
          case AccessTypes.CONTEXT:
            return renderContext[key]
          case AccessTypes.PROPS:
            return props![key]
          // default: just fallthrough
        }
      } else if (data !== EMPTY_OBJ && hasOwn(data, key)) {
        accessCache![key] = AccessTypes.DATA
        return data[key]
      } else if (renderContext !== EMPTY_OBJ && hasOwn(renderContext, key)) {
        accessCache![key] = AccessTypes.CONTEXT
        return renderContext[key]
      } else if (type.props) {
        // only cache other properties when instance has declared (thus stable)
        // props
        if (hasOwn(normalizePropsOptions(type.props)[0]!, key)) {
          accessCache![key] = AccessTypes.PROPS
          // return the value from propsProxy for ref unwrapping and readonly
          return props![key]
        } else {
          accessCache![key] = AccessTypes.OTHER
        }
      }
    }

    // public $xxx properties & user-attached properties (sink)
    const publicGetter = publicPropertiesMap[key]
    let cssModule, globalProperties
    if (publicGetter) {
      if (__DEV__ && key === '$attrs') {
        markAttrsAccessed()
      }
      return publicGetter(instance)
    } else if (hasOwn(sink, key)) {
      return sink[key]
    } else if (
      (cssModule = type.__cssModules) &&
      (cssModule = cssModule[key])
    ) {
      return cssModule
    } else if (
      ((globalProperties = appContext.config.globalProperties),
      hasOwn(globalProperties, key))
    ) {
      return globalProperties[key]
    } else if (__DEV__ && currentRenderingInstance) {
      warn(
        `Property ${JSON.stringify(key)} was accessed during render ` +
          `but is not defined on instance.`
      )
    }
  },

  set(
    { _: instance }: ComponentPublicProxyTarget,
    key: string,
    value: any
  ): boolean {
    const { data, renderContext } = instance
    if (data !== EMPTY_OBJ && hasOwn(data, key)) {
      data[key] = value
    } else if (hasOwn(renderContext, key)) {
      renderContext[key] = value
    } else if (key[0] === '$' && key.slice(1) in instance) {
      __DEV__ &&
        warn(
          `Attempting to mutate public property "${key}". ` +
            `Properties starting with $ are reserved and readonly.`,
          instance
        )
      return false
    } else if (key in instance.props) {
      __DEV__ &&
        warn(
          `Attempting to mutate prop "${key}". Props are readonly.`,
          instance
        )
      return false
    } else {
      instance.sink[key] = value
      if (__DEV__) {
        instance.proxyTarget[key] = value
      }
    }
    return true
  },

  has(
    {
      _: { data, accessCache, renderContext, type, sink, appContext }
    }: ComponentPublicProxyTarget,
    key: string
  ) {
    return (
      accessCache![key] !== undefined ||
      (data !== EMPTY_OBJ && hasOwn(data, key)) ||
      hasOwn(renderContext, key) ||
      (type.props && hasOwn(normalizePropsOptions(type.props)[0]!, key)) ||
      hasOwn(publicPropertiesMap, key) ||
      hasOwn(sink, key) ||
      hasOwn(appContext.config.globalProperties, key)
    )
  }
}

if (__DEV__ && !__TEST__) {
  PublicInstanceProxyHandlers.ownKeys = (
    target: ComponentPublicProxyTarget
  ) => {
    warn(
      `Avoid app logic that relies on enumerating keys on a component instance. ` +
        `The keys will be empty in production mode to avoid performance overhead.`
    )
    return Reflect.ownKeys(target)
  }
}

export const RuntimeCompiledPublicInstanceProxyHandlers = {
  ...PublicInstanceProxyHandlers,
  get(target: ComponentPublicProxyTarget, key: string) {
    // fast path for unscopables when using `with` block
    if ((key as any) === Symbol.unscopables) {
      return
    }
    return PublicInstanceProxyHandlers.get!(target, key, target)
  },
  has(_: ComponentPublicProxyTarget, key: string) {
    return key[0] !== '_' && !isGloballyWhitelisted(key)
  }
}

// In dev mode, the proxy target exposes the same properties as seen on `this`
// for easier console inspection. In prod mode it will be an empty object so
// these properties definitions can be skipped.
export function createDevProxyTarget(instance: ComponentInternalInstance) {
  const target: Record<string, any> = {}

  // expose internal instance for proxy handlers
  Object.defineProperty(target, `_`, {
    configurable: true,
    enumerable: false,
    get: () => instance
  })

  // expose public properties
  Object.keys(publicPropertiesMap).forEach(key => {
    Object.defineProperty(target, key, {
      configurable: true,
      enumerable: false,
      get: () => publicPropertiesMap[key](instance),
      // intercepted by the proxy so no need for implementation,
      // but needed to prevent set errors
      set: NOOP
    })
  })

  // expose global properties
  const { globalProperties } = instance.appContext.config
  Object.keys(globalProperties).forEach(key => {
    Object.defineProperty(target, key, {
      configurable: true,
      enumerable: false,
      get: () => globalProperties[key],
      set: NOOP
    })
  })

  return target as ComponentPublicProxyTarget
}

export function exposePropsOnDevProxyTarget(
  instance: ComponentInternalInstance
) {
  const {
    proxyTarget,
    type: { props: propsOptions }
  } = instance
  if (propsOptions) {
    Object.keys(normalizePropsOptions(propsOptions)[0]!).forEach(key => {
      Object.defineProperty(proxyTarget, key, {
        enumerable: true,
        configurable: true,
        get: () => instance.props[key],
        set: NOOP
      })
    })
  }
}

export function exposeRenderContextOnDevProxyTarget(
  instance: ComponentInternalInstance
) {
  const { proxyTarget, renderContext } = instance
  Object.keys(toRaw(renderContext)).forEach(key => {
    Object.defineProperty(proxyTarget, key, {
      enumerable: true,
      configurable: true,
      get: () => renderContext[key],
      set: NOOP
    })
  })
}
