import { EffectScope, isRef } from '@vue/reactivity'
import {
  EMPTY_OBJ,
  hasOwn,
  isArray,
  isBuiltInTag,
  isFunction,
} from '@vue/shared'
import type { Block } from './apiRender'
import {
  type ComponentPropsOptions,
  type NormalizedPropsOptions,
  type NormalizedRawProps,
  type RawProps,
  initProps,
  normalizePropsOptions,
} from './componentProps'
import {
  type EmitFn,
  type EmitsOptions,
  type ObjectEmitsOptions,
  emit,
  normalizeEmitsOptions,
} from './componentEmits'
import { type RawSlots, type StaticSlots, initSlots } from './componentSlots'
import { VaporLifecycleHooks } from './enums'
import { warn } from './warning'
import {
  type AppConfig,
  type AppContext,
  createAppContext,
} from './apiCreateVaporApp'
import type { Data } from '@vue/runtime-shared'

export type Component = FunctionalComponent | ObjectComponent

export type SetupFn = (props: any, ctx: SetupContext) => Block | Data | void
export type FunctionalComponent = SetupFn &
  Omit<ObjectComponent, 'setup'> & {
    displayName?: string
  }

export type SetupContext<E = EmitsOptions> = E extends any
  ? {
      attrs: Data
      emit: EmitFn<E>
      expose: (exposed?: Record<string, any>) => void
      slots: Readonly<StaticSlots>
    }
  : never

export function createSetupContext(
  instance: ComponentInternalInstance,
): SetupContext {
  const expose: SetupContext['expose'] = exposed => {
    if (__DEV__) {
      if (instance.exposed) {
        warn(`expose() should be called only once per setup().`)
      }
      if (exposed != null) {
        let exposedType: string = typeof exposed
        if (exposedType === 'object') {
          if (isArray(exposed)) {
            exposedType = 'array'
          } else if (isRef(exposed)) {
            exposedType = 'ref'
          }
        }
        if (exposedType !== 'object') {
          warn(
            `expose() should be passed a plain object, received ${exposedType}.`,
          )
        }
      }
    }
    instance.exposed = exposed || {}
  }

  if (__DEV__) {
    // We use getters in dev in case libs like test-utils overwrite instance
    // properties (overwrites should not be done in prod)
    return Object.freeze({
      get attrs() {
        return getAttrsProxy(instance)
      },
      get slots() {
        return getSlotsProxy(instance)
      },
      get emit() {
        return (event: string, ...args: any[]) => instance.emit(event, ...args)
      },
      expose,
    })
  } else {
    return {
      get attrs() {
        return getAttrsProxy(instance)
      },
      emit: instance.emit,
      slots: instance.slots,
      expose,
    }
  }
}

export interface ObjectComponent extends ComponentInternalOptions {
  setup?: SetupFn
  inheritAttrs?: boolean
  props?: ComponentPropsOptions
  emits?: EmitsOptions
  render?(ctx: any): Block

  name?: string
  vapor?: boolean
}

// Note: can't mark this whole interface internal because some public interfaces
// extend it.
export interface ComponentInternalOptions {
  /**
   * @internal
   */
  __scopeId?: string
  /**
   * @internal
   */
  __cssModules?: Data
  /**
   * @internal
   */
  __hmrId?: string
  /**
   * Compat build only, for bailing out of certain compatibility behavior
   */
  __isBuiltIn?: boolean
  /**
   * This one should be exposed so that devtools can make use of it
   */
  __file?: string
  /**
   * name inferred from filename
   */
  __name?: string
}

type LifecycleHook<TFn = Function> = TFn[] | null

export const componentKey: unique symbol = Symbol(__DEV__ ? `componentKey` : ``)

export interface ComponentInternalInstance {
  [componentKey]: true
  uid: number
  vapor: true
  appContext: AppContext

  type: Component
  block: Block | null
  container: ParentNode
  parent: ComponentInternalInstance | null
  root: ComponentInternalInstance

