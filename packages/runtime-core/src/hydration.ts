import { VNode, normalizeVNode, Text, Comment, Static, Fragment } from './vnode'
import { queuePostFlushCb, flushPostFlushCbs } from './scheduler'
import { ComponentInternalInstance } from './component'
import { invokeDirectiveHook } from './directives'
import { warn } from './warning'
import {
  PatchFlags,
  ShapeFlags,
  isReservedProp,
  isOn,
  isString
} from '@vue/shared'
import { RendererInternals } from './renderer'

export type RootHydrateFunction = (
  vnode: VNode<Node, Element>,
  container: Element
) => void

// Note: hydration is DOM-specific
// But we have to place it in core due to tight coupling with core - splitting
// it out creates a ton of unnecessary complexity.
// Hydration also depends on some renderer internal logic which needs to be
// passed in via arguments.
export function createHydrationFunctions({
  mt: mountComponent,
  o: { patchProp, createText }
}: RendererInternals<Node, Element>) {
  const hydrate: RootHydrateFunction = (vnode, container) => {
    if (__DEV__ && !container.hasChildNodes()) {
      warn(`Attempting to hydrate existing markup but container is empty.`)
      return
    }
    hydrateNode(container.firstChild!, vnode)
    flushPostFlushCbs()
  }

  // TODO handle mismatches
  const hydrateNode = (
    node: Node,
    vnode: VNode,
    parentComponent: ComponentInternalInstance | null = null,
    optimized = false
  ): Node | null => {
    const { type, shapeFlag } = vnode
    vnode.el = node
    switch (type) {
      case Text:
      case Comment:
      case Static:
        return node.nextSibling
      case Fragment:
        return hydrateFragment(node, vnode, parentComponent, optimized)
      default:
        if (shapeFlag & ShapeFlags.ELEMENT) {
          return hydrateElement(
            node as Element,
            vnode,
            parentComponent,
            optimized
          )
        } else if (shapeFlag & ShapeFlags.COMPONENT) {
          // when setting up the render effect, if the initial vnode already
          // has .el set, the component will perform hydration instead of mount
          // on its sub-tree.
          mountComponent(vnode, null, null, parentComponent, null, false)
          const subTree = vnode.component!.subTree
          return (subTree.anchor || subTree.el).nextSibling
        } else if (shapeFlag & ShapeFlags.PORTAL) {
          hydratePortal(vnode, parentComponent, optimized)
          return node.nextSibling
        } else if (__FEATURE_SUSPENSE__ && shapeFlag & ShapeFlags.SUSPENSE) {
          // TODO Suspense
        } else if (__DEV__) {
          warn('Invalid HostVNode type:', type, `(${typeof type})`)
        }
        return null
    }
  }

  const hydrateElement = (
    el: Element,
    vnode: VNode,
    parentComponent: ComponentInternalInstance | null,
    optimized: boolean
  ) => {
    const { props, patchFlag } = vnode
    // skip props & children if this is hoisted static nodes
    if (patchFlag !== PatchFlags.HOISTED) {
      // props
      if (props !== null) {
        if (
          patchFlag & PatchFlags.FULL_PROPS ||
          patchFlag & PatchFlags.HYDRATE_EVENTS
        ) {
          for (const key in props) {
            if (!isReservedProp(key) && isOn(key)) {
              patchProp(el, key, props[key], null)
            }
          }
        } else if (props.onClick != null) {
          // Fast path for click listeners (which is most often) to avoid
          // iterating through props.
          patchProp(el, 'onClick', props.onClick, null)
        }
        // vnode hooks
        const { onVnodeBeforeMount, onVnodeMounted } = props
        if (onVnodeBeforeMount != null) {
          invokeDirectiveHook(onVnodeBeforeMount, parentComponent, vnode)
        }
        if (onVnodeMounted != null) {
          queuePostFlushCb(() => {
            invokeDirectiveHook(onVnodeMounted, parentComponent, vnode)
          })
        }
      }
      // children
      if (
        vnode.shapeFlag & ShapeFlags.ARRAY_CHILDREN &&
        // skip if element has innerHTML / textContent
        !(props !== null && (props.innerHTML || props.textContent))
      ) {
        hydrateChildren(
          el.firstChild,
          vnode,
          parentComponent,
          optimized || vnode.dynamicChildren !== null
        )
      }
    }
    return el.nextSibling
  }

  const hydrateChildren = (
    node: Node | null,
    vnode: VNode,
    parentComponent: ComponentInternalInstance | null,
    optimized: boolean
  ): Node | null => {
    const children = vnode.children as VNode[]
    optimized = optimized || vnode.dynamicChildren !== null
    for (let i = 0; node != null && i < children.length; i++) {
      const vnode = optimized
        ? children[i]
        : (children[i] = normalizeVNode(children[i]))
      node = hydrateNode(node, vnode, parentComponent, optimized)
    }
    return node
  }

  const hydrateFragment = (
    node: Node,
    vnode: VNode,
    parentComponent: ComponentInternalInstance | null,
    optimized: boolean
  ) => {
    const parent = node.parentNode!
    parent.insertBefore((vnode.el = createText('')), node)
    const next = hydrateChildren(node, vnode, parentComponent, optimized)
    parent.insertBefore((vnode.anchor = createText('')), next)
    return next
  }

  const hydratePortal = (
    vnode: VNode,
    parentComponent: ComponentInternalInstance | null,
    optimized: boolean
  ) => {
    const targetSelector = vnode.props && vnode.props.target
    const target = (vnode.target = isString(targetSelector)
      ? document.querySelector(targetSelector)
      : targetSelector)
    if (target != null && vnode.shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      hydrateChildren(target.firstChild, vnode, parentComponent, optimized)
    }
  }

  return [hydrate, hydrateNode] as const
}
