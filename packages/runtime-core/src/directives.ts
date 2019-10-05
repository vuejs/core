/**
Runtime helper for applying directives to a vnode. Example usage:

const comp = resolveComponent('comp')
const foo = resolveDirective('foo')
const bar = resolveDirective('bar')

return applyDirectives(h(comp), [
  [foo, this.x],
  [bar, this.y]
])
*/

import { VNode, cloneVNode } from './vnode'
import { extend, isArray, isFunction } from '@vue/shared'
import { warn } from './warning'
import { ComponentInternalInstance } from './component'
import { currentRenderingInstance } from './componentRenderUtils'
import { callWithAsyncErrorHandling, ErrorCodes } from './errorHandling'
import { ComponentPublicInstance } from './componentProxy'

export interface DirectiveBinding {
  instance: ComponentPublicInstance | null
  value?: any
  oldValue?: any
  arg?: string
  modifiers?: DirectiveModifiers
}

export type DirectiveHook = (
  el: any,
  binding: DirectiveBinding,
  vnode: VNode,
  prevVNode: VNode | null
) => void

export interface Directive {
  beforeMount?: DirectiveHook
  mounted?: DirectiveHook
  beforeUpdate?: DirectiveHook
  updated?: DirectiveHook
  beforeUnmount?: DirectiveHook
  unmounted?: DirectiveHook
}

type DirectiveModifiers = Record<string, boolean>

const valueCache = new WeakMap<Directive, WeakMap<any, any>>()

function applyDirective(
  props: Record<any, any>,
  instance: ComponentInternalInstance,
  directive: Directive,
  value?: any,
  arg?: string,
  modifiers?: DirectiveModifiers
) {
  let valueCacheForDir = valueCache.get(directive)!
  if (!valueCacheForDir) {
    valueCacheForDir = new WeakMap<VNode, any>()
    valueCache.set(directive, valueCacheForDir)
  }
  for (const key in directive) {
    const hook = directive[key as keyof Directive]!
    const hookKey = `vnode` + key[0].toUpperCase() + key.slice(1)
    const vnodeHook = (vnode: VNode, prevVNode: VNode | null) => {
      let oldValue
      if (prevVNode != null) {
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
      ? [].concat(existing, vnodeHook as any)
      : vnodeHook
  }
}

// Directive, value, argument, modifiers
export type DirectiveArguments = Array<
  | [Directive]
  | [Directive, any]
  | [Directive, any, string]
  | [Directive, any, string, DirectiveModifiers]
>

export function applyDirectives(vnode: VNode, directives: DirectiveArguments) {
  const instance = currentRenderingInstance
  if (instance !== null) {
    vnode = cloneVNode(vnode)
    vnode.props = vnode.props != null ? extend({}, vnode.props) : {}
    for (let i = 0; i < directives.length; i++) {
      ;(applyDirective as any)(vnode.props, instance, ...directives[i])
    }
  } else if (__DEV__) {
    warn(`applyDirectives can only be used inside render functions.`)
  }
  return vnode
}

export function invokeDirectiveHook(
  hook: Function | Function[],
  instance: ComponentInternalInstance | null,
  vnode: VNode,
  prevVNode: VNode | null = null
) {
  const args = [vnode, prevVNode]
  if (isArray(hook)) {
    for (let i = 0; i < hook.length; i++) {
      callWithAsyncErrorHandling(
        hook[i],
        instance,
        ErrorCodes.DIRECTIVE_HOOK,
        args
      )
    }
  } else if (isFunction(hook)) {
    callWithAsyncErrorHandling(hook, instance, ErrorCodes.DIRECTIVE_HOOK, args)
  }
}
