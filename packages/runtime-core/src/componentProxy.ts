import { Component, ComponentInternalInstance, Data } from './component'
import { nextTick, queueJob } from './scheduler'
import { instanceWatch } from './apiWatch'
import { EMPTY_OBJ, hasOwn, isGloballyWhitelisted, NOOP } from '@vue/shared'
import {
  ReactiveEffect,
  UnwrapRef,
  toRaw,
  shallowReadonly,
  ReactiveFlags,
  unref
} from '@vue/reactivity'
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

/**
 * Custom properties added to component instances in any way and can be accessed through `this`
 *
 * @example
 * Here is an example of adding a property `$router` to every component instance:
 * ```ts
 * import { createApp } from 'vue'
 * import { Router, createRouter } from 'vue-router'
 *
 * declare module '@vue/runtime-core' {
 *   interface ComponentCustomProperties {
 *     $router: Router
 *   }
 * }
 *
 * // effectively adding the router to every component instance
 * const app = createApp({})
 * const router = createRouter()
 * app.config.globalProperties.$router = router
 *
 * const vm = app.mount('#app')
 * // we can access the router from the instance
 * vm.$router.push('/')
 * ```
 */
export interface ComponentCustomProperties {}

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
  $root: ComponentPublicInstance | null
  $parent: ComponentPublicInstance | null
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
  M &
  ComponentCustomProperties

const publicPropertiesMap: Record<
  string,
  (i: ComponentInternalInstance) => any
> = {
  $: i => i,
  $el: i => i.vnode.el,
  $data: i => i.data,
  $props: i => (__DEV__ ? shallowReadonly(i.props) : i.props),
  $attrs: i => (__DEV__ ? shallowReadonly(i.attrs) : i.attrs),
  $slots: i => (__DEV__ ? shallowReadonly(i.slots) : i.slots),
  $refs: i => (__DEV__ ? shallowReadonly(i.refs) : i.refs),
  $parent: i => i.parent && i.parent.proxy,
  $root: i => i.root && i.root.proxy,
  $emit: i => i.emit,
  $options: i => (__FEATURE_OPTIONS__ ? resolveMergedOptions(i) : i.type),
  $forceUpdate: i => () => queueJob(i.update),
  $nextTick: () => nextTick,
  $watch: __FEATURE_OPTIONS__ ? i => instanceWatch.bind(i) : NOOP
}

export interface ComponentRenderContext {
  [key: string]: any
  _: ComponentInternalInstance
}

function getPublicInstanceProxyHandlers(
  instance: ComponentInternalInstance
): ProxyHandler<any> {
  function getPropGetter(
    key: string,
    mustWarn: boolean
  ): PropGetter | undefined {
    let fn: PropGetter | undefined = instance.propGetters![key]
    if (fn) {
      return fn
    } else {
      fn = getGetterForProxyKey(instance, key)
      if (fn) {
        instance.propGetters![key] = fn
      } else {
        if (
          __DEV__ &&
          mustWarn &&
          currentRenderingInstance &&
          // #1091 avoid internal isRef/isVNode checks on component instance leading
          // to infinite warning loop
          key.indexOf('__v') !== 0
        ) {
          if (
            instance.data !== EMPTY_OBJ &&
            key[0] === '$' &&
            hasOwn(instance.data, key)
          ) {
            warn(
              `Property ${JSON.stringify(
                key
              )} must be accessed via $data because it starts with a reserved ` +
                `character and is not proxied on the render context.`
            )
          } else {
            warn(
              `Property ${JSON.stringify(key)} was accessed during render ` +
                `but is not defined on instance.`
            )
          }
        }
      }
      return fn
    }
  }

  return {
    ...PublicInstanceProxyHandlers,
    get(c: ComponentRenderContext, key: string) {
      const propGetter = getPropGetter(key, true)
      return propGetter ? propGetter.f(propGetter.a) : undefined
    },
    has(c: ComponentRenderContext, key: string) {
      const propGetter = getPropGetter(key, false)
      return propGetter !== undefined
    }
  }
}

const PublicInstanceProxyHandlers: ProxyHandler<any> = {
  set(
    { _: instance }: ComponentRenderContext,
    key: string,
    value: any
  ): boolean {
    const { data, setupState, ctx } = instance
    if (setupState !== EMPTY_OBJ && hasOwn(setupState, key)) {
      setupState[key] = value
    } else if (data !== EMPTY_OBJ && hasOwn(data, key)) {
      data[key] = value
    } else if (key in instance.props) {
      __DEV__ &&
        warn(
          `Attempting to mutate prop "${key}". Props are readonly.`,
          instance
        )
      return false
    }
    if (key[0] === '$' && key.slice(1) in instance) {
      __DEV__ &&
        warn(
          `Attempting to mutate public property "${key}". ` +
            `Properties starting with $ are reserved and readonly.`,
          instance
        )
      return false
    } else {
      if (__DEV__ && key in instance.appContext.config.globalProperties) {
        Object.defineProperty(ctx, key, {
          enumerable: true,
          configurable: true,
          value
        })
      } else {
        ctx[key] = value
      }
    }
    return true
  }
}

if (__DEV__ && !__TEST__) {
  PublicInstanceProxyHandlers.ownKeys = (target: ComponentRenderContext) => {
    warn(
      `Avoid app logic that relies on enumerating keys on a component instance. ` +
        `The keys will be empty in production mode to avoid performance overhead.`
    )
    return Reflect.ownKeys(target)
  }
}

