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

  if (vnode.shapeFlag & ShapeFlags.ELEMENT && vnode.el) {
    setStyle(vnode.el as HTMLElement, vars)
  } else if (vnode.type === Fragment) {
    ;(vnode.children as VNode[]).forEach(c => setVarsOnVNode(c, vars))
  }
  // #3841
  else if (vnode.type === Static) {
    const { el, anchor } = vnode
    let current: HTMLElement | null = el as HTMLElement
    while (current) {
      setVarsOnElement(current, vars)
      if (current === anchor) break
      current = current.nextSibling as HTMLElement
    }
  }
}

function setStyle(el: HTMLElement, vars: Record<string, string>) {
  const style = el.style
  for (const key in vars) {
    style.setProperty(`--${key}`, vars[key])
  }
}

function setVarsOnElement(el: HTMLElement, vars: Record<string, string>) {
  setStyle(el, vars)
  for (var i = 0; i < el.children.length; i++) {
    const n = el.children[i]
    setVarsOnElement(n as HTMLElement, vars)
  }
}
