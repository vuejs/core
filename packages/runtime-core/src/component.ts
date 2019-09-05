import { VNode, normalizeVNode, VNodeChild, createVNode, Empty } from './vnode'
import { ReactiveEffect, UnwrapRef, reactive, readonly } from '@vue/reactivity'
import {
  EMPTY_OBJ,
  isFunction,
  capitalize,
  NOOP,
  isArray,
  isObject
} from '@vue/shared'
import { RenderProxyHandlers } from './componentProxy'
import { ComponentPropsOptions, ExtractPropTypes } from './componentProps'
import { Slots } from './componentSlots'
import { PatchFlags } from './patchFlags'
import { ShapeFlags } from './shapeFlags'
import { warn } from './warning'
import {
  ErrorTypes,
  handleError,
  callWithErrorHandling,
  callWithAsyncErrorHandling
} from './errorHandling'
import { AppContext, createAppContext } from './apiApp'
import { Directive } from './directives'
import {
  applyOptions,
  LegacyOptions,
  resolveAsset,
  ComputedOptions,
  MethodOptions,
  ExtracComputedReturns
} from './apiOptions'

export type Data = { [key: string]: unknown }

// public properties exposed on the proxy, which is used as the render context
// in templates (as `this` in the render option)
export type ComponentRenderProxy<
  P = {},
  B = {},
  D = {},
  C = {},
  M = {},
  PublicProps = P
> = {
  $data: D
  $props: PublicProps
  $attrs: Data
  $refs: Data
  $slots: Data
  $root: ComponentInstance | null
  $parent: ComponentInstance | null
  $emit: (event: string, ...args: unknown[]) => void
} & P &
  UnwrapRef<B> &
  D &
  ExtracComputedReturns<C> &
  M

interface ComponentOptionsBase<
  Props,
  RawBindings,
  D,
  C extends ComputedOptions,
  M extends MethodOptions
> extends LegacyOptions<Props, RawBindings, D, C, M> {
  setup?: (
    this: null,
    props: Props,
    ctx: SetupContext
  ) => RawBindings | (() => VNodeChild) | void
  name?: string
  template?: string
  // Note: we are intentionally using the signature-less `Function` type here
  // since any type with signature will cause the whole inference to fail when
  // the return expression contains reference to `this`.
  // Luckily `render()` doesn't need any arguments nor does it care about return
  // type.
  render?: Function
  components?: Record<string, Component>
  directives?: Record<string, Directive>
}

export type ComponentOptionsWithoutProps<
  Props = {},
  RawBindings = {},
  D = {},
  C extends ComputedOptions = {},
  M extends MethodOptions = {}
> = ComponentOptionsBase<Props, RawBindings, D, C, M> & {
  props?: undefined
} & ThisType<ComponentRenderProxy<Props, RawBindings, D, C, M>>

export type ComponentOptionsWithArrayProps<
  PropNames extends string = string,
  RawBindings = {},
  D = {},
  C extends ComputedOptions = {},
  M extends MethodOptions = {},
  Props = { [key in PropNames]?: unknown }
> = ComponentOptionsBase<Props, RawBindings, D, C, M> & {
  props: PropNames[]
} & ThisType<ComponentRenderProxy<Props, RawBindings, D, C, M>>

export type ComponentOptionsWithProps<
  PropsOptions = ComponentPropsOptions,
  RawBindings = {},
  D = {},
  C extends ComputedOptions = {},
  M extends MethodOptions = {},
  Props = ExtractPropTypes<PropsOptions>
> = ComponentOptionsBase<Props, RawBindings, D, C, M> & {
  props: PropsOptions
} & ThisType<ComponentRenderProxy<Props, RawBindings, D, C, M>>

export type ComponentOptions =
  | ComponentOptionsWithoutProps
  | ComponentOptionsWithProps
  | ComponentOptionsWithArrayProps

export interface FunctionalComponent<P = {}> {
  (props: P, ctx: SetupContext): VNodeChild
  props?: ComponentPropsOptions<P>
  displayName?: string
}

export type Component = ComponentOptions | FunctionalComponent

type LifecycleHook = Function[] | null

export const enum LifecycleHooks {
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
  ERROR_CAPTURED = 'ec'
}

