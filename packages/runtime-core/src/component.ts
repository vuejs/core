import { VNode, VNodeChild, isVNode } from './vnode'
import { ReactiveEffect, shallowReadonly } from '@vue/reactivity'
import {
  PublicInstanceProxyHandlers,
  ComponentPublicInstance,
  runtimeCompiledRenderProxyHandlers
} from './componentProxy'
import { ComponentPropsOptions, resolveProps } from './componentProps'
import { Slots, resolveSlots } from './componentSlots'
import { warn } from './warning'
import {
  ErrorCodes,
  callWithErrorHandling,
  callWithAsyncErrorHandling
} from './errorHandling'
import { AppContext, createAppContext, AppConfig } from './apiCreateApp'
import { Directive, validateDirectiveName } from './directives'
import { applyOptions, ComponentOptions } from './apiOptions'
import {
  EMPTY_OBJ,
  isFunction,
  capitalize,
  NOOP,
  isObject,
  NO,
  makeMap,
  isPromise,
  isArray,
  hyphenate
} from '@vue/shared'
import { SuspenseBoundary } from './components/Suspense'
import { CompilerOptions } from '@vue/compiler-core'
import {
  currentRenderingInstance,
  markAttrsAccessed
} from './componentRenderUtils'
import { ShapeFlags } from '.'

export type Data = { [key: string]: unknown }

export interface SFCInternalOptions {
  __scopeId?: string
  __cssModules?: Data
  __hmrId?: string
  __hmrUpdated?: boolean
}

export interface FunctionalComponent<P = {}> extends SFCInternalOptions {
  (props: P, ctx: SetupContext): VNodeChild
  props?: ComponentPropsOptions<P>
  inheritAttrs?: boolean
  displayName?: string
}

export type Component = ComponentOptions | FunctionalComponent
export { ComponentOptions }

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

export type Emit = (event: string, ...args: unknown[]) => any[]

export interface SetupContext {
  attrs: Data
  slots: Slots
  emit: Emit
}

export type RenderFunction = {
  (): VNodeChild
  isRuntimeCompiled?: boolean
}

export interface ComponentInternalInstance {
  type: FunctionalComponent | ComponentOptions
  parent: ComponentInternalInstance | null
  appContext: AppContext
  root: ComponentInternalInstance
  vnode: VNode
  next: VNode | null
  subTree: VNode
  update: ReactiveEffect
  render: RenderFunction | null
  effects: ReactiveEffect[] | null
  provides: Data
  // cache for proxy access type to avoid hasOwnProperty calls
  accessCache: Data | null
  // cache for render function values that rely on _ctx but won't need updates
  // after initialized (e.g. inline handlers)
  renderCache: (Function | VNode)[] | null

  // assets for fast resolution
  components: Record<string, Component>
  directives: Record<string, Directive>

  // the rest are only for stateful components
  renderContext: Data
  data: Data
  props: Data
  attrs: Data
  slots: Slots
  proxy: ComponentPublicInstance | null
  // alternative proxy used only for runtime-compiled render functions using
  // `with` block
  withProxy: ComponentPublicInstance | null
  propsProxy: Data | null
  setupContext: SetupContext | null
  refs: Data
  emit: Emit

  // suspense related
  asyncDep: Promise<any> | null
  asyncResult: unknown
  asyncResolved: boolean

  // storage for any extra properties
  sink: { [key: string]: any }

  // lifecycle
  isMounted: boolean
  isUnmounted: boolean
  isDeactivated: boolean
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

  // hmr marker (dev only)
  renderUpdated?: boolean
}

const emptyAppContext = createAppContext()

