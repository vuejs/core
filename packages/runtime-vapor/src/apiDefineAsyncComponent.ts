import {
  type AsyncComponentLoader,
  type AsyncComponentOptions,
  ErrorCodes,
  createAsyncComponentContext,
  createInnerComp as createSSRInnerComp,
  currentInstance,
  handleError,
  isInSSRComponentSetup,
  loadInnerComponent as loadSSRInnerComponent,
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
import { hydrateNode, isHydrating } from './dom/hydration'
import { invokeArrayFns } from '@vue/shared'
import { insert, remove } from './block'
import { parentNode } from './dom/node'

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
      // if async component needs to be updated before hydration, hydration is no longer needed.
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
            insert(instance.block, parent, el)
            remove(el, parent)
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
      const instance = currentInstance as VaporComponentInstance
      markAsyncBoundary(instance)

      const frag =
        __DEV__ || isHydrating
          ? new DynamicFragment('async component')
          : new DynamicFragment()

      // already resolved
      let resolvedComp = getResolvedComp()
      if (resolvedComp) {
        // SSR
        if (__SSR__ && isInSSRComponentSetup) {
          return () => createSSRInnerComp(resolvedComp! as any, instance as any)
        }

        // TODO handling insertionState
        frag!.update(() => createInnerComp(resolvedComp!, instance))
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

      // SSR
      if (__SSR__ && isInSSRComponentSetup) {
        return loadSSRInnerComponent(
          instance as any,
          load,
          onError,
          errorComponent,
        )
      }

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
        let render
        if (loaded.value && resolvedComp) {
          render = () => createInnerComp(resolvedComp!, instance, frag)
        } else if (error.value && errorComponent) {
          render = () =>
            createComponent(errorComponent, { error: () => error.value })
        } else if (loadingComponent && !delayed.value) {
          render = () => createComponent(loadingComponent)
        }
        frag!.update(render)
      })

      // TODO handling insertionState
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
  const instance = createComponent(
    comp,
    rawProps,
    rawSlots,
    isSingleRoot,
    undefined,
    undefined,
    appContext,
  )

  // set ref
  frag && frag.setRef && frag.setRef(instance)

  // TODO custom element
  // pass the custom element callback on to the inner comp
  // and remove it from the async wrapper
  // i.ce = ce
  // delete parent.ce
  return instance
}