interface SetupContext {
  attrs: Data
  slots: Slots
  emit: ((event: string, ...args: unknown[]) => void)
}

type RenderFunction = () => VNodeChild

export type ComponentInstance<P = Data, D = Data> = {
  type: FunctionalComponent | ComponentOptions
  parent: ComponentInstance | null
  appContext: AppContext
  root: ComponentInstance
  vnode: VNode
  next: VNode | null
  subTree: VNode
  update: ReactiveEffect
  render: RenderFunction | null
  effects: ReactiveEffect[] | null
  provides: Data

  components: Record<string, Component>
  directives: Record<string, Directive>

  // the rest are only for stateful components
  data: D
  props: P
  renderProxy: ComponentRenderProxy | null
  propsProxy: P | null
  setupContext: SetupContext | null
  refs: Data

  // user namespace
  user: { [key: string]: any }

  // lifecycle
  [LifecycleHooks.BEFORE_CREATE]: LifecycleHook
  [LifecycleHooks.CREATED]: LifecycleHook
  [LifecycleHooks.BEFORE_MOUNT]: LifecycleHook
  [LifecycleHooks.MOUNTED]: LifecycleHook
  [LifecycleHooks.BEFORE_UPDATE]: LifecycleHook
  [LifecycleHooks.UPDATED]: LifecycleHook
  [LifecycleHooks.BEFORE_UNMOUNT]: LifecycleHook
  [LifecycleHooks.UNMOUNTED]: LifecycleHook
  [LifecycleHooks.RENDER_TRACKED]: LifecycleHook
  [LifecycleHooks.RENDER_TRIGGERED]: LifecycleHook
  [LifecycleHooks.ACTIVATED]: LifecycleHook
  [LifecycleHooks.DEACTIVATED]: LifecycleHook
  [LifecycleHooks.ERROR_CAPTURED]: LifecycleHook
} & SetupContext

// createComponent
// overload 1: direct setup function
// (uses user defined props interface)
export function createComponent<Props>(
  setup: (props: Props, ctx: SetupContext) => object | (() => VNodeChild)
): (props: Props) => any
// overload 2: object format with no props
// (uses user defined props interface)
// return type is for Vetur and TSX support
export function createComponent<
  Props,
  RawBindings,
  D,
  C extends ComputedOptions = {},
  M extends MethodOptions = {}
>(
  options: ComponentOptionsWithoutProps<Props, RawBindings, D, C, M>
): {
  new (): ComponentRenderProxy<Props, RawBindings, D, C, M>
}
// overload 3: object format with array props declaration
// props inferred as { [key in PropNames]?: unknown }
// return type is for Vetur and TSX support
export function createComponent<
  PropNames extends string,
  RawBindings,
  D,
  C extends ComputedOptions = {},
  M extends MethodOptions = {}
>(
  options: ComponentOptionsWithArrayProps<PropNames, RawBindings, D, C, M>
): {
  new (): ComponentRenderProxy<
    { [key in PropNames]?: unknown },
    RawBindings,
    D,
    C,
    M
  >
}
// overload 4: object format with object props declaration
// see `ExtractPropTypes` in ./componentProps.ts
export function createComponent<
  PropsOptions,
  RawBindings,
  D,
  C extends ComputedOptions = {},
  M extends MethodOptions = {}
>(
  options: ComponentOptionsWithProps<PropsOptions, RawBindings, D, C, M>
): {
  // for Vetur and TSX support
  new (): ComponentRenderProxy<
    ExtractPropTypes<PropsOptions>,
    RawBindings,
    D,
    C,
    M,
    ExtractPropTypes<PropsOptions, false>
  >
}
// implementation, close to no-op
export function createComponent(options: any) {
  return isFunction(options) ? { setup: options } : (options as any)
}

const emptyAppContext = createAppContext()

