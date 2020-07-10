import {
  ComponentPublicInstance,
  getCurrentInstance,
  onMounted,
  watchEffect,
  warn,
  VNode,
  Fragment,
  ComponentInternalInstance
} from '@vue/runtime-core'
import { ShapeFlags } from '@vue/shared/src'

export function useCSSVars(
  getter: (ctx: ComponentPublicInstance) => Record<string, string>,
  scoped = false
) {
  const instance = getCurrentInstance()
  if (!instance) {
    __DEV__ &&
      warn(`useCssVars is called without current active component instance.`)
    return
  }
  onMounted(() => {
    watchEffect(() => {
      setVarsOnVNode(
        instance.subTree,
        getter(instance.proxy!),
        instance,
        scoped
      )
    })
  })
}

function setVarsOnVNode(
  vnode: VNode,
  vars: Record<string, string>,
  owner: ComponentInternalInstance,
  scoped: boolean
) {
  // drill down HOCs until it's a non-component vnode
  while (vnode.component) {
    vnode = vnode.component.subTree
  }
  if (vnode.shapeFlag & ShapeFlags.ELEMENT && vnode.el) {
    const style = vnode.el.style
    const prefix =
      scoped && owner.type.__scopeId ? `${owner.type.__scopeId}-` : ``
    for (const key in vars) {
      style.setProperty(`--${prefix}${key}`, vars[key])
    }
  } else if (vnode.type === Fragment) {
    ;(vnode.children as VNode[]).forEach(c =>
      setVarsOnVNode(c, vars, owner, scoped)
    )
  }
}
