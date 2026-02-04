import { isFunction } from '@vue/shared'
import { currentInstance, getCurrentInstance } from './component'
import { currentApp } from './apiCreateApp'
import { warn } from './warning'

interface InjectionConstraint<T> {}

export type InjectionKey<T> = symbol & InjectionConstraint<T>

/**
 * 提供一个依赖项供组件内部或子组件通过inject函数注入使用。
 * @param key 依赖项的键，可以是InjectionKey类型，字符串或数字。
 * @param value 对应于key的依赖项的值。如果key是InjectionKey，则value的类型须与InjectionKey指定的类型匹配；否则，value的类型与T相同。
 */
export function provide<T, K = InjectionKey<T> | string | number>(
  key: K,
  value: K extends InjectionKey<infer V> ? V : T,
): void {
  if (__DEV__) {
    if (!currentInstance || currentInstance.isMounted) {
      warn(`provide() can only be used inside setup().`)
    }
  }
  if (currentInstance) {
    let provides = currentInstance.provides
    // 检查当前实例是否继承了父实例的provides对象。如果没有，则创建一个新的provides对象，以父实例的provides对象为原型。
    // 这种方式确保在inject时可以从直接父组件获取注入项，并利用原型链完成工作。
    // by default an instance inherits its parent's provides object
    // but when it needs to provide values of its own, it creates its
    // own provides object using parent provides object as prototype.
    // this way in `inject` we can simply look up injections from direct
    // parent and let the prototype chain do the work.
    const parentProvides =
      currentInstance.parent && currentInstance.parent.provides
    if (parentProvides === provides) {
      provides = currentInstance.provides = Object.create(parentProvides)
    }
    // 由于TypeScript不支持将符号作为索引类型，因此这里将key强制转换为字符串类型，并将value赋值给provides对象的相应键。
    // TS doesn't allow symbol as index type
    provides[key as string] = value
  }
}

export function inject<T>(key: InjectionKey<T> | string): T | undefined
export function inject<T>(
  key: InjectionKey<T> | string,
  defaultValue: T,
  treatDefaultAsFactory?: false,
): T
export function inject<T>(
  key: InjectionKey<T> | string,
  defaultValue: T | (() => T),
  treatDefaultAsFactory: true,
): T

/**
 * 注入依赖项。
 *
 * @param key 依赖的键，可以是InjectionKey或字符串。
 * @param defaultValue 可选的默认值，当依赖未找到时使用。
 * @param treatDefaultAsFactory 是否将默认值视为工厂函数，默认为false。
 * @returns 返回注入的依赖项，如果没有找到依赖且未提供默认值，则返回undefined。
 */
export function inject(
  key: InjectionKey<any> | string,
  defaultValue?: unknown,
  treatDefaultAsFactory = false,
) {
  // 在函数组件内调用时，回退到currentRenderingInstance
  // fallback to `currentRenderingInstance` so that this can be called in
  // a functional component
  const instance = getCurrentInstance()

  // 支持从应用级别的provides中查找，通过app.runWithContext()
  // also support looking up from app-level provides w/ `app.runWithContext()`
  if (instance || currentApp) {
    // 为了支持app.use的插件，在根实例中回退到appContext的provides
    // #2400
    // to support `app.use` plugins,
    // fallback to appContext's `provides` if the instance is at root
    // #11488, in a nested createApp, prioritize using the provides from currentApp
    // #13212, for custom elements we must get injected values from its appContext
    // as it already inherits the provides object from the parent element
    let provides = currentApp
      ? currentApp._context.provides
      : instance
        ? instance.parent == null || instance.ce
          ? instance.vnode.appContext && instance.vnode.appContext.provides
          : instance.parent.provides
        : undefined

    // 如果provides中存在key，则返回对应的值
    if (provides && (key as string | symbol) in provides) {
      // 由于TypeScript不支持将symbol作为索引类型，这里进行类型断言
      // TS doesn't allow symbol as index type
      return provides[key as string]
    } else if (arguments.length > 1) {
      // 如果提供了默认值，根据treatDefaultAsFactory的值决定如何处理
      return treatDefaultAsFactory && isFunction(defaultValue)
        ? defaultValue.call(instance && instance.proxy)
        : defaultValue
    } else if (__DEV__) {
      // 开发环境下，未找到依赖且未提供默认值时发出警告
      warn(`injection "${String(key)}" not found.`)
    }
  } else if (__DEV__) {
    // 开发环境下，不在setup函数或功能性组件内调用inject时发出警告
    warn(`inject() can only be used inside setup() or functional components.`)
  }
}

/**
 * 检查当前执行环境是否有注入上下文
 * Returns true if `inject()` can be used without warning about being called in the wrong place (e.g. outside of
 * setup()). This is used by libraries that want to use `inject()` internally without triggering a warning to the end
 * user. One example is `useRoute()` in `vue-router`.
 */
export function hasInjectionContext(): boolean {
  // 判断当前实例、当前渲染实例或当前应用是否存在，存在则返回true
  return !!(getCurrentInstance() || currentApp)
}
