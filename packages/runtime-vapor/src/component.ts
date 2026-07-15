import {
  type AsyncComponentInternalOptions,
  type ComponentInternalInstance,
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
  invalidateMount,
  isAsyncWrapper,
  isKeepAlive,
  markAsyncBoundary,
  nextUid,
  popWarningContext,
  pushWarningContext,
  queuePostFlushCb,
  registerHMR,
  resolveComponent,
  setCurrentInstance,
  setCurrentRenderingInstance,
  startMeasure,
  unregisterHMR,
  warn,
  warnExtraneousAttributes,
} from '@vue/runtime-dom'
import { type Block, findBlockBoundary, insert, isBlock, remove } from './block'
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
  snapshotRawProps,
} from './componentProps'
import { type RenderEffect, renderEffect } from './renderEffect'
import { emit, normalizeEmitsOptions } from './componentEmits'
import { setDynamicProps } from './dom/prop'
import {
  type LooseRawSlots,
  type RawSlots,
  type StaticSlots,
  dynamicSlotsProxyHandlers,
  getSlot,
  inOnceSlot,
  normalizeRawSlots,
  setCurrentSlotOwner,
  withOnceSlot,
} from './componentSlots'
import { hmrReload, hmrRerender } from './hmr'
import {
  type HydrationCursor,
  adoptTemplate,
  advanceHydrationNode,
  currentHydrationNode,
  enterHydrationBoundary,
  enterHydrationCursor,
  exitHydrationCursor,
  isComment,
  isHydrating,
  locateEndAnchor,
  markHydrationAnchor,
  nextLogicalSibling,
  setCurrentHydrationNode,
  withDeferredHydrationBoundary,
} from './dom/hydration'
import { createComment, createElement, createTextNode } from './dom/node'
import {
  isTeleportEnabled,
  isTeleportFragment,
  isVaporTeleport,
} from './teleport'
import type { KeepAliveInstance } from './components/KeepAlive'
import { getKeepAliveContext, isKeepAliveEnabled } from './keepAlive'
import {
  insertionAnchor,
  insertionParent,
  resetInsertionState,
} from './insertionState'
import type {
  DefineVaporComponent,
  VaporRenderResult,
} from './apiDefineComponent'
import { DynamicFragment, isDynamicFragment, isFragment } from './fragment'
import { resolvePendingSlotContent } from './dom/hydrateFragment'
import type { VaporElement } from './apiDefineCustomElement'
import {
  isSuspenseEnabled,
  parentSuspense,
  setParentSuspense,
} from './suspense'
import { isInteropEnabled } from './vdomInteropState'
import {
  getCurrentScopeId,
  setComponentScopeId,
  setScopeId,
  trackComponentScopeId,
} from './scopeId'
import { isTransitionEnabled, isVaporTransition } from './transition'

export { currentInstance } from '@vue/runtime-dom'

export type VaporComponent =
  | FunctionalVaporComponent<any>
  | VaporComponentOptions
  | DefineVaporComponent

export type FunctionalVaporComponent<
  Props = {},
  Emits extends EmitsOptions = {},
  Slots extends StaticSlots = StaticSlots,
  Exposed extends Record<string, any> = Record<string, any>,
> = ((
  props: Props & EmitsToProps<Emits>,
  ctx: {
    emit: EmitFn<Emits>
    slots: Slots
    attrs: Record<string, any>
    expose: <T extends Record<string, any> = Exposed>(exposed: T) => void
  },
) => VaporRenderResult) &
  Omit<
    VaporComponentOptions<ComponentPropsOptions<Props>, Emits, string, Slots>,
    'setup'
  > & {
    displayName?: string
  } & SharedInternalOptions

