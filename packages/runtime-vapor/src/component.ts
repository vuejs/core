import {
  type ComponentInternalOptions,
  type ComponentPropsOptions,
  EffectScope,
  type EmitFn,
  type EmitsOptions,
  type GenericAppContext,
  type GenericComponentInstance,
  type LifecycleHook,
  type NormalizedPropsOptions,
  type ObjectEmitsOptions,
  type SuspenseBoundary,
  currentInstance,
  nextUid,
  popWarningContext,
  pushWarningContext,
  setCurrentInstance,
  warn,
} from '@vue/runtime-dom'
import { type Block, isBlock } from './block'
import { pauseTracking, proxyRefs, resetTracking } from '@vue/reactivity'
import { EMPTY_OBJ, isFunction, isString } from '@vue/shared'
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
  render?(ctx: any): Block

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
  rawProps?: RawProps,
  isSingleRoot?: boolean,
): VaporComponentInstance {
  // check if we are the single root of the parent
  // if yes, inject parent attrs as dynamic props source
  if (
    isSingleRoot &&
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

  const instance = new VaporComponentInstance(component, rawProps)
  const resetCurrentInstance = setCurrentInstance(instance)

  pauseTracking()
  if (__DEV__) {
    pushWarningContext(instance)
  }

  const setupFn = isFunction(component) ? component : component.setup
  const setupContext = setupFn!.length > 1 ? new SetupContext(instance) : null
  const setupResult =
    setupFn!(
      instance.props,
      // @ts-expect-error
      setupContext,
    ) || EMPTY_OBJ

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
      instance.setupState = setupResult
      instance.block = component.render.call(null, proxyRefs(setupResult))
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

  if (__DEV__) {
    popWarningContext()
  }
  resetTracking()
  resetCurrentInstance()

  return instance
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
  appContext: GenericAppContext

  block: Block
  scope: EffectScope
  rawProps: RawProps | undefined
  props: Record<string, any>
  attrs: Record<string, any>
  exposed: Record<string, any> | null

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

  // dev only
  setupState?: Record<string, any>
  propsOptions?: NormalizedPropsOptions
  emitsOptions?: ObjectEmitsOptions | null

  constructor(comp: VaporComponent, rawProps?: RawProps) {
    this.vapor = true
    this.uid = nextUid()
    this.type = comp
    this.parent = currentInstance // TODO proper parent source when inside vdom instance
    this.appContext = currentInstance
      ? currentInstance.appContext
      : emptyContext

    this.block = null! // to be set
    this.scope = new EffectScope(true)

    this.provides = currentInstance
      ? currentInstance.provides
      : Object.create(this.appContext.provides)
    this.refs = EMPTY_OBJ
    this.ids = currentInstance ? currentInstance.ids : ['', 0, 0]
    this.emitted = this.exposed = this.propsDefaults = this.suspense = null
    this.isMounted =
      this.isUnmounted =
      this.isUpdating =
      this.isDeactivated =
        false

    // init props
    const target = rawProps || EMPTY_OBJ
    const handlers = getPropsProxyHandlers(comp, this)
    this.rawProps = rawProps
    this.props = comp.props ? new Proxy(target, handlers[0]!) : {}
    this.attrs = new Proxy(target, handlers[1])
    this.hasFallthrough = hasFallthroughAttrs(comp, rawProps)

    if (__DEV__) {
      // validate props
      if (rawProps) setupPropsValidation(this)
      // cache normalized options for dev only emit check
      this.propsOptions = normalizePropsOptions(comp)
      this.emitsOptions = normalizeEmitsOptions(comp)
    }

    // TODO init slots
  }
}

export function isVaporComponent(
  value: unknown,
): value is VaporComponentInstance {
  return value instanceof VaporComponentInstance
}

export class SetupContext<E = EmitsOptions> {
  attrs: Record<string, any>
  emit: EmitFn<E>
  // TODO slots: Readonly<StaticSlots>
  expose: (exposed?: Record<string, any>) => void

  constructor(instance: VaporComponentInstance) {
    this.attrs = instance.attrs
    this.emit = emit.bind(null, instance) as EmitFn<E>
    // this.slots = instance.slots
    this.expose = (exposed = {}) => {
      instance.exposed = exposed
    }
  }
}

export function createComponentWithFallback(
  comp: VaporComponent | string,
  rawProps: RawProps | undefined,
  // TODO slots: RawSlots | null
  isSingleRoot?: boolean,
): HTMLElement | VaporComponentInstance {
  if (!isString(comp)) {
    return createComponent(comp, rawProps, isSingleRoot)
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

  // TODO
  // if (slots) {
  //   if (!Array.isArray(slots)) slots = [slots]
  //   for (let i = 0; i < slots.length; i++) {
  //     const slot = slots[i]
  //     if (!isDynamicSlotFn(slot) && slot.default) {
  //       const block = slot.default && slot.default()
  //       if (block) el.append(...normalizeBlock(block))
  //     }
  //   }
  // }

  return el
}
