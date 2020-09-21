import {
  ComponentPublicInstance,
  getCurrentInstance,
  onMounted,
  warn,
  VNode,
  Fragment,
  unref,
  onUpdated
} from '@vue/runtime-core'
import { ShapeFlags } from '@vue/shared'

export function useCssVars(
  getter: (ctx: ComponentPublicInstance) => Record<string, string>,
  scoped = false
) {
  const instance = getCurrentInstance()
  /* istanbul ignore next */
  if (!instance) {
    __DEV__ &&
      warn(`useCssVars is called without current active component instance.`)
    return
  }

  const prefix =
    scoped && instance.type.__scopeId
      ? `${instance.type.__scopeId.replace(/^data-v-/, '')}-`
      : ``

  const setVars = () =>
    setVarsOnVNode(instance.subTree, getter(instance.proxy!), prefix)
  onMounted(setVars)
  onUpdated(setVars)
}

function setVarsOnVNode(
  vnode: VNode,
  vars: Record<string, string>,
  prefix: string
) {
  if (__FEATURE_SUSPENSE__ && vnode.shapeFlag & ShapeFlags.SUSPENSE) {
    const suspense = vnode.suspense!
    vnode = suspense.activeBranch!
    if (suspense.pendingBranch && !suspense.isHydrating) {
      suspense.effects.push(() => {
        setVarsOnVNode(suspense.activeBranch!, vars, prefix)
      })
    }
  }

  // drill down HOCs until it's a non-component vnode
  while (vnode.component) {
    vnode = vnode.component.subTree
  }

  if (vnode.shapeFlag & ShapeFlags.ELEMENT && vnode.el) {
    const style = vnode.el.style
    for (const key in vars) {
      style.setProperty(`--${prefix}${key}`, unref(vars[key]))
    }
  } else if (vnode.type === Fragment) {
    ;(vnode.children as VNode[]).forEach(c => setVarsOnVNode(c, vars, prefix))
  }
}
