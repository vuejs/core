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

/**
 * 注入一个生命周期钩子到目标组件实例中。
 *
 * @param type 钩子类型，指定要注入的生命周期阶段。
 * @param hook 钩子函数，将被注入到组件的生命周期中。如果钩子函数有错误处理需求，可以使用`__weh`属性进行包装。
 * @param target 目标组件实例，钩子将被注入到这个实例中。默认为当前活动的组件实例。
 * @param prepend 如果为`true`，则钩子将被添加到数组的开头，否则添加到末尾。
 * @returns 返回被注入的钩子的包装函数，如果没有目标实例则返回`undefined`。
 */
export function injectHook(
  type: LifecycleHooks,
  hook: Function & { __weh?: Function },
  target: ComponentInternalInstance | null = currentInstance,
  prepend: boolean = false,
): Function | undefined {
  // 如果存在目标实例，执行钩子注入
  if (target) {
    // 为注入的钩子缓存错误处理包装函数，确保相同的钩子能被调度器正确去重。
    const hooks = target[type] || (target[type] = [])
    // cache the error handling wrapper for injected hooks so the same hook
    // can be properly deduped by the scheduler. "__weh" stands for "with error
    // handling".
    const wrappedHook =
      hook.__weh ||
      (hook.__weh = (...args: unknown[]) => {
        if (target.isUnmounted) {
          return
        }
        // 在所有生命周期钩子内禁用追踪，因为它们可能在副作用中被调用。
        // disable tracking inside all lifecycle hooks
        // since they can potentially be called inside effects.
        pauseTracking()
        // 在钩子调用期间设置当前实例。
        // Set currentInstance during hook invocation.
        // This assumes the hook does not synchronously trigger other hooks, which
        // can only be false when the user does something really funky.
        const reset = setCurrentInstance(target)
        const res = callWithAsyncErrorHandling(hook, target, type, args)
        reset()
        resetTracking()
        return res
      })
    // 根据prepend参数，将钩子添加到hooks数组的开头或末尾
    if (prepend) {
      hooks.unshift(wrappedHook)
    } else {
      hooks.push(wrappedHook)
    }
    return wrappedHook
  } else if (__DEV__) {
    // 开发环境下，如果没有活动的组件实例与之关联，将发出警告
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

/**
 * 创建一个生命周期钩子的快捷方法。
 * @param lifecycle 生命周期阶段。
 * @returns 返回一个函数，该函数用于注册一个生命周期钩子。
 */
export const createHook =
  <T extends Function = () => any>(lifecycle: LifecycleHooks) =>
  (hook: T, target: ComponentInternalInstance | null = currentInstance) =>
    // 在SSR渲染过程中，除了serverPrefetch钩子外，其它的后置生命周期注册都是无操作
    // post-create lifecycle registrations are noops during SSR (except for serverPrefetch)
    (!isInSSRComponentSetup || lifecycle === LifecycleHooks.SERVER_PREFETCH) &&
    injectHook(lifecycle, (...args: unknown[]) => hook(...args), target)

// 以下为生命周期钩子的快捷方法声明
export const onBeforeMount = createHook(LifecycleHooks.BEFORE_MOUNT)
export const onMounted = createHook(LifecycleHooks.MOUNTED)
export const onBeforeUpdate = createHook(LifecycleHooks.BEFORE_UPDATE)
export const onUpdated = createHook(LifecycleHooks.UPDATED)
export const onBeforeUnmount = createHook(LifecycleHooks.BEFORE_UNMOUNT)
export const onUnmounted = createHook(LifecycleHooks.UNMOUNTED)
export const onServerPrefetch = createHook(LifecycleHooks.SERVER_PREFETCH)

export type DebuggerHook = (e: DebuggerEvent) => void

/**
 * 创建一个钩子，用于监听渲染触发的生命周期事件。
 * @returns 返回一个DebuggerHook类型的钩子。
 */
export const onRenderTriggered = createHook<DebuggerHook>(
  LifecycleHooks.RENDER_TRIGGERED,
)

/**
 * 创建一个钩子，用于监听渲染追踪的生命周期事件。
 * @returns 返回一个DebuggerHook类型的钩子。
 */
export const onRenderTracked = createHook<DebuggerHook>(
  LifecycleHooks.RENDER_TRACKED,
)

export type ErrorCapturedHook<TError = unknown> = (
  err: TError,
  instance: ComponentPublicInstance | null,
  info: string,
) => boolean | void

/**
 * 注册一个错误捕获的生命周期钩子
 *
 * @param hook 错误捕获的钩子函数。
 * @param target  目标组件实例，钩子将被注入到这个实例中。默认为当前活动的
 */
export function onErrorCaptured<TError = Error>(
  hook: ErrorCapturedHook<TError>,
  target: ComponentInternalInstance | null = currentInstance,
) {
  injectHook(LifecycleHooks.ERROR_CAPTURED, hook, target)
}
