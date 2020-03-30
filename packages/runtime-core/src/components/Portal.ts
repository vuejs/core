import { ComponentInternalInstance } from '../component'
import { SuspenseBoundary } from './Suspense'
import {
  RendererInternals,
  MoveType,
  RendererElement,
  RendererNode,
  RendererOptions
} from '../renderer'
import { VNode, VNodeArrayChildren, VNodeProps } from '../vnode'
import { isString, ShapeFlags } from '@vue/shared'
import { warn } from '../warning'

export interface PortalProps {
  target: string | RendererElement
  disabled?: boolean
}

export const isPortal = (type: any): boolean => type.__isPortal

const isPortalDisabled = (props: VNode['props']): boolean =>
  props && (props.disabled || props.disabled === '')

const resolveTarget = <T = RendererElement>(
  props: PortalProps | null,
  select: RendererOptions['querySelector']
): T | null => {
  const targetSelector = props && props.target
  if (isString(targetSelector)) {
    if (!select) {
      __DEV__ &&
        warn(
          `Current renderer does not support string target for Portals. ` +
            `(missing querySelector renderer option)`
        )
      return null
    } else {
      const target = select(targetSelector)
      if (!target) {
        __DEV__ &&
          warn(
            `Failed to locate Portal target with selector "${targetSelector}".`
          )
      }
      return target as any
    }
  } else {
    if (__DEV__ && !targetSelector) {
      warn(`Invalid Portal target: ${targetSelector}`)
    }
    return targetSelector as any
  }
}

export const PortalImpl = {
  __isPortal: true,
  process(
    n1: VNode | null,
    n2: VNode,
    container: RendererElement,
    anchor: RendererNode | null,
    parentComponent: ComponentInternalInstance | null,
    parentSuspense: SuspenseBoundary | null,
    isSVG: boolean,
    optimized: boolean,
    internals: RendererInternals
  ) {
    const {
      mc: mountChildren,
      pc: patchChildren,
      pbc: patchBlockChildren,
      o: { insert, querySelector, createText, createComment }
    } = internals

    const disabled = isPortalDisabled(n2.props)
    const { shapeFlag, children } = n2
    if (n1 == null) {
      // insert anchors in the main view
      const placeholder = (n2.el = __DEV__
        ? createComment('portal start')
        : createText(''))
      const mainAnchor = (n2.anchor = __DEV__
        ? createComment('portal end')
        : createText(''))
      insert(placeholder, container, anchor)
      insert(mainAnchor, container, anchor)

      const target = (n2.target = resolveTarget(
        n2.props as PortalProps,
        querySelector
      ))
      const targetAnchor = (n2.targetAnchor = createText(''))
      if (target) {
        insert(targetAnchor, target)
      } else if (__DEV__) {
        warn('Invalid Portal target on mount:', target, `(${typeof target})`)
      }

      const mount = (container: RendererElement, anchor: RendererNode) => {
        // Portal *always* has Array children. This is enforced in both the
        // compiler and vnode children normalization.
        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          mountChildren(
            children as VNodeArrayChildren,
            container,
            anchor,
            parentComponent,
            parentSuspense,
            isSVG,
            optimized
          )
        }
      }

      if (disabled) {
        mount(container, mainAnchor)
      } else if (target) {
        mount(target, targetAnchor)
      }
    } else {
      // update content
      n2.el = n1.el
      const mainAnchor = (n2.anchor = n1.anchor)!
      const target = (n2.target = n1.target)!
      const targetAnchor = (n2.targetAnchor = n1.targetAnchor)!
      const wasDisabled = isPortalDisabled(n1.props)
      const currentContainer = wasDisabled ? container : target
      const currentAnchor = wasDisabled ? mainAnchor : targetAnchor

      if (n2.dynamicChildren) {
        // fast path when the portal happens to be a block root
        patchBlockChildren(
          n1.dynamicChildren!,
          n2.dynamicChildren,
          currentContainer,
          parentComponent,
          parentSuspense,
          isSVG
        )
      } else if (!optimized) {
        patchChildren(
          n1,
          n2,
          currentContainer,
          currentAnchor,
          parentComponent,
          parentSuspense,
          isSVG
        )
      }

      if (disabled) {
        if (!wasDisabled) {
          // enabled -> disabled
          // move into main container
          movePortal(
            n2,
            container,
            mainAnchor,
            internals,
            PortalMoveTypes.TOGGLE
          )
        }
      } else {
        // target changed
        if ((n2.props && n2.props.target) !== (n1.props && n1.props.target)) {
          const nextTarget = (n2.target = resolveTarget(
            n2.props as PortalProps,
            querySelector
          ))
          if (nextTarget) {
            movePortal(
              n2,
              nextTarget,
              null,
              internals,
              PortalMoveTypes.TARGET_CHANGE
            )
          } else if (__DEV__) {
            warn(
              'Invalid Portal target on update:',
              target,
              `(${typeof target})`
            )
          }
        } else if (wasDisabled) {
          // disabled -> enabled
          // move into portal target
          movePortal(
            n2,
            target,
            targetAnchor,
            internals,
            PortalMoveTypes.TOGGLE
          )
        }
      }
    }
  },

  remove(
    vnode: VNode,
    { r: remove, o: { remove: hostRemove } }: RendererInternals
  ) {
    const { shapeFlag, children, anchor } = vnode
    hostRemove(anchor!)
    if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      for (let i = 0; i < (children as VNode[]).length; i++) {
        remove((children as VNode[])[i])
      }
    }
  },

  move: movePortal,
  hydrate: hydratePortal
}

