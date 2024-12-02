import { EffectScope, isRef } from '@vue/reactivity'
import { EMPTY_OBJ, isArray, isBuiltInTag, isFunction } from '@vue/shared'
import type { Block } from './block'
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

type SharedInternalOptions = {
  __propsOptions?: NormalizedPropsOptions
  __propsHandlers?: [ProxyHandler<any>, ProxyHandler<any>]
}

export type SetupFn = (
  props: any,
  ctx: SetupContext,
) => Block | Data | undefined

export type FunctionalComponent = SetupFn &
  Omit<ObjectComponent, 'setup'> & {
    displayName?: string
  } & SharedInternalOptions

export class SetupContext<E = EmitsOptions> {
  attrs: Data
  emit: EmitFn<E>
  slots: Readonly<StaticSlots>
  expose: (exposed?: Record<string, any>) => void

  constructor(instance: ComponentInternalInstance) {
    this.attrs = instance.attrs
    this.emit = instance.emit as EmitFn<E>
    this.slots = instance.slots
    this.expose = (exposed = {}) => {
      instance.exposed = exposed
    }
  }
}

export function createSetupContext(
  instance: ComponentInternalInstance,
): SetupContext {
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
      expose: (exposed?: Record<string, any>) => {
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
        instance.exposed = exposed || {}
      },
    }) as SetupContext
  } else {
    return new SetupContext(instance)
  }
}

export interface ObjectComponent
  extends ComponentInternalOptions,
    SharedInternalOptions {
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
export class ComponentInternalInstance {
  vapor = true

  uid: number
  appContext: AppContext

  type: Component
  block: Block | null
  container: ParentNode
  parent: ComponentInternalInstance | null
  root: ComponentInternalInstance

  provides: Data
  scope: EffectScope
  comps: Set<ComponentInternalInstance>
  scopeIds: string[]

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
  /**
   * - `undefined` : no props
   * - `false`     : all props are static
   * - `string[]`  : list of props are dynamic
   * - `true`      : all props as dynamic
   */
  dynamicAttrs?: string[] | boolean
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
  // [VaporLifecycleHooks.BEFORE_MOUNT]: LifecycleHook;
  bm: LifecycleHook
  /**
   * @internal
   */
  // [VaporLifecycleHooks.MOUNTED]: LifecycleHook;
  m: LifecycleHook
  /**
   * @internal
   */
  // [VaporLifecycleHooks.BEFORE_UPDATE]: LifecycleHook;
  bu: LifecycleHook
  /**
   * @internal
   */
  // [VaporLifecycleHooks.UPDATED]: LifecycleHook;
  u: LifecycleHook
  /**
   * @internal
   */
  // [VaporLifecycleHooks.BEFORE_UNMOUNT]: LifecycleHook;
  bum: LifecycleHook
  /**
   * @internal
   */
  // [VaporLifecycleHooks.UNMOUNTED]: LifecycleHook;
  um: LifecycleHook
  /**
   * @internal
   */
  // [VaporLifecycleHooks.RENDER_TRACKED]: LifecycleHook;
  rtc: LifecycleHook
  /**
   * @internal
   */
  // [VaporLifecycleHooks.RENDER_TRIGGERED]: LifecycleHook;
  rtg: LifecycleHook
  /**
   * @internal
   */
  // [VaporLifecycleHooks.ACTIVATED]: LifecycleHook;
  a: LifecycleHook
  /**
   * @internal
   */
  // [VaporLifecycleHooks.DEACTIVATED]: LifecycleHook;
  da: LifecycleHook
  /**
   * @internal
   */
  // [VaporLifecycleHooks.ERROR_CAPTURED]: LifecycleHook
  ec: LifecycleHook

  constructor(
    component: Component,
    rawProps: RawProps | null,
    slots: RawSlots | null,
    once: boolean = false,
    // application root node only
    appContext?: AppContext,
  ) {
    this.uid = uid++
    const parent = (this.parent = currentInstance)
    this.root = parent ? parent.root : this
    const _appContext = (this.appContext =
      (parent ? parent.appContext : appContext) || emptyAppContext)
    this.block = null
    this.container = null!
    this.root = null!
    this.scope = new EffectScope(true)
    this.provides = parent
      ? parent.provides
      : Object.create(_appContext.provides)
    this.type = component
    this.comps = new Set()
    this.scopeIds = []
    this.rawProps = null!
    this.propsOptions = normalizePropsOptions(component)
    this.emitsOptions = normalizeEmitsOptions(component)

    // state
    this.setupState = EMPTY_OBJ
    this.setupContext = null
    this.props = EMPTY_OBJ
    this.emit = emit.bind(null, this)
    this.emitted = null
    this.attrs = EMPTY_OBJ
    this.slots = EMPTY_OBJ
    this.refs = EMPTY_OBJ

    // lifecycle
    this.isMounted = false
    this.isUnmounted = false
    this.isUpdating = false
    this[VaporLifecycleHooks.BEFORE_MOUNT] = null
    this[VaporLifecycleHooks.MOUNTED] = null
    this[VaporLifecycleHooks.BEFORE_UPDATE] = null
    this[VaporLifecycleHooks.UPDATED] = null
    this[VaporLifecycleHooks.BEFORE_UNMOUNT] = null
    this[VaporLifecycleHooks.UNMOUNTED] = null
    this[VaporLifecycleHooks.RENDER_TRACKED] = null
    this[VaporLifecycleHooks.RENDER_TRIGGERED] = null
    this[VaporLifecycleHooks.ACTIVATED] = null
    this[VaporLifecycleHooks.DEACTIVATED] = null
    this[VaporLifecycleHooks.ERROR_CAPTURED] = null

    initProps(this, rawProps, !isFunction(component), once)
    initSlots(this, slots)
  }
}

export function isVaporComponent(
  val: unknown,
): val is ComponentInternalInstance {
  return val instanceof ComponentInternalInstance
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

/**
 * Dev-only
 */
export function getAttrsProxy(instance: ComponentInternalInstance): Data {
  return (
    instance.attrsProxy ||
    (instance.attrsProxy = new Proxy(instance.attrs, {
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
    }))
  )
}

/**
 * Dev-only
 */
export function getSlotsProxy(
  instance: ComponentInternalInstance,
): StaticSlots {
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
): string | false | undefined {
  return isFunction(Component)
    ? Component.displayName || Component.name
    : Component.name || Component.__name
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
