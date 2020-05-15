import { VNode, normalizeVNode, VNodeChild, VNodeProps } from '../vnode'
import { isFunction, isArray, ShapeFlags } from '@vue/shared'
import { ComponentInternalInstance, handleSetupResult } from '../component'
import { Slots } from '../componentSlots'
import {
  RendererInternals,
  MoveType,
  SetupRenderEffectFn,
  RendererNode,
  RendererElement
} from '../renderer'
import { queuePostFlushCb, queueJob } from '../scheduler'
import { updateHOCHostEl } from '../componentRenderUtils'
import { pushWarningContext, popWarningContext } from '../warning'
import { handleError, ErrorCodes } from '../errorHandling'

export interface SuspenseProps {
  onResolve?: () => void
  onRecede?: () => void
}

export const isSuspense = (type: any): boolean => type.__isSuspense

// Suspense exposes a component-like API, and is treated like a component
// in the compiler, but internally it's a special built-in type that hooks
// directly into the renderer.
export const SuspenseImpl = {
  // In order to make Suspense tree-shakable, we need to avoid importing it
  // directly in the renderer. The renderer checks for the __isSuspense flag
  // on a vnode's type and calls the `process` method, passing in renderer
  // internals.
  __isSuspense: true,
  process(
    n1: VNode | null,
    n2: VNode,
    container: RendererElement,
    anchor: RendererNode | null,
    parentComponent: ComponentInternalInstance | null,
    parentSuspense: SuspenseBoundary | null,
    isSVG: boolean,
    optimized: boolean,
    // platform-specific impl passed from renderer
    rendererInternals: RendererInternals
  ) {
    if (n1 == null) {
      mountSuspense(
        n2,
        container,
        anchor,
        parentComponent,
        parentSuspense,
        isSVG,
        optimized,
        rendererInternals
      )
    } else {
      patchSuspense(
        n1,
        n2,
        container,
        anchor,
        parentComponent,
        isSVG,
        optimized,
        rendererInternals
      )
    }
  },
  hydrate: hydrateSuspense
}

// Force-casted public typing for h and TSX props inference
export const Suspense = ((__FEATURE_SUSPENSE__
  ? SuspenseImpl
  : null) as any) as {
  __isSuspense: true
  new (): { $props: VNodeProps & SuspenseProps }
}

function mountSuspense(
  n2: VNode,
  container: RendererElement,
  anchor: RendererNode | null,
  parentComponent: ComponentInternalInstance | null,
  parentSuspense: SuspenseBoundary | null,
  isSVG: boolean,
  optimized: boolean,
  rendererInternals: RendererInternals
) {
  const {
    p: patch,
    o: { createElement }
  } = rendererInternals
  const hiddenContainer = createElement('div')
  const suspense = (n2.suspense = createSuspenseBoundary(
    n2,
    parentSuspense,
    parentComponent,
    container,
    hiddenContainer,
    anchor,
    isSVG,
    optimized,
    rendererInternals
  ))

  // start mounting the content subtree in an off-dom container
  patch(
    null,
    suspense.subTree,
    hiddenContainer,
    null,
    parentComponent,
    suspense,
    isSVG,
    optimized
  )
  // now check if we have encountered any async deps
  if (suspense.deps > 0) {
    // mount the fallback tree
    patch(
      null,
      suspense.fallbackTree,
      container,
      anchor,
      parentComponent,
      null, // fallback tree will not have suspense context
      isSVG,
      optimized
    )
    n2.el = suspense.fallbackTree.el
  } else {
    // Suspense has no async deps. Just resolve.
    suspense.resolve()
  }
}

function patchSuspense(
  n1: VNode,
  n2: VNode,
  container: RendererElement,
  anchor: RendererNode | null,
  parentComponent: ComponentInternalInstance | null,
  isSVG: boolean,
  optimized: boolean,
  { p: patch }: RendererInternals
) {
  const suspense = (n2.suspense = n1.suspense)!
  suspense.vnode = n2
  const { content, fallback } = normalizeSuspenseChildren(n2)
  const oldSubTree = suspense.subTree
  const oldFallbackTree = suspense.fallbackTree
  if (!suspense.isResolved) {
    patch(
      oldSubTree,
      content,
      suspense.hiddenContainer,
      null,
      parentComponent,
      suspense,
      isSVG,
      optimized
    )
    if (suspense.deps > 0) {
      // still pending. patch the fallback tree.
      patch(
        oldFallbackTree,
        fallback,
        container,
        anchor,
        parentComponent,
        null, // fallback tree will not have suspense context
        isSVG,
        optimized
      )
      n2.el = fallback.el
    }
    // If deps somehow becomes 0 after the patch it means the patch caused an
    // async dep component to unmount and removed its dep. It will cause the
    // suspense to resolve and we don't need to do anything here.
  } else {
    // just normal patch inner content as a fragment
    patch(
      oldSubTree,
      content,
      container,
      anchor,
      parentComponent,
      suspense,
      isSVG,
      optimized
    )
    n2.el = content.el
  }
  suspense.subTree = content
  suspense.fallbackTree = fallback
}

