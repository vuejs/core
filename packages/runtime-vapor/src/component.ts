import {
  type AsyncComponentInternalOptions,
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
  expose,
  isAsyncWrapper,
  isKeepAlive,
  nextUid,
  popWarningContext,
  pushWarningContext,
  queuePostFlushCb,
  registerHMR,
  setCurrentInstance,
  startMeasure,
  unregisterHMR,
  warn,
} from '@vue/runtime-dom'
import {
  type Block,
  insert,
  isBlock,
  remove,
  setComponentScopeId,
  setScopeId,
} from './block'
import {
  type ShallowRef,
  markRaw,
  onScopeDispose,
  proxyRefs,
  setActiveSub,
  unref,
} from '@vue/reactivity'
import {
  EMPTY_OBJ,
  ShapeFlags,
  invokeArrayFns,
  isFunction,
  isString,
} from '@vue/shared'
import {
  type DynamicPropsSource,
  type RawProps,
  getKeysFromRawProps,
  getPropsProxyHandlers,
  hasFallthroughAttrs,
  normalizePropsOptions,
  resolveDynamicProps,
  setupPropsValidation,
} from './componentProps'
import { type RenderEffect, renderEffect } from './renderEffect'
import { emit, normalizeEmitsOptions } from './componentEmits'
import { setDynamicProps } from './dom/prop'
import {
  type DynamicSlotSource,
  type RawSlots,
  type StaticSlots,
  type VaporSlot,
  dynamicSlotsProxyHandlers,
  getSlot,
} from './componentSlots'
import { hmrReload, hmrRerender } from './hmr'
import {
  adoptTemplate,
  advanceHydrationNode,
  currentHydrationNode,
  isComment,
  isHydrating,
  locateEndAnchor,
  locateHydrationNode,
  locateNextNode,
  setCurrentHydrationNode,
} from './dom/hydration'
import { _next, createElement } from './dom/node'
import { type TeleportFragment, isVaporTeleport } from './components/Teleport'
import {
  type KeepAliveInstance,
  findParentKeepAlive,
} from './components/KeepAlive'
import {
  insertionAnchor,
  insertionParent,
  isLastInsertion,
  resetInsertionState,
} from './insertionState'
import { DynamicFragment } from './fragment'

export { currentInstance } from '@vue/runtime-dom'

export type VaporComponent = FunctionalVaporComponent | ObjectVaporComponent

export type VaporSetupFn = (
  props: any,
  ctx: Pick<VaporComponentInstance, 'slots' | 'attrs' | 'emit' | 'expose'>,
) => Block | Record<string, any> | undefined

export type FunctionalVaporComponent = VaporSetupFn &
  Omit<ObjectVaporComponent, 'setup'> & {
    displayName?: string
  } & SharedInternalOptions

export interface ObjectVaporComponent
  extends ComponentInternalOptions,
    AsyncComponentInternalOptions<ObjectVaporComponent, VaporComponentInstance>,
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
    slots?: Record<string, VaporSlot>,
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

// In TypeScript, it is actually impossible to have a record type with only
// specific properties that have a different type from the indexed type.
// This makes our rawProps / rawSlots shape difficult to satisfy when calling
// `createComponent` - luckily this is not user-facing, so we don't need to be
// 100% strict. Here we use intentionally wider types to make `createComponent`
// more ergonomic in tests and internal call sites, where we immediately cast
// them into the stricter types.
export type LooseRawProps = Record<
  string,
  (() => unknown) | DynamicPropsSource[]
> & {
  $?: DynamicPropsSource[]
}

export type LooseRawSlots = Record<string, VaporSlot | DynamicSlotSource[]> & {
  $?: DynamicSlotSource[]
}