  provides: Data
  scope: EffectScope
  comps: Set<ComponentInternalInstance>

  rawProps: NormalizedRawProps
  propsOptions: NormalizedPropsOptions
  emitsOptions: ObjectEmitsOptions | null

  // state
  setupState: Data
  setupContext: SetupContext | null
  props: Data
  emit: EmitFn
  emitted: Record<string, boolean> | null
  attrs: Data
  slots: StaticSlots
  refs: Data
  // exposed properties via expose()
  exposed?: Record<string, any>

  attrsProxy?: Data
  slotsProxy?: StaticSlots

  // lifecycle
  isMounted: boolean
  isUnmounted: boolean
  isUpdating: boolean
  // TODO: registory of provides, lifecycles, ...
  /**
   * @internal
   */
  [VaporLifecycleHooks.BEFORE_MOUNT]: LifecycleHook
  /**
   * @internal
   */
  [VaporLifecycleHooks.MOUNTED]: LifecycleHook
  /**
   * @internal
   */
  [VaporLifecycleHooks.BEFORE_UPDATE]: LifecycleHook
  /**
   * @internal
   */
  [VaporLifecycleHooks.UPDATED]: LifecycleHook
  /**
   * @internal
   */
  [VaporLifecycleHooks.BEFORE_UNMOUNT]: LifecycleHook
  /**
   * @internal
   */
  [VaporLifecycleHooks.UNMOUNTED]: LifecycleHook
  /**
   * @internal
   */
  [VaporLifecycleHooks.RENDER_TRACKED]: LifecycleHook
  /**
   * @internal
   */
  [VaporLifecycleHooks.RENDER_TRIGGERED]: LifecycleHook
  /**
   * @internal
   */
  [VaporLifecycleHooks.ACTIVATED]: LifecycleHook
  /**
   * @internal
   */
  [VaporLifecycleHooks.DEACTIVATED]: LifecycleHook
  /**
   * @internal
   */
  [VaporLifecycleHooks.ERROR_CAPTURED]: LifecycleHook
  /**
   * @internal
   */
  // [VaporLifecycleHooks.SERVER_PREFETCH]: LifecycleHook<() => Promise<unknown>>
}

export let currentInstance: ComponentInternalInstance | null = null

export const getCurrentInstance: () => ComponentInternalInstance | null = () =>
  currentInstance

export const setCurrentInstance = (instance: ComponentInternalInstance) => {
  const prev = currentInstance
  currentInstance = instance
  return (): void => {
    currentInstance = prev
  }
}

export const unsetCurrentInstance = (): void => {
  currentInstance && currentInstance.scope.off()
  currentInstance = null
}

const emptyAppContext = createAppContext()

