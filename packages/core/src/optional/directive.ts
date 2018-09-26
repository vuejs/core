import { VNode } from '../vdom'
import { MountedComponent } from '../component'

export interface DirectiveBinding {
  instance: MountedComponent
  value?: any
  oldValue?: any
  arg?: string
  modifiers?: DirectiveModifiers
}

export type DirectiveHook = (
  el: any,
  binding: DirectiveBinding,
  vnode: VNode,
  prevVNode: VNode | void
) => void

export interface Directive {
  beforeMount: DirectiveHook
  mounted: DirectiveHook
  beforeUpdate: DirectiveHook
  updated: DirectiveHook
  beforeUnmount: DirectiveHook
  unmounted: DirectiveHook
}

export type DirectiveModifiers = Record<string, boolean>

const valueCache = new WeakMap<Directive, WeakMap<any, any>>()

export function applyDirective(
  vnode: VNode,
  directive: Directive,
  instance: MountedComponent,
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