export function createComponentInstance(
  vnode: VNode,
  parent: ComponentInstance | null
): ComponentInstance {
  // inherit parent app context - or - if root, adopt from root vnode
  const appContext =
    (parent ? parent.appContext : vnode.appContext) || emptyAppContext
  const instance = {
    vnode,
    parent,
    appContext,
    type: vnode.type as Component,
    root: null as any, // set later so it can point to itself
    next: null,
    subTree: null as any,
    update: null as any,
    render: null,
    renderProxy: null,
    propsProxy: null,
    setupContext: null,
    effects: null,
    provides: parent ? parent.provides : Object.create(appContext.provides),

    // setup context properties
    data: EMPTY_OBJ,
    props: EMPTY_OBJ,
    attrs: EMPTY_OBJ,
    slots: EMPTY_OBJ,
    refs: EMPTY_OBJ,

    // per-instance asset storage (mutable during options resolution)
    components: Object.create(appContext.components),
    directives: Object.create(appContext.directives),

    // user namespace for storing whatever the user assigns to `this`
    user: {},

    // lifecycle hooks
    // not using enums here because it results in computed properties
    bc: null,
    c: null,
    bm: null,
    m: null,
    bu: null,
    u: null,
    um: null,
    bum: null,
    da: null,
    a: null,
    rtg: null,
    rtc: null,
    ec: null,

    emit: (event: string, ...args: unknown[]) => {
      const props = instance.vnode.props || EMPTY_OBJ
      const handler = props[`on${event}`] || props[`on${capitalize(event)}`]
      if (handler) {
        if (isArray(handler)) {
          for (let i = 0; i < handler.length; i++) {
            callWithAsyncErrorHandling(
              handler[i],
              instance,
              ErrorTypes.COMPONENT_EVENT_HANDLER,
              args
            )
          }
        } else {
          callWithAsyncErrorHandling(
            handler,
            instance,
            ErrorTypes.COMPONENT_EVENT_HANDLER,
            args
          )
        }
      }
    }
  }

  instance.root = parent ? parent.root : instance
  return instance
}

export let currentInstance: ComponentInstance | null = null

export const getCurrentInstance: () => ComponentInstance | null = () =>
  currentInstance

export const setCurrentInstance = (instance: ComponentInstance | null) => {
  currentInstance = instance
}

export function setupStatefulComponent(instance: ComponentInstance) {
  currentInstance = instance
  const Component = instance.type as ComponentOptions
  // 1. create render proxy
  instance.renderProxy = new Proxy(instance, RenderProxyHandlers) as any
  // 2. create props proxy
  // the propsProxy is a reactive AND readonly proxy to the actual props.
  // it will be updated in resolveProps() on updates before render
  const propsProxy = (instance.propsProxy = readonly(instance.props))
  // 3. call setup()
  const { setup } = Component
  if (setup) {
    const setupContext = (instance.setupContext =
      setup.length > 1 ? createSetupContext(instance) : null)
    const setupResult = callWithErrorHandling(
      setup,
      instance,
      ErrorTypes.SETUP_FUNCTION,
      [propsProxy, setupContext]
    )

    if (isFunction(setupResult)) {
      // setup returned an inline render function
      instance.render = setupResult
    } else {
      if (__DEV__) {
        if (!Component.render) {
          warn(
            `Component is missing render function. Either provide a template or ` +
              `return a render function from setup().`
          )
        }
        if (
          setupResult &&
          typeof setupResult.then === 'function' &&
          typeof setupResult.catch === 'function'
        ) {
          warn(`setup() returned a Promise. setup() cannot be async.`)
        }
      }
      // setup returned bindings.
      // assuming a render function compiled from template is present.
      if (isObject(setupResult)) {
        instance.data = reactive(setupResult)
      } else if (__DEV__ && setupResult !== undefined) {
        warn(
          `setup() should return an object. Received: ${
            setupResult === null ? 'null' : typeof setupResult
          }`
        )
      }
      instance.render = (Component.render || NOOP) as RenderFunction
    }
  } else {
    if (__DEV__ && !Component.render) {
      warn(
        `Component is missing render function. Either provide a template or ` +
          `return a render function from setup().`
      )
    }
    instance.render = Component.render as RenderFunction
  }
  // support for 2.x options
  if (__FEATURE_OPTIONS__) {
    applyOptions(instance, Component)
  }
  if (instance.data === EMPTY_OBJ) {
    instance.data = reactive({})
  }
  currentInstance = null
}

