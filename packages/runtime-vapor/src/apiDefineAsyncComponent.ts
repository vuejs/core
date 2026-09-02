import {
  type AsyncComponentLoader,
  type AsyncComponentOptions,
  ErrorCodes,
  createAsyncComponentContext,
  currentInstance,
  handleError,
  markAsyncBoundary,
  performAsyncHydrate,
  restoreCurrentInstance,
  setCurrentInstance,
  useAsyncComponentState,
} from '@vue/runtime-dom'
import { defineVaporComponent } from './apiDefineComponent'
import {
  type VaporComponent,
  type VaporComponentInstance,
  createComponent,
} from './component'
import { enableAsyncComponent } from './asyncComponentState'
import { renderEffect } from './renderEffect'
import { DynamicFragment, isDynamicFragment } from './fragment'
import {
  hydrateNode,
  isComment,
  isHydrating,
  locateEndAnchor,
  locateHydrationNode,
  setCurrentHydrationNode,
  withDeferredHydrationBoundary,
} from './dom/hydration'
import { type Block, EMPTY_BLOCK, type TransitionOptions } from './block'
import { _next } from './dom/node'
import { isKeepAliveEnabled } from './keepAlive'

const enum AsyncBranch {
  RESOLVED = 1,
  ERROR,
  LOADING,
}

/*@ __NO_SIDE_EFFECTS__ */
export function defineVaporAsyncComponent<T extends VaporComponent>(
  source: AsyncComponentLoader<T> | AsyncComponentOptions<T>,
): T {
  enableAsyncComponent()
  const {
    load,
    getResolvedComp,
    setPendingRequest,
    source: {
      loadingComponent,
      errorComponent,
      delay,
      hydrate: hydrateStrategy,
      timeout,
      suspensible = true,
    },
  } = createAsyncComponentContext<T, VaporComponent>(source)

  return defineVaporComponent({
    name: 'VaporAsyncComponentWrapper',

    __asyncLoader: load,

    __asyncHydrate(
      el: Element,
      instance: VaporComponentInstance,
      // Note: this hydrate function essentially calls the setup method of the component
      // not the actual hydrate function
      hydrate: () => void,
    ) {
      // early return allows tree-shaking of hydration logic when not used
      if (!isHydrating) return

      // Placeholder for the deferred period: the wrapper's own fragment,
      // holding the adopted DOM. The wrapper can be moved or unmounted before
      // setup runs, and template refs / transitions register on the fragment
      // that setup will settle rather than on a stand-in.
      const endAnchor = isComment(el, '[') ? locateEndAnchor(el)! : null
      let nodes: Block
      if (endAnchor) {
        const end = _next(endAnchor)
        const range = (nodes = [el as Node])
        let cur = el as Node
        while (true) {
          let n = _next(cur)
          if (n && n !== end) {
            range.push((cur = n))
          } else {
            break
          }
        }
      } else {
        nodes = el
      }
      const prev = setCurrentInstance(instance)
      try {
        const frag = new DynamicFragment(
          0,
          __DEV__ ? 'async component' : undefined,
          false,
          false,
        )
        frag.nodes = nodes
        instance.block = frag
      } finally {
        restoreCurrentInstance(prev)
      }

      // Mark as mounted to ensure it can be unmounted before
      // its inner component is resolved
      instance.isMounted = true

      // Advance current hydration node to the nextSibling
      setCurrentHydrationNode(endAnchor || el.nextSibling)

      performAsyncHydrate(
        el,
        instance,
        () => hydrateNode(el, () => withDeferredHydrationBoundary(hydrate)),
        getResolvedComp,
        load,
        hydrateStrategy,
        false,
      )
    },

    get __asyncResolved() {
      return getResolvedComp()
    },

    setup() {
      const instance = currentInstance as VaporComponentInstance &
        TransitionOptions
      markAsyncBoundary(instance)

      // Deferred hydration hands over its placeholder (see __asyncHydrate)
      // so hooks registered on it while setup was pending apply to the
      // branch settled here.
      const placeholder = instance.block
      let frag: DynamicFragment
      if (isHydrating && isDynamicFragment(placeholder)) {
        frag = placeholder
        frag.nodes = EMPTY_BLOCK
        locateHydrationNode()
      } else {
        frag = new DynamicFragment(0, __DEV__ ? 'async component' : undefined)
      }

      // already resolved: only reached where createComponent keeps the
      // wrapper (hydration, vdom interop inners); a resolved CSR mount is
      // created as the resolved component and never enters this setup
      let resolvedComp = getResolvedComp()
      if (resolvedComp) {
        frag.update(() => createInnerComp(resolvedComp!, instance))
        if (frag === placeholder) {
          // the first render settles the placeholder; renderBranch itself
          // treats a first render as mount-time and stays silent
          const u = frag.u
          if (u) u.forEach(hook => hook(frag.nodes))
        }
        return frag
      }

      const onError = (err: Error) => {
        setPendingRequest(null)
        handleError(
          err,
          instance,
          ErrorCodes.ASYNC_COMPONENT_LOADER,
          !errorComponent /* do not throw in dev if user provided error component */,
        )
      }

      if (__FEATURE_SUSPENSE__ && suspensible && instance.suspense) {
        // The loader settles outside any render context: render the branch
        // under the wrapper's scope so it owns it, and not at all once the
        // wrapper was unmounted while loading (Suspense discards the result).
        const renderBranch = (render: () => VaporComponentInstance) => {
          if (!instance.isUnmounted) {
            instance.scope.run(() => frag.update(render))
          }
        }
        return load()
          .then(() => {
            resolvedComp = getResolvedComp()
            if (resolvedComp) {
              renderBranch(() => createInnerComp(resolvedComp!, instance))
            }
            return frag
          })
          .catch(err => {
            onError(err)
            if (errorComponent) {
              renderBranch(() =>
                createErrorComp(errorComponent, instance, () => err),
              )
            }
            return frag
          })
      }

      const { loaded, error, delayed } = useAsyncComponentState(
        delay,
        timeout,
        onError,
        instance,
      )

      load()
        .then(() => {
          if (instance.isUnmounted) return
          loaded.value = true
        })
        .catch(err => {
          if (instance.isUnmounted) {
            setPendingRequest(null)
            return
          }
          onError(err)
          error.value = err
        })

      renderEffect(() => {
        resolvedComp = getResolvedComp()
        let render
        let key
        if (loaded.value && resolvedComp) {
          render = () => createInnerComp(resolvedComp!, instance)
          key = AsyncBranch.RESOLVED
        } else if (error.value && errorComponent) {
          render = () =>
            createErrorComp(errorComponent, instance, () => error.value!)
          key = AsyncBranch.ERROR
        } else if (loadingComponent && !delayed.value) {
          render = () => createInnerComp(loadingComponent, instance)
          key = AsyncBranch.LOADING
        }

        // Keyed by branch so a state change that lands on the same branch
        // updates in place instead of recreating it.
        frag.update(render, key)
        // Manually trigger cacheBlock for KeepAlive
        if (isKeepAliveEnabled && frag.keepAliveCtx) {
          frag.keepAliveCtx.cacheBlock()
        }
      })

      return frag
    },
  }) as T
}