export function createComponent(
  component: VaporComponent,
  rawProps?: LooseRawProps | null,
  rawSlots?: LooseRawSlots | null,
  isSingleRoot?: boolean,
  once?: boolean,
  appContext: GenericAppContext = (currentInstance &&
    currentInstance.appContext) ||
    emptyContext,
): VaporComponentInstance {
  const _insertionParent = insertionParent
  const _insertionAnchor = insertionAnchor
  const _isLastInsertion = isLastInsertion
  if (isHydrating) {
    locateHydrationNode()
  } else {
    resetInsertionState()
  }

  if (
    isSingleRoot &&
    component.inheritAttrs !== false &&
    isVaporComponent(currentInstance) &&
    currentInstance.hasFallthrough
  ) {
    // check if we are the single root of the parent
    // if yes, inject parent attrs as dynamic props source
    const attrs = currentInstance.attrs
    if (rawProps) {
      ;((rawProps as RawProps).$ || ((rawProps as RawProps).$ = [])).push(
        () => attrs,
      )
    } else {
      rawProps = { $: [() => attrs] } as RawProps
    }
  }

  // keep-alive
  if (
    currentInstance &&
    currentInstance.vapor &&
    isKeepAlive(currentInstance)
  ) {
    const cached = (currentInstance as KeepAliveInstance).getCachedComponent(
      component,
    )
    // @ts-expect-error
    if (cached) return cached
  }

  // vdom interop enabled and component is not an explicit vapor component
  if (appContext.vapor && !component.__vapor) {
    const frag = appContext.vapor.vdomMount(
      component as any,
      rawProps,
      rawSlots,
    )

    if (!isHydrating) {
      if (_insertionParent) insert(frag, _insertionParent, _insertionAnchor)
    } else {
      frag.hydrate()
      if (_isLastInsertion) {
        advanceHydrationNode(_insertionParent!)
      }
    }
    return frag
  }

  // teleport
  if (isVaporTeleport(component)) {
    const frag = component.process(rawProps!, rawSlots!)
    if (!isHydrating) {
      if (_insertionParent) insert(frag, _insertionParent, _insertionAnchor)
    } else {
      frag.hydrate()
      if (_isLastInsertion) {
        advanceHydrationNode(_insertionParent!)
      }
    }

    return frag as any
  }

  const instance = new VaporComponentInstance(
    component,
    rawProps as RawProps,
    rawSlots as RawSlots,
    appContext,
    once,
  )

  // HMR
  if (__DEV__ && component.__hmrId) {
    registerHMR(instance)
    instance.isSingleRoot = isSingleRoot
    instance.hmrRerender = hmrRerender.bind(null, instance)
    instance.hmrReload = hmrReload.bind(null, instance)
  }

  if (__DEV__) {
    pushWarningContext(instance)
    startMeasure(instance, `init`)

    // cache normalized options for dev only emit check
    instance.propsOptions = normalizePropsOptions(component)
    instance.emitsOptions = normalizeEmitsOptions(component)
  }

  // hydrating async component
  if (
    isHydrating &&
    isAsyncWrapper(instance) &&
    component.__asyncHydrate &&
    !component.__asyncResolved
  ) {
    // it may get unmounted before its inner component is loaded,
    // so we need to give it a placeholder block that matches its
    // adopted DOM
    const el = currentHydrationNode!
    if (isComment(el, '[')) {
      const end = _next(locateEndAnchor(el)!)
      const block = (instance.block = [el as Node])
      let cur = el as Node
      while (true) {
        let n = _next(cur)
        if (n && n !== end) {
          block.push((cur = n))
        } else {
          break
        }
      }
    } else {
      instance.block = el
    }
    // also mark it as mounted to ensure it can be unmounted before
    // its inner component is resolved
    instance.isMounted = true

    // advance current hydration node to the nextSibling
    setCurrentHydrationNode(
      isComment(el, '[') ? locateEndAnchor(el)! : el.nextSibling,
    )
    component.__asyncHydrate(el as Element, instance, () =>
      setupComponent(instance, component),
    )
  } else {
    setupComponent(instance, component)
  }

  onScopeDispose(() => unmountComponent(instance), true)

  if (_insertionParent || isHydrating) {
    mountComponent(instance, _insertionParent!, _insertionAnchor)
  }

  if (isHydrating && _insertionAnchor !== undefined) {
    advanceHydrationNode(_insertionParent!)
  }
  return instance
}

export function setupComponent(
  instance: VaporComponentInstance,
  component: VaporComponent,
): void {
  const prevInstance = setCurrentInstance(instance)
  const prevSub = setActiveSub()

  if (__DEV__) {
    setupPropsValidation(instance)
  }

  const setupFn = isFunction(component) ? component : component.setup
  const setupResult = setupFn
    ? callWithErrorHandling(setupFn, instance, ErrorCodes.SETUP_FUNCTION, [
        instance.props,
        instance,
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
      // TODO make the proxy warn non-existent property access during dev
      instance.setupState = proxyRefs(setupResult)
      devRender(instance)
    }
  } else {
    // component has a render function but no setup function
    // (typically components with only a template and no state)
    if (!setupFn && component.render) {
      instance.block = callWithErrorHandling(
        component.render,
        instance,
        ErrorCodes.RENDER_FUNCTION,
      )
    } else {
      // in prod result can only be block
      instance.block = setupResult as Block
    }
  }

  // single root, inherit attrs
  if (
    instance.hasFallthrough &&
    component.inheritAttrs !== false &&
    Object.keys(instance.attrs).length
  ) {
    renderEffect(() => applyFallthroughProps(instance.block, instance.attrs))
  }

  setActiveSub(prevSub)
  setCurrentInstance(...prevInstance)

  if (__DEV__) {
    popWarningContext()
    endMeasure(instance, 'init')
  }
}

