import { ComponentInstance, LifecycleHooks, currentInstance } from './component'

function injectHook(
  name: keyof LifecycleHooks,
  hook: () => void,
  target: ComponentInstance | null | void = currentInstance
) {
  if (target) {
    // TODO inject a error-handling wrapped version of the hook
    // TODO also set currentInstance when calling the hook
    ;(target[name] || (target[name] = [])).push(hook)
  } else {
    // TODO warn
  }
}

export function onBeforeMount(hook: () => void, target?: ComponentInstance) {
  injectHook('bm', hook, target)
}

export function onMounted(hook: () => void, target?: ComponentInstance) {
  injectHook('m', hook, target)
}

export function onBeforeUpdate(hook: () => void, target?: ComponentInstance) {
  injectHook('bu', hook, target)
}

export function onUpdated(hook: () => void, target?: ComponentInstance) {
  injectHook('u', hook, target)
}

export function onBeforeUnmount(hook: () => void, target?: ComponentInstance) {
  injectHook('bum', hook, target)
}

export function onUnmounted(hook: () => void, target?: ComponentInstance) {
  injectHook('um', hook, target)
}

export function onRenderTriggered(
  hook: () => void,
  target?: ComponentInstance
) {
  injectHook('rtg', hook, target)
}

export function onRenderTracked(hook: () => void, target?: ComponentInstance) {
  injectHook('rtc', hook, target)
}

export function onErrorCaptured(hook: () => void, target?: ComponentInstance) {
  injectHook('ec', hook, target)
}
