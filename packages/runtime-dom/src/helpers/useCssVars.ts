import {
  ComponentPublicInstance,
  getCurrentInstance,
  onMounted,
  watchEffect,
  warn,
  VNode,
  Fragment
} from '@vue/runtime-core'
import { ShapeFlags } from '@vue/shared/src'

export function useCSSVars(
  getter: (ctx: ComponentPublicInstance) => Record<string, string>
) {
  const instance = getCurrentInstance()
  if (!instance) {
    __DEV__ &&
      warn(`useCssVars is called without current active component instance.`)
    return
  }
  onMounted(() => {
    watchEffect(() => {
      setVarsOnVNode(instance.vnode, getter(instance.proxy!))
    })
  })
}

function setVarsOnVNode(vnode: VNode, vars: Record<string, string>) {
  // drill down HOCs until it's a non-component vnode
  while (vnode.component) {
    vnode = vnode.component.subTree
  }
  if (vnode.shapeFlag & ShapeFlags.ELEMENT && vnode.el) {
    const style = vnode.el.style
    for (const key in vars) {
      style.setProperty(`--${key}`, vars[key])
    }
  } else if (vnode.type === Fragment) {
    ;(vnode.children as VNode[]).forEach(c => setVarsOnVNode(c, vars))
  }
}