let uid = 0
export function createComponentInstance(
  component: Component,
  rawProps: RawProps | null,
  slots: RawSlots | null,
  once: boolean = false,
  // application root node only
  appContext?: AppContext,
): ComponentInternalInstance {
  const parent = getCurrentInstance()
  const _appContext =
    (parent ? parent.appContext : appContext) || emptyAppContext

  const instance: ComponentInternalInstance = {
    [componentKey]: true,
    uid: uid++,
    vapor: true,
    appContext: _appContext,

    block: null,
    container: null!,

    parent,
    root: null!, // set later

    scope: new EffectScope(true /* detached */)!,
    provides: parent ? parent.provides : Object.create(_appContext.provides),
    type: component,
    comps: new Set(),

    // resolved props and emits options
    rawProps: null!, // set later
    propsOptions: normalizePropsOptions(component),
    emitsOptions: normalizeEmitsOptions(component),

    // state
    setupState: EMPTY_OBJ,
    setupContext: null,
    props: EMPTY_OBJ,
    emit: null!,
    emitted: null,
    attrs: EMPTY_OBJ,
    slots: EMPTY_OBJ,
    refs: EMPTY_OBJ,

    // lifecycle
    isMounted: false,
    isUnmounted: false,
    isUpdating: false,
    // TODO: registory of provides, appContext, lifecycles, ...
    /**
     * @internal
     */
    [VaporLifecycleHooks.BEFORE_MOUNT]: null,
    /**
     * @internal
     */
    [VaporLifecycleHooks.MOUNTED]: null,
    /**
     * @internal
     */
    [VaporLifecycleHooks.BEFORE_UPDATE]: null,
    /**
     * @internal
     */
    [VaporLifecycleHooks.UPDATED]: null,
    /**
     * @internal
     */
    [VaporLifecycleHooks.BEFORE_UNMOUNT]: null,
    /**
     * @internal
     */
    [VaporLifecycleHooks.UNMOUNTED]: null,
    /**
     * @internal
     */
    [VaporLifecycleHooks.RENDER_TRACKED]: null,
    /**
     * @internal
     */
    [VaporLifecycleHooks.RENDER_TRIGGERED]: null,
    /**
     * @internal
     */
    [VaporLifecycleHooks.ACTIVATED]: null,
    /**
     * @internal
     */
    [VaporLifecycleHooks.DEACTIVATED]: null,
    /**
     * @internal
     */
    [VaporLifecycleHooks.ERROR_CAPTURED]: null,
    /**
     * @internal
     */
    // [VaporLifecycleHooks.SERVER_PREFETCH]: null,
  }
  instance.root = parent ? parent.root : instance
  initProps(instance, rawProps, !isFunction(component), once)
  initSlots(instance, slots)
  instance.emit = emit.bind(null, instance)

  return instance
}

export function isVaporComponent(
  val: unknown,
): val is ComponentInternalInstance {
  return !!val && hasOwn(val, componentKey)
}

export function validateComponentName(
  name: string,
  { isNativeTag }: AppConfig,
): void {
  if (isBuiltInTag(name) || isNativeTag(name)) {
    warn(
      'Do not use built-in or reserved HTML elements as component id: ' + name,
    )
  }
}

function getAttrsProxy(instance: ComponentInternalInstance): Data {
  return (
    instance.attrsProxy ||
    (instance.attrsProxy = new Proxy(
      instance.attrs,
      __DEV__
        ? {
            get(target, key: string) {
              return target[key]
            },
            set() {
              warn(`setupContext.attrs is readonly.`)
              return false
            },
            deleteProperty() {
              warn(`setupContext.attrs is readonly.`)
              return false
            },
          }
        : {
            get(target, key: string) {
              return target[key]
            },
          },
    ))
  )
}

/**
 * Dev-only
 */
function getSlotsProxy(instance: ComponentInternalInstance): StaticSlots {
  return (
    instance.slotsProxy ||
    (instance.slotsProxy = new Proxy(instance.slots, {
      get(target, key: string) {
        return target[key]
      },
    }))
  )
}

export function getComponentName(
  Component: Component,
  includeInferred = true,
): string | false | undefined {
  return isFunction(Component)
    ? Component.displayName || Component.name
    : Component.name || (includeInferred && Component.__name)
}

export function formatComponentName(
  instance: ComponentInternalInstance | null,
  Component: Component,
  isRoot = false,
): string {
  let name = getComponentName(Component)
  if (!name && Component.__file) {
    const match = Component.__file.match(/([^/\\]+)\.\w+$/)
    if (match) {
      name = match[1]
    }
  }

  if (!name && instance && instance.parent) {
    // try to infer the name based on reverse resolution
    const inferFromRegistry = (registry: Record<string, any> | undefined) => {
      for (const key in registry) {
        if (registry[key] === Component) {
          return key
        }
      }
    }
    name = inferFromRegistry(instance.appContext.components)
  }

  return name ? classify(name) : isRoot ? `App` : `Anonymous`
}

const classifyRE = /(?:^|[-_])(\w)/g
const classify = (str: string): string =>
  str.replace(classifyRE, c => c.toUpperCase()).replace(/[-_]/g, '')
