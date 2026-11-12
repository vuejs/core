import {
  Fragment,
  Static,
  type VNode,
  getCurrentInstance,
  onBeforeUpdate,
  onMounted,
  onScopeDispose,
  onUnmounted,
  queuePostFlushCb,
  warn,
  watch,
} from '@vue/runtime-core'
import { NOOP, ShapeFlags, normalizeCssVarValue } from '@vue/shared'

export const CSS_VAR_TEXT: unique symbol = Symbol(__DEV__ ? 'CSS_VAR_TEXT' : '')
/**
 * Runtime helper for SFC's CSS variable injection feature.
 * @private
 */
export function useCssVars(
  getter: (ctx: any) => Record<string, unknown>,
): void {
  if (!__BROWSER__ && !__TEST__) return

  const instance = getCurrentInstance()
  /* v8 ignore start */
  if (!instance) {
    __DEV__ &&
      warn(`useCssVars is called without current active component instance.`)
    return
  }
  /* v8 ignore stop */

  const updateTeleports = (vars = getter(instance.proxy)) => {
    Array.from(
      document.querySelectorAll(`[data-v-owner="${instance.uid}"]`),
    ).forEach(node => setVarsOnNode(node, vars))
  }
  const owner: TeleportOwner = {
    uid: String(instance.uid),
    update: updateTeleports,
  }
  // anchors left in detached dom that outside code holds must not keep the
  // instance alive
  onScopeDispose(() => (owner.update = undefined))

  instance.ut = (start, end) => {
    if (start) {
      start[TELEPORT_KEY] = [end, owner]
      observeTeleport(start as TeleportAnchor)
      markTeleport(start as TeleportAnchor)
    }
    updateTeleports()
  }

  if (__DEV__) {
    instance.getCssVars = () => getter(instance.proxy)
  }

  const setVars = () => {
    const vars = getter(instance.proxy)
    if (instance.ce) {
      setVarsOnNode(instance.ce as any, vars)
    } else {
      setVarsOnVNode(instance.subTree, vars)
    }
    updateTeleports(vars)
  }

  // handle cases where child component root is affected
  // and triggers reflow in onMounted
  onBeforeUpdate(() => {
    queuePostFlushCb(setVars)
  })

  onMounted(() => {
    // run setVars synchronously here, but run as post-effect on changes
    watch(setVars, NOOP, { flush: 'post' })
    const ob = new MutationObserver(setVars)
    ob.observe(instance.subTree.el!.parentNode, { childList: true })
    onUnmounted(() => ob.disconnect())
  })
}

export const TELEPORT_KEY: unique symbol = Symbol(__DEV__ ? 'TELEPORT_KEY' : '')
interface TeleportOwner {
  uid: string
  update?: (vars?: Record<string, unknown>) => void
}
type TeleportAnchor = Node & {
  [TELEPORT_KEY]?: [end: Node | null, owner: TeleportOwner]
}
type TeleportContainer = Node & { [TELEPORT_KEY]?: Set<TeleportAnchor> }

// Marks the elements between the anchors as owned and returns the update to
// run if there were any. Without `added` every element is marked, otherwise
// only inserted ones (all of them with `true`) not owned by a nested owner.
function markTeleport(start: TeleportAnchor, added?: Set<Node> | true) {
  const [end, owner] = start[TELEPORT_KEY]!
  let update
  if (owner.update) {
    for (let node: any = start; node && node !== end; node = node.nextSibling) {
      if (
        node.nodeType === 1 &&
        (!added ||
          ((added === true || added.has(node)) &&
            (node.getAttribute('data-v-owner') || owner.uid) === owner.uid))
      ) {
        node.setAttribute('data-v-owner', owner.uid)
        update = owner.update
      }
    }
  }
  return update
}

// The root nodes of teleported content can be replaced without the teleport
// being patched, e.g. by a child component updating on its own, so a container
// is observed for as long as it holds a teleport of a component using css vars.
function observeTeleport(start: TeleportAnchor) {
  const container: TeleportContainer | null = start.parentNode
  if (container) {
    let starts = container[TELEPORT_KEY]
    if (!starts) {
      starts = container[TELEPORT_KEY] = new Set()
      new MutationObserver(onTeleportMutations).observe(container, {
        childList: true,
      })
    }
    starts.add(start)
  }
}

// Always passed to the observers by reference: a wrapper created while an
// owner is in scope would keep that owner alive for as long as it is observed.
function onTeleportMutations(records: MutationRecord[], ob: MutationObserver) {
  const container: TeleportContainer = records[0].target
  const starts = container[TELEPORT_KEY]!
  const added = new Set<Node>()
  for (const { addedNodes } of records) {
    addedNodes.forEach(node => added.add(node))
  }
  // an owner is only looked up once for all of its teleports
  const updates = new Set<(() => void) | undefined>()
  starts.forEach(start => {
    if (start.parentNode !== container) {
      starts.delete(start)
      // KeepAlive moves a disabled teleport without patching it
      observeTeleport(start)
      updates.add(markTeleport(start, true))
    } else if (added.size) {
      updates.add(markTeleport(start, added))
    }
  })
  updates.forEach(update => update && update())
  if (!starts.size) {
    ob.disconnect()
    container[TELEPORT_KEY] = undefined
  }
}

function setVarsOnVNode(vnode: VNode, vars: Record<string, unknown>) {
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

function setVarsOnNode(el: Node, vars: Record<string, unknown>) {
  if (el.nodeType === 1) {
    const style = (el as HTMLElement).style
    let cssText = ''
    for (const key in vars) {
      const value = normalizeCssVarValue(vars[key])
      style.setProperty(`--${key}`, value)
      cssText += `--${key}: ${value};`
    }
    ;(style as any)[CSS_VAR_TEXT] = cssText
  }
}
