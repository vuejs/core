import { ComponentInternalInstance, Data } from './component'
import { nextTick } from './scheduler'
import { instanceWatch } from './apiWatch'
import { EMPTY_OBJ, hasOwn, globalsWhitelist } from '@vue/shared'
import { ExtractComputedReturns } from './apiOptions'
import { UnwrapRef } from '@vue/reactivity'

// public properties exposed on the proxy, which is used as the render context
// in templates (as `this` in the render option)
export type ComponentPublicInstance<
  P = {},
  B = {},
  D = {},
  C = {},
  M = {},
  PublicProps = P
> = {
  $data: D
  $props: PublicProps
  $attrs: Data
  $refs: Data
  $slots: Data
  $root: ComponentInternalInstance | null
  $parent: ComponentInternalInstance | null
  $emit: (event: string, ...args: unknown[]) => void
} & P &
  UnwrapRef<B> &
  D &
  ExtractComputedReturns<C> &
  M

export const PublicInstanceProxyHandlers = {
  get(target: ComponentInternalInstance, key: string) {
    const { renderContext, data, props, propsProxy } = target
    if (data !== EMPTY_OBJ && hasOwn(data, key)) {
      return data[key]
    } else if (hasOwn(renderContext, key)) {
      return renderContext[key]
    } else if (hasOwn(props, key)) {
      // return the value from propsProxy for ref unwrapping and readonly
      return propsProxy![key]
    } else {
      return getInstancePropertyFromKey(target, key)
    }
  },
  // this trap is only called in browser-compiled render functions that use
  // `with (this) {}`
  has(_: any, key: string): boolean {
    return key[0] !== '_' && !globalsWhitelist.has(key)
  },
  set(target: ComponentInternalInstance, key: string, value: any): boolean {
    const { data, renderContext } = target
    if (data !== EMPTY_OBJ && hasOwn(data, key)) {
      data[key] = value
    } else if (hasOwn(renderContext, key)) {
      renderContext[key] = value
    } else if (key[0] === '$' && key.slice(1) in target) {
      // TODO warn attempt of mutating public property
      return false
    } else if (key in target.props) {
      // TODO warn attempt of mutating prop
      return false
    } else {
      target.user[key] = value
    }
    return true
  }
}

interface InternalInstanceProxyPropMap {
  [name: string]: (target: ComponentInternalInstance) => any
}

const proxyPassThroughProps: any = {
  data: !0,
  attrs: !0,
  slots: !0,
  refs: !0,
  parent: !0,
  root: !0,
  emit: !0
}

const proxyMappedProps: InternalInstanceProxyPropMap = {
  props: target => target.propsProxy,
  el: target => target.vnode.el,
  options: target => target.type
}

// methods are only exposed when options are supported
if (__FEATURE_OPTIONS__) {
  Object.assign(proxyMappedProps, {
    forceUpdate: target => target.update,
    nextTick: () => nextTick,
    watch: target => instanceWatch.bind(target)
  } as InternalInstanceProxyPropMap)
}

function getInstancePropertyFromKey(
  target: ComponentInternalInstance,
  key: string
) {
  if (key[0] === '$') {
    key = key.substr(1)
    if (proxyPassThroughProps[key]) {
      return target[key as keyof ComponentInternalInstance]
    }
    if (proxyMappedProps[key]) {
      return proxyMappedProps[key](target)
    }
  }
  return target.user[key]
}
