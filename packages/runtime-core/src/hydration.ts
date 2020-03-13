import { VNode, normalizeVNode, Text, Comment, Static, Fragment } from './vnode'
import { flushPostFlushCbs } from './scheduler'
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
import {
  SuspenseImpl,
  SuspenseBoundary,
  queueEffectWithSuspense
} from './components/Suspense'

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

const isSVGContainer = (container: Element) =>
  /svg/.test(container.namespaceURI!) && container.tagName !== 'foreignObject'

const isComment = (node: Node): node is Comment =>
  node.nodeType === DOMNodeTypes.COMMENT

// Note: hydration is DOM-specific
// But we have to place it in core due to tight coupling with core - splitting
// it out creates a ton of unnecessary complexity.
// Hydration also depends on some renderer internal logic which needs to be
// passed in via arguments.
export function createHydrationFunctions(
  rendererInternals: RendererInternals<Node, Element>
) {
  const {
    mt: mountComponent,
    p: patch,
    n: next,
    o: { patchProp, nextSibling, parentNode }
  } = rendererInternals

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
    hydrateNode(container.firstChild!, vnode, null, null)
    flushPostFlushCbs()
    if (hasMismatch && !__TEST__) {
      // this error should show up in production
      console.error(`Hydration completed but contains mismatches.`)
    }
  }

  const hydrateNode = (
    node: Node,
    vnode: VNode,
    parentComponent: ComponentInternalInstance | null,
    parentSuspense: SuspenseBoundary | null,
    optimized = false
  ): Node | null => {
    const isFragmentStart = isComment(node) && node.data === '1'
    if (__DEV__ && isFragmentStart) {
      // in dev mode, replace comment anchors with invisible text nodes
      // for easier debugging
      node = replaceAnchor(node, parentNode(node)!)
    }

    const { type, shapeFlag } = vnode
    const domType = node.nodeType
    vnode.el = node

    switch (type) {
      case Text:
        if (domType !== DOMNodeTypes.TEXT) {
          return handleMismtach(node, vnode, parentComponent, parentSuspense)
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
        return nextSibling(node)
      case Comment:
        if (domType !== DOMNodeTypes.COMMENT) {
          return handleMismtach(node, vnode, parentComponent, parentSuspense)
        }
        return nextSibling(node)
      case Static:
        if (domType !== DOMNodeTypes.ELEMENT) {
          return handleMismtach(node, vnode, parentComponent, parentSuspense)
        }
        return nextSibling(node)
      case Fragment:
        if (domType !== (__DEV__ ? DOMNodeTypes.TEXT : DOMNodeTypes.COMMENT)) {
          return handleMismtach(node, vnode, parentComponent, parentSuspense)
        }
        return hydrateFragment(
          node as Comment,
          vnode,
          parentComponent,
          parentSuspense,
          optimized
        )
      default:
        if (shapeFlag & ShapeFlags.ELEMENT) {
          if (
            domType !== DOMNodeTypes.ELEMENT ||
            vnode.type !== (node as Element).tagName.toLowerCase()
          ) {
            return handleMismtach(node, vnode, parentComponent, parentSuspense)
          }
          return hydrateElement(
            node as Element,
            vnode,
            parentComponent,
            parentSuspense,
            optimized
          )
        } else if (shapeFlag & ShapeFlags.COMPONENT) {
          // when setting up the render effect, if the initial vnode already
          // has .el set, the component will perform hydration instead of mount
          // on its sub-tree.
          const container = parentNode(node)!
          mountComponent(
            vnode,
            container,
            null,
            parentComponent,
            parentSuspense,
            isSVGContainer(container)
          )
          const subTree = vnode.component!.subTree
          if (subTree) {
            return next(subTree)
          } else {
            // no subTree means this is an async component
            // try to locate the ending node
            return isFragmentStart
              ? locateClosingAsyncAnchor(node)
              : nextSibling(node)
          }
        } else if (shapeFlag & ShapeFlags.PORTAL) {
          if (domType !== DOMNodeTypes.COMMENT) {
            return handleMismtach(node, vnode, parentComponent, parentSuspense)
          }
          hydratePortal(vnode, parentComponent, parentSuspense, optimized)
          return nextSibling(node)
        } else if (__FEATURE_SUSPENSE__ && shapeFlag & ShapeFlags.SUSPENSE) {
          return (vnode.type as typeof SuspenseImpl).hydrate(
            node,
            vnode,
            parentComponent,
            parentSuspense,
            isSVGContainer(parentNode(node)!),
            optimized,
            rendererInternals,
            hydrateNode
          )
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
    parentSuspense: SuspenseBoundary | null,
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
              patchProp(el, key, null, props[key])
            }
          }
        } else if (props.onClick != null) {
          // Fast path for click listeners (which is most often) to avoid
          // iterating through props.
          patchProp(el, 'onClick', null, props.onClick)
        }
        // vnode hooks
        const { onVnodeBeforeMount, onVnodeMounted } = props
        if (onVnodeBeforeMount != null) {
          invokeDirectiveHook(onVnodeBeforeMount, parentComponent, vnode)
        }
        if (onVnodeMounted != null) {
          queueEffectWithSuspense(() => {
            invokeDirectiveHook(onVnodeMounted, parentComponent, vnode)
          }, parentSuspense)
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
          parentSuspense,
          optimized
        )
        let hasWarned = false
        while (next) {
          hasMismatch = true
          if (__DEV__ && !hasWarned) {
            warn(
              `Hydration children mismatch in <${vnode.type as string}>: ` +
                `server rendered element contains more child nodes than client vdom.`
            )
            hasWarned = true
          }
          // The SSRed DOM contains more nodes than it should. Remove them.
          const cur = next
          next = next.nextSibling
          el.removeChild(cur)
        }
      } else if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
        if (el.textContent !== vnode.children) {
          hasMismatch = true
          __DEV__ &&
            warn(
              `Hydration text content mismatch in <${vnode.type as string}>:\n` +
                `- Client: ${el.textContent}\n` +
                `- Server: ${vnode.children as string}`
            )
          el.textContent = vnode.children as string
        }
      }
    }
    return el.nextSibling
  }

  const hydrateChildren = (
    node: Node | null,
    vnode: VNode,
    container: Element,
    parentComponent: ComponentInternalInstance | null,
    parentSuspense: SuspenseBoundary | null,
    optimized: boolean
  ): Node | null => {
    optimized = optimized || vnode.dynamicChildren !== null
    const children = vnode.children as VNode[]
    const l = children.length
    let hasWarned = false
    for (let i = 0; i < l; i++) {
      const vnode = optimized
        ? children[i]
        : (children[i] = normalizeVNode(children[i]))
      if (node) {
        node = hydrateNode(
          node,
          vnode,
          parentComponent,
          parentSuspense,
          optimized
        )
      } else {
        hasMismatch = true
        if (__DEV__ && !hasWarned) {
          warn(
            `Hydration children mismatch in <${container.tagName.toLowerCase()}>: ` +
              `server rendered element contains fewer child nodes than client vdom.`
          )
          hasWarned = true
        }
        // the SSRed DOM didn't contain enough nodes. Mount the missing ones.
        patch(
          null,
          vnode,
          container,
          null,
          parentComponent,
          parentSuspense,
          isSVGContainer(container)
        )
      }
    }
    return node
  }

  const hydrateFragment = (
    node: Comment,
    vnode: VNode,
    parentComponent: ComponentInternalInstance | null,
    parentSuspense: SuspenseBoundary | null,
    optimized: boolean
  ) => {
    const container = parentNode(node)!
    let next = hydrateChildren(
      nextSibling(node)!,
      vnode,
      container,
      parentComponent,
      parentSuspense,
      optimized
    )!
    if (__DEV__) {
      next = replaceAnchor(next, container)
    }
    return nextSibling((vnode.anchor = next))
  }

  const hydratePortal = (
    vnode: VNode,
    parentComponent: ComponentInternalInstance | null,
    parentSuspense: SuspenseBoundary | null,
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
        parentSuspense,
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
    parentComponent: ComponentInternalInstance | null,
    parentSuspense: SuspenseBoundary | null
  ) => {
    hasMismatch = true
    __DEV__ &&
      warn(
        `Hydration node mismatch:\n- Client vnode:`,
        vnode.type,
        `\n- Server rendered DOM:`,
        node,
        node.nodeType === DOMNodeTypes.TEXT ? `(text)` : ``
      )
    vnode.el = null
    const next = nextSibling(node)
    const container = parentNode(node)!
    container.removeChild(node)
    patch(
      null,
      vnode,
      container,
      next,
      parentComponent,
      parentSuspense,
      isSVGContainer(container)
    )
    return next
  }

  const locateClosingAsyncAnchor = (node: Node | null): Node | null => {
    let match = 0
    while (node) {
      node = nextSibling(node)
      if (node && isComment(node)) {
        if (node.data === '1') match++
        if (node.data === '0') {
          if (match === 0) {
            return nextSibling(node)
          } else {
            match--
          }
        }
      }
    }
    return node
  }

  const replaceAnchor = (node: Node, parent: Element): Node => {
    const text = document.createTextNode('')
    parent.insertBefore(text, node)
    parent.removeChild(node)
    return text
  }

  return [hydrate, hydrateNode] as const
}
