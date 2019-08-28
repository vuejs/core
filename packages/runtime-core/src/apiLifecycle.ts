import { ComponentInstance, LifecycleHooks, currentInstance } from './component'

function injectHook(
  name: keyof LifecycleHooks,
  hook: Function,
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

export function onBeforeMount(hook: Function, target?: ComponentInstance) {
  injectHook('bm', hook, target)
}

export function onMounted(hook: Function, target?: ComponentInstance) {
  injectHook('m', hook, target)
}

export function onBeforeUpdate(hook: Function, target?: ComponentInstance) {
  injectHook('bu', hook, target)
}

export function onUpdated(hook: Function, target?: ComponentInstance) {
  injectHook('u', hook, target)
}

export function onBeforeUnmount(hook: Function, target?: ComponentInstance) {
  injectHook('bum', hook, target)
}

export function onUnmounted(hook: Function, target?: ComponentInstance) {
  injectHook('um', hook, target)
}

export function onRenderTriggered(hook: Function, target?: ComponentInstance) {
  injectHook('rtg', hook, target)
}

export function onRenderTracked(hook: Function, target?: ComponentInstance) {
  injectHook('rtc', hook, target)
}

export function onErrorCaptured(hook: Function, target?: ComponentInstance) {
  injectHook('ec', hook, target)
}