export interface VaporComponentOptions<
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
    AsyncComponentInternalOptions<
      VaporComponentOptions,
      VaporComponentInstance
    >,
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
// `createComponent` - luckily this is not user-facing, so we use intentionally
// wider types to make `createComponent` ergonomic in tests and internal call sites.
export type LooseRawProps = Record<string, unknown> & {
  $?: DynamicPropsSource[]
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
  managedMount = false,
  ce?: (instance: VaporComponentInstance) => void,
): VaporComponentInstance {
  // A component created while rendering a v-once slot should receive frozen
  // parent inputs, but its own render effects should still be live.
  const wasInOnceSlot = inOnceSlot
  if (wasInOnceSlot) once = true

  const _insertionParent = insertionParent
  const _insertionAnchor = insertionAnchor
  let hydrationClose: Node | null = null
  let hydrationCursor: HydrationCursor | null = null
  let exitHydrationBoundary: (() => void) | undefined
  let deferHydrationBoundary = false
  const finalizeHydrationBoundary = () => {
    exitHydrationBoundary && exitHydrationBoundary()
    if (hydrationClose && currentHydrationNode === hydrationClose) {
      advanceHydrationNode(hydrationClose)
    }
  }
  if (isHydrating) {
    resolvePendingSlotContent()
    hydrationCursor = enterHydrationCursor()
    if (component.__multiRoot && isComment(currentHydrationNode!, '[')) {
      hydrationClose = locateEndAnchor(currentHydrationNode!)
      exitHydrationBoundary = enterHydrationBoundary(
        hydrationClose && markHydrationAnchor(hydrationClose),
      )
      setCurrentHydrationNode(currentHydrationNode!.nextSibling)
    }
  } else {
    resetInsertionState()
  }

  let prevSuspense: SuspenseBoundary | null = null
  let hasParentSuspense = false
  try {
    if (
      __FEATURE_SUSPENSE__ &&
      isSuspenseEnabled &&
      currentInstance &&
      currentInstance.suspense
    ) {
      prevSuspense = setParentSuspense(currentInstance.suspense)
      hasParentSuspense = true
    }

    if (
      (isSingleRoot ||
        // transition has attrs fallthrough
        (isTransitionEnabled
          ? currentInstance && isVaporTransition(currentInstance!.type)
          : false)) &&
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
      isKeepAliveEnabled &&
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
    if (isInteropEnabled && appContext.vapor && !component.__vapor) {
      const frag = appContext.vapor.vdomMount(
        component as any,
        currentInstance as any,
        rawProps,
        normalizeRawSlots(rawSlots),
        once,
      )
      if (!isHydrating) {
        if (_insertionParent) insert(frag, _insertionParent, _insertionAnchor)
      } else {
        frag.hydrate()
      }
      return frag
    }

    // teleport
    if (isTeleportEnabled && isVaporTeleport(component)) {
      const frag = component.process(rawProps!, normalizeRawSlots(rawSlots))
      if (_insertionParent) {
        // Teleports mounted via insertion state are not part of the returned
        // block tree, so scope disposal must tear down their target-side state.
        onScopeDispose(() => frag.dispose(), true)
      }
      if (!isHydrating) {
        if (_insertionParent) insert(frag, _insertionParent, _insertionAnchor)
      } else {
        frag.hydrate()
      }

      return frag as any
    }

    const instance = new VaporComponentInstance(
      component,
      rawProps as RawProps,
      rawSlots,
      appContext,
      once,
      ce,
    )

    // Async wrappers are skipped here: their DynamicFragment resolves the outer
    // KeepAlive context from the wrapper's parent chain during setup.
    if (isKeepAliveEnabled && !isAsyncWrapper(instance)) {
      const keepAliveCtx = getKeepAliveContext(currentInstance)
      if (keepAliveCtx) keepAliveCtx.processShapeFlag(instance)
    }

    // reset currentSlotOwner to null to avoid affecting the child components
    const prevSlotOwner = setCurrentSlotOwner(null)
    let hasWarningContext = false
    let hasInitMeasure = false
    try {
      // HMR
      if (__DEV__) {
        registerHMR(instance)
        instance.isSingleRoot = isSingleRoot
        instance.hmrRerender = hmrRerender.bind(null, instance)
        instance.hmrReload = hmrReload.bind(null, instance)

        pushWarningContext(instance)
        hasWarningContext = true
        startMeasure(instance, `init`)
        hasInitMeasure = true

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
        const setup = () => setupComponent(instance, component)
        component.__asyncHydrate(
          currentHydrationNode as Element,
          instance,
          // Async hydration re-enters setup later, so preserve the component
          // boundary rule above when the delayed setup actually runs.
          wasInOnceSlot ? () => withOnceSlot(setup, false) : setup,
        )
      } else if (wasInOnceSlot) {
        withOnceSlot(() => setupComponent(instance, component), false)
      } else {
        setupComponent(instance, component)
      }
    } finally {
      if (__DEV__) {
        if (hasWarningContext) {
          popWarningContext()
        }
        if (hasInitMeasure) {
          endMeasure(instance, 'init')
        }
      }
      setCurrentSlotOwner(prevSlotOwner)
      if (__FEATURE_SUSPENSE__ && isSuspenseEnabled && hasParentSuspense) {
        setParentSuspense(prevSuspense)
        hasParentSuspense = false
      }
    }
    onScopeDispose(() => unmountComponent(instance), true)

    if (!managedMount && (_insertionParent || isHydrating)) {
      mountComponent(instance, _insertionParent!, _insertionAnchor)
    }

    if (
      __FEATURE_SUSPENSE__ &&
      isSuspenseEnabled &&
      isHydrating &&
      hydrationClose &&
      instance.suspense &&
      instance.asyncDep &&
      !instance.asyncResolved &&
      instance.restoreAsyncContext
    ) {
      deferHydrationBoundary = true
      instance.deferredHydrationBoundary = () => {
        if (
          instance.block &&
          hydrationClose &&
          findBlockBoundary(instance.block).nextNode ===
            hydrationClose.nextSibling
        ) {
          setCurrentHydrationNode(hydrationClose)
        }
        finalizeHydrationBoundary()
      }
      exitHydrationCursor(hydrationCursor)
    }

    return instance
  } finally {
    if (hasParentSuspense) {
      setParentSuspense(prevSuspense)
    }
    if (isHydrating && !deferHydrationBoundary) {
      // Boundary cleanup still needs the component-local cursor. Only after
      // that do we restore the outer cursor's resume point.
      finalizeHydrationBoundary()
      exitHydrationCursor(hydrationCursor)
    }
  }
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
  try {
    setDynamicProps(el, [attrs])
  } finally {
    isApplyingFallthroughProps = false
  }
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

function callRender(
  render: NonNullable<VaporComponentOptions['render']>,
  instance: VaporComponentInstance,
  setupState: Record<string, any>,
) {
  return callWithErrorHandling(render, instance, ErrorCodes.RENDER_FUNCTION, [
    setupState,
    instance.props,
    instance.emit,
    instance.attrs,
    instance.slots,
  ])
}

/**
 * dev only
 */
export function devRender(instance: VaporComponentInstance): void {
  const prev = setCurrentRenderingInstance(
    instance as unknown as ComponentInternalInstance,
  )
  try {
    instance.block =
      (instance.type.render
        ? callRender(instance.type.render, instance, instance.setupState!)
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
  } finally {
    setCurrentRenderingInstance(prev)
  }
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
  restoreAsyncContext?: () => void | (() => void)
  deferredHydrationBoundary?: () => void

  hasFallthrough: boolean

  // for keep-alive
  shapeFlag?: number
  $key?: any

  // for v-once: caches props/attrs values to ensure they remain frozen
  // even when the component re-renders due to local state changes
  oncePropsCache?: Record<string | symbol, any>
  isOnce: boolean

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

  // renderEffect creation counter for scheduler ordering.
  effectCount = 0

  // dev only
  setupState?: Exposed extends Block ? undefined : ShallowUnwrapRef<Exposed>
  devtoolsRawSetupState?: any
  hmrRerender?: () => void
  hmrReload?: (newComp: VaporComponent) => void
  propsOptions?: NormalizedPropsOptions
  emitsOptions?: ObjectEmitsOptions | null
  isSingleRoot?: boolean
  // for HMR rerender
  renderEffects?: RenderEffect[]

  /**
   * dev only flag to track whether $attrs was used during render.
   * If $attrs was used during render then the warning for failed attrs
   * fallthrough can be suppressed.
   */
  accessedAttrs: boolean = false

  // type only
  /**
   * @deprecated only used for JSX to detect props types.
   */
  // @ts-expect-error
  $props: Props

  constructor(
    comp: VaporComponent,
    rawProps?: RawProps | null,
    rawSlots?: LooseRawSlots | null,
    appContext?: GenericAppContext,
    once?: boolean,
    ce?: (instance: VaporComponentInstance) => void,
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
    this.isOnce = !!once

    this.emit = emit.bind(null, this) as EmitFn<Emits>
    this.expose = expose.bind(null, this) as any
    this.refs = EMPTY_OBJ as TypeRefs
    this.emitted = this.exposed = this.exposeProxy = this.propsDefaults = null

    // suspense related
    this.suspense = null
    this.suspenseId = 0
    if (__FEATURE_SUSPENSE__ && isSuspenseEnabled) {
      this.suspense = parentSuspense
      this.suspenseId = parentSuspense ? parentSuspense.pendingId : 0
    }
    this.asyncDep = null
    this.asyncResolved = false

    this.isMounted =
      this.isUnmounted =
      this.isUpdating =
      this.isDeactivated =
        false

    // init props
    // Snapshot raw parent inputs before creating proxies so delayed reads from
    // v-once children cannot observe later parent updates.
    this.rawProps =
      this.isOnce && rawProps
        ? snapshotRawProps(rawProps)
        : rawProps || EMPTY_OBJ
    this.hasFallthrough = hasFallthroughAttrs(comp, this.rawProps)
    if (rawProps || comp.props) {
      const [propsHandlers, attrsHandlers] = getPropsProxyHandlers(comp)
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
    const normalizedRawSlots = normalizeRawSlots(rawSlots)
    this.rawSlots = normalizedRawSlots || EMPTY_OBJ
    this.slots = (
      normalizedRawSlots
        ? new Proxy(normalizedRawSlots, dynamicSlotsProxyHandlers)
        : EMPTY_OBJ
    ) as Slots

    this.scopeId = getCurrentScopeId()

    // apply custom element special handling
    if (ce) {
      ce(this)
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
 * Resolve an asset component by name before passing it to the fallback helper;
 * a string passed directly to `createComponentWithFallback` is plain element
 * fallback, not a component name.
 */
export function createAssetComponent(
  name: string,
  rawProps?: LooseRawProps | null,
  rawSlots?: LooseRawSlots | null,
  isSingleRoot?: boolean,
  once?: boolean,
  maybeSelfReference?: boolean,
  appContext?: GenericAppContext,
): HTMLElement | VaporComponentInstance {
  return createComponentWithFallback(
    resolveComponent(name, maybeSelfReference) as VaporComponent | string,
    rawProps,
    rawSlots,
    isSingleRoot,
    once,
    appContext,
  )
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
    if (isHydrating && currentHydrationNode) {
      if (isReusableNullComponentAnchor(currentHydrationNode)) {
        const node = currentHydrationNode
        if (isComment(node, '')) {
          advanceHydrationNode(node)
        }
        return node as any as HTMLElement
      }

      const nextAnchor = nextLogicalSibling(currentHydrationNode)
      if (nextAnchor && isReusableNullComponentAnchor(nextAnchor)) {
        // Keep the cursor on the stale SSR node before `nextAnchor` so the
        // owning DynamicFragment can trim that range on hydrate exit and then
        // advance past the reused null-branch anchor in one place.
        return nextAnchor as any as HTMLElement
      }
    }
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

function isReusableNullComponentAnchor(node: Node): boolean {
  return (
    isComment(node, '') ||
    isComment(node, 'dynamic-component') ||
    isComment(node, 'async component') ||
    isComment(node, 'keyed')
  )
}

export function createPlainElement(
  comp: string,
  rawProps?: LooseRawProps | null,
  rawSlots?: LooseRawSlots | null,
  isSingleRoot?: boolean,
  once?: boolean,
): HTMLElement {
  rawSlots = normalizeRawSlots(rawSlots)
  const _insertionParent = insertionParent
  const _insertionAnchor = insertionAnchor
  let hydrationCursor: HydrationCursor | null = null
  if (isHydrating) {
    resolvePendingSlotContent()
    hydrationCursor = enterHydrationCursor()
  } else {
    resetInsertionState()
  }

  const defaultSlot = rawSlots && getSlot(rawSlots as RawSlots, 'default')
  const hasDynamicSlots = !!rawSlots && !!rawSlots.$
  const adoptHydrationChildren = !!defaultSlot
  const hydrationTemplate =
    hasDynamicSlots && !defaultSlot ? `<${comp}><!></${comp}>` : `<${comp}/>`
  const el = isHydrating
    ? (adoptTemplate(
        currentHydrationNode!,
        hydrationTemplate,
        adoptHydrationChildren,
      ) as HTMLElement)
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
      nextNode = nextLogicalSibling(el)
      let child = el.firstChild
      if (rawSlots.$ && !child) {
        // SSR may omit default-slot nodes for dynamic native children.
        // Seed a local anchor so the inner fragment can locate and reuse it.
        child = el.appendChild(
          markHydrationAnchor(__DEV__ ? createComment('') : createTextNode()),
        )
      }
      setCurrentHydrationNode(child)
    }
    if (rawSlots.$) {
      // Dynamic element children don't own an SSR slot-range anchor, so flag
      // this as a native-children fragment. Hydration keys off `nativeChildren`
      // (not the label) to inject/reuse its own anchor instead of trying to
      // reuse SlotFragment-style anchors. The hydrating label stays empty so
      // the runtime anchor renders as `<!---->`.
      const frag = new DynamicFragment(
        isHydrating ? '' : __DEV__ ? 'slot' : undefined,
      )
      frag.nativeChildren = true
      renderEffect(() => frag.update(getSlot(rawSlots as RawSlots, 'default')))
      if (!isHydrating) insert(frag, el)
    } else {
      const slot = getSlot(rawSlots as RawSlots, 'default')
      if (slot) {
        const block = slot()
        if (!isHydrating) insert(block, el)
      }
    }
    if (isHydrating) {
      setCurrentHydrationNode(nextNode)
    }
  }

  if (!isHydrating) {
    if (_insertionParent) insert(el, _insertionParent, _insertionAnchor)
  } else {
    exitHydrationCursor(hydrationCursor)
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
    isSuspenseEnabled &&
    instance.suspense &&
    instance.asyncDep &&
    !instance.asyncResolved
  ) {
    const component = instance.type
    instance.suspense.registerDep(instance, setupResult => {
      // Final suspense retry after async setup resolves. Restore hydrating
      // mode so the last mount does not fall back to fresh DOM insertion.
      const reset =
        instance.restoreAsyncContext && instance.restoreAsyncContext()
      try {
        if (isHydrating) {
          withDeferredHydrationBoundary(() => {
            handleSetupResult(setupResult, component, instance)
            mountComponent(instance, parent, anchor)
            if (instance.deferredHydrationBoundary) {
              instance.deferredHydrationBoundary()
            }
          })
        } else {
          handleSetupResult(setupResult, component, instance)
          mountComponent(instance, parent, anchor)
        }
      } finally {
        if (isHydrating) {
          instance.deferredHydrationBoundary = undefined
        }
        instance.restoreAsyncContext = undefined
        if (reset) reset()
      }
    })
    return
  }

  if (
    isKeepAliveEnabled &&
    instance.shapeFlag! & ShapeFlags.COMPONENT_KEPT_ALIVE
  ) {
    ;(instance.parent as KeepAliveInstance)!.ctx.activate(
      instance,
      parent,
      anchor,
    )
    return
  }

  // custom element style injection
  const { root, type } = instance as GenericComponentInstance
  if (root && root.ce && (root.ce as VaporElement)._hasShadowRoot()) {
    root.ce!._injectChildStyle(
      type,
      instance.parent ? instance.parent.type : undefined,
    )
  }

  if (__DEV__) {
    startMeasure(instance, `mount`)
  }
  if (instance.bm) invokeArrayFns(instance.bm)
  if (!isHydrating) {
    insert(instance.block, parent, anchor)
    setComponentScopeId(instance)
  } else {
    // Hydrated roots already have SSR scope attrs. Track dynamic roots so
    // client-only branch switches keep inherited scope ids.
    trackComponentScopeId(instance)
  }
  if (instance.m) queuePostFlushCb(instance.m!)
  if (
    isKeepAliveEnabled &&
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
    isKeepAliveEnabled &&
    instance.shapeFlag! & ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE &&
    instance.parent &&
    instance.parent.vapor &&
    (instance.parent as KeepAliveInstance).ctx
  ) {
    if (parentNode) {
      ;(instance.parent as KeepAliveInstance)!.ctx.deactivate(instance)
    }
    return
  }

  if (
    !instance.isUnmounted &&
    (instance.isMounted ||
      // A hydrating async setup component can be unmounted before its block exists.
      // It still needs normal scope cleanup so a later resolve is ignored.
      (instance.asyncDep && !instance.asyncResolved))
  ) {
    if (__DEV__) {
      unregisterHMR(instance)
    }
    invalidateMount(instance.m)
    invalidateMount(instance.a)
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
    if (instance.block) {
      remove(instance.block, parentNode)
    } else {
      // TODO: a hydrated async setup component may own SSR DOM before its
      // block exists. That adopted DOM should be removed on this path.
    }
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

  if (isFragment(block) && !(isTeleportEnabled && isTeleportFragment(block))) {
    if (isDynamicFragment(block) && onDynamicFragment) {
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
      instance.block = callRender(component.render, instance, setupResult)
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
    const getFallthroughAttrs =
      isFunction(component) &&
      !(isTransitionEnabled ? isVaporTransition(component) : false)
        ? () => getFunctionalFallthrough(instance.attrs)
        : () => instance.attrs
    // attach attrs to the root element, or to root dynamic fragments so they
    // can be (re-)applied during each branch update
    applyFallthroughAttrs(instance.block, instance, getFallthroughAttrs)
  }

  if (__DEV__) {
    popWarningContext()
  }
}

// Attach fallthrough attrs to the single root element. When the root is a
// dynamic fragment (e.g. v-if), the attrs are (re-)applied on each branch
// update via its insert hook. Slots and teleports warn instead of receiving
// the attrs, consistent with VDOM behavior.
function applyFallthroughAttrs(
  block: Block,
  instance: VaporComponentInstance,
  getFallthroughAttrs: () => Record<string, any> | undefined,
  scope?: EffectScope,
): void {
  let hasSlotFragment = false
  let dynamicFragments: DynamicFragment[] | undefined
  const root = getRootElement(
    block,
    frag => {
      if (frag.isSlot) {
        hasSlotFragment = true
      } else {
        ;(dynamicFragments ||= []).push(frag)
      }
    },
    false,
  )

  const dynamicRoot = root ? undefined : getSingleDynamicRootChain(block)
  const fragmentsToRegister = root
    ? dynamicFragments
    : dynamicRoot && dynamicRoot.fragments
  if (fragmentsToRegister) {
    for (const frag of fragmentsToRegister) {
      // slot fragments warn instead of inheriting attrs, skip them
      if (!frag.isSlot) {
        // Nested dynamic fragments need their own fallthrough hook.
        registerDynamicFragmentFallthroughAttrs(
          frag,
          instance,
          getFallthroughAttrs,
        )
      }
    }
  }

  if (root && !hasSlotFragment) {
    const applyEffect = () =>
      renderEffect(() => {
        const attrs = getFallthroughAttrs()
        if (attrs) applyFallthroughProps(root, attrs)
      })
    // ensure the render effect is cleaned up when the branch scope is stopped
    scope ? scope.run(applyEffect) : applyEffect()
  } else if (
    __DEV__ &&
    (hasSlotFragment ||
      (dynamicRoot && dynamicRoot.hasNonSingleRoot) ||
      (isTeleportEnabled && containsTeleportFragment(block)) ||
      (!instance.accessedAttrs && isArray(block) && block.length))
  ) {
    warnExtraneousAttributes(instance.attrs)
  }
}

interface DynamicRootChain {
  fragments: DynamicFragment[]
  hasNonSingleRoot: boolean
}

// Resolve the chain of dynamic fragments leading to a single root candidate.
// Used when getRootElement finds no element root, so fallthrough attrs are
// registered only for true single-root components rather than for any dynamic
// fragment seen during traversal. Dynamic root branches that are currently
// non-single-root still keep the outer fragment hook for future branch updates,
// but report hasNonSingleRoot so the current render can warn.
function getSingleDynamicRootChain(block: Block): DynamicRootChain | undefined {
  if (isDynamicFragment(block)) {
    const { nodes } = block
    const nested = getSingleDynamicRootChain(nodes)
    return {
      fragments: nested ? [block, ...nested.fragments] : [block],
      hasNonSingleRoot: nested
        ? nested.hasNonSingleRoot
        : isArray(nodes) && nodes.some(child => !(child instanceof Comment)),
    }
  }

  if (isFragment(block) && !(isTeleportEnabled && isTeleportFragment(block))) {
    return getSingleDynamicRootChain(block.nodes)
  }

  if (isArray(block)) {
    let singleRoot: DynamicRootChain | undefined
    let hasComment = false
    for (const child of block) {
      if (child instanceof Comment) {
        hasComment = true
        continue
      }
      const childRoot = getSingleDynamicRootChain(child)
      if (!childRoot || singleRoot) {
        return
      }
      singleRoot = childRoot
    }
    return hasComment ? singleRoot : undefined
  }
}

function containsTeleportFragment(block: Block): boolean {
  if (isTeleportFragment(block)) return true
  if (isArray(block)) {
    return block.some(
      child => !(child instanceof Comment) && containsTeleportFragment(child),
    )
  }
  return isFragment(block) && containsTeleportFragment(block.nodes)
}

function registerDynamicFragmentFallthroughAttrs(
  frag: DynamicFragment,
  instance: VaporComponentInstance,
  getFallthroughAttrs: () => Record<string, any> | undefined,
): void {
  // avoid registering duplicate hooks
  if (frag.hasFallthroughAttrs) return

  frag.hasFallthroughAttrs = true
  ;(frag.onBeforeInsert ||= []).push(nodes =>
    applyFallthroughAttrs(nodes, instance, getFallthroughAttrs, frag.scope!),
  )
}
