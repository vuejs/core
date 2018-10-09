import { VNode } from '../vdom'
import { ComponentInstance } from '../component'

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
  vnode: VNode,
  directive: Directive,
  instance: ComponentInstance,
  value?: any,
  arg?: string,
  modifiers?: DirectiveModifiers
): VNode {
  const data = vnode.data || (vnode.data = {})
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
    data[hookKey] = existing ? [].concat(existing, vnodeHook as any) : vnodeHook
  }
  return vnode
}

type DirectiveArguments = [
  Directive,
  ComponentInstance,
  any,
  string | undefined,
  DirectiveModifiers | undefined
][]

export function applyDirectives(vnode: VNode, directives: DirectiveArguments) {
  for (let i = 0; i < directives.length; i++) {
    applyDirective(vnode, ...directives[i])
  }
  return vnode
}
