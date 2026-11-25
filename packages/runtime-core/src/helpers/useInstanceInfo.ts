import { EMPTY_OBJ, ShapeFlags, isArray, isReservedProp } from '@vue/shared'
import {
  type ComponentInternalInstance,
  type ConcreteComponent,
  type GenericComponentInstance,
  getCurrentGenericInstance,
} from '../component'
import { collectHydrationElements, hasHydrationRenderer } from '../hydration'
import type { RendererElement } from '../renderer'
import { isVaporInteropEnabled } from '../vaporInteropState'
import { Fragment, Static, type VNode, VaporSlot } from '../vnode'

export interface ComponentInstanceInfo {
  readonly uid: number
  readonly type: ConcreteComponent
  /**
   * The host element of a component defined via `defineCustomElement`.
   */
  readonly ce: HTMLElement | null
  /**
   * The root element, or the root elements in order when there are several.
   * Marker comments, anchors and text are skipped; `null` when there is no
   * element. `null` until the component is mounted, unless it is being
   * hydrated: then it is what the server rendered.
   */
  readonly el: RendererElement | RendererElement[] | null
  readonly isVapor: boolean
  readonly isHydrating: boolean
  readonly isMounted: boolean
  /**
   * Keys of the props, attrs and listeners the parent passed, as written.
   */
  readonly rawPropKeys: string[]
}

function isHydrating(i: GenericComponentInstance): boolean {
  return i.hydrating
    ? i.hydrating()
    : hasHydrationRenderer &&
        !i.isMounted &&
        !!(i as ComponentInternalInstance).vnode.el
}

function collectRoots(
  i: GenericComponentInstance,
  roots: RendererElement[],
): void {
  // a vnode that was mounted before still carries its previous el
  if (!i.isMounted && !isHydrating(i)) return
  if (i.rootEls) return i.rootEls(roots)
  if (i.isMounted) {
    collectElements((i as ComponentInternalInstance).subTree, roots)
  } else if (hasHydrationRenderer) {
    // Only a DOM renderer hydrates. The flag is true here already: naming it
    // lets a build that cannot hydrate drop the walk.
    collectHydrationElements(
      (i as ComponentInternalInstance).vnode.el as Node | null,
      roots as Element[],
    )
  }
}

function collectElements(vnode: VNode, roots: RendererElement[]): void {
  const { shapeFlag, type, children } = vnode
  if (shapeFlag & ShapeFlags.COMPONENT) {
    if (vnode.component) collectRoots(vnode.component, roots)
  } else if (__FEATURE_SUSPENSE__ && shapeFlag & ShapeFlags.SUSPENSE) {
    const suspense = vnode.suspense!
    // a hydrating boundary keeps its pending branch in place
    const branch =
      suspense.activeBranch ||
      (suspense.isHydrating ? suspense.pendingBranch : null)
    if (branch) collectElements(branch, roots)
  } else if (type === Fragment) {
    if (isArray(children)) {
      for (const child of children as VNode[]) collectElements(child, roots)
    }
  } else if (type === Static || (isVaporInteropEnabled && type === VaporSlot)) {
    // a range of nodes: static content from el to anchor, the content vapor
    // renders for a slot between them
    let node = vnode.el as Node | null
    while (node) {
      if (node.nodeType === 1) roots.push(node)
      if (node === vnode.anchor) break
      node = node.nextSibling
    }
  } else if (shapeFlag & ShapeFlags.ELEMENT) {
    roots.push(vnode.el!)
  }
}

/**
 * Read-only data about the current component, vdom or vapor. Returns `null`
 * when there is no current instance.
 */
export function useInstanceInfo(): ComponentInstanceInfo | null {
  const i = getCurrentGenericInstance()
  if (!i) return null
  return {
    get uid() {
      return i.uid
    },
    get type() {
      return i.type as ConcreteComponent
    },
    get ce() {
      return (i.ce as HTMLElement | undefined) || null
    },
    get el() {
      const els: RendererElement[] = []
      collectRoots(i, els)
      return els.length > 1 ? els : els[0] || null
    },
    get isVapor() {
      // on the server a vapor component runs on a vdom instance
      return !!(i.vapor || i.type.__vapor)
    },
    get isHydrating() {
      return isHydrating(i)
    },
    get isMounted() {
      return i.isMounted
    },
    get rawPropKeys() {
      const keys = i.rawKeys
        ? i.rawKeys()
        : Object.keys((i as ComponentInternalInstance).vnode.props || EMPTY_OBJ)
      return keys.filter(key => !isReservedProp(key))
    },
  }
}
