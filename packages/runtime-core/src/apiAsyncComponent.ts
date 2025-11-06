import {
  type Component,
  type ComponentInternalInstance,
  type ComponentOptions,
  type ConcreteComponent,
  type GenericComponent,
  type GenericComponentInstance,
  currentInstance,
  getComponentName,
  isInSSRComponentSetup,
} from './component'
import { isFunction, isObject } from '@vue/shared'
import type { ComponentPublicInstance } from './componentPublicInstance'
import { type VNode, createVNode } from './vnode'
import { defineComponent } from './apiDefineComponent'
import { warn } from './warning'
import { type Ref, ref } from '@vue/reactivity'
import { ErrorCodes, handleError } from './errorHandling'
import { isKeepAlive } from './components/KeepAlive'
import { markAsyncBoundary } from './helpers/useId'
import { type HydrationStrategy, forEachElement } from './hydrationStrategies'

export type AsyncComponentResolveResult<T = Component> = T | { default: T } // es modules

export type AsyncComponentLoader<T = any> = () => Promise<
  AsyncComponentResolveResult<T>
>

export interface AsyncComponentOptions<T = any, C = any> {
  loader: AsyncComponentLoader<T>
  loadingComponent?: C
  errorComponent?: C
  delay?: number
  timeout?: number
  suspensible?: boolean
  hydrate?: HydrationStrategy
  onError?: (
    error: Error,
    retry: () => void,
    fail: () => void,
    attempts: number,
  ) => any
}

export const isAsyncWrapper = (i: GenericComponentInstance | VNode): boolean =>
  !!(i.type as ComponentOptions).__asyncLoader

/*@__NO_SIDE_EFFECTS__*/
export function defineAsyncComponent<
  T extends Component = { new (): ComponentPublicInstance },
>(source: AsyncComponentLoader<T> | AsyncComponentOptions<T, Component>): T {
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
  } = createAsyncComponentContext(source)

  return defineComponent({
    name: 'AsyncComponentWrapper',

    __asyncLoader: load,

    __asyncHydrate(el, instance, hydrate) {
      performAsyncHydrate(
        el,
        instance,
        hydrate,
        getResolvedComp,
        load,
        hydrateStrategy,
      )
    },

    get __asyncResolved() {
      return getResolvedComp()
    },

    setup() {
      const instance = currentInstance as ComponentInternalInstance
      markAsyncBoundary(instance)

      // already resolved
      let resolvedComp = getResolvedComp()
      if (resolvedComp) {
        return () => createInnerComp(resolvedComp!, instance)
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

      // suspense-controlled or SSR.
      if (
        (__FEATURE_SUSPENSE__ && suspensible && instance.suspense) ||
        (__SSR__ && isInSSRComponentSetup)
      ) {
        return load()
          .then(comp => {
            return () => createInnerComp(comp, instance)
          })
          .catch(err => {
            onError(err)
            return () =>
              errorComponent
                ? createVNode(errorComponent as ConcreteComponent, {
                    error: err,
                  })
                : null
          })
      }

      const { loaded, error, delayed } = useAsyncComponentState(
        delay,
        timeout,
        onError,
      )

      load()
        .then(() => {
          loaded.value = true
          if (
            instance.parent &&
            instance.parent.vnode &&
            isKeepAlive(instance.parent.vnode)
          ) {
            // parent is keep-alive, force update so the loaded component's
            // name is taken into account
            ;(instance.parent as ComponentInternalInstance).update()
          }
        })
        .catch(err => {
          onError(err)
          error.value = err
        })

      return () => {
        resolvedComp = getResolvedComp()
        if (loaded.value && resolvedComp) {
          return createInnerComp(resolvedComp, instance)
        } else if (error.value && errorComponent) {
          return createVNode(errorComponent, {
            error: error.value,
          })
        } else if (loadingComponent && !delayed.value) {
          return createInnerComp(
            loadingComponent as ConcreteComponent,
            instance,
          )
        }
      }
    },
  }) as T
}

function createInnerComp(
  comp: ConcreteComponent,
  parent: ComponentInternalInstance,
) {
  const { ref, props, children, ce } = parent.vnode
  const vnode = createVNode(comp, props, children)
  // ensure inner component inherits the async wrapper's ref owner
  vnode.ref = ref
  // pass the custom element callback on to the inner comp
  // and remove it from the async wrapper
  vnode.ce = ce
  delete parent.vnode.ce

  return vnode
}

