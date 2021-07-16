import {
  getCurrentInstance,
  onMounted,
  warn,
  VNode,
  Fragment,
  Static,
  onUpdated,
  watchEffect
} from '@vue/runtime-core'
import { ShapeFlags } from '@vue/shared'

/**
 * Runtime helper for SFC's CSS variable injection feature.
 * @private
 */
export function useCssVars(getter: (ctx: any) => Record<string, string>) {
  if (!__BROWSER__ && !__TEST__) return

  const instance = getCurrentInstance()
  /* istanbul ignore next */
  if (!instance) {
    __DEV__ &&
      warn(`useCssVars is called without current active component instance.`)
    return
  }

  const setVars = () =>
    setVarsOnVNode(instance.subTree, getter(instance.proxy!))
  onMounted(() => watchEffect(setVars, { flush: 'post' }))
  onUpdated(setVars)
}

function setVarsOnVNode(vnode: VNode, vars: Record<string, string>) {
  if (__FEATURE_SUSPENSE__ && vnode.shapeFlag & ShapeFlags.SUSPENSE) {
    const suspense = vnode.suspense!
    vnode = suspense.activeBranch!
    if (suspense.pendingBranch && !suspense.isHydrating) {
      suspense.effects.push(() => {
        setVarsOnVNode(suspense.activeBranch!, vars)
      })
    }
  }

  // drill down HOCs until it's a non-component vnode
  while (vnode.component) {
    vnode = vnode.component.subTree
  }

  if (vnode.transition) {
    vnode.transition.effects.push((el: Node) => {
      setVarsOnNode(el, vars)
    })
  }

  if (vnode.shapeFlag & ShapeFlags.ELEMENT && vnode.el) {
    setVarsOnNode(vnode.el as Node, vars)
  } else if (vnode.type === Fragment) {
    ;(vnode.children as VNode[]).forEach(c => setVarsOnVNode(c, vars))
  } else if (vnode.type === Static) {
    let { el, anchor } = vnode
    while (el) {
      setVarsOnNode(el as Node, vars)
      if (el === anchor) break
      el = el.nextSibling
    }
  }
}

function setVarsOnNode(el: Node, vars: Record<string, string>) {
  if (el.nodeType === 1) {
    const style = (el as HTMLElement).style
    for (const key in vars) {
      style.setProperty(`--${key}`, vars[key])
    }
  }
}