export function createComponentInstance(
  vnode: VNode,
  parent: ComponentInternalInstance | null
) {
  // inherit parent app context - or - if root, adopt from root vnode
  const appContext =
    (parent ? parent.appContext : vnode.appContext) || emptyAppContext
  const instance: ComponentInternalInstance = {
    vnode,
    parent,
    appContext,
    type: vnode.type as Component,
    root: null!, // set later so it can point to itself
    next: null,
    subTree: null!, // will be set synchronously right after creation
    update: null!, // will be set synchronously right after creation
    render: null,
    proxy: null,
    withProxy: null,
    propsProxy: null,
    setupContext: null,
    effects: null,
    provides: parent ? parent.provides : Object.create(appContext.provides),
    accessCache: null!,
    renderCache: null,

    // setup context properties
    renderContext: EMPTY_OBJ,
    data: EMPTY_OBJ,
    props: EMPTY_OBJ,
    attrs: EMPTY_OBJ,
    slots: EMPTY_OBJ,
    refs: EMPTY_OBJ,

    // per-instance asset storage (mutable during options resolution)
    components: Object.create(appContext.components),
    directives: Object.create(appContext.directives),

    // async dependency management
    asyncDep: null,
    asyncResult: null,
    asyncResolved: false,

    // user namespace for storing whatever the user assigns to `this`
    // can also be used as a wildcard storage for ad-hoc injections internally
    sink: {},

    // lifecycle hooks
    // not using enums here because it results in computed properties
    isMounted: false,
    isUnmounted: false,
    isDeactivated: false,
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

    emit: (event, ...args): any[] => {
      const props = instance.vnode.props || EMPTY_OBJ
      let handler = props[`on${event}`] || props[`on${capitalize(event)}`]
      if (!handler && event.indexOf('update:') === 0) {
        event = hyphenate(event)
        handler = props[`on${event}`] || props[`on${capitalize(event)}`]
      }
      if (handler) {
        const res = callWithAsyncErrorHandling(
          handler,
          instance,
          ErrorCodes.COMPONENT_EVENT_HANDLER,
          args
        )
        return isArray(res) ? res : [res]
      } else {
        return []
      }
    }
  }

  instance.root = parent ? parent.root : instance
  return instance
}

export let currentInstance: ComponentInternalInstance | null = null
export let currentSuspense: SuspenseBoundary | null = null

export const getCurrentInstance: () => ComponentInternalInstance | null = () =>
  currentInstance || currentRenderingInstance

export const setCurrentInstance = (
  instance: ComponentInternalInstance | null
) => {
  currentInstance = instance
}

const isBuiltInTag = /*#__PURE__*/ makeMap('slot,component')

export function validateComponentName(name: string, config: AppConfig) {
  const appIsNativeTag = config.isNativeTag || NO
  if (isBuiltInTag(name) || appIsNativeTag(name)) {
    warn(
      'Do not use built-in or reserved HTML elements as component id: ' + name
    )
  }
}

export let isInSSRComponentSetup = false

export function setupComponent(
  instance: ComponentInternalInstance,
  parentSuspense: SuspenseBoundary | null,
  isSSR = false
) {
  isInSSRComponentSetup = isSSR
  const propsOptions = instance.type.props
  const { props, children, shapeFlag } = instance.vnode
  resolveProps(instance, props, propsOptions)
  resolveSlots(instance, children)

  // setup stateful logic
  let setupResult
  if (shapeFlag & ShapeFlags.STATEFUL_COMPONENT) {
    setupResult = setupStatefulComponent(instance, parentSuspense)
  }
  isInSSRComponentSetup = false
  return setupResult
}

function setupStatefulComponent(
  instance: ComponentInternalInstance,
  parentSuspense: SuspenseBoundary | null
) {
  const Component = instance.type as ComponentOptions

  if (__DEV__) {
    if (Component.name) {
      validateComponentName(Component.name, instance.appContext.config)
    }
    if (Component.components) {
      const names = Object.keys(Component.components)
      for (let i = 0; i < names.length; i++) {
        validateComponentName(names[i], instance.appContext.config)
      }
    }
    if (Component.directives) {
      const names = Object.keys(Component.directives)
      for (let i = 0; i < names.length; i++) {
        validateDirectiveName(names[i])
      }
    }
  }
  // 0. create render proxy property access cache
  instance.accessCache = {}
  // 1. create public instance / render proxy
  instance.proxy = new Proxy(instance, PublicInstanceProxyHandlers)
  // 2. create props proxy
  // the propsProxy is a reactive AND readonly proxy to the actual props.
  // it will be updated in resolveProps() on updates before render
  const propsProxy = (instance.propsProxy = isInSSRComponentSetup
    ? instance.props
    : shallowReadonly(instance.props))
  // 3. call setup()
  const { setup } = Component
  if (setup) {
    const setupContext = (instance.setupContext =
      setup.length > 1 ? createSetupContext(instance) : null)

    currentInstance = instance
    currentSuspense = parentSuspense
    const setupResult = callWithErrorHandling(
      setup,
      instance,
      ErrorCodes.SETUP_FUNCTION,
      [propsProxy, setupContext]
    )
    currentInstance = null
    currentSuspense = null

    if (isPromise(setupResult)) {
      if (isInSSRComponentSetup) {
        // return the promise so server-renderer can wait on it
        return setupResult.then(resolvedResult => {
          handleSetupResult(instance, resolvedResult, parentSuspense)
        })
      } else if (__FEATURE_SUSPENSE__) {
        // async setup returned Promise.
        // bail here and wait for re-entry.
        instance.asyncDep = setupResult
      } else if (__DEV__) {
        warn(
          `setup() returned a Promise, but the version of Vue you are using ` +
            `does not support it yet.`
        )
      }
    } else {
      handleSetupResult(instance, setupResult, parentSuspense)
    }
  } else {
    finishComponentSetup(instance, parentSuspense)
  }
}

