import {
  type AsyncComponentLoader,
  type AsyncComponentOptions,
  ErrorCodes,
  createAsyncComponentContext,
  currentInstance,
  handleError,
  markAsyncBoundary,
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
import { insert, remove } from './block'
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

    get __asyncResolved() {
      return getResolvedComp()
    },

    setup() {
      const instance = currentInstance as VaporComponentInstance &
        TransitionOptions
      markAsyncBoundary(instance)

      const frag = __DEV__
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

  return instance
}
