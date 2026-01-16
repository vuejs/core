import {
  type AsyncComponentInternalOptions,
  type ComponentInternalOptions,
  type ComponentObjectPropsOptions,
  type ComponentPropsOptions,
  EffectScope,
  type EmitFn,
  type EmitsOptions,
  type EmitsToProps,
  ErrorCodes,
  type ExtractPropTypes,
  type GenericAppContext,
  type GenericComponentInstance,
  type LifecycleHook,
  NULL_DYNAMIC_COMPONENT,
  type NormalizedPropsOptions,
  type ObjectEmitsOptions,
  type ShallowUnwrapRef,
  type SuspenseBoundary,
  callWithErrorHandling,
  currentInstance,
  endMeasure,
  expose,
  getComponentName,
  getFunctionalFallthrough,
  isAsyncWrapper,
  isKeepAlive,
  markAsyncBoundary,
  nextUid,
  popWarningContext,
  pushWarningContext,
  queuePostFlushCb,
  registerHMR,
  setCurrentInstance,
  startMeasure,
  unregisterHMR,
  warn,
  warnExtraneousAttributes,
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
  toRaw,
  unref,
} from '@vue/reactivity'
import {
  EMPTY_OBJ,
  type Prettify,
  ShapeFlags,
  hasOwn,
  invokeArrayFns,
  isArray,
  isFunction,
  isPromise,
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
  getScopeOwner,
  getSlot,
  setCurrentSlotOwner,
} from './componentSlots'
import { hmrReload, hmrRerender } from './hmr'
import {
  adoptTemplate,
  advanceHydrationNode,
  currentHydrationNode,
  isHydrating,
  locateHydrationNode,
  locateNextNode,
  setCurrentHydrationNode,
} from './dom/hydration'
import { createComment, createElement, createTextNode } from './dom/node'
import {
  type TeleportFragment,
  isTeleportFragment,
  isVaporTeleport,
} from './components/Teleport'
import type { KeepAliveInstance } from './components/KeepAlive'
import {
  currentKeepAliveCtx,
  setCurrentKeepAliveCtx,
} from './components/KeepAlive'
import {
  insertionAnchor,
  insertionParent,
  isLastInsertion,
  resetInsertionState,
} from './insertionState'
import type {
  DefineVaporComponent,
  VaporRenderResult,
} from './apiDefineComponent'
import { DynamicFragment, isFragment } from './fragment'
import type { VaporElement } from './apiDefineCustomElement'
import { parentSuspense, setParentSuspense } from './components/Suspense'

export { currentInstance } from '@vue/runtime-dom'

export type VaporComponent =
  | FunctionalVaporComponent
  | ObjectVaporComponent
  | DefineVaporComponent

export type FunctionalVaporComponent<
  Props = {},
  Emits extends EmitsOptions = {},
  Slots extends StaticSlots = StaticSlots,
  Exposed extends Record<string, any> = Record<string, any>,
> = ((
  props: Readonly<Props & EmitsToProps<Emits>>,
  ctx: {
    emit: EmitFn<Emits>
    slots: Slots
    attrs: Record<string, any>
    expose: <T extends Record<string, any> = Exposed>(exposed: T) => void
  },
) => VaporRenderResult) &
  Omit<
    ObjectVaporComponent<ComponentPropsOptions<Props>, Emits, string, Slots>,
    'setup'
  > & {
    displayName?: string
  } & SharedInternalOptions

export interface ObjectVaporComponent<
  Props = {},
  Emits extends EmitsOptions = {},
  RuntimeEmitsKeys extends string = string,
  Slots extends StaticSlots = StaticSlots,
  Exposed extends Record<string, any> = Record<string, any>,
  TypeBlock extends Block = Block,
  InferredProps = ComponentObjectPropsOptions extends Props
    ? {}
    : ExtractPropTypes<Props>,
