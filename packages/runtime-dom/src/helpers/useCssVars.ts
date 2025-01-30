import {
  Fragment,
  type GenericComponentInstance,
  Static,
  type VNode,
  getCurrentInstance,
  onBeforeUpdate,
  onMounted,
  onUnmounted,
  queuePostFlushCb,
  warn,
  watch,
} from '@vue/runtime-core'
import { NOOP, ShapeFlags } from '@vue/shared'

export const CSS_VAR_TEXT: unique symbol = Symbol(__DEV__ ? 'CSS_VAR_TEXT' : '')
/**
 * Runtime helper for SFC's CSS variable injection feature.
 * @private
 */
export function useCssVars(getter: (ctx: any) => Record<string, string>): void {
  if (!__BROWSER__ && !__TEST__) return

  const instance = getCurrentInstance()! // to be check in baseUseCssVars
  const getVars = () => getter(instance.proxy)
  const setVars = (vars: Record<string, any>) => {
    if (instance.ce) {
      setVarsOnNode(instance.ce as any, vars)
    } else {
      setVarsOnVNode(instance.subTree, vars)
    }
  }

  baseUseCssVars(
    instance,
    () => instance.subTree.el!.parentNode!,
    getVars,
    setVars,
  )
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

export function baseUseCssVars(
  instance: GenericComponentInstance | null,
  getParentNode: () => Node,
  getVars: () => Record<string, any>,
  setVars: (vars: Record<string, any>) => void,
): void {
  /* v8 ignore start */
  if (!instance) {
    __DEV__ &&
      warn(`useCssVars is called without current active component instance.`)
    return
  }
  /* v8 ignore stop */

  if (__DEV__) {
    instance.getCssVars = () => getVars()
  }

  const updateTeleports = (instance.ut = (vars = getVars()) => {
    Array.from(
      document.querySelectorAll(`[data-v-owner="${instance.uid}"]`),
    ).forEach(node => setVarsOnNode(node, vars))
  })

  const applyCssCars = () => {
    const vars = getVars()
    setVars(vars)
    updateTeleports(vars)
  }

  // handle cases where child component root is affected
  // and triggers reflow in onMounted
  onBeforeUpdate(() => {
    queuePostFlushCb(applyCssCars)
  })

  onMounted(() => {
    // run setVars synchronously here, but run as post-effect on changes
    watch(applyCssCars, NOOP, { flush: 'post' })
    const ob = new MutationObserver(applyCssCars)
    ob.observe(getParentNode(), { childList: true })
    onUnmounted(() => ob.disconnect())
  })
}

export function setVarsOnNode(el: Node, vars: Record<string, string>): void {
  if (el.nodeType === 1) {
    const style = (el as HTMLElement).style
    let cssText = ''
    for (const key in vars) {
      style.setProperty(`--${key}`, vars[key])
      cssText += `--${key}: ${vars[key]};`
    }
    ;(style as any)[CSS_VAR_TEXT] = cssText
  }
}
