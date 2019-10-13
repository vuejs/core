import {
  ComponentInternalInstance,
  LifecycleHooks,
  currentInstance,
  setCurrentInstance
} from './component'
import { ComponentPublicInstance } from './componentProxy'
import { callWithAsyncErrorHandling, ErrorTypeStrings } from './errorHandling'
import { warn } from './warning'
import { capitalize } from '@vue/shared'
import { pauseTracking, resumeTracking, DebuggerEvent } from '@vue/reactivity'

type DebuggerEventHook = (e: DebuggerEvent) => void
type ErrorCapturedHook = (
  err: Error,
  instance: ComponentPublicInstance | null,
  info: string
) => boolean | void

function injectHook(
  type: LifecycleHooks,
  hook: Function,
  target: ComponentInternalInstance | null
) {
  if (target) {
    ;(target[type] || (target[type] = [])).push((...args: any[]) => {
      if (target.isUnmounted) {
        return
      }
      // disable tracking inside all lifecycle hooks
      // since they can potentially be called inside effects.
      pauseTracking()
      // Set currentInstance during hook invocation.
      // This assumes the hook does not synchronously trigger other hooks, which
      // can only be false when the user does something really funky.
      setCurrentInstance(target)
      const res = callWithAsyncErrorHandling(hook, target, type, args)
      setCurrentInstance(null)
      resumeTracking()
      return res
    })
  } else if (__DEV__) {
    const apiName = `on${capitalize(
      ErrorTypeStrings[type].replace(/ hook$/, '')
    )}`
    warn(
      `${apiName} is called when there is no active component instance to be ` +
        `associated with. ` +
        `Lifecycle injection APIs can only be used during execution of setup().` +
        (__FEATURE_SUSPENSE__
          ? ` If you are using async setup(), make sure to register lifecycle ` +
            `hooks before the first await statement.`
          : ``)
    )
  }
}

const createLifecycleInjector = <T extends Function = Function>(
  lifecycle: LifecycleHooks
): Function =>
  function(
    hook: T,
    target: ComponentInternalInstance | null = currentInstance
  ) {
    injectHook(lifecycle, hook, target)
  }

export const onBeforeMount = createLifecycleInjector(
  LifecycleHooks.BEFORE_MOUNT
)
export const onMounted = createLifecycleInjector(LifecycleHooks.MOUNTED)
export const onBeforeUpdate = createLifecycleInjector(
  LifecycleHooks.BEFORE_UPDATE
)
export const onUpdated = createLifecycleInjector(LifecycleHooks.UPDATED)
export const onBeforeUnmount = createLifecycleInjector(
  LifecycleHooks.BEFORE_UNMOUNT
)
export const onUnmounted = createLifecycleInjector(LifecycleHooks.UNMOUNTED)
export const onRenderTriggered = createLifecycleInjector<DebuggerEventHook>(
  LifecycleHooks.RENDER_TRIGGERED
)
export const onRenderTracked = createLifecycleInjector<DebuggerEventHook>(
  LifecycleHooks.RENDER_TRACKED
)
export const onErrorCaptured = createLifecycleInjector<ErrorCapturedHook>(
  LifecycleHooks.ERROR_CAPTURED
)
