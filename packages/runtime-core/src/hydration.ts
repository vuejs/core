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

const enum DOMNodeTypes {
  ELEMENT = 1,
  TEXT = 3,
  COMMENT = 8
}

let hasMismatch = false

// Note: hydration is DOM-specific
// But we have to place it in core due to tight coupling with core - splitting
// it out creates a ton of unnecessary complexity.
// Hydration also depends on some renderer internal logic which needs to be
// passed in via arguments.
export function createHydrationFunctions({
  mt: mountComponent,
  p: patch,
  o: { patchProp, createText }
}: RendererInternals<Node, Element>) {
  const hydrate: RootHydrateFunction = (vnode, container) => {
    if (__DEV__ && !container.hasChildNodes()) {
      warn(
        `Attempting to hydrate existing markup but container is empty. ` +
          `Performing full mount instead.`
      )
      patch(null, vnode, container)
      return
    }
    hasMismatch = false
    hydrateNode(container.firstChild!, vnode)
    flushPostFlushCbs()
    if (hasMismatch && !__TEST__) {
      // this error should show up in production
      console.error(`Hydration completed but contains mismatches.`)
    }
  }

  const hydrateNode = (
    node: Node,
    vnode: VNode,
    parentComponent: ComponentInternalInstance | null = null,
    optimized = false
  ): Node | null => {
    const { type, shapeFlag } = vnode
    const domType = node.nodeType

    vnode.el = node

    switch (type) {
      case Text:
        if (domType !== DOMNodeTypes.TEXT) {
          return handleMismtach(node, vnode, parentComponent)
        }
        if ((node as Text).data !== vnode.children) {
          hasMismatch = true
          __DEV__ &&
            warn(
              `Hydration text mismatch:` +
                `\n- Client: ${JSON.stringify(vnode.children)}`,
              `\n- Server: ${JSON.stringify((node as Text).data)}`
            )
          ;(node as Text).data = vnode.children as string
        }
        return node.nextSibling
      case Comment:
        if (domType !== DOMNodeTypes.COMMENT) {
          return handleMismtach(node, vnode, parentComponent)
        }
        return node.nextSibling
      case Static:
        if (domType !== DOMNodeTypes.ELEMENT) {
          return handleMismtach(node, vnode, parentComponent)
        }
        return node.nextSibling
      case Fragment:
        return hydrateFragment(node, vnode, parentComponent, optimized)
      default:
        if (shapeFlag & ShapeFlags.ELEMENT) {
          if (domType !== DOMNodeTypes.ELEMENT) {
            return handleMismtach(node, vnode, parentComponent)
          }
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
          if (domType !== DOMNodeTypes.COMMENT) {
            return handleMismtach(node, vnode, parentComponent)
          }
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
    optimized = optimized || vnode.dynamicChildren !== null
    const { props, patchFlag, shapeFlag } = vnode
    // skip props & children if this is hoisted static nodes
    if (patchFlag !== PatchFlags.HOISTED) {
      // props
      if (props !== null) {
        if (
          !optimized ||
          (patchFlag & PatchFlags.FULL_PROPS ||
            patchFlag & PatchFlags.HYDRATE_EVENTS)
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
        shapeFlag & ShapeFlags.ARRAY_CHILDREN &&
        // skip if element has innerHTML / textContent
        !(props !== null && (props.innerHTML || props.textContent))
      ) {
        let next = hydrateChildren(
          el.firstChild,
          vnode,
          el,
          parentComponent,
          optimized
        )
        while (next) {
          hasMismatch = true
          __DEV__ &&
            warn(
              `Hydration children mismatch: ` +
                `server rendered element contains more child nodes than client vdom.`
            )
          // The SSRed DOM contains more nodes than it should. Remove them.
          const cur = next
          next = next.nextSibling
          el.removeChild(cur)
        }
      } else if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
        el.textContent = vnode.children as string
      }
    }
    return el.nextSibling
  }

  const hydrateChildren = (
    node: Node | null,
    vnode: VNode,
    container: Element,
    parentComponent: ComponentInternalInstance | null,
    optimized: boolean
  ): Node | null => {
    optimized = optimized || vnode.dynamicChildren !== null
    const children = vnode.children as VNode[]
    const l = children.length
    for (let i = 0; i < l; i++) {
      const vnode = optimized
        ? children[i]
        : (children[i] = normalizeVNode(children[i]))
      if (node) {
        node = hydrateNode(node, vnode, parentComponent, optimized)
      } else {
        hasMismatch = true
        __DEV__ &&
          warn(
            `Hydration children mismatch: ` +
              `server rendered element contains fewer child nodes than client vdom.`
          )
        // the SSRed DOM didn't contain enough nodes. Mount the missing ones.
        patch(null, vnode, container)
      }
    }
    return node
  }

  const hydrateFragment = (
    node: Node,
    vnode: VNode,
    parentComponent: ComponentInternalInstance | null,
    optimized: boolean
  ) => {
    const parent = node.parentNode as Element
    parent.insertBefore((vnode.el = createText('')), node)
    const next = hydrateChildren(
      node,
      vnode,
      parent,
      parentComponent,
      optimized
    )
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
      hydrateChildren(
        target.firstChild,
        vnode,
        target,
        parentComponent,
        optimized
      )
    } else if (__DEV__) {
      warn(
        `Attempting to hydrate portal but target ${targetSelector} does not ` +
          `exist in server-rendered markup.`
      )
    }
  }

  const handleMismtach = (
    node: Node,
    vnode: VNode,
    parentComponent: ComponentInternalInstance | null
  ) => {
    hasMismatch = true
    __DEV__ &&
      warn(
        `Hydration node mismatch:\n- Client vnode:`,
        vnode.type,
        `\n- Server rendered DOM:`,
        node
      )
    vnode.el = null
    const next = node.nextSibling
    const container = node.parentNode as Element
    container.removeChild(node)
    // TODO Suspense and SVG
    patch(null, vnode, container, next, parentComponent)
    return next
  }

  return [hydrate, hydrateNode] as const
}
