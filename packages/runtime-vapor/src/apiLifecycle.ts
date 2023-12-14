import { type ComponentInternalInstance, currentInstance } from './component'

export enum VaporLifecycleHooks {
  BEFORE_CREATE = 'bc',
  CREATED = 'c',
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

export const injectHook = (
  type: VaporLifecycleHooks,
  hook: Function,
  target: ComponentInternalInstance | null = currentInstance,
  prepend: boolean = false,
) => {
  if (target) {
    const hooks = target[type] || (target[type] = [])
    if (prepend) {
      hooks.unshift(hook)
    } else {
      hooks.push(hook)
    }
    return hook
  } else if (__DEV__) {
    // TODO: warn need
  }
}
export const createHook =
  <T extends Function = () => any>(lifecycle: VaporLifecycleHooks) =>
  (hook: T, target: ComponentInternalInstance | null = currentInstance) =>
    injectHook(lifecycle, (...args: unknown[]) => hook(...args), target)

export const onBeforeMount = createHook(VaporLifecycleHooks.BEFORE_MOUNT)
export const onMounted = createHook(VaporLifecycleHooks.MOUNTED)
export const onBeforeUpdate = createHook(VaporLifecycleHooks.BEFORE_UPDATE)
export const onUpdated = createHook(VaporLifecycleHooks.UPDATED)
export const onBeforeUnmount = createHook(VaporLifecycleHooks.BEFORE_UNMOUNT)
export const onUnmounted = createHook(VaporLifecycleHooks.UNMOUNTED)
