import { EMPTY_OBJ, ShapeFlags, isArray, isReservedProp } from '@vue/shared'
import {
  type ComponentInternalInstance,
  type ConcreteComponent,
  type GenericComponentInstance,
  getCurrentGenericInstance,
} from '../component'
import { firstHydrationElement, hasHydrationRenderer } from '../hydration'
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
   * The first element the component renders, or `null` when it renders none.
   * `null` until the component is mounted, unless it is being hydrated: then
   * it is the element the server rendered.
   */
  readonly el: RendererElement | null
  readonly isVapor: boolean
  readonly isHydrating: boolean
  /**
   * Whether `<KeepAlive>` holds this component or one above it.
   */
  readonly isDeactivated: boolean
  /**
   * Keys of the props, attrs and listeners the parent passed, as written.
   */
  readonly rawPropKeys: string[]
}

const infos = new WeakMap<GenericComponentInstance, ComponentInstanceInfo>()
const instances = new WeakMap<ComponentInstanceInfo, GenericComponentInstance>()

// The getters are shared: an info object holds nothing itself, so the instance
// stays unreachable from it.
const infoProto: ComponentInstanceInfo = /*@__PURE__*/ Object.freeze({
  get uid() {
    return instances.get(this)!.uid
  },
  get type() {
    return instances.get(this)!.type as ConcreteComponent
  },
  get ce() {
    return (instances.get(this)!.ce as HTMLElement | undefined) || null
  },
  get el() {
    return elementOf(instances.get(this)!) || null
  },
  get isVapor() {
    const i = instances.get(this)!
    // on the server a vapor component runs on a vdom instance
    return !!(i.vapor || i.type.__vapor)
  },
  get isHydrating() {
    return isHydrating(instances.get(this)!)
  },
  get isDeactivated() {
    let current: GenericComponentInstance | null = instances.get(this)!
    while (current) {
      if (current.isDeactivated) return true
      current = current.parent
    }
    return false
  },
  get rawPropKeys() {
    const i = instances.get(this)!
    const keys = i.rawKeys
      ? i.rawKeys()
      : Object.keys((i as ComponentInternalInstance).vnode.props || EMPTY_OBJ)
    return keys.filter(key => !isReservedProp(key))
  },
})

function isHydrating(i: GenericComponentInstance): boolean {
  return i.hydrating
    ? i.hydrating()
    : hasHydrationRenderer &&
        !i.isMounted &&
        !!(i as ComponentInternalInstance).vnode.el
}

function elementOf(
  i: GenericComponentInstance,
): RendererElement | null | undefined {
  // a vnode that was mounted before still carries its previous el
  if (!i.isMounted && !isHydrating(i)) return
  if (i.rootEl) return i.rootEl()
  const { subTree, vnode } = i as ComponentInternalInstance
  if (i.isMounted) return firstElement(subTree)
  // Only a DOM renderer hydrates. The flag is true here already: naming it
  // lets a build that cannot hydrate drop the walk.
  if (hasHydrationRenderer)
    return firstHydrationElement(vnode.el as Node | null)
}

function firstElement(vnode: VNode): RendererElement | null | undefined {
  const { shapeFlag, type, children } = vnode
  if (shapeFlag & ShapeFlags.COMPONENT) {
    return vnode.component && elementOf(vnode.component)
  }
  if (__FEATURE_SUSPENSE__ && shapeFlag & ShapeFlags.SUSPENSE) {
    const suspense = vnode.suspense!
    // a hydrating boundary keeps its pending branch in place
    const branch =
      suspense.activeBranch ||
      (suspense.isHydrating ? suspense.pendingBranch : null)
    return branch && firstElement(branch)
  }
  if (type === Fragment) {
    if (isArray(children)) {
      for (const child of children as VNode[]) {
        const el = firstElement(child)
        if (el) return el
      }
    }
  } else if (type === Static || (isVaporInteropEnabled && type === VaporSlot)) {
    // a range of nodes: static content from el to anchor, the content vapor
    // renders for a slot between them
    let node = vnode.el as Node | null
    while (node) {
      if (node.nodeType === 1) return node as Element
      if (node === vnode.anchor) break
      node = node.nextSibling
    }
  } else if (shapeFlag & ShapeFlags.ELEMENT) {
    return vnode.el
  }
}

/**
 * Read-only data about the current component, vdom or vapor. Returns `null`
 * when there is no current instance.
 */
export function useInstanceInfo(): ComponentInstanceInfo | null {
  const i = getCurrentGenericInstance()
  if (!i) return null
  const cached = infos.get(i)
  if (cached) return cached
  const info: ComponentInstanceInfo = Object.freeze(Object.create(infoProto))
  infos.set(i, info)
  instances.set(info, i)
  return info
}
