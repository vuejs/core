import { VNode } from '../vdom'
import { MountedComponent } from '../component'

export interface DirectiveBinding {
  instance: MountedComponent
  value?: any
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

export function applyDirective(
  vnode: VNode,
  directive: Directive,
  instance: MountedComponent,
  value?: any,
  arg?: string,
  modifiers?: DirectiveModifiers
): VNode {
  const data = vnode.data || (vnode.data = {})
  for (const key in directive) {
    const hook = directive[key as keyof Directive]
    const hookKey = `vnode` + key[0].toUpperCase() + key.slice(1)
    const vnodeHook = (vnode: VNode, prevVNode?: VNode) => {
      hook(
        vnode.el,
        {
          instance,
          value,
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
