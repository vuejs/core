import {
  type ComponentInternalOptions,
  type ComponentPropsOptions,
  EffectScope,
  type EmitFn,
  type EmitsOptions,
  ErrorCodes,
  type GenericAppContext,
  type GenericComponentInstance,
  type LifecycleHook,
  type NormalizedPropsOptions,
  type ObjectEmitsOptions,
  type SuspenseBoundary,
  callWithErrorHandling,
  currentInstance,
  endMeasure,
  nextUid,
  popWarningContext,
  pushWarningContext,
  registerHMR,
  simpleSetCurrentInstance,
  startMeasure,
  unregisterHMR,
  warn,
} from '@vue/runtime-dom'
import { type Block, insert, isBlock, remove } from './block'
import { pauseTracking, proxyRefs, resetTracking } from '@vue/reactivity'
import { EMPTY_OBJ, invokeArrayFns, isFunction, isString } from '@vue/shared'
import {
  type RawProps,
  getPropsProxyHandlers,
  hasFallthroughAttrs,
  normalizePropsOptions,
  resolveDynamicProps,
  setupPropsValidation,
} from './componentProps'
import { renderEffect } from './renderEffect'
import { emit, normalizeEmitsOptions } from './componentEmits'
import { setStyle } from './dom/style'
import { setClass, setDynamicProp } from './dom/prop'
import {
  type RawSlots,
  type Slot,
  type StaticSlots,
  dynamicSlotsProxyHandlers,
  getSlot,
} from './componentSlots'
import { hmrReload, hmrRerender } from './hmr'

export { currentInstance } from '@vue/runtime-dom'

export type VaporComponent = FunctionalVaporComponent | ObjectVaporComponent

export type VaporSetupFn = (
  props: any,
  ctx: SetupContext,
) => Block | Record<string, any> | undefined

export type FunctionalVaporComponent = VaporSetupFn &
  Omit<ObjectVaporComponent, 'setup'> & {
    displayName?: string
  } & SharedInternalOptions

export interface ObjectVaporComponent
  extends ComponentInternalOptions,
    SharedInternalOptions {
  setup?: VaporSetupFn
  inheritAttrs?: boolean
  props?: ComponentPropsOptions
  emits?: EmitsOptions
  render?(
    ctx: any,
    props?: any,
    emit?: EmitFn,
    attrs?: any,
    slots?: Record<string, Slot>,
  ): Block

  name?: string
  vapor?: boolean
}

interface SharedInternalOptions {
  /**
   * Cached normalized props options.
   * In vapor mode there are no mixins so normalized options can be cached
   * directly on the component
   */
  __propsOptions?: NormalizedPropsOptions
  /**
   * Cached normalized props proxy handlers.
   */
  __propsHandlers?: [ProxyHandler<any> | null, ProxyHandler<any>]
  /**
   * Cached normalized emits options.
   */
  __emitsOptions?: ObjectEmitsOptions
}

export function createComponent(
  component: VaporComponent,
  rawProps?: RawProps | null,
  rawSlots?: RawSlots | null,
  isSingleRoot?: boolean,
  appContext?: GenericAppContext,
): VaporComponentInstance {
  // check if we are the single root of the parent
  // if yes, inject parent attrs as dynamic props source
  if (
    isSingleRoot &&
    component.inheritAttrs !== false &&
    isVaporComponent(currentInstance) &&
    currentInstance.hasFallthrough
  ) {
    const attrs = currentInstance.attrs
    if (rawProps) {
      ;(rawProps.$ || (rawProps.$ = [])).push(() => attrs)
    } else {
      rawProps = { $: [() => attrs] } as RawProps
    }
  }

  const instance = new VaporComponentInstance(
    component,
    rawProps,
    rawSlots,
    appContext,
  )

  if (__DEV__) {
    pushWarningContext(instance)
    startMeasure(instance, `init`)
  }

  const prev = currentInstance
  simpleSetCurrentInstance(instance)
  pauseTracking()

  const setupFn = isFunction(component) ? component : component.setup
  const setupContext = (instance.setupContext =
    setupFn && setupFn.length > 1 ? new SetupContext(instance) : null)
  const setupResult = setupFn
    ? callWithErrorHandling(setupFn, instance, ErrorCodes.SETUP_FUNCTION, [
        instance.props,
        setupContext,
      ]) || EMPTY_OBJ
    : EMPTY_OBJ

  if (__DEV__ && !isBlock(setupResult)) {
    if (isFunction(component)) {
      warn(`Functional vapor component must return a block directly.`)
      instance.block = []
    } else if (!component.render) {
      warn(
        `Vapor component setup() returned non-block value, and has no render function.`,
      )
      instance.block = []
    } else {
      instance.devtoolsRawSetupState = setupResult
      instance.setupState = proxyRefs(setupResult)
      devRender(instance)

      // HMR
      if (component.__hmrId) {
        registerHMR(instance)
        instance.isSingleRoot = isSingleRoot
        instance.hmrRerender = hmrRerender.bind(null, instance)
        instance.hmrReload = hmrReload.bind(null, instance)
      }
    }
  } else {
    // in prod result can only be block
    instance.block = setupResult as Block
  }

  // single root, inherit attrs
  if (
    instance.hasFallthrough &&
    component.inheritAttrs !== false &&
    instance.block instanceof Element &&
    Object.keys(instance.attrs).length
  ) {
    renderEffect(() => {
      for (const key in instance.attrs) {
        setDynamicProp(instance.block as Element, key, instance.attrs[key])
      }
    })
  }

  resetTracking()
  simpleSetCurrentInstance(prev, instance)

  if (__DEV__) {
    popWarningContext()
    endMeasure(instance, 'init')
  }

  return instance
}

