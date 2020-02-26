import { ComponentInternalInstance } from '../component'
import { SuspenseBoundary } from './Suspense'
import { RendererInternals, MoveType } from '../renderer'
import { VNode, VNodeArrayChildren, VNodeProps } from '../vnode'
import { isString, ShapeFlags, PatchFlags } from '@vue/shared'
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
    container: object,
    anchor: object | null,
    parentComponent: ComponentInternalInstance | null,
    parentSuspense: SuspenseBoundary | null,
    isSVG: boolean,
    optimized: boolean,
    {
      mc: mountChildren,
      pc: patchChildren,
      pbc: patchBlockChildren,
      m: move,
      o: { insert, querySelector, setElementText, createComment }
    }: RendererInternals
  ) {
    const targetSelector = n2.props && n2.props.target
    const { patchFlag, shapeFlag, children } = n2
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
      if (target != null) {
        if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
          setElementText(target, children as string)
        } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          mountChildren(
            children as VNodeArrayChildren,
            target,
            null,
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
      n2.el = n1.el
      // update content
      const target = (n2.target = n1.target)!
      if (patchFlag === PatchFlags.TEXT) {
        setElementText(target, children as string)
      } else if (n2.dynamicChildren) {
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
          null,
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
        if (nextTarget != null) {
          // move content
          if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
            setElementText(target, '')
            setElementText(nextTarget, children as string)
          } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
            for (let i = 0; i < (children as VNode[]).length; i++) {
              move((children as VNode[])[i], nextTarget, null, MoveType.REORDER)
            }
          }
        } else if (__DEV__) {
          warn('Invalid Portal target on update:', target, `(${typeof target})`)
        }
      }
    }
  }
}

// Force-casted public typing for h and TSX props inference
export const Portal = (PortalImpl as any) as {
  __isPortal: true
  new (): { $props: VNodeProps & PortalProps }
}
