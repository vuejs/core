import {
  type AsyncComponentLoader,
  type AsyncComponentOptions,
  ErrorCodes,
  createAsyncComponentContext,
  currentInstance,
  handleError,
  markAsyncBoundary,
  useAsyncComponentState,
} from '@vue/runtime-dom'
import { defineVaporComponent } from './apiDefineComponent'
import {
  type VaporComponent,
  type VaporComponentInstance,
  createComponent,
} from './component'
import { DynamicFragment } from './block'
import { renderEffect } from './renderEffect'

/*! #__NO_SIDE_EFFECTS__ */
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
      // hydrate: hydrateStrategy,
      timeout,
      // suspensible = true,
    },
  } = createAsyncComponentContext<T, VaporComponent>(source)

  return defineVaporComponent({
    name: 'VaporAsyncComponentWrapper',

    __asyncLoader: load,

    // __asyncHydrate(el, instance, hydrate) {
    //   // TODO async hydrate
    // },

    get __asyncResolved() {
      return getResolvedComp()
    },

    setup() {
      const instance = currentInstance as VaporComponentInstance
      markAsyncBoundary(instance)

      const frag = __DEV__
        ? new DynamicFragment('async component')
        : new DynamicFragment()

      // already resolved
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

      // TODO suspense-controlled or SSR.

      const { loaded, error, delayed } = useAsyncComponentState(
        delay,
        timeout,
        onError,
      )

      load()
        .then(() => {
          loaded.value = true
          // TODO parent is keep-alive, force update so the loaded component's
          // name is taken into account
        })
        .catch(err => {
          onError(err)
          error.value = err
        })

      renderEffect(() => {
        resolvedComp = getResolvedComp()
        let blockFn
        if (loaded.value && resolvedComp) {
          blockFn = () => createInnerComp(resolvedComp!, instance, frag)
        } else if (error.value && errorComponent) {
          blockFn = () =>
            createComponent(errorComponent, { error: () => error.value })
        } else if (loadingComponent && !delayed.value) {
          blockFn = () => createComponent(loadingComponent)
        }
        frag.update(blockFn)
      })

      return frag
    },
  }) as T
}

function createInnerComp(
  comp: VaporComponent,
  parent: VaporComponentInstance,
  frag?: DynamicFragment,
): VaporComponentInstance {
  const { rawProps, rawSlots, isSingleRoot, appContext } = parent
  const i = createComponent(comp, rawProps, rawSlots, isSingleRoot, appContext)
  // set ref
  frag && frag.setRef && frag.setRef(i)

  // TODO custom element
  // pass the custom element callback on to the inner comp
  // and remove it from the async wrapper
  // i.ce = ce
  // delete parent.ce
  return i
}