export interface SuspenseBoundary {
  vnode: VNode
  parent: SuspenseBoundary | null
  parentComponent: ComponentInternalInstance | null
  isSVG: boolean
  optimized: boolean
  container: RendererElement
  hiddenContainer: RendererElement
  anchor: RendererNode | null
  subTree: VNode
  fallbackTree: VNode
  deps: number
  isHydrating: boolean
  isResolved: boolean
  isUnmounted: boolean
  effects: Function[]
  resolve(): void
  recede(): void
  move(
    container: RendererElement,
    anchor: RendererNode | null,
    type: MoveType
  ): void
  next(): RendererNode | null
  registerDep(
    instance: ComponentInternalInstance,
    setupRenderEffect: SetupRenderEffectFn
  ): void
  unmount(parentSuspense: SuspenseBoundary | null, doRemove?: boolean): void
}

let hasWarned = false

function createSuspenseBoundary(
  vnode: VNode,
  parent: SuspenseBoundary | null,
  parentComponent: ComponentInternalInstance | null,
  container: RendererElement,
  hiddenContainer: RendererElement,
  anchor: RendererNode | null,
  isSVG: boolean,
  optimized: boolean,
  rendererInternals: RendererInternals,
  isHydrating = false
): SuspenseBoundary {
  /* istanbul ignore if */
  if (__DEV__ && !__TEST__ && !hasWarned) {
    hasWarned = true
    console[console.info ? 'info' : 'log'](
      `<Suspense> is an experimental feature and its API will likely change.`
    )
  }

  const {
    p: patch,
    m: move,
    um: unmount,
    n: next,
    o: { parentNode }
  } = rendererInternals

  const getCurrentTree = () =>
    suspense.isResolved || suspense.isHydrating
      ? suspense.subTree
      : suspense.fallbackTree

  const { content, fallback } = normalizeSuspenseChildren(vnode)
  const suspense: SuspenseBoundary = {
    vnode,
    parent,
    parentComponent,
    isSVG,
    optimized,
    container,
    hiddenContainer,
    anchor,
    deps: 0,
    subTree: content,
    fallbackTree: fallback,
    isHydrating,
    isResolved: false,
    isUnmounted: false,
    effects: [],

    resolve() {
      if (__DEV__) {
        if (suspense.isResolved) {
          throw new Error(
            `resolveSuspense() is called on an already resolved suspense boundary.`
          )
        }
        if (suspense.isUnmounted) {
          throw new Error(
            `resolveSuspense() is called on an already unmounted suspense boundary.`
          )
        }
      }
      const {
        vnode,
        subTree,
        fallbackTree,
        effects,
        parentComponent,
        container
      } = suspense

      if (suspense.isHydrating) {
        suspense.isHydrating = false
      } else {
        // this is initial anchor on mount
        let { anchor } = suspense
        // unmount fallback tree
        if (fallbackTree.el) {
          // if the fallback tree was mounted, it may have been moved
          // as part of a parent suspense. get the latest anchor for insertion
          anchor = next(fallbackTree)
          unmount(fallbackTree, parentComponent, suspense, true)
        }
        // move content from off-dom container to actual container
        move(subTree, container, anchor, MoveType.ENTER)
      }

      const el = (vnode.el = subTree.el!)
      // suspense as the root node of a component...
      if (parentComponent && parentComponent.subTree === vnode) {
        parentComponent.vnode.el = el
        updateHOCHostEl(parentComponent, el)
      }
      // check if there is a pending parent suspense
      let parent = suspense.parent
      let hasUnresolvedAncestor = false
      while (parent) {
        if (!parent.isResolved) {
          // found a pending parent suspense, merge buffered post jobs
          // into that parent
          parent.effects.push(...effects)
          hasUnresolvedAncestor = true
          break
        }
        parent = parent.parent
      }
      // no pending parent suspense, flush all jobs
      if (!hasUnresolvedAncestor) {
        queuePostFlushCb(effects)
      }
      suspense.isResolved = true
      suspense.effects = []
      // invoke @resolve event
      const onResolve = vnode.props && vnode.props.onResolve
      if (isFunction(onResolve)) {
        onResolve()
      }
    },

    recede() {
      suspense.isResolved = false
      const {
        vnode,
        subTree,
        fallbackTree,
        parentComponent,
        container,
        hiddenContainer,
        isSVG,
        optimized
      } = suspense

      // move content tree back to the off-dom container
      const anchor = next(subTree)
      move(subTree, hiddenContainer, null, MoveType.LEAVE)
      // remount the fallback tree
      patch(
        null,
        fallbackTree,
        container,
        anchor,
        parentComponent,
        null, // fallback tree will not have suspense context
        isSVG,
        optimized
      )
      const el = (vnode.el = fallbackTree.el!)
      // suspense as the root node of a component...
      if (parentComponent && parentComponent.subTree === vnode) {
        parentComponent.vnode.el = el
        updateHOCHostEl(parentComponent, el)
      }

      // invoke @recede event
      const onRecede = vnode.props && vnode.props.onRecede
      if (isFunction(onRecede)) {
        onRecede()
      }
    },

    move(container, anchor, type) {
      move(getCurrentTree(), container, anchor, type)
      suspense.container = container
    },

    next() {
      return next(getCurrentTree())
    },

    registerDep(instance, setupRenderEffect) {
      // suspense is already resolved, need to recede.
      // use queueJob so it's handled synchronously after patching the current
      // suspense tree
      if (suspense.isResolved) {
        queueJob(() => {
          suspense.recede()
        })
      }

      const hydratedEl = instance.vnode.el
      suspense.deps++
      instance
        .asyncDep!.catch(err => {
          handleError(err, instance, ErrorCodes.SETUP_FUNCTION)
        })
        .then(asyncSetupResult => {
          // retry when the setup() promise resolves.
          // component may have been unmounted before resolve.
          if (instance.isUnmounted || suspense.isUnmounted) {
            return
          }
          suspense.deps--
          // retry from this component
          instance.asyncResolved = true
          const { vnode } = instance
          if (__DEV__) {
            pushWarningContext(vnode)
          }
          handleSetupResult(instance, asyncSetupResult, false)
          if (hydratedEl) {
            // vnode may have been replaced if an update happened before the
            // async dep is resolved.
            vnode.el = hydratedEl
          }
          setupRenderEffect(
            instance,
            vnode,
            // component may have been moved before resolve.
            // if this is not a hydration, instance.subTree will be the comment
            // placeholder.
            hydratedEl
              ? parentNode(hydratedEl)!
              : parentNode(instance.subTree.el!)!,
            // anchor will not be used if this is hydration, so only need to
            // consider the comment placeholder case.
            hydratedEl ? null : next(instance.subTree),
            suspense,
            isSVG,
            optimized
          )
          updateHOCHostEl(instance, vnode.el)
          if (__DEV__) {
            popWarningContext()
          }
          if (suspense.deps === 0) {
            suspense.resolve()
          }
        })
    },

    unmount(parentSuspense, doRemove) {
      suspense.isUnmounted = true
      unmount(suspense.subTree, parentComponent, parentSuspense, doRemove)
      if (!suspense.isResolved) {
        unmount(
          suspense.fallbackTree,
          parentComponent,
          parentSuspense,
          doRemove
        )
      }
    }
  }

  return suspense
}

