import { ComponentInternalInstance } from '../component'
import { SuspenseBoundary } from './Suspense'
import {
  RendererInternals,
  MoveType,
  RendererElement,
  RendererNode
} from '../renderer'
import { VNode, VNodeArrayChildren, VNodeProps } from '../vnode'
import { isString, ShapeFlags } from '@vue/shared'
import { warn } from '../warning'

export const isPortal = (type: any): boolean => type.__isPortal

export interface PortalProps {
  target: string | object
  disabled?: boolean
}

export const enum PortalMoveTypes {
  TARGET_CHANGE,
  TOGGLE, // enable / disable
  REORDER // moved in the main view
}

const movePortal = (
  vnode: VNode,
  container: RendererElement,
  parentAnchor: RendererNode | null,
  { o: { insert }, m: move }: RendererInternals,
  moveType: PortalMoveTypes = PortalMoveTypes.REORDER
) => {
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
  if (!isReorder || (props && props.disabled)) {
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

    const targetSelector = n2.props && n2.props.target
    const disabled = n2.props && n2.props.disabled
    const { shapeFlag, children } = n2
    if (n1 == null) {
      if (__DEV__ && isString(targetSelector) && !querySelector) {
        warn(
          `Current renderer does not support string target for Portals. ` +
            `(missing querySelector renderer option)`
        )
      }
      // insert anchors in the main view
      const placeholder = (n2.el = __DEV__
        ? createComment('portal start')
        : createText(''))
      const mainAnchor = (n2.anchor = __DEV__
        ? createComment('portal end')
        : createText(''))
      insert(placeholder, container, anchor)
      insert(mainAnchor, container, anchor)
      // portal content needs an anchor to support patching multiple portals
      // appending to the same target element.
      const target = (n2.target = isString(targetSelector)
        ? querySelector!(targetSelector)
        : targetSelector)
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
      const wasDisabled = n1.props && n1.props.disabled
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
        if (targetSelector !== (n1.props && n1.props.target)) {
          const nextTarget = (n2.target = isString(targetSelector)
            ? querySelector!(targetSelector)
            : targetSelector)
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

  move: movePortal
}

// Force-casted public typing for h and TSX props inference
export const Portal = (PortalImpl as any) as {
  __isPortal: true
  new (): { $props: VNodeProps & PortalProps }
}
