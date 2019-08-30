import {
  ComponentInstance,
  LifecycleHooks,
  currentInstance,
  setCurrentInstance,
  ComponentRenderProxy
} from './component'
import { callWithAsyncErrorHandling, ErrorTypeStrings } from './errorHandling'
import { warn } from './warning'
import { capitalize } from '@vue/shared'

function injectHook(
  type: LifecycleHooks,
  hook: Function,
  target: ComponentInstance | null = currentInstance
) {
  if (target) {
    ;(target[type] || (target[type] = [])).push((...args: any[]) => {
      // Set currentInstance during hook invocation.
      // This assumes the hook does not synchronously trigger other hooks, which
      // can only be false when the user does something really funky.
      setCurrentInstance(target)
      const res = callWithAsyncErrorHandling(hook, target, type, args)
      setCurrentInstance(null)
      return res
    })
  } else if (__DEV__) {
    const apiName = `on${capitalize(
      ErrorTypeStrings[name].replace(/ hook$/, '')
    )}`
    warn(
      `${apiName} is called when there is no active component instance to be ` +
        `associated with. ` +
        `Lifecycle injection APIs can only be used during execution of setup().`
    )
  }
}

export function onBeforeMount(
  hook: Function,
  target: ComponentInstance | null = currentInstance
) {
  injectHook(LifecycleHooks.BEFORE_MOUNT, hook, target)
}

export function onMounted(
  hook: Function,
  target: ComponentInstance | null = currentInstance
) {
  injectHook(LifecycleHooks.MOUNTED, hook, target)
}

export function onBeforeUpdate(
  hook: Function,
  target: ComponentInstance | null = currentInstance
) {
  injectHook(LifecycleHooks.BEFORE_UPDATE, hook, target)
}

export function onUpdated(
  hook: Function,
  target: ComponentInstance | null = currentInstance
) {
  injectHook(LifecycleHooks.UPDATED, hook, target)
}

export function onBeforeUnmount(
  hook: Function,
  target: ComponentInstance | null = currentInstance
) {
  injectHook(LifecycleHooks.BEFORE_UNMOUNT, hook, target)
}

export function onUnmounted(
  hook: Function,
  target: ComponentInstance | null = currentInstance
) {
  injectHook(LifecycleHooks.UNMOUNTED, hook, target)
}

export function onRenderTriggered(
  hook: Function,
  target: ComponentInstance | null = currentInstance
) {
  injectHook(LifecycleHooks.RENDER_TRIGGERED, hook, target)
}

export function onRenderTracked(
  hook: Function,
  target: ComponentInstance | null = currentInstance
) {
  injectHook(LifecycleHooks.RENDER_TRACKED, hook, target)
}

export function onErrorCaptured(
  hook: (
    err: Error,
    instance: ComponentRenderProxy | null,
    info: string
  ) => boolean | void,
  target: ComponentInstance | null = currentInstance
) {
  injectHook(LifecycleHooks.ERROR_CAPTURED, hook, target)
}
