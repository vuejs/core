import {
  type ComponentInternalInstance,
  currentInstance,
  setCurrentInstance,
} from './component'
import { warn } from './warning'
import {
  type DebuggerEvent,
  pauseTracking,
  resetTracking,
} from '@vue/reactivity'
import { ErrorTypeStrings, callWithAsyncErrorHandling } from './errorHandling'
import { toHandlerKey } from '@vue/shared'

export enum VaporLifecycleHooks {
  BEFORE_MOUNT = 'bm',
  MOUNTED = 'm',
  BEFORE_UPDATE = 'bu',
  UPDATED = 'u',
  BEFORE_UNMOUNT = 'bum',
  UNMOUNTED = 'um',
  DEACTIVATED = 'da',
  ACTIVATED = 'a',
  RENDER_TRIGGERED = 'rtg',
  RENDER_TRACKED = 'rtc',
  ERROR_CAPTURED = 'ec',
  // SERVER_PREFETCH = 'sp',
}

const injectHook = (
  type: VaporLifecycleHooks,
  hook: Function & { __weh?: Function },
  target: ComponentInternalInstance | null = currentInstance,
  prepend: boolean = false,
) => {
  if (target) {
    const hooks = target[type] || (target[type] = [])
    const wrappedHook =
      hook.__weh ||
      (hook.__weh = (...args: unknown[]) => {
        if (target.isUnmounted) {
          return
        }
        pauseTracking()
        const reset = setCurrentInstance(target)
        const res = target.scope.run(() =>
          callWithAsyncErrorHandling(hook, target, type, args),
        )
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
const createHook =
  <T extends Function = () => any>(lifecycle: VaporLifecycleHooks) =>
  (hook: T, target: ComponentInternalInstance | null = currentInstance) =>
    injectHook(lifecycle, (...args: unknown[]) => hook(...args), target)

export const onBeforeMount = createHook(VaporLifecycleHooks.BEFORE_MOUNT)
export const onMounted = createHook(VaporLifecycleHooks.MOUNTED)
export const onBeforeUpdate = createHook(VaporLifecycleHooks.BEFORE_UPDATE)
export const onUpdated = createHook(VaporLifecycleHooks.UPDATED)
export const onBeforeUnmount = createHook(VaporLifecycleHooks.BEFORE_UNMOUNT)
export const onUnmounted = createHook(VaporLifecycleHooks.UNMOUNTED)

export type DebuggerHook = (e: DebuggerEvent) => void
export const onRenderTriggered = createHook<DebuggerHook>(
  VaporLifecycleHooks.RENDER_TRIGGERED,
)
export const onRenderTracked = createHook<DebuggerHook>(
  VaporLifecycleHooks.RENDER_TRACKED,
)

export type ErrorCapturedHook<TError = unknown> = (
  err: TError,
  instance: ComponentInternalInstance | null,
  info: string,
) => boolean | void

export function onErrorCaptured<TError = Error>(
  hook: ErrorCapturedHook<TError>,
  target: ComponentInternalInstance | null = currentInstance,
) {
  injectHook(VaporLifecycleHooks.ERROR_CAPTURED, hook, target)
}
