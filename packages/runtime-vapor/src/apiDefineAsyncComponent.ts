import {
  type AsyncComponentLoader,
  type AsyncComponentOptions,
  ErrorCodes,
  createAsyncComponentContext,
  currentInstance,
  handleError,
  isInSSRComponentSetup,
  loadInnerComponent,
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
import { type Block, insert, remove } from './block'
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
      hydrate: () => any,
    ) {
      // The setup of async components is not executed during hydration,
      // which means beforeUpdate won't be called when attrs change. We need to watch
      // for attrs changes and manually call beforeUpdate to avoid unnecessary hydration
      // and mount the async component
      watch(
        () => instance.attrs,
        () => {
          instance.bu && invokeArrayFns(instance.bu)
          const block = hydrate() as Block
          const parent = parentNode(el)!
          insert(block, parent, el)
          remove(el, parent)
        },
        { deep: true, once: true },
      )

      performAsyncHydrate(
        el,
        instance,
        () => hydrateNode(el, hydrate),
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

      // TODO suspense-controlled
      if (__FEATURE_SUSPENSE__ && suspensible && instance.suspense) {
      }

      // SSR
      if (__SSR__ && isInSSRComponentSetup) {
        return loadInnerComponent(
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
        frag.update(render)
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