export let isApplyingFallthroughProps = false

export function applyFallthroughProps(
  block: Block,
  attrs: Record<string, any>,
): void {
  const el = getRootElement(block)
  if (el) {
    isApplyingFallthroughProps = true
    setDynamicProps(el, [attrs])
    isApplyingFallthroughProps = false
  }
}

/**
 * dev only
 */
export function devRender(instance: VaporComponentInstance): void {
  instance.block =
    (instance.type.render
      ? callWithErrorHandling(
          instance.type.render,
          instance,
          ErrorCodes.RENDER_FUNCTION,
          [
            instance.setupState,
            instance.props,
            instance.emit,
            instance.attrs,
            instance.slots,
          ],
        )
      : callWithErrorHandling(
          isFunction(instance.type) ? instance.type : instance.type.setup!,
          instance,
          ErrorCodes.SETUP_FUNCTION,
          [
            instance.props,
            {
              slots: instance.slots,
              attrs: instance.attrs,
              emit: instance.emit,
              expose: instance.expose,
            },
          ],
        )) || []
}

export const emptyContext: GenericAppContext = {
  app: null as any,
  config: {},
  provides: /*@__PURE__*/ Object.create(null),
}

export class VaporComponentInstance implements GenericComponentInstance {
  vapor: true
  uid: number
  type: VaporComponent
  root: GenericComponentInstance | null
  parent: GenericComponentInstance | null
  appContext: GenericAppContext

  block: Block
  scope: EffectScope

  rawProps: RawProps
  rawSlots: RawSlots

  props: Record<string, any>
  attrs: Record<string, any>
  propsDefaults: Record<string, any> | null

  slots: StaticSlots

  // to hold vnode props / slots in vdom interop mode
  rawPropsRef?: ShallowRef<any>
  rawSlotsRef?: ShallowRef<any>

  emit: EmitFn
  emitted: Record<string, boolean> | null

  expose: (exposed: Record<string, any>) => void
  exposed: Record<string, any> | null
  exposeProxy: Record<string, any> | null

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
  devtoolsRawSetupState?: any
  hmrRerender?: () => void
  hmrReload?: (newComp: VaporComponent) => void
  renderEffects?: RenderEffect[]
  parentTeleport?: TeleportFragment | null
  propsOptions?: NormalizedPropsOptions
  emitsOptions?: ObjectEmitsOptions | null
  isSingleRoot?: boolean
  shapeFlag?: number