/**
 * dev only
 */
export function devRender(instance: VaporComponentInstance): void {
  instance.block =
    callWithErrorHandling(
      instance.type.render!,
      instance,
      ErrorCodes.RENDER_FUNCTION,
      [
        instance.setupState,
        instance.props,
        instance.emit,
        instance.attrs,
        instance.slots,
      ],
    ) || []
}

const emptyContext: GenericAppContext = {
  app: null as any,
  config: {},
  provides: /*@__PURE__*/ Object.create(null),
}

export class VaporComponentInstance implements GenericComponentInstance {
  vapor: true
  uid: number
  type: VaporComponent
  parent: GenericComponentInstance | null
  children: VaporComponentInstance[] // TODO handle vdom children
  appContext: GenericAppContext

  block: Block
  scope: EffectScope
  props: Record<string, any>
  attrs: Record<string, any>
  slots: StaticSlots
  exposed: Record<string, any> | null

  rawProps: RawProps
  rawSlots: RawSlots

  emit: EmitFn
  emitted: Record<string, boolean> | null
  propsDefaults: Record<string, any> | null

  // for useTemplateRef()
  refs: Record<string, any>
  // for provide / inject
  provides: Record<string, any>
  // for useId
  ids: [string, number, number]
  // for suspense
  suspense: SuspenseBoundary | null

  hasFallthrough: boolean

  // lifecycle hooks
  isMounted: boolean
  isUnmounted: boolean
  isDeactivated: boolean
  isUpdating: boolean

  bc?: LifecycleHook // LifecycleHooks.BEFORE_CREATE
  c?: LifecycleHook // LifecycleHooks.CREATED
  bm?: LifecycleHook // LifecycleHooks.BEFORE_MOUNT
  m?: LifecycleHook // LifecycleHooks.MOUNTED
  bu?: LifecycleHook // LifecycleHooks.BEFORE_UPDATE
  u?: LifecycleHook // LifecycleHooks.UPDATED
  um?: LifecycleHook // LifecycleHooks.BEFORE_UNMOUNT
  bum?: LifecycleHook // LifecycleHooks.UNMOUNTED
  da?: LifecycleHook // LifecycleHooks.DEACTIVATED
  a?: LifecycleHook // LifecycleHooks.ACTIVATED
  rtg?: LifecycleHook // LifecycleHooks.RENDER_TRACKED
  rtc?: LifecycleHook // LifecycleHooks.RENDER_TRIGGERED
  ec?: LifecycleHook // LifecycleHooks.ERROR_CAPTURED
  sp?: LifecycleHook<() => Promise<unknown>> // LifecycleHooks.SERVER_PREFETCH

  setupContext?: SetupContext | null

  // dev only
  setupState?: Record<string, any>
  devtoolsRawSetupState?: any
  hmrRerender?: () => void
  hmrReload?: (newComp: VaporComponent) => void
  propsOptions?: NormalizedPropsOptions
  emitsOptions?: ObjectEmitsOptions | null
  isSingleRoot?: boolean