function getRuntimeCompiledPublicInstanceProxyHandlers(
  instance: ComponentInternalInstance
): ProxyHandler<any> {
  const handlers = getPublicInstanceProxyHandlers(instance)
  return {
    ...handlers,
    get(target: ComponentRenderContext, key: string) {
      // fast path for unscopables when using `with` block
      if ((key as any) === Symbol.unscopables) {
        return
      }
      return handlers.get!(target, key, target)
    },
    has(_: ComponentRenderContext, key: string) {
      const has = key[0] !== '_' && !isGloballyWhitelisted(key)
      if (__DEV__ && !has && handlers.has!(_, key)) {
        warn(
          `Property ${JSON.stringify(
            key
          )} should not start with _ which is a reserved prefix for Vue internals.`
        )
      }
      return has
    }
  }
}

// In dev mode, the proxy target exposes the same properties as seen on `this`
// for easier console inspection. In prod mode it will be an empty object so
// these properties definitions can be skipped.
export function createRenderContext(instance: ComponentInternalInstance) {
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

  return target as ComponentRenderContext
}

export function createInstanceProxy(instance: ComponentInternalInstance) {
  setupPropGetters(instance)
  return new Proxy(instance.ctx, getPublicInstanceProxyHandlers(instance))
}

export function createInstanceWithProxy(instance: ComponentInternalInstance) {
  setupPropGetters(instance)
  return new Proxy(
    instance.ctx,
    getRuntimeCompiledPublicInstanceProxyHandlers(instance)
  )
}

function setupPropGetters(instance: ComponentInternalInstance) {
  instance.propGetters = {}
}

export type PropGetter<T = any> = { f: (arg: T) => any; a: T }

/**
 * Returns a getter function for an instance proxy property.
 */
function getGetterForProxyKey(
  instance: ComponentInternalInstance,
  key: string
): PropGetter | undefined {
  const setupState = toRaw(instance.setupState)

  if (key === ReactiveFlags.skip) {
    // let @vue/reactivity know it should never observe Vue public instances.
    return { f: () => true, a: undefined }
  }

  if (setupState !== EMPTY_OBJ && hasOwn(setupState, key)) {
    return { f: unref, a: setupState[key] }
  } else if (instance.data !== EMPTY_OBJ && hasOwn(instance.data, key)) {
    return {
      f: createComponentMemberPropGetter(instance.type, key),
      a: instance.data
    }
  }

  const propKeys = normalizePropsOptions(instance.type.props)
  if (propKeys && propKeys[0] && hasOwn(propKeys[0]!, key)) {
    // only cache other properties when instance has declared (thus stable)
    // props
    return {
      f: createComponentMemberPropGetter(instance.type, key),
      a: instance.props
    }
  } else if (publicPropertiesMap[key]) {
    if (__DEV__ && key === '$attrs') {
      markAttrsAccessed()
    }
    return { f: publicPropertiesMap[key], a: instance }
  } else if (instance.ctx !== EMPTY_OBJ && hasOwn(instance.ctx, key)) {
    // Ctx props can be set dynamically so use a member prop getter.
    return {
      f: createComponentMemberPropGetter(instance.type, key),
      a: instance.ctx
    }
  }

  const cssModules = instance.type.__cssModules
  if (cssModules && cssModules[key]) {
    return { f: getArg, a: cssModules[key] }
  } else if (hasOwn(instance.appContext.config.globalProperties, key)) {
    return {
      f: createComponentMemberPropGetter(instance.type, key),
      a: instance.appContext.config.globalProperties
    }
  } else {
    // Unknown property: ignore.
    return undefined
  }
}

function getArg<T = any>(a: T): T {
  return a
}

// Member property getters are reused to limit memory usage.
// However, we want a different one per component type as that makes it more
// likely that the object param is always of the same shape, allow optimizations.
type ComponentMemberPropGetter = (o: object) => any
const componentMemberPropGetters = new WeakMap<
  Component,
  Record<string, ComponentMemberPropGetter>
>()
function createComponentMemberPropGetter(
  component: Component,
  key: string
): ComponentMemberPropGetter {
  let getters = componentMemberPropGetters.get(component)
  if (!getters) {
    getters = {}
    componentMemberPropGetters.set(component, getters)
  }
  if (!getters[key]) {
    getters[key] = new Function(
      'o',
      `return o["${key}"]`
    ) as ComponentMemberPropGetter
  }
  return getters[key]
}

// dev only
export function exposePropsOnRenderContext(
  instance: ComponentInternalInstance
) {
  const {
    ctx,
    type: { props: propsOptions }
  } = instance
  if (propsOptions) {
    Object.keys(normalizePropsOptions(propsOptions)[0]!).forEach(key => {
      Object.defineProperty(ctx, key, {
        enumerable: true,
        configurable: true,
        get: () => instance.props[key],
        set: NOOP
      })
    })
  }
}

// dev only
export function exposeSetupStateOnRenderContext(
  instance: ComponentInternalInstance
) {
  const { ctx, setupState } = instance
  Object.keys(toRaw(setupState)).forEach(key => {
    Object.defineProperty(ctx, key, {
      enumerable: true,
      configurable: true,
      get: () => setupState[key],
      set: NOOP
    })
  })
}
