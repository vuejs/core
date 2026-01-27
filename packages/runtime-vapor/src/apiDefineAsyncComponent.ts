import {
  type AsyncComponentLoader,
  type AsyncComponentOptions,
  ErrorCodes,
  createAsyncComponentContext,
  currentInstance,
  handleError,
  markAsyncBoundary,
  performAsyncHydrate,
  useAsyncComponentState,
  watch,
} from '@vue/runtime-dom'
import { defineVaporComponent } from './apiDefineComponent'
import {
  type VaporComponent,
  type VaporComponentInstance,
  createComponent,
} from './component'
import { renderEffect } from './renderEffect'
import { DynamicFragment } from './fragment'
import {
  hydrateNode,
  isComment,
  isHydrating,
  locateEndAnchor,
  removeFragmentNodes,
  setCurrentHydrationNode,
} from './dom/hydration'
import { type TransitionOptions, insert, remove } from './block'
import { _next, parentNode } from './dom/node'
import { invokeArrayFns } from '@vue/shared'

/*@ __NO_SIDE_EFFECTS__ */
export function defineVaporAsyncComponent<T extends VaporComponent>(
  source: AsyncComponentLoader<T> | AsyncComponentOptions<T>,
): T {
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

      // If async component needs to be updated before hydration, hydration is no longer needed.
      let isHydrated = false
      watch(
        () => instance.attrs,
        () => {
          // early return if already hydrated
          if (isHydrated) return

          // call the beforeUpdate hook to avoid calling hydrate in performAsyncHydrate
          instance.bu && invokeArrayFns(instance.bu)

          // mount the inner component and remove the placeholder
          const parent = parentNode(el)!
          load().then(() => {
            if (instance.isUnmounted) return
            hydrate()
            if (isComment(el, '[')) {
              const endAnchor = locateEndAnchor(el)!
              removeFragmentNodes(el, endAnchor)
              insert(instance.block, parent, endAnchor)
            } else {
              insert(instance.block, parent, el)
              remove(el, parent)
            }
          })
        },
        { deep: true, once: true },
      )

      performAsyncHydrate(
        el,
        instance,
        () => {
          hydrateNode(el, () => {
            hydrate()
            insert(instance.block, parentNode(el)!, el)
            isHydrated = true
          })
        },
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

      const frag =
        __DEV__ || isHydrating
          ? new DynamicFragment('async component')
          : new DynamicFragment()

      // already resolved
      let resolvedComp = getResolvedComp()
      if (resolvedComp) {
        frag!.update(() => createInnerComp(resolvedComp!, instance, frag))
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

      // TODO suspense-controlled
      if (__FEATURE_SUSPENSE__ && suspensible && instance.suspense) {
      }

      const { loaded, error, delayed } = useAsyncComponentState(
        delay,
        timeout,
        onError,
      )

      load()
        .then(() => {
          loaded.value = true
        })
        .catch(err => {
          onError(err)
          error.value = err
        })

      renderEffect(() => {
        resolvedComp = getResolvedComp()
        let render
        if (loaded.value && resolvedComp) {
          render = () => createInnerComp(resolvedComp!, instance, frag)
        } else if (error.value && errorComponent) {
          render = () =>
            createComponent(errorComponent, { error: () => error.value })
        } else if (loadingComponent && !delayed.value) {
          render = () => createComponent(loadingComponent)
        }

        frag.update(render)
        // Manually trigger cacheBlock for KeepAlive
        if (frag.keepAliveCtx) frag.keepAliveCtx.cacheBlock()
      })

      return frag
    },
  }) as T
}

function createInnerComp(
  comp: VaporComponent,
  parent: VaporComponentInstance & TransitionOptions,
  frag?: DynamicFragment,
): VaporComponentInstance {
  const { rawProps, rawSlots, appContext } = parent
  const instance = createComponent(
    comp,
    rawProps,
    rawSlots,
    // rawProps is shared and already contains fallthrough attrs.
    // so isSingleRoot should be undefined
    undefined,
    undefined,
    appContext,
  )

  // set ref
  frag && frag.setAsyncRef && frag.setAsyncRef(instance)

  return instance
}