/**
 * The block an async wrapper has settled on, or undefined while it is
 * unresolved or (under deferred hydration) resolved but not set up yet.
 * Consumers reading through the wrapper treat undefined as unresolved.
 */
export function getAsyncWrapperInner(
  instance: VaporComponentInstance,
): Block | undefined {
  const frag = instance.block
  if (
    isDynamicFragment(frag) &&
    frag.current !== undefined &&
    instance.type.__asyncResolved
  ) {
    return frag.nodes
  }
}

function createErrorComp(
  comp: VaporComponent,
  parent: VaporComponentInstance & TransitionOptions,
  getError: () => Error,
): VaporComponentInstance {
  return createInnerComp(
    comp,
    parent,
    { error: getError },
    // Avoid wrapper slot fallthrough
    {},
  )
}

function createInnerComp(
  comp: VaporComponent,
  parent: VaporComponentInstance & TransitionOptions,
  rawProps = parent.rawProps,
  rawSlots = parent.rawSlots,
): VaporComponentInstance {
  const prevInstance = setCurrentInstance(parent)
  try {
    return createComponent(
      comp,
      rawProps,
      rawSlots,
      // rawProps is shared and already contains fallthrough attrs.
      // so isSingleRoot should be undefined
      undefined,
      // The resolved inner component is the real input boundary for async
      // components, so it must inherit the wrapper's v-once state.
      parent.isOnce,
      parent.appContext,
    )
  } finally {
    restoreCurrentInstance(prevInstance)
  }
}
