import {
  getCurrentInstance,
  warn,
  VNode,
  Fragment,
  Static,
  watchPostEffect,
  onMounted,
  onUnmounted,
  Teleport
} from '@vue/runtime-core'
import { ShapeFlags, isArray } from '@vue/shared'

/**
 * Runtime helper for SFC's CSS variable injection feature.
 * @private
 */
export function useCssVars(getter: (ctx: any) => Record<string, string>) {
  if (!__BROWSER__ && !__TEST__) return

  const obs = new Map<Node, MutationObserver>()
  const instance = getCurrentInstance()
  /* istanbul ignore next */
  if (!instance) {
    __DEV__ &&
      warn(`useCssVars is called without current active component instance.`)
    return
  }

  const createObserve = (container: Node) => {
    if (obs.has(container)) return
    const ob = new MutationObserver(setVars)
    ob.observe(container, { childList: true })
    obs.set(container, ob)
  }

  const setVars = () => {
    const vars = getter(instance.proxy)
    setVarsOnVNode(instance.subTree, vars, createObserve)
  }

  watchPostEffect(setVars)

  onMounted(() => {
    createObserve(instance.subTree.el!.parentNode)
    onUnmounted(() => {
      obs.forEach(ob => ob.disconnect())
      obs.clear()
    })
  })
}

function setVarsOnVNode(
  vnode: VNode,
  vars: Record<string, string>,
  createObserve: (container: Node) => void,
  flag?: Boolean
) {
  if (__FEATURE_SUSPENSE__ && vnode.shapeFlag & ShapeFlags.SUSPENSE) {
    const suspense = vnode.suspense!
    vnode = suspense.activeBranch!
    if (suspense.pendingBranch && !suspense.isHydrating) {
      suspense.effects.push(() => {
        setVarsOnVNode(suspense.activeBranch!, vars, createObserve, flag)
      })
    }
  }

  // drill down HOCs until it's a non-component vnode
  while (vnode.component) {
    vnode = vnode.component.subTree
  }

  if (vnode.shapeFlag & ShapeFlags.ELEMENT) {
    if (!flag && vnode.el) {
      setVarsOnNode(vnode.el as Node, vars)
    }
    if (isArray(vnode.children)) {
      ;(vnode.children as VNode[]).forEach(c =>
        setVarsOnVNode(c, vars, createObserve, true)
      )
    }
  } else if (vnode.type === Fragment) {
    ;(vnode.children as VNode[]).forEach(c =>
      setVarsOnVNode(c, vars, createObserve, flag)
    )
  } else if (vnode.type === Teleport) {
    if (vnode.target) {
      ;(vnode.children as VNode[]).forEach(c =>
        setVarsOnVNode(c, vars, createObserve)
      )
      createObserve(vnode.target as Node)
    }
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