>
  extends
    ComponentInternalOptions,
    AsyncComponentInternalOptions<ObjectVaporComponent, VaporComponentInstance>,
    SharedInternalOptions {
  inheritAttrs?: boolean
  props?: Props
  emits?: Emits | RuntimeEmitsKeys[]
  slots?: Slots
  setup?: (
    props: Readonly<InferredProps>,
    ctx: {
      emit: EmitFn<Emits>
      slots: Slots
      attrs: Record<string, any>
      expose: <T extends Record<string, any> = Exposed>(exposed: T) => void
    },
  ) => TypeBlock | Exposed | Promise<Exposed> | void
  render?(
    ctx: Exposed extends Block ? undefined : ShallowUnwrapRef<Exposed>,
    props: Readonly<InferredProps>,
    emit: EmitFn<Emits>,
    attrs: any,
    slots: Slots,
  ): VaporRenderResult<TypeBlock> | void

  name?: string
  vapor?: boolean
  components?: Record<string, VaporComponent>
  /**
   * @internal custom element interception hook
   */
  ce?: (instance: VaporComponentInstance) => void
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

  let prevSuspense: SuspenseBoundary | null = null
  if (__FEATURE_SUSPENSE__ && currentInstance && currentInstance.suspense) {
    prevSuspense = setParentSuspense(currentInstance.suspense)
  }

  if (
    (isSingleRoot ||
      // transition has attrs fallthrough
      (currentInstance && isVaporTransition(currentInstance!.type))) &&
    component.inheritAttrs !== false &&
    isVaporComponent(currentInstance) &&
    currentInstance.hasFallthrough
  ) {
    // check if we are the single root of the parent
    // if yes, inject parent attrs as dynamic props source
    const attrs = currentInstance.attrs
    if (rawProps && rawProps !== EMPTY_OBJ) {
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
    const cached = (
      currentInstance as KeepAliveInstance
    ).ctx.getCachedComponent(component)
    // @ts-expect-error
    if (cached) return cached
  }

  // vdom interop enabled and component is not an explicit vapor component
  if (appContext.vapor && !component.__vapor) {
    const frag = appContext.vapor.vdomMount(
      component as any,
      currentInstance as any,
      rawProps,
      rawSlots,
      isSingleRoot,
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

  // handle currentKeepAliveCtx for component boundary isolation
  // AsyncWrapper should NOT clear currentKeepAliveCtx so its internal
  // DynamicFragment can capture it
  if (currentKeepAliveCtx && !isAsyncWrapper(instance)) {
    currentKeepAliveCtx.processShapeFlag(instance)
    // clear currentKeepAliveCtx so child components don't associate
    // with parent's KeepAlive
    setCurrentKeepAliveCtx(null)
  }

  // reset currentSlotOwner to null to avoid affecting the child components
  const prevSlotOwner = setCurrentSlotOwner(null)

  // HMR
  if (__DEV__) {
    registerHMR(instance)
    instance.isSingleRoot = isSingleRoot
    instance.hmrRerender = hmrRerender.bind(null, instance)
    instance.hmrReload = hmrReload.bind(null, instance)

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
    component.__asyncHydrate(currentHydrationNode as Element, instance, () =>
      setupComponent(instance, component),
    )
  } else {
    setupComponent(instance, component)
  }

  if (__DEV__) {
    popWarningContext()
    endMeasure(instance, 'init')
  }

  if (__FEATURE_SUSPENSE__ && currentInstance && currentInstance.suspense) {
    setParentSuspense(prevSuspense)
  }

  // restore currentSlotOwner to previous value after setupFn is called
  setCurrentSlotOwner(prevSlotOwner)
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

  const isAsyncSetup = isPromise(setupResult)

  if ((isAsyncSetup || instance.sp) && !isAsyncWrapper(instance)) {
    // async setup / serverPrefetch, mark as async boundary for useId()
    markAsyncBoundary(instance)
  }

  if (isAsyncSetup) {
    if (__FEATURE_SUSPENSE__) {
      // async setup returned Promise.
      // bail here and wait for re-entry.
      instance.asyncDep = setupResult
      if (__DEV__ && !instance.suspense) {
        const name = getComponentName(component) ?? 'Anonymous'
        warn(
          `Component <${name}>: setup function returned a promise, but no ` +
            `<Suspense> boundary was found in the parent component tree. ` +
            `A component with async setup() must be nested in a <Suspense> ` +
            `in order to be rendered.`,
        )
      }
    } else if (__DEV__) {
      warn(
        `setup() returned a Promise, but the version of Vue you are using ` +
          `does not support it yet.`,
      )
    }
  } else {
    handleSetupResult(setupResult, component, instance)
  }

  setActiveSub(prevSub)
  setCurrentInstance(...prevInstance)
}

export let isApplyingFallthroughProps = false

export function applyFallthroughProps(
  el: Element,
  attrs: Record<string, any>,
): void {
  isApplyingFallthroughProps = true
  setDynamicProps(el, [attrs])
  isApplyingFallthroughProps = false
}

/**
 * dev only
 */
function createDevSetupStateProxy(
  instance: VaporComponentInstance,
): Record<string, any> {
  const { setupState } = instance
  return new Proxy(setupState!, {
    get(target, key: string | symbol, receiver) {
      if (
        isString(key) &&
        !key.startsWith('__v') &&
        !hasOwn(toRaw(setupState)!, key)
      ) {
        warn(
          `Property ${JSON.stringify(key)} was accessed during render ` +
            `but is not defined on instance.`,
        )
      }

      return Reflect.get(target, key, receiver)
    },
  })
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

export class VaporComponentInstance<
  Props extends Record<string, any> = {},
  Emits extends EmitsOptions = {},
  Slots extends StaticSlots = StaticSlots,
  Exposed extends Record<string, any> = Record<string, any>,
  TypeBlock extends Block = Block,
  TypeRefs extends Record<string, any> = Record<string, any>,
> implements GenericComponentInstance {
  vapor: true
  uid: number
  type: VaporComponent
  root: GenericComponentInstance | null
  parent: GenericComponentInstance | null
  appContext: GenericAppContext

  block: TypeBlock
  scope: EffectScope

  rawProps: RawProps
  rawSlots: RawSlots

  props: Readonly<Props>
  attrs: Record<string, any>
  propsDefaults: Record<string, any> | null

  slots: Slots

  scopeId?: string | null

  // to hold vnode props / slots in vdom interop mode
  rawPropsRef?: ShallowRef<any>
  rawSlotsRef?: ShallowRef<any>

  emit: EmitFn<Emits>
  emitted: Record<string, boolean> | null

  expose: (<T extends Record<string, any> = Exposed>(exposed: T) => void) &
    // compatible with vdom components
    string[]
  exposed: Exposed | null
  exposeProxy: Prettify<ShallowUnwrapRef<Exposed>> | null

  // for useTemplateRef()
  refs: TypeRefs
  // for provide / inject
  provides: Record<string, any>
  // for useId
  ids: [string, number, number]
  // for suspense
  suspense: SuspenseBoundary | null
  suspenseId: number
  asyncDep: Promise<any> | null
  asyncResolved: boolean

  // for vapor custom element
  renderEffects?: RenderEffect[]

  hasFallthrough: boolean

  // for keep-alive
  shapeFlag?: number

  // for v-once: caches props/attrs values to ensure they remain frozen
  // even when the component re-renders due to local state changes
  oncePropsCache?: Record<string | symbol, any>

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
  setupState?: Exposed extends Block ? undefined : ShallowUnwrapRef<Exposed>
  devtoolsRawSetupState?: any
  hmrRerender?: () => void
  hmrReload?: (newComp: VaporComponent) => void
  parentTeleport?: TeleportFragment | null
  propsOptions?: NormalizedPropsOptions
  emitsOptions?: ObjectEmitsOptions | null
  isSingleRoot?: boolean

  /**
   * dev only flag to track whether $attrs was used during render.
   * If $attrs was used during render then the warning for failed attrs
   * fallthrough can be suppressed.
   */
  accessedAttrs: boolean = false

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

    if (currentInstance) {
      this.root = currentInstance.root
      this.appContext = currentInstance.appContext
      this.provides = currentInstance.provides
      this.ids = currentInstance.ids
    } else {
      this.root = this
      this.appContext = appContext || emptyContext
      this.provides = Object.create(this.appContext.provides)
      this.ids = ['', 0, 0]
    }

    this.block = null! // to be set
    this.scope = new EffectScope(true)

    this.emit = emit.bind(null, this) as EmitFn<Emits>
    this.expose = expose.bind(null, this) as any
    this.refs = EMPTY_OBJ as TypeRefs
    this.emitted = this.exposed = this.exposeProxy = this.propsDefaults = null

    // suspense related
    this.suspense = parentSuspense
    this.suspenseId = parentSuspense ? parentSuspense.pendingId : 0
    this.asyncDep = null
    this.asyncResolved = false

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
      this.props = (
        comp.props
          ? new Proxy(this, propsHandlers!)
          : isFunction(comp)
            ? this.attrs
            : EMPTY_OBJ
      ) as Props
    } else {
      this.props = this.attrs = EMPTY_OBJ as Props
    }

    // init slots
    this.rawSlots = rawSlots || EMPTY_OBJ
    this.slots = (
      rawSlots
        ? rawSlots.$
          ? new Proxy(rawSlots, dynamicSlotsProxyHandlers)
          : rawSlots
        : EMPTY_OBJ
    ) as Slots

    this.scopeId = getCurrentScopeId()

    // apply custom element special handling
    if (comp.ce) {
      comp.ce(this)
    }

    if (__DEV__) {
      // in dev, mark attrs accessed if optional props (attrs === props)
      if (this.props === this.attrs) {
        this.accessedAttrs = true
      } else {
        const attrs = this.attrs
        const instance = this
        this.attrs = new Proxy(attrs, {
          get(target, key, receiver) {
            instance.accessedAttrs = true
            return Reflect.get(target, key, receiver)
          },
        })
      }
    }
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
  comp: VaporComponent | typeof NULL_DYNAMIC_COMPONENT | string,
  rawProps?: LooseRawProps | null,
  rawSlots?: LooseRawSlots | null,
  isSingleRoot?: boolean,
  once?: boolean,
  appContext?: GenericAppContext,
): HTMLElement | VaporComponentInstance {
  if (comp === NULL_DYNAMIC_COMPONENT) {
    return (__DEV__
      ? createComment('ndc')
      : createTextNode('')) as any as HTMLElement
  }

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

  return createPlainElement(comp, rawProps, rawSlots, isSingleRoot, once)
}

export function createPlainElement(
  comp: string,
  rawProps?: LooseRawProps | null,
  rawSlots?: LooseRawSlots | null,
  isSingleRoot?: boolean,
  once?: boolean,
): HTMLElement {
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
    const scopeId = getCurrentScopeId()
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
      // ssr output does not contain the slot anchor, use an empty string
      // as the anchor label to avoid slot anchor search errors
      const frag = new DynamicFragment(
        isHydrating ? '' : __DEV__ ? 'slot' : undefined,
      )
      renderEffect(() => frag.update(getSlot(rawSlots as RawSlots, 'default')))
      if (!isHydrating) insert(frag, el)
    } else {
      const block = getSlot(rawSlots as RawSlots, 'default')!()
      if (!isHydrating) insert(block, el)
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
  if (
    __FEATURE_SUSPENSE__ &&
    instance.suspense &&
    instance.asyncDep &&
    !instance.asyncResolved
  ) {
    const component = instance.type
    instance.suspense.registerDep(instance, setupResult => {
      handleSetupResult(setupResult, component, instance)
      mountComponent(instance, parent, anchor)
    })
    return
  }

  if (instance.shapeFlag! & ShapeFlags.COMPONENT_KEPT_ALIVE) {
    ;(instance.parent as KeepAliveInstance)!.ctx.activate(
      instance,
      parent,
      anchor,
    )
    return
  }

  // custom element style injection
  const { root, type } = instance as GenericComponentInstance
  if (
    root &&
    root.ce &&
    // @ts-expect-error _def is private
    (root.ce as VaporElement)._def.shadowRoot !== false
  ) {
    root.ce!._injectChildStyle(type)
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
  // Skip unmount for kept-alive components - deactivate if called from remove()
  if (
    instance.shapeFlag! & ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE &&
    instance.parent &&
    instance.parent.vapor
  ) {
    if (parentNode) {
      ;(instance.parent as KeepAliveInstance)!.ctx.deactivate(instance)
    }
    return
  }

  if (instance.isMounted && !instance.isUnmounted) {
    if (__DEV__) {
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

export function getRootElement(
  block: Block,
  onDynamicFragment?: (frag: DynamicFragment) => void,
  recurse: boolean = true,
): Element | undefined {
  if (block instanceof Element) {
    return block
  }

  if (recurse && isVaporComponent(block)) {
    return getRootElement(block.block, onDynamicFragment, recurse)
  }

  if (isFragment(block) && !isTeleportFragment(block)) {
    if (block instanceof DynamicFragment && onDynamicFragment) {
      onDynamicFragment(block)
    }
    const { nodes } = block
    if (nodes instanceof Element && (nodes as any).$root) {
      return nodes
    }
    return getRootElement(nodes, onDynamicFragment, recurse)
  }

  // The root node contains comments. It is necessary to filter out
  // the comment nodes and return a single root node.
  // align with vdom behavior
  if (isArray(block)) {
    let singleRoot: Element | undefined
    let hasComment = false
    for (const b of block) {
      if (b instanceof Comment) {
        hasComment = true
        continue
      }
      const thisRoot = getRootElement(b, onDynamicFragment, recurse)
      // only return root if there is exactly one eligible root in the array
      if (!thisRoot || singleRoot) {
        return
      }
      singleRoot = thisRoot
    }
    return hasComment ? singleRoot : undefined
  }
}

function isVaporTransition(component: VaporComponent): boolean {
  return getComponentName(component) === 'VaporTransition'
}

function handleSetupResult(
  setupResult: any,
  component: VaporComponent,
  instance: VaporComponentInstance,
) {
  if (__DEV__) {
    pushWarningContext(instance)
  }

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
      if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
        instance.devtoolsRawSetupState = setupResult
      }
      instance.setupState = proxyRefs(setupResult)
      if (__DEV__) {
        instance.setupState = createDevSetupStateProxy(instance)
      }
      devRender(instance)
    }
  } else {
    // component has a render function but no setup function
    // (typically components with only a template and no state)
    if (setupResult === EMPTY_OBJ && component.render) {
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
    const root = getRootElement(
      instance.block,
      // attach attrs to root dynamic fragments for applying during each update
      frag => (frag.attrs = instance.attrs),
      false,
    )
    if (root) {
      renderEffect(() => {
        const attrs =
          isFunction(component) && !isVaporTransition(component)
            ? getFunctionalFallthrough(instance.attrs)
            : instance.attrs
        if (attrs) applyFallthroughProps(root, attrs)
      })
    } else if (
      __DEV__ &&
      ((!instance.accessedAttrs &&
        isArray(instance.block) &&
        instance.block.length) ||
        // preventing attrs fallthrough on Teleport
        // consistent with VDOM Teleport behavior
        isTeleportFragment(instance.block))
    ) {
      warnExtraneousAttributes(instance.attrs)
    }
  }

  if (__DEV__) {
    popWarningContext()
  }
}

export function getCurrentScopeId(): string | undefined {
  const scopeOwner = getScopeOwner()
  return scopeOwner ? scopeOwner.type.__scopeId : undefined
}