export function handleSetupResult(
  instance: ComponentInternalInstance,
  setupResult: unknown,
  parentSuspense: SuspenseBoundary | null
) {
  if (isFunction(setupResult)) {
    // setup returned an inline render function
    instance.render = setupResult as RenderFunction
  } else if (isObject(setupResult)) {
    if (__DEV__ && isVNode(setupResult)) {
      warn(
        `setup() should not return VNodes directly - ` +
          `return a render function instead.`
      )
    }
    // setup returned bindings.
    // assuming a render function compiled from template is present.
    instance.renderContext = setupResult
  } else if (__DEV__ && setupResult !== undefined) {
    warn(
      `setup() should return an object. Received: ${
        setupResult === null ? 'null' : typeof setupResult
      }`
    )
  }
  finishComponentSetup(instance, parentSuspense)
}

type CompileFunction = (
  template: string | object,
  options?: CompilerOptions
) => RenderFunction

let compile: CompileFunction | undefined

// exported method uses any to avoid d.ts relying on the compiler types.
export function registerRuntimeCompiler(_compile: any) {
  compile = _compile
}

function finishComponentSetup(
  instance: ComponentInternalInstance,
  parentSuspense: SuspenseBoundary | null
) {
  const Component = instance.type as ComponentOptions
  if (!instance.render) {
    if (__RUNTIME_COMPILE__ && Component.template && !Component.render) {
      // __RUNTIME_COMPILE__ ensures `compile` is provided
      Component.render = compile!(Component.template, {
        isCustomElement: instance.appContext.config.isCustomElement || NO
      })
      // mark the function as runtime compiled
      ;(Component.render as RenderFunction).isRuntimeCompiled = true
    }

    if (__DEV__ && !Component.render && !Component.ssrRender) {
      /* istanbul ignore if */
      if (!__RUNTIME_COMPILE__ && Component.template) {
        warn(
          `Component provides template but the build of Vue you are running ` +
            `does not support runtime template compilation. Either use the ` +
            `full build or pre-compile the template using Vue CLI.`
        )
      } else {
        warn(
          `Component is missing${
            __RUNTIME_COMPILE__ ? ` template or` : ``
          } render function.`
        )
      }
    }

    instance.render = (Component.render || NOOP) as RenderFunction

    // for runtime-compiled render functions using `with` blocks, the render
    // proxy used needs a different `has` handler which is more performant and
    // also only allows a whitelist of globals to fallthrough.
    if (__RUNTIME_COMPILE__ && instance.render.isRuntimeCompiled) {
      instance.withProxy = new Proxy(
        instance,
        runtimeCompiledRenderProxyHandlers
      )
    }
  }

  // support for 2.x options
  if (__FEATURE_OPTIONS__) {
    currentInstance = instance
    currentSuspense = parentSuspense
    applyOptions(instance, Component)
    currentInstance = null
    currentSuspense = null
  }

  if (instance.renderContext === EMPTY_OBJ) {
    instance.renderContext = {}
  }
}

// used to identify a setup context proxy
export const SetupProxySymbol = Symbol()

const SetupProxyHandlers: { [key: string]: ProxyHandler<any> } = {}
;['attrs', 'slots'].forEach((type: string) => {
  SetupProxyHandlers[type] = {
    get: (instance, key) => {
      if (__DEV__) {
        markAttrsAccessed()
      }
      return instance[type][key]
    },
    has: (instance, key) => key === SetupProxySymbol || key in instance[type],
    ownKeys: instance => Reflect.ownKeys(instance[type]),
    // this is necessary for ownKeys to work properly
    getOwnPropertyDescriptor: (instance, key) =>
      Reflect.getOwnPropertyDescriptor(instance[type], key),
    set: () => false,
    deleteProperty: () => false
  }
})

function createSetupContext(instance: ComponentInternalInstance): SetupContext {
  const context = {
    // attrs & slots are non-reactive, but they need to always expose
    // the latest values (instance.xxx may get replaced during updates) so we
    // need to expose them through a proxy
    attrs: new Proxy(instance, SetupProxyHandlers.attrs),
    slots: new Proxy(instance, SetupProxyHandlers.slots),
    emit: instance.emit
  }
  return __DEV__ ? Object.freeze(context) : context
}