function hydrateSuspense(
  node: Node,
  vnode: VNode,
  parentComponent: ComponentInternalInstance | null,
  parentSuspense: SuspenseBoundary | null,
  isSVG: boolean,
  optimized: boolean,
  rendererInternals: RendererInternals,
  hydrateNode: (
    node: Node,
    vnode: VNode,
    parentComponent: ComponentInternalInstance | null,
    parentSuspense: SuspenseBoundary | null,
    optimized: boolean
  ) => Node | null
): Node | null {
  const suspense = (vnode.suspense = createSuspenseBoundary(
    vnode,
    parentSuspense,
    parentComponent,
    node.parentNode!,
    document.createElement('div'),
    null,
    isSVG,
    optimized,
    rendererInternals,
    true /* hydrating */
  ))
  // there are two possible scenarios for server-rendered suspense:
  // - success: ssr content should be fully resolved
  // - failure: ssr content should be the fallback branch.
  // however, on the client we don't really know if it has failed or not
  // attempt to hydrate the DOM assuming it has succeeded, but we still
  // need to construct a suspense boundary first
  const result = hydrateNode(
    node,
    suspense.subTree,
    parentComponent,
    suspense,
    optimized
  )
  if (suspense.deps === 0) {
    suspense.resolve()
  }
  return result
}

export function normalizeSuspenseChildren(
  vnode: VNode
): {
  content: VNode
  fallback: VNode
} {
  const { shapeFlag, children } = vnode
  if (shapeFlag & ShapeFlags.SLOTS_CHILDREN) {
    const { default: d, fallback } = children as Slots
    return {
      content: normalizeVNode(isFunction(d) ? d() : d),
      fallback: normalizeVNode(isFunction(fallback) ? fallback() : fallback)
    }
  } else {
    return {
      content: normalizeVNode(children as VNodeChild),
      fallback: normalizeVNode(null)
    }
  }
}

export function queueEffectWithSuspense(
  fn: Function | Function[],
  suspense: SuspenseBoundary | null
): void {
  if (suspense && !suspense.isResolved) {
    if (isArray(fn)) {
      suspense.effects.push(...fn)
    } else {
      suspense.effects.push(fn)
    }
  } else {
    queuePostFlushCb(fn)
  }
}
