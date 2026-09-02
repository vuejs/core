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
  enableAsyncComponent,
} from './component'
import { renderEffect } from './renderEffect'
import { DynamicFragment } from './fragment'
import {
  hydrateNode,
  isComment,
  isHydrating,
  locateEndAnchor,
  setCurrentHydrationNode,
  withDeferredHydrationBoundary,
} from './dom/hydration'
import type { TransitionOptions } from './block'
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

      // Nothing to defer: hydrate in place like a plain component.
      if (!hydrateStrategy && getResolvedComp()) return hydrate()

      // Create placeholder block that matches the adopted DOM.
      // The async component may get unmounted before its inner component is loaded,
      // so we need to give it a placeholder block.
      if (isComment(el, '[')) {
        const end = _next(locateEndAnchor(el)!)
        const block = (instance.block = [el as Node])
        let cur = el as Node
        while (true) {
          let n = _next(cur)
          if (n && n !== end) {
            block.push((cur = n))
          } else {
            break
          }
        }
      } else {
        instance.block = el
      }

      // Mark as mounted to ensure it can be unmounted before
      // its inner component is resolved
      instance.isMounted = true

      // Advance current hydration node to the nextSibling
      setCurrentHydrationNode(
        isComment(el, '[') ? locateEndAnchor(el)! : el.nextSibling,
      )

      performAsyncHydrate(
        el,
        instance,
        () => hydrateNode(el, () => withDeferredHydrationBoundary(hydrate)),
        getResolvedComp,
        load,
        hydrateStrategy,
      )
    },

    get __asyncResolved() {
      return getResolvedComp()
    },

    setup() {
      const instance = currentInstance as VaporComponentInstance &
        TransitionOptions
      markAsyncBoundary(instance)

      const frag = new DynamicFragment(
        0,
        __DEV__ ? 'async component' : undefined,
      )

      // already resolved: only reached where createComponent keeps the
      // wrapper (hydration, vdom interop inners); a resolved CSR mount is
      // created as the resolved component and never enters this setup
      let resolvedComp = getResolvedComp()
      if (resolvedComp) {
        frag.update(() => createInnerComp(resolvedComp!, instance))
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
        return load()
          .then(() => {
            resolvedComp = getResolvedComp()
            if (resolvedComp) {
              frag.update(() => createInnerComp(resolvedComp!, instance))
            }
            return frag
          })
          .catch(err => {
            onError(err)
            if (errorComponent) {
              frag.update(() =>
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