// used to identify a setup context proxy
export const SetupProxySymbol = Symbol()

const SetupProxyHandlers: { [key: string]: ProxyHandler<any> } = {}
;['attrs', 'slots', 'refs'].forEach((type: string) => {
  SetupProxyHandlers[type] = {
    get: (instance, key) => (instance[type] as any)[key],
    has: (instance, key) =>
      key === SetupProxySymbol || key in (instance[type] as any),
    ownKeys: instance => Reflect.ownKeys(instance[type] as any),
    // this is necessary for ownKeys to work properly
    getOwnPropertyDescriptor: (instance, key) =>
      Reflect.getOwnPropertyDescriptor(instance[type], key),
    set: () => false,
    deleteProperty: () => false
  }
})

function createSetupContext(instance: ComponentInstance): SetupContext {
  const context = {
    // attrs, slots & refs are non-reactive, but they need to always expose
    // the latest values (instance.xxx may get replaced during updates) so we
    // need to expose them through a proxy
    attrs: new Proxy(instance, SetupProxyHandlers.attrs),
    slots: new Proxy(instance, SetupProxyHandlers.slots),
    refs: new Proxy(instance, SetupProxyHandlers.refs),
    emit: instance.emit
  } as any
  return __DEV__ ? Object.freeze(context) : context
}

// mark the current rendering instance for asset resolution (e.g.
// resolveComponent, resolveDirective) during render
export let currentRenderingInstance: ComponentInstance | null = null

export function renderComponentRoot(instance: ComponentInstance): VNode {
  const {
    type: Component,
    vnode,
    renderProxy,
    props,
    slots,
    attrs,
    emit
  } = instance

  let result
  currentRenderingInstance = instance
  try {
    if (vnode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT) {
      result = normalizeVNode(
        (instance.render as RenderFunction).call(renderProxy)
      )
    } else {
      // functional
      const render = Component as FunctionalComponent
      result = normalizeVNode(
        render.length > 1
          ? render(props, {
              attrs,
              slots,
              emit
            })
          : render(props, null as any)
      )
    }
  } catch (err) {
    handleError(err, instance, ErrorTypes.RENDER_FUNCTION)
    result = createVNode(Empty)
  }
  currentRenderingInstance = null
  return result
}

export function shouldUpdateComponent(
  prevVNode: VNode,
  nextVNode: VNode,
  optimized?: boolean
): boolean {
  const { props: prevProps, children: prevChildren } = prevVNode
  const { props: nextProps, children: nextChildren, patchFlag } = nextVNode
  if (patchFlag) {
    if (patchFlag & PatchFlags.DYNAMIC_SLOTS) {
      // slot content that references values that might have changed,
      // e.g. in a v-for
      return true
    }
    if (patchFlag & PatchFlags.FULL_PROPS) {
      // presence of this flag indicates props are always non-null
      return hasPropsChanged(prevProps as Data, nextProps as Data)
    } else if (patchFlag & PatchFlags.PROPS) {
      const dynamicProps = nextVNode.dynamicProps as string[]
      for (let i = 0; i < dynamicProps.length; i++) {
        const key = dynamicProps[i]
        if ((nextProps as any)[key] !== (prevProps as any)[key]) {
          return true
        }
      }
    }
  } else if (!optimized) {
    // this path is only taken by manually written render functions
    // so presence of any children leads to a forced update
    if (prevChildren != null || nextChildren != null) {
      return true
    }
    if (prevProps === nextProps) {
      return false
    }
    if (prevProps === null) {
      return nextProps !== null
    }
    if (nextProps === null) {
      return prevProps !== null
    }
    return hasPropsChanged(prevProps, nextProps)
  }
  return false
}

function hasPropsChanged(prevProps: Data, nextProps: Data): boolean {
  const nextKeys = Object.keys(nextProps)
  if (nextKeys.length !== Object.keys(prevProps).length) {
    return true
  }
  for (let i = 0; i < nextKeys.length; i++) {
    const key = nextKeys[i]
    if (nextProps[key] !== prevProps[key]) {
      return true
    }
  }
  return false
}

export function resolveComponent(name: string): Component | undefined {
  return resolveAsset('components', name) as any
}