  constructor(
    comp: VaporComponent,
    rawProps?: RawProps | null,
    rawSlots?: RawSlots | null,
    appContext?: GenericAppContext,
  ) {
    this.vapor = true
    this.uid = nextUid()
    this.type = comp
    this.parent = currentInstance // TODO proper parent source when inside vdom instance
    this.children = []

    if (currentInstance) {
      if (isVaporComponent(currentInstance)) {
        currentInstance.children.push(this)
      }
      this.appContext = currentInstance.appContext
      this.provides = currentInstance.provides
      this.ids = currentInstance.ids
    } else {
      this.appContext = appContext || emptyContext
      this.provides = Object.create(this.appContext.provides)
      this.ids = ['', 0, 0]
    }

    this.block = null! // to be set
    this.scope = new EffectScope(true)

    this.emit = emit.bind(null, this)
    this.refs = EMPTY_OBJ
    this.emitted = this.exposed = this.propsDefaults = this.suspense = null
    this.isMounted =
      this.isUnmounted =
      this.isUpdating =
      this.isDeactivated =
        false

    // init props
    this.rawProps = rawProps || EMPTY_OBJ
    this.hasFallthrough = hasFallthroughAttrs(comp, rawProps)
    if (rawProps || comp.props) {
      const [propsHandlers, attrsHandlers] = getPropsProxyHandlers(comp)
      this.attrs = new Proxy(this, attrsHandlers)
      this.props = comp.props
        ? new Proxy(this, propsHandlers!)
        : isFunction(comp)
          ? this.attrs
          : EMPTY_OBJ
    } else {
      this.props = this.attrs = EMPTY_OBJ
    }

    // init slots
    this.rawSlots = rawSlots || EMPTY_OBJ
    this.slots = rawSlots
      ? rawSlots.$
        ? new Proxy(rawSlots, dynamicSlotsProxyHandlers)
        : rawSlots
      : EMPTY_OBJ

    if (__DEV__) {
      // validate props
      if (rawProps) setupPropsValidation(this)
      // cache normalized options for dev only emit check
      this.propsOptions = normalizePropsOptions(comp)
      this.emitsOptions = normalizeEmitsOptions(comp)
    }
  }
}

export function isVaporComponent(
  value: unknown,
): value is VaporComponentInstance {
  return value instanceof VaporComponentInstance
}

export class SetupContext {
  attrs: Record<string, any>
  emit: EmitFn
  slots: Readonly<StaticSlots>
  expose: (exposed?: Record<string, any>) => void

  constructor(instance: VaporComponentInstance) {
    this.attrs = instance.attrs
    this.emit = instance.emit
    this.slots = instance.slots
    this.expose = (exposed = {}) => {
      instance.exposed = exposed
    }
  }
}

/**
 * Used when a component cannot be resolved at compile time
 * and needs rely on runtime resolution - where it might fallback to a plain
 * element if the resolution fails.
 */
export function createComponentWithFallback(
  comp: VaporComponent | string,
  rawProps: RawProps | null | undefined,
  rawSlots: RawSlots | null | undefined,
  isSingleRoot?: boolean,
): HTMLElement | VaporComponentInstance {
  if (!isString(comp)) {
    return createComponent(comp, rawProps, rawSlots, isSingleRoot)
  }

  // eslint-disable-next-line no-restricted-globals
  const el = document.createElement(comp)

  if (rawProps) {
    renderEffect(() => {
      let classes: unknown[] | undefined
      let styles: unknown[] | undefined
      const resolved = resolveDynamicProps(rawProps)
      for (const key in resolved) {
        const value = resolved[key]
        if (key === 'class') (classes ||= []).push(value)
        else if (key === 'style') (styles ||= []).push(value)
        else setDynamicProp(el, key, value)
      }
      if (classes) setClass(el, classes)
      if (styles) setStyle(el, styles)
    })
  }

  if (rawSlots) {
    if (rawSlots.$) {
      // TODO dynamic slot fragment
    } else {
      insert(getSlot(rawSlots, 'default')!(), el)
    }
  }

  return el
}

export function mountComponent(
  instance: VaporComponentInstance,
  parent: ParentNode,
  anchor?: Node | null | 0,
): void {
  if (__DEV__) {
    startMeasure(instance, `mount`)
  }
  if (!instance.isMounted) {
    if (instance.bm) invokeArrayFns(instance.bm)
    insert(instance.block, parent, anchor)
    // TODO queuePostFlushCb(() => {
    if (instance.m) invokeArrayFns(instance.m)
    instance.isMounted = true
    // })
  } else {
    insert(instance.block, parent, anchor)
  }
  if (__DEV__) {
    endMeasure(instance, `mount`)
  }
}

export function unmountComponent(
  instance: VaporComponentInstance,
  parent?: ParentNode,
): void {
  if (instance.isMounted && !instance.isUnmounted) {
    if (__DEV__ && instance.type.__hmrId) {
      unregisterHMR(instance)
    }
    if (instance.bum) invokeArrayFns(instance.bum)
    instance.scope.stop()
    for (const c of instance.children) {
      unmountComponent(c)
    }
    if (parent) remove(instance.block, parent)
    // TODO queuePostFlushCb(() => {
    if (instance.um) invokeArrayFns(instance.um)
    instance.isUnmounted = true
    // })
  } else if (parent) {
    remove(instance.block, parent)
  }
}
