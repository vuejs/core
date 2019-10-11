import { ComponentInternalInstance, Data } from './component'
import { nextTick } from './scheduler'
import { instanceWatch } from './apiWatch'
import { EMPTY_OBJ, hasOwn, globalsWhitelist } from '@vue/shared'
import { ExtractComputedReturns } from './apiOptions'
import { UnwrapRef } from '@vue/reactivity'
import { warn } from './warning'

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
  [key: string]: any
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
    const versionApiMap = getVersionApiMap(target)
    if (data !== EMPTY_OBJ && hasOwn(data, key)) {
      return data[key]
    } else if (hasOwn(renderContext, key)) {
      return renderContext[key]
    } else if (hasOwn(props, key)) {
      // return the value from propsProxy for ref unwrapping and readonly
      return propsProxy![key]
    } else if (versionApiMap.has(key)) {
      return versionApiMap.get(key)
    } else {
      // methods are only exposed when options are supported
      if (__FEATURE_OPTIONS__) {
        const featureApiMap = getFeatureApiMap(target)
        if (featureApiMap.has(key)) {
          return featureApiMap.get(key)
        }
      }
      return target.user[key]
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
      target.user[key] = value
    }
    return true
  }
}

function getVersionApiMap(target: ComponentInternalInstance): Map<string, any> {
  return new Map(
    Object.entries({
      $data: target.data,
      $props: target.propsProxy,
      $attrs: target.attrs,
      $slots: target.slots,
      $refs: target.refs,
      $parent: target.parent,
      $root: target.root,
      $emit: target.emit,
      $el: target.vnode.el,
      $options: target.type
    })
  )
}

function getFeatureApiMap(target: ComponentInternalInstance): Map<string, any> {
  return new Map(
    Object.entries({
      $forceUpdate: target.update,
      $nextTick: nextTick,
      $watch: instanceWatch.bind(target)
    })
  )
}
