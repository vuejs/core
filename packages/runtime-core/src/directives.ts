/**
Runtime helper for applying directives to a vnode. Example usage:

const comp = resolveComponent('comp')
const foo = resolveDirective('foo')
const bar = resolveDirective('bar')

return applyDirectives(
  h(comp),
  [foo, this.x],
  [bar, this.y]
)
*/

import { VNode, cloneVNode } from './vnode'
import { extend, isArray, isFunction } from '@vue/shared'
import { warn } from './warning'
import {
  ComponentInstance,
  currentRenderingInstance,
  ComponentRenderProxy
} from './component'
import { callWithAsyncErrorHandling, ErrorTypes } from './errorHandling'

interface DirectiveBinding {
  instance: ComponentRenderProxy | null
  value?: any
  oldValue?: any
  arg?: string
  modifiers?: DirectiveModifiers
}

type DirectiveHook = (
  el: any,
  binding: DirectiveBinding,
  vnode: VNode,
  prevVNode: VNode | void
) => void

interface Directive {
  beforeMount: DirectiveHook
  mounted: DirectiveHook
  beforeUpdate: DirectiveHook
  updated: DirectiveHook
  beforeUnmount: DirectiveHook
  unmounted: DirectiveHook
}

type DirectiveModifiers = Record<string, boolean>

const valueCache = new WeakMap<Directive, WeakMap<any, any>>()

function applyDirective(
  props: Record<any, any>,
  instance: ComponentInstance,
  directive: Directive,
  value?: any,
  arg?: string,
  modifiers?: DirectiveModifiers
) {
  let valueCacheForDir = valueCache.get(directive) as WeakMap<VNode, any>
  if (!valueCacheForDir) {
    valueCacheForDir = new WeakMap<VNode, any>()
    valueCache.set(directive, valueCacheForDir)
  }
  for (const key in directive) {
    const hook = directive[key as keyof Directive]
    const hookKey = `vnode` + key[0].toUpperCase() + key.slice(1)
    const vnodeHook = (vnode: VNode, prevVNode?: VNode) => {
      let oldValue
      if (prevVNode !== void 0) {
        oldValue = valueCacheForDir.get(prevVNode)
        valueCacheForDir.delete(prevVNode)
      }
      valueCacheForDir.set(vnode, value)
      hook(
        vnode.el,
        {
          instance: instance.renderProxy,
          value,
          oldValue,
          arg,
          modifiers
        },
        vnode,
        prevVNode
      )
    }
    const existing = props[hookKey]
    props[hookKey] = existing
      ? [].concat(existing as any, vnodeHook as any)
      : vnodeHook
  }
}

type DirectiveArguments = [
  Directive,
  any,
  string | undefined,
  DirectiveModifiers | undefined
][]

export function applyDirectives(
  vnode: VNode,
  ...directives: DirectiveArguments
) {
  const instance = currentRenderingInstance
  if (instance !== null) {
    vnode = cloneVNode(vnode)
    vnode.props = vnode.props != null ? extend({}, vnode.props) : {}
    for (let i = 0; i < directives.length; i++) {
      applyDirective(vnode.props, instance, ...directives[i])
    }
  } else if (__DEV__) {
    warn(`applyDirectives can only be used inside render functions.`)
  }
  return vnode
}

export function resolveDirective(name: string): Directive {
  // TODO
  return {} as any
}

export function invokeDirectiveHook(
  hook: Function | Function[],
  instance: ComponentInstance | null,
  vnode: VNode
) {
  const args = [vnode]
  if (isArray(hook)) {
    for (let i = 0; i < hook.length; i++) {
      callWithAsyncErrorHandling(
        hook[i],
        instance,
        ErrorTypes.DIRECTIVE_HOOK,
        args
      )
    }
  } else if (isFunction(hook)) {
    callWithAsyncErrorHandling(hook, instance, ErrorTypes.DIRECTIVE_HOOK, args)
  }
}
