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
import { VaporLifecycleHooks } from './enums'

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
type CreateHook<T = any> = (
  hook: T,
  target?: ComponentInternalInstance | null,
) => void

export const onBeforeMount: CreateHook = createHook(
  VaporLifecycleHooks.BEFORE_MOUNT,
)
export const onMounted: CreateHook = createHook(VaporLifecycleHooks.MOUNTED)
export const onBeforeUpdate: CreateHook = createHook(
  VaporLifecycleHooks.BEFORE_UPDATE,
)
export const onUpdated: CreateHook = createHook(VaporLifecycleHooks.UPDATED)
export const onBeforeUnmount: CreateHook = createHook(
  VaporLifecycleHooks.BEFORE_UNMOUNT,
)
export const onUnmounted: CreateHook = createHook(VaporLifecycleHooks.UNMOUNTED)

export type DebuggerHook = (e: DebuggerEvent) => void
export const onRenderTriggered: CreateHook = createHook<DebuggerHook>(
  VaporLifecycleHooks.RENDER_TRIGGERED,
)
export const onRenderTracked: CreateHook = createHook<DebuggerHook>(
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
): void {
  injectHook(VaporLifecycleHooks.ERROR_CAPTURED, hook, target)
}
