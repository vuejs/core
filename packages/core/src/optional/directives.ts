/**
Runtime helper for applying directives to a vnode. Example usage:

const comp = resolveComponent(this, 'comp')
const foo = resolveDirective(this, 'foo')
const bar = resolveDirective(this, 'bar')

return applyDirectives(
  h(comp),
  this,
  [foo, this.x],
  [bar, this.y]
)
*/

import { VNode, cloneVNode, VNodeData } from '../vdom'
import { ComponentInstance } from '../component'
import { EMPTY_OBJ } from '@vue/shared'

interface DirectiveBinding {
  instance: ComponentInstance
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

export function applyDirective(
  data: VNodeData,
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
          instance,
          value,
          oldValue,
          arg,
          modifiers
        },
        vnode,
        prevVNode
      )
    }
    const existing = data[hookKey]
    data[hookKey] = existing
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
  instance: ComponentInstance,
  ...directives: DirectiveArguments
) {
  vnode = cloneVNode(vnode, EMPTY_OBJ)
  for (let i = 0; i < directives.length; i++) {
    applyDirective(vnode.data as VNodeData, instance, ...directives[i])
  }
  return vnode
}
