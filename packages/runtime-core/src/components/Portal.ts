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

export const isPortal = (type: any): boolean => type.__isPortal

export interface PortalProps {
  target: string | object
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
    {
      mc: mountChildren,
      pc: patchChildren,
      pbc: patchBlockChildren,
      m: move,
      o: { insert, querySelector, createText, createComment }
    }: RendererInternals
  ) {
    const targetSelector = n2.props && n2.props.target
    const { shapeFlag, children } = n2
    if (n1 == null) {
      // insert an empty node as the placeholder for the portal
      insert((n2.el = createComment(`portal`)), container, anchor)
      if (__DEV__ && isString(targetSelector) && !querySelector) {
        warn(
          `Current renderer does not support string target for Portals. ` +
            `(missing querySelector renderer option)`
        )
      }
      const target = (n2.target = isString(targetSelector)
        ? querySelector!(targetSelector)
        : targetSelector)
      // portal content needs an anchor to support patching multiple portals
      // appending to the same target element.
      const portalAnchor = (n2.anchor = createText(''))
      if (target) {
        insert(portalAnchor, target)
        // Portal *always* has Array children. This is enforced in both the
        // compiler and vnode children normalization.
        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          mountChildren(
            children as VNodeArrayChildren,
            target,
            portalAnchor,
            parentComponent,
            parentSuspense,
            isSVG,
            optimized
          )
        }
      } else if (__DEV__) {
        warn('Invalid Portal target on mount:', target, `(${typeof target})`)
      }
    } else {
      // update content
      n2.el = n1.el
      const target = (n2.target = n1.target)!
      const portalAnchor = (n2.anchor = n1.anchor)!
      if (n2.dynamicChildren) {
        // fast path when the portal happens to be a block root
        patchBlockChildren(
          n1.dynamicChildren!,
          n2.dynamicChildren,
          container,
          parentComponent,
          parentSuspense,
          isSVG
        )
      } else if (!optimized) {
        patchChildren(
          n1,
          n2,
          target,
          portalAnchor,
          parentComponent,
          parentSuspense,
          isSVG
        )
      }

      // target changed
      if (targetSelector !== (n1.props && n1.props.target)) {
        const nextTarget = (n2.target = isString(targetSelector)
          ? querySelector!(targetSelector)
          : targetSelector)
        if (nextTarget) {
          movePortal(n2, nextTarget, null, insert, move)
        } else if (__DEV__) {
          warn('Invalid Portal target on update:', target, `(${typeof target})`)
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
  }
}

const movePortal = (
  vnode: VNode,
  nextTarget: RendererElement,
  anchor: RendererNode | null,
  insert: RendererOptions['insert'],
  move: RendererInternals['m']
) => {
  const { anchor: portalAnchor, shapeFlag, children } = vnode
  // move content.
  // Portal has either Array children or no children.
  insert(portalAnchor!, nextTarget, anchor)
  if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
    for (let i = 0; i < (children as VNode[]).length; i++) {
      move((children as VNode[])[i], nextTarget, portalAnchor, MoveType.REORDER)
    }
  }
}

// Force-casted public typing for h and TSX props inference
export const Portal = (PortalImpl as any) as {
  __isPortal: true
  new (): { $props: VNodeProps & PortalProps }
}
