import {
  type ComponentInternalInstance,
  currentInstance,
  isInSSRComponentSetup,
  setCurrentInstance,
} from './component'
import type { ComponentPublicInstance } from './componentPublicInstance'
import { ErrorTypeStrings, callWithAsyncErrorHandling } from './errorHandling'
import { warn } from './warning'
import { toHandlerKey } from '@vue/shared'
import {
  type DebuggerEvent,
  pauseTracking,
  resetTracking,
} from '@vue/reactivity'
import { LifecycleHooks } from './enums'

export { onActivated, onDeactivated } from './components/KeepAlive'

export function injectHook(
  type: LifecycleHooks,
  hook: Function & { __weh?: Function },
  target: ComponentInternalInstance | null = currentInstance,
  prepend: boolean = false,
): Function | undefined {
  if (target) {
    const hooks = target[type] || (target[type] = [])
    // cache the error handling wrapper for injected hooks so the same hook
    // can be properly deduped by the scheduler. "__weh" stands for "with error
    // handling".
    const wrappedHook =
      hook.__weh ||
      (hook.__weh = (...args: unknown[]) => {
        // disable tracking inside all lifecycle hooks
        // since they can potentially be called inside effects.
        pauseTracking()
        // Set currentInstance during hook invocation.
        // This assumes the hook does not synchronously trigger other hooks, which
        // can only be false when the user does something really funky.
        const reset = setCurrentInstance(target)
        const res = callWithAsyncErrorHandling(hook, target, type, args)
        reset()
        resetTracking()
        return res
      })
    if (prepend) {
      hooks.unshift(wrappedHook)
    } else {
      hooks.push(wrappedHook)
    }
    return wrappedHook
  } else if (__DEV__) {
    const apiName = toHandlerKey(ErrorTypeStrings[type].replace(/ hook$/, ''))
    warn(
      `${apiName} is called when there is no active component instance to be ` +
        `associated with. ` +
        `Lifecycle injection APIs can only be used during execution of setup().` +
        (__FEATURE_SUSPENSE__
          ? ` If you are using async setup(), make sure to register lifecycle ` +
            `hooks before the first await statement.`
          : ``),
    )
  }
}

export const createHook =
  <T extends Function = () => any>(lifecycle: LifecycleHooks) =>
  (hook: T, target: ComponentInternalInstance | null = currentInstance) => {
    // post-create lifecycle registrations are noops during SSR (except for serverPrefetch)
    if (
      !isInSSRComponentSetup ||
      lifecycle === LifecycleHooks.SERVER_PREFETCH
    ) {
      injectHook(lifecycle, (...args: unknown[]) => hook(...args), target)
    }
  }

export const onBeforeMount = createHook(LifecycleHooks.BEFORE_MOUNT)
export const onMounted = createHook(LifecycleHooks.MOUNTED)
export const onBeforeUpdate = createHook(LifecycleHooks.BEFORE_UPDATE)
export const onUpdated = createHook(LifecycleHooks.UPDATED)
export const onBeforeUnmount = createHook(LifecycleHooks.BEFORE_UNMOUNT)
export const onUnmounted = createHook(LifecycleHooks.UNMOUNTED)
export const onServerPrefetch = createHook(LifecycleHooks.SERVER_PREFETCH)

export type DebuggerHook = (e: DebuggerEvent) => void
export const onRenderTriggered = createHook<DebuggerHook>(
  LifecycleHooks.RENDER_TRIGGERED,
)
export const onRenderTracked = createHook<DebuggerHook>(
  LifecycleHooks.RENDER_TRACKED,
)

export type ErrorCapturedHook<TError = unknown> = (
  err: TError,
  instance: ComponentPublicInstance | null,
  info: string,
) => boolean | void

export function onErrorCaptured<TError = Error>(
  hook: ErrorCapturedHook<TError>,
  target: ComponentInternalInstance | null = currentInstance,
) {
  injectHook(LifecycleHooks.ERROR_CAPTURED, hook, target)
}
