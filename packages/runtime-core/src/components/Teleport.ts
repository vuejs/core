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

export type TeleportVNode = VNode<RendererNode, RendererElement, TeleportProps>

export interface TeleportProps {
  to: string | RendererElement | null | undefined
  disabled?: boolean
}

export const isTeleport = (type: any): boolean => type.__isTeleport

const isTeleportDisabled = (props: VNode['props']): boolean =>
  props && (props.disabled || props.disabled === '')

const resolveTarget = <T = RendererElement>(
  props: TeleportProps | null,
  select: RendererOptions['querySelector']
): T | null => {
  const targetSelector = props && props.to
  if (isString(targetSelector)) {
    if (!select) {
      __DEV__ &&
        warn(
          `Current renderer does not support string target for Teleports. ` +
            `(missing querySelector renderer option)`
        )
      return null
    } else {
      const target = select(targetSelector)
      if (!target) {
        __DEV__ &&
          warn(
            `Failed to locate Teleport target with selector "${targetSelector}". ` +
              `Note the target element must exist before the component is mounted - ` +
              `i.e. the target cannot be rendered by the component itself, and ` +
              `ideally should be outside of the entire Vue component tree.`
          )
      }
      return target as any
    }
  } else {
    if (__DEV__ && !targetSelector && !isTeleportDisabled(props)) {
      warn(`Invalid Teleport target: ${targetSelector}`)
    }
    return targetSelector as any
  }
}

export const TeleportImpl = {
  __isTeleport: true,
  process(
    n1: TeleportVNode | null,
    n2: TeleportVNode,
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

    const disabled = isTeleportDisabled(n2.props)
    const { shapeFlag, children } = n2
    if (n1 == null) {
      // insert anchors in the main view
      const placeholder = (n2.el = __DEV__
        ? createComment('teleport start')
        : createText(''))
      const mainAnchor = (n2.anchor = __DEV__
        ? createComment('teleport end')
        : createText(''))
      insert(placeholder, container, anchor)
      insert(mainAnchor, container, anchor)

      const target = (n2.target = resolveTarget(n2.props, querySelector))
      const targetAnchor = (n2.targetAnchor = createText(''))
      if (target) {
        insert(targetAnchor, target)
      } else if (__DEV__ && !disabled) {
        warn('Invalid Teleport target on mount:', target, `(${typeof target})`)
      }

      const mount = (container: RendererElement, anchor: RendererNode) => {
        // Teleport *always* has Array children. This is enforced in both the
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
      const wasDisabled = isTeleportDisabled(n1.props)
      const currentContainer = wasDisabled ? container : target
      const currentAnchor = wasDisabled ? mainAnchor : targetAnchor

      if (n2.dynamicChildren) {
        // fast patch when the teleport happens to be a block root
        patchBlockChildren(
          n1.dynamicChildren!,
          n2.dynamicChildren,
          currentContainer,
          parentComponent,
          parentSuspense,
          isSVG
        )
        // even in block tree mode we need to make sure all root-level nodes
        // in the teleport inherit previous DOM references so that they can
        // be moved in future patches.
        if (n2.shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          const oldChildren = n1.children as VNode[]
          const children = n2.children as VNode[]
          // #2324
          if (n2.dynamicChildren.length) {
            for (let i = 0; i < children.length; i++) {
              // only inherit for non-patched nodes (i.e. static ones)
              if (!children[i].el) {
                children[i].el = oldChildren[i].el
              }
            }
          } else {
            for (let i = 0; i < children.length; i++) {
              children[i].el = oldChildren[i].el
            }
          }
        }
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
          moveTeleport(
            n2,
            container,
            mainAnchor,
            internals,
            TeleportMoveTypes.TOGGLE
          )
        }
      } else {
        // target changed
        if ((n2.props && n2.props.to) !== (n1.props && n1.props.to)) {
          const nextTarget = (n2.target = resolveTarget(
            n2.props,
            querySelector
          ))
          if (nextTarget) {
            moveTeleport(
              n2,
              nextTarget,
              null,
              internals,
              TeleportMoveTypes.TARGET_CHANGE
            )
          } else if (__DEV__) {
            warn(
              'Invalid Teleport target on update:',
              target,
              `(${typeof target})`
            )
          }
        } else if (wasDisabled) {
          // disabled -> enabled
          // move into teleport target
          moveTeleport(
            n2,
            target,
            targetAnchor,
            internals,
            TeleportMoveTypes.TOGGLE
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

  move: moveTeleport,
  hydrate: hydrateTeleport
}

export const enum TeleportMoveTypes {
  TARGET_CHANGE,
  TOGGLE, // enable / disable
  REORDER // moved in the main view
}

function moveTeleport(
  vnode: VNode,
  container: RendererElement,
  parentAnchor: RendererNode | null,
  { o: { insert }, m: move }: RendererInternals,
  moveType: TeleportMoveTypes = TeleportMoveTypes.REORDER
) {
  // move target anchor if this is a target change.
  if (moveType === TeleportMoveTypes.TARGET_CHANGE) {
    insert(vnode.targetAnchor!, container, parentAnchor)
  }
  const { el, anchor, shapeFlag, children, props } = vnode
  const isReorder = moveType === TeleportMoveTypes.REORDER
  // move main view anchor if this is a re-order.
  if (isReorder) {
    insert(el!, container, parentAnchor)
  }
  // if this is a re-order and teleport is enabled (content is in target)
  // do not move children. So the opposite is: only move children if this
  // is not a reorder, or the teleport is disabled
  if (!isReorder || isTeleportDisabled(props)) {
    // Teleport has either Array children or no children.
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

interface TeleportTargetElement extends Element {
  // last teleport target
  _lpa?: Node | null
}

function hydrateTeleport(
  node: Node,
  vnode: TeleportVNode,
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
    vnode.props,
    querySelector
  ))
  if (target) {
    // if multiple teleports rendered to the same target element, we need to
    // pick up from where the last teleport finished instead of the first node
    const targetNode =
      (target as TeleportTargetElement)._lpa || target.firstChild
    if (vnode.shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      if (isTeleportDisabled(vnode.props)) {
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
      ;(target as TeleportTargetElement)._lpa =
        vnode.targetAnchor && nextSibling(vnode.targetAnchor as Node)
    }
  }
  return vnode.anchor && nextSibling(vnode.anchor as Node)
}

// Force-casted public typing for h and TSX props inference
export const Teleport = (TeleportImpl as any) as {
  __isTeleport: true
  new (): { $props: VNodeProps & TeleportProps }
}