  constructor(
    comp: VaporComponent,
    rawProps?: RawProps | null,
    rawSlots?: RawSlots | null,
    appContext?: GenericAppContext,
    once?: boolean,
  ) {
    this.vapor = true
    this.uid = nextUid()
    this.type = comp
    this.parent = currentInstance
    this.root = currentInstance ? currentInstance.root : this

    if (currentInstance) {
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
    this.expose = expose.bind(null, this)
    this.refs = EMPTY_OBJ
    this.emitted =
      this.exposed =
      this.exposeProxy =
      this.propsDefaults =
      this.suspense =
        null

    this.isMounted =
      this.isUnmounted =
      this.isUpdating =
      this.isDeactivated =
        false

    // init props
    this.rawProps = rawProps || EMPTY_OBJ
    this.hasFallthrough = hasFallthroughAttrs(comp, rawProps)
    if (rawProps || comp.props) {
      const [propsHandlers, attrsHandlers] = getPropsProxyHandlers(comp, once)
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
  }

  /**
   * Expose `getKeysFromRawProps` on the instance so it can be used in code
   * paths where it's needed, e.g. `useModel`
   */
  rawKeys(): string[] {
    return getKeysFromRawProps(this.rawProps)
  }
}

export function isVaporComponent(
  value: unknown,
): value is VaporComponentInstance {
  return value instanceof VaporComponentInstance
}

/**
 * Used when a component cannot be resolved at compile time
 * and needs rely on runtime resolution - where it might fallback to a plain
 * element if the resolution fails.
 */
export function createComponentWithFallback(
  comp: VaporComponent | string,
  rawProps?: LooseRawProps | null,
  rawSlots?: LooseRawSlots | null,
  isSingleRoot?: boolean,
  once?: boolean,
  appContext?: GenericAppContext,
): HTMLElement | VaporComponentInstance {
  if (!isString(comp)) {
    return createComponent(
      comp,
      rawProps,
      rawSlots,
      isSingleRoot,
      once,
      appContext,
    )
  }

  const _insertionParent = insertionParent
  const _insertionAnchor = insertionAnchor
  const _isLastInsertion = isLastInsertion
  if (isHydrating) {
    locateHydrationNode()
  } else {
    resetInsertionState()
  }

  const el = isHydrating
    ? (adoptTemplate(currentHydrationNode!, `<${comp}/>`) as HTMLElement)
    : createElement(comp)

  // mark single root
  ;(el as any).$root = isSingleRoot

  if (!isHydrating) {
    const scopeId = currentInstance!.type.__scopeId
    if (scopeId) setScopeId(el, [scopeId])
  }

  if (rawProps) {
    const setFn = () =>
      setDynamicProps(el, [resolveDynamicProps(rawProps as RawProps)])
    if (once) setFn()
    else renderEffect(setFn)
  }

  if (rawSlots) {
    let nextNode: Node | null = null
    if (isHydrating) {
      nextNode = locateNextNode(el)
      setCurrentHydrationNode(el.firstChild)
    }
    if (rawSlots.$) {
      // TODO dynamic slot fragment
    } else {
      insert(getSlot(rawSlots as RawSlots, 'default')!(), el)
    }
    if (isHydrating) {
      setCurrentHydrationNode(nextNode)
    }
  }

  if (!isHydrating) {
    if (_insertionParent) insert(el, _insertionParent, _insertionAnchor)
  } else {
    if (_isLastInsertion) {
      advanceHydrationNode(_insertionParent!)
    }
  }

  return el
}

export function mountComponent(
  instance: VaporComponentInstance,
  parent: ParentNode,
  anchor?: Node | null | 0,
): void {
  if (instance.shapeFlag! & ShapeFlags.COMPONENT_KEPT_ALIVE) {
    findParentKeepAlive(instance)!.activate(instance, parent, anchor)
    return
  }

  if (__DEV__) {
    startMeasure(instance, `mount`)
  }
  if (instance.bm) invokeArrayFns(instance.bm)
  if (!isHydrating) {
    insert(instance.block, parent, anchor)
    setComponentScopeId(instance)
  }
  if (instance.m) queuePostFlushCb(instance.m!)
  if (
    instance.shapeFlag! & ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE &&
    instance.a
  ) {
    queuePostFlushCb(instance.a!)
  }
  instance.isMounted = true
  if (__DEV__) {
    endMeasure(instance, `mount`)
  }
}

export function unmountComponent(
  instance: VaporComponentInstance,
  parentNode?: ParentNode,
): void {
  if (
    parentNode &&
    instance.parent &&
    instance.parent.vapor &&
    instance.shapeFlag! & ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE
  ) {
    findParentKeepAlive(instance)!.deactivate(instance)
    return
  }

  if (instance.isMounted && !instance.isUnmounted) {
    if (__DEV__ && instance.type.__hmrId) {
      unregisterHMR(instance)
    }
    if (instance.bum) {
      invokeArrayFns(instance.bum)
    }

    instance.scope.stop()

    if (instance.um) {
      queuePostFlushCb(instance.um!)
    }
    instance.isUnmounted = true
  }

  if (parentNode) {
    remove(instance.block, parentNode)
  }
}

export function getExposed(
  instance: GenericComponentInstance,
): Record<string, any> | undefined {
  if (instance.exposed) {
    return (
      instance.exposeProxy ||
      (instance.exposeProxy = new Proxy(markRaw(instance.exposed), {
        get: (target, key) => unref(target[key as any]),
      }))
    )
  }
}

function getRootElement(block: Block): Element | undefined {
  if (block instanceof Element) {
    return block
  }

  if (block instanceof DynamicFragment) {
    const { nodes } = block
    if (nodes instanceof Element && (nodes as any).$root) {
      return nodes
    }
  }
}
