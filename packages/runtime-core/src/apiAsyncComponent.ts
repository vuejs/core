import {
  PublicAPIComponent,
  Component,
  currentSuspense,
  currentInstance,
  ComponentInternalInstance,
  isInSSRComponentSetup
} from './component'
import { isFunction, isObject, EMPTY_OBJ } from '@vue/shared'
import { ComponentPublicInstance } from './componentProxy'
import { createVNode } from './vnode'
import { defineComponent } from './apiDefineComponent'
import { warn } from './warning'
import { ref } from '@vue/reactivity'
import { handleError, ErrorCodes } from './errorHandling'

export type AsyncComponentResolveResult<T = PublicAPIComponent> =
  | T
  | { default: T } // es modules

export type AsyncComponentLoader<T = any> = () => Promise<
  AsyncComponentResolveResult<T>
>

export interface AsyncComponentOptions<T = any> {
  loader: AsyncComponentLoader<T>
  loading?: PublicAPIComponent
  error?: PublicAPIComponent
  delay?: number
  timeout?: number
  suspensible?: boolean
}

export function defineAsyncComponent<
  T extends PublicAPIComponent = { new (): ComponentPublicInstance }
>(source: AsyncComponentLoader<T> | AsyncComponentOptions<T>): T {
  if (isFunction(source)) {
    source = { loader: source }
  }

  const {
    suspensible = true,
    loader,
    loading: loadingComponent,
    error: errorComponent,
    delay = 200,
    timeout // undefined = never times out
  } = source

  let pendingRequest: Promise<Component> | null = null
  let resolvedComp: Component | undefined

  const load = (): Promise<Component> => {
    return (
      pendingRequest ||
      (pendingRequest = loader().then((comp: any) => {
        // interop module default
        if (comp.__esModule || comp[Symbol.toStringTag] === 'Module') {
          comp = comp.default
        }
        if (__DEV__ && !isObject(comp) && !isFunction(comp)) {
          warn(`Invalid async component load result: `, comp)
        }
        resolvedComp = comp
        return comp
      }))
    )
  }

  return defineComponent({
    __asyncLoader: load,
    name: 'AsyncComponentWrapper',
    setup() {
      const instance = currentInstance!

      // already resolved
      if (resolvedComp) {
        return () => createInnerComp(resolvedComp!, instance)
      }

      const onError = (err: Error) => {
        pendingRequest = null
        handleError(err, instance, ErrorCodes.ASYNC_COMPONENT_LOADER)
      }

      // suspense-controlled or SSR.
      if (
        (__FEATURE_SUSPENSE__ && suspensible && currentSuspense) ||
        (__NODE_JS__ && isInSSRComponentSetup)
      ) {
        return load()
          .then(comp => {
            return () => createInnerComp(comp, instance)
          })
          .catch(err => {
            onError(err)
            return () =>
              errorComponent
                ? createVNode(errorComponent as Component, { error: err })
                : null
          })
      }

      // TODO hydration

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
          if (!loaded.value) {
            const err = new Error(
              `Async component timed out after ${timeout}ms.`
            )
            onError(err)
            error.value = err
          }
        }, timeout)
      }

      load()
        .then(() => {
          loaded.value = true
        })
        .catch(err => {
          onError(err)
          error.value = err
        })

      return () => {
        if (loaded.value && resolvedComp) {
          return createInnerComp(resolvedComp, instance)
        } else if (error.value && errorComponent) {
          return createVNode(errorComponent as Component, {
            error: error.value
          })
        } else if (loadingComponent && !delayed.value) {
          return createVNode(loadingComponent as Component)
        }
      }
    }
  }) as any
}

function createInnerComp(
  comp: Component,
  { props, slots }: ComponentInternalInstance
) {
  return createVNode(
    comp,
    props === EMPTY_OBJ ? null : props,
    slots === EMPTY_OBJ ? null : slots
  )
}