export const enum PortalMoveTypes {
  TARGET_CHANGE,
  TOGGLE, // enable / disable
  REORDER // moved in the main view
}

function movePortal(
  vnode: VNode,
  container: RendererElement,
  parentAnchor: RendererNode | null,
  { o: { insert }, m: move }: RendererInternals,
  moveType: PortalMoveTypes = PortalMoveTypes.REORDER
) {
  // move target anchor if this is a target change.
  if (moveType === PortalMoveTypes.TARGET_CHANGE) {
    insert(vnode.targetAnchor!, container, parentAnchor)
  }
  const { el, anchor, shapeFlag, children, props } = vnode
  const isReorder = moveType === PortalMoveTypes.REORDER
  // move main view anchor if this is a re-order.
  if (isReorder) {
    insert(el!, container, parentAnchor)
  }
  // if this is a re-order and portal is enabled (content is in target)
  // do not move children. So the opposite is: only move children if this
  // is not a reorder, or the portal is disabled
  if (!isReorder || isPortalDisabled(props)) {
    // Portal has either Array children or no children.
    if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      for (let i = 0; i < (children as VNode[]).length; i++) {
        move(
          (children as VNode[])[i],
          container,
          parentAnchor,
          MoveType.REORDER
        )
      }
    }
  }
  // move main view anchor if this is a re-order.
  if (isReorder) {
    insert(anchor!, container, parentAnchor)
  }
}

interface PortalTargetElement extends Element {
  // last portal target
  _lpa?: Node | null
}

function hydratePortal(
  node: Node,
  vnode: VNode,
  parentComponent: ComponentInternalInstance | null,
  parentSuspense: SuspenseBoundary | null,
  optimized: boolean,
  {
    o: { nextSibling, parentNode, querySelector }
  }: RendererInternals<Node, Element>,
  hydrateChildren: (
    node: Node | null,
    vnode: VNode,
    container: Element,
    parentComponent: ComponentInternalInstance | null,
    parentSuspense: SuspenseBoundary | null,
    optimized: boolean
  ) => Node | null
): Node | null {
  const target = (vnode.target = resolveTarget<Element>(
    vnode.props as PortalProps,
    querySelector
  ))
  if (target) {
    // if multiple portals rendered to the same target element, we need to
    // pick up from where the last portal finished instead of the first node
    const targetNode = (target as PortalTargetElement)._lpa || target.firstChild
    if (vnode.shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      if (isPortalDisabled(vnode.props)) {
        vnode.anchor = hydrateChildren(
          nextSibling(node),
          vnode,
          parentNode(node)!,
          parentComponent,
          parentSuspense,
          optimized
        )
        vnode.targetAnchor = targetNode
      } else {
        vnode.anchor = nextSibling(node)
        vnode.targetAnchor = hydrateChildren(
          targetNode,
          vnode,
          target,
          parentComponent,
          parentSuspense,
          optimized
        )
      }
      ;(target as PortalTargetElement)._lpa = nextSibling(
        vnode.targetAnchor as Node
      )
    }
  }
  return vnode.anchor && nextSibling(vnode.anchor as Node)
}

// Force-casted public typing for h and TSX props inference
export const Portal = (PortalImpl as any) as {
  __isPortal: true
  new (): { $props: VNodeProps & PortalProps }
}