type AsyncComponentContext<T, C = ConcreteComponent> = {
  load: () => Promise<C>
  source: AsyncComponentOptions<T>
  getResolvedComp: () => C | undefined
  setPendingRequest: (request: Promise<C> | null) => void
}

// shared between core and vapor
export function createAsyncComponentContext<T, C = ConcreteComponent>(
  source: AsyncComponentLoader<T> | AsyncComponentOptions<T>,
): AsyncComponentContext<T, C> {
  if (isFunction(source)) {
    source = { loader: source }
  }

  const { loader, onError: userOnError } = source
  let pendingRequest: Promise<C> | null = null
  let resolvedComp: C | undefined

  let retries = 0
  const retry = () => {
    retries++
    pendingRequest = null
    return load()
  }

  const load = (): Promise<C> => {
    let thisRequest: Promise<C>
    return (
      pendingRequest ||
      (thisRequest = pendingRequest =
        loader()
          .catch(err => {
            err = err instanceof Error ? err : new Error(String(err))
            if (userOnError) {
              return new Promise((resolve, reject) => {
                const userRetry = () => resolve(retry())
                const userFail = () => reject(err)
                userOnError(err, userRetry, userFail, retries + 1)
              })
            } else {
              throw err
            }
          })
          .then((comp: any) => {
            if (thisRequest !== pendingRequest && pendingRequest) {
              return pendingRequest
            }
            if (__DEV__ && !comp) {
              warn(
                `Async component loader resolved to undefined. ` +
                  `If you are using retry(), make sure to return its return value.`,
              )
            }
            if (
              comp &&
              (comp.__esModule || comp[Symbol.toStringTag] === 'Module')
            ) {
              comp = comp.default
            }
            if (__DEV__ && comp && !isObject(comp) && !isFunction(comp)) {
              throw new Error(`Invalid async component load result: ${comp}`)
            }
            resolvedComp = comp
            return comp
          }))
    )
  }

  return {
    load,
    source,
    getResolvedComp: () => resolvedComp,
    setPendingRequest: (request: Promise<C> | null) =>
      (pendingRequest = request),
  }
}

// shared between core and vapor
export const useAsyncComponentState = (
  delay: number | undefined,
  timeout: number | undefined,
  onError: (err: Error) => void,
): {
  loaded: Ref<boolean>
  error: Ref<Error | undefined>
  delayed: Ref<boolean>
} => {
  const loaded = ref(false)
  const error = ref()
  const delayed = ref(!!delay)

  if (delay) {
    setTimeout(() => {
      delayed.value = false
    }, delay)
  }

  if (timeout != null) {
    setTimeout(() => {
      if (!loaded.value && !error.value) {
        const err = new Error(`Async component timed out after ${timeout}ms.`)
        onError(err)
        error.value = err
      }
    }, timeout)
  }

  return { loaded, error, delayed }
}

/**
 * shared between core and vapor
 * @internal
 */
export function performAsyncHydrate(
  el: Element,
  instance: GenericComponentInstance,
  hydrate: () => void,
  getResolvedComp: () => GenericComponent | undefined,
  load: () => Promise<GenericComponent>,
  hydrateStrategy: HydrationStrategy | undefined,
): void {
  let patched = false
  ;(instance.bu || (instance.bu = [])).push(() => (patched = true))
  const performHydrate = () => {
    // skip hydration if the component has been patched
    if (patched) {
      if (__DEV__) {
        const resolvedComp = getResolvedComp()! as GenericComponent
        warn(
          `Skipping lazy hydration for component '${getComponentName(resolvedComp) || resolvedComp.__file}': ` +
            `it was updated before lazy hydration performed.`,
        )
      }
      return
    }
    hydrate()
  }
  const doHydrate = hydrateStrategy
    ? () => {
        const teardown = hydrateStrategy(performHydrate, cb =>
          forEachElement(el, cb),
        )
        if (teardown) {
          ;(instance.bum || (instance.bum = [])).push(teardown)
        }
      }
    : performHydrate
  if (getResolvedComp()) {
    doHydrate()
  } else {
    load().then(() => !instance.isUnmounted && doHydrate())
  }
}
