import { ComponentInternalInstance, Data, Emit } from './component'
import { nextTick, queueJob } from './scheduler'
import { instanceWatch } from './apiWatch'
import { EMPTY_OBJ, hasOwn, isGloballyWhitelisted } from '@vue/shared'
import {
  ExtractComputedReturns,
  ComponentOptionsBase,
  ComputedOptions,
  MethodOptions
} from './apiOptions'
import { UnwrapRef, ReactiveEffect, isRef, isReactive } from '@vue/reactivity'
import { warn } from './warning'
import { Slots } from './componentSlots'
import {
  currentRenderingInstance,
  markAttrsAccessed
} from './componentRenderUtils'

// public properties exposed on the proxy, which is used as the render context
// in templates (as `this` in the render option)
export type ComponentPublicInstance<
  P = {},
  B = {},
  D = {},
  C extends ComputedOptions = {},
  M extends MethodOptions = {},
  PublicProps = P
> = {
  $data: D
  $props: PublicProps
  $attrs: Data
  $refs: Data
  $slots: Slots
  $root: ComponentInternalInstance | null
  $parent: ComponentInternalInstance | null
  $emit: Emit
  $el: any
  $options: ComponentOptionsBase<P, B, D, C, M>
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
  $cache: i => i.renderCache || (i.renderCache = []),
  $data: i => i.data,
  $props: i => i.propsProxy,
  $attrs: i => i.attrs,
  $slots: i => i.slots,
  $refs: i => i.refs,
  $parent: i => i.parent,
  $root: i => i.root,
  $emit: i => i.emit,
  $options: i => i.type,
  $forceUpdate: i => () => queueJob(i.update),
  $nextTick: () => nextTick,
  $watch: i => instanceWatch.bind(i)
}

const enum AccessTypes {
  DATA,
  CONTEXT,
  PROPS,
  OTHER
}

const unwrapRef = (val: unknown) => (isRef(val) ? val.value : val)

export const PublicInstanceProxyHandlers: ProxyHandler<any> = {
  get(target: ComponentInternalInstance, key: string) {
    // fast path for unscopables when using `with` block
    if (__RUNTIME_COMPILE__ && (key as any) === Symbol.unscopables) {
      return
    }
    const {
      renderContext,
      data,
      props,
      propsProxy,
      accessCache,
      type,
      sink
    } = target

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
            return unwrapRef(renderContext[key])
          case AccessTypes.PROPS:
            return propsProxy![key]
          // default: just fallthrough
        }
      } else if (data !== EMPTY_OBJ && hasOwn(data, key)) {
        accessCache![key] = AccessTypes.DATA
        return data[key]
      } else if (hasOwn(renderContext, key)) {
        accessCache![key] = AccessTypes.CONTEXT
        return unwrapRef(renderContext[key])
      } else if (type.props != null) {
        // only cache other properties when instance has declared (this stable)
        // props
        if (hasOwn(props, key)) {
          accessCache![key] = AccessTypes.PROPS
          // return the value from propsProxy for ref unwrapping and readonly
          return propsProxy![key]
        } else {
          accessCache![key] = AccessTypes.OTHER
        }
      }
    }

    // public $xxx properties & user-attached properties (sink)
    const publicGetter = publicPropertiesMap[key]
    let cssModule
    if (publicGetter != null) {
      if (__DEV__ && key === '$attrs') {
        markAttrsAccessed()
      }
      return publicGetter(target)
    } else if (
      __BUNDLER__ &&
      (cssModule = type.__cssModules) != null &&
      (cssModule = cssModule[key])
    ) {
      return cssModule
    } else if (hasOwn(sink, key)) {
      return sink[key]
    } else if (__DEV__ && currentRenderingInstance != null) {
      warn(
        `Property ${JSON.stringify(key)} was accessed during render ` +
          `but is not defined on instance.`
      )
    }
  },

  has(target: ComponentInternalInstance, key: string) {
    const { data, accessCache, renderContext, type, sink } = target
    return (
      accessCache![key] !== undefined ||
      (data !== EMPTY_OBJ && hasOwn(data, key)) ||
      hasOwn(renderContext, key) ||
      (type.props != null && hasOwn(type.props, key)) ||
      hasOwn(publicPropertiesMap, key) ||
      hasOwn(sink, key)
    )
  },

  set(target: ComponentInternalInstance, key: string, value: any): boolean {
    const { data, renderContext } = target
    if (data !== EMPTY_OBJ && hasOwn(data, key)) {
      data[key] = value
    } else if (hasOwn(renderContext, key)) {
      // context is already reactive (user returned reactive object from setup())
      // just set directly
      if (isReactive(renderContext)) {
        renderContext[key] = value
      } else {
        // handle potential ref set
        const oldValue = renderContext[key]
        if (isRef(oldValue) && !isRef(value)) {
          oldValue.value = value
        } else {
          renderContext[key] = value
        }
      }
    } else if (key[0] === '$' && key.slice(1) in target) {
      __DEV__ &&
        warn(
          `Attempting to mutate public property "${key}". ` +
            `Properties starting with $ are reserved and readonly.`,
          target
        )
      return false
    } else if (key in target.props) {
      __DEV__ &&
        warn(`Attempting to mutate prop "${key}". Props are readonly.`, target)
      return false
    } else {
      target.sink[key] = value
    }
    return true
  }
}

export const runtimeCompiledRenderProxyHandlers = {
  ...PublicInstanceProxyHandlers,
  has(_target: ComponentInternalInstance, key: string) {
    return key[0] !== '_' && !isGloballyWhitelisted(key)
  }
}
